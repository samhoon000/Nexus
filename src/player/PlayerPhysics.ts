import * as THREE from 'three';
import type { Collider } from '../world/Platforms';
import { createContact, sphereVsOBB } from '../utils/CollisionUtils';
import { PHYSICS, PLAYER } from '../utils/Constants';
import { degToRad } from '../utils/MathUtils';

const COS_MAX_SLOPE = Math.cos(degToRad(PLAYER.MAX_SLOPE_DEG));

/**
 * Kinematic capsule (two spheres) against oriented boxes, with an arbitrary gravity "up".
 * The controller writes tangent velocity and jump impulses; this class integrates and resolves.
 */
export class PlayerPhysics {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly up = new THREE.Vector3(0, 1, 0);
  gravityScale = 1;
  grounded = false;
  wasGrounded = false;
  readonly groundNormal = new THREE.Vector3(0, 1, 0);
  groundCollider: Collider | null = null;
  /** Set during a step when a hazard collider was touched. */
  hitHazard = false;
  /** Fall speed (along -up) at the moment of the last landing. */
  landingSpeed = 0;
  /** Set true when landed this step. */
  justLanded = false;
  /** Rotation applied by the platform the player rides, so facing can follow it. */
  readonly carryRotation = new THREE.Matrix4();
  carried = false;

  private readonly sphereCenter = new THREE.Vector3();
  private readonly contact = createContact();
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratch = new THREE.Vector3();
  private readonly snapStart = new THREE.Vector3();
  private readonly stepStart = new THREE.Vector3();
  private readonly blockedDir = new THREE.Vector3();
  private blockedLow = false;
  /** Set by the controller when a jump happened this step; disables ground snapping. */
  jumpedThisStep = false;

  step(dt: number, colliders: readonly Collider[]): void {
    this.wasGrounded = this.grounded;
    this.hitHazard = false;
    this.justLanded = false;
    this.carried = false;

    this.applyPlatformCarry();

    // Gravity along -up, clamped fall speed.
    const g = PLAYER.GRAVITY * this.gravityScale;
    this.velocity.addScaledVector(this.up, -g * dt);
    const vertical = this.velocity.dot(this.up);
    if (vertical < -PLAYER.MAX_FALL_SPEED) {
      this.velocity.addScaledVector(this.up, -PLAYER.MAX_FALL_SPEED - vertical);
    }

    const fallSpeedBefore = -Math.min(0, vertical);
    this.position.addScaledVector(this.velocity, dt);

    this.grounded = false;
    this.groundCollider = null;
    this.blockedLow = false;
    this.resolve(colliders);

    // Auto step-up: when a low ledge blocks horizontal motion while walking, try the move again
    // from STEP_HEIGHT higher and settle back down onto the ledge.
    if (this.blockedLow && this.wasGrounded && !this.jumpedThisStep && this.velocity.dot(this.up) <= 0.5) {
      this.stepStart.copy(this.position);
      this.position.addScaledVector(this.up, PLAYER.STEP_HEIGHT);
      // Carry the lower sphere fully over the ledge so settling lands on top of it.
      this.position.addScaledVector(this.blockedDir, PLAYER.RADIUS + 0.12);
      this.grounded = false;
      this.groundCollider = null;
      this.blockedLow = false;
      this.resolve(colliders);
      const lifted = !this.blockedLow;
      if (lifted) {
        this.position.addScaledVector(this.up, -PLAYER.STEP_HEIGHT);
        this.resolve(colliders);
      }
      if (!lifted || !this.grounded) {
        this.position.copy(this.stepStart);
        this.grounded = false;
        this.groundCollider = null;
        this.resolve(colliders);
      }
    }

    // Keep contact when walking down slopes / off small steps.
    if (!this.grounded && this.wasGrounded && !this.jumpedThisStep && this.velocity.dot(this.up) <= 0.5) {
      this.snapStart.copy(this.position);
      this.position.addScaledVector(this.up, -PLAYER.GROUND_SNAP);
      this.resolve(colliders);
      if (!this.grounded) this.position.copy(this.snapStart);
    }

    if (this.grounded && !this.wasGrounded) {
      this.justLanded = true;
      this.landingSpeed = fallSpeedBefore;
    }
    this.jumpedThisStep = false;
  }

  private applyPlatformCarry(): void {
    const collider = this.groundCollider;
    if (!collider || !collider.prevMatrix || !this.wasGrounded) return;
    // delta = current * inverse(previous)
    this.scratchMatrix.copy(collider.prevMatrix).invert();
    this.carryRotation.multiplyMatrices(collider.obb.matrix, this.scratchMatrix);
    this.position.applyMatrix4(this.carryRotation);
    this.carried = true;
  }

  private resolve(colliders: readonly Collider[]): void {
    for (let iteration = 0; iteration < PHYSICS.COLLISION_ITERATIONS; iteration += 1) {
      let any = false;
      for (let s = -1; s <= 1; s += 2) {
        this.sphereCenter.copy(this.position).addScaledVector(this.up, s * PLAYER.HALF_SEGMENT);
        for (const collider of colliders) {
          if (!collider.enabled) continue;
          if (!sphereVsOBB(this.sphereCenter, PLAYER.RADIUS, collider.obb, this.contact)) continue;
          if (collider.kind === 'hazard') {
            this.hitHazard = true;
            continue;
          }
          any = true;
          this.position.add(this.contact.push);
          this.sphereCenter.add(this.contact.push);
          const into = this.velocity.dot(this.contact.normal);
          const upness = this.contact.normal.dot(this.up);
          if (s === -1 && Math.abs(upness) < 0.35 && into < -0.5) {
            // A wall-like contact on the lower sphere: candidate for stepping up.
            this.blockedLow = true;
            this.blockedDir.copy(this.contact.normal).negate().addScaledVector(this.up, -this.contact.normal.dot(this.up) * -1).normalize();
          }
          if (into < 0) this.velocity.addScaledVector(this.contact.normal, -into);
          if (upness > COS_MAX_SLOPE && s === -1) {
            this.grounded = true;
            this.groundNormal.copy(this.contact.normal);
            this.groundCollider = collider;
          }
        }
      }
      if (!any) break;
    }
  }

  /** Tangent (horizontal in the gravity frame) velocity. */
  getTangentVelocity(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.velocity).addScaledVector(this.up, -this.velocity.dot(this.up));
  }

  get verticalSpeed(): number {
    return this.velocity.dot(this.up);
  }

  setVertical(speed: number): void {
    const current = this.velocity.dot(this.up);
    this.velocity.addScaledVector(this.up, speed - current);
  }

  teleport(position: THREE.Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.wasGrounded = false;
    this.groundCollider = null;
  }

  setUp(up: THREE.Vector3): void {
    if (this.up.distanceToSquared(up) < 1e-8) return;
    // Preserve the magnitude of the vertical component in the new frame so transitions are smooth.
    this.scratch.copy(this.velocity);
    this.up.copy(up).normalize();
    this.velocity.copy(this.scratch);
    this.groundCollider = null;
    this.grounded = false;
  }
}
