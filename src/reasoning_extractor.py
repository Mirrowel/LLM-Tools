"""
Reasoning extractor for parsing and separating reasoning content from responses.
Handles various reasoning tag formats used by different models.
"""
import re
from typing import Tuple, Optional


class ReasoningExtractor:
    """Extract and separate reasoning content from model responses."""

    # Common reasoning tag patterns
    REASONING_PATTERNS = [
        # DeepSeek/R1 style: <think>...</think>
        (r'<think>(.*?)</think>', 'think'),
        # Claude extended thinking: <thinking>...</thinking>
        (r'<thinking>(.*?)</thinking>', 'thinking'),
        # OpenAI o1 style: <reasoning>...</reasoning>
        (r'<reasoning>(.*?)</reasoning>', 'reasoning'),
        # Alternative format: [REASONING]...[/REASONING]
        (r'\[REASONING\](.*?)\[/REASONING\]', 'reasoning_block'),
        # Another format: <!-- reasoning -->...<!-- /reasoning -->
        (r'<!--\s*reasoning\s*-->(.*?)<!--\s*/reasoning\s*-->', 'html_reasoning'),
    ]

    @classmethod
    def extract_reasoning(cls, text: str) -> Tuple[str, Optional[str], Optional[str]]:
        """
        Extract reasoning from response text.

        Args:
            text: Raw response text that may contain reasoning tags

        Returns:
            Tuple of:
            - cleaned_text: Response with reasoning tags removed
            - reasoning_content: Extracted reasoning content
            - reasoning_format: Type of reasoning format detected
        """
        if not text:
            return text, None, None

        reasoning_content = None
        reasoning_format = None
        cleaned_text = text

        # Try each pattern
        for pattern, format_name in cls.REASONING_PATTERNS:
            matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)

            if matches:
                # Found reasoning content
                reasoning_content = '\n\n'.join(match.strip() for match in matches)
                reasoning_format = format_name

                # Remove reasoning tags from text
                cleaned_text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)

                # Clean up extra whitespace
                cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text).strip()

                break

        return cleaned_text, reasoning_content, reasoning_format

    @classmethod
    def combine_reasoning(cls, text: str, reasoning: Optional[str], format_type: str = 'think') -> str:
        """
        Combine cleaned text with reasoning (for display purposes).

        Args:
            text: Cleaned response text
            reasoning: Reasoning content
            format_type: Format to use for tags

        Returns:
            Combined text with reasoning in tags
        """
        if not reasoning:
            return text

        if format_type == 'think':
            return f"<think>\n{reasoning}\n</think>\n\n{text}"
        elif format_type == 'thinking':
            return f"<thinking>\n{reasoning}\n</thinking>\n\n{text}"
        elif format_type == 'reasoning':
            return f"<reasoning>\n{reasoning}\n</reasoning>\n\n{text}"
        else:
            return f"{text}\n\n--- Reasoning ---\n{reasoning}"

    @classmethod
    def has_reasoning(cls, text: str) -> bool:
        """Check if text contains reasoning tags."""
        if not text:
            return False

        for pattern, _ in cls.REASONING_PATTERNS:
            if re.search(pattern, text, re.DOTALL | re.IGNORECASE):
                return True

        return False

    @classmethod
    def format_reasoning_for_display(cls, reasoning: str, format_type: Optional[str] = None) -> str:
        """
        Format reasoning content for display in viewer.

        Args:
            reasoning: Raw reasoning content
            format_type: Original format type (optional)

        Returns:
            HTML-formatted reasoning for display
        """
        if not reasoning:
            return ""

        # Add line breaks and basic formatting
        formatted = reasoning.strip()

        # Escape HTML but preserve structure
        formatted = formatted.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

        # Preserve line breaks
        formatted = formatted.replace('\n', '<br>')

        return formatted
