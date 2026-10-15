import * as THREE from 'three';
import type { Game } from '../core/Game';
import { easeInOutCubic, easeOutCubic } from '../effects/Tween';

/**
 * Stage 5 finale timeline: the player enters the chamber, energy transfers into the Core, the Core
 * ignites, the world powers up in waves, the camera pulls back, the music peaks, then the end
 * screen appears.
 */
export class CoreSequence {
  private time = 0;
  private done = false;
  private readonly coreCenter = new THREE.Vector3();
  private readonly cameraPos = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private coreMaterial: THREE.MeshStandardMaterial | null = null;
  private ringMaterial: THREE.MeshStandardMaterial | null = null;
  private coreOrb: THREE.Object3D | null = null;
  private wavesFired = 0;
  private ignited = false;
  private readonly fired = new Set<string>();

  constructor(
    private readonly game: Game,
    private readonly onComplete: () => void,
  ) {}

  start(): void {
    const game = this.game;
    const core = game.world.root.getObjectByName('decor-core');
    if (core) {
      this.coreOrb = core.getObjectByName('coreOrb') ?? null;
      const mesh = this.coreOrb as THREE.Mesh | null;
      if (mesh && mesh.material) this.coreMaterial = mesh.material as THREE.MeshStandardMaterial;
      const ring = core.getObjectByName('coreRing0') as THREE.Mesh | null;
      if (ring && ring.material) this.ringMaterial = ring.material as THREE.MeshStandardMaterial;
      this.coreOrb?.getWorldPosition(this.coreCenter);
    } else {
      this.coreCenter.copy(game.player.position).add(new THREE.Vector3(0, 8, -14));
    }
    // Cinematic camera: start near the player looking at the Core, then pull back and up.
    this.lookAt.copy(this.coreCenter);
    this.cameraPos.copy(game.player.position).add(new THREE.Vector3(10, 2, 22));
    game.cameraController.cinematicTarget = this.lookAt;
    game.cameraController.cinematicPosition = this.cameraPos;
    game.player.controller.facing.subVectors(this.coreCenter, game.player.position).setY(0).normalize();
    game.audio.setMusicIntensity(0.95);
  }

  update(delta: number): void {
    if (this.done) return;
    const game = this.game;
    this.time += delta;
    const t = this.time;

    // 0.0 – 1.6s: energy streams from the player into the Core.
    if (t > 0.4 && t < 1.8 && Math.floor(t * 30) % 2 === 0) {
      this.scratch.subVectors(this.coreCenter, game.player.position).normalize();
      game.particles.burst({
        position: game.player.position,
        count: 6,
        color: 0x19e6ff,
        speed: 14,
        spread: 0.15,
        direction: this.scratch,
        life: 0.9,
        size: 0.22,
        drag: 0.2,
      });
    }

    // 1.8s: ignition.
    if (t >= 1.8 && !this.ignited) {
      this.ignited = true;
      game.bus.emit('core:ignite', { position: this.coreCenter });
      game.cameraController.addTrauma(0.6);
      game.cameraController.punchFov(8);
      game.particles.burst({ position: this.coreCenter, count: 220, color: 0xdff6ff, speed: 10, life: 1.6, size: 0.3, drag: 1.2 });
      game.tweens.tween(1.2, (k) => game.scene.post.setFlash(0.9 * (1 - k), 0xdff6ff), easeOutCubic);
    }

    // Power ramps 0 → 1 between 1.8s and 6s; the sky and background respond.
    const power = THREE.MathUtils.clamp((t - 1.8) / 4.2, 0, 1);
    game.environment.setPower(easeInOutCubic(power));
    if (this.coreMaterial) this.coreMaterial.emissiveIntensity = 0.6 + power * 2.6 + (this.ignited ? Math.sin(t * 6) * 0.4 : 0);
    if (this.ringMaterial) this.ringMaterial.emissiveIntensity = 0.45 + power * 1.4;
    if (this.coreOrb) {
      const s = 1 + power * 0.6 + (this.ignited ? Math.sin(t * 4) * 0.04 : 0);
      this.coreOrb.scale.setScalar(s);
      this.coreOrb.rotation.y += delta * (0.4 + power * 2);
    }

    // Illumination waves every 0.7s after ignition.
    if (this.ignited && t > 2.4 + this.wavesFired * 0.7 && this.wavesFired < 6) {
      this.wavesFired += 1;
      game.bus.emit('core:wave', { index: this.wavesFired });
      const radius = 4 + this.wavesFired * 6;
      for (let i = 0; i < 24; i += 1) {
        const a = (i / 24) * Math.PI * 2;
        this.scratch.set(this.coreCenter.x + Math.cos(a) * radius, this.coreCenter.y - 2 + Math.sin(i) * 2, this.coreCenter.z + Math.sin(a) * radius);
        game.particles.burst({ position: this.scratch, count: 3, color: 0x19e6ff, speed: 2, life: 1.2, size: 0.25, drag: 1 });
      }
      game.cameraController.addTrauma(0.15);
    }

    // Camera pull-back: slowly away and up over 8 seconds.
    const pull = easeInOutCubic(THREE.MathUtils.clamp(t / 8.5, 0, 1));
    this.cameraPos.set(
      this.coreCenter.x + 10 + pull * 26,
      this.coreCenter.y - 10 + pull * 24,
      this.coreCenter.z + 34 + pull * 46,
    );
    this.lookAt.copy(this.coreCenter).y += pull * 6;

    if (t > 7 && !this.fired.has('climax')) {
      this.fired.add('climax');
      game.audio.setMusicIntensity(1);
    }

    if (t >= 9.2) {
      this.done = true;
      this.onComplete();
    }
  }

  dispose(): void {
    this.done = true;
    this.game.cameraController.cinematicTarget = null;
    this.game.cameraController.cinematicPosition = null;
  }
}
