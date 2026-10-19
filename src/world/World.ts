import * as THREE from 'three';
import type { Collider, Platform } from './Platforms';

/**
 * Container for the live stage content: everything the player can stand on or trigger.
 * Mechanic systems register their entities here; `StageInstance.dispose()` clears it.
 */
export class World {
  readonly root = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly platforms: Platform[] = [];

  constructor(scene: THREE.Scene) {
    this.root.name = 'world';
    scene.add(this.root);
  }

  addPlatform(platform: Platform): void {
    this.platforms.push(platform);
    this.colliders.push(platform.collider);
    this.root.add(platform.group);
  }

  addCollider(collider: Collider): void {
    this.colliders.push(collider);
  }

  /** Refresh OBBs for colliders whose objects moved this step. */
  refreshCollider(collider: Collider): void {
    collider.object.updateWorldMatrix(true, false);
    collider.obb.refresh(collider.object);
  }

  clear(): void {
    this.colliders.length = 0;
    this.platforms.length = 0;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
  }
}
