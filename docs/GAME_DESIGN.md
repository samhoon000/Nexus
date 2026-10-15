# NEXUS — Game Design Document

> A futuristic platforming experience. Five stages. Exploration and movement, not combat.

## 1. Pitch

You are a small explorer unit woken inside a vast, dormant digital world. Collect Energy to
reactivate the structures that lead to the Core, and bring the world back online.

## 2. Design Brief

| Field | Decision |
| --- | --- |
| Player promise | "I am tiny inside an immense machine, and my movement is the key that wakes it." |
| Target feeling | Calm wonder punctuated by moments of precise, satisfying movement. Premium, cinematic, slightly surreal. |
| Primary verb | **Jump** (single and double) to cross space. |
| Secondary verbs | Run, steer in the air, ride platforms, collect energy, enter teleporters, traverse gravity zones. |
| 5–30 second loop | Read the next platform → run → jump (→ double jump) → land → collect an orb → the HUD counter ticks and the world responds. |
| 1–5 minute arc | Collect enough energy to power the stage gateway → cross the gate → stage complete → next stage introduces a new rule. |
| Lose / learn / restart | Falling off the world fades the screen and respawns the player at the last checkpoint in under a second. Deaths are counted but never punished further. |
| Reward | Energy orbs (progress), checkpoints (safety), powered structures (world reacts), portal activation (stage complete). |
| Risk | Gaps, moving platforms, disappearing platforms, hazards, gravity transitions. |
| What a better player does | Chains double jumps with air control, rides platform momentum, times timed platforms, finds optional orbs off the main route. |
| Next-decision communication | Glowing orbs form a visible breadcrumb line. Platforms carry emissive edge trim. The portal is the brightest object in every stage. |
| Non-goals | Combat, enemies, inventory, dialogue, multiplayer, mobile touch support (desktop browser only). |

## 3. Core Loop Contract

> Player **jumps and double-jumps between floating platforms** to **collect Energy and reach the
> stage gateway** while **gaps, moving and failing platforms, and gravity shifts** create risk;
> success **powers up structures and unlocks the next stage**, failure **respawns at the last
> checkpoint with a death counted**.

Proof in code:

- Verb mapped to input: `Space` → jump / double jump via `PlayerController`.
- Objective visible: `ENERGY x / y` top-left HUD; portal sealed until threshold reached.
- Pressure in first minute: Stage 1 introduces a gap after the first ~15 seconds.
- Reward changes state: energy count gates the portal; checkpoints change respawn point.
- Failure teaches: fall → brief fade → respawn at last checkpoint; death counter in end stats.
- Fast restart: respawn < 1s; `RESTART CHECKPOINT` in pause menu.

## 4. Player

A small hovering explorer robot, ~1.0 units tall, built from authored primitive geometry:

- Rounded chest body with a visible emissive **energy core** that brightens with collected energy.
- Head with a wide cyan visor; head tilts into motion direction.
- Shoulder pods and small arm segments; legs replaced by a hover skirt and thruster ring.
- Idle hover bob; lean into movement; stretch on jump, squash on land.
- Collision proxy: a capsule (two spheres, radius 0.35, height 0.9), independent of visuals.

The visual is a `THREE.Group` returned from a factory so it can be swapped for a GLB later.

## 5. Movement Feel Targets

| Parameter | Value | Notes |
| --- | --- | --- |
| Run speed | 7.5 u/s | Fast enough to feel agile; stage gaps sized against it |
| Ground acceleration | 40 u/s² | Responsive; reaches full speed in <0.2s |
| Ground deceleration | 50 u/s² | Snappy stop |
| Air control | 0.55 | Fraction of ground acceleration available in air |
| Gravity | 30 u/s² | Heavier than Earth for a non-floaty arc |
| Jump velocity | 11.5 u/s | Jump height ≈ 2.2 units |
| Double-jump velocity | 10.5 u/s | Slightly weaker, resets horizontal drift partially |
| Max fall speed | 36 u/s | |
| Coyote time | 0.12 s | Jump allowed shortly after leaving a ledge |
| Jump buffer | 0.12 s | Jump pressed slightly before landing still fires |
| Variable jump | Yes | Releasing Space early cuts upward velocity by 50% |
| Fall death threshold | 18 units below stage floor | Per-stage configurable |

All values live in `src/utils/Constants.ts`.

## 6. Energy

- Glowing orb: outer rotating ring, faceted inner core, soft point glow, floating bob.
- Collecting: scale-pop + particle burst + chime (pitch varied) + HUD counter punch.
- Energy gates the portal in every stage (`required / total`). Extra orbs are optional and
  feed the final statistics.
- Energy also powers "activators": stepping on an activator pad with enough energy raises a
  bridge, opens a barrier, or starts a platform loop.

## 7. Mechanics by Stage

| Mechanic | S1 | S2 | S3 | S4 | S5 |
| --- | --- | --- | --- | --- | --- |
| Run / jump / double jump | ● | ● | ● | ● | ● |
| Energy collection | ● | ● | ● | ● | ● |
| Checkpoints | ● | ● | ● | ● | ● |
| Portal activation | ● | ● | ● | ● | ● |
| Moving platforms (linear) |  | ● | ● | ● | ● |
| Rotating platforms |  | ● |  |  | ● |
| Vertical lifts |  | ● |  | ● | ● |
| Gravity zones (low / sideways / inverted) |  |  | ● |  | ● |
| Teleporters |  |  | ● |  | ● |
| Disappearing (crumble) platforms |  |  |  | ● | ● |
| Falling platforms |  |  |  | ● |  |
| Timed (blink) platforms |  |  |  | ● | ● |
| Hazards (energy beams) |  |  |  | ● | ● |
| Core cinematic |  |  |  |  | ● |

