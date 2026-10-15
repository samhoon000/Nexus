# NEXUS — Progress Log

## Intent & constraints
Five-stage futuristic 3D platformer prototype in Three.js + Vite + TypeScript. Desktop browser,
keyboard + mouse. Procedural assets only (no Tripo / Gemini / ElevenLabs keys, no Blender).
Game feel over visual complexity. Definition of done in the brief (all stages playable end to end).

## Decisions
- TypeScript strict instead of plain JS (scaffold + skill pack are TS; the brief allows either).
- Custom kinematic capsule-vs-OBB collision instead of Rapier: arbitrary gravity direction and
  authored platformer feel (coyote, buffer, variable jump, auto step-up) are simpler and deterministic.
- DOM/CSS UI, Web Audio procedural synth + generative music, localStorage saves.
- Static geometry batched per material (`StaticBatcher`); dynamic platform clamps merged per
  platform. Stage 4 (heaviest) ≈ 255 draw calls, under the 300 budget.
- Menus are translucent over the live world (slow camera orbit of Stage 1) as the menu backdrop.
- Vendor chunk for Three (169 kB app + 568 kB three, 191 kB gzipped total).

## Completed
- All 20 phases: core loop/state/bus, renderer + post, environment, player, camera, world kit,
  energy, checkpoints, five stage definitions, mechanics (moving/rotating/crumble/blink/falling,
  gravity zones, teleporters, hazards, portal, Core finale), UI screens, audio, particles, save
  system, debug tools, test hooks, docs.
- Verification tooling: dev reachability validator, `scripts/bot-playtest.mjs` (predictive
  platform-chain bot), `scripts/gravity-check.mjs` (gravity / teleporter / rotation / hazard),
  `scripts/finale-shots.mjs`, `scripts/smoke.mjs`, Playwright suite (11 tests), canvas inspector
  manifest.

## Defects found and fixed during verification
- STAGE_COMPLETE → GAME_COMPLETE transition missing (finale threw and froze the loop); loop now
  survives frame exceptions.
- Teleporter arrival pad bounced the player back after the cooldown → pads re-arm only after leaving.
- Checkpoint respawn faced backwards.
- Stale stage-complete timers survived a direct stage start (test hooks) → cancelled on new flow.
- 0.5-unit ledges blocked the capsule → auto step-up (STEP_HEIGHT 0.55).
- Stage 1 "double jump" gap was single-jumpable → widened to 6.5 u + 1 rise.
- Stage 4 blink phases overlapped for only 0.2 s → 0.8 s; waiting on a falling platform for the
  shuttle → static pad added; Stage 5 crumble→blink wait → static pad added.
- Sideways gravity zones did not cover the launch platform depth (Stage 3 island, Stage 5 cp1).
- Draw calls over budget → static batching; finale overexposure → dedicated ring material, calmer
  power ramp, farther cinematic camera.

## Known limitations / risks
- Console warning X4122 from ANGLE translating Three's depth-packing shader (harmless).
- Bot skips legs it cannot reason about (rotating bars, gravity frames, teleporters); those are
  covered by `gravity-check.mjs` and the manual-style scripts instead.
- Pointer lock re-acquisition after Esc depends on browser gesture rules; the HUD shows
  "CLICK TO ENGAGE CONTROLS" when unlocked during play.
- Headless GPU FPS is indicative only; 58 FPS measured at 3840×2160 (DPR 2) on this machine.
