import * as THREE from 'three';
import type { Platform, Collider } from '../world/Platforms';
import type { StageContext } from '../stages/StageContext';
import { MECHANICS } from '../utils/Constants';
import { easeOutBack } from '../effects/Tween';

type CrumbleState = 'idle' | 'triggered' | 'gone';

/**
 * Crumble (fail after being stood on), blink (timed on/off) and falling platforms.
 * Every failure respawns after a delay so a bad run can never softlock.
 */
export class DisappearingPlatforms {
  private readonly crumble: Platform[] = [];
  private readonly blink: Platform[] = [];
  private readonly falling: Platform[] = [];
  private time = 0;
  private readonly scratch = new THREE.Vector3();

  constructor(private readonly ctx: StageContext) {}

  add(platform: Platform): void {
    switch (platform.def.kind) {
      case 'crumble':
        this.crumble.push(platform);
        platform.state.crumbleTimer = 0;
        platform.state.crumbleState = 0; // 0 idle, 1 triggered, 2 gone
        break;
      case 'blink':
        this.blink.push(platform);
        break;
      case 'falling':
        this.falling.push(platform);
        platform.collider.prevMatrix = new THREE.Matrix4().copy(platform.collider.obb.matrix);
        platform.state.fallTimer = 0;
        platform.state.fallSpeed = 0;
        platform.state.fallen = 0;
        platform.state.falling = false;
        break;
    }
  }

  update(dt: number, groundCollider: Collider | null): void {
    this.time += dt;
    for (const p of this.crumble) this.updateCrumble(p, dt, groundCollider);
    for (const p of this.blink) this.updateBlink(p);
    for (const p of this.falling) this.updateFalling(p, dt, groundCollider);
  }

