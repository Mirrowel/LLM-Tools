"""
Question/prompt loader and manager for the benchmark system.
"""
import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from src.schemas import Question


class QuestionLoader:
    """Loads and manages benchmark questions."""

    def __init__(self, questions_dir: str = "questions"):
        self.questions_dir = Path(questions_dir)
        self.questions: Dict[str, Question] = {}

    def load_all_questions(self) -> List[Question]:
        """Load all questions from the questions directory."""
        questions = []
        category_count = 0

        if not self.questions_dir.exists():
            raise FileNotFoundError(f"Questions directory not found: {self.questions_dir}")

        for category_dir in self.questions_dir.iterdir():
            if category_dir.is_dir():
                category_count += 1
                category = category_dir.name
                for question_file in category_dir.glob("*.json"):
                    try:
                        with open(question_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)

                        # Support both single question and array of questions
                        if isinstance(data, list):
                            for item in data:
                                item['category'] = category
                                question = Question(**item)
                                questions.append(question)
                                self.questions[question.id] = question
                        else:
                            data['category'] = category
                            question = Question(**data)
                            questions.append(question)
                            self.questions[question.id] = question
                    except Exception as e:
                        print(f"Error loading question from {question_file}: {e}")

        print(f"Loaded {len(questions)} questions from {category_count} categories")
        return questions

    def load_category(self, category: str) -> List[Question]:
        """Load questions from a specific category."""
        questions = []
        category_dir = self.questions_dir / category

        if not category_dir.exists():
            raise FileNotFoundError(f"Category directory not found: {category_dir}")

        for question_file in category_dir.glob("*.json"):
            try:
                with open(question_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                if isinstance(data, list):
                    for item in data:
                        item['category'] = category
                        question = Question(**item)
                        questions.append(question)
                        self.questions[question.id] = question
                else:
                    data['category'] = category
                    question = Question(**data)
                    questions.append(question)
                    self.questions[question.id] = question
            except Exception as e:
                print(f"Error loading question from {question_file}: {e}")

        return questions

    def get_question(self, question_id: str) -> Optional[Question]:
        """Get a specific question by ID."""
        return self.questions.get(question_id)

    def get_categories(self) -> List[str]:
        """Get all available categories."""
        if not self.questions_dir.exists():
            return []
        return [d.name for d in self.questions_dir.iterdir() if d.is_dir()]

    def filter_questions(
        self,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        evaluation_type: Optional[str] = None
    ) -> List[Question]:
        """Filter questions based on criteria."""
        filtered = list(self.questions.values())

        if category:
            filtered = [q for q in filtered if q.category == category]

        if tags:
            filtered = [q for q in filtered if any(tag in q.tags for tag in tags)]

        if evaluation_type:
            filtered = [q for q in filtered if q.evaluation_type == evaluation_type]

        return filtered
