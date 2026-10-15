import type { StageDefinition } from './StageTypes';

/**
 * STAGE 1 — AWAKENING. Teaches walking, jumping, double jumping, energy, checkpoints, portal.
 * Jump budget: single ≤ 4 units edge-to-edge, double ≤ 8.
 */
export const STAGE_1: StageDefinition = {
  id: 1,
  name: 'AWAKENING',
  subtitle: 'The system stirs.',
  theme: {
    background: 0x05070f,
    fogColor: 0x070b18,
    fogNear: 40,
    fogFar: 190,
    skyTop: 0x0b1434,
    skyHorizon: 0x04060e,
    accent: 0x19e6ff,
    accentSecondary: 0x3c7bff,
    keyLight: 0xbfd8ff,
    fillLight: 0x4a6aa8,
    ambientParticleColor: 0x19e6ff,
    musicIntensity: 0.2,
  },
  spawn: [0, 0, 1.5],
  spawnYaw: Math.PI,
  bounds: { min: [-60, -24, -130], max: [60, 40, 30] },
  energyRequired: 8,
  hints: ['WASD  MOVE', 'MOUSE  LOOK', 'SPACE  JUMP · DOUBLE JUMP'],
  platforms: [
    { id: 'start', pos: [0, 0, 0], size: [8, 1.2, 8], style: 'light' },
    { pos: [0, 0.5, -8.5], size: [5, 1, 5] },
    { pos: [3, 1, -15], size: [5, 1, 5] },
    { pos: [3, 1.5, -22], size: [4, 1, 4] },
    // Optional side platform with a bonus orb.
    { pos: [-3.5, 2.2, -22], size: [3, 0.8, 3], style: 'dark' },
    // Double-jump gap (6.5 units + 1 up: single jump cannot make it).
    { pos: [0, 2.5, -33], size: [5, 1, 5] },
    // Orb staircase.
    { pos: [-4, 3.5, -38.5], size: [3, 0.8, 3] },
    { pos: [-7, 4, -42], size: [3, 0.8, 3] },
    { pos: [-7, 5, -48], size: [3, 0.8, 3] },
    // Checkpoint plaza.
    { id: 'cp1', pos: [-3, 5, -55], size: [7, 1.2, 7], style: 'light' },
    // Descent.
    { pos: [3, 3.5, -61], size: [4, 1, 4] },
    { pos: [8, 2, -66], size: [4, 1, 4] },
    // Activator plaza + bridge.
    { id: 'plaza', pos: [12, 2, -74], size: [9, 1.2, 9], style: 'light' },
    { pos: [12, 2, -81.5], size: [3, 0.6, 4], group: 'bridge1' },
    { pos: [12, 2, -87], size: [3, 0.6, 4], group: 'bridge1' },
    { pos: [12, 2, -92.5], size: [3, 0.6, 4], group: 'bridge1' },
    // Portal plaza.
    { id: 'portal-plaza', pos: [12, 2, -101], size: [10, 1.4, 10], style: 'core' },
  ],
  orbs: [
    [0, 1.6, -8.5],
    [3, 2.1, -15],
    [3, 2.6, -22],
    [-3.5, 3.3, -22],
    [1.5, 4.4, -27.5],
    [0, 3.6, -33],
    [-4, 4.6, -38.5],
    [-7, 5.1, -42],
    [-7, 6.1, -48],
    [3, 4.6, -61],
  ],
  checkpoints: [{ pos: [-3, 5, -55] }],
  activators: [{ pos: [12, 2, -77], group: 'bridge1', cost: 8 }],
  decor: [
    { kind: 'holoPanel', pos: [-3.2, 1.6, -2.5], rot: [0, 35, 0], scale: 1.2 },
    { kind: 'pylon', pos: [4.2, 0, 3.2] },
    { kind: 'pylon', pos: [-4.2, 0, 3.2] },
    { kind: 'pylon', pos: [6.5, 1, -15] },
    { kind: 'conduit', pos: [0, -2, -20], rot: [0, 0, 0], scale: [0.4, 0.4, 60] },
    { kind: 'cubeCluster', pos: [-14, 6, -30], scale: 1.4 },
    { kind: 'cubeCluster', pos: [16, 4, -50], scale: 1.1 },
    { kind: 'ring', pos: [-30, 20, -90], scale: 26, rot: [20, 30, 0] },
    { kind: 'tower', pos: [28, -10, -40], scale: [6, 40, 6] },
    { kind: 'tower', pos: [-26, -14, -70], scale: [8, 56, 8] },
    { kind: 'monolith', pos: [20, 2, -101], scale: 1.4 },
    { kind: 'monolith', pos: [4, 2, -101], scale: 1.4 },
    { kind: 'arch', pos: [12, 2, -107], rot: [0, 0, 0], scale: 1.3 },
    { kind: 'rail', pos: [12, 1.5, -87], scale: [0.1, 0.1, 20] },
  ],
  portal: { pos: [12, 2, -104], yaw: 180 },
};
