import * as THREE from 'three';
import type { Game } from '../core/Game';
import { easeInOutCubic, easeOutCubic } from '../effects/Tween';
import { ArmorSystem } from '../combat/ArmorSystem';
import { EnergySword } from '../combat/EnergySword';

/**
 * STAGE 5 CORE FINALE - 9-Step Cyan Knight Awakening Cinematic.
 *
 * Sequence steps:
 *  1. The Core releasing cyan and violet energy (0.0 - 1.5s)
 *  2. Energy travelling from the Core into the hero (1.5 - 3.0s)
 *  3. The helmet assembling around the hero's head (3.0 - 4.2s)
 *  4. The chest plate and glowing circular reactor forming (4.2 - 5.4s)
 *  5. The shoulder plates and arm armor attaching (5.4 - 6.6s)
 *  6. The waist, hip, thigh, and knee armor forming (6.6 - 7.8s)
 *  7. The shin armor and boots completing the suit (7.8 - 9.0s)
 *  8. The energy sword materializing and attaching to hero's hand (9.0 - 10.2s)
 *  9. The completed Cyan Knight revealing the finished armor (10.2 - 12.0s)
 *
 * The transformation always runs to completion before Stage 5 is recorded.
 */
export class CoreSequence {
  private time = 0;
  private done = false;
  private readonly coreCenter = new THREE.Vector3();
  private readonly cameraPos = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly hiddenObjects: Array<{ object: THREE.Object3D; visible: boolean }> = [];
  private coreMaterial: THREE.MeshStandardMaterial | null = null;
  private ringMaterial: THREE.MeshStandardMaterial | null = null;
  private coreOrb: THREE.Object3D | null = null;
  private wavesFired = 0;
  private ignited = false;

  armor: ArmorSystem | null = null;
  sword: EnergySword | null = null;

  private readonly executedSteps = new Set<number>();

  private readonly captions: Array<{ time: number; text: string }> = [
    { time: 0.2, text: 'NEXUS PROTOCOL: Core energy resonance critical.' },
    { time: 1.5, text: 'NEXUS PROTOCOL: Guardian synchronization initiated.' },
    { time: 3.0, text: 'Suit Assembly: HELMET FORMED - VISOR ONLINE' },
    { time: 4.2, text: 'Suit Assembly: CHEST CARAPACE & CIRCULAR REACTOR ENGAGED' },
    { time: 5.4, text: 'Suit Assembly: ANGULAR PAULDRONS & GAUNTLETS LOCKED' },
    { time: 6.6, text: 'Suit Assembly: ARMORED WAIST, HIPS & THIGH CHASSIS' },
    { time: 7.8, text: 'Suit Assembly: GREAVES, SABATONS & CAPE DEPLOYED' },
    { time: 9.0, text: 'Weapon Matrix: OVERSIZED ENERGY BROADSWORD MATERIALIZED' },
    { time: 10.4, text: 'NEXUS PROTOCOL: CYAN KNIGHT AWAKENED' },
  ];
  private captionIdx = 0;

  constructor(
    private readonly game: Game,
    private readonly onComplete: () => void,
  ) {}

  start(): void {
    const game = this.game;
    for (const name of ['static-batches', 'portal', 'decor-core']) {
      const object = game.world.root.getObjectByName(name);
      if (!object) continue;
      this.hiddenObjects.push({ object, visible: object.visible });
      object.visible = false;
    }
    for (const platform of game.stages.instance?.platforms ?? []) {
      this.hiddenObjects.push({ object: platform.group, visible: platform.group.visible });
      platform.group.visible = false;
    }
    const core = game.world.root.getObjectByName('decor-core');
    if (core) {
      this.coreOrb = core.getObjectByName('coreOrb') ?? null;
      const mesh = this.coreOrb as THREE.Mesh | null;
      if (mesh?.material) this.coreMaterial = mesh.material as THREE.MeshStandardMaterial;
      const ring = core.getObjectByName('coreRing0') as THREE.Mesh | null;
      if (ring?.material) this.ringMaterial = ring.material as THREE.MeshStandardMaterial;
      this.coreOrb?.getWorldPosition(this.coreCenter);
    } else {
      this.coreCenter.copy(game.player.position).add(new THREE.Vector3(0, 8, -14));
    }

    game.player.controller.facing
      .subVectors(this.coreCenter, game.player.position)
      .setY(0)
      .normalize();
    const facing = game.player.controller.facing;
    this.cameraRight.crossVectors(facing, game.player.physics.up).normalize();
    this.lookAt.copy(game.player.position).addScaledVector(game.player.physics.up, 0.75);
    this.cameraPos.copy(game.player.position)
      .addScaledVector(facing, 3.7)
      .addScaledVector(this.cameraRight, 1.7)
      .addScaledVector(game.player.physics.up, 1.8);
    game.cameraController.cinematicTarget = this.lookAt;
    game.cameraController.cinematicPosition = this.cameraPos;

    game.audio.setMusicIntensity(0.95);

    // Build the Cyan Knight armor and oversized sword on the character rig
    const rig = game.player.model.character;
    if (rig) {
      this.armor = new ArmorSystem(rig);
      this.sword = new EnergySword(rig);
    }

  }

