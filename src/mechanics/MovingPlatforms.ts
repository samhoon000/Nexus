import * as THREE from 'three';
import type { Platform } from '../world/Platforms';
import type { World } from '../world/World';
import { easeInOutCubic } from '../effects/Tween';

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

/**
 * Linear (ping-pong) and rotating platforms driven by accumulated fixed-step time.
 * Records each collider's previous matrix so the player can ride it.
 */
export class MovingPlatforms {
  private readonly platforms: Platform[] = [];
  private time = 0;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly spinQuat = new THREE.Quaternion();

  constructor(private readonly world: World) {}

  add(platform: Platform): void {
    const { def } = platform;
    if (!def.motion && !def.spin) return;
    this.platforms.push(platform);
    platform.collider.prevMatrix = new THREE.Matrix4().copy(platform.collider.obb.matrix);
    this.apply(platform, 0);
  }

  update(dt: number): void {
    this.time += dt;
    for (const platform of this.platforms) {
      // Only platforms also handled by the disappearing system may be mid-fall; skip those.
      if (platform.state.falling) continue;
      platform.collider.prevMatrix!.copy(platform.collider.obb.matrix);
      this.apply(platform, this.time);
    }
  }

  private apply(platform: Platform, time: number): void {
    const { def, group } = platform;
    if (def.motion) {
      const pause = def.motion.pauseAtEnds ?? 0;
      const half = def.motion.duration + pause;
      const cycle = half * 2;
      const t = (time + (def.motion.phase ?? 0) * cycle) % cycle;
      let k: number;
      if (t < def.motion.duration) k = t / def.motion.duration;
      else if (t < half) k = 1;
      else if (t < half + def.motion.duration) k = 1 - (t - half) / def.motion.duration;
      else k = 0;
      this.from.copy(platform.basePosition);
      this.to.set(def.motion.to[0], def.motion.to[1], def.motion.to[2]);
      group.position.lerpVectors(this.from, this.to, easeInOutCubic(k));
    }
    if (def.spin) {
      this.spinQuat.setFromAxisAngle(AXES[def.spin.axis], def.spin.speed * time);
      group.quaternion.copy(platform.baseQuaternion).multiply(this.spinQuat);
    }
    this.world.refreshCollider(platform.collider);
  }

  /** Current motion time; the test hooks freeze it for stable captures. */
  get elapsed(): number {
    return this.time;
  }

  dispose(): void {
    this.platforms.length = 0;
  }
}
