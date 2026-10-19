import type { StageDefinition } from './StageTypes';

/**
 * STAGE 6 — THE FALLEN LEGION.
 * MASSIVELY EXPANDED BATTLEFIELD (~18,000 m² playable area across 4 connected zones):
 *  - Zone 1 (South): Open Battlefield staging arena with tactical cover & dais
 *  - Zone 2 (Center): Industrial Corridors & Choke Points with overhead conduits
 *  - Zone 3 (West Wing): Elevated Ruined Platform Overlook with access ramps & broken monoliths
 *  - Zone 4 (North): Fortified Final Encounter Sanctum with perimeter bastions & high towers
 */
export const STAGE_6: StageDefinition = {
  id: 6,
  name: 'THE FALLEN LEGION',
  subtitle: 'The Core has awakened an army buried beneath the battlefield. Prepare for combat.',
  finale: false,
  theme: {
    background: 0x020408,
    fogColor: 0x050a0c,
    fogNear: 50,
    fogFar: 260,
    skyTop: 0x040c14,
    skyHorizon: 0x020608,
    accent: 0xff2200,
    accentSecondary: 0x00f0ff,
    keyLight: 0xff4422,
    fillLight: 0x061820,
    ambientParticleColor: 0xff3311,
    musicIntensity: 0.95,
  },
  spawn: [0, 0, 55],
  spawnYaw: Math.PI,
  bounds: { min: [-95, -25, -130], max: [95, 75, 95] },
  energyRequired: 0,
  hints: [
    'ZONE 1: OPEN BATTLEFIELD',
    'LMB / F: SWORD ATTACK',
    'HOLD RMB / Q: DEFENSIVE SHIELD',
    'E: REBOOT FALLEN ROBOTS AS COMPANIONS',
  ],
  platforms: [
    // =========================================================================
    // ZONE 1: OPEN BATTLEFIELD (South, Z: +28 to +82)
    // =========================================================================
    { id: 'zone1-floor', pos: [0, -0.6, 55], size: [80, 1.2, 55], style: 'dark' },

    // Zone 1 Perimeter Walls
    { id: 'z1-wall-s', pos: [0, 4, 82], size: [80, 10, 2], style: 'dark' },
    { id: 'z1-wall-w', pos: [-40, 4, 55], size: [2, 10, 55], style: 'dark' },
    { id: 'z1-wall-e', pos: [40, 4, 55], size: [2, 10, 55], style: 'dark' },

    // Central Starting Dais
    { id: 'z1-start-dais', pos: [0, -0.2, 55], size: [18, 0.8, 18], style: 'dark' },
    { id: 'z1-start-ring', pos: [0, 0.1, 55], size: [8, 0.6, 8], style: 'dark' },

    // Tactical Mid-Field Cover Slabs
    { id: 'z1-cover-nw', pos: [-18, 1.0, 42], size: [8, 2.0, 8], style: 'dark' },
    { id: 'z1-cover-ne', pos: [18, 1.0, 42], size: [8, 2.0, 8], style: 'dark' },
    { id: 'z1-cover-sw', pos: [-18, 1.0, 68], size: [8, 2.0, 8], style: 'dark' },
    { id: 'z1-cover-se', pos: [18, 1.0, 68], size: [8, 2.0, 8], style: 'dark' },

    // Outer Pillars
    { id: 'z1-pillar-w', pos: [-28, 3.0, 55], size: [4, 7.0, 4], style: 'dark' },
    { id: 'z1-pillar-e', pos: [28, 3.0, 55], size: [4, 7.0, 4], style: 'dark' },

    // =========================================================================
    // ZONE 2: INDUSTRIAL CORRIDORS & CHOKE POINTS (Center, Z: -25 to +28)
    // =========================================================================
    { id: 'zone2-floor', pos: [0, -0.6, 2], size: [46, 1.2, 52], style: 'dark' },

    // Industrial Corridor Canyon Walls
    { id: 'z2-wall-e', pos: [23, 5, 2], size: [2, 12, 52], style: 'dark' },
    { id: 'z2-wall-w-south', pos: [-23, 5, 18], size: [2, 12, 20], style: 'dark' },
    // Gap on West wall (Z: -10 to +8) opens into Zone 3 ramp
    { id: 'z2-wall-w-north', pos: [-23, 5, -16], size: [2, 12, 18], style: 'dark' },

    // Corridor Choke Point Gate Pillars
    { id: 'z2-gate-e1', pos: [8, 3.5, 18], size: [3, 8.0, 3], style: 'dark' },
    { id: 'z2-gate-w1', pos: [-8, 3.5, 18], size: [3, 8.0, 3], style: 'dark' },
    { id: 'z2-gate-e2', pos: [8, 3.5, -12], size: [3, 8.0, 3], style: 'dark' },
    { id: 'z2-gate-w2', pos: [-8, 3.5, -12], size: [3, 8.0, 3], style: 'dark' },

    // Corridor Center Trench & Cover Barrier
    { id: 'z2-barrier-mid', pos: [0, 0.8, 2], size: [12, 1.6, 2], style: 'dark' },

    // =========================================================================
    // ZONE 3: RUINED PLATFORM OVERLOOK (West Wing, Z: -30 to +20, X: -85 to -22)
    // =========================================================================
    // Elevated terrace floor at Y = 2.4m
    { id: 'zone3-floor', pos: [-54, 1.8, -5], size: [58, 1.2, 50], style: 'dark' },

    // Connecting Ramp from Zone 2 corridor up to Zone 3 terrace
    { id: 'z3-ramp-step1', pos: [-27, 0.2, -5], size: [6, 0.8, 14], style: 'dark' },
    { id: 'z3-ramp-step2', pos: [-33, 1.0, -5], size: [6, 0.8, 14], style: 'dark' },
    { id: 'z3-ramp-step3', pos: [-39, 1.8, -5], size: [6, 0.8, 14], style: 'dark' },

    // Zone 3 Perimeter Walls
    { id: 'z3-wall-w', pos: [-83, 6, -5], size: [2, 10, 50], style: 'dark' },
    { id: 'z3-wall-s', pos: [-54, 6, 20], size: [58, 10, 2], style: 'dark' },
    { id: 'z3-wall-n', pos: [-54, 6, -30], size: [58, 10, 2], style: 'dark' },

    // Zone 3 Raised Lookout Slabs
    { id: 'z3-overlook-pad', pos: [-64, 3.2, -5], size: [16, 1.6, 16], style: 'dark' },
    { id: 'z3-monolith-base1', pos: [-72, 3.0, 8], size: [8, 3.0, 8], style: 'dark' },
    { id: 'z3-monolith-base2', pos: [-72, 3.0, -18], size: [8, 3.0, 8], style: 'dark' },

    // =========================================================================
    // ZONE 4: FINAL ENCOUNTER BASTION (North, Z: -120 to -24)
    // =========================================================================
    { id: 'zone4-floor', pos: [0, -0.6, -72], size: [96, 1.2, 92], style: 'dark' },

    // Zone 4 Perimeter Fortified Walls
    { id: 'z4-wall-n', pos: [0, 6, -118], size: [96, 14, 2], style: 'dark' },
    { id: 'z4-wall-w', pos: [-48, 6, -72], size: [2, 14, 92], style: 'dark' },
    { id: 'z4-wall-e', pos: [48, 6, -72], size: [2, 14, 92], style: 'dark' },

    // Transition wall wings from Zone 2 into Zone 4
    { id: 'z4-wing-e', pos: [35, 5, -26], size: [26, 12, 2], style: 'dark' },
    { id: 'z4-wing-w', pos: [-35, 5, -26], size: [26, 12, 2], style: 'dark' },

    // Central High Command Reactor Dais
    { id: 'z4-core-dais-outer', pos: [0, 0.2, -72], size: [26, 1.0, 26], style: 'dark' },
    { id: 'z4-core-dais-inner', pos: [0, 0.8, -72], size: [14, 0.8, 14], style: 'dark' },

    // Fortified Corner Bastions
    { id: 'z4-bastion-nw', pos: [-36, 2.5, -100], size: [12, 5.0, 12], style: 'dark' },
    { id: 'z4-bastion-ne', pos: [36, 2.5, -100], size: [12, 5.0, 12], style: 'dark' },
    { id: 'z4-bastion-sw', pos: [-36, 2.5, -45], size: [12, 5.0, 12], style: 'dark' },
    { id: 'z4-bastion-se', pos: [36, 2.5, -45], size: [12, 5.0, 12], style: 'dark' },

    // Midfield Tactical Columns in Zone 4
    { id: 'z4-col-w', pos: [-18, 3.5, -72], size: [5, 8.0, 5], style: 'dark' },
    { id: 'z4-col-e', pos: [18, 3.5, -72], size: [5, 8.0, 5], style: 'dark' },
    { id: 'z4-col-n', pos: [0, 3.5, -96], size: [5, 8.0, 5], style: 'dark' },
  ],
  checkpoints: [],
  orbs: [],
  decor: [
    // Massive Skyline Perimeter Towers
    { kind: 'tower', pos: [-88, -10, -125], scale: [22, 130, 22] },
    { kind: 'tower', pos: [88, -10, -125], scale: [22, 130, 22] },
    { kind: 'tower', pos: [-88, -10, 88], scale: [22, 130, 22] },
    { kind: 'tower', pos: [88, -10, 88], scale: [22, 130, 22] },
    { kind: 'tower', pos: [-100, -10, -15], scale: [18, 110, 18] },
    { kind: 'tower', pos: [88, -10, 0], scale: [18, 110, 18] },
    { kind: 'tower', pos: [0, -10, -132], scale: [26, 140, 26] },

    // Monoliths (wrecked machinery across zones)
    { kind: 'monolith', pos: [-68, 2.4, -5], scale: 3.2 },
    { kind: 'monolith', pos: [-72, 2.4, 8], scale: 2.8 },
    { kind: 'monolith', pos: [-72, 2.4, -18], scale: 2.8 },
    { kind: 'monolith', pos: [32, 0, 55], scale: 2.6 },
    { kind: 'monolith', pos: [-32, 0, 55], scale: 2.6 },
    { kind: 'monolith', pos: [38, 0, -72], scale: 3.0 },
    { kind: 'monolith', pos: [-38, 0, -72], scale: 3.0 },

    // Industrial Archways Framing Zones
    { kind: 'arch', pos: [0, 0, 28] }, // Gate to Zone 2
    { kind: 'arch', pos: [0, 0, -25] }, // Gate to Zone 4
    { kind: 'arch', pos: [-24, 0, -5], rot: [0, 90, 0] }, // Gate to Zone 3 Overlook
    { kind: 'arch', pos: [0, 0, -112] }, // High Command Arch

    // Wall Conduits
    { kind: 'conduit', pos: [0, 5.0, 81], scale: [0.6, 0.6, 76], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [0, 6.0, -117], scale: [0.6, 0.6, 92], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [22, 5.0, 2], scale: [0.6, 0.6, 50], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [-47, 6.0, -72], scale: [0.6, 0.6, 88], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [47, 6.0, -72], scale: [0.6, 0.6, 88], rot: [0, 0, 0] },

    // Pylons along combat lanes
    { kind: 'pylon', pos: [-12, 0, 48] },
    { kind: 'pylon', pos: [12, 0, 48] },
    { kind: 'pylon', pos: [-12, 0, 62] },
    { kind: 'pylon', pos: [12, 0, 62] },
    { kind: 'pylon', pos: [-8, 0, 10] },
    { kind: 'pylon', pos: [8, 0, 10] },
    { kind: 'pylon', pos: [-8, 0, -6] },
    { kind: 'pylon', pos: [8, 0, -6] },
    { kind: 'pylon', pos: [-24, 0, -72] },
    { kind: 'pylon', pos: [24, 0, -72] },
    { kind: 'pylon', pos: [0, 0, -52] },
    { kind: 'pylon', pos: [0, 0, -92] },

    // Floating Debris Clusters
    { kind: 'cubeCluster', pos: [0, 18, 55], scale: 2.8 },
    { kind: 'cubeCluster', pos: [-54, 20, -5], scale: 2.4 },
    { kind: 'cubeCluster', pos: [0, 22, -72], scale: 3.2 },
    { kind: 'cubeCluster', pos: [-36, 16, -100], scale: 2.0 },
    { kind: 'cubeCluster', pos: [36, 16, -100], scale: 2.0 },
  ],
  portal: { pos: [0, 0, -112], yaw: 180 },
};
