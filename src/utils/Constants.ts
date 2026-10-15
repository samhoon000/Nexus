/**
 * Central tuning constants. Every gameplay / camera / render number that a designer
 * might want to touch lives here. Nothing in gameplay code should hardcode these.
 */

export const PLAYER = {
  SPEED: 7.5,
  ACCELERATION: 40,
  DECELERATION: 50,
  AIR_CONTROL: 0.55,
  JUMP_FORCE: 11.5,
  DOUBLE_JUMP_FORCE: 10.5,
  GRAVITY: 30,
  MAX_FALL_SPEED: 36,
  COYOTE_TIME: 0.12,
  JUMP_BUFFER: 0.12,
  /** Multiplier applied to upward velocity when the jump key is released early. */
  JUMP_CUT: 0.6,
  /** Collision capsule: two spheres of RADIUS, centred HALF_SEGMENT above/below the body centre. */
  RADIUS: 0.35,
  HALF_SEGMENT: 0.25,
  /** Walkable slope limit in degrees. */
  MAX_SLOPE_DEG: 50,
  /** Distance the player may be snapped down to keep contact when walking down slopes. */
  GROUND_SNAP: 0.3,
  /** Ledges up to this height are climbed automatically while walking. */
  STEP_HEIGHT: 0.55,
  /** Yaw turn rate (rad/s) for the visual model. */
  TURN_RATE: 14,
  /** Seconds between death and respawn. */
  RESPAWN_DELAY: 0.75,
};

/** Height of the body centre above the feet (RADIUS + HALF_SEGMENT). */
export const PLAYER_CENTER_HEIGHT = PLAYER.RADIUS + PLAYER.HALF_SEGMENT;

export const CAMERA = {
  FOV: 58,
  DISTANCE: 7.2,
  MIN_DISTANCE: 1.6,
  /** Look-at point above the player's body centre. */
  TARGET_HEIGHT: 0.9,
  SENSITIVITY: 0.0021,
  PITCH_MIN: -0.55,
  PITCH_MAX: 1.25,
  DEFAULT_PITCH: 0.42,
  /** Exponential smoothing time constants (seconds). */
  FOLLOW_LAG: 0.07,
  DISTANCE_LAG: 0.12,
  FRAME_LAG: 0.35,
  /** Pull the camera out of geometry: sphere radius used for the collision cast. */
  COLLISION_RADIUS: 0.32,
  /** Trauma shake settings (trauma² drives the shake). */
  SHAKE_DECAY: 1.6,
  SHAKE_MAX_OFFSET: 0.35,
  SHAKE_MAX_ROLL: 0.05,
  /** Vertical kicks (world units) on jump and landing. */
  JUMP_KICK: -0.12,
  LAND_KICK: 0.18,
  KICK_LAG: 0.14,
  FOV_PUNCH_DECAY: 0.22,
};

export const PHYSICS = {
  FIXED_DT: 1 / 120,
  MAX_FRAME_DT: 0.05,
  MAX_SUBSTEPS: 8,
  COLLISION_ITERATIONS: 4,
} as const;

export const RENDER = {
  MAX_DPR: 2,
  SHADOW_MAP_SIZE: 2048,
  SHADOW_EXTENT: 22,
  EXPOSURE: 1.0,
  BLOOM_STRENGTH: 0.5,
  BLOOM_RADIUS: 0.4,
  BLOOM_THRESHOLD: 0.82,
  VIGNETTE_STRENGTH: 0.55,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 900,
};

export const ENERGY = {
  ORB_RADIUS: 0.42,
  COLLECT_RADIUS: 1.1,
  BOB_AMPLITUDE: 0.18,
  BOB_SPEED: 1.6,
  SPIN_SPEED: 1.4,
} as const;

export const MECHANICS = {
  /** Trigger radii measured from the pad centre to the player's body centre (3D). */
  CHECKPOINT_RADIUS: 2.0,
  TELEPORT_RADIUS: 1.4,
  TELEPORT_COOLDOWN: 1.0,
  PORTAL_RADIUS: 2.0,
  ACTIVATOR_RADIUS: 1.7,
  /** Crumble platforms: delay after landing before they fail, and respawn time. */
  CRUMBLE_DELAY: 0.55,
  CRUMBLE_RESPAWN: 3.2,
  /** Falling platforms: delay before falling, fall acceleration, respawn time. */
  FALL_DELAY: 0.35,
  FALL_ACCEL: 18,
  FALL_DISTANCE: 14,
  FALL_RESPAWN: 4.0,
  /** Blink platforms: warning duration before switching off. */
  BLINK_WARN: 0.6,
  /** Gravity zone transition time for the camera frame. */
  GRAVITY_TRANSITION: 0.5,
  LOW_GRAVITY_SCALE: 0.38,
} as const;

export const COLORS = {
  background: 0x05070f,
  cyan: 0x19e6ff,
  blue: 0x3c7bff,
  violet: 0x8a5cff,
  magenta: 0xff3fd6,
  orange: 0xff7a2a,
  white: 0xdff6ff,
  shellDark: 0x141a28,
  shellMid: 0x222b3f,
  shellLight: 0x4d5b7a,
  trim: 0x8fa3c7,
} as const;

export const STAGE_COUNT = 5;

export const SAVE_KEY = 'nexus.save.v1';
