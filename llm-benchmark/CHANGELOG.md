# Changelog

## Version 2.0 - Comprehensive Project-Based Questions

### Major Changes

**Complete Question Redesign** - All questions replaced with comprehensive, project-level challenges.

#### Old Questions (Archived to `questions_archive/`)
- 53 simple questions testing individual functions
- Focus on algorithms and small code snippets
- Limited ability to test real coding capabilities

#### New Questions (27 Total)
- **Complete applications** instead of functions
- **Runnable projects** with full features
- **Visual artifacts** displayable in viewer
- Tests **comprehensiveness** and **attention to detail**

### New Categories

1. **CLI Tools** (5) - Full command-line applications
   - To-do managers, file organizers, system monitors
   - Tests: arg parsing, file I/O, terminal UI

2. **Games - Python** (3) - Complete Pygame games
   - Snake, Space Shooter, Tetris
   - Tests: game loops, physics, collision detection

3. **Games - Web** (3) - Browser-based Canvas games
   - 2048, Platformer, Pong
   - Tests: Canvas API, game physics, AI

4. **Web Apps** (4) - Full-featured web applications
   - Drawing app, Quiz app, Expense tracker, Markdown editor
   - Tests: CRUD, localStorage, charts, real-time updates

5. **Visualizations** (4) - Graphics and data viz
   - SVG clock, Fractal tree, Particle system, Dashboard
   - Tests: SVG/Canvas, recursion, animation, charts

6. **Simulations** (4) - Physics and scientific sims
   - Solar system, Double pendulum, Boids, Fluid dynamics
   - Tests: physics, numerical methods, vector math

7. **Creative Coding** (4) - Advanced graphics
   - Mandelbrot set, Music visualizer, Ray tracer, Conway's Life
   - Tests: complex math, audio API, rendering algorithms

### Viewer Updates

**New Features:**
- ✅ **Artifact Display** - View HTML/Canvas apps directly in viewer
- ✅ **Interactive Apps** - Generated applications run in sandboxed iframes
- ✅ **Response Navigation** - Click through model → question → view app
- ✅ **Detailed Metrics** - TTFT, TPS, tokens, cost for each response

**How it works:**
1. Benchmark runs and generates HTML/Canvas applications
2. Viewer extracts HTML artifacts from responses
3. Apps displayed in iframes with full interactivity
4. See games, simulations, visualizations actually working!

### Config Updates

- Added category descriptions in `config.yaml`
- Clear categorization for focused testing
- Examples for each category type

### Technical Changes

- Questions now emphasize `should_be_complete_app: true`
- Token estimates increased (1000-3000 per question)
- Evaluation criteria focus on comprehensiveness
- Artifact extraction in viewer API
- Sandbox iframe rendering for security

### Migration Guide

**For existing users:**

1. Old questions preserved in `questions_archive/`
2. Update config.yaml with new categories
3. Run benchmark as before: `python run.py`
4. Use viewer to see artifacts: `python viewer/server.py`

**Key Differences:**

| Old | New |
|-----|-----|
| 53 simple function questions | 27 comprehensive project questions |
| Test algorithms | Test complete applications |
| Code snippets | Full, runnable programs |
| Text-only responses | Visual artifacts in viewer |
| Easy to pass | Challenging for comprehensiveness |

### Why This Change?

**Better Testing:**
- Real coding ability vs. just algorithm knowledge
- Tests attention to detail and completeness
- Evaluates practical application building
- More representative of real-world tasks

**Better Insights:**
- See what models can actually build
- Evaluate UX/UI decisions
- Test feature completeness
- Measure polish and refinement

**Better Experience:**
- Actually see and interact with generated apps
- More engaging benchmark results
- Visual proof of capabilities
- Shareable artifacts

---

**Result**: A benchmark that truly tests whether a model can build complete, working applications - not just write individual functions.