  private updateCrumble(p: Platform, dt: number, ground: Collider | null): void {
    const state = p.state.crumbleState as number;
    const current: CrumbleState = state === 0 ? 'idle' : state === 1 ? 'triggered' : 'gone';
    if (current === 'idle') {
      if (ground === p.collider) {
        p.state.crumbleState = 1;
        p.state.crumbleTimer = 0;
      }
      return;
    }
    p.state.crumbleTimer = (p.state.crumbleTimer as number) + dt;
    const timer = p.state.crumbleTimer as number;
    if (current === 'triggered') {
      const k = timer / MECHANICS.CRUMBLE_DELAY;
      // Shake and flicker as a telegraph.
      p.group.position.x = p.basePosition.x + Math.sin(timer * 70) * 0.05 * k;
      p.group.position.z = p.basePosition.z + Math.cos(timer * 63) * 0.05 * k;
      p.group.position.y = p.basePosition.y - k * 0.12;
      if (p.trim) (p.trim.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(timer * 40) * 1.5;
      this.ctx.world.refreshCollider(p.collider);
      if (timer >= MECHANICS.CRUMBLE_DELAY) {
        p.state.crumbleState = 2;
        p.state.crumbleTimer = 0;
        p.collider.enabled = false;
        p.group.visible = false;
        this.scratch.copy(p.basePosition);
        this.ctx.particles.burst({
          position: this.scratch,
          count: 40,
          color: this.ctx.theme.accent,
          speed: 4,
          spread: 1,
          life: 0.9,
          size: 0.2,
          gravity: 12,
        });
        this.ctx.bus.emit('platform:crumble', { position: this.scratch });
      }
    } else if (timer >= MECHANICS.CRUMBLE_RESPAWN) {
      this.restoreCrumble(p, true);
    }
  }

  private restoreCrumble(p: Platform, animate: boolean): void {
    p.state.crumbleState = 0;
    p.state.crumbleTimer = 0;
    p.group.position.copy(p.basePosition);
    p.group.visible = true;
    p.collider.enabled = true;
    if (p.trim) (p.trim.material as THREE.MeshStandardMaterial).emissiveIntensity = p.trimMaterialBase?.emissiveIntensity ?? 2;
    this.ctx.world.refreshCollider(p.collider);
    if (animate) {
      this.ctx.tweens.tween(0.4, (t) => p.group.scale.setScalar(0.2 + 0.8 * t), easeOutBack, () => p.group.scale.setScalar(1));
    } else {
      p.group.scale.setScalar(1);
    }
  }

  private updateBlink(p: Platform): void {
    const blink = p.def.blink ?? { on: 2, off: 2, phase: 0 };
    const period = blink.on + blink.off;
    const t = (this.time + (blink.phase ?? 0) * period) % period;
    const on = t < blink.on;
    const warning = on && t > blink.on - MECHANICS.BLINK_WARN;
    if (p.collider.enabled !== on) {
      p.collider.enabled = on;
      p.group.visible = on;
      if (on) {
        this.ctx.tweens.tween(0.25, (k) => p.group.scale.setScalar(0.6 + 0.4 * k), easeOutBack, () => p.group.scale.setScalar(1));
      }
    }
    if (p.trim) {
      const material = p.trim.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = warning ? 1 + Math.abs(Math.sin(t * 30)) * 3 : (p.trimMaterialBase?.emissiveIntensity ?? 2);
    }
  }

  private updateFalling(p: Platform, dt: number, ground: Collider | null): void {
    p.collider.prevMatrix!.copy(p.collider.obb.matrix);
    if (!p.state.falling && (p.state.fallen as number) === 0) {
      if (ground === p.collider) {
        p.state.fallTimer = (p.state.fallTimer as number) + dt;
        const k = (p.state.fallTimer as number) / MECHANICS.FALL_DELAY;
        p.group.position.x = p.basePosition.x + Math.sin((p.state.fallTimer as number) * 60) * 0.04 * k;
        this.ctx.world.refreshCollider(p.collider);
        if ((p.state.fallTimer as number) >= MECHANICS.FALL_DELAY) {
          p.state.falling = true;
          p.state.fallSpeed = 0;
          this.scratch.copy(p.group.position);
          this.ctx.bus.emit('platform:fall', { position: this.scratch });
        }
      }
      return;
    }
    if (p.state.falling) {
      p.state.fallSpeed = (p.state.fallSpeed as number) + MECHANICS.FALL_ACCEL * dt;
      p.group.position.y -= (p.state.fallSpeed as number) * dt;
      p.group.rotation.x = p.baseQuaternion.x + (p.basePosition.y - p.group.position.y) * 0.02;
      this.ctx.world.refreshCollider(p.collider);
      if (p.basePosition.y - p.group.position.y > MECHANICS.FALL_DISTANCE) {
        p.state.falling = false;
        p.state.fallen = 1;
        p.state.fallTimer = 0;
        p.collider.enabled = false;
        p.group.visible = false;
      }
      return;
    }
    // Fallen and hidden: wait to respawn.
    p.state.fallTimer = (p.state.fallTimer as number) + dt;
    if ((p.state.fallTimer as number) >= MECHANICS.FALL_RESPAWN) this.restoreFalling(p, true);
  }

  private restoreFalling(p: Platform, animate: boolean): void {
    p.state.falling = false;
    p.state.fallen = 0;
    p.state.fallTimer = 0;
    p.state.fallSpeed = 0;
    p.group.position.copy(p.basePosition);
    p.group.quaternion.copy(p.baseQuaternion);
    p.group.visible = true;
    p.collider.enabled = true;
    this.ctx.world.refreshCollider(p.collider);
    p.collider.prevMatrix!.copy(p.collider.obb.matrix);
    if (animate) {
      this.ctx.tweens.tween(0.4, (t) => p.group.scale.setScalar(0.2 + 0.8 * t), easeOutBack, () => p.group.scale.setScalar(1));
    } else {
      p.group.scale.setScalar(1);
    }
  }

  /** Restore every platform immediately (player respawn). */
  reset(): void {
    for (const p of this.crumble) this.restoreCrumble(p, false);
    for (const p of this.falling) this.restoreFalling(p, false);
  }

  dispose(): void {
    this.crumble.length = 0;
    this.blink.length = 0;
    this.falling.length = 0;
  }
}
