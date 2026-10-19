# NEXUS — Development Plan

Work proceeds in phases. Each phase ends with: run the dev server, open the game in Playwright
Chromium, check the console, test the feature, fix, then continue.

## Skill routing used

| Area | Skills consulted |
| --- | --- |
| Architecture, loop, state, pooling, budgets | `game-development`, `threejs-game-director` |
| Movement, camera, collision, feel | `game-development/3d-games`, `threejs-gameplay-systems` (+ `game-feel.md`, `physics-engine-selection.md`) |
| Stage design, curve | `game-development/game-design`, `threejs-gameplay-systems/genre-design.md` |
| Visual direction, materials, lighting, post | `game-development/game-art`, `3d-games`, `threejs-aaa-graphics-builder` (all four references) |
| HUD, menus | `game-design`, `threejs-game-ui-designer/ui-patterns.md` |
| Audio | `game-development/game-audio`, `threejs-audio-generator/audio-workflows.md` (procedural fallback, no key) |
| Performance, debugging | `threejs-debug-profiler/debug-playbook.md` |
| QA, release | `threejs-qa-release` (+ `release-checks.md`, `evidence-manifest.md`) |

External generators (`threejs-3d-generator`, `threejs-image-generator`, `threejs-audio-generator`
API paths) are unavailable (keys MISSING), so every asset is procedural by design.

## Phases

| # | Phase | Deliverable | Verification |
| --- | --- | --- | --- |
| 1 | Project setup | Vite + TS scaffold, folder tree, constants, docs, CLAUDE.md | `npm run build` passes |
| 2 | Rendering | SceneManager, renderer, post pipeline, environment sky/fog/lights, resize + DPR cap | Canvas non-blank, resize test |
| 3 | Loop / state | GameLoop with fixed step, GameState FSM, EventBus, UIManager skeleton | State transitions logged, no errors |
| 4 | Player | PlayerModel, PlayerController, PlayerPhysics, PlayerAnimation, Constants | Walk, jump, double jump, land on test platforms, fall respawn |
| 5 | Camera | Third-person orbit, pointer lock, smoothing, collision, kick/shake | Camera never clips through test walls |
| 6 | Environment | Platform factory + materials, decor kit, background megastructures, ambient particles | Test stage renders within budget |
| 7 | Energy | Orbs, collection VFX/SFX hook, HUD count, activators | Collect orbs, counter updates |
| 8 | Checkpoints | Checkpoint volumes, activation, respawn, death fade | Fall → respawn at checkpoint |
| 9 | Stage 1 | Awakening data + portal + stage complete + end-of-stage cinematic | Playable start to finish |
| 10 | Stage 2 | Moving/rotating/vertical platforms, riding | Playable |
| 11 | Stage 3 | Gravity zones, teleporters, distortion theme | Playable |
| 12 | Stage 4 | Crumble/falling/blink platforms, hazards, instability VFX | Playable |
| 13 | Stage 5 | Synthesis + Core sequence + game complete | Playable; ending plays |
| 14 | UI | Loading, menu, pause, settings, stage complete, game complete, HUD polish | Every screen reachable |
| 15 | Audio | AudioManager, Synth SFX, generative music, settings volumes | Every event audible |
| 16 | Particles + polish | Bursts, teleport, checkpoint, gravity transition, Core ignition, platform animation | Visual pass |
| 17 | Save | localStorage: unlocked stages, completed, settings, best times | Reload persists |
| 18 | Performance | Inspector metrics, instancing, DPR, shadows, bloom cost | ≤ 300 calls, 60 FPS target |
| 19 | QA | Playwright suite, canvas inspector manifest, full playthrough | All green |
| 20 | Final polish | Docs updated, evidence report, release build | `npm run build && npm run preview` |

## Status (2026-10-15)

All 20 phases implemented and verified in one session. Verification results are in
`artifacts/final-evidence.md`. Open polish items: generated hero assets are not available (keys
missing), so the player and world remain procedural by design.

## Testing Strategy

- **Unit-level**: TypeScript strict compile is the first gate (`tsc`).
- **Browser automation (Playwright, Chromium with GPU)**:
  - Menu renders, no console/page errors.
  - Start → player moves on WASD, jumps on Space, double jumps.
  - Each stage loads via test hook with no errors and a non-blank canvas.
  - Fall → respawn at checkpoint; energy threshold opens portal; stage advance.
  - Pause/resume, settings persistence, resize.
- **Canvas inspector manifest**: desktop active-play captures for all five stages + menu +
  complete; render budgets reported.
- **Manual playthrough via scripted input** for Stage 1 to validate gap sizing against the
  movement constants; later stages validated by teleport hooks + targeted jumps.

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Gap sizes untuned for movement constants | Compute max jump distance from constants and assert in stage data (`StageBuilder` dev check). |
| Sideways/inverted gravity disorients | Camera re-orients its up vector smoothly; zone entry has a transition effect and sound. |
| Crumble platforms softlock | Platforms respawn after a delay; respawn also resets them. |
| Performance with bloom at DPR 2 | Settings quality presets; cap DPR 1.5 when FPS < 50 (adaptive). |
| OneDrive sync of `node_modules` | `.gitignore`; note for user to exclude folder from sync if slow. |
