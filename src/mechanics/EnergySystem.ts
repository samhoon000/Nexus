import * as THREE from 'three';
import type { ActivatorDef } from '../stages/StageTypes';
import type { StageContext } from '../stages/StageContext';
import type { Platform } from '../world/Platforms';
import { ENERGY, MECHANICS } from '../utils/Constants';
import type { Vec3Tuple } from '../utils/MathUtils';
import { easeOutBack, easeOutCubic } from '../effects/Tween';

interface Orb {
  group: THREE.Group;
  ring: THREE.Mesh;
  core: THREE.Mesh;
  glow: THREE.Sprite;
  base: THREE.Vector3;
  phase: number;
  active: boolean;
}

interface Activator {
  def: ActivatorDef;
  position: THREE.Vector3;
  group: THREE.Group;
  ring: THREE.Mesh;
  used: boolean;
}

/**
 * Energy orbs (the collectible) and activators (energy-gated switches that power platform groups).
 */
export class EnergySystem {
  count = 0;
  readonly total: number;
  readonly required: number;
  private readonly orbs: Orb[] = [];
  private readonly activators: Activator[] = [];
  private readonly group = new THREE.Group();
  private readonly coreGeometry = new THREE.IcosahedronGeometry(ENERGY.ORB_RADIUS * 0.55, 1);
  private readonly ringGeometry = new THREE.TorusGeometry(ENERGY.ORB_RADIUS, 0.035, 8, 32);
  private readonly padGeometry = new THREE.CylinderGeometry(1.0, 1.15, 0.2, 24);
  private readonly padRingGeometry = new THREE.TorusGeometry(0.8, 0.06, 8, 40);
  private readonly glowMaterial: THREE.SpriteMaterial;
  private readonly activatorMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly scratch = new THREE.Vector3();

  constructor(
    private readonly ctx: StageContext,
    orbPositions: Vec3Tuple[],
    required: number,
    activatorDefs: ActivatorDef[] = [],
    private readonly platformsByGroup: Map<string, Platform[]>,
  ) {
    this.group.name = 'energy';
    ctx.world.root.add(this.group);
    this.glowMaterial = ctx.materials.glowSprite.clone();
    this.glowMaterial.color.set(ctx.theme.accent);
    this.glowMaterial.opacity = 0.6;
    for (const pos of orbPositions) this.addOrb(pos);
    for (const def of activatorDefs) this.addActivator(def);
    this.total = this.orbs.length;
    this.required = Math.min(required, this.total);
  }

  private addOrb(pos: Vec3Tuple): void {
    const group = new THREE.Group();
    const core = new THREE.Mesh(this.coreGeometry, this.ctx.materials.emissiveCyan);
    const ring = new THREE.Mesh(this.ringGeometry, this.ctx.materials.trim);
    ring.rotation.x = Math.PI / 3;
    const glow = new THREE.Sprite(this.glowMaterial);
    glow.scale.setScalar(2.2);
    group.add(core, ring, glow);
    group.position.set(pos[0], pos[1], pos[2]);
    this.group.add(group);
    this.orbs.push({ group, ring, core, glow, base: group.position.clone(), phase: this.ctx.rng() * Math.PI * 2, active: true });
  }

  private addActivator(def: ActivatorDef): void {
    const group = new THREE.Group();
    const pad = new THREE.Mesh(this.padGeometry, this.ctx.materials.shellMid);
    pad.position.y = 0.1;
    pad.receiveShadow = true;
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      emissive: this.ctx.theme.accent,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    this.activatorMaterials.push(ringMaterial);
    const ring = new THREE.Mesh(this.padRingGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    const socket = new THREE.Mesh(this.coreGeometry, ringMaterial);
    socket.position.y = 0.55;
    socket.scale.setScalar(1.4);
    group.add(pad, ring, socket);
    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    this.group.add(group);
    this.activators.push({ def, position: group.position.clone(), group, ring, used: false });
  }

  /** Collects orbs within reach and triggers activators. */
  check(playerCenter: THREE.Vector3): void {
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      if (orb.group.position.distanceToSquared(playerCenter) > ENERGY.COLLECT_RADIUS * ENERGY.COLLECT_RADIUS) continue;
      this.collect(orb);
    }
    for (const activator of this.activators) {
      if (activator.used) continue;
      if (playerCenter.distanceToSquared(activator.position) > MECHANICS.ACTIVATOR_RADIUS * MECHANICS.ACTIVATOR_RADIUS) continue;
      if (this.count < activator.def.cost) continue;
      this.activate(activator);
    }
  }

