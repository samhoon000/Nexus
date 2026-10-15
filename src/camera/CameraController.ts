import * as THREE from 'three';
import type { Collider } from '../world/Platforms';
import { rayVsOBB } from '../utils/CollisionUtils';
import { CAMERA } from '../utils/Constants';
import { clamp, damp, dampFactor, pseudoNoise } from '../utils/MathUtils';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Third-person orbit camera in the player's gravity frame, with smoothing, geometry collision,
 * trauma shake, jump/land kicks and FOV punches. Yaw/pitch persist across gravity changes.
 */
export class CameraController {
  yaw = 0;
  pitch: number = CAMERA.DEFAULT_PITCH;
  sensitivity = 1;
  invertY = false;
  /** Multiplier for the orbit distance (used by cinematics). */
  distanceScale = 1;
  /** When set, the camera ignores the player and frames this point (cinematics). */
  cinematicTarget: THREE.Vector3 | null = null;
  cinematicPosition: THREE.Vector3 | null = null;

  private readonly frame = new THREE.Quaternion();
  private readonly targetFrame = new THREE.Quaternion();
  private readonly smoothedTarget = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3(0, 1, 0);
  private readonly rayDir = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private distance: number = CAMERA.DISTANCE;
  private kick = 0;
  private kickVelocity = 0;
  private trauma = 0;
  private shakeTime = 0;
  private fovPunch = 0;
  private initialised = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Tangent-plane basis for movement input. */
  getBasis(forward: THREE.Vector3, right: THREE.Vector3): void {
    forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).applyQuaternion(this.frame);
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).applyQuaternion(this.frame);
  }

  applyLook(look: THREE.Vector2): void {
    this.yaw -= look.x * this.sensitivity;
    this.pitch += look.y * this.sensitivity * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, CAMERA.PITCH_MIN, CAMERA.PITCH_MAX);
  }

  /** Points the camera behind the player facing `facing` (world tangent direction). */
  snapBehind(facing: THREE.Vector3, up: THREE.Vector3): void {
    this.targetFrame.setFromUnitVectors(WORLD_UP, up);
    this.frame.copy(this.targetFrame);
    this.scratch.copy(facing).applyQuaternion(this.scratch2Quat.copy(this.frame).invert());
    this.yaw = Math.atan2(-this.scratch.x, -this.scratch.z);
    this.pitch = CAMERA.DEFAULT_PITCH;
    this.initialised = false;
  }

  private readonly scratch2Quat = new THREE.Quaternion();

  /** Call when gravity changes so yaw keeps the same world view direction in the new frame. */
  setUp(up: THREE.Vector3): void {
    // Current world forward.
    this.scratch.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).applyQuaternion(this.frame);
    this.targetFrame.setFromUnitVectors(WORLD_UP, up);
    // Re-express that forward in the new frame to keep the view continuous.
    this.scratch.applyQuaternion(this.scratch2Quat.copy(this.targetFrame).invert());
    this.scratch.y = 0;
    if (this.scratch.lengthSq() > 1e-6) this.yaw = Math.atan2(-this.scratch.x, -this.scratch.z);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  addKick(amount: number): void {
    this.kickVelocity += amount * 8;
  }

  punchFov(degrees: number): void {
    this.fovPunch = Math.min(12, this.fovPunch + degrees);
  }

  update(delta: number, focus: THREE.Vector3, up: THREE.Vector3, colliders: readonly Collider[]): void {
    this.targetFrame.setFromUnitVectors(WORLD_UP, up);
    this.frame.slerp(this.targetFrame, this.initialised ? dampFactor(delta, CAMERA.FRAME_LAG) : 1);
    this.cameraUp.copy(WORLD_UP).applyQuaternion(this.frame);

    // Look target above the player's centre, smoothed.
    this.lookTarget.copy(focus).addScaledVector(this.cameraUp, CAMERA.TARGET_HEIGHT);
    if (!this.initialised) {
      this.smoothedTarget.copy(this.lookTarget);
      this.initialised = true;
    } else {
      this.smoothedTarget.lerp(this.lookTarget, dampFactor(delta, CAMERA.FOLLOW_LAG));
    }

    if (this.cinematicTarget && this.cinematicPosition) {
      this.camera.position.lerp(this.cinematicPosition, dampFactor(delta, 0.6));
      this.scratch.copy(this.cinematicTarget);
      this.camera.up.copy(this.cameraUp);
      this.camera.lookAt(this.scratch);
      this.updateFov(delta);
      return;
    }

    // Orbit offset in the gravity frame.
    const cosP = Math.cos(this.pitch);
    this.offset.set(Math.sin(this.yaw) * cosP, Math.sin(this.pitch), Math.cos(this.yaw) * cosP).applyQuaternion(this.frame);

    // Collision: cast from the target toward the desired camera position.
    const wanted = CAMERA.DISTANCE * this.distanceScale;
    let allowed = wanted;
    this.rayDir.copy(this.offset);
    for (const collider of colliders) {
      if (!collider.enabled || collider.kind !== 'solid') continue;
      const hit = rayVsOBB(this.smoothedTarget, this.rayDir, collider.obb, wanted + CAMERA.COLLISION_RADIUS);
      if (hit >= 0) allowed = Math.min(allowed, Math.max(CAMERA.MIN_DISTANCE, hit - CAMERA.COLLISION_RADIUS));
    }
    // Snap in quickly, ease back out.
    if (allowed < this.distance) this.distance = allowed;
    else this.distance = damp(this.distance, allowed, CAMERA.DISTANCE_LAG, delta);

    this.desired.copy(this.smoothedTarget).addScaledVector(this.offset, this.distance);

    // Jump/land kick (spring back to zero).
    this.kickVelocity += -this.kick * 180 * delta - this.kickVelocity * 14 * delta;
    this.kick += this.kickVelocity * delta;
    this.desired.addScaledVector(this.cameraUp, this.kick);

    // Trauma shake.
    this.shakeTime += delta;
    this.trauma = Math.max(0, this.trauma - CAMERA.SHAKE_DECAY * delta);
    let roll = 0;
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma;
      const f = this.shakeTime * 28;
      this.scratch.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this.desired.addScaledVector(this.scratch, CAMERA.SHAKE_MAX_OFFSET * shake * pseudoNoise(f, 1));
      this.desired.addScaledVector(this.cameraUp, CAMERA.SHAKE_MAX_OFFSET * shake * pseudoNoise(f, 2));
      roll = CAMERA.SHAKE_MAX_ROLL * shake * pseudoNoise(f, 3);
    }

    this.camera.position.copy(this.desired);
    this.camera.up.copy(this.cameraUp);
    this.camera.lookAt(this.smoothedTarget);
    if (roll !== 0) this.camera.rotateZ(roll);
    this.updateFov(delta);
  }

  private updateFov(delta: number): void {
    if (this.fovPunch > 0.001) {
      this.fovPunch *= Math.exp(-delta / CAMERA.FOV_PUNCH_DECAY);
      if (this.fovPunch < 0.001) this.fovPunch = 0;
    }
    const fov = CAMERA.FOV + this.fovPunch;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  getForwardWorld(target: THREE.Vector3): THREE.Vector3 {
    return target.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).applyQuaternion(this.frame);
  }

  reset(): void {
    this.initialised = false;
    this.distance = CAMERA.DISTANCE;
    this.trauma = 0;
    this.kick = 0;
    this.kickVelocity = 0;
    this.fovPunch = 0;
    this.cinematicTarget = null;
    this.cinematicPosition = null;
    this.distanceScale = 1;
  }
}
