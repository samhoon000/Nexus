/**
 * Procedural pose library for the NEXUS character rig. The GLB ships without animation clips, so
 * locomotion is synthesised from the player's velocity: these functions write pose channels that
 * `PlayerAnimation` blends by state weight and applies to the bones.
 *
 * Channel conventions (radians / model metres, all relative to the rest pose):
 *   thigh*  swing, positive = forward          knee*   flex, positive = ankle moves back
 *   toe*    final foot pitch, positive = toe down (thigh - knee keeps the sole level)
 *   arm*    upper-arm swing, positive = forward  out*   spread, positive = away from the body
 *   elbow*  flex, positive = hand moves forward  lift    hips translation along up
 */
export interface Pose {
  lift: number;
  hipsPitch: number;
  spinePitch: number;
  twist: number;
  chestPitch: number;
  headPitch: number;
  headYaw: number;
  thighL: number;
  thighR: number;
  kneeL: number;
  kneeR: number;
  toeL: number;
  toeR: number;
  armL: number;
  armR: number;
  outL: number;
  outR: number;
  elbowL: number;
  elbowR: number;
}

export function createPose(): Pose {
  return {
    lift: 0,
    hipsPitch: 0,
    spinePitch: 0,
    twist: 0,
    chestPitch: 0,
    headPitch: 0,
    headYaw: 0,
    thighL: 0,
    thighR: 0,
    kneeL: 0,
    kneeR: 0,
    toeL: 0,
    toeR: 0,
    armL: 0,
    armR: 0,
    outL: 0,
    outR: 0,
    elbowL: 0,
    elbowR: 0,
  };
}

export const POSE_KEYS = Object.keys(createPose()) as (keyof Pose)[];

export function clearPose(pose: Pose): void {
  for (const key of POSE_KEYS) pose[key] = 0;
}

export function addPose(target: Pose, source: Pose, weight: number): void {
  if (weight === 0) return;
  for (const key of POSE_KEYS) target[key] += source[key] * weight;
}

const RUN = {
  thigh: 0.7,
  knee: 1.05,
  kneeRest: 0.12,
  /** Fraction of the leg angle the foot counters to stay level (1 = sole parallel to the ground). */
  footLevel: 0.6,
  toe: 0.15,
  armSwing: 0.55,
  armIn: 0.3,
  elbow: 0.85,
  elbowSwing: 0.25,
  lean: 0.14,
  hipsPitch: 0.04,
  twist: 0.08,
  bob: 0.03,
  headPitch: -0.1,
};

const IDLE = {
  /** Kept small: the elbows sit 5 cm off the abdomen shells in the A-pose. */
  armIn: 0.18,
  elbow: 0.12,
  sway: 0.03,
  breath: 0.012,
  breathLift: 0.004,
  knee: 0.04,
  headYaw: 0.1,
  headPitch: 0.03,
};

/** Full-speed run cycle at stride phase `phase` (2π = one left + right cycle). */
export function runPose(p: Pose, phase: number): void {
  clearPose(p);
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const swingL = Math.max(0, c);
  const swingR = Math.max(0, -c);
  p.thighL = RUN.thigh * s;
  p.thighR = -RUN.thigh * s;
  // The knee flexes while its leg swings forward, and the toe points down a little during the swing.
  p.kneeL = RUN.kneeRest + RUN.knee * swingL;
  p.kneeR = RUN.kneeRest + RUN.knee * swingR;
  p.toeL = RUN.footLevel * (p.thighL - p.kneeL) + RUN.toe * swingL;
  p.toeR = RUN.footLevel * (p.thighR - p.kneeR) + RUN.toe * swingR;
  // Arms counter their own leg; the forward arm bends more.
  p.armL = -RUN.armSwing * s;
  p.armR = RUN.armSwing * s;
  p.outL = -RUN.armIn;
  p.outR = -RUN.armIn;
  p.elbowL = RUN.elbow + RUN.elbowSwing * Math.max(0, -s);
  p.elbowR = RUN.elbow + RUN.elbowSwing * Math.max(0, s);
  p.spinePitch = RUN.lean;
  p.hipsPitch = RUN.hipsPitch;
  p.twist = RUN.twist * s;
  p.headYaw = -RUN.twist * s * 0.5;
  p.headPitch = RUN.headPitch;
  // The body rides highest when the legs are spread (flight phase).
  p.lift = RUN.bob * (Math.abs(s) - 0.5);
}

/** Standing idle: breathing, a slow look-around, arms relaxed against the body. */
export function idlePose(p: Pose, elapsed: number): void {
  clearPose(p);
  const breath = Math.sin(elapsed * 1.6);
  p.chestPitch = IDLE.breath * breath;
  p.lift = IDLE.breathLift * (breath - 1) * 0.5;
  p.headYaw = IDLE.headYaw * Math.sin(elapsed * 0.37) * Math.sin(elapsed * 0.23 + 1);
  p.headPitch = IDLE.headPitch * Math.sin(elapsed * 0.5);
  p.armL = IDLE.sway * breath;
  p.armR = IDLE.sway * Math.sin(elapsed * 1.6 + 0.7);
  p.outL = -IDLE.armIn;
  p.outR = -IDLE.armIn;
  p.elbowL = IDLE.elbow;
  p.elbowR = IDLE.elbow;
  p.kneeL = IDLE.knee;
  p.kneeR = IDLE.knee;
  p.toeL = -IDLE.knee;
  p.toeR = -IDLE.knee;
}

/** Rising: front leg tucked, arms back and slightly out, looking up. */
export const JUMP_POSE: Pose = {
  ...createPose(),
  thighL: 0.4,
  thighR: 0.1,
  kneeL: 0.8,
  kneeR: 0.45,
  toeL: -0.15,
  toeR: -0.1,
  armL: -0.3,
  armR: -0.3,
  outL: 0.3,
  outR: 0.3,
  elbowL: 0.7,
  elbowR: 0.7,
  spinePitch: -0.04,
  headPitch: -0.15,
};

/** Falling: legs reaching down, arms out for balance, looking at the landing. */
export const FALL_POSE: Pose = {
  ...createPose(),
  thighL: 0.2,
  thighR: -0.05,
  kneeL: 0.3,
  kneeR: 0.2,
  toeL: 0.15,
  toeR: 0.15,
  armL: -0.1,
  armR: -0.1,
  outL: 0.55,
  outR: 0.55,
  elbowL: 0.5,
  elbowR: 0.5,
  spinePitch: 0.06,
  headPitch: 0.12,
};

/** Landing crouch at weight 1: hips drop by the leg shortening so the feet stay planted. */
export const LAND_POSE: Pose = {
  ...createPose(),
  lift: -0.052,
  thighL: 0.5,
  thighR: 0.5,
  kneeL: 0.86,
  kneeR: 0.86,
  toeL: -0.36,
  toeR: -0.36,
  spinePitch: 0.2,
  hipsPitch: 0.05,
  armL: -0.3,
  armR: -0.3,
  outL: 0.25,
  outR: 0.25,
  elbowL: 0.4,
  elbowR: 0.4,
  headPitch: 0.1,
};

/** Take-off pulse: arms thrown up and out, legs extended with the toes pointing down. */
export const PULSE_POSE: Pose = {
  ...createPose(),
  armL: 0.25,
  armR: 0.25,
  outL: 0.5,
  outR: 0.5,
  elbowL: 0.3,
  elbowR: 0.3,
  thighL: -0.1,
  thighR: -0.1,
  kneeL: 0.05,
  kneeR: 0.05,
  toeL: 0.35,
  toeR: 0.35,
  spinePitch: -0.03,
  headPitch: -0.1,
};
