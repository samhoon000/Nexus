import * as THREE from 'three';

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential smoothing factor for a time constant `lag` (seconds). */
export const dampFactor = (delta: number, lag: number): number =>
  1 - Math.exp(-delta / Math.max(0.0001, lag));

export const damp = (current: number, target: number, lag: number, delta: number): number =>
  current + (target - current) * dampFactor(delta, lag);

export const dampVector = (
  current: THREE.Vector3,
  target: THREE.Vector3,
  lag: number,
  delta: number,
): THREE.Vector3 => current.lerp(target, dampFactor(delta, lag));

/** Shortest signed difference between two angles in radians. */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const dampAngle = (current: number, target: number, lag: number, delta: number): number =>
  current + angleDelta(current, target) * dampFactor(delta, lag);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export type Vec3Tuple = [number, number, number];

export const toVector3 = (tuple: Vec3Tuple, target = new THREE.Vector3()): THREE.Vector3 =>
  target.set(tuple[0], tuple[1], tuple[2]);

/** Deterministic value noise in [-1, 1]. */
export const pseudoNoise = (t: number, seed: number): number => {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