  update(delta: number): void {
    if (this.done) return;
    const game = this.game;

    this.time += delta;
    const t = this.time;

    this.armor?.update(delta);
    this.sword?.update(delta);

    // Show Captions
    while (this.captionIdx < this.captions.length && t >= this.captions[this.captionIdx].time) {
      showAwakeningCaption(this.captions[this.captionIdx].text);
      this.captionIdx++;
    }

    // -------------------------------------------------------------------------
    // STEP 1: Core releasing cyan & violet energy (0.0 - 1.5s)
    // -------------------------------------------------------------------------
    if (t < 1.5) {
      this.scratch.subVectors(this.coreCenter, game.player.position).normalize();
      game.particles.burst({
        position: this.coreCenter.clone(),
        count: 12,
        color: t % 0.2 < 0.1 ? 0x00f0ff : 0x8a5cff,
        speed: 10,
        spread: 1.5,
        life: 0.8,
        size: 0.28,
        drag: 0.4,
      });
    }

    // Core ignition burst at 1.5s
    if (t >= 1.5 && !this.ignited) {
      this.ignited = true;
      game.bus.emit('core:ignite', { position: this.coreCenter });
      game.cameraController.addTrauma(0.65);
      game.cameraController.punchFov(7);
      game.particles.burst({
        position: this.coreCenter.clone(),
        count: 240,
        color: 0x00f0ff,
        speed: 12,
        life: 1.8,
        size: 0.32,
        drag: 1.0,
      });
      game.tweens.tween(
        1.2,
        (k) => game.scene.post.setFlash(0.9 * (1 - k), 0x00f0ff),
        easeOutCubic,
      );
    }

    // -------------------------------------------------------------------------
    // STEP 2: Energy travelling from the Core into the hero (1.5 - 3.0s)
    // -------------------------------------------------------------------------
    if (t >= 1.5 && t < 3.0) {
      const beamDir = this.scratch.subVectors(game.player.position, this.coreCenter).normalize();
      game.particles.burst({
        position: this.coreCenter.clone(),
        count: 8,
        color: 0x00f0ff,
        speed: 16,
        spread: 0.25,
        direction: beamDir.clone(),
        life: 0.7,
        size: 0.26,
        drag: 0.1,
      });
    }

    // -------------------------------------------------------------------------
    // STEP 3: Helmet assembling around hero's head (3.0s)
    // -------------------------------------------------------------------------
    if (t >= 3.0 && !this.executedSteps.has(3)) {
      this.executedSteps.add(3);
      this.armor?.setStep(3);
      game.cameraController.addTrauma(0.35);
      game.particles.burst({
        position: game.player.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
        count: 45,
        color: 0x00f0ff,
        speed: 6,
        spread: 0.8,
        life: 0.6,
        size: 0.22,
      });
    }

    // -------------------------------------------------------------------------
    // STEP 4: Chest plate and glowing circular reactor forming (4.2s)
    // -------------------------------------------------------------------------
    if (t >= 4.2 && !this.executedSteps.has(4)) {
      this.executedSteps.add(4);
      this.armor?.setStep(4);
      game.cameraController.addTrauma(0.45);
      game.particles.burst({
        position: game.player.position.clone().add(new THREE.Vector3(0, 1.3, 0.2)),
        count: 60,
        color: 0x00f0ff,
        speed: 7,
        spread: 1.2,
        life: 0.7,
        size: 0.25,
      });
    }

    // -------------------------------------------------------------------------
    // STEP 5: Shoulder plates and arm armor attaching (5.4s)
    // -------------------------------------------------------------------------
    if (t >= 5.4 && !this.executedSteps.has(5)) {
      this.executedSteps.add(5);
      this.armor?.setStep(5);
      game.cameraController.addTrauma(0.38);
      for (const sx of [-0.4, 0.4]) {
        game.particles.burst({
          position: game.player.position.clone().add(new THREE.Vector3(sx, 1.4, 0)),
          count: 35,
          color: 0x8a5cff,
          speed: 5.5,
          spread: 0.7,
          life: 0.5,
          size: 0.2,
        });
      }
    }

    // -------------------------------------------------------------------------
    // STEP 6: Waist, hip, thigh, and knee armor forming (6.6s)
    // -------------------------------------------------------------------------
    if (t >= 6.6 && !this.executedSteps.has(6)) {
      this.executedSteps.add(6);
      this.armor?.setStep(6);
      game.cameraController.addTrauma(0.35);
      game.particles.burst({
        position: game.player.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
        count: 50,
        color: 0x00f0ff,
        speed: 6,
        spread: 1.1,
        life: 0.6,
        size: 0.22,
      });
    }

    // -------------------------------------------------------------------------
    // STEP 7: Shin armor and boots completing the suit (7.8s)
    // -------------------------------------------------------------------------
    if (t >= 7.8 && !this.executedSteps.has(7)) {
      this.executedSteps.add(7);
      this.armor?.setStep(7);
      game.cameraController.addTrauma(0.48);
      // Ground shockwave
      game.particles.burst({
        position: game.player.position.clone(),
        count: 70,
        color: 0x00f0ff,
        speed: 8,
        spread: 2.5,
        life: 0.75,
        size: 0.24,
      });
    }

    // -------------------------------------------------------------------------
    // STEP 8: Energy sword materializing and attaching to hero's hand (9.0s)
    // -------------------------------------------------------------------------
    if (t >= 9.0 && !this.executedSteps.has(8)) {
      this.executedSteps.add(8);
      this.sword?.materialize(1.2);
      game.cameraController.addTrauma(0.4);
      game.particles.burst({
        position: game.player.position.clone().add(new THREE.Vector3(0.5, 1.1, 0.4)),
        count: 55,
        color: 0x00f0ff,
        speed: 6.5,
        spread: 1.2,
        life: 0.8,
        size: 0.22,
      });
    }

    // -------------------------------------------------------------------------
    // STEP 9: Completed Cyan Knight revealing the finished armor (10.2 - 12.0s)
    // -------------------------------------------------------------------------
    if (t >= 10.2 && !this.executedSteps.has(9)) {
      this.executedSteps.add(9);
      this.armor?.setStep(9);
      this.armor?.snapVisible();
      this.sword?.snapVisible();

      if (this.armor && this.sword) {
        game.combat?.setAwakened(this.armor, this.sword);
      }

      game.audio.setMusicIntensity(1.0);
      game.cameraController.addTrauma(0.5);
      game.cameraController.punchFov(6);
    }

    // Ambient Core pulsation & lighting waves
    const power = THREE.MathUtils.clamp((t - 1.5) / 6.0, 0, 1);
    game.environment.setPower(easeInOutCubic(power));
    if (this.coreMaterial) {
      this.coreMaterial.emissiveIntensity =
        0.8 + power * 2.8 + (this.ignited ? Math.sin(t * 7) * 0.4 : 0);
    }
    if (this.ringMaterial) {
      this.ringMaterial.emissiveIntensity = 0.5 + power * 1.5;
    }
    if (this.coreOrb) {
      const sc = 1 + power * 0.5 + (this.ignited ? Math.sin(t * 4) * 0.05 : 0);
      this.coreOrb.scale.setScalar(sc);
      this.coreOrb.rotation.y += delta * (0.4 + power * 2.2);
    }

    // Illumination waves
    if (this.ignited && t > 1.8 + this.wavesFired * 0.75 && this.wavesFired < 6) {
      this.wavesFired++;
      const radius = 5 + this.wavesFired * 5;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        this.scratch.set(
          this.coreCenter.x + Math.cos(a) * radius,
          this.coreCenter.y - 2,
          this.coreCenter.z + Math.sin(a) * radius,
        );
        game.particles.burst({
          position: this.scratch.clone(),
          count: 3,
          color: 0x00f0ff,
          speed: 2,
          life: 1.0,
          size: 0.22,
          drag: 1,
        });
      }
    }

