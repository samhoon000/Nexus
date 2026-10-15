# NEXUS — Architecture

## 1. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Catches interface mistakes across ~60 modules; the Three.js skill pack and scaffold are TS. The brief allows "JavaScript/TypeScript as appropriate". |
| Bundler / dev server | Vite 8 | Fast HMR, trivial static deploy. |
| Rendering | Three.js r184 + `three/addons` post-processing | WebGL, EffectComposer bloom, OutputPass. |
| Physics | Custom kinematic character controller + sphere-vs-OBB collision | Arbitrary gravity direction (sideways / inverted) and authored platformer feel (coyote time, jump buffering) are simpler and more deterministic than bending a rigid-body engine. No WASM dependency. |
| UI | DOM + CSS overlays | Crisp text, accessibility, easy theming; UI reads game state through an event bus. |
| Audio | Web Audio API, procedural synthesis | No external audio keys available; all sounds are code so they are replaceable by files later via `AudioManager`. |
| Persistence | `localStorage` via `SaveSystem` | Prototype requirement. |
| Tuning | `lil-gui` behind `?debug` | Live tuning without touching code. |
| QA | Playwright + canvas inspector | Browser-level tests and measured render evidence. |

## 2. Folder Structure

```
src/
  main.ts                      Bootstraps Game, HMR cleanup, global error overlay
  core/
    Game.ts                    Composition root; owns systems, wires events
    GameLoop.ts                rAF loop, clamped delta, fixed-step accumulator for physics
    GameState.ts               Finite state machine: LOADING, MENU, PLAYING, PAUSED, STAGE_COMPLETE, GAME_COMPLETE, TRANSITION
    EventBus.ts                Typed pub/sub between systems and UI
    SceneManager.ts            Scene, renderer, post pipeline, resize/DPR handling
  player/
    Player.ts                  Entity: owns visual group, controller, physics body, animation
    PlayerController.ts        Input intents → desired velocity; jump/double-jump state
    PlayerPhysics.ts           Gravity frame, capsule collision vs colliders, ground detection, platform riding
    PlayerAnimation.ts         Hover bob, lean, squash/stretch, visor/core state
    PlayerModel.ts             Procedural robot factory (swappable for GLB)
  camera/
    CameraController.ts        Third-person orbit, smoothing, collision, kick/shake/FOV punch
  world/
    World.ts                   Holds live stage content: platforms, colliders, orbs, zones
    Environment.ts             Sky dome, fog, lights, ambient particles, background megastructures
    Platforms.ts               Platform factory (static, moving, rotating, crumble, blink, falling) + Collider type
    Hazards.ts                 Energy beams with timed on/off and player kill volumes
    Decor.ts                   Non-colliding props: rails, pylons, holo panels, rings, conduits
  stages/
    StageTypes.ts              StageDefinition data schema
    StageManager.ts            Loads/unloads stage definitions, tracks progress, stage complete
    StageBuilder.ts            Turns a StageDefinition into World entities
    Stage1.ts … Stage5.ts      Declarative stage data (platform lists, orbs, zones, etc.)
  mechanics/
    MovingPlatforms.ts         Linear/rotating/vertical motion with phase; reports frame delta for riding
    GravityZones.ts            Box volumes that set the player's gravity vector and scale
    Teleporters.ts             Paired portals with cooldown, VFX, and camera re-orientation
    EnergySystem.ts            Orb entities, collection, energy count, activators
    DisappearingPlatforms.ts   Crumble/blink/fall state machines with respawn
    Checkpoints.ts             Checkpoint volumes, activation, respawn point
    Portal.ts                  Stage exit; sealed/open states; completion trigger
    CoreSequence.ts            Stage 5 finale cinematic script
  effects/
    Particles.ts               Pooled GPU points system (burst, ambient, trails)
    PostPipeline.ts            EffectComposer: render → bloom → vignette → output
    EnergyEffects.ts           Shared emissive material helpers, scrolling holo shader
    ScreenEffects.ts           DOM flash/fade overlays
    Tween.ts                   Tiny tween manager + easings
  ui/
    UIManager.ts               Shows/hides screens from GameState; owns all DOM roots
    HUD.ts                     Energy meter, stage label, hints, checkpoint toast
    MainMenu.ts                Title, buttons, stage select
    PauseMenu.ts
    SettingsPanel.ts           Sensitivity, volumes, invert Y, quality
    StageComplete.ts
    GameComplete.ts
    LoadingScreen.ts
  audio/
    AudioManager.ts            Context unlock, groups, play(id), music control
    Synth.ts                   Procedural SFX recipes
    Music.ts                   Generative pad/arp music with intensity levels
  save/
    SaveSystem.ts              localStorage read/write with schema version
  debug/
    DebugTools.ts              lil-gui, overlay (FPS, position, stage, checkpoint, gravity), teleport-to-stage
    TestHooks.ts               window.__THREE_GAME_TEST_HOOKS__ and __THREE_GAME_DIAGNOSTICS__
  utils/
    Constants.ts               All tunables (movement, camera, colors, budgets)
    MathUtils.ts               damp, clamp, lerp, angle helpers
    CollisionUtils.ts          Sphere-vs-OBB, point-in-OBB, closest point helpers
    dispose.ts                 Recursive disposal
    random.ts                  Seeded RNG
    dom.ts                     Query helpers
```