  private collect(orb: Orb): void {
    orb.active = false;
    this.count += 1;
    this.scratch.copy(orb.group.position);
    this.ctx.particles.burst({
      position: this.scratch,
      count: 26,
      color: this.ctx.theme.accent,
      speed: 3.2,
      life: 0.7,
      size: 0.16,
      drag: 3,
    });
    this.ctx.tweens.tween(
      0.3,
      (t) => {
        orb.group.scale.setScalar(1 + 0.8 * (1 - t));
        orb.group.position.y = orb.base.y + t * 1.2;
        orb.glow.material.opacity = 0.6 * (1 - t);
      },
      easeOutCubic,
      () => {
        orb.group.visible = false;
        orb.glow.material.opacity = 0.6;
      },
    );
    this.ctx.bus.emit('energy:collected', { position: this.scratch, count: this.count, total: this.total });
    this.ctx.bus.emit('energy:changed', { count: this.count, required: this.required, total: this.total });
  }

  private activate(activator: Activator): void {
    activator.used = true;
    (activator.ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.6;
    const platforms = this.platformsByGroup.get(activator.def.group) ?? [];
    platforms.forEach((platform, index) => {
      platform.group.visible = true;
      platform.group.position.copy(platform.basePosition).y -= 3;
      platform.group.scale.setScalar(0.4);
      this.ctx.tweens.tween(
        0.6,
        (t) => {
          platform.group.position.y = platform.basePosition.y - 3 * (1 - t);
          platform.group.scale.setScalar(0.4 + 0.6 * t);
        },
        easeOutBack,
        () => {
          platform.group.position.copy(platform.basePosition);
          platform.group.scale.setScalar(1);
          platform.collider.enabled = true;
          this.ctx.world.refreshCollider(platform.collider);
          this.scratch.copy(platform.basePosition);
          this.ctx.particles.burst({ position: this.scratch, count: 18, color: this.ctx.theme.accent, speed: 2.5, life: 0.6, size: 0.14 });
        },
        index * 0.18,
      );
    });
    this.scratch.copy(activator.position);
    this.ctx.particles.burst({ position: this.scratch, count: 50, color: this.ctx.theme.accent, speed: 5, life: 0.9, size: 0.2, direction: new THREE.Vector3(0, 1, 0) });
    this.ctx.bus.emit('platform:activated', { id: activator.def.group, position: this.scratch });
  }

  /** Test helper: trigger every activator regardless of energy. */
  activateAll(): void {
    for (const activator of this.activators) if (!activator.used) this.activate(activator);
  }

  /** Test helper: grant energy without collecting orbs. */
  grant(amount: number): void {
    this.count = Math.min(this.total, this.count + amount);
    this.ctx.bus.emit('energy:changed', { count: this.count, required: this.required, total: this.total });
  }

  update(delta: number, elapsed: number): void {
    void delta;
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      orb.group.position.y = orb.base.y + Math.sin(elapsed * ENERGY.BOB_SPEED + orb.phase) * ENERGY.BOB_AMPLITUDE;
      orb.core.rotation.y = elapsed * ENERGY.SPIN_SPEED + orb.phase;
      orb.core.rotation.x = elapsed * ENERGY.SPIN_SPEED * 0.6;
      orb.ring.rotation.z = elapsed * ENERGY.SPIN_SPEED * 1.3 + orb.phase;
    }
    for (let i = 0; i < this.activators.length; i += 1) {
      const a = this.activators[i];
      if (a.used) continue;
      const ready = this.count >= a.def.cost;
      (a.ring.material as THREE.MeshStandardMaterial).emissiveIntensity = ready ? 1.6 + Math.sin(elapsed * 4) * 0.8 : 0.4;
      a.ring.rotation.z = elapsed * (ready ? 1.5 : 0.3);
    }
  }

  /** Stabilise idle animation for screenshots. */
  stabilize(): void {
    for (const orb of this.orbs) {
      orb.group.position.copy(orb.base);
      orb.core.rotation.set(0, 0, 0);
    }
  }

  get activatorCount(): number {
    return this.activators.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.coreGeometry.dispose();
    this.ringGeometry.dispose();
    this.padGeometry.dispose();
    this.padRingGeometry.dispose();
    this.glowMaterial.dispose();
    for (const material of this.activatorMaterials) material.dispose();
    this.orbs.length = 0;
    this.activators.length = 0;
  }
}
