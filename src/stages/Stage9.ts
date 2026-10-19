import type { StageDefinition } from './StageTypes';

/**
 * STAGE 9 — FINAL ASSAULT.
 * Citadel Outer Bastion: Crimson tempest sky, combined-arms battalion warfare,
 * elite officer variants across all classes, and 9 waves of escalating combat
 * leading directly into the Warlord's Throne.
 */
export const STAGE_9: StageDefinition = {
  id: 9,
  name: 'FINAL ASSAULT',
  subtitle: 'The full robotic army defends the Citadel. Break through their final line.',
  finale: false,
  theme: {
    background: 0x080103,
    fogColor: 0x160306,
    fogNear: 50,
    fogFar: 260,
    skyTop: 0x220208,
    skyHorizon: 0x0c0104,
    accent: 0xff1122,
    accentSecondary: 0xffaa00,
    keyLight: 0xff2233,
    fillLight: 0x30050c,
    ambientParticleColor: 0xff3344,
    musicIntensity: 1.0,
    instability: 0.25,
  },
  spawn: [0, 0, 62],
  spawnYaw: Math.PI,
  bounds: { min: [-100, -25, -140], max: [100, 80, 100] },
  energyRequired: 0,
  hints: [
    'FULL HOSTILE BATTALION ENGAGED',
    'COMBINE SWORD, SHIELD, AND COMPANIONS',
    'FOCUS DOWN ELITE OFFICERS FIRST',
    'BREACH THE BASTION TO REACH THE WARLORD',
  ],
  platforms: [
    // Outer Trench Staging Area (South, Z: +30 to +90)
    { id: 's9-south-floor', pos: [0, -0.6, 62], size: [84, 1.2, 58], style: 'dark' },
    { id: 's9-wall-s', pos: [0, 6, 91], size: [84, 14, 2], style: 'dark' },
    { id: 's9-wall-sw', pos: [-42, 6, 62], size: [2, 14, 58], style: 'dark' },
    { id: 's9-wall-se', pos: [42, 6, 62], size: [2, 14, 58], style: 'dark' },

    // Trench Ramparts & Bunkers
    { id: 's9-bunker-w', pos: [-22, 1.2, 55], size: [14, 2.4, 14], style: 'dark' },
    { id: 's9-bunker-e', pos: [22, 1.2, 55], size: [14, 2.4, 14], style: 'dark' },
    { id: 's9-start-dais', pos: [0, 0.2, 62], size: [20, 0.8, 20], style: 'dark' },

    // Middle Fortified Causeway & Trenches (Z: -25 to +30)
    { id: 's9-mid-causeway', pos: [0, -0.6, 2], size: [48, 1.2, 56], style: 'dark' },
    { id: 's9-causeway-wall-w', pos: [-24, 6, 2], size: [2, 14, 56], style: 'dark' },
    { id: 's9-causeway-wall-e', pos: [24, 6, 2], size: [2, 14, 56], style: 'dark' },

    // High Watchtower Slabs in Causeway
    { id: 's9-tower-slab-w', pos: [-16, 3.5, 2], size: [6, 7.0, 6], style: 'dark' },
    { id: 's9-tower-slab-e', pos: [16, 3.5, 2], size: [6, 7.0, 6], style: 'dark' },

    // Transversal Defense Barriers
    { id: 's9-barrier-1', pos: [-8, 0.8, 18], size: [12, 1.6, 2], style: 'dark' },
    { id: 's9-barrier-2', pos: [8, 0.8, -12], size: [12, 1.6, 2], style: 'dark' },

    // Grand Bastion Promenade & Throne Approach (North, Z: -25 to -125)
    { id: 's9-north-floor', pos: [0, -0.6, -75], size: [96, 1.2, 100], style: 'dark' },
    { id: 's9-wall-n', pos: [0, 8, -125], size: [96, 18, 2], style: 'dark' },
    { id: 's9-wall-nw', pos: [-48, 8, -75], size: [2, 18, 100], style: 'dark' },
    { id: 's9-wall-ne', pos: [48, 8, -75], size: [2, 18, 100], style: 'dark' },

    // Bastion Grand Central Platform
    { id: 's9-bastion-dais', pos: [0, 0.8, -75], size: [28, 1.6, 28], style: 'core' },
    { id: 's9-dais-top', pos: [0, 1.6, -75], size: [16, 0.8, 16], style: 'core' },

    // Colossal Bastion Spires / Pillars
    { id: 's9-bastion-nw', pos: [-34, 3.5, -105], size: [14, 7.0, 14], style: 'dark' },
    { id: 's9-bastion-ne', pos: [34, 3.5, -105], size: [14, 7.0, 14], style: 'dark' },
    { id: 's9-bastion-sw', pos: [-34, 3.5, -45], size: [14, 7.0, 14], style: 'dark' },
    { id: 's9-bastion-se', pos: [34, 3.5, -45], size: [14, 7.0, 14], style: 'dark' },
  ],
  checkpoints: [],
  orbs: [],
  decor: [
    // Citadel Sky Spire Fortresses
    { kind: 'tower', pos: [-90, -10, 80], scale: [24, 140, 24] },
    { kind: 'tower', pos: [90, -10, 80], scale: [24, 140, 24] },
    { kind: 'tower', pos: [-92, -10, -120], scale: [26, 150, 26] },
    { kind: 'tower', pos: [92, -10, -120], scale: [26, 150, 26] },
    { kind: 'tower', pos: [0, -10, -135], scale: [32, 160, 32] },

    // Monoliths framing the Bastion
    { kind: 'monolith', pos: [-38, 0, 62], scale: 3.4 },
    { kind: 'monolith', pos: [38, 0, 62], scale: 3.4 },
    { kind: 'monolith', pos: [-42, 0, -75], scale: 3.8 },
    { kind: 'monolith', pos: [42, 0, -75], scale: 3.8 },

    // Heavy Industrial Arches
    { kind: 'arch', pos: [0, 0, 30] },
    { kind: 'arch', pos: [0, 0, -25] },
    { kind: 'arch', pos: [0, 0, -118] },

    // Plasma Conduits
    { kind: 'conduit', pos: [0, 6.0, 90], scale: [0.7, 0.7, 80], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [0, 7.0, -124], scale: [0.7, 0.7, 92], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [-47, 7.0, -75], scale: [0.7, 0.7, 96], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [47, 7.0, -75], scale: [0.7, 0.7, 96], rot: [0, 0, 0] },

    // Floating War Debris
    { kind: 'cubeCluster', pos: [-24, 22, 62], scale: 3.0 },
    { kind: 'cubeCluster', pos: [24, 22, 62], scale: 3.0 },
    { kind: 'cubeCluster', pos: [0, 25, -75], scale: 3.5 },
  ],
  portal: { pos: [0, 0, -115], yaw: 180 },
};