## 3. Update Order (per frame)

```
GameLoop.tick(realDelta)
  ├─ Input.poll()                            (intents only)
  ├─ GameState gate: if PLAYING →
  │    ├─ fixed-step accumulator (1/120 s):
  │    │    ├─ MovingPlatforms.step()        (compute frame deltas)
  │    │    ├─ DisappearingPlatforms.step()
  │    │    ├─ Hazards.step()
  │    │    ├─ Player.physicsStep()           (apply platform carry, gravity, move, collide)
  │    │    └─ Triggers: GravityZones, Teleporters, Checkpoints, Energy, Portal, fall check
  │    └─ Player.animate(realDelta)
  ├─ Camera.update(realDelta)                 (always, even when paused → menus look alive)
  ├─ Effects: Particles, Tweens, Environment ambient (realDelta, frozen under reduced-motion)
  ├─ UI.update()                              (reads state, never writes gameplay)
  └─ Render: PostPipeline.render()
```

Gameplay reads the **scaled** delta (hitstop); camera, tweens, particles, UI read the **real**
delta so feedback stays live.

## 4. Key Interfaces

```ts
// world/Platforms.ts
interface Collider {
  id: string;
  object: THREE.Object3D;      // world transform source
  halfExtents: THREE.Vector3;  // OBB in local space
  enabled: boolean;            // false while crumbled/blinked off
  kind: 'solid' | 'hazard';
  platform?: PlatformBehaviour; // for riding (frame delta pos / rotation)
}

// mechanics/GravityZones.ts
interface GravityZone { box: OBB; up: THREE.Vector3; scale: number; }

// player/PlayerPhysics.ts
interface PhysicsState {
  position: THREE.Vector3; velocity: THREE.Vector3;
  up: THREE.Vector3; gravityScale: number;
  grounded: boolean; groundNormal: THREE.Vector3; groundCollider: Collider | null;
}

// stages/StageTypes.ts
interface StageDefinition {
  id: number; name: string; subtitle: string;
  theme: StageTheme;                  // colors, fog, music intensity
  spawn: Vec3; spawnYaw: number;
  killY: number;                      // fall threshold (in gravity-up frame it is distance from spawn plane)
  energyRequired: number;
  platforms: PlatformDef[]; orbs: Vec3[]; checkpoints: CheckpointDef[];
  gravityZones?: GravityZoneDef[]; teleporters?: TeleporterDef[];
  hazards?: HazardDef[]; activators?: ActivatorDef[]; decor?: DecorDef[];
  portal: PortalDef;
}
```

Events (`EventBus`): `energy:collected`, `energy:changed`, `checkpoint:activated`,
`player:jump`, `player:doubleJump`, `player:land`, `player:died`, `player:respawn`,
`teleport`, `gravity:changed`, `platform:activated`, `platform:crumble`, `portal:opened`,
`stage:complete`, `game:complete`, `state:changed`, `settings:changed`.

## 5. Collision Model

- Player collider: capsule approximated by two spheres (radius 0.35) along the current gravity
  `up` axis, 0.9 apart.
