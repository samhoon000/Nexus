#!/usr/bin/env python3
"""Writes the expanded Stage6.ts file."""
import os

content = """\
import type { StageDefinition } from './StageTypes';

/**
 * STAGE 6 — THE FALLEN LEGION.
 * EXPANDED: ~3-4x larger playable battlefield (from 42x42 to 80x80 floor).
 * Dark futuristic industrial battlefield with teal lighting, elevated structures,
 * distant architecture and room for the Cyan Knight to sprint, dodge, and fight.
 */
export const STAGE_6: StageDefinition = {
  id: 6,
  name: 'THE FALLEN LEGION',
  subtitle: 'The Core has awakened an army buried beneath the battlefield. Prepare for combat.',
  finale: false,
  theme: {
    background: 0x020408,
    fogColor: 0x050a0c,
    fogNear: 40,
    fogFar: 200,
    skyTop: 0x040c14,
    skyHorizon: 0x020608,
    accent: 0xff2200,
    accentSecondary: 0x00f0ff,
    keyLight: 0xff4422,
    fillLight: 0x061820,
    ambientParticleColor: 0xff3311,
    musicIntensity: 0.95,
  },
  spawn: [0, 0, 18],
  spawnYaw: Math.PI,
  // Expanded bounds: 80x80 playable area with generous vertical room
  bounds: { min: [-85, -20, -85], max: [85, 60, 85] },
  energyRequired: 0,
  hints: ['SURVIVE THE AWAKENING', 'LMB / F: SWORD ATTACK', 'HOLD RMB / Q: DEFENSIVE SHIELD', 'E: REBOOT FALLEN ROBOTS'],
  platforms: [
    // Main Battle Arena Floor (80x80 — approx 3.6x the original 42x42)
    { id: 'arena-main', pos: [0, -0.6, 0], size: [80, 1.2, 80], style: 'dark' },

    // Arena Perimeter Walls
    { id: 'wall-n', pos: [0, 4, -40], size: [80, 10, 2], style: 'core' },
    { id: 'wall-s', pos: [0, 4, 40], size: [80, 10, 2], style: 'core' },
    { id: 'wall-w', pos: [-40, 4, 0], size: [2, 10, 80], style: 'core' },
    { id: 'wall-e', pos: [40, 4, 0], size: [2, 10, 80], style: 'core' },

    // Central Dais — Knight's starting position
    { id: 'center-dais', pos: [0, -0.3, 0], size: [18, 0.6, 18], style: 'core' },
    { id: 'center-ring', pos: [0, -0.1, 0], size: [8, 0.5, 8], style: 'dark' },

    // Quadrant tactical elevated slabs (provides cover and height variation)
    { id: 'slab-nw', pos: [-22, 1.2, -22], size: [12, 2.4, 12], style: 'dark' },
    { id: 'slab-ne', pos: [22, 1.2, -22], size: [12, 2.4, 12], style: 'dark' },
    { id: 'slab-sw', pos: [-22, 1.2, 22], size: [12, 2.4, 12], style: 'dark' },
    { id: 'slab-se', pos: [22, 1.2, 22], size: [12, 2.4, 12], style: 'dark' },

    // Outer ring tactical pillars (mid-field cover)
    { id: 'pillar-n', pos: [0, 3.0, -28], size: [5, 7.0, 5], style: 'dark' },
    { id: 'pillar-s', pos: [0, 3.0, 28], size: [5, 7.0, 5], style: 'dark' },
    { id: 'pillar-w', pos: [-28, 3.0, 0], size: [5, 7.0, 5], style: 'dark' },
    { id: 'pillar-e', pos: [28, 3.0, 0], size: [5, 7.0, 5], style: 'dark' },

    // Corner fortifications — large raised platforms
    { id: 'fort-nw-base', pos: [-34, 2.0, -34], size: [10, 4.5, 10], style: 'core' },
    { id: 'fort-ne-base', pos: [34, 2.0, -34], size: [10, 4.5, 10], style: 'core' },
    { id: 'fort-sw-base', pos: [-34, 2.0, 34], size: [10, 4.5, 10], style: 'core' },
    { id: 'fort-se-base', pos: [34, 2.0, 34], size: [10, 4.5, 10], style: 'core' },
    { id: 'fort-nw-top', pos: [-34, 6.0, -34], size: [7, 2.5, 7], style: 'dark' },
    { id: 'fort-ne-top', pos: [34, 6.0, -34], size: [7, 2.5, 7], style: 'dark' },
    { id: 'fort-sw-top', pos: [-34, 6.0, 34], size: [7, 2.5, 7], style: 'dark' },
    { id: 'fort-se-top', pos: [34, 6.0, 34], size: [7, 2.5, 7], style: 'dark' },
  ],
  checkpoints: [{ pos: [0, 0, 18] }],
  orbs: [],
  decor: [
    // Massive perimeter towers — industrial skyline
    { kind: 'tower', pos: [-72, -10, -72], scale: [18, 110, 18] },
    { kind: 'tower', pos: [72, -10, -72], scale: [18, 110, 18] },
    { kind: 'tower', pos: [-72, -10, 72], scale: [18, 110, 18] },
    { kind: 'tower', pos: [72, -10, 72], scale: [18, 110, 18] },
    { kind: 'tower', pos: [-72, -10, 0], scale: [12, 80, 12] },
    { kind: 'tower', pos: [72, -10, 0], scale: [12, 80, 12] },
    { kind: 'tower', pos: [0, -10, -72], scale: [12, 80, 12] },
    { kind: 'tower', pos: [0, -10, 72], scale: [12, 80, 12] },

    // Inner arena monoliths (wrecked machinery)
    { kind: 'monolith', pos: [-32, 0, -18], scale: 2.8 },
    { kind: 'monolith', pos: [32, 0, -18], scale: 2.8 },
    { kind: 'monolith', pos: [-32, 0, 18], scale: 2.8 },
    { kind: 'monolith', pos: [32, 0, 18], scale: 2.8 },
    { kind: 'monolith', pos: [-18, 0, -32], scale: 2.4 },
    { kind: 'monolith', pos: [18, 0, -32], scale: 2.4 },
    { kind: 'monolith', pos: [-18, 0, 32], scale: 2.4 },
    { kind: 'monolith', pos: [18, 0, 32], scale: 2.4 },

    // Glowing conduit runs (industrial teal pipes)
    { kind: 'conduit', pos: [0, 0.1, -24], scale: [0.9, 0.9, 60], rot: [0, 0, 0] },
    { kind: 'conduit', pos: [-24, 0.1, 0], scale: [0.9, 0.9, 60], rot: [0, 90, 0] },
    { kind: 'conduit', pos: [16, 0.1, -8], scale: [0.6, 0.6, 20], rot: [0, 45, 0] },
    { kind: 'conduit', pos: [-16, 0.1, 8], scale: [0.6, 0.6, 20], rot: [0, 45, 0] },

    // Pylons throughout the arena
    { kind: 'pylon', pos: [-10, 0, -10] },
    { kind: 'pylon', pos: [10, 0, -10] },
    { kind: 'pylon', pos: [-10, 0, 10] },
    { kind: 'pylon', pos: [10, 0, 10] },
    { kind: 'pylon', pos: [0, 0, -20] },
    { kind: 'pylon', pos: [0, 0, 20] },
    { kind: 'pylon', pos: [-20, 0, 0] },
    { kind: 'pylon', pos: [20, 0, 0] },
    { kind: 'pylon', pos: [-26, 0, -14] },
    { kind: 'pylon', pos: [26, 0, -14] },
    { kind: 'pylon', pos: [-26, 0, 14] },
    { kind: 'pylon', pos: [26, 0, 14] },

    // Cube clusters (floating debris)
    { kind: 'cubeCluster', pos: [28, 10, 0], scale: 2.2 },
    { kind: 'cubeCluster', pos: [-28, 10, 0], scale: 2.2 },
    { kind: 'cubeCluster', pos: [0, 10, -28], scale: 2.2 },
    { kind: 'cubeCluster', pos: [0, 10, 28], scale: 2.2 },
    { kind: 'cubeCluster', pos: [-36, 14, -36], scale: 1.8 },
    { kind: 'cubeCluster', pos: [36, 14, -36], scale: 1.8 },
    { kind: 'cubeCluster', pos: [-36, 14, 36], scale: 1.8 },
    { kind: 'cubeCluster', pos: [36, 14, 36], scale: 1.8 },

    // Arch gates — industrial archways framing the battlefield
    { kind: 'arch', pos: [0, 0, -36] },
    { kind: 'arch', pos: [0, 0, 36] },
    { kind: 'arch', pos: [-36, 0, 0], rot: [0, 90, 0] },
    { kind: 'arch', pos: [36, 0, 0], rot: [0, 90, 0] },

    // Rail barriers — tactical lanes
    { kind: 'rail', pos: [-8, 0.5, -18], scale: [16, 0.8, 0.4] },
    { kind: 'rail', pos: [8, 0.5, 18], scale: [16, 0.8, 0.4] },
    { kind: 'rail', pos: [-18, 0.5, 8], scale: [0.4, 0.8, 16] },
    { kind: 'rail', pos: [18, 0.5, -8], scale: [0.4, 0.8, 16] },
  ],
  portal: { pos: [0, 0, -36], yaw: 180 },
};
"""

target = os.path.join('src', 'stages', 'Stage6.ts')
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Written {len(content)} bytes to {target}')
