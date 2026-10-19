import type { StageDefinition } from './StageTypes';

/**
 * STAGE 7 — REINFORCED ASSAULT.
 * The Foundry Refinery: Molten amber/orange aesthetics, pulsing energy hazard beams,
 * reinforced Shield defenders, and intense combined melee-ranged combat.
 */
export const STAGE_7: StageDefinition = {
  id: 7,
  name: 'REINFORCED ASSAULT',
  subtitle: 'The legion has reinforced their defenses. Watch for active hazard beams.',
  finale: false,
  theme: {
    background: 0x070302,
    fogColor: 0x140704,
    fogNear: 45,
    fogFar: 240,
    skyTop: 0x1a0603,
    skyHorizon: 0x0b0302,
    accent: 0xff6600,
    accentSecondary: 0xffaa00,
    keyLight: 0xff7722,
    fillLight: 0x331005,
    ambientParticleColor: 0xff8811,
    musicIntensity: 0.95,
  },
  spawn: [0, 0, 42],
  spawnYaw: Math.PI,
  bounds: { min: [-85, -25, -115], max: [85, 65, 75] },
  energyRequired: 0,
  hints: [
    'NEW ENEMY: SHIELD DEFENDERS',
    'FRONTAL ATTACKS DEFLECT OFF SHIELDS',
    'FLANK OR STRIKE DURING ATTACK RECOVERY',
    'DODGE ACTIVE HAZARD CONDUITS',
  ],
  platforms: [
    // Southern Foundry Staging Plaza (Z: +18 to +65)
    { id: 's7-south-floor', pos: [0, -0.6, 42], size: [72, 1.2, 48], style: 'hazard' },
    { id: 's7-wall-s', pos: [0, 5, 66], size: [72, 12, 2], style: 'hazard' },
    { id: 's7-wall-sw', pos: [-36, 5, 42], size: [2, 12, 48], style: 'hazard' },
    { id: 's7-wall-se', pos: [36, 5, 42], size: [2, 12, 48], style: 'hazard' },

    // Central Staging Dias
    { id: 's7-dais-s', pos: [0, 0.2, 42], size: [16, 0.8, 16], style: 'hazard' },

    // Central Hazard Causeway & Split Catwalks (Z: -25 to +18)
    { id: 's7-causeway-center', pos: [0, -0.6, -3], size: [24, 1.2, 42], style: 'hazard' },
    { id: 's7-catwalk-w', pos: [-24, 1.5, -3], size: [14, 1.2, 42], style: 'hazard' },
    { id: 's7-catwalk-e', pos: [24, 1.5, -3], size: [14, 1.2, 42], style: 'hazard' },

    // Ramps connecting catwalks
    { id: 's7-ramp-w', pos: [-16, 0.5, 14], size: [6, 0.8, 10], style: 'hazard' },
    { id: 's7-ramp-e', pos: [16, 0.5, 14], size: [6, 0.8, 10], style: 'hazard' },

    // Tactical Choke Gates
    { id: 's7-pillar-mid-w', pos: [-12, 4.0, -3], size: [4, 9.0, 4], style: 'hazard' },
    { id: 's7-pillar-mid-e', pos: [12, 4.0, -3], size: [4, 9.0, 4], style: 'hazard' },

    // Northern Fortified Refinery Courtyard (Z: -25 to -105)
    { id: 's7-north-floor', pos: [0, -0.6, -65], size: [84, 1.2, 80], style: 'hazard' },
    { id: 's7-wall-n', pos: [0, 6, -105], size: [84, 14, 2], style: 'hazard' },
    { id: 's7-wall-nw', pos: [-42, 6, -65], size: [2, 14, 80], style: 'hazard' },
    { id: 's7-wall-ne', pos: [42, 6, -65], size: [2, 14, 80], style: 'hazard' },

    // Refinery Center Furnace Core
    { id: 's7-core-platform', pos: [0, 0.4, -65], size: [22, 1.0, 22], style: 'core' },

    // Elevated Sniper Bastions in North Courtyard
    { id: 's7-bastion-nw', pos: [-30, 2.5, -88], size: [12, 5.0, 12], style: 'hazard' },
    { id: 's7-bastion-ne', pos: [30, 2.5, -88], size: [12, 5.0, 12], style: 'hazard' },
    { id: 's7-bastion-sw', pos: [-30, 2.5, -42], size: [12, 5.0, 12], style: 'hazard' },
    { id: 's7-bastion-se', pos: [30, 2.5, -42], size: [12, 5.0, 12], style: 'hazard' },
  ],
  checkpoints: [],
  orbs: [],
  hazards: [
    // Pulsing energy hazard beams along the Causeway lanes
    { kind: 'beam', pos: [-12, 1.2, 5], size: [2, 2, 18], rot: [0, 0, 0], cycle: { on: 3.5, off: 2.5, phase: 0 } },
    { kind: 'beam', pos: [12, 1.2, -10], size: [2, 2, 18], rot: [0, 0, 0], cycle: { on: 3.5, off: 2.5, phase: 2 } },
    { kind: 'beam', pos: [0, 1.2, -65], size: [18, 2, 2], rot: [0, 90, 0], cycle: { on: 4.0, off: 3.0, phase: 1.5 } },
  ],
  decor: [
    // Refinery Smokestacks / Towers
    { kind: 'tower', pos: [-76, -10, 60], scale: [18, 120, 18] },
    { kind: 'tower', pos: [76, -10, 60], scale: [18, 120, 18] },
    { kind: 'tower', pos: [-76, -10, -100], scale: [22, 130, 22] },
    { kind: 'tower', pos: [76, -10, -100], scale: [22, 130, 22] },
    { kind: 'tower', pos: [0, -10, -118], scale: [26, 140, 26] },

    // Giant Molten Conduits
    { kind: 'conduit', pos: [0, 5.0, 65], scale: [0.7, 0.7, 68], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [0, 6.0, -104], scale: [0.7, 0.7, 80], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [-41, 6.0, -65], scale: [0.7, 0.7, 76], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [41, 6.0, -65], scale: [0.7, 0.7, 76], rot: [0, 0, 0] },

    // Arch Gates
    { kind: 'arch', pos: [0, 0, 18] },
    { kind: 'arch', pos: [0, 0, -25] },

    // Pylons
    { kind: 'pylon', pos: [-16, 0, 35] },
    { kind: 'pylon', pos: [16, 0, 35] },
    { kind: 'pylon', pos: [-20, 0, -65] },
    { kind: 'pylon', pos: [20, 0, -65] },
  ],
  portal: { pos: [0, 0, -98], yaw: 180 },
};