    // Complete sequence at 12.0s
    if (t >= 12.0) {
      this.finishSequence();
    }
  }

  private finishSequence(): void {
    this.done = true;
    this.restoreSceneVisibility();
    this.onComplete();
  }

  dispose(): void {
    this.done = true;
    this.restoreSceneVisibility();
    this.game.cameraController.cinematicTarget = null;
    this.game.cameraController.cinematicPosition = null;
  }

  private restoreSceneVisibility(): void {
    for (const { object, visible } of this.hiddenObjects) object.visible = visible;
    this.hiddenObjects.length = 0;
  }
}

function showAwakeningCaption(text: string): void {
  let el = document.getElementById('nexus-cinematic-caption');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nexus-cinematic-caption';
    el.style.cssText = [
      'position:fixed', 'bottom:14%', 'left:50%', 'transform:translateX(-50%)',
      'color:#00f0ff', 'font-family:Orbitron,Segoe UI,monospace',
      'font-size:clamp(13px,1.9vw,19px)', 'font-weight:bold',
      'text-align:center', 'pointer-events:none', 'z-index:900',
      'text-shadow:0 0 14px #00f0ff,0 0 28px rgba(0,240,255,0.6)',
      'letter-spacing:0.16em', 'max-width:90vw',
      'transition:opacity 0.35s', 'background:rgba(4,8,18,0.7)',
      'padding:8px 24px', 'border-radius:4px', 'border:1px solid rgba(0,240,255,0.4)',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';

  clearTimeout((el as unknown as { _timer?: number })._timer);
  (el as unknown as { _timer?: number })._timer = window.setTimeout(() => {
    if (el) el.style.opacity = '0';
  }, 2600);
}