- World colliders: oriented boxes (`halfExtents` in object local space, world matrix from the
  Three.js object). Platforms, ramps (rotated boxes), walls.
- Resolution per step: move by velocity, then for up to 4 iterations push each sphere out of the
  nearest penetrating box along the closest-point normal; remove velocity into the surface.
- Grounded if any contact normal · `up` > `cos(50°)`. Slopes up to 50° are walkable.
- Riding: if grounded on a moving/rotating platform, the platform's frame delta (translation +
  rotation about its pivot) is applied to the player before the step.
- Teleporters, orbs, checkpoints, gravity zones and portals are trigger volumes (OBB or sphere),
  resolved after movement.

## 6. Rendering Pipeline

- Renderer: sRGB output, ACES tone mapping, exposure 1.0, PCF soft shadows, DPR cap 2
  (settings allow 1.5 / 1.0 "performance" mode).
- One shadow-casting directional light whose shadow frustum follows the player (24 × 24 units,
  2048 map). Hemisphere fill; a handful of static point lights are replaced by emissive
  materials + bloom to keep light count ≤ 3.
- Environment map from `RoomEnvironment` so metals read.
- Post: RenderPass → UnrealBloom (strength 0.55, radius 0.35, threshold 0.82) → Vignette →
  OutputPass. Settings can disable bloom.
- Material library with shared roles (`shellDark`, `shellLight`, `trim`, `emissiveCyan`,
  `emissiveViolet`, `hazard`, `holo`, `glass`). All platform geometry shares a few geometries;
  decor uses `InstancedMesh` for repeated pylons, rails and background rings.
- Ambient particles: one `THREE.Points` with a custom shader (size attenuation, soft disc,
  slow drift). Bursts: pooled `Points` buffers updated on CPU (≤ 2k particles).

## 7. State Machine

```
LOADING → MENU → PLAYING ⇄ PAUSED
                  PLAYING → STAGE_COMPLETE → TRANSITION → PLAYING (next stage)
                  PLAYING → GAME_COMPLETE → MENU
```

Input is routed by state: pointer lock and gameplay keys only in `PLAYING`; `Escape` toggles
`PAUSED`; menus receive clicks only when visible.

## 8. Testing Hooks

`window.__THREE_GAME_TEST_HOOKS__`:
`seed(n)`, `setState(name)` for `menu`, `active-play`, `stage-1`…`stage-5`, `complete`;
`setPausedForScreenshot(bool)`, `setReducedMotion(bool)`, `hideDebugUi(bool)`,
plus gameplay helpers for Playwright: `teleportPlayer(x,y,z)`, `grantEnergy(n)`,
`getState()`, `triggerAction(name)`, `setBotIntent(x,z,jump,hold)`, `getPlatforms()`.

`window.__THREE_GAME_DIAGNOSTICS__`: frame, elapsed, state, stage, energy, player position/
velocity/grounded/gravity, checkpoint index, renderer counts, canvas size/DPR.

## 8b. Static batching and level validation

- `world/StaticBatcher.ts` merges every mesh of static platforms (except their per-platform trim
  strip, which flickers) and all set dressing into one mesh per material. Dynamic platforms stay
  separate; their four corner clamps are merged per platform. Stage 4, the heaviest stage, sits
  under the 300 draw-call budget.
- `stages/StageValidation.ts` (dev only) walks consecutive platforms and classifies each leg as
  walk / single / double / teleport / UNREACHABLE from the real movement constants, logging to the
  console when a stage loads.
- `scripts/bot-playtest.mjs` drives the player through every stage with world-space intents
  (`setBotIntent` hook), predicting landings from live velocity; `scripts/gravity-check.mjs`
  covers gravity zones, teleporters, rotating platforms and hazards.

## 9. Disposal

Every stage build returns a `StageInstance` with `dispose()` that removes objects from the
scene, disposes geometries/materials not owned by the shared library, clears colliders, trigger
lists, and timers. Switching stages never leaks.

## 10. Asset Replacement Path

- `PlayerModel.ts` → replace factory body with `GLTFLoader` result; keep the collision proxy.
- `Platforms.ts` / `Decor.ts` factories → load GLB kits and keep the `Collider` contract.
- `AudioManager.play(id)` → `Synth` recipes map 1:1 to ids; swap to decoded buffers later.
