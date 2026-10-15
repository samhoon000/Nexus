import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';
import type { TweenManager } from '../effects/Tween';
import type { Collider } from '../world/Platforms';
import { PlayerAnimation } from './PlayerAnimation';
import { createCharacterRig, loadCharacterAsset } from './PlayerCharacter';
import { PlayerController, type MoveIntent } from './PlayerController';
import { attachCharacter, attachFallback, createPlayerModel, type CharacterKind, type PlayerModelParts } from './PlayerModel';
import { PlayerPhysics } from './PlayerPhysics';
import { PLAYER_CENTER_HEIGHT } from '../utils/Constants';

/**
 * Player entity: visual model + controller + physics + animation.
 * `position` is the body centre; feet are PLAYER_CENTER_HEIGHT below it along `up`.
 * The NEXUS character GLB is mounted asynchronously by `loadCharacter()`; physics, camera and
 * triggers never depend on it.
 */
export class Player {
  readonly model: PlayerModelParts;
  readonly physics = new PlayerPhysics();
  readonly controller = new PlayerController();
  readonly animation: PlayerAnimation;
  /** Energy ratio (0..1) drives the core brightness. */
  energyRatio = 0;
  private characterLoad: Promise<void> | null = null;
  private disposed = false;

  private readonly orientation = new THREE.Matrix4();
  private readonly targetQuaternion = new THREE.Quaternion();
  private readonly zero = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly facingLocal = new THREE.Vector2();
  private readonly inverseQuat = new THREE.Quaternion();
  private readonly scratch = new THREE.Vector3();

  constructor(
    private readonly materials: MaterialLibrary,
    tweens: TweenManager,
  ) {
    this.model = createPlayerModel();
    this.animation = new PlayerAnimation(this.model, tweens);
  }

  get group(): THREE.Group {
    return this.model.root;
  }

  /** Which visual is mounted: the GLB, the procedural fallback, or neither yet. */
  get characterKind(): CharacterKind {
    return this.model.kind;
  }

  /**
   * Loads and mounts the NEXUS character once. Never rejects: a missing or broken asset logs a
   * warning and mounts the procedural robot so the game stays playable.
   */
  loadCharacter(): Promise<void> {
    if (!this.characterLoad) {
      this.characterLoad = loadCharacterAsset()
        .then((asset) => {
          if (!this.disposed) attachCharacter(this.model, createCharacterRig(asset), this.materials);
        })
        .catch((error: unknown) => {
          if (this.disposed) return;
          console.warn('[NEXUS] player character unavailable, using the procedural fallback', error);
          attachFallback(this.model, this.materials);
        })
        .then(() => {
          this.animation.attach();
          this.animation.stabilize();
        });
    }
    return this.characterLoad;
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
    this.disposed = true;
    this.group.removeFromParent();
    for (const item of this.model.disposables) item.dispose();
  }
}
