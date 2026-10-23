import * as THREE from 'three';
import type { CharacterRig } from '../player/CharacterRig';
import type { ProjectileManager } from './ProjectileManager';
import type { ParticleSystem } from '../effects/Particles';
import type { EventBus } from '../core/EventBus';

/**
 * NEXUS Cyan Knight Futuristic Armored Pulse Cannon / Dual Gun.
 * Matches the visual design:
 *  - Angular titanium/gunmetal receiver chassis
 *  - Dual cylindrical pulse barrels with bright cyan cooling vents
 *  - Circular glowing cyan power core cell
 *  - Flared muzzle aperture with glowing energy ring
 *  - Mounted to the hero's Left Hand (Hand_L), enabling simultaneous or dual sword-and-gun combat!
 */
export class ArmoredGun {
  readonly group = new THREE.Group();
  private readonly barrelGroup = new THREE.Group();
  private readonly muzzleTip = new THREE.Vector3();

  // Ammo / Energy Heat System
  energy = 100;
  readonly maxEnergy = 100;
  readonly energyCost = 15;
  readonly rechargeRate = 42; // regens per second

  // Combat stats
  readonly damage = 28;
  readonly projectileSpeed = 38;
  readonly projectileRadius = 0.28;
  private fireCooldown = 0;
  readonly fireCooldownDuration = 0.24; // Fast tactical pulse rate

  // Recoil animation
  private recoilOffset = 0;
  private recoilPitch = 0;

  // Materials
  readonly matChassis: THREE.MeshStandardMaterial;
  readonly matSpine: THREE.MeshStandardMaterial;
  readonly matCyanGlow: THREE.MeshStandardMaterial;
  readonly matCoreCell: THREE.MeshStandardMaterial;

  private isMaterialized = false;
  private elapsedTime = 0;

