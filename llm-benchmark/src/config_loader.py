"""
Configuration loader for the benchmark system.
"""
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional


class ConfigLoader:
    """Load and validate configuration from config.yaml."""

    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)
        self.config: Dict[str, Any] = {}
        self.load()

    def load(self):
        """Load configuration from YAML file."""
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"Configuration file not found: {self.config_path}\n"
                f"Please create a config.yaml file. See config.example.yaml for reference."
            )

        with open(self.config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f) or {}

        # Validate required fields
        self._validate()

    def _validate(self):
        """Validate configuration."""
        if not self.config.get('models'):
            raise ValueError("Configuration must include at least one model in 'models' list")

        if not self.config.get('judge_model'):
            raise ValueError("Configuration must include a 'judge_model'")

    @property
    def models(self) -> List[str]:
        """Get list of models to benchmark."""
        return self.config.get('models', [])

    @property
    def judge_model(self) -> str:
        """Get judge model."""
        return self.config.get('judge_model', 'anthropic/claude-3-5-sonnet-20241022')

    @property
    def categories(self) -> Optional[List[str]]:
        """Get categories to test (None means all)."""
        cats = self.config.get('categories', [])
        return cats if cats else None

    @property
    def question_ids(self) -> Optional[List[str]]:
        """Get specific question IDs to test (None means all)."""
        ids = self.config.get('question_ids', [])
        return ids if ids else None

    @property
    def max_concurrent(self) -> int:
        """Get max concurrent requests."""
        return self.config.get('max_concurrent', 3)

    @property
    def questions_dir(self) -> str:
        """Get questions directory."""
        return self.config.get('questions_dir', 'questions')

    @property
    def results_dir(self) -> str:
        """Get results directory."""
        return self.config.get('results_dir', 'results')

    @property
    def pass_threshold(self) -> float:
        """Get passing score threshold."""
        return self.config.get('evaluation', {}).get('pass_threshold', 70.0)

    @property
    def code_timeout(self) -> int:
        """Get code execution timeout."""
        return self.config.get('evaluation', {}).get('code_timeout', 10)

    @property
    def viewer_host(self) -> str:
        """Get viewer host."""
        return self.config.get('viewer', {}).get('host', '0.0.0.0')

    @property
    def viewer_port(self) -> int:
        """Get viewer port."""
        return self.config.get('viewer', {}).get('port', 8000)

    @property
    def fixer_model(self) -> str:
        """Get fixer model for reformatting responses."""
        return self.config.get('fixer_model', 'anthropic/claude-3-5-sonnet-20241022')

    @property
    def model_system_instructions(self) -> Dict[str, str]:
        """Get per-model system instructions."""
        return self.config.get('model_system_instructions', {})

    def get_model_system_instruction(self, model_name: str) -> Optional[str]:
        """Get system instruction for a specific model."""
        return self.model_system_instructions.get(model_name)

    @property
    def code_formatting_enabled(self) -> bool:
        """Check if code formatting instructions are enabled."""
        return self.config.get('code_formatting_instructions', {}).get('enabled', True)

    @property
    def code_formatting_instruction(self) -> str:
        """Get code formatting instruction text."""
        default_instruction = (
            "When providing code, use markdown code blocks with language tags. "
            "For multi-file apps, you may use ```language:filename format."
        )
        return self.config.get('code_formatting_instructions', {}).get('instruction', default_instruction)

    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value."""
        return self.config.get(key, default)
