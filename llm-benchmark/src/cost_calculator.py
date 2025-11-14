"""
Cost calculator for estimating LLM API costs.
"""
from typing import Dict, Optional


# Pricing per million tokens (as of 2025)
# Format: {provider/model: (input_cost, output_cost, reasoning_cost)}
MODEL_PRICING = {
    # OpenAI
    "openai/gpt-4-turbo": (10.00, 30.00, None),
    "openai/gpt-4": (30.00, 60.00, None),
    "openai/gpt-4-32k": (60.00, 120.00, None),
    "openai/gpt-3.5-turbo": (0.50, 1.50, None),
    "openai/o1": (15.00, 60.00, None),
    "openai/o1-mini": (3.00, 12.00, None),

    # Anthropic
    "anthropic/claude-3-opus": (15.00, 75.00, None),
    "anthropic/claude-3-5-sonnet": (3.00, 15.00, None),
    "anthropic/claude-3-sonnet": (3.00, 15.00, None),
    "anthropic/claude-3-haiku": (0.25, 1.25, None),

    # Google
    "gemini/gemini-2.0-flash-exp": (0.00, 0.00, None),  # Free tier
    "gemini/gemini-2.0-flash-thinking-exp": (0.00, 0.00, None),
    "gemini/gemini-exp-1206": (0.00, 0.00, None),
    "gemini/gemini-1.5-pro": (1.25, 5.00, None),
    "gemini/gemini-1.5-flash": (0.075, 0.30, None),

    # Meta/Llama (via various providers - using typical pricing)
    "meta/llama-3.1-405b": (5.00, 15.00, None),
    "meta/llama-3.1-70b": (0.90, 0.90, None),
    "meta/llama-3.1-8b": (0.20, 0.20, None),

    # Mistral
    "mistral/mistral-large": (3.00, 9.00, None),
    "mistral/mistral-medium": (2.70, 8.10, None),
    "mistral/mistral-small": (0.20, 0.60, None),

    # DeepSeek (via NIM or direct)
    "nvidia_nim/deepseek-ai/deepseek-v3": (0.27, 1.10, None),
    "nvidia_nim/deepseek-ai/deepseek-v3.1": (0.27, 1.10, None),
    "nvidia_nim/deepseek-ai/deepseek-r1": (0.55, 2.19, None),

    # Qwen (via NIM)
    "nvidia_nim/qwen/qwen3-235b-a22b": (2.00, 6.00, None),
    "nvidia_nim/qwen/qwen3-next-80b-a3b-thinking": (1.00, 3.00, None),
    "nvidia_nim/qwen/qwen3-next-80b-a3b-instruct": (1.00, 3.00, None),

    # Other providers - add as needed
}

# Default pricing for unknown models (conservative estimate)
DEFAULT_PRICING = (5.00, 15.00, None)  # Similar to high-tier models


class CostCalculator:
    """Calculate estimated costs for LLM API usage."""

    @staticmethod
    def get_model_pricing(model_name: str) -> tuple:
        """
        Get pricing for a specific model.

        Returns:
            tuple: (input_cost_per_million, output_cost_per_million, reasoning_cost_per_million)
        """
        # Try exact match first
        if model_name in MODEL_PRICING:
            return MODEL_PRICING[model_name]

        # Try partial match (for model variants)
        for key in MODEL_PRICING:
            if key in model_name or model_name in key:
                return MODEL_PRICING[key]

        # Return default if not found
        return DEFAULT_PRICING

    @staticmethod
    def calculate_cost(
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        reasoning_tokens: Optional[int] = None
    ) -> float:
        """
        Calculate the estimated cost for a model run.

        Args:
            model_name: Name of the model
            prompt_tokens: Number of input tokens
            completion_tokens: Number of output tokens
            reasoning_tokens: Number of reasoning/thinking tokens (if applicable)

        Returns:
            float: Estimated cost in USD
        """
        input_price, output_price, reasoning_price = CostCalculator.get_model_pricing(model_name)

        # Calculate costs (prices are per million tokens)
        input_cost = (prompt_tokens / 1_000_000) * input_price
        output_cost = (completion_tokens / 1_000_000) * output_price

        reasoning_cost = 0.0
        if reasoning_tokens and reasoning_price:
            reasoning_cost = (reasoning_tokens / 1_000_000) * reasoning_price
        elif reasoning_tokens and not reasoning_price:
            # If no separate reasoning price, treat as output tokens
            reasoning_cost = (reasoning_tokens / 1_000_000) * output_price

        total_cost = input_cost + output_cost + reasoning_cost
        return round(total_cost, 6)  # Round to 6 decimal places

    @staticmethod
    def format_cost(cost: float) -> str:
        """Format cost for display."""
        if cost == 0:
            return "$0.00"
        elif cost < 0.01:
            return f"${cost:.6f}"
        elif cost < 1.00:
            return f"${cost:.4f}"
        else:
            return f"${cost:.2f}"

    @staticmethod
    def calculate_cost_efficiency(quality_score: float, cost: float) -> float:
        """
        Calculate cost efficiency score (quality per dollar).

        Args:
            quality_score: Quality score (0-100)
            cost: Cost in USD

        Returns:
            float: Quality points per dollar (higher is better)
        """
        if cost == 0:
            return float('inf')  # Free is infinitely efficient
        return quality_score / cost
