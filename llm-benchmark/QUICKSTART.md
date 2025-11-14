# ⚡ Quick Start Guide

Get the LLM Benchmark up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd llm-benchmark

# Install Python dependencies
pip install -r requirements.txt

# Install the LLM client library from local directory
pip install -e lib/rotator_library
```

## Step 2: Setup API Keys

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API keys
# nano .env  # or use any text editor
```

Example `.env`:
```
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Step 3: Configure Benchmark

Edit `config.yaml`:

```yaml
models:
  - "openai/gpt-4"
  - "anthropic/claude-3-5-sonnet-20241022"

judge_model: "anthropic/claude-3-5-sonnet-20241022"

categories: []  # Empty = test all categories
max_concurrent: 3
```

## Step 4: Run First Benchmark

```bash
# Run the benchmark
python run.py
```

This will:
- ✅ Load 27 comprehensive project questions
- ✅ Test each model
- ✅ Evaluate responses
- ✅ Calculate scores
- ✅ Save results

## Step 5: View Results

```bash
# Start the web viewer
python viewer/server.py
```

Open http://localhost:8000 in your browser to see:
- 📊 Interactive leaderboard
- 📈 Scores by category
- 💰 Cost analysis
- ⚡ Speed metrics

## Quick Tips

### Test Just One Category

```yaml
categories:
  - games  # Only test game questions
```

### Test Specific Questions

```yaml
question_ids:
  - game_snake_pygame
  - sim_solar_system
```

### Reduce Costs

```yaml
models:
  - "openai/gpt-3.5-turbo"  # Cheaper than GPT-4

judge_model: "openai/gpt-3.5-turbo"  # Use cheaper judge
```

### Faster Testing

```yaml
max_concurrent: 5  # Run more requests in parallel
```

## What's Being Tested?

### 27 Comprehensive Project-Level Questions

**CLI Tools (5)**
- Complete command-line applications with file I/O and persistence
- Examples: To-do manager, file organizer, system monitor

**Games - Python (3)**
- Full Pygame games with complete mechanics
- Examples: Snake, Space Shooter, Tetris

**Games - Web (3)**
- HTML5 Canvas games with physics and AI
- Examples: 2048, Platformer, Pong

**Web Applications (4)**
- Interactive apps with CRUD, charts, localStorage
- Examples: Drawing app, Quiz app, Expense tracker

**Visualizations (4)**
- Graphics and data visualization using SVG/Canvas
- Examples: Animated clock, Fractal tree, Particle system

**Simulations (4)**
- Physics and scientific simulations
- Examples: Solar system, Double pendulum, Boids, Fluids

**Creative Coding (4)**
- Advanced graphics and generative art
- Examples: Mandelbrot, Music visualizer, Ray tracer, Game of Life

> **Note**: Old questions (53 simple tests) are in `questions_archive/`

## Troubleshooting

### "No questions found"
- Make sure you're in the `llm-benchmark/` directory
- Check that `questions/` folder exists with JSON files

### "No API keys found"
- Create `.env` file with your keys
- Make sure keys are in format: `PROVIDER_API_KEY=value`

### Import errors
- Install the lib: `pip install -e lib/rotator_library`
- Make sure you're using Python 3.8+

## Next Steps

1. ✅ Run your first benchmark
2. 📊 View results in the web UI
3. 🎯 Add your own custom questions
4. 🔄 Compare different models
5. 💰 Optimize for cost vs. quality

## Need Help?

- Check `README.md` for full documentation
- Look at example questions in `questions/`
- Review `config.yaml` for all options

---

**You're ready to go! 🚀**
