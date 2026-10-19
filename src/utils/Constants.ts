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

/**
 * NEXUS player character (the Blender GLB in src/assets/characters/nexus-player). Visual-only:
 * nothing here changes the physics capsule.
 */
export const CHARACTER = {
  /** Uniform scale of the GLB (1 unit = 1 m; the model is 1.316 m tall, feet at the origin). */
  SCALE: 1.15,
  /** Environment reflection strength for the armour and trim (the scene's RoomEnvironment is dim). */
  ENV_MAP_INTENSITY: 1.6,
  /** Emissive intensities for the energy materials; the GLB authors 4–6, far above the bloom range. */
  ENERGY_CYAN_BASE: 1.5,
  /** Added to the cyan intensity at full collected energy. */
  ENERGY_CYAN_GAIN: 1.6,
  ENERGY_PULSE: 0.25,
  ENERGY_BLUE: 1.5,
  ENERGY_VIOLET: 1.3,
  /** Double-jump surge added to the cyan intensity and its decay per second. */
  SURGE: 2.4,
  SURGE_DECAY: 4,
  /** Core halo sprite scale (world units). */
  GLOW_SCALE: 0.34,
  /** Stride phase advance per metre travelled (rad/m); 2π is one left+right cycle. */
  STRIDE_RATE: 2.3,
  /** Whole-body lean into the run and into turns (radians at full speed). */
  RUN_LEAN: 0.07,
  TURN_LEAN: 0.1,
  /** Airborne whole-body pitch per m/s of vertical speed, clamped to ±AIR_PITCH_MAX. */
  AIR_PITCH: 0.006,
  AIR_PITCH_MAX: 0.08,
  /** Landing crouch: base amount plus impact scaling, clamped to 1, recovering over LAND_RECOVER s. */
  LAND_CROUCH_MIN: 0.35,
  LAND_CROUCH_IMPACT: 0.045,
  LAND_RECOVER: 0.3,
  /** Take-off pulse (arms up, toes down) duration in seconds. */
  JUMP_PULSE: 0.24,
  /** Smoothing time constant (s) for locomotion state weights. */
  POSE_LAG: 0.08,
  /** Seconds a lost ground contact is ignored by the pose (edges, slopes, platform seams). */
  GROUND_GRACE: 0.06,
};

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

export const STAGE_COUNT = 10;

export const SAVE_KEY = 'nexus.save.v1';

/** Touch controls (CSS pixels unless noted). */
export const TOUCH = {
  /** Joystick travel radius: knob centre to base centre. */
  JOYSTICK_RADIUS: 54,
  /** Fraction of the radius around the centre that reads as zero. */
  JOYSTICK_DEAD_ZONE: 0.14,
  /** Response curve exponent (> 1 gives finer control near the centre). */
  JOYSTICK_CURVE: 1.3,
  /** Camera rotation per pixel of drag, radians (scaled by the sensitivity setting). */
  LOOK_SENSITIVITY: 0.0052,
  /** Exponential smoothing time constant for touch look, seconds. */
  LOOK_SMOOTHING: 0.04,
  /** Haptic pulse lengths in ms. */
  HAPTIC_TAP: 10,
  HAPTIC_EVENT: 22,
} as const;

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityProfile {
  /** Upper bound on the device pixel ratio used for the render buffer. */
  maxDpr: number;
  bloom: boolean;
  /** Resolution factor for the bloom pass (its mip chain), 1 = full. */
  bloomScale: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Fraction of the ambient particle field that is drawn. */
  ambientParticles: number;
}

/** Render quality tiers. 'high' is the pre-mobile desktop configuration. */
export const QUALITY: Record<QualityTier, QualityProfile> = {
  high: { maxDpr: 2, bloom: true, bloomScale: 1, shadows: true, shadowMapSize: 2048, ambientParticles: 1 },
  medium: { maxDpr: 1.5, bloom: true, bloomScale: 0.5, shadows: true, shadowMapSize: 1024, ambientParticles: 0.6 },
  low: { maxDpr: 1, bloom: false, bloomScale: 0.5, shadows: false, shadowMapSize: 512, ambientParticles: 0.35 },
};

/** Per-form-factor render-buffer pixel budgets (width × height × dpr²). */
export const PIXEL_BUDGET = {
  phone: 1_700_000,
  tablet: 2_600_000,
  desktop: Number.POSITIVE_INFINITY,
} as const;

/** Adaptive resolution (only while quality is AUTO). */
export const ADAPTIVE = {
  /** Frame-rate thresholds (fps) that step the render scale down / up. */
  FPS_LOW: 46,
  FPS_HIGH: 57,
  /** Consecutive half-second samples required before stepping. */
  SAMPLES_DOWN: 3,
  SAMPLES_UP: 12,
  STEP_DOWN: 0.1,
  STEP_UP: 0.05,
  MIN_SCALE: 0.6,
} as const;
