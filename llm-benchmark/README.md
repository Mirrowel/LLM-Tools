# 🔴 MirroBench

A comprehensive, self-contained benchmarking system for evaluating and comparing Large Language Models across multiple dimensions: **quality, speed, cost, and capabilities**.

## ✨ Features

- **Multiple Evaluation Methods**
  - 🤖 LLM-as-judge (use powerful models to evaluate responses)
  - 🔧 Automated tool/function calling validation
  - 💻 Code execution and validation (Python, JavaScript, HTML)
  - ✅ Exact match and contains checks

- **Comprehensive Metrics**
  - ⚡ **Speed**: TTFT, TPS, latency
  - 📊 **Usage**: Token counts (prompt, completion, reasoning)
  - 💰 **Cost**: Estimated costs with 30+ models
  - 🎯 **Quality**: Scores (0-100) and pass/fail

- **Rich Web UI**
  - 📈 Interactive leaderboard with sortable columns
  - 🔍 Individual response viewer
  - 🎨 Artifact display (view HTML/JS/Python output)
  - 📂 Category-based score breakdown

- **Easy Configuration**
  - 📝 Simple YAML config file
  - 🔄 No command-line arguments needed
  - 📦 Comprehensive question bank (27 project-level questions)
  - 🔄 Multiple runs support for consistency testing

## 📦 What's Included

**27 Comprehensive Project-Level Questions** across 7 categories:

- **CLI Tools (5 questions)**
  - Complete command-line applications with file I/O, persistence, and rich UI
  - Examples: To-do manager, file organizer, system monitor, Markdown converter

- **Games - Python (3 questions)**
  - Full games built with Pygame
  - Examples: Snake, Space Shooter, Tetris

- **Games - Web (3 questions)**
  - Browser-based games using HTML5 Canvas
  - Examples: 2048, Platformer, Pong with AI

- **Web Applications (4 questions)**
  - Full-featured interactive web apps with CRUD, charts, and localStorage
  - Examples: Drawing app, Quiz app, Expense tracker, Markdown editor

- **Visualizations (4 questions)**
  - Graphics and data visualization using SVG/Canvas
  - Examples: Animated clock, Fractal tree, Particle system, Data dashboard

- **Simulations (4 questions)**
  - Physics and scientific simulations
  - Examples: Solar system (8 planets), Double pendulum, Flocking (boids), Fluid dynamics

- **Creative Coding (4 questions)**
  - Advanced graphics and generative art
  - Examples: Mandelbrot explorer, Music visualizer, Ray tracer, Conway's Game of Life

> **Note**: Old questions (53 simple function-based tests) are archived in `questions_archive/`
>
> See **[QUESTIONS_GUIDE.md](QUESTIONS_GUIDE.md)** for detailed descriptions and **[CHANGELOG.md](CHANGELOG.md)** for v2.0 changes.

## 🚀 Quick Start

### 1. Installation

```bash
# Navigate to the llm-benchmark directory
cd llm-benchmark

# Install dependencies
pip install -r requirements.txt

# Install the LLM client library (from local lib/)
pip install -e lib/rotator_library
```

### 2. Configuration

Edit `config.yaml`:

```yaml
# Models to test
models:
  - "anthropic/claude-3-5-sonnet-20241022"
  - "openai/gpt-4"
  - "openai/gpt-4-turbo"

# Judge model for evaluation
judge_model: "anthropic/claude-3-5-sonnet-20241022"

# Categories to test (empty = all)
categories: []

# Max concurrent requests
max_concurrent: 3
```

### 3. Set API Keys

Create a `.env` file:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### 4. Run Benchmark

```bash
python run.py
```

That's it! The benchmark will:
- Load questions from the config
- Create a separate run for each model
- Test each model
- Evaluate responses
- Calculate scores
- Save results to individual run directories

### 5. View Results

```bash
python viewer/server.py
```

Open http://localhost:8000 in your browser.

## 📁 Project Structure

```
llm-benchmark/
├── config.yaml              # Configuration file (EDIT THIS!)
├── run.py                   # Main entry point
├── requirements.txt         # Dependencies
├── src/                     # Source code
│   ├── schemas.py          # Data models
│   ├── config_loader.py    # Config loading
│   ├── question_loader.py  # Question management
│   ├── results_manager.py  # Results storage
│   ├── cost_calculator.py  # Cost estimation
│   ├── runner.py           # Benchmark orchestration
│   └── evaluators/         # Evaluation modules
│       ├── llm_judge.py
│       ├── tool_validator.py
│       └── code_executor.py
├── questions/                  # Question bank (27 questions)
│   ├── cli_tools/             # 5 CLI applications
│   ├── games/                 # 6 games (Python + Web)
│   ├── web_apps/              # 4 interactive web apps
│   ├── visualizations/        # 4 graphics/data viz
│   ├── simulations/           # 4 physics simulations
│   └── creative_coding/       # 4 advanced graphics
├── questions_archive/         # Old questions (53 simple tests)
├── results/               # Benchmark results
│   └── run_TIMESTAMP/
│       ├── metadata.json
│       ├── responses/
│       ├── evaluations/
│       └── scores.json
└── viewer/                # Web UI
    ├── server.py          # FastAPI backend
    └── templates/         # HTML frontend
```

## ⚙️ Configuration Options

### config.yaml

