# NEXUS — Project Guide for Claude

## Overview

NEXUS is a browser-based third-person 3D platformer prototype: a small explorer robot collects
Energy across five futuristic stages to reactivate the Core. Exploration and movement, no
combat. Desktop browser only. See `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`,
`docs/DEVELOPMENT_PLAN.md`.

## Stack

Vite 8 · TypeScript (strict) · Three.js r184 (`three/addons` for post-processing) · DOM/CSS UI ·
Web Audio (procedural) · `localStorage` saves · `lil-gui` (debug only) · Playwright for QA.
No physics engine: custom kinematic character controller with sphere-vs-OBB collision
(`src/player/PlayerPhysics.ts`, `src/utils/CollisionUtils.ts`).

## Commands

```bash
npm run dev          # http://127.0.0.1:5188
npm run build        # tsc + vite build → dist/
npm run preview      # http://127.0.0.1:4188 (production preview)
npm run typecheck    # tsc --noEmit
npm run test:desktop # Playwright suite (needs: npx playwright install chromium)
npm run bot -- all   # scripted traversal of every stage (dev server must be running)
npm run check:gravity   # gravity zones / teleporters / rotation / hazards
npm run inspect:canvas -- --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
```

Debug mode: `http://127.0.0.1:5188/?debug` (lil-gui tuning, overlay with FPS/position/stage/
checkpoint/gravity, teleport-to-stage). `?stage=3` jumps straight into a stage in dev.

## Architecture (short)

`src/core/Game.ts` is the composition root. Systems communicate through `src/core/EventBus.ts`.
`GameState` is a strict FSM (LOADING, MENU, PLAYING, PAUSED, STAGE_COMPLETE, TRANSITION,
GAME_COMPLETE); gameplay updates only run in PLAYING. Stages are declarative data in
`src/stages/Stage1..5.ts` built by `StageBuilder` into live `World` entities. Mechanics live in
`src/mechanics/*`; each exposes `update(dt)` and `dispose()`. UI never mutates gameplay; it
dispatches intents through the bus.

Update order per frame: input → fixed-step gameplay (platforms → player physics → triggers)
→ camera → effects/tweens (real delta) → UI → render. See `docs/ARCHITECTURE.md` §3.

## Coding rules

- All tunables in `src/utils/Constants.ts`. No magic numbers in gameplay code.
- Small modules (< ~300 lines). One responsibility each.
- Shared materials/geometries come from `src/effects/Materials.ts`; stage-owned resources are
  disposed in `StageInstance.dispose()`.
- No `Math.random` in gameplay or effects; use the seeded RNG from `src/utils/random.ts`.
- No per-frame allocations in hot paths: reuse scratch vectors.
- Gameplay reads the scaled delta; camera/tweens/particles/UI read the real delta.
- Events are typed in `EventBus.ts`; add new event names there first.
- Keep `window.__THREE_GAME_TEST_HOOKS__` and `__THREE_GAME_DIAGNOSTICS__` real (see
  `src/debug/TestHooks.ts`); tests depend on them.
- Debug UI and verbose logging are gated behind `?debug` or `import.meta.env.DEV`.
- Level data lives in `src/stages/Stage1..5.ts`; after editing it, check the reachability log in
  the dev console and run `npm run bot -- <stage>` (never while editing `src/`: HMR reloads the page
  under the bot and produces false deaths).
- Static set dressing and static platform bodies are merged by `StaticBatcher`; anything that
  must move, hide or flicker individually must stay out of the batch.

## Game mechanics

Run, jump, double jump (coyote time + jump buffer + variable height), energy orbs, activators,
checkpoints with respawn, moving/rotating/vertical platforms (player rides them), gravity zones
(low / sideways / inverted: the player's `up` vector changes), teleporters, crumble/blink/falling
platforms, energy-beam hazards, portals, Stage 5 Core cinematic.

## Stage structure

| Stage | Name | Introduces |
| --- | --- | --- |
| 1 | Awakening | movement, double jump, energy, checkpoint, portal |
| 2 | The Network | moving, rotating, vertical platforms |
| 3 | Distortion | gravity zones, teleporters |
| 4 | The Collapse | crumble/falling/blink platforms, hazards |
| 5 | The Core | everything + finale |

## Asset strategy

Everything is procedural (no Tripo/Gemini/ElevenLabs keys, no Blender). Factories return
`THREE.Group`s with separate collision proxies so GLB models can replace them later.
`AudioManager.play(id)` maps ids to `Synth` recipes; swap in decoded files later.

## Testing

After each phase: `npm run build`, start dev server, run Playwright (`npm test`) or the targeted
spec, check console errors in the test output, fix before moving on. Definition of done is in
the original brief: all five stages playable end to end without developer intervention.

## Constraints

- Desktop browser, WebGL 2, keyboard + mouse (pointer lock during play).
- 60 FPS target; ≤ 300 draw calls, ≤ 750k triangles, DPR cap 2, ≤ 2 post passes beyond render.
- No backend. No new runtime dependencies without a documented reason.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml`; Vite `base` is read from `VITE_BASE`
  (set by the workflow to `/<repo>/`). Never hardcode absolute `/...` asset URLs; use Vite imports
  or `import.meta.env.BASE_URL`.
- Project lives inside OneDrive; `node_modules`, `dist`, `test-results`, `artifacts` are ignored.
