import type { StageDefinition } from './StageTypes';

/**
 * STAGE 8 — ADVANCED COMBAT ZONE.
 * Neon Cyber Ruins: Deep violet and magenta lighting, multi-tiered skybridges,
 * hyper-agile dual-blade Assassin robots, and 8 waves of tactical warfare.
 */
export const STAGE_8: StageDefinition = {
  id: 8,
  name: 'ADVANCED COMBAT ZONE',
  subtitle: 'Elite Assassin units active. Beware of high-speed flank maneuvers.',
  finale: false,
  theme: {
    background: 0x04020a,
    fogColor: 0x090518,
    fogNear: 50,
    fogFar: 250,
    skyTop: 0x14062a,
    skyHorizon: 0x06020f,
    accent: 0xff0088,
    accentSecondary: 0x00f0ff,
    keyLight: 0xff22aa,
    fillLight: 0x100828,
    ambientParticleColor: 0xdd11aa,
    musicIntensity: 0.98,
  },
  spawn: [0, 0, 50],
  spawnYaw: Math.PI,
  bounds: { min: [-95, -25, -125], max: [95, 75, 85] },
  energyRequired: 0,
  hints: [
    'NEW ENEMY: DUAL-BLADE ASSASSINS',
    'EXTREME AGILITY AND FLANK DASHES',
    'TIME YOUR BLOCKS AND COUNTER-STRIKES',
    'USE ELEVATED SKYBRIDGES FOR ADVANTAGE',
  ],
  platforms: [
    // Southern Neon Plaza (Z: +25 to +75)
    { id: 's8-south-floor', pos: [0, -0.6, 50], size: [76, 1.2, 50], style: 'violet' },
    { id: 's8-wall-s', pos: [0, 5, 75], size: [76, 12, 2], style: 'violet' },
    { id: 's8-wall-sw', pos: [-38, 5, 50], size: [2, 12, 50], style: 'violet' },
    { id: 's8-wall-se', pos: [38, 5, 50], size: [2, 12, 50], style: 'violet' },

    // Plaza Center Ring
    { id: 's8-plaza-ring', pos: [0, 0.2, 50], size: [18, 0.8, 18], style: 'violet' },

    // Tactical Low Slabs
    { id: 's8-slab-sw', pos: [-18, 1.0, 42], size: [8, 2.0, 8], style: 'violet' },
    { id: 's8-slab-se', pos: [18, 1.0, 42], size: [8, 2.0, 8], style: 'violet' },

    // Central Multi-Tier Skybridge Array (Z: -25 to +25)
    { id: 's8-ground-channel', pos: [0, -0.6, 0], size: [36, 1.2, 50], style: 'dark' },

    // High Skybridges (Y = 4.0m)
    { id: 's8-skybridge-w', pos: [-24, 3.5, 0], size: [12, 1.2, 50], style: 'violet' },
    { id: 's8-skybridge-e', pos: [24, 3.5, 0], size: [12, 1.2, 50], style: 'violet' },
    { id: 's8-cross-bridge', pos: [0, 3.5, 0], size: [36, 1.2, 10], style: 'violet' },

    // Skybridge Access Ramps
    { id: 's8-ramp-sw', pos: [-24, 1.5, 20], size: [8, 0.8, 14], style: 'violet' },
    { id: 's8-ramp-se', pos: [24, 1.5, 20], size: [8, 0.8, 14], style: 'violet' },

    // Northern Citadel Promenade (Z: -25 to -115)
    { id: 's8-north-floor', pos: [0, -0.6, -70], size: [88, 1.2, 90], style: 'violet' },
    { id: 's8-wall-n', pos: [0, 6, -115], size: [88, 14, 2], style: 'violet' },
    { id: 's8-wall-nw', pos: [-44, 6, -70], size: [2, 14, 90], style: 'violet' },
    { id: 's8-wall-ne', pos: [44, 6, -70], size: [2, 14, 90], style: 'violet' },

    // Promenade Raised Platforms & Cover
    { id: 's8-promenade-dais', pos: [0, 0.6, -70], size: [24, 1.2, 24], style: 'core' },
    { id: 's8-bastion-nw', pos: [-32, 2.8, -95], size: [14, 5.5, 14], style: 'violet' },
    { id: 's8-bastion-ne', pos: [32, 2.8, -95], size: [14, 5.5, 14], style: 'violet' },
    { id: 's8-bastion-sw', pos: [-32, 2.8, -45], size: [14, 5.5, 14], style: 'violet' },
    { id: 's8-bastion-se', pos: [32, 2.8, -45], size: [14, 5.5, 14], style: 'violet' },
  ],
  checkpoints: [],
  orbs: [],
  decor: [
    // Neon Metropolis Spires
    { kind: 'tower', pos: [-80, -10, 70], scale: [20, 130, 20] },
    { kind: 'tower', pos: [80, -10, 70], scale: [20, 130, 20] },
    { kind: 'tower', pos: [-84, -10, -110], scale: [24, 145, 24] },
    { kind: 'tower', pos: [84, -10, -110], scale: [24, 145, 24] },
    { kind: 'tower', pos: [0, -10, -125], scale: [28, 150, 28] },

    // Glowing Hologram Panels
    { kind: 'holoPanel', pos: [-24, 5.5, 10], scale: 1.8 },
    { kind: 'holoPanel', pos: [24, 5.5, 10], scale: 1.8 },
    { kind: 'holoPanel', pos: [-32, 6.0, -70], scale: 2.2 },
    { kind: 'holoPanel', pos: [32, 6.0, -70], scale: 2.2 },

    // Industrial Arches
    { kind: 'arch', pos: [0, 0, 25] },
    { kind: 'arch', pos: [0, 0, -25] },
    { kind: 'arch', pos: [0, 0, -108] },

    // Conduits
    { kind: 'conduit', pos: [0, 5.0, 74], scale: [0.6, 0.6, 72], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [0, 6.0, -114], scale: [0.6, 0.6, 84], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [-43, 6.0, -70], scale: [0.6, 0.6, 86], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [43, 6.0, -70], scale: [0.6, 0.6, 86], rot: [0, 0, 0] },

    // Debris Clusters
    { kind: 'cubeCluster', pos: [-20, 18, 0], scale: 2.5 },
    { kind: 'cubeCluster', pos: [20, 18, 0], scale: 2.5 },
    { kind: 'cubeCluster', pos: [0, 22, -70], scale: 3.0 },
  ],
  portal: { pos: [0, 0, -105], yaw: 180 },
};