```yaml
# Models to benchmark
models:
  - "anthropic/claude-3-5-sonnet-20241022"
  - "openai/gpt-4"
  # Add more models...

# Judge model for LLM-as-judge evaluation
judge_model: "anthropic/claude-3-5-sonnet-20241022"

# Filter by categories (empty = all)
categories:
  - cli_tools
  - games
  - web_apps
# Or leave empty: categories: []

# Filter by specific questions (empty = all)
question_ids:
  - game_snake_pygame
  - sim_solar_system
# Or leave empty: question_ids: []

# Concurrency settings
max_concurrent: 3

# Directories
questions_dir: "questions"
results_dir: "results"

# Evaluation settings
evaluation:
  pass_threshold: 70  # Score needed to pass
  code_timeout: 10    # Seconds for code execution

# Viewer settings
viewer:
  host: "0.0.0.0"
  port: 8000
```

## 📊 Metrics Tracked

### Per Response
- ✅ Quality score (0-100)
- ⏱️ Time to first token (TTFT)
- 🚀 Tokens per second (TPS)
- ⏳ Total latency
- 🔢 Token counts (prompt, completion, reasoning, total)
- 💵 Estimated cost (USD)
- ✓ Pass/fail status

### Leaderboard
- 🏆 Overall score (average across all questions)
- 📊 Category scores
- ✅ Pass rate
- 💰 Total cost
- 💡 Cost efficiency (quality per dollar)
- ⚡ Average speed metrics

## 🎯 Use Cases

### Model Selection
Test multiple models to find the best for your use case:
```yaml
models:
  - "openai/gpt-4"
  - "anthropic/claude-3-5-sonnet-20241022"
  - "gemini/gemini-2.0-flash-exp"
categories: ["games", "web_apps"]
```

### Cost Optimization
Find the most cost-effective model:
```yaml
models:
  - "openai/gpt-4"
  - "openai/gpt-3.5-turbo"
  - "anthropic/claude-3-haiku"
```

### Regression Testing
Test if a new version performs better:
```yaml
models:
  - "openai/gpt-4-turbo"
question_ids:
  - game_2048_html
  - sim_solar_system
```

## 📝 Adding Custom Questions

Questions are JSON files in `questions/<category>/`.

### Question Format

```json
{
  "id": "unique_id",
  "subcategory": "algorithms",
  "prompt": "Your question here",
  "system_prompt": "Optional system instructions",
  "expected_output": "Optional expected answer",
  "evaluation_type": "llm_judge",
  "evaluation_criteria": "How to evaluate",
  "tags": ["tag1", "tag2"],
  "metadata": {
    "difficulty": "easy",
    "estimated_tokens": 200
  }
}
```

### Evaluation Types

1. **llm_judge** - Use an LLM to evaluate
2. **code_execution** - Run and validate code
3. **tool_calling** - Validate function calls
4. **exact_match** - Exact string match
5. **contains** - Check if text contains expected

See `questions/` for examples.

## 🌐 Web Viewer

The web viewer provides an interactive interface to explore results:

1. **Leaderboard**
   - Sort by score, cost, or speed
   - Filter by category
   - Visual score bars
   - Cost efficiency metrics

2. **Response Viewer**
   - View question and response side-by-side
   - See evaluation scores and reasoning
   - **Display artifacts** - HTML/Canvas apps run in sandboxed iframes
   - See generated games, simulations, and visualizations actually working!

3. **Comparison View** (coming soon)
   - Compare multiple models side-by-side
   - Highlight differences
   - Cost vs. quality analysis

## 🐛 Troubleshooting

### "No questions found"
- Check that `questions/` directory exists
- Verify JSON files are valid
- Ensure `questions_dir` in config.yaml is correct

### "No API keys found"
- Create `.env` file with your API keys
- Format: `PROVIDER_API_KEY=your_key`
- Supported: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

### Code execution fails
- **Python**: Ensure Python is in PATH
- **JavaScript**: Install Node.js
- **HTML**: No requirements (validation only)

### "Configuration file not found"
- Ensure `config.yaml` exists in the `llm-benchmark/` directory
- Copy and edit the example provided

## 🔧 Advanced Usage

### Custom Judge Model
```yaml
judge_model: "openai/gpt-4"  # Use GPT-4 instead of Claude
```

### Test Specific Categories
```yaml
categories:
  - games
  - simulations
```

### Control Concurrency
```yaml
max_concurrent: 5  # Run 5 requests at once
```

## 📈 Results Structure

Each model gets its own run directory with timestamp:

```
results/
├── openai_gpt-4_20250113_143022/       # Run for GPT-4
│   ├── metadata.json                    # Run configuration
│   ├── responses/
│   │   └── openai_gpt-4/                # Model responses
│   │       ├── game_snake_pygame.json
│   │       ├── sim_solar_system.json
│   │       └── ...
│   ├── evaluations/
│   │   └── openai_gpt-4/                # Evaluations
│   │       └── ...
│   └── scores.json                      # Leaderboard
│
└── anthropic_claude-3-5-sonnet_20250113_143045/  # Run for Claude
    ├── metadata.json
    ├── responses/
    └── ...
```

**Key Points:**
- Each model run is independent with its own directory
- Run IDs include model name and timestamp
- Global leaderboard shows latest run for each model (unless pinned)
- Multiple runs for the same model can be compared in the viewer

## 🤝 Contributing

To add new questions:
1. Create a JSON file in `questions/<category>/`
2. Follow the question schema
3. Run the benchmark - questions are auto-discovered

To add new evaluation methods:
1. Create an evaluator in `src/evaluators/`
2. Add the evaluation type to `schemas.py`
3. Update `runner.py` to use it

## 📄 License

See main project LICENSE file.

## 🙏 Acknowledgments

This benchmark system uses:
- [LiteLLM](https://github.com/BerriAI/litellm) for unified LLM API
- [FastAPI](https://fastapi.tiangolo.com/) for the web viewer
- [Rich](https://rich.readthedocs.io/) for beautiful terminal output
- [Pydantic](https://docs.pydantic.dev/) for data validation

---

**Happy Benchmarking! 🚀**

For questions or issues, please refer to the main project repository.
