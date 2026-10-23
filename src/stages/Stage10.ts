import type { StageDefinition } from './StageTypes';

/**
 * STAGE 10 — THE WARLORD (CAMPAIGN FINALE).
 * The Core Throne Colosseum: A colossal 100m octagonal arena suspended above
 * the pulsating crimson reactor abyss. 8 towering energy spires, perimeter spectator
 * ramparts, central reactor battleground, and the multi-phase showdown against
 * THE WARLORD — Supreme Corrupted Guardian of NEXUS.
 */
export const STAGE_10: StageDefinition = {
  id: 10,
  name: 'THE WARLORD',
  subtitle: 'The supreme corrupted guardian awaits on his throne. End the machine insurrection.',
  finale: true,
  theme: {
    background: 0x050102,
    fogColor: 0x120204,
    fogNear: 55,
    fogFar: 280,
    skyTop: 0x1f0206,
    skyHorizon: 0x0a0103,
    accent: 0xff0011,
    accentSecondary: 0xffbb00,
    keyLight: 0xff1122,
    fillLight: 0x240408,
    ambientParticleColor: 0xff2233,
    musicIntensity: 1.0,
    instability: 0.35,
  },
  spawn: [0, 0, 36],
  spawnYaw: Math.PI,
  bounds: { min: [-90, -30, -95], max: [90, 85, 95] },
  energyRequired: 0,
  hints: [
    'CAMPAIGN FINALE: THE WARLORD',
    'READ TELEGRAPHS TO DODGE MELEE CLEAVES',
    'JUMP OVER EXPANDING GROUND SHOCKWAVES',
    'BLOCK ORDNANCE BARRAGES WITH ENERGY SHIELD',
    'STRIKE HARD DURING STAGGER WINDOWS',
  ],
  platforms: [
    // =========================================================================
    // OCTAGONAL BOSS COLOSSEUM ARENA
    // =========================================================================
    // Main Arena Center Floor (100x100 playable base)
    { id: 's10-arena-main', pos: [0, -0.6, 0], size: [96, 1.2, 96], style: 'core' },

    // Arena Perimeter Enclosure Walls (Octagonal shape formed by 8 wall segments)
    { id: 's10-wall-n', pos: [0, 6, -48], size: [60, 14, 2], style: 'core' },
    { id: 's10-wall-s', pos: [0, 6, 48], size: [60, 14, 2], style: 'core' },
    { id: 's10-wall-w', pos: [-48, 6, 0], size: [2, 14, 60], style: 'core' },
    { id: 's10-wall-e', pos: [48, 6, 0], size: [2, 14, 60], style: 'core' },
    // Corner angled perimeter walls
    { id: 's10-wall-nw', pos: [-36, 6, -36], size: [32, 14, 2], rot: [0, 45, 0], style: 'core' },
    { id: 's10-wall-ne', pos: [36, 6, -36], size: [32, 14, 2], rot: [0, -45, 0], style: 'core' },
    { id: 's10-wall-sw', pos: [-36, 6, 36], size: [32, 14, 2], rot: [0, -45, 0], style: 'core' },
    { id: 's10-wall-se', pos: [36, 6, 36], size: [32, 14, 2], rot: [0, 45, 0], style: 'core' },

    // Central Elevated Core Reactor Dais (The main dueling ground)
    { id: 's10-reactor-base', pos: [0, 0.2, 0], size: [36, 0.8, 36], style: 'core' },
    { id: 's10-reactor-ring', pos: [0, 0.7, 0], size: [22, 0.6, 22], style: 'core' },
    { id: 's10-reactor-center', pos: [0, 1.1, 0], size: [10, 0.5, 10], style: 'core' },

    // High North Throne Platform (Overlooking the colosseum)
    { id: 's10-throne-base', pos: [0, 3.5, -40], size: [24, 7.0, 14], style: 'core' },
    { id: 's10-throne-dais', pos: [0, 7.2, -40], size: [14, 0.8, 8], style: 'core' },

    // Four Tactical Raised Quadrant Bastions
    { id: 's10-bastion-nw', pos: [-28, 2.0, -28], size: [12, 4.0, 12], style: 'core' },
    { id: 's10-bastion-ne', pos: [28, 2.0, -28], size: [12, 4.0, 12], style: 'core' },
    { id: 's10-bastion-sw', pos: [-28, 2.0, 28], size: [12, 4.0, 12], style: 'core' },
    { id: 's10-bastion-se', pos: [28, 2.0, 28], size: [12, 4.0, 12], style: 'core' },

    // Tactical Low Cover Blocks
    { id: 's10-cover-w', pos: [-22, 1.0, 0], size: [4, 2.0, 12], style: 'core' },
    { id: 's10-cover-e', pos: [22, 1.0, 0], size: [4, 2.0, 12], style: 'core' },
    { id: 's10-cover-s', pos: [0, 1.0, 24], size: [12, 2.0, 4], style: 'core' },
  ],
  checkpoints: [],
  orbs: [],
  decor: [
    // 8 Colossal Power Spires Surrounding the Colosseum
    { kind: 'tower', pos: [0, -10, -56], scale: [24, 150, 24] },
    { kind: 'tower', pos: [0, -10, 56], scale: [24, 150, 24] },
    { kind: 'tower', pos: [-56, -10, 0], scale: [24, 150, 24] },
    { kind: 'tower', pos: [56, -10, 0], scale: [24, 150, 24] },
    { kind: 'tower', pos: [-42, -10, -42], scale: [20, 135, 20] },
    { kind: 'tower', pos: [42, -10, -42], scale: [20, 135, 20] },
    { kind: 'tower', pos: [-42, -10, 42], scale: [20, 135, 20] },
    { kind: 'tower', pos: [42, -10, 42], scale: [20, 135, 20] },

    // The Throne Colossus Monoliths
    { kind: 'monolith', pos: [-16, 3.5, -40], scale: 3.5 },
    { kind: 'monolith', pos: [16, 3.5, -40], scale: 3.5 },

    // Outer Perimeter Conduits
    { kind: 'conduit', pos: [0, 6.0, 47], scale: [0.8, 0.8, 58], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [0, 6.0, -47], scale: [0.8, 0.8, 58], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [-47, 6.0, 0], scale: [0.8, 0.8, 58], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [47, 6.0, 0], scale: [0.8, 0.8, 58], rot: [0, 0, 0] },

    // Grand Archways
    { kind: 'arch', pos: [0, 0, 42] },
    { kind: 'arch', pos: [0, 0, -32] },

    // Pylons encircling the central reactor
    { kind: 'pylon', pos: [-18, 0, -18] },
    { kind: 'pylon', pos: [18, 0, -18] },
    { kind: 'pylon', pos: [-18, 0, 18] },
    { kind: 'pylon', pos: [18, 0, 18] },

    // Floating Debris Cloud above the Abyss
    { kind: 'cubeCluster', pos: [0, 28, 0], scale: 4.2 },
    { kind: 'cubeCluster', pos: [-28, 22, -28], scale: 2.8 },
    { kind: 'cubeCluster', pos: [28, 22, -28], scale: 2.8 },
    { kind: 'cubeCluster', pos: [-28, 22, 28], scale: 2.8 },
    { kind: 'cubeCluster', pos: [28, 22, 28], scale: 2.8 },
  ],
  portal: { pos: [0, 0, 40], yaw: 180 },
};
