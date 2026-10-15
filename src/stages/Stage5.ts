import type { StageDefinition, PlatformDef } from './StageTypes';
import type { Vec3Tuple } from '../utils/MathUtils';

/** Ring of six small platforms around the final energy circle. */
const RING_CENTER: Vec3Tuple = [20, 15.5, -112];
const RING_RADIUS = 5;
const ringPlatforms: PlatformDef[] = [];
const ringOrbs: Vec3Tuple[] = [];
for (let i = 0; i < 6; i += 1) {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
  const x = RING_CENTER[0] + Math.cos(a) * RING_RADIUS;
  const z = RING_CENTER[2] + Math.sin(a) * RING_RADIUS;
  const y = RING_CENTER[1] + (i % 2) * 1;
  ringPlatforms.push({ pos: [x, y, z], size: [3, 0.6, 3], style: 'core' });
  ringOrbs.push([x, y + 1.1, z]);
}

/**
 * STAGE 5 — THE CORE. Synthesis of every mechanic, ending in the Core chamber.
 */
export const STAGE_5: StageDefinition = {
  id: 5,
  name: 'THE CORE',
  subtitle: 'Bring the system back online.',
  finale: true,
  theme: {
    background: 0x03040c,
    fogColor: 0x050814,
    fogNear: 40,
    fogFar: 220,
    skyTop: 0x101a3a,
    skyHorizon: 0x02030a,
    accent: 0x19e6ff,
    accentSecondary: 0x4fa8e8,
    keyLight: 0xdde8ff,
    fillLight: 0x3a4a7a,
    ambientParticleColor: 0x9fd8ff,
    musicIntensity: 0.9,
  },
  spawn: [0, 0, 2],
  spawnYaw: Math.PI,
  bounds: { min: [-40, -32, -160], max: [60, 70, 20] },
  energyRequired: 14,
  hints: ['REACH THE CORE'],
  platforms: [
    { id: 'start', pos: [0, 0, 0], size: [8, 1.2, 8], style: 'core' },
    { kind: 'moving', pos: [0, 0, -8], size: [3, 0.6, 3], motion: { to: [0, 6, -20], duration: 3.5, pauseAtEnds: 0.8 } },
    { id: 'cp1', pos: [0, 6, -26], size: [5, 1, 5], style: 'light' },
    // Sideways gravity wall: deck faces +X at x = -6, spans y 3..17, z -43..-23 (covers cp1).
    { id: 'wall', pos: [-6, 10, -33], size: [14, 1, 20], rot: [0, 0, -90], style: 'core' },
    { id: 'cp2', pos: [-6, 1, -49], size: [10, 1.2, 12], style: 'light' },
    // Teleport destination island.
    { id: 'island', pos: [20, 8, -60], size: [6, 1, 6], style: 'light' },
    // Crumble + blink gauntlet.
    { kind: 'crumble', pos: [20, 8, -66], size: [3, 0.6, 3], style: 'hazard' },
    { pos: [20, 8.5, -71], size: [3, 0.8, 3], style: 'core' },
    { kind: 'blink', pos: [20, 9, -76], size: [3, 0.6, 3], blink: { on: 2.0, off: 1.0, phase: 0 } },
    { kind: 'blink', pos: [20, 9.5, -81], size: [3, 0.6, 3], blink: { on: 2.0, off: 1.0, phase: 0.33 } },
    { kind: 'crumble', pos: [20, 10, -86], size: [3, 0.6, 3], style: 'hazard' },
    // Rotating hub.
    { pos: [20, 10, -93], size: [2.6, 1, 2.6], style: 'core' },
    { kind: 'rotating', pos: [20, 10, -93], size: [10, 0.6, 1.8], spin: { axis: 'y', speed: 0.5 } },
    { pos: [26, 11, -93], size: [4, 1, 4] },
    { pos: [26, 13, -99], size: [4, 1, 4] },
    { id: 'cp3', pos: [20, 15, -104], size: [5, 1, 5], style: 'light' },
    ...ringPlatforms,
    // Core chamber.
    { id: 'core-plaza', pos: [20, 17, -126], size: [16, 2, 14], style: 'core' },
  ],
  gravityZones: [{ pos: [-7.3, 10, -33], size: [9.4, 20, 20], up: [1, 0, 0], color: 0x19e6ff }],
  teleporters: [
    { id: 'A', pos: [-6, 1, -53], to: 'B', exitYaw: 180 },
    { id: 'B', pos: [20, 8, -58], to: 'A', exitYaw: 180 },
  ],
  orbs: [
    [0, 4, -15],
    [0, 7.1, -24],
    [-5, 7, -32],
    [-5, 12, -36],
    [-5, 9, -40],
    [-6, 2.1, -47],
    [20, 9.1, -61],
    [20, 9.1, -66],
    [20, 9.6, -71],
    [20, 10.6, -81],
    [15, 11.5, -93],
    [26, 14.1, -99],
    ...ringOrbs,
  ],
  checkpoints: [{ pos: [0, 6, -26] }, { pos: [-6, 1, -50] }, { pos: [20, 15, -104] }],
  decor: [
    { kind: 'core', pos: [20, 17, -140], scale: 1 },
    { kind: 'monolith', pos: [12, 17, -126], scale: 1.8 },
    { kind: 'monolith', pos: [28, 17, -126], scale: 1.8 },
    { kind: 'conduit', pos: [20, 15, -100], scale: [0.6, 0.6, 80] },
    { kind: 'conduit', pos: [-9, -6, -30], scale: [0.5, 0.5, 60] },
    { kind: 'conduit', pos: [20, 6, -70], scale: [0.5, 0.5, 60] },
    { kind: 'rail', pos: [-7.2, 10, -33], scale: [0.14, 14, 0.14] },
    { kind: 'ring', pos: [20, 30, -140], scale: 20, rot: [90, 0, 0] },
    { kind: 'ring', pos: [20, 30, -140], scale: 26, rot: [70, 0, 30] },
    { kind: 'ring', pos: [20, 30, -140], scale: 32, rot: [110, 0, -30] },
    { kind: 'tower', pos: [-20, -10, -40], scale: [8, 60, 8] },
    { kind: 'tower', pos: [40, -12, -80], scale: [10, 70, 10] },
    { kind: 'tower', pos: [-14, -8, -120], scale: [9, 66, 9] },
    { kind: 'tower', pos: [48, -6, -130], scale: [12, 80, 12] },
    { kind: 'cubeCluster', pos: [8, 12, -50], scale: 1.5 },
    { kind: 'cubeCluster', pos: [32, 20, -110], scale: 1.6 },
    { kind: 'pylon', pos: [3.5, 0, 3.5] },
    { kind: 'pylon', pos: [-3.5, 0, 3.5] },
    { kind: 'pylon', pos: [-10, 1, -45] },
    { kind: 'pylon', pos: [-2, 1, -45] },
    { kind: 'holoPanel', pos: [-3, 1.8, -2.5], rot: [0, 35, 0], scale: 1.2 },
    { kind: 'holoPanel', pos: [23, 9.3, -60], rot: [0, -70, 0] },
  ],
  portal: { pos: [20, 17, -129], yaw: 180 },
};
