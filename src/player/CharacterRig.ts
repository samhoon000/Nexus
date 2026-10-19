import * as THREE from 'three';

/** Bone names the game drives. They are a contract with the Blender export (see src/assets/characters). */
export const CHARACTER_BONES = [
  'Root',
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'Shoulder_L',
  'UpperArm_L',
  'Forearm_L',
  'Hand_L',
  'Shoulder_R',
  'UpperArm_R',
  'Forearm_R',
  'Hand_R',
  'Thigh_L',
  'Shin_L',
  'Foot_L',
  'Thigh_R',
  'Shin_R',
  'Foot_R',
] as const;
export type CharacterBoneName = (typeof CHARACTER_BONES)[number];

export interface CharacterMaterials {
  energyCyan: THREE.MeshStandardMaterial;
  energyBlue: THREE.MeshStandardMaterial;
  energyViolet: THREE.MeshStandardMaterial;
  all: THREE.Material[];
}

/** A live instance of the NEXUS character: one skinned mesh, its skeleton and tunable materials. */
export interface CharacterRig {
  /** Feet at the origin, +Z forward, scaled by CHARACTER.SCALE. */
  group: THREE.Group;
  mesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bones: Record<CharacterBoneName, THREE.Bone>;
  materials: CharacterMaterials;
  /** Clips shipped in the GLB (none today). Ready for an AnimationMixer when authored. */
  clips: THREE.AnimationClip[];
  /** Model height in metres before scaling. */
  height: number;
  dispose(): void;
}

const scratchQuat = new THREE.Quaternion();
const scratchQuat2 = new THREE.Quaternion();

/**
 * Drives one bone relative to its rest pose using the character's axes (X lateral, Y up, Z forward)
 * instead of the bone's own local frame, so pose code reads as "pitch the thigh" regardless of how
 * the exporter oriented the bone. Rotations compose about the rest-pose axes, which is exact for a
 * chain bending about one axis (hip → knee → ankle) and visually fine for small mixed rotations.
 */
export class BoneChannel {
  private readonly restQuaternion = new THREE.Quaternion();
  private readonly restPosition = new THREE.Vector3();
  private readonly axisX = new THREE.Vector3();
  private readonly axisY = new THREE.Vector3();
  private readonly axisZ = new THREE.Vector3();
  private readonly parentUp = new THREE.Vector3();

  constructor(
    readonly bone: THREE.Bone,
    characterRoot: THREE.Object3D,
  ) {
    this.restQuaternion.copy(bone.quaternion);
    this.restPosition.copy(bone.position);
    const rootInverse = characterRoot.getWorldQuaternion(scratchQuat2).invert();
    // Character-space axes expressed in the bone's rest frame.
    const boneInverse = bone.getWorldQuaternion(scratchQuat).premultiply(rootInverse).invert();
    this.axisX.set(1, 0, 0).applyQuaternion(boneInverse);
    this.axisY.set(0, 1, 0).applyQuaternion(boneInverse);
    this.axisZ.set(0, 0, 1).applyQuaternion(boneInverse);
    // Character up expressed in the parent's frame, for translation offsets.
    const parent = bone.parent ?? characterRoot;
    const parentInverse = parent.getWorldQuaternion(scratchQuat).premultiply(rootInverse).invert();
    this.parentUp.set(0, 1, 0).applyQuaternion(parentInverse);
  }

  /**
   * Rotation relative to rest about the character axes, in radians: pitch about X (positive tilts
   * an upward bone forward and a downward limb backward), roll about Z, yaw about Y.
   */
  rotate(pitch: number, roll = 0, yaw = 0): void {
    const q = this.bone.quaternion.copy(this.restQuaternion);
    if (pitch !== 0) q.multiply(scratchQuat.setFromAxisAngle(this.axisX, pitch));
    if (roll !== 0) q.multiply(scratchQuat.setFromAxisAngle(this.axisZ, roll));
    if (yaw !== 0) q.multiply(scratchQuat.setFromAxisAngle(this.axisY, yaw));
  }

  /** Translation along the character's up axis relative to rest, in model metres. */
  lift(amount: number): void {
    this.bone.position.copy(this.restPosition).addScaledVector(this.parentUp, amount);
  }

  reset(): void {
    this.bone.quaternion.copy(this.restQuaternion);
    this.bone.position.copy(this.restPosition);
  }
}
