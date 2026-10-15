# NEXUS — Mobile Support Pass: Evidence (2026-10-15)

Goal: make NEXUS fully playable on phones and tablets while keeping desktop behaviour unchanged.
Everything below ran on this machine (Windows 11, GPU-backed headless Chromium via Playwright) against
the dev server (`http://127.0.0.1:5188`) and, where stated, the production preview (`:4188`).

## What changed

| Area | Files | Summary |
| --- | --- | --- |
| Input layer | `src/input/InputManager.ts`, `KeyboardMouseInput.ts` (moved from `core/Input.ts`), `TouchInput.ts`, `VirtualJoystick.ts` | One MOVE / LOOK / JUMP / PAUSE read path for both devices. Pointer lock only in pointer mode; mode follows the last pointer type (hybrid devices switch live). Multi-touch tracked per pointer id; blur / hidden / cancel release every control. |
| Touch UI | `src/ui/MobileControls.ts`, `index.html`, `src/styles.css` | Floating analog joystick (dead zone, response curve, recentres on release), look-drag zone, 92 px jump button with double-jump ring, 48 px pause chip, press animation, haptics (`navigator.vibrate`, optional). |
| Layout / viewport | `src/ui/MobileLayout.ts`, `index.html`, `src/styles.css` | `data-input` / `data-form` / `data-orientation` on `<html>`, `--vvh` from the visual viewport, `100dvh` + fixed `#app`, safe-area `env()` insets, `touch-action`, `overscroll-behavior`, no double-tap zoom / callout / pinch, non-blocking "ROTATE DEVICE" banner (portrait phones, 4.5 s), fullscreen toggle (hidden when unsupported, orientation lock best-effort), pause on hidden tab, audio resume on return. |
| HUD / menus | `src/styles.css`, `src/ui/HUD.ts`, `src/ui/UIManager.ts`, `src/stages/Stage1.ts` | Responsive HUD (stage label under the pause chip in portrait, objective hidden on phones, hints centred above controls), touch wording for hints, ≥ 44 px targets, hover only under `(hover: hover)`, scrollable centred screens, two-column settings on short landscape, stage grid wraps. |
| Quality | `src/core/Device.ts`, `src/core/Quality.ts`, `src/utils/Constants.ts`, `SceneManager.ts`, `PostPipeline.ts`, `Environment.ts`, `Particles.ts`, `SaveSystem.ts`, `SettingsPanel.ts` | Capability-based device profile (pointer media queries, touch points, screen size, DPR, memory/cores, WebGL renderer string). Tiers: HIGH (unchanged desktop config), MEDIUM (DPR ≤ 1.5, half-res bloom, 1024 shadow map, 60 % ambient particles), LOW (DPR 1, no bloom / shadows, 35 % particles). Per-form-factor pixel budget. AUTO = tier from device + adaptive render scale (phones/tablets only, 0.6..1). Settings gained AUTO quality, HAPTICS, "LOOK SENSITIVITY". |
| Audio | `src/audio/AudioManager.ts` | Unlock also on `touchend` (iOS Safari), resume when the page becomes visible. |
| Tests / tooling | `tests/mobile.spec.ts`, `tests/nexus.spec.ts`, `scripts/viewport-check.mjs`, `scripts/bot-playtest.mjs`, `playwright.config.ts`, `package.json` | 8 touch tests on the iPhone project; landing assertion made frame-rate independent; 12-viewport drive + layout script; `NEXUS_BOT_PHASE_MS` probe knob. |
| Docs | `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/GAME_DESIGN.md` | Input layer, quality tiers, touch rules, new commands. |

No gameplay, physics, mechanics, stage-data or camera-math files were modified (Stage 1 only gained
`touchHints`). Desktop reads the same keyboard/mouse code as before, now behind `InputManager`.

## Baseline vs after (renderer, GPU Chromium)

| View | Stage | Calls | Tris | FPS | DPR |
| --- | --- | --- | --- | --- | --- |
| 1280×720 desktop (before) | 1 / 2 / 3 / 4 / 5 | 126 / 169 / 145 / 170 / 174 | 44k–52k | 60 | 1 |
| 1280×720 desktop (after) | 1 / 4 | 121 / 179 | 43k / 47k | 60 | 1 |
| 844×390 phone, device DPR 3 (before) | 4 | 152 | 45k | 60 | 2.0 (1688×780) |
| 844×390 phone, device DPR 3 (after, AUTO→medium) | 4 | 152 | 45k | 56 | 1.5 (1266×585) + half-res bloom + 1024 shadows |

