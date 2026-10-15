import type { StageDefinition } from './StageTypes';

/**
 * STAGE 3 — DISTORTION. Gravity zones (low, sideways, inverted) and teleporters.
 *
 * Gravity notes: a platform rotated (0,0,90) has its deck facing -X (floor for "up = -X"),
 * rotated (0,0,180) faces -Y (ceiling floor for inverted gravity).
 */
export const STAGE_3: StageDefinition = {
  id: 3,
  name: 'DISTORTION',
  subtitle: 'The rules bend here.',
  theme: {
    background: 0x0a0512,
    fogColor: 0x120a24,
    fogNear: 34,
    fogFar: 180,
    skyTop: 0x2a1050,
    skyHorizon: 0x08040f,
    accent: 0xff3fd6,
    accentSecondary: 0x8a5cff,
    keyLight: 0xd8c0ff,
    fillLight: 0x5a3a8a,
    ambientParticleColor: 0xc07cff,
    musicIntensity: 0.58,
  },
  spawn: [0, 0, 2],
  spawnYaw: Math.PI,
  bounds: { min: [-40, -32, -165], max: [72, 60, 20] },
  energyRequired: 10,
  hints: ['GRAVITY FIELDS CHANGE THE RULES', 'STEP INTO THE TELEPORTERS'],
  platforms: [
    { id: 'start', pos: [0, 0, 0], size: [8, 1.2, 8], style: 'violet' },
    // Low-gravity section (zone spans z -6 → -42, past the teleporter platform).
    { pos: [0, 0.5, -10], size: [4, 1, 4], rot: [0, 0, 6], style: 'violet' },
    { pos: [0, 1, -26], size: [4, 1, 4], rot: [0, 0, -6], style: 'violet' },
    { id: 'tp-a', pos: [0, 2, -34], size: [4, 1, 4], style: 'violet' },
    // Floating island with the arrival teleporter.
    { id: 'island', pos: [28, 14, -60], size: [8, 1.2, 8], style: 'light' },
    // Sideways gravity wall: deck faces -X at x = 36, spans y 4..24, z -81..-57 (covers the island).
    { id: 'wall', pos: [36, 14, -69], size: [20, 1, 24], rot: [0, 0, 90], style: 'violet' },
    // Landing pad after the wall (normal gravity).
    { id: 'cp2', pos: [36, 3, -88], size: [10, 1.2, 14], style: 'light' },
    // Inverted-gravity ceiling: deck faces -Y at y = 12, z -114..-94.
    { id: 'ceiling', pos: [36, 12, -104], size: [6, 1, 20], rot: [0, 0, 180], style: 'violet' },
    // Landing pad after the ceiling.
    { id: 'cp3', pos: [36, 2, -120], size: [10, 1.2, 12], style: 'light' },
    // Final plaza.
    { id: 'final', pos: [0, 6, -140], size: [10, 1.4, 10], style: 'core' },
  ],
  gravityZones: [
    { pos: [0, 5, -24], size: [16, 18, 36], scale: 0.38, color: 0xff3fd6 },
    { pos: [37, 14, -68], size: [10, 24, 26], up: [-1, 0, 0], color: 0x8a5cff },
    { pos: [36, 8, -104], size: [12, 14, 18], up: [0, -1, 0], color: 0x8a5cff },
  ],
  teleporters: [
    { id: 'A', pos: [0, 2, -34], to: 'B', exitYaw: 180, color: 0xff3fd6 },
    { id: 'B', pos: [28, 14, -57.5], to: 'A', exitYaw: 180, color: 0xff3fd6 },
    { id: 'C', pos: [36, 2, -123], to: 'D', exitYaw: 180, color: 0xff3fd6 },
    { id: 'D', pos: [0, 6, -136.5], to: 'C', exitYaw: 180, color: 0xff3fd6 },
  ],
  orbs: [
    [0, 1.6, -10],
    [0, 6.5, -16],
    [0, 7.5, -20],
    [0, 2.1, -26],
    [0, 5.5, -30],
    [28, 15.1, -62],
    [34, 15.5, -60],
    [35, 10, -66],
    [35, 16, -72],
    [35, 12, -78],
    [36, 11, -100],
    [36, 11, -106],
    [36, 11, -111],
    [36, 3.1, -118],
  ],
  checkpoints: [{ pos: [28, 14, -62] }, { pos: [36, 3, -90] }, { pos: [36, 2, -118] }],
  decor: [
    { kind: 'holoPanel', pos: [-3.5, 1.6, -2.5], rot: [0, 35, 0], scale: 1.2 },
    { kind: 'cubeCluster', pos: [-9, 5, -18], scale: 1.6, rot: [20, 10, 30] },
    { kind: 'cubeCluster', pos: [9, 9, -30], scale: 1.2, rot: [40, 60, 10] },
    { kind: 'monolith', pos: [-6, 0, -34], rot: [0, 0, 18], scale: 1.4 },
    { kind: 'monolith', pos: [6, 0, -34], rot: [0, 0, -14], scale: 1.4 },
    { kind: 'ring', pos: [20, 30, -70], scale: 22, rot: [60, 0, 30] },
    { kind: 'ring', pos: [-26, 18, -110], scale: 34, rot: [30, 50, 0] },
    { kind: 'tower', pos: [52, -10, -70], scale: [8, 60, 8], rot: [0, 0, 6] },
    { kind: 'tower', pos: [-24, -16, -60], scale: [7, 48, 7], rot: [0, 0, -8] },
    { kind: 'tower', pos: [54, -4, -120], scale: [10, 64, 10], rot: [4, 0, 0] },
    { kind: 'conduit', pos: [37.2, 14, -71], rot: [0, 0, 0], scale: [0.5, 0.5, 70] },
    { kind: 'pylon', pos: [31, 14, -64], rot: [0, 0, 0] },
    { kind: 'pylon', pos: [32, 3, -84] },
    { kind: 'pylon', pos: [40, 3, -84] },
    { kind: 'holoPanel', pos: [41, 5, -90], rot: [0, -60, 0], scale: 1.4 },
    { kind: 'cubeCluster', pos: [46, 18, -104], scale: 1.4, rot: [10, 70, 50] },
    { kind: 'monolith', pos: [-6, 6, -140], rot: [0, 0, 10], scale: 1.6 },
    { kind: 'monolith', pos: [6, 6, -140], rot: [0, 0, -10], scale: 1.6 },
    { kind: 'arch', pos: [0, 6, -146], scale: 1.3 },
  ],
  portal: { pos: [0, 6, -143], yaw: 180 },
};
