"""
Async Benchmark Runner Wrapper
Wraps BenchmarkRunner for web execution with progress tracking.
"""

import asyncio
import sys
import threading
import time
from io import StringIO
from typing import Dict, Any, Optional, List
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime

from lib.rotator_library.client import RotatingClient
from src.runner import BenchmarkRunner
from viewer.benchmark_job_manager import get_job_manager


class ConsoleCapture:
    """Capture console output and forward to job manager logs"""

    def __init__(self, job_manager, level="info"):
        self.job_manager = job_manager
        self.level = level
        self.buffer = StringIO()

    def write(self, text):
        """Write to buffer and job manager"""
        if text and text.strip():
            # Remove ANSI color codes for cleaner logs
            clean_text = self._strip_ansi(text.strip())
            if clean_text:
                # Detect log level from content
                level = self._detect_level(clean_text)
                self.job_manager.add_log(clean_text, level=level)

        # Also write to buffer
        self.buffer.write(text)
        return len(text)

    def flush(self):
        """Flush buffer"""
        self.buffer.flush()

    def _strip_ansi(self, text: str) -> str:
        """Remove ANSI escape sequences"""
        import re
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)

    def _detect_level(self, text: str) -> str:
        """Detect log level from message content"""
        text_lower = text.lower()

        if any(word in text_lower for word in ['error', 'failed', 'exception', '✗']):
            return "error"
        elif any(word in text_lower for word in ['warning', 'warn', '⚠']):
            return "warning"
        elif any(word in text_lower for word in ['success', 'complete', '✓', '✅']):
            return "success"
        else:
            return "info"


class ProgressTracker:
    """Track benchmark progress and update job manager"""

    def __init__(self, job_manager):
        self.job_manager = job_manager
        self.start_time = time.time()

    def update(self, **kwargs):
        """Update progress with elapsed time"""
        elapsed = time.time() - self.start_time
        kwargs['elapsed_seconds'] = elapsed
        self.job_manager.update_progress(**kwargs)