  constructor(rig: CharacterRig) {
    this.matChassis = new THREE.MeshStandardMaterial({
      color: 0x0c101a,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 2.2,
    });

    this.matSpine = new THREE.MeshStandardMaterial({
      color: 0xdde4f0,
      metalness: 0.95,
      roughness: 0.15,
      envMapIntensity: 2.5,
    });

    this.matCyanGlow = new THREE.MeshStandardMaterial({
      color: 0x001828,
      emissive: 0x00f0ff,
      emissiveIntensity: 3.2,
      metalness: 0.1,
      roughness: 0.15,
    });

    this.matCoreCell = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f0ff,
      emissiveIntensity: 4.5,
      metalness: 0.2,
      roughness: 0.1,
    });

    const s = rig.group.scale.x;
    const g = this.group;

    // --- Gun Body / Receiver ---
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.09 * s, 0.13 * s, 0.28 * s),
      this.matChassis,
    );
    receiver.position.set(0, 0.04 * s, 0.06 * s);
    g.add(receiver);

    // Silver side armor carapaces
    for (const sx of [-1, 1]) {
      const carapace = new THREE.Mesh(
        new THREE.BoxGeometry(0.02 * s, 0.09 * s, 0.22 * s),
        this.matSpine,
      );
      carapace.position.set(sx * 0.052 * s, 0.05 * s, 0.06 * s);
      g.add(carapace);

      // Cyan accent energy heat sink fins
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(0.015 * s, 0.02 * s, 0.04 * s),
          this.matCyanGlow,
        );
        fin.position.set(sx * 0.06 * s, (0.03 + i * 0.025) * s, (-0.02 + i * 0.06) * s);
        g.add(fin);
      }
    }

    // --- Circular Power Core Cell ---
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042 * s, 0.042 * s, 0.11 * s, 12),
      this.matCoreCell,
    );
    core.rotation.z = Math.PI / 2;
    core.position.set(0, 0.05 * s, 0.02 * s);
    g.add(core);

    // --- Dual Barrels & Muzzle Assembly ---
    this.barrelGroup.position.set(0, 0.04 * s, 0.2 * s);
    g.add(this.barrelGroup);

    // Top Barrel
    const barrelTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026 * s, 0.028 * s, 0.24 * s, 8),
      this.matChassis,
    );
    barrelTop.rotation.x = Math.PI / 2;
    barrelTop.position.set(0, 0.02 * s, 0.1 * s);
    this.barrelGroup.add(barrelTop);

    // Bottom Barrel
    const barrelBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022 * s, 0.024 * s, 0.22 * s, 8),
      this.matChassis,
    );
    barrelBottom.rotation.x = Math.PI / 2;
    barrelBottom.position.set(0, -0.02 * s, 0.09 * s);
    this.barrelGroup.add(barrelBottom);

    // Flared Cyan Muzzle Tip
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035 * s, 0.025 * s, 0.06 * s, 8),
      this.matCyanGlow,
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0, 0.22 * s);
    this.barrelGroup.add(muzzle);

    // Handle Grip
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022 * s, 0.02 * s, 0.14 * s, 8),
      this.matChassis,
    );
    handle.rotation.x = -0.35;
    handle.position.set(0, -0.06 * s, -0.04 * s);
    g.add(handle);

    // Mount to Hero's Left Hand
    g.rotation.set(Math.PI / 2.2, 0, 0.15);
    g.position.set(-0.02 * s, 0.04 * s, 0.14 * s);
    rig.bones.Hand_L.add(g);

    this.hide();
  }

  get isReadyToFire(): boolean {
    return this.isMaterialized && this.fireCooldown <= 0 && this.energy >= this.energyCost;
  }

  snapVisible(): void {
    this.group.visible = true;
    this.isMaterialized = true;
    this.matCyanGlow.emissiveIntensity = 3.2;
    this.matCoreCell.emissiveIntensity = 4.5;
  }

  hide(): void {
    this.group.visible = false;
    this.isMaterialized = false;
  }

  getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.barrelGroup.getWorldPosition(out);
    const s = this.group.scale.x || 1;
    out.y += 0.04 * s;
    return out;
  }

  fire(
    _origin: THREE.Vector3,
    direction: THREE.Vector3,
    projectiles: ProjectileManager,
    particles: ParticleSystem,
    bus: EventBus,
  ): boolean {
    if (!this.isReadyToFire) return false;

    this.fireCooldown = this.fireCooldownDuration;
    this.energy = Math.max(0, this.energy - this.energyCost);

    // Apply recoil
    this.recoilOffset = 0.06;
    this.recoilPitch = 0.22;

    // Calculate spawn position at the muzzle
    this.getMuzzleWorldPosition(this.muzzleTip);

    // Spawn player plasma bolt
    projectiles.spawn(
      this.muzzleTip,
      direction,
      this.projectileSpeed,
      this.damage,
      0x00f0ff,
      this.projectileRadius,
      3.5,
      'player',
    );

    // Muzzle flash particle burst
    particles.burst({
      position: this.muzzleTip.clone(),
      count: 16,
      color: 0x00f0ff,
      speed: 7,
      spread: 0.6,
      life: 0.25,
      size: 0.16,
    });

    bus.emit('combat:gun_fire', {
      position: this.muzzleTip.clone(),
      direction: direction.clone(),
    });

    return true;
  }

  update(delta: number): void {
    this.elapsedTime += delta;

    // Cooldown countdown
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);

    // Energy regeneration
    if (this.energy < this.maxEnergy) {
      this.energy = Math.min(this.maxEnergy, this.energy + this.rechargeRate * delta);
    }

    // Pulse core glow
    if (this.isMaterialized) {
      const pulse = Math.sin(this.elapsedTime * 6) * 0.4;
      this.matCoreCell.emissiveIntensity = 4.0 + pulse;
    }

    // Recoil recovery spring
    if (this.recoilOffset > 0 || this.recoilPitch > 0) {
      this.recoilOffset = Math.max(0, this.recoilOffset - delta * 0.4);
      this.recoilPitch = Math.max(0, this.recoilPitch - delta * 1.5);
      this.barrelGroup.position.z = 0.2 - this.recoilOffset;
      this.group.rotation.x = Math.PI / 2.2 - this.recoilPitch;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.matChassis.dispose();
    this.matSpine.dispose();
    this.matCyanGlow.dispose();
    this.matCoreCell.dispose();
  }
}