## 8. Stage Plans

Each stage is 3–7 minutes. Camera is third-person; the next platform is always visible from the
current one. Orbs form the breadcrumb path; checkpoints sit before every risky section.

### Stage 1 — AWAKENING

- **Theme:** Dormant white/cyan platforms, slow ambient particles, one giant distant ring.
- **Beats:** Start pad (controls hint) → three flat platforms (walk) → first gap (jump) → gap
  needing double jump → orb staircase → checkpoint → a short descending path → activator pad
  that raises a bridge → portal plaza. Required energy: 8 of 10.
- **Teach:** Movement, jump, double jump, collection, checkpoint, portal.
- **Cinematic:** On completion the camera pulls back and the distant ring powers on.

### Stage 2 — THE NETWORK

- **Theme:** Dense interconnected rails and towers in blue/cyan; everything is wired.
- **Beats:** Start → first moving platform (slow linear) → rail crossing → rotating platform hub
  → vertical lift tower → checkpoint → moving bridge sequence (two platforms out of phase) →
  energy gateway. Required energy: 12 of 15.
- **Teach:** Riding platforms, timing, vertical movement.

### Stage 3 — DISTORTION

- **Theme:** Purple/magenta accents, tilted and fractured geometry, glitching holograms, warped
  fog colour. Visually distinct from 1–2.
- **Beats:** Normal start → **low gravity zone** (long floaty jumps over a wide gap) → teleporter
  → floating section under **sideways gravity** (walk along a wall) → checkpoint → **inverted
  gravity** corridor (ceiling becomes floor) → gravity restores → teleporter → final portal.
  Required energy: 10 of 14.
- **Teach:** Gravity is a stage property, not a constant.

### Stage 4 — THE COLLAPSE

- **Theme:** Orange/red warning accents on failing structures, flickering lights, glitch
  holograms, falling debris particles, screen shake on collapses.
- **Beats:** Start → crumble platform path → checkpoint → falling platform sequence → fast
  moving platforms → timed blink platforms → checkpoint → energy beam hazard corridor → long
  double-jump gap → final sprint on crumble platforms → portal. Required energy: 10 of 14.
- **Pressure:** Platforms fail after a short delay, but respawn after a few seconds so
  retries are never softlocked. Checkpoints every ~45 seconds of play.

### Stage 5 — THE CORE

- **Theme:** Approaching the Core: dark, enormous central tower, everything converging.
- **Beats:** Start → moving platform ascent → gravity zone wall-walk → teleporter → crumble +
  blink platform gauntlet → rotating ring ascent → checkpoint → final energy collection ring
  → the Core chamber. Required energy: 14 of 18.
- **Finale:** Entering the chamber triggers the Core sequence: energy is inserted, the Core
  ignites, distant structures light up in waves, the sky changes colour, the camera slowly
  pulls back, music swells, then "THE CORE HAS BEEN ACTIVATED" with run statistics.

## 9. Difficulty Curve

Stage 1 is almost impossible to fail. Each later stage introduces one new concept, then
combines it with earlier ones. Checkpoints are placed before every new concept. Failure costs
only a respawn. Stage 4 is the pressure peak; Stage 5 is a synthesis that is slightly easier
than Stage 4 moment-to-moment, so the finale feels triumphant rather than frustrating.

## 10. Visual Identity

- Background near-black navy `#05070f`; fog per stage.
- Energy cyan `#19e6ff`; secondary blue `#3c7bff` and violet `#8a5cff`; hologram white
  `#dff6ff`; sparse magenta accent `#ff3fd6` (Stage 3) and warning orange `#ff7a2a` (Stage 4).
- Materials: dark gunmetal shells, lighter panel trim, emissive edge strips, holographic panels
  with scrolling scanlines. Platforms have visible edge frames and underside conduits so they
  read as objects, not slabs.
- Scale contrast: enormous silent background towers, rings, and arcs far outside the play space.
- Post: bloom on emissive only, light vignette. No overuse of neon; most surfaces are matte dark.

## 11. UI

- HUD: `ENERGY 12 / 20` top-left with a thin segmented meter; `STAGE 2 · THE NETWORK`
  top-right; control hints bottom-right that fade after first use.
- Main menu: `NEXUS` / `A FUTURISTIC PLATFORMING EXPERIENCE` / `START · STAGES · SETTINGS`.
- Pause: `PAUSED` / `RESUME · RESTART CHECKPOINT · SETTINGS · MAIN MENU`.
- Stage complete: stage name, time, energy; auto-advances after a short transition.
- Game complete: `THE CORE HAS BEEN ACTIVATED`, total time, energy, stages, falls, restart,
  main menu.

## 12. Audio Direction

Procedural Web Audio (no external keys available): soft synth pads and slow arpeggios as
adaptive music whose intensity rises per stage; short synthesized SFX for jump, double jump,
land, orb, checkpoint, teleport, platform activation, crumble warning, stage complete, and the
Core ignition. All playback is pitch-varied to avoid machine-gun repetition.
