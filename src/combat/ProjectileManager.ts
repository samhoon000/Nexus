import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { ParticleSystem } from '../effects/Particles';

export interface Projectile {
  id: string;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  maxLife: number;
  radius: number;
  color: number;
}

export class ProjectileManager {
  private projectiles: Projectile[] = [];
  private readonly scene: THREE.Scene;
  private readonly bus: EventBus;
  private readonly particles: ParticleSystem;
  private readonly sphereGeo = new THREE.SphereGeometry(0.22, 8, 8);
  private readonly materialPool = new Map<number, THREE.MeshStandardMaterial>();

  private readonly _projPos = new THREE.Vector3();
  private readonly _toProj = new THREE.Vector3();

  constructor(scene: THREE.Scene, bus: EventBus, particles: ParticleSystem) {
    this.scene = scene;
    this.bus = bus;
    this.particles = particles;
  }

  private getMaterial(color: number): THREE.MeshStandardMaterial {
    let mat = this.materialPool.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 3.5,
        roughness: 0.1,
        metalness: 0.2,
      });
      this.materialPool.set(color, mat);
    }
    return mat;
  }

  spawn(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed = 18,
    damage = 15,
    color = 0xff2200,
    radius = 0.25,
    maxLife = 4.0,
  ): void {
    if (this.projectiles.length > 36) {
      // Recycle oldest
      const old = this.projectiles.shift();
      if (old) {
        this.scene.remove(old.mesh);
      }
    }

    const mesh = new THREE.Mesh(this.sphereGeo, this.getMaterial(color));
    mesh.position.copy(origin);
    mesh.scale.setScalar(radius / 0.22);
    this.scene.add(mesh);

    const velocity = direction.clone().normalize().multiplyScalar(speed);
    this.projectiles.push({
      id: `proj-${Date.now()}-${Math.random().toFixed(4)}`,
      mesh,
      velocity,
      damage,
      life: 0,
      maxLife,
      radius,
      color,
    });

    // Muzzle flash particles
    this.particles.burst({
      position: origin.clone(),
      count: 8,
      color,
      speed: 3,
      spread: 0.6,
      life: 0.2,
      size: 0.12,
    });
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    playerFacing: THREE.Vector3,
    isPlayerShielding: boolean,
    onPlayerHit: (damage: number) => void,
  ): void {
    const alive: Projectile[] = [];

    for (const proj of this.projectiles) {
      proj.life += delta;
      proj.mesh.position.addScaledVector(proj.velocity, delta);

      // Trailing sparks occasionally
      if (Math.random() < 0.25) {
        this.particles.burst({
          position: proj.mesh.position.clone(),
          count: 2,
          color: proj.color,
          speed: 1,
          spread: 0.2,
          life: 0.2,
          size: 0.1,
        });
      }

      // Check collision with ground or limits
      if (proj.mesh.position.y <= 0.15 || proj.life >= proj.maxLife) {
        this.burstImpact(proj.mesh.position, proj.color, 8);
        this.scene.remove(proj.mesh);
        continue;
      }

      // Collision with player
      this._projPos.copy(proj.mesh.position);
      const distToPlayer = this._projPos.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)));

      if (distToPlayer < 1.1 + proj.radius) {
        this._toProj.subVectors(this._projPos, playerPos).normalize();
        this._toProj.y = 0;
        this._toProj.normalize();

        const facingDot = playerFacing.dot(this._toProj);

        if (isPlayerShielding && facingDot > 0.15) {
          // SHIELD DEFLECTS / BLOCKS PROJECTILE
          this.bus.emit('combat:blocked', undefined);
          this.burstImpact(this._projPos, 0x00f0ff, 22);
        } else {
          // PLAYER TAKES HIT
          this.burstImpact(this._projPos, 0xff2200, 18);
          onPlayerHit(proj.damage);
        }

        this.scene.remove(proj.mesh);
        continue;
      }

      alive.push(proj);
    }

    this.projectiles = alive;
  }

  private burstImpact(pos: THREE.Vector3, color: number, count = 12): void {
    this.particles.burst({
      position: pos.clone(),
      count,
      color,
      speed: 4.5,
      spread: 1.2,
      life: 0.35,
      size: 0.15,
    });
  }

  clear(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }

  dispose(): void {
    this.clear();
    this.sphereGeo.dispose();
    for (const mat of this.materialPool.values()) {
      mat.dispose();
    }
    this.materialPool.clear();
  }
}
