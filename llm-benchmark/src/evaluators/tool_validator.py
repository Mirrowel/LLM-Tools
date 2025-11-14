"""
Tool call validator for evaluating function calling accuracy.
"""
import json
from datetime import datetime
from typing import List, Dict, Any
from src.schemas import Question, ModelResponse, Evaluation


class ToolCallValidator:
    """Validate tool/function calling responses."""

    async def evaluate(self, question: Question, response: ModelResponse) -> Evaluation:
        """
        Evaluate a model's tool calling response.

        Args:
            question: The original question with expected tool calls
            response: The model's response to evaluate

        Returns:
            Evaluation: The evaluation result
        """
        if response.error:
            return Evaluation(
                question_id=question.id,
                model_name=response.model_name,                score=0.0,
                passed=False,
                evaluation_type="tool_calling",
                reasoning=f"Response failed with error: {response.error}",
                details={"error": response.error},
                timestamp=datetime.now().isoformat()
            )

        # Extract expected tool calls from question metadata
        expected_calls = question.metadata.get("expected_tool_calls", [])

        if not expected_calls:
            # No specific expectations, just check if tools were called
            if response.tool_calls:
                return Evaluation(
                    question_id=question.id,
                    model_name=response.model_name,                    score=100.0,
                    passed=True,
                    evaluation_type="tool_calling",
                    reasoning="Model made tool calls as expected (no specific validation criteria)",
                    details={"tool_calls": response.tool_calls},
                    timestamp=datetime.now().isoformat()
                )
            else:
                return Evaluation(
                    question_id=question.id,
                    model_name=response.model_name,                    score=0.0,
                    passed=False,
                    evaluation_type="tool_calling",
                    reasoning="Model did not make any tool calls",
                    details={},
                    timestamp=datetime.now().isoformat()
                )

        # Validate against expected calls
        score, passed, reasoning, details = self._validate_tool_calls(
            response.tool_calls or [],
            expected_calls
        )

        return Evaluation(
            question_id=question.id,
            model_name=response.model_name,            score=score,
            passed=passed,
            evaluation_type="tool_calling",
            reasoning=reasoning,
            details=details,
            timestamp=datetime.now().isoformat()
        )

    def _validate_tool_calls(
        self,
        actual_calls: List[Dict[str, Any]],
        expected_calls: List[Dict[str, Any]]
    ) -> tuple:
        """
        Validate actual tool calls against expected calls.

        Returns:
            tuple: (score, passed, reasoning, details)
        """
        if not actual_calls:
            return (
                0.0,
                False,
                "No tool calls were made",
                {"expected": expected_calls, "actual": []}
            )

        # Check each expected call
        matches = []
        missing = []

        for expected in expected_calls:
            expected_name = expected.get("name")
            expected_args = expected.get("arguments", {})

            # Find matching actual call
            found_match = False
            for actual in actual_calls:
                # Extract function name (handle different API formats)
                actual_name = actual.get("function", {}).get("name") or actual.get("name")

                # Extract arguments
                actual_args_raw = actual.get("function", {}).get("arguments") or actual.get("arguments")

                # Parse arguments if they're a string
                if isinstance(actual_args_raw, str):
                    try:
                        actual_args = json.loads(actual_args_raw)
                    except json.JSONDecodeError:
                        actual_args = {}
                else:
                    actual_args = actual_args_raw or {}

                # Check if names match
                if actual_name == expected_name:
                    # Check if arguments match (flexible matching)
                    args_match = self._arguments_match(expected_args, actual_args)

                    if args_match:
                        found_match = True
                        matches.append({
                            "expected": expected,
                            "actual": {"name": actual_name, "arguments": actual_args}
                        })
                        break

            if not found_match:
                missing.append(expected)

        # Calculate score
        total_expected = len(expected_calls)
        total_matched = len(matches)

        score = (total_matched / total_expected) * 100 if total_expected > 0 else 0.0
        passed = score >= 70.0  # Pass if 70% or more of expected calls are made correctly

        # Build reasoning
        if total_matched == total_expected:
            reasoning = f"All {total_expected} expected tool calls were made correctly"
        elif total_matched > 0:
            reasoning = f"{total_matched}/{total_expected} expected tool calls were made correctly. "
            if missing:
                missing_names = [m.get("name") for m in missing]
                reasoning += f"Missing: {', '.join(missing_names)}"
        else:
            reasoning = "None of the expected tool calls were made"

        details = {
            "expected": expected_calls,
            "actual": actual_calls,
            "matches": matches,
            "missing": missing
        }

        return score, passed, reasoning, details

    def _arguments_match(self, expected: Dict[str, Any], actual: Dict[str, Any]) -> bool:
        """
        Check if actual arguments match expected arguments (flexible matching).

        Returns:
            bool: True if arguments match sufficiently
        """
        # Check if all expected keys are present in actual
        for key, expected_value in expected.items():
            if key not in actual:
                return False

            actual_value = actual[key]

            # Flexible value matching (case-insensitive for strings, type conversion, etc.)
            if isinstance(expected_value, str) and isinstance(actual_value, str):
                if expected_value.lower() != actual_value.lower():
                    return False
            elif expected_value != actual_value:
                # For non-strings, require exact match
                return False

        return True