Draw calls are identical across platforms because `StaticBatcher` already merges static geometry; the
mobile savings are fragment-side (44 % fewer pixels than the previous DPR-2 cap, bloom mips at half
resolution, shadow map a quarter the size, fewer particles). Headless FPS is not a phone measurement.

## Checks run

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | clean |
| Production build | `npm run build` | OK — 186 kB app + 568 kB three (54 + 142 kB gzip), 21 kB CSS |
| Desktop Playwright (regression) | `npm run test:desktop` | 11 / 11 (WASD, mouse-lock flow, Space jump, double jump, ESC pause/resume, all 5 stages, respawn, portal → stage 2, settings persistence, unlock, finale, resize) |
| Mobile Playwright | `npm run test:mobile` | 19 / 19 = 8 touch tests + the shared keyboard suite on the iPhone 13 project |
| 12-viewport drive (dev) | `npm run check:viewports` | 12 / 12 PASS — 390×844, 393×852, 412×915, 430×932 (portrait + landscape), 768×1024, 1024×768, 1280×720, 1920×1080 |
| Production preview drive | `NEXUS_URL=http://127.0.0.1:4188/ npm run check:viewports -- iphone-13` / `desktop-1080p` | PASS (both orientations + desktop) |
| Gravity / teleporters / rotation / hazards | `npm run check:gravity` | 14 / 14 |
| Evidence manifest (pass-3, 4 desktop + 7 mobile states) | `npm run inspect:canvas -- --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42` + `check_evidence.py` | 11 / 11 PASS, hardware GPU, no browser errors. Mobile stage-4 / stage-5 / complete exceed the inspector's generic 150-call mobile budget (243 / 180 / 180) but stay inside the project's 300-call budget — see tradeoff above. |
| Bot traversal | `npm run bot -- all` | S1 16/16, S2 11/15 (4 skipped), S3 3/9 (6 skipped), S4 19/22 + 1 death, S5 16/22 + 1 death. See below. |

Per-viewport the drive script verifies: canvas CSS size = viewport, buffer aspect = viewport aspect (no
stretch), DPR within tier, touch controls visible only in touch mode while PLAYING, joystick forward
value > 0.5 and player displacement > 1 unit, joystick recentres on release, jump button lifts the
player > 0.8 units, second press mid-air reaches ≥ 0.8 units higher, look drag changes yaw ≥ 0.2 rad,
pause chip → PAUSED → resume by tap, menu / stages / settings / pause / completion panels inside the
viewport with ≥ 44×40 px targets and no overlaps, zero console or page errors. Screenshots:
`artifacts/mobile/final/*.png`, `artifacts/mobile/preview/*.png`, `artifacts/pass-3/*.png`.

### Bot deaths are run-to-run variance, not a regression

Both deaths reproduce on the same legs with the same timing on the new code. The pre-change code
(stash-and-run) passed S4 once and S5 twice, then **died on the same S5 leg (static#18 → static#19)
with the same 2.9 s timing**. On the new code S4 passes cleanly with `NEXUS_BOT_PHASE_MS=300` or
`700` (shifts the moving-platform phase at arrival) and fails a different leg at `1100`. The bot
steers in world space and bypasses the input layer; FPS is 60 on both versions; no physics or stage
data changed; `check:gravity` is 14/14. The two legs are marginal for the bot's landing prediction.

## Defects found and fixed during the pass

1. `setPointerCapture` throws when the pointer is already gone → guarded (`capture()` helper).
2. Portrait phones: stage label overlapped the energy block → moved under the pause chip.
3. Short landscape phones: centred flex screens pushed tall panels off-screen → auto-margin centring
   and a two-column settings grid under 480 px height.
4. Rotate prompt was a modal overlay while gameplay kept simulating underneath → non-blocking banner.
5. Banner and objective wrapped on 390 px screens → single-line banner, objective hidden on phones.

## Limitations that need a physical device

- iOS Safari specifics: audio unlock timing on `touchend`, `100dvh` / visual-viewport behaviour with
  the toolbar, no Fullscreen API (button hides itself), orientation lock unsupported.
- Haptics (`navigator.vibrate`) — unavailable in headless Chromium and on iOS.
- Real GPU cost / thermal throttling: the AUTO tier and adaptive render scale were only exercised
  logically (desktop GPU never drops below the thresholds). A weak phone may need the LOW tier picked
  manually in Settings.
- Multi-touch with real fingers (move + look + jump simultaneously) was driven with synthetic pointer
  events; hit-testing of overlapping thumbs is untested on hardware.
- Notch / safe-area insets: CSS uses `env()`; headless reports zero insets.
