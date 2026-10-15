import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';
import type { TweenManager } from '../effects/Tween';
import type { Collider } from '../world/Platforms';
import { PlayerAnimation } from './PlayerAnimation';
import { PlayerController, type MoveIntent } from './PlayerController';
import { createPlayerModel, type PlayerModelParts } from './PlayerModel';
import { PlayerPhysics } from './PlayerPhysics';
import { PLAYER_CENTER_HEIGHT } from '../utils/Constants';

/**
 * Player entity: visual model + controller + physics + animation.
 * `position` is the body centre; feet are PLAYER_CENTER_HEIGHT below it along `up`.
 */
export class Player {
  readonly model: PlayerModelParts;
  readonly physics = new PlayerPhysics();
  readonly controller = new PlayerController();
  readonly animation: PlayerAnimation;
  /** Energy ratio (0..1) drives the core brightness. */
  energyRatio = 0;

  private readonly orientation = new THREE.Matrix4();
  private readonly targetQuaternion = new THREE.Quaternion();
  private readonly zero = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly facingLocal = new THREE.Vector2();
  private readonly inverseQuat = new THREE.Quaternion();
  private readonly scratch = new THREE.Vector3();

  constructor(materials: MaterialLibrary, tweens: TweenManager) {
    this.model = createPlayerModel(materials);
    this.animation = new PlayerAnimation(this.model, tweens);
  }

  get group(): THREE.Group {
    return this.model.root;
  }

  get position(): THREE.Vector3 {
    return this.physics.position;
  }

  /** Fixed-step gameplay update. Returns the jump event for feedback systems. */
  fixedUpdate(dt: number, intent: MoveIntent, colliders: readonly Collider[]) {
    const jump = this.controller.update(dt, intent, this.physics);
    this.physics.step(dt, colliders);
    return jump;
  }

  /** Per-frame visual update. */
  animate(delta: number, elapsed: number, reducedMotion: boolean): void {
    // Orientation: +Z = facing, +Y = up.
    this.orientation.lookAt(this.controller.facing, this.zero, this.physics.up);
    this.targetQuaternion.setFromRotationMatrix(this.orientation);
    this.group.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-delta / 0.06));
    this.group.position.copy(this.physics.position);

    this.physics.getTangentVelocity(this.tangent);
    const tangentSpeed = this.tangent.length();
    // Velocity direction expressed in the model's local frame (x = right, y = forward).
    this.inverseQuat.copy(this.group.quaternion).invert();
    this.scratch.copy(this.tangent).applyQuaternion(this.inverseQuat);
    if (tangentSpeed > 0.01) this.facingLocal.set(this.scratch.x / tangentSpeed, this.scratch.z / tangentSpeed);
    else this.facingLocal.set(0, 0);

    this.animation.update(delta, elapsed, {
      grounded: this.physics.grounded,
      verticalSpeed: this.physics.verticalSpeed,
      tangentSpeed,
      inputMagnitude: this.controller.inputMagnitude,
      facingLocal: this.facingLocal,
      energyRatio: this.energyRatio,
      reducedMotion,
    });
  }

  /** Places the player with feet at `feet`, facing `yaw` radians about +Y (normal gravity). */
  spawnAt(feet: THREE.Vector3, yaw: number): void {
    this.physics.setUp(this.scratch.set(0, 1, 0));
    this.physics.gravityScale = 1;
    this.physics.teleport(this.scratch.copy(feet).addScaledVector(this.physics.up, PLAYER_CENTER_HEIGHT));
    this.controller.reset(this.scratch.set(Math.sin(yaw), 0, Math.cos(yaw)));
    this.orientation.lookAt(this.controller.facing, this.zero, this.physics.up);
    this.group.quaternion.setFromRotationMatrix(this.orientation);
    this.group.position.copy(this.physics.position);
    this.animation.stabilize();
  }

  /** Places the body centre at `center` keeping the current gravity frame. */
  teleportTo(center: THREE.Vector3, facing?: THREE.Vector3): void {
    this.physics.teleport(center);
    if (facing) this.controller.reset(facing);
    this.orientation.lookAt(this.controller.facing, this.zero, this.physics.up);
    this.group.quaternion.setFromRotationMatrix(this.orientation);
    this.group.position.copy(center);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const item of this.model.disposables) item.dispose();
  }
}
