import * as THREE from 'three';
import { PLAYER } from '../utils/Constants';
import type { PlayerPhysics } from './PlayerPhysics';

export interface MoveIntent {
  /** Camera-relative input: x = strafe right, y = forward. */
  input: THREE.Vector2;
  /** Camera basis vectors in the gravity frame (tangent to the ground plane). */
  forward: THREE.Vector3;
  right: THREE.Vector3;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export type JumpEvent = 'none' | 'jump' | 'double';

/**
 * Turns intents into velocity changes: acceleration, air control, coyote time, jump buffering,
 * variable jump height and the double jump. Deterministic given the fixed step.
 */
export class PlayerController {
  /** World-space facing direction (tangent to the ground plane). */
  readonly facing = new THREE.Vector3(0, 0, 1);
  private jumpsRemaining = 2;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private cutAvailable = false;
  /** Normalised movement input magnitude for animation. */
  inputMagnitude = 0;

  private readonly desired = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  update(dt: number, intent: MoveIntent, physics: PlayerPhysics): JumpEvent {
    const up = physics.up;

    // Desired direction from camera basis, projected onto the tangent plane.
    this.desired
      .copy(intent.right)
      .multiplyScalar(intent.input.x)
      .addScaledVector(intent.forward, intent.input.y);
    this.desired.addScaledVector(up, -this.desired.dot(up));
    this.inputMagnitude = Math.min(1, this.desired.length());
    if (this.inputMagnitude > 1e-4) this.desired.multiplyScalar(1 / this.desired.length()).multiplyScalar(this.inputMagnitude);

    // Tangent velocity blending.
    physics.getTangentVelocity(this.tangent);
    this.target.copy(this.desired).multiplyScalar(PLAYER.SPEED);
    const grounded = physics.grounded;
    const hasInput = this.inputMagnitude > 0.05;
    let rate: number;
    if (grounded) rate = hasInput ? PLAYER.ACCELERATION : PLAYER.DECELERATION;
    else rate = hasInput ? PLAYER.ACCELERATION * PLAYER.AIR_CONTROL : PLAYER.DECELERATION * 0.08;
    moveToward(this.tangent, this.target, rate * dt);
    // Write back tangent velocity, keep vertical.
    const vertical = physics.velocity.dot(up);
    physics.velocity.copy(this.tangent).addScaledVector(up, vertical);

    // Facing follows input, or the platform rotation when carried.
    if (physics.carried) this.facing.transformDirection(physics.carryRotation);
    if (hasInput) {
      this.facing.lerp(this.desired, 1 - Math.exp(-PLAYER.TURN_RATE * dt));
    }
    this.facing.addScaledVector(up, -this.facing.dot(up));
    if (this.facing.lengthSq() < 1e-6) this.facing.copy(intent.forward);
    this.facing.normalize();

    // Jump timers.
    if (grounded) {
      this.coyoteTimer = PLAYER.COYOTE_TIME;
      this.jumpsRemaining = 2;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      // Walking off a ledge after coyote time consumes the ground jump.
      if (this.coyoteTimer <= 0 && this.jumpsRemaining === 2) this.jumpsRemaining = 1;
    }
    if (intent.jumpPressed) this.jumpBufferTimer = PLAYER.JUMP_BUFFER;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    let event: JumpEvent = 'none';
    if (this.jumpBufferTimer > 0) {
      const canGroundJump = grounded || this.coyoteTimer > 0;
      if (canGroundJump && this.jumpsRemaining === 2) {
        physics.setVertical(PLAYER.JUMP_FORCE);
        this.jumpsRemaining = 1;
        event = 'jump';
      } else if (!grounded && this.jumpsRemaining >= 1) {
        physics.setVertical(PLAYER.DOUBLE_JUMP_FORCE);
        this.jumpsRemaining = 0;
        event = 'double';
      }
      if (event !== 'none') {
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.cutAvailable = true;
        physics.grounded = false;
        physics.groundCollider = null;
        physics.jumpedThisStep = true;
      }
    }

    // Variable jump height: release early to cut the rise.
    if (this.cutAvailable && !intent.jumpHeld) {
      const v = physics.verticalSpeed;
      if (v > 0) physics.setVertical(v * PLAYER.JUMP_CUT);
      this.cutAvailable = false;
    }
    if (physics.verticalSpeed <= 0) this.cutAvailable = false;

    return event;
  }

  reset(facing: THREE.Vector3): void {
    this.facing.copy(facing).normalize();
    this.jumpsRemaining = 2;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.cutAvailable = false;
    this.inputMagnitude = 0;
  }

  get canDoubleJump(): boolean {
    return this.jumpsRemaining >= 1;
  }
}

const delta = new THREE.Vector3();

function moveToward(current: THREE.Vector3, target: THREE.Vector3, maxDelta: number): void {
  delta.subVectors(target, current);
  const distance = delta.length();
  if (distance <= maxDelta || distance < 1e-6) {
    current.copy(target);
    return;
  }
  current.addScaledVector(delta, maxDelta / distance);
}
