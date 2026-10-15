# NEXUS — Final Evidence (2026-10-15)

Revision: working tree at end of the build session (no git history yet).
Environment: Windows 11, Node 24.20, Chromium 1223 (Playwright 1.60, hardware GPU), Three.js 0.184, Vite 8.0.13.

## What was run

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | clean |
| Playwright suite (11 tests) | `npm run test:desktop` | 11 passed (51.5 s) |
| Bot playtest, Stage 1 | `npm run bot -- 1` | 16/16 legs, 0 deaths, 9/10 energy, portal opened |
| Bot playtest, Stage 2 | `npm run bot -- 2` | 11/15 legs, 4 skipped (rotating hub, teleport), 0 deaths |
| Bot playtest, Stage 3 | `npm run bot -- 3` | 3/9 legs, 6 skipped (gravity/teleport), 0 deaths |
| Bot playtest, Stage 4 | `npm run bot -- 4` | 20/22 legs, 2 skipped (hazard corridor), 0 deaths, portal opened |
| Bot playtest, Stage 5 | `npm run bot -- 5` | 17/22 legs, 5 skipped (gravity/teleport/rotation), 0 deaths |
| Gravity / teleporter / rotation / hazard | `npm run check:gravity` | 14/14 passed |
| Canvas inspector manifest (8 captures) | `npm run inspect:canvas -- --manifest artifacts/evidence.json ...` | 8 PASS, hardware GPU, budgets ok |
| Evidence checker | `npm run check:evidence` | 8 artifacts confirmed (run `pass-2`) |
| Production build | `npm run build` | ok: app 169.7 kB (49 kB gz) + three 568 kB (142 kB gz) |
| Production preview smoke | `NEXUS_URL=http://127.0.0.1:4188/ npm run smoke -- stage-1` | plays, 60 FPS, no console errors |
| DPR 2 at 1920×1080 (3840×2160 buffer), preview | `NEXUS_DPR=2 NEXUS_W=1920 NEXUS_H=1080 npm run smoke -- stage-2` | 58 FPS, 181 draw calls |

"Skipped" bot legs are those the scripted bot cannot reason about (rotating bars, gravity frames,
teleporters); each of those mechanics is exercised by `check:gravity` instead. All non-skipped legs
across the five stages passed with zero deaths in the final run.

## Renderer metrics (inspector, 1280×720, DPR 1)

| Capture | Draw calls | Triangles | Geometries | Textures |
| --- | --- | --- | --- | --- |
| Menu / Stage 1 | 126 | 44 k | 45 | 21 |
| Stage 2 | 191 | 52 k | 44 | 21 |
| Stage 3 | 145 | 52 k | 47 | 21 |
| Stage 4 (heaviest) | ≈255 (297 before clamp merge) | 54 k | 46 | 21 |
| Stage 5 / complete | 201 | 51 k | 46 | 21 |

Budget (desktop): ≤ 300 calls, ≤ 750 k triangles, ≤ 300 geometries, ≤ 60 textures. Post passes: bloom + vignette/flash
(2 beyond render/output). Shadow map 2048, one shadow-casting light, DPR cap 2 (settings: 1.5 / 1).

## Captures

- `artifacts/pass-2/desktop-{menu,stage-1..5,paused,complete}.png` — inspector captures.
- `artifacts/finale/stage-complete.png`, `core-{1000,2200,4500,7500}.png`, `game-complete.png` — transitions and finale.
- `artifacts/gravity/s3-wall.png`, `s3-ceiling.png`, `s5-landing.png` — gravity sections.
- `artifacts/bot/stage-*-end.png`, `artifacts/bot/report.json` — bot end states.

## Visual scorecard (self-assessed, procedural-only constraint)

| Category | Score | Evidence |
| --- | --- | --- |
| Art direction | 2 | Consistent dark-navy / cyan language; per-stage palettes (violet, warning orange, core white-blue) drive fog, sky, trim, UI, VFX |
| Hero / player | 2 | Authored robot: torso, chest core, visor, shoulders/arms, hover skirt, thruster ring, antenna; squash/stretch, lean, core brightness state |
| Obstacles / hazards | 2 | Crumble (shake + flicker telegraph), blink (warning flicker), falling, beams with caps and warning phase |
| Rewards / interactables | 2 | Orb ring + faceted core + glow, collect pop/burst/chime/HUD punch; checkpoints, activators and portal have sealed/open states |
| World / environment | 2 | Platform kit with deck/shell/trim/clamps/conduits, decor kit (towers, rings, pylons, holo panels, monoliths), instanced background megastructures, gravity volumes |
| Materials | 2 | Shared material roles, env map, holographic scanline shader, emissive signals |
| Lighting / render | 2 | Key/fill/rim, follow shadows, ACES, bloom on emissive only, vignette, glitch for instability |
| VFX / motion | 2 | Event-driven bursts (jump, land, collect, checkpoint, teleport, crumble, portal, core waves), ambient motes, camera kick/shake/FOV |
| UI / HUD | 2 | Segmented energy meter, stage label, hints, toasts, intro titles, menu/pause/settings/complete screens with world motifs |
| Performance evidence | 2 | Inspector metrics, DPR-2 FPS, budgets, bundle split |

Average 2.0: "premium stylized" tier, not showcase — expected without generated hero assets (no Tripo/Gemini keys).

## Residual risks

- Console warning X4122 from ANGLE's HLSL translation of Three's shadow depth packing (harmless, not an error).
- Pointer lock re-acquisition after Esc follows browser gesture rules; the HUD shows a "CLICK TO ENGAGE CONTROLS" hint.
- Headless FPS is indicative; verify on the target machine with `?debug` (FPS overlay).
- Project lives in OneDrive; file-sync mtime changes can trigger Vite HMR reloads during automated runs.
