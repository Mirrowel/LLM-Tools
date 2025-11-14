# 📋 Comprehensive Questions Guide

This benchmark focuses on **project-level coding challenges** that test the ability to create complete, working applications.

## 🎯 Philosophy

Instead of testing simple function implementations, these questions evaluate:
- **Comprehensiveness**: Can the model create a complete, working application?
- **Attention to detail**: Does it implement all requested features?
- **Code quality**: Is the code well-structured and functional?
- **Creativity**: Does it add polish beyond the minimum requirements?

## 📊 Question Categories (27 Total)

### 1. CLI Tools (5 questions)
**Complete command-line applications**

- `cli_todo_manager_python` - Full-featured to-do list manager with persistence
- `cli_file_organizer_python` - File organizer with dry-run and undo
- `cli_weather_dashboard_rust` - Rust CLI with mock API and colored output
- `cli_markdown_to_html_node` - Markdown parser and HTML generator
- `cli_system_monitor_python` - Real-time system monitor with rich UI

**What's tested**: Argument parsing, file I/O, persistence, colored terminal output, error handling

### 2. Games - Python (3 questions)
**Complete games using Pygame**

- `game_snake_pygame` - Classic Snake game with all mechanics
- `game_space_shooter_pygame` - Space shooter with enemies, lives, scoring
- `game_tetris_python` - Full Tetris implementation with all 7 pieces

**What's tested**: Game loop, collision detection, sprite management, scoring systems, physics

### 3. Games - Web (3 questions)
**Browser-based games using Canvas**

- `game_2048_html` - Complete 2048 game with animations and localStorage
- `game_platformer_canvas` - Platformer with physics, enemies, collectibles
- `game_pong_html` - Pong with 2-player and AI modes

**What's tested**: Canvas rendering, game physics, input handling, AI logic, smooth animations

### 4. Web Applications (4 questions)
**Full-featured web apps**

- `webapp_drawing_app` - Drawing/painting app with brushes, colors, undo, save
- `webapp_quiz_app` - Quiz application with scoring and results review
- `webapp_expense_tracker` - Expense tracker with charts, filters, CSV export
- `webapp_markdown_editor` - Live Markdown editor with syntax highlighting

**What's tested**: CRUD operations, localStorage, charts/visualization, real-time updates, complex UI

### 5. Visualizations (4 questions)
**Graphics and data visualization**

- `viz_svg_clock` - Animated analog clock using SVG
- `viz_fractal_tree` - Interactive fractal generator with recursion
- `viz_particle_system` - Particle system with physics and effects
- `viz_data_dashboard` - Multi-chart dashboard from scratch

**What's tested**: SVG manipulation, Canvas drawing, recursion, data visualization, animation

### 6. Simulations (4 questions)
**Physics and scientific simulations**

- `sim_solar_system` - Accurate solar system with all planets and controls
- `sim_double_pendulum` - Chaotic pendulum with proper physics
- `sim_boids_flocking` - Flocking behavior (birds/fish simulation)
- `sim_fluid_dynamics` - 2D fluid simulation with mouse interaction

**What's tested**: Physics calculations, numerical methods, vector math, spatial algorithms, optimization

### 7. Creative Coding (4 questions)
**Advanced graphics and generative art**

- `creative_mandelbrot_set` - Interactive Mandelbrot explorer with zoom
- `creative_music_visualizer` - Audio-reactive visualization with Web Audio API
- `creative_ray_tracer` - Simple ray tracer with spheres and lighting
- `creative_conway_life` - Game of Life with patterns and statistics

**What's tested**: Mathematical algorithms, complex number math, audio processing, ray tracing, cellular automata

## 🎨 What Makes These Questions Different?

### OLD Approach (Archived)
```json
{
  "prompt": "Write a function that checks if a number is prime",
  "expected_output": "A single function"
}
```

### NEW Approach
```json
{
  "prompt": "Create a complete space shooter game using Pygame with:\n- Player spaceship with movement\n- Shooting mechanics\n- Enemy spawning\n- Collision detection\n- Lives and scoring\n- Game over screen\n\nProvide complete, runnable code.",
  "should_be_complete_app": true
}
```

## 📈 Evaluation Criteria

Questions are evaluated on:

1. **Completeness** (40 points)
   - Does it implement ALL requested features?
   - Is it a working, runnable application?

2. **Correctness** (30 points)
   - Does the logic work properly?
   - Are there bugs or errors?

3. **Code Quality** (20 points)
   - Is the code well-structured?
   - Good variable names and organization?

4. **Polish** (10 points)
   - Extra touches beyond requirements
   - Good UX/UI design
   - Error handling

## 🔍 Viewing Results

All web-based applications (HTML/Canvas/SVG) can be **viewed directly in the viewer**:

1. Run benchmark: `python run.py`
2. Start viewer: `python viewer/server.py`
3. Click on a model → Click on a question
4. **See the generated app running in an iframe!**

For CLI tools and Python games, the code is displayed with syntax highlighting.

## 📝 Question Format

Each question includes:

```json
{
  "id": "unique_identifier",
  "subcategory": "type_of_challenge",
  "prompt": "Detailed requirements with:\n- Bullet points for features\n- Visual specifications\n- Technical requirements\n- Expected controls/interactions",
  "system_prompt": "Context about expertise level",
  "evaluation_type": "code_execution or llm_judge",
  "evaluation_criteria": "What makes a good solution",
  "tags": ["relevant", "tags"],
  "metadata": {
    "difficulty": "easy|medium|hard|very_hard",
    "estimated_tokens": 1000-3000,
    "should_be_complete_app": true
  }
}
```

## 💡 Tips for Models

To score well on these questions:

1. **Read the entire prompt** - All features must be implemented
2. **Provide complete code** - Not just snippets
3. **Include all imports** - Make it runnable as-is
4. **Handle edge cases** - Error handling matters
5. **Add polish** - Better UX = better scores
6. **Test mentally** - Think through if it would actually work

## 🎯 Example Comprehensiveness

**Solar System Simulation** should include:
- ✅ All 8 planets with accurate data
- ✅ Orbital mechanics (even if simplified)
- ✅ Interactive controls (play/pause, speed, info panels)
- ✅ Visual polish (colors, stars, glow effects)
- ✅ Zoom and pan functionality
- ✅ Information display for each planet
- ✅ Smooth 60 FPS animation

**Not acceptable**:
- ❌ Just 3-4 planets
- ❌ No controls
- ❌ Static image
- ❌ Missing planet data

## 🚀 Getting Started

To test with these questions:

```bash
# Run all comprehensive questions
python run.py

# Run just games
# Edit config.yaml: categories: [games]
python run.py

# View results with artifacts
python viewer/server.py
# Go to http://localhost:8000
# Click model → Click question → See the app running!
```

## 📚 Question Files

Questions are organized by category:
- `questions/cli_tools/productivity_tools.json` (5)
- `questions/games/python_games.json` (3)
- `questions/games/web_games.json` (3)
- `questions/web_apps/interactive_apps.json` (4)
- `questions/visualizations/graphics_and_art.json` (4)
- `questions/simulations/physics_and_nature.json` (4)
- `questions/creative_coding/generative_and_interactive.json` (4)

**Total: 27 comprehensive, project-level questions**

---

**These questions test real coding ability**, not just algorithm knowledge. A model that scores well can build complete, working applications.
