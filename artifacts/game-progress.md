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

## Mobile support pass (2026-10-15)

### Intent
Make NEXUS fully playable on phones/tablets without changing desktop behaviour, mechanics,
levels or visual identity. One input layer feeding the same gameplay systems.

### Baseline (dev server, GPU Chromium, before changes)
| View | Stage | Calls | Tris | FPS |
| --- | --- | --- | --- | --- |
| 1280x720 dpr1 | 1 / 2 / 3 / 4 / 5 | 126 / 169 / 145 / 170 / 174 | 44k / 51k / 52k / 46k / 51k | 60 |
| 844x390 dpr3 (capped 2) | 4 | 152 | 45k | 60 |
Geometry is cheap; mobile cost is fragment-bound: DPR 2-3 buffers, full-screen bloom (5 mips),
2048 PCF shadow map, 900 ambient points + 2400 burst particles. No point/spot lights exist.

### Plan
1. `src/input/` — `KeyboardMouseInput` (moved from core/Input), `VirtualJoystick`, `TouchInput`,
   `InputManager` (MOVE / LOOK / JUMP / PAUSE merged from both sources; pointer lock only for mouse).
2. `src/core/Device.ts` — touch / form factor / GPU tier detection (no UA-only logic).
3. `src/core/Quality.ts` — HIGH / MEDIUM / LOW profiles + AUTO resolver + adaptive render scale.
   SceneManager pixel budget, PostPipeline bloom resolution scale, Environment shadow map size and
   ambient particle count driven by the profile.
4. `src/ui/MobileControls.ts` — joystick zone, look zone, jump + pause buttons, press feedback,
   haptics. `src/ui/MobileLayout.ts` — viewport classes, orientation overlay, fullscreen,
   visibility pause.
5. index.html viewport meta + touch sections; styles.css responsive / safe-area / touch rules.
6. Audio unlock on touchend + resume on visibility.
7. Tests: `tests/mobile.spec.ts` (mobile-chrome project), `scripts/viewport-check.mjs` (8 sizes ×
   orientations, overlap + console + canvas checks). Desktop suite + bot for regression.

### Completed (mobile pass)
- Input layer: `src/input/{InputManager,KeyboardMouseInput,TouchInput,VirtualJoystick}.ts`; Game
  reads MOVE/LOOK/JUMP/PAUSE from InputManager only. Pointer lock only in pointer mode.
- Touch UI: `src/ui/MobileControls.ts` (floating joystick, look zone, jump button with
  double-jump ring, pause chip, press feedback, haptics), `src/ui/MobileLayout.ts` (data-input /
  data-form / data-orientation, --vvh, landscape banner, fullscreen, visibility pause).
- Quality: `src/core/Device.ts`, `src/core/Quality.ts`, `Constants.QUALITY / PIXEL_BUDGET /
  ADAPTIVE / TOUCH`; SceneManager pixel budget + render scale; PostPipeline bloom scale;
  Environment shadow map size + ambient density. Settings: AUTO quality, HAPTICS, LOOK SENSITIVITY.
- Audio: touchend unlock, resume on visibilitychange.
- Verification: `scripts/viewport-check.mjs` (12 viewports pass), `tests/mobile.spec.ts` (8 tests),
  Playwright desktop 11/11 + mobile 19/19, production build OK.

### Defects found and fixed during the mobile pass
- `setPointerCapture` throws when the pointer is already gone (synthetic or cancelled) → guarded.
- Portrait phones: stage label collided with the energy block → label moves under the pause chip.
- Short landscape phones: centred flex screens could not scroll tall panels → auto-margin centring,
  two-column settings grid under 480 px height.
- Rotate overlay was modal while gameplay kept simulating underneath → replaced by a non-blocking
  4.5 s banner (portrait play is allowed, per brief).

### Bot variance investigation (not a regression)
`npm run bot -- all` on the new code reported one death each on S4 (static#9 → moving#10) and
S5 (static#18 → static#19). Checks: FPS 60 on both versions; no physics / mechanics / stage files
changed; `check:gravity` 14/14. Stash-and-run of the pre-change code: S4 passed once, S5 passed
twice and then **died on the same S5 leg with the same 2.9 s timing**. S4 passes on the new code
with `NEXUS_BOT_PHASE_MS=300|700` (moving-platform phase at arrival) and fails at 1100. Conclusion:
both legs are marginal for the bot's landing prediction and vary run to run in both versions.
Bot script gained the `NEXUS_BOT_PHASE_MS` knob for probing this.

## Character integration (2026-10-16)

### Intent
Replace the procedural hover-robot with the Blender character NX-01 "Wayfinder" from the sibling
`../Blender-1/` project as the player's visual only; physics, camera, mechanics and stages unchanged.

### Decisions
- Asset: `Blender-1/exports/NEXUS_Player.glb` (validated export: 24 rigid parts, 84 primitives,
  20-bone skin, 9 untextured materials, +Z forward, feet at origin, no clips) copied to
  `src/assets/characters/nexus-player/` with a README stating the bone/material contract.
- 84 primitives would have put Stage 4 on the 320 draw-call test limit, so `PlayerCharacter.ts`
  merges them into one `SkinnedMesh` with a group per material (9 draw calls; stage counts fell by 8).
- No animation clips exist, so the rig is animated procedurally (`CharacterPoses.ts`,
  `PlayerAnimation.ts`): idle / run / jump / fall / land blended by smoothed state weights plus a
  landing crouch and take-off pulse. `CharacterRig.clips` is ready for an `AnimationMixer`.
- Emissive strengths 4–6 clamped to the game's bloom range; `side = FrontSide` (closed shells);
  `envMapIntensity` 1.6 on armour/trim so the metals read; scale 1.15 (1.51 m tall vs 1.2 m capsule).
- Body pivot moved to the feet (`body.position.y = -PLAYER_CENTER_HEIGHT`); the capsule is untouched.
- The GLB loads behind the boot sequence (`LoadingScreen.run(ready)`); on failure the old robot is
  mounted as a fallback and diagnostics report `player.character: 'fallback'` (tests assert `'glb'`).

### Verification
`npm run typecheck`, `npm run build` (also with `VITE_BASE=/3d-Platofrmer/`, GLB served 200 from the
preview), `npm run test:desktop` 11/11, `npm run test:mobile` 19/19, `npm run bot -- all` (all
non-skipped legs, 0 deaths), `npm run check:gravity` 14/14, `npm run check:character` desktop +
mobile + preview (GLB on all stages, 0 console errors; crops in `artifacts/character/final/`),
fallback path exercised with the GLB request aborted, `?debug` boot clean.

### Defects found and fixed during the pass
- Pose writers shared a scratch pose without clearing it, so stale run thigh angles leaked into idle
  after any run (seen on the Stage 3 wall/ceiling captures) → each writer clears first.
- Added a 60 ms grounded grace so contact dropouts at edges cannot flicker the pose.
