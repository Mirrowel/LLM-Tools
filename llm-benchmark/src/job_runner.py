"""
Background Job Runner for Comparative Judging.

Handles async execution of comparative evaluation jobs with progress tracking.
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class JobProgress:
    """Tracks progress of a job."""
    current: int = 0
    total: int = 0
    current_question: str = ""
    status: JobStatus = JobStatus.PENDING
    error: Optional[str] = None


@dataclass
class ComparativeJudgeJob:
    """Represents a comparative judging job."""
    job_id: str
    run_ids: List[str]
    question_ids: List[str]
    created_at: str
    status: JobStatus
    progress: JobProgress
    results_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['status'] = self.status.value
        data['progress']['status'] = self.progress.status.value
        return data


class JobRunner:
    """
    Manages background jobs for comparative evaluation.

    This is a simple in-memory job runner. For production, consider using
    Celery, RQ, or similar task queue systems.
    """

    def __init__(self, results_dir: Path):
        """
        Initialize the job runner.

        Args:
            results_dir: Directory where results are stored
        """
        self.results_dir = Path(results_dir)
        self.jobs: Dict[str, ComparativeJudgeJob] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}

    def create_job(self, run_ids: List[str], question_ids: List[str]) -> str:
        """
        Create a new comparative judge job.

        Args:
            run_ids: List of run IDs to compare
            question_ids: List of question IDs to evaluate

        Returns:
            job_id: Unique identifier for the job
        """
        # Generate unique job ID
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        job_id = f"comp_judge_{timestamp}"

        # Create job
        job = ComparativeJudgeJob(
            job_id=job_id,
            run_ids=run_ids,
            question_ids=question_ids,
            created_at=datetime.now().isoformat(),
            status=JobStatus.PENDING,
            progress=JobProgress(total=len(question_ids))
        )

        self.jobs[job_id] = job
        return job_id

    def get_job(self, job_id: str) -> Optional[ComparativeJudgeJob]:
        """Get job by ID."""
        return self.jobs.get(job_id)

    def get_all_jobs(self) -> List[ComparativeJudgeJob]:
        """Get all jobs, sorted by creation time (newest first)."""
        return sorted(
            self.jobs.values(),
            key=lambda j: j.created_at,
            reverse=True
        )

    def _get_provider_from_model(self, model: str) -> str:
        """Extract provider name from model string.

        Args:
            model: Model string like "openai/gpt-4" or "opencode/big-pickle"

        Returns:
            Provider name like "openai" or "opencode"
        """
        if "/" in model:
            return model.split("/")[0]
        return "unknown"

    async def _evaluate_question_with_semaphore(
        self,
        semaphore: asyncio.Semaphore,
        job: ComparativeJudgeJob,
        question_id: str,
        evaluator,
        question_loader,
        results_manager,
        results_path: Path
    ) -> Optional[Dict]:
        """
        Evaluate a single question with concurrency control.

        Args:
            semaphore: Semaphore for concurrency control
            job: Job instance
            question_id: ID of question to evaluate
            evaluator: ComparativeJudgeEvaluator instance
            question_loader: QuestionLoader instance
            results_manager: ResultsManager instance
            results_path: Path to save results

        Returns:
            Dict with evaluation results or None if skipped
        """
        async with semaphore:
            try:
                # Get question
                question = question_loader.get_question(question_id)
                if not question:
                    print(f"Question {question_id} not found, skipping")
                    return None

                # Collect responses from all runs
                responses = {}
                code_execution_results = {}

                for run_id in job.run_ids:
                    # Get run metadata to find model name
                    run = results_manager.get_run(run_id)
                    if not run:
                        continue

                    # Get response for this model
                    response = results_manager.get_response(
                        run_id,
                        run.model,
                        question_id
                    )
                    if response:
                        responses[run.model] = response

                        # Try to get code execution results for this model/question
                        code_eval = results_manager.get_evaluation(
                            run_id,
                            run.model,
                            question_id,
                            "code_execution"
                        )
                        if code_eval:
                            code_execution_results[run.model] = {
                                'passed': code_eval.passed,
                                'score': code_eval.score,
                                'reasoning': code_eval.reasoning,
                                'error': code_eval.details.get('error') if code_eval.details else None,
                                'output': code_eval.details.get('output') if code_eval.details else None
                            }

                if not responses:
                    print(f"No responses found for question {question_id}, skipping")
                    return None

                # Run comparative evaluation with code execution results and results_dir
                results = await evaluator.evaluate_question(
                    question,
                    responses,
                    code_execution_results=code_execution_results if code_execution_results else None,
                    results_dir=self.results_dir
                )

                # Save results for this question
                question_results = {
                    'question_id': question_id,
                    'timestamp': datetime.now().isoformat(),
                    'results': results
                }

                question_file = results_path / f"{question_id}.json"
                with open(question_file, 'w') as f:
                    json.dump(question_results, f, indent=2)

                return results

            except Exception as e:
                print(f"Error evaluating question {question_id}: {e}")
                raise  # Re-raise to be caught by gather

    async def run_job(
        self,
        job_id: str,
        evaluator,
        question_loader,
        results_manager,
        max_concurrent: int = 3,
        provider_concurrency: Optional[Dict[str, int]] = None
    ):
        """
        Execute a comparative judge job asynchronously.

        Args:
            job_id: ID of the job to run
            evaluator: ComparativeJudgeEvaluator instance
            question_loader: QuestionLoader instance
            results_manager: ResultsManager instance
            max_concurrent: Maximum number of concurrent requests (global default)
            provider_concurrency: Per-provider concurrency limits (optional)
        """
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        try:
            # Update status
            job.status = JobStatus.RUNNING
            job.progress.status = JobStatus.RUNNING

            # Create results directory
            results_path = self.results_dir / "comparative_judge" / job_id
            results_path.mkdir(parents=True, exist_ok=True)
            job.results_path = str(results_path)

            # Save job metadata
            self._save_job_metadata(job)

            # Determine judge concurrency based on judge model's provider
            judge_provider = self._get_provider_from_model(evaluator.judge_model)
            judge_concurrency = max_concurrent
            if provider_concurrency and judge_provider in provider_concurrency:
                judge_concurrency = provider_concurrency[judge_provider]
                print(f"Using judge-specific concurrency: {judge_concurrency} for {judge_provider}")

            # Create semaphore for concurrent judge evaluations
            semaphore = asyncio.Semaphore(judge_concurrency)

            # Process questions concurrently
            all_results = {}
            tasks = []

            for question_id in job.question_ids:
                task = self._evaluate_question_with_semaphore(
                    semaphore,
                    job,
                    question_id,
                    evaluator,
                    question_loader,
                    results_manager,
                    results_path
                )
                tasks.append(task)

            # Run all evaluations concurrently
            results_list = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for i, (question_id, result) in enumerate(zip(job.question_ids, results_list)):
                # Update progress
                job.progress.current = i + 1
                job.progress.current_question = question_id

                if isinstance(result, Exception):
                    print(f"Error evaluating question {question_id}: {result}")
                    continue

                if result is not None:
                    all_results[question_id] = result

            # Calculate aggregate leaderboard
            leaderboard = self._calculate_leaderboard(all_results)

            # Save aggregate results
            aggregate_file = results_path / "leaderboard.json"
            with open(aggregate_file, 'w') as f:
                json.dump(leaderboard, f, indent=2)

            # Mark job as completed
            job.status = JobStatus.COMPLETED
            job.progress.status = JobStatus.COMPLETED
            job.progress.current = len(job.question_ids)
            self._save_job_metadata(job)

        except Exception as e:
            # Mark job as failed
            job.status = JobStatus.FAILED
            job.progress.status = JobStatus.FAILED
            job.progress.error = str(e)
            self._save_job_metadata(job)
            print(f"Job {job_id} failed: {e}")

    def start_job(
        self,
        job_id: str,
        evaluator,
        question_loader,
        results_manager,
        max_concurrent: int = 3,
        provider_concurrency: Optional[Dict[str, int]] = None
    ) -> asyncio.Task:
        """
        Start a job in the background.

        Args:
            job_id: ID of the job to start
            evaluator: ComparativeJudgeEvaluator instance
            question_loader: QuestionLoader instance
            results_manager: ResultsManager instance
            max_concurrent: Maximum number of concurrent requests (global default)
            provider_concurrency: Per-provider concurrency limits (optional)

        Returns:
            asyncio.Task that's running the job
        """
        task = asyncio.create_task(
            self.run_job(
                job_id,
                evaluator,
                question_loader,
                results_manager,
                max_concurrent,
                provider_concurrency
            )
        )
        self.running_tasks[job_id] = task
        return task

    def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a running job.

        Args:
            job_id: ID of the job to cancel

        Returns:
            True if cancelled, False if not found or not running
        """
        job = self.jobs.get(job_id)
        if not job or job.status != JobStatus.RUNNING:
            return False

        task = self.running_tasks.get(job_id)
        if task:
            task.cancel()
            job.status = JobStatus.CANCELLED
            job.progress.status = JobStatus.CANCELLED
            self._save_job_metadata(job)
            return True

        return False

    def _save_job_metadata(self, job: ComparativeJudgeJob):
        """Save job metadata to disk."""
        if not job.results_path:
            return

        metadata_file = Path(job.results_path) / "metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(job.to_dict(), f, indent=2)

    def _calculate_leaderboard(self, all_results: Dict[str, Dict[str, Dict]]) -> List[Dict]:
        """
        Calculate aggregate leaderboard from all question results.

        Args:
            all_results: Dict mapping question_id -> model_name -> {score, reasoning, ...}

        Returns:
            List of leaderboard entries sorted by average score
        """
        model_scores = {}

        # Aggregate scores per model
        for question_id, question_results in all_results.items():
            for model_name, result in question_results.items():
                if model_name not in model_scores:
                    model_scores[model_name] = {
                        'scores': [],
                        'passed_count': 0
                    }

                model_scores[model_name]['scores'].append(result['score'])
                if result.get('passed', False):
                    model_scores[model_name]['passed_count'] += 1

        # Build leaderboard entries
        leaderboard = []
        for model_name, data in model_scores.items():
            scores = data['scores']
            leaderboard.append({
                'model_name': model_name,
                'average_score': sum(scores) / len(scores) if scores else 0,
                'total_questions': len(scores),
                'passed_count': data['passed_count'],
                'pass_rate': data['passed_count'] / len(scores) if scores else 0
            })

        # Sort by average score (descending)
        leaderboard.sort(key=lambda x: x['average_score'], reverse=True)

        return leaderboard

    def load_job_results(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Load results for a completed job.

        Args:
            job_id: ID of the job

        Returns:
            Dict with leaderboard and per-question results
        """
        job = self.jobs.get(job_id)
        if not job or not job.results_path:
            return None

        results_path = Path(job.results_path)
        if not results_path.exists():
            return None

        # Load leaderboard
        leaderboard_file = results_path / "leaderboard.json"
        leaderboard = []
        if leaderboard_file.exists():
            with open(leaderboard_file, 'r') as f:
                leaderboard = json.load(f)

        # Load per-question results
        by_question = {}
        for question_file in results_path.glob("*.json"):
            if question_file.name == "metadata.json" or question_file.name == "leaderboard.json":
                continue

            with open(question_file, 'r') as f:
                question_data = json.load(f)
                by_question[question_data['question_id']] = question_data

        return {
            'job_id': job_id,
            'metadata': job.to_dict(),
            'leaderboard': leaderboard,
            'by_question': by_question
        }


# Global job runner instance (singleton)
_job_runner_instance = None


def get_job_runner(results_dir: Path = None) -> JobRunner:
    """Get or create the global job runner instance."""
    global _job_runner_instance

    if _job_runner_instance is None:
        if results_dir is None:
            results_dir = Path("results")
        _job_runner_instance = JobRunner(results_dir)

    return _job_runner_instance
