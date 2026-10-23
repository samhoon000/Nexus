import type { StageDefinition } from './StageTypes';

/**
 * STAGE 6 — THE AWAKENING.
 * A 3-section combat & platforming level with sequential nanotechnology robot encounters:
 *   Section 1: Initial arrival dais encounter — 2 hostile robots materialize from nanotech
 *   Section 2: Mid-level ledge encounter — 2 hostile sentinels across the void
 *   Section 3: Reactor Sanctum encounter — 2 heavy guardians
 */
export const STAGE_6_SECTION_1_SPAWNS: Array<[number, number, number]> = [
  [-3.8, 1.2, 2.5],
  [3.8, 1.2, 2.5],
];

export const STAGE_6_SECTION_2_SPAWNS: Array<[number, number, number]> = [
  [10, 6.0, -36],
  [18, 6.0, -36],
];

export const STAGE_6_SECTION_3_SPAWNS: Array<[number, number, number]> = [
  [-5.5, 2.0, -126],
  [5.5, 2.0, -126],
];

export const STAGE_6_ROBOT_A: [number, number, number] = STAGE_6_SECTION_1_SPAWNS[0];
export const STAGE_6_ROBOT_B: [number, number, number] = STAGE_6_SECTION_3_SPAWNS[0];

export const STAGE_6: StageDefinition = {
  id: 6,
  name: 'THE AWAKENING',
  subtitle: 'The Fallen Legion stirs beneath the battlefield. Move fast. Fight smart.',
  finale: false,
  theme: {
    background: 0x020408,
    fogColor: 0x050a0c,
    fogNear: 44,
    fogFar: 220,
    skyTop: 0x040c14,
    skyHorizon: 0x020608,
    accent: 0xff2200,
    accentSecondary: 0x00f0ff,
    keyLight: 0xff4422,
    fillLight: 0x061820,
    ambientParticleColor: 0xff3311,
    musicIntensity: 0.95,
  },
  // Player spawns at the starting dais, facing forward (toward negative Z)
  spawn: [0, 1.2, 9],
  spawnYaw: Math.PI,
  bounds: { min: [-50, -22, -155], max: [50, 60, 25] },
  energyRequired: 0,
  hints: [
    'LMB / F: SWORD STRIKE  ·  HOLD LMB / F: POWER ATTACK',
    'HOLD RMB / Q: ENERGY SHIELD  ·  SHIFT / C: DODGE',
    '[ E ]: REBOOT DEFEATED ROBOTS AS ALLIES',
    'EXIT PORTAL AT THE FAR END OF THE SANCTUM',
  ],

  platforms: [
    // =========================================================================
    // SECTION 1: Arrival Dais — Wide combat platform where Section 1 materializes
    // =========================================================================
    { id: 'start', pos: [0, 1.2, 5], size: [16, 1.2, 16], style: 'dark' },

    // Narrow hop-1: gap of ~4 units
    { pos: [-2, 1.6, -3], size: [4, 0.8, 4], style: 'dark' },
    // Narrow hop-2: slight rise, offset
    { pos: [3, 2.0, -9], size: [3.5, 0.8, 3.5] },
    // Narrow hop-3: a bit further, bigger gap
    { pos: [0, 2.4, -16], size: [3.5, 0.8, 3.5] },

    // Moving shuttle A: carries the player from z=-19 to z=-28 (teaches moving platforms)
    {
      kind: 'moving',
      pos: [0, 2.8, -19],
      size: [3.5, 0.7, 3.5],
      motion: { to: [0, 2.8, -28], duration: 2.8, pauseAtEnds: 0.6 },
    },

    // Wider landing after shuttle, acts as a breath area before first encounter
    { id: 'ledge-a', pos: [0, 3.2, -33], size: [14, 1.2, 8], style: 'dark' },

    // =========================================================================
    // SECTION 2: Mid-Level Ledge — Elevated encounter arena [14, 6, -36]
    // =========================================================================
    // Step up to encounter platform via a narrow bridge
    { pos: [6, 4.0, -36], size: [3.5, 0.8, 3.5] },
    // Encounter platform: Section 2 robots materialize here
    { id: 'ledge-b', pos: [14, 6.0, -36], size: [16, 1.2, 16], style: 'dark' },
    // Step pillar up
    { pos: [8, 5.0, -36], size: [3, 0.8, 3] },

    // =========================================================================
    // Checkpoint 1 — after Section 1 & before Section 2
    // Small safe platform, obvious checkpoint beacon
    { id: 'cp1', pos: [0, 6.0, -50], size: [7, 1.2, 7], style: 'light' },
    // Bridge from ledge-b back toward center
    { pos: [7, 6.0, -43], size: [3.5, 0.8, 3.5] },
    { pos: [3, 6.0, -47], size: [3, 0.8, 3] },

    // =========================================================================
    // SECTION C: Advanced traversal — lifts, blink, rotating hub, beams
    // =========================================================================
    // Fast vertical lift: goes from y=6 up to y=14
    {
      kind: 'moving',
      pos: [0, 6, -57],
      size: [3.5, 0.7, 3.5],
      motion: { to: [0, 13, -57], duration: 3.2, pauseAtEnds: 1.0 },
    },

    // Upper platform after vertical lift
    { id: 'upper-a', pos: [0, 13.5, -63], size: [6, 1.2, 6], style: 'dark' },

    // Crumble sequence: must sprint across before they fall
    { kind: 'crumble', pos: [-4, 13.5, -69], size: [3, 0.7, 3], style: 'hazard' },
    { kind: 'crumble', pos: [0, 13.5, -74], size: [3, 0.7, 3], style: 'hazard' },
    { kind: 'crumble', pos: [4, 13.5, -79], size: [3, 0.7, 3], style: 'hazard' },

    // Safe landing after crumble gauntlet
    { id: 'upper-b', pos: [0, 13.5, -85], size: [6, 1.2, 6] },

    // Rotating hub — must jump on the arm and ride to the far platform
    { pos: [0, 13.5, -90], size: [2.6, 1, 2.6], style: 'core' },
    {
      kind: 'rotating',
      pos: [0, 13.5, -90],
      size: [10, 0.6, 1.8],
      spin: { axis: 'y', speed: 0.52 },
    },

    // Blink platforms after rotating hub
    { kind: 'blink', pos: [0, 12.0, -97], size: [3, 0.6, 3], blink: { on: 2.0, off: 1.0, phase: 0 } },
    { kind: 'blink', pos: [0, 11.5, -103], size: [3, 0.6, 3], blink: { on: 2.0, off: 1.0, phase: 0.38 } },

    // Descent platform — drops down to the sanctum level
    { pos: [0, 8.0, -107], size: [5, 1, 5] },

    // Horizontal moving platform: bridges the last gap before sanctum
    {
      kind: 'moving',
      pos: [0, 4.0, -112],
      size: [4, 0.7, 4],
      motion: { to: [10, 4.0, -112], duration: 2.5, pauseAtEnds: 0.5 },
    },

    // =========================================================================
    // SECTION 3: Reactor Sanctum — Final Robot Encounter + Exit Gateway
    // =========================================================================
    // Wide sanctum floor where Section 3 robots spawn
    { id: 'sanctum-floor', pos: [0, 2.0, -122], size: [24, 1.2, 24], style: 'dark' },

    // Sanctum perimeter cover slabs (tactical use during heavy fight)
    { id: 'cover-w', pos: [-8, 2.6, -118], size: [3, 1.2, 3], style: 'dark' },
    { id: 'cover-e', pos: [8, 2.6, -118], size: [3, 1.2, 3], style: 'dark' },
    { id: 'cover-n', pos: [0, 2.6, -130], size: [3, 1.2, 3], style: 'dark' },

    // Sanctum terminus dais for the far-end exit portal.
    { id: 'portal-plaza', pos: [0, 2.2, -139], size: [10, 1.4, 10], style: 'core' },
  ],

  hazards: [
    // Beam corridor in section C — two alternating beams between crumble and hub
    { kind: 'beam', pos: [0, 14.2, -82], size: [7, 0.3, 0.3], cycle: { on: 1.8, off: 1.2, phase: 0 } },
    { kind: 'beam', pos: [0, 14.2, -88], size: [7, 0.3, 0.3], cycle: { on: 1.8, off: 1.2, phase: 0.5 } },
    // Wall beam flanking the sanctum entrance
    { kind: 'beam', pos: [-9, 4.5, -112], size: [0.3, 5, 0.3] },
    { kind: 'beam', pos: [9, 4.5, -112], size: [0.3, 5, 0.3] },
  ],

  checkpoints: [
    { id: 'stage6-checkpoint-1', pos: [0, 6.0, -50], facing: [0, 0, -1] }, // After first encounter / Section 1
    { id: 'stage6-checkpoint-2', pos: [0, 8.0, -107], facing: [0, 0, -1] }, // Descent platform before Sanctum / Section 3
  ],

  orbs: [
    // Section A — breadcrumb trail for direction
    [-2, 2.8, -3],
    [3, 3.2, -9],
    [0, 3.6, -16],
    // Section B
    [6, 5.2, -36],
    [14, 7.2, -36],
    // Post-checkpoint
    [0, 7.2, -50],
    [3, 7.2, -47],
    // Section C
    [0, 14.5, -63],
    [0, 14.8, -74],
    [0, 14.8, -85],
    [0, 9.2, -107],
    // Sanctum
    [0, 3.4, -122],
    [-6, 3.4, -126],
    [6, 3.4, -126],
  ],

  decor: [
    // Backdrop towers
    { kind: 'tower', pos: [-38, -10, -60], scale: [10, 70, 10] },
    { kind: 'tower', pos: [38, -10, -80], scale: [12, 88, 12] },
    { kind: 'tower', pos: [-38, -10, -120], scale: [14, 96, 14] },
    { kind: 'tower', pos: [38, -10, -120], scale: [14, 96, 14] },
    { kind: 'tower', pos: [0, -10, -148], scale: [18, 110, 18] },

    // Monoliths marking robot encounter zones
    { kind: 'monolith', pos: [22, 6, -36], scale: 2.2 },
    { kind: 'monolith', pos: [-10, 2, -122], scale: 2.8 },
    { kind: 'monolith', pos: [10, 2, -122], scale: 2.8 },

    // Conduit spine through the level
    { kind: 'conduit', pos: [0, -4, -70], scale: [0.5, 0.5, 120] },

    // Pylons marking safe platforms
    { kind: 'pylon', pos: [3, 1.5, 6] },
    { kind: 'pylon', pos: [-3, 1.5, 6] },
    { kind: 'pylon', pos: [0, 6.5, -50] },
    { kind: 'pylon', pos: [-3, 6.5, -50] },
    { kind: 'pylon', pos: [3, 6.5, -50] },
    { kind: 'pylon', pos: [-9, 2.5, -122] },
    { kind: 'pylon', pos: [9, 2.5, -122] },

    // HoloPanel tutorial hint near start
    { kind: 'holoPanel', pos: [-5, 1.8, 4], rot: [0, 45, 0], scale: 1.2 },
    // HoloPanel hint near checkpoint
    { kind: 'holoPanel', pos: [-4, 7.2, -50], rot: [0, 30, 0], scale: 1.0 },

    // Archway framing the sanctum entrance
    { kind: 'arch', pos: [0, 2, -112], rot: [0, 0, 0], scale: 1.3 },

    // Rings orbiting the sanctum
    { kind: 'ring', pos: [0, 24, -122], scale: 22, rot: [90, 0, 0] },
    { kind: 'ring', pos: [0, 24, -122], scale: 28, rot: [70, 0, 30] },

    // Debris clusters
    { kind: 'cubeCluster', pos: [-14, 8, -36], scale: 1.6 },
    { kind: 'cubeCluster', pos: [18, 18, -90], scale: 1.4 },
    { kind: 'cubeCluster', pos: [12, 6, -122], scale: 2.0 },

    // Rail guardrails along moving shuttle
    { kind: 'rail', pos: [-2, 3.4, -23], scale: [0.1, 0.1, 18] },
    { kind: 'rail', pos: [2, 3.4, -23], scale: [0.1, 0.1, 18] },
  ],

  // Safe, solid terminus plaza beyond the final encounter; independent of combat progress.
  portal: { pos: [0, 2.2, -139], yaw: 180 },
};