class AsyncBenchmarkRunner:
    """
    Wrapper around BenchmarkRunner for async web execution.
    Captures output, tracks progress, and manages job state.
    """

    def __init__(self):
        self.job_manager = get_job_manager()
        self.cancel_event = threading.Event()
        self.runner_thread: Optional[threading.Thread] = None

    async def start_benchmark(
        self,
        job_id: str,
        client: RotatingClient,
        config: Dict[str, Any]
    ):
        """
        Start a benchmark run in the background.

        Args:
            job_id: Unique job identifier
            client: RotatingClient for API calls
            config: Benchmark configuration
        """
        # Create job
        self.job_manager.create_job(job_id, config)
        self.cancel_event.clear()

        # Start benchmark in background thread
        self.runner_thread = threading.Thread(
            target=self._run_benchmark_sync,
            args=(client, config),
            daemon=True
        )
        self.runner_thread.start()

    def _run_benchmark_sync(self, client: RotatingClient, config: Dict[str, Any]):
        """
        Run benchmark in a synchronous context (thread).
        This is needed because we need to run async code in a new event loop.
        """
        try:
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # Run benchmark
            loop.run_until_complete(self._run_benchmark_async(client, config))

        except Exception as e:
            self.job_manager.fail_job(str(e))
        finally:
            loop.close()

    async def _run_benchmark_async(self, client: RotatingClient, config: Dict[str, Any]):
        """
        Actual async benchmark execution with progress tracking.
        """
        job_manager = self.job_manager
        tracker = ProgressTracker(job_manager)

        try:
            # Mark job as running
            job_manager.start_job()

            # Extract config
            models = config.get("models", [])
            categories = config.get("categories", None)
            question_ids = config.get("question_ids", None)
            max_concurrent = config.get("max_concurrent", 10)
            provider_concurrency = config.get("provider_concurrency", None)
            judge_model = config.get("judge_model", "anthropic/claude-3-5-sonnet-20241022")
            questions_dir = config.get("questions_dir", "questions")
            results_dir = config.get("results_dir", "results")

            # Get model configs
            model_configs = config.get("model_configs", {})
            model_system_instructions = {}
            model_options = {}
            model_system_instruction_positions = {}

            for model_name, model_config in model_configs.items():
                if "system_instruction" in model_config:
                    model_system_instructions[model_name] = model_config["system_instruction"]
                if "system_instruction_position" in model_config:
                    model_system_instruction_positions[model_name] = model_config["system_instruction_position"]
                if "options" in model_config:
                    model_options[model_name] = model_config["options"]

            # Get code formatting settings
            code_formatting = config.get("code_formatting_instructions", {})
            code_formatting_enabled = code_formatting.get("enabled", True)
            code_formatting_instruction = code_formatting.get("instruction", None)

            # Create benchmark runner
            runner = BenchmarkRunner(
                client=client,
                judge_model=judge_model,
                questions_dir=questions_dir,
                results_dir=results_dir,
                model_system_instructions=model_system_instructions,
                model_options=model_options,
                model_system_instruction_positions=model_system_instruction_positions,
                code_formatting_enabled=code_formatting_enabled,
                code_formatting_instruction=code_formatting_instruction
            )

            # Capture console output
            stdout_capture = ConsoleCapture(job_manager, level="info")
            stderr_capture = ConsoleCapture(job_manager, level="error")

            job_manager.add_log("Loading questions...", level="info")

            # Load questions to get total count
            if question_ids:
                questions = [runner.question_loader.get_question(qid) for qid in question_ids]
                questions = [q for q in questions if q is not None]
            elif categories:
                questions = []
                for category in categories:
                    questions.extend(runner.question_loader.load_category(category))
            else:
                questions = runner.question_loader.load_all_questions()

            questions_total = len(questions)
            tracker.update(
                questions_total=questions_total,
                total_models=len(models)
            )

            job_manager.add_log(
                f"Loaded {questions_total} questions across {len(models)} model(s)",
                level="success"
            )

            # Intercept runner methods to track progress
            original_run_model = runner._run_model_benchmark

            async def tracked_run_model(model: str, questions: List, max_concurrent: int):
                """Wrapped method to track per-model progress"""
                # Update current model
                current_index = models.index(model)
                tracker.update(
                    current_model=model,
                    current_model_index=current_index,
                    current_phase="generating_responses",
                    questions_completed=0
                )

                job_manager.add_log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", level="info")
                job_manager.add_log(f"Model {current_index + 1}/{len(models)}: {model}", level="info")
                job_manager.add_log(f"Phase: Generating responses for {questions_total} questions", level="info")

                # Intercept generate and evaluate methods
                original_generate = runner._generate_response_with_semaphore
                original_evaluate = runner._evaluate_response_with_semaphore

                questions_completed = 0
                evaluations_completed = 0
                evaluation_phase_started = False

                async def tracked_generate(*args, **kwargs):
                    """Track question completion during generation"""
                    nonlocal questions_completed

                    # Log BEFORE generation starts
                    question = args[2] if len(args) > 2 else None
                    if question:
                        job_manager.add_log(
                            f"[{questions_completed + 1}/{questions_total}] Starting: {question.id}",
                            level="info"
                        )

                    # Run generation
                    result = await original_generate(*args, **kwargs)

                    questions_completed += 1
                    tracker.update(
                        questions_completed=questions_completed,
                        current_phase="generating_responses"
                    )

                    # Log AFTER completion
                    if question:
                        if result.error:
                            job_manager.add_log(
                                f"[{questions_completed}/{questions_total}] ✗ {question.id} - Error: {result.error}",
                                level="error"
                            )
                        else:
                            # Show more detail about the response
                            ttft = result.metrics.get('time_to_first_token', 0)
                            latency = result.metrics.get('latency', 0)
                            tokens = result.metrics.get('completion_tokens', 0)
                            reasoning_tokens = result.metrics.get('reasoning_tokens', 0)

                            details = f"{latency:.1f}s"
                            if ttft > 0:
                                details += f", TTFT: {ttft:.2f}s"
                            details += f", {tokens} tokens"
                            if reasoning_tokens > 0:
                                details += f" ({reasoning_tokens} reasoning)"

                            job_manager.add_log(
                                f"[{questions_completed}/{questions_total}] ✓ {question.id} - Generated ({details})",
                                level="success"
                            )

                    # Check for cancellation
                    if self.cancel_event.is_set():
                        raise Exception("Benchmark cancelled by user")

                    return result

                async def tracked_evaluate(*args, **kwargs):
                    """Track evaluation phase"""
                    nonlocal evaluations_completed, evaluation_phase_started

                    # Log phase transition on first evaluation
                    if not evaluation_phase_started:
                        evaluation_phase_started = True
                        job_manager.add_log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", level="info")
                        job_manager.add_log(f"Phase: Evaluating {questions_total} responses", level="info")

                    # Get question from args
                    question = args[0] if len(args) > 0 else None

                    # Log before evaluation
                    if question:
                        job_manager.add_log(
                            f"[{evaluations_completed + 1}/{questions_total}] Evaluating: {question.id}",
                            level="info"
                        )

                    # Run evaluation
                    result = await original_evaluate(*args, **kwargs)

                    evaluations_completed += 1

                    # Update phase to evaluation
                    tracker.update(
                        current_phase="evaluating",
                        questions_completed=evaluations_completed
                    )

                    # Log evaluation result
                    if question and result:
                        score = result.score if hasattr(result, 'score') else 'N/A'
                        passed = result.passed if hasattr(result, 'passed') else False
                        status_icon = "✓" if passed else "✗"
                        job_manager.add_log(
                            f"[{evaluations_completed}/{questions_total}] {status_icon} {question.id} - Evaluated (Score: {score})",
                            level="success" if passed else "warning"
                        )

                    # Check for cancellation
                    if self.cancel_event.is_set():
                        raise Exception("Benchmark cancelled by user")

                    return result

                # Monkey patch methods
                runner._generate_response_with_semaphore = tracked_generate
                runner._evaluate_response_with_semaphore = tracked_evaluate

                # Run original method
                result = await original_run_model(model, questions, max_concurrent)

                # Restore original methods
                runner._generate_response_with_semaphore = original_generate
                runner._evaluate_response_with_semaphore = original_evaluate

                # Mark model as completed
                tracker.update(
                    models_completed=current_index + 1
                )

                return result

            # Monkey patch run_model method
            runner._run_model_benchmark = tracked_run_model

            # Create a timer update task that runs every second
            async def update_timer():
                """Update elapsed time every second"""
                while not self.cancel_event.is_set():
                    await asyncio.sleep(1)
                    tracker.update()  # Just update elapsed time

            # Start timer task
            timer_task = asyncio.create_task(update_timer())

            try:
                # Run benchmark with console capture
                with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                    run_id = await runner.run_benchmark(
                        models=models,
                        categories=categories,
                        question_ids=question_ids,
                        max_concurrent=max_concurrent,
                        provider_concurrency=provider_concurrency
                    )

                # Mark as completed
                job_manager.complete_job(run_id)
            finally:
                # Cancel timer task
                timer_task.cancel()
                try:
                    await timer_task
                except asyncio.CancelledError:
                    pass

        except Exception as e:
            error_msg = str(e)

            # Check if it was a cancellation
            if "cancelled" in error_msg.lower():
                job_manager.cancel_job()
            else:
                job_manager.fail_job(error_msg)

    def cancel(self):
        """Cancel the running benchmark"""
        if self.job_manager.is_running():
            self.cancel_event.set()
            job_manager = self.job_manager
            job_manager.add_log("Cancellation requested...", level="warning")

            # Wait for thread to finish (with timeout)
            if self.runner_thread and self.runner_thread.is_alive():
                self.runner_thread.join(timeout=5.0)
        else:
            raise ValueError("No benchmark is currently running")

    def get_status(self) -> Optional[Dict[str, Any]]:
        """Get current job status"""
        return self.job_manager.get_current_job()


# Global singleton instance
_runner_instance: Optional[AsyncBenchmarkRunner] = None
_instance_lock = threading.Lock()


def get_async_runner() -> AsyncBenchmarkRunner:
    """Get the global async runner instance (singleton)"""
    global _runner_instance

    if _runner_instance is None:
        with _instance_lock:
            if _runner_instance is None:
                _runner_instance = AsyncBenchmarkRunner()

    return _runner_instance
