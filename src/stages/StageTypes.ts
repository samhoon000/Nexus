import type { Vec3Tuple } from '../utils/MathUtils';

export type PlatformKind = 'static' | 'moving' | 'rotating' | 'crumble' | 'blink' | 'falling';
export type PlatformStyle = 'standard' | 'light' | 'dark' | 'hazard' | 'violet' | 'core';

export interface PlatformDef {
  kind?: PlatformKind;
  /** Centre of the platform's top surface. */
  pos: Vec3Tuple;
  /** Full size (width, thickness, depth). */
  size: Vec3Tuple;
  /** Euler rotation in degrees (x, y, z). Rotated boxes double as ramps and walls. */
  rot?: Vec3Tuple;
  style?: PlatformStyle;
  /** Linear motion: travels from `pos` to `to` and back. */
  motion?: { to: Vec3Tuple; duration: number; phase?: number; pauseAtEnds?: number };
  /** Rotation about a local axis (rad/s). */
  spin?: { axis: 'x' | 'y' | 'z'; speed: number };
  /** Blink platforms: seconds on, seconds off, phase offset. */
  blink?: { on: number; off: number; phase?: number };
  /** Platforms owned by an activator group start disabled until activated. */
  group?: string;
  /** Optional id for debugging / referencing. */
  id?: string;
}

export interface CheckpointDef {
  pos: Vec3Tuple;
}

export interface GravityZoneDef {
  /** Centre and full size of the zone volume. */
  pos: Vec3Tuple;
  size: Vec3Tuple;
  rot?: Vec3Tuple;
  /** Gravity "up" direction inside the zone (world space). Defaults to +Y. */
  up?: Vec3Tuple;
  /** Gravity multiplier (1 = normal, <1 = low gravity). */
  scale?: number;
  /** Colour tint of the zone shell. */
  color?: number;
}

export interface TeleporterDef {
  id: string;
  pos: Vec3Tuple;
  /** Destination teleporter id. */
  to: string;
  /** Facing (yaw, degrees) applied to the player when arriving here. */
  exitYaw?: number;
  color?: number;
}

export interface HazardDef {
  kind: 'beam';
  pos: Vec3Tuple;
  size: Vec3Tuple;
  rot?: Vec3Tuple;
  /** Optional on/off cycle; always on when omitted. */
  cycle?: { on: number; off: number; phase?: number };
}

export interface ActivatorDef {
  pos: Vec3Tuple;
  /** Platform group to enable when activated. */
  group: string;
  /** Energy required to use it. */
  cost: number;
}

export type DecorKind =
  | 'tower'
  | 'ring'
  | 'pylon'
  | 'holoPanel'
  | 'rail'
  | 'arch'
  | 'cubeCluster'
  | 'conduit'
  | 'monolith'
  | 'core';

export interface DecorDef {
  kind: DecorKind;
  pos: Vec3Tuple;
  scale?: number | Vec3Tuple;
  rot?: Vec3Tuple;
  color?: number;
}

export interface PortalDef {
  pos: Vec3Tuple;
  yaw?: number;
}

export interface StageTheme {
  background: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  skyTop: number;
  skyHorizon: number;
  accent: number;
  accentSecondary: number;
  keyLight: number;
  fillLight: number;
  ambientParticleColor: number;
  /** 0..1 generative music intensity. */
  musicIntensity: number;
  /** Instability effects for Stage 4 / 5 finale. */
  instability?: number;
}

export interface StageDefinition {
  id: number;
  name: string;
  subtitle: string;
  theme: StageTheme;
  spawn: Vec3Tuple;
  spawnYaw: number;
  /** Axis-aligned kill volume: leaving it kills the player. */
  bounds: { min: Vec3Tuple; max: Vec3Tuple };
  energyRequired: number;
  platforms: PlatformDef[];
  orbs: Vec3Tuple[];
  checkpoints: CheckpointDef[];
  gravityZones?: GravityZoneDef[];
  teleporters?: TeleporterDef[];
  hazards?: HazardDef[];
  activators?: ActivatorDef[];
  decor?: DecorDef[];
  portal: PortalDef;
  /** Stage 5 marks the finale: reaching the portal runs the Core sequence instead. */
  finale?: boolean;
  /** Control hints shown at the start of the stage. */
  hints?: string[];
  /** Replacement hints when playing with touch controls (defaults to `hints`). */
  touchHints?: string[];
}
