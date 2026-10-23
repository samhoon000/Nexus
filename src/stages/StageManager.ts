import * as THREE from 'three';
import type { StageDefinition } from './StageTypes';
import type { StageContext } from './StageContext';
import { buildStage, type StageInstance } from './StageBuilder';
import type { Player } from '../player/Player';
import type { MoveIntent } from '../player/PlayerController';
import type { CameraController } from '../camera/CameraController';
import { createPlatform, type Platform } from '../world/Platforms';
import type { TweenHandle } from '../effects/Tween';
import { PLAYER, PLAYER_CENTER_HEIGHT } from '../utils/Constants';
import type { PlayerDeathCause } from '../core/EventBus';
import { STAGE_1 } from './Stage1';
import { STAGE_2 } from './Stage2';
import { STAGE_3 } from './Stage3';
import { STAGE_4 } from './Stage4';
import { STAGE_5 } from './Stage5';
import { STAGE_6 } from './Stage6';
import { STAGE_7 } from './Stage7';
import { STAGE_8 } from './Stage8';
import { STAGE_9 } from './Stage9';
import { STAGE_10 } from './Stage10';

export const STAGES: StageDefinition[] = [
  STAGE_1,
  STAGE_2,
  STAGE_3,
  STAGE_4,
  STAGE_5,
  STAGE_6,
  STAGE_7,
  STAGE_8,
  STAGE_9,
  STAGE_10,
];

export interface RunStats {
  totalTime: number;
  stageTime: number;
  energy: number;
  energyTotal: number;
  deaths: number;
  stagesCompleted: number;
}

export interface StageManagerCallbacks {
  onStageComplete(def: StageDefinition): void;
  onFinaleReached(def: StageDefinition): void;
}

/**
 * Loads and unloads stages, runs the per-step gameplay triggers, and handles death/respawn.
 */
export class StageManager {
  instance: StageInstance | null = null;
  readonly stats: RunStats = { totalTime: 0, stageTime: 0, energy: 0, energyTotal: 0, deaths: 0, stagesCompleted: 0 };
  /** True while the death fade plays; gameplay input is ignored. */
  dying = false;
  private deathTimer = 0;
  private gravityPending = 0;
  private readonly scratch = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private completed = false;
  private portalEntryArmed = true;
  private finaleStarted = false;
  private finaleComplete = false;
  private finaleRiseStarted = false;
  private readonly finaleRiseTweens: TweenHandle[] = [];
  private deathCause: Exclude<PlayerDeathCause, 'manual'> | null = null;
  lastDeathCause: Exclude<PlayerDeathCause, 'manual'> | null = null;

  constructor(
    private readonly ctx: StageContext,
    private readonly player: Player,
    private readonly camera: CameraController,
    private readonly callbacks: StageManagerCallbacks,
  ) {
    this.ctx.bus.on('stage:portal:unlock', ({ stage }) => {
      this.materializeCompletionPortal(stage);
    });
  }

  materializeCompletionPortal(stageId: number): void {
    const stage = this.instance;
    if (!stage || stage.def.id !== stageId || stage.portal.isOpen) return;
    stage.portal.group.visible = true;
    stage.portal.setOpen(true);
    const pos = stage.portal.position.clone();
    pos.y += 2.9;
    this.ctx.particles.burst({
      position: pos,
      count: 120,
      color: 0x00f0ff,
      speed: 7.0,
      spread: 3.0,
      life: 1.8,
      size: 0.25,
    });
    this.camera.punchFov(4);
    this.camera.addTrauma(0.3);
  }

  beginFinaleSequence(): void {
    const stage = this.instance;
    if (!stage || stage.def.id !== 5) return;
    this.finaleStarted = true;
    stage.portal.setOpen(false);
    stage.portal.group.visible = false;
  }

  completeFinale(): boolean {
    const stage = this.instance;
    if (!stage || stage.def.id !== 5 || this.finaleComplete) return false;
    stage.portal.group.visible = true;
    stage.portal.setOpen(false);
    this.completed = false;
    this.finaleStarted = true;
    this.finaleComplete = true;
    this.portalEntryArmed = false;
    this.materializeCompletionPortal(5);
    this.raiseFinaleExitPlatforms();
    return true;
  }

  private raiseFinaleExitPlatforms(): void {
    const stage = this.instance;
    if (!stage || stage.def.id !== 5 || this.finaleRiseStarted) return;
    this.finaleRiseStarted = true;

    const position: [number, number, number] = [20, 17, -122.5];
    const platform = createPlatform({
      id: 'stage5-exit-rise',
      pos: position,
      size: [3.2, 0.6, 2.8],
      style: 'core',
      colliderOnly: true,
    }, this.ctx.materials);
    this.addFinaleExitVisual(platform);
    platform.group.position.y -= 4.5;
    platform.collider.enabled = false;
    this.ctx.world.addPlatform(platform);
    stage.platforms.push(platform);
    this.ctx.world.refreshCollider(platform.collider);

    const startY = platform.group.position.y;
    this.finaleRiseTweens.push(this.ctx.tweens.tween(
      1.5,
      (t) => {
        platform.group.position.y = startY + (position[1] - startY) * t;
        this.ctx.world.refreshCollider(platform.collider);
      },
      undefined,
      () => {
        if (this.instance !== stage) return;
        platform.group.position.y = position[1];
        this.ctx.world.refreshCollider(platform.collider);
        platform.collider.enabled = true;
      },
    ));
  }

  private addFinaleExitVisual(platform: Platform): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    platform.ownedGeometry = geometry;
    const addBox = (material: THREE.Material, pos: [number, number, number], size: [number, number, number]): void => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...pos);
      mesh.scale.set(...size);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      platform.group.add(mesh);
    };

    addBox(this.ctx.materials.shellDark, [0, -0.3, 0], [3.2, 0.6, 2.8]);
    addBox(this.ctx.materials.shellMid, [0, -0.04, 0], [3, 0.08, 2.6]);
    for (const x of [-1.42, 1.42]) {
      for (const z of [-1.22, 1.22]) addBox(this.ctx.materials.shellMid, [x, -0.2, z], [0.24, 0.36, 0.24]);
    }
    addBox(this.ctx.materials.emissiveWhite, [0, -0.01, 1.34], [2.8, 0.05, 0.06]);
    addBox(this.ctx.materials.emissiveWhite, [0, -0.01, -1.34], [2.8, 0.05, 0.06]);
    addBox(this.ctx.materials.emissiveWhite, [1.54, -0.01, 0], [0.06, 0.05, 2.35]);
    addBox(this.ctx.materials.emissiveWhite, [-1.54, -0.01, 0], [0.06, 0.05, 2.35]);
  }

  get current(): StageDefinition | null {
    return this.instance?.def ?? null;
  }

  get stageIndex(): number {
    return this.instance?.def.id ?? 0;
  }

  load(stageId: number): StageInstance {
    this.cancelFinalePlatformRise();
    this.unload();
    const def = STAGES[Math.min(STAGES.length, Math.max(1, stageId)) - 1];
    this.ctx.theme = def.theme;
    this.instance = buildStage(def, this.ctx);
    this.stats.stageTime = 0;
    this.completed = false;
    this.portalEntryArmed = true;
    this.finaleStarted = false;
    this.finaleComplete = false;
    this.finaleRiseStarted = false;
    this.dying = false;
    this.deathTimer = 0;
    if (def.id === 5) {
      this.instance.portal.group.visible = false;
      this.instance.portal.setOpen(false);
    }
    if (def.id > 6) {
      this.instance.portal.group.visible = false;
      this.instance.portal.isOpen = false;
    }
    this.spawnAtStart();
    if (def.id === 6) this.materializeCompletionPortal(6);
    this.ctx.bus.emit('stage:loaded', {
      stage: def.id,
      name: def.name,
      energyRequired: this.instance.energy.required,
      energyTotal: this.instance.energy.total,
    });
    this.ctx.bus.emit('energy:changed', { count: 0, required: this.instance.energy.required, total: this.instance.energy.total });
    return this.instance;
  }

  unload(): void {
    this.cancelFinalePlatformRise();
    if (!this.instance) return;
    this.instance.dispose();
    this.instance = null;
  }

  private cancelFinalePlatformRise(): void {
    for (const tween of this.finaleRiseTweens) tween.cancel();
    this.finaleRiseTweens.length = 0;
  }

  private spawnAtStart(): void {
    if (!this.instance) return;
    const def = this.instance.def;
    this.scratch.set(def.spawn[0], def.spawn[1], def.spawn[2]);
    this.player.spawnAt(this.scratch, def.spawnYaw);
    this.player.energyRatio = 0;
    this.camera.reset();
    this.camera.snapBehind(this.player.controller.facing, this.player.physics.up);
    this.instance.gravity.evaluate(this.player.position);
  }

  /** Fixed-step gameplay. `intent` carries the frame's input; `worldSpace` skips the camera basis. */
  fixedUpdate(dt: number, intent: MoveIntent, worldSpace = false): void {
    const stage = this.instance;
    if (!stage) return;
    this.stats.stageTime += dt;
    this.stats.totalTime += dt;

    stage.moving.update(dt);
    stage.disappearing.update(dt, this.player.physics.groundCollider);
    stage.hazards.update(dt);

    if (this.dying) {
      this.deathTimer += dt;
      if (this.deathTimer >= PLAYER.RESPAWN_DELAY) this.respawn();
      return;
    }

    if (worldSpace) {
      intent.forward.set(0, 0, -1);
      intent.right.set(1, 0, 0);
    } else {
      this.camera.getBasis(this.forward, this.right);
      intent.forward.copy(this.forward);
      intent.right.copy(this.right);
    }
    const jump = this.player.fixedUpdate(dt, intent, this.ctx.world.colliders);
    const physics = this.player.physics;

    if (jump !== 'none') {
      this.ctx.bus.emit('player:jump', { position: physics.position, double: jump === 'double' });
      this.player.animation.jump(jump === 'double');
      this.camera.addKick(-0.1);
      this.spawnJumpParticles(jump === 'double');
    }
    if (physics.justLanded) {
      const impact = physics.landingSpeed;
      this.ctx.bus.emit('player:land', { position: physics.position, impact });
      this.player.animation.land(impact);
      this.camera.addKick(Math.min(0.3, impact * 0.012));
      if (impact > 8) this.camera.addTrauma(Math.min(0.35, impact * 0.012));
      this.spawnLandParticles(impact);
    }

    // Gravity zones.
    if (stage.gravity.evaluate(physics.position)) {
      physics.setUp(stage.gravity.current.up);
      physics.gravityScale = stage.gravity.current.scale;
      this.camera.setUp(physics.up);
      this.ctx.bus.emit('gravity:changed', { up: physics.up, scale: physics.gravityScale, position: physics.position });
      this.gravityPending = 1;
    }

    // Triggers.
    const teleport = stage.teleporters.check(physics.position, physics.up);
    if (teleport) {
      this.ctx.bus.emit('teleport', { from: teleport.from, to: teleport.position });
      this.spawnTeleportParticles(teleport.from, teleport.position);
      this.player.teleportTo(teleport.position, teleport.facing);
      this.camera.snapBehind(teleport.facing, physics.up);
      this.camera.addTrauma(0.2);
      this.camera.punchFov(6);
    }
    stage.checkpoints.check(physics.position, this.player.controller.facing);
    stage.energy.check(physics.position);
    this.player.energyRatio = stage.energy.total > 0 ? stage.energy.count / stage.energy.total : 0;
    this.stats.energy = this.collectedBeforeStage + stage.energy.count;
    if (stage.def.id < 5) {
      if (!stage.portal.isOpen && stage.energy.count >= stage.energy.required) stage.portal.setOpen(true);
    }

    const activation = stage.def.finaleActivation;
    if (stage.def.id === 5 && activation && !this.finaleStarted && !this.finaleComplete) {
      const dx = physics.position.x - activation.pos[0];
      const dy = physics.position.y - activation.pos[1];
      const dz = physics.position.z - activation.pos[2];
      if (dx * dx + dz * dz <= activation.radius * activation.radius && Math.abs(dy) <= 3.5) {
        this.finaleStarted = true;
        this.callbacks.onFinaleReached(stage.def);
        return;
      }
    }

    if (!this.portalEntryArmed && !stage.portal.check(physics.position)) this.portalEntryArmed = true;
    if (!this.completed && this.portalEntryArmed && stage.portal.check(physics.position)) {
      this.completed = true;
      if (stage.def.id === 5 && stage.def.finale) {
        if (!this.finaleComplete) this.callbacks.onFinaleReached(stage.def);
        else this.callbacks.onStageComplete(stage.def);
      } else {
        this.callbacks.onStageComplete(stage.def);
      }
      return;
    }

    // Death conditions.
    if (physics.hitHazard) this.die('hazard');
    else if (!stage.bounds.containsPoint(physics.position)) this.die('fall');
  }

  private collectedBeforeStage = 0;

  /** Per-frame visuals. */
  update(delta: number, elapsed: number): void {
    const stage = this.instance;
    if (!stage) return;
    stage.energy.update(delta, elapsed);
    stage.portal.update(elapsed);
    stage.checkpoints.update(elapsed);
    stage.teleporters.update(delta, elapsed);
    stage.gravity.update(elapsed);
    if (this.gravityPending > 0) this.gravityPending = Math.max(0, this.gravityPending - delta);
  }

  die(cause: Exclude<PlayerDeathCause, 'manual'>): void {
    if (this.dying || !this.instance) return;
    this.dying = true;
    this.deathCause = cause;
    this.lastDeathCause = cause;
    this.deathTimer = 0;
    this.stats.deaths += 1;
    this.camera.addTrauma(0.45);
    this.ctx.bus.emit('player:died', { position: this.player.position, cause });
    this.ctx.particles.burst({
      position: this.player.position,
      count: 50,
      color: cause === 'hazard' ? 0xff7a2a : cause === 'combat' ? 0xff1100 : this.instance.def.theme.accent,
      speed: 5,
      life: 0.8,
      size: 0.2,
    });
  }

  respawn(causeOverride?: PlayerDeathCause): void {
    const stage = this.instance;
    if (!stage) return;
    const cause = causeOverride ?? this.deathCause ?? 'manual';
    this.dying = false;
    this.deathTimer = 0;
    this.deathCause = null;
    stage.disappearing.reset();
    const spawn = stage.checkpoints.spawnPoint;
    const facing = stage.checkpoints.spawnFacing;
    this.player.spawnAt(spawn, Math.atan2(facing.x, facing.z));
    stage.gravity.evaluate(this.player.position);
    if (stage.gravity.current.up.y < 0.999) {
      this.player.physics.setUp(stage.gravity.current.up);
      this.player.physics.gravityScale = stage.gravity.current.scale;
    }
    this.camera.reset();
    this.camera.snapBehind(facing, this.player.physics.up);
    if (stage.def.id >= 7) this.ctx.bus.emit('combat:stage:restart', { stage: stage.def.id });
    this.ctx.bus.emit('player:respawn', {
      position: this.player.position.clone(),
      cause,
      checkpointId: stage.checkpoints.activeCheckpoint.id,
    });
    this.ctx.particles.burst({ position: this.player.position, count: 30, color: stage.def.theme.accent, speed: 2.5, life: 0.7, size: 0.16 });
  }

  /** Called by the flow when a stage was completed, to bank energy and count the stage. */
  bankStage(): void {
    if (!this.instance) return;
    this.collectedBeforeStage += this.instance.energy.count;
    this.stats.energyTotal += this.instance.energy.total;
    this.stats.stagesCompleted += 1;
  }

  resetRun(): void {
    this.collectedBeforeStage = 0;
    this.stats.totalTime = 0;
    this.stats.stageTime = 0;
    this.stats.energy = 0;
    this.stats.energyTotal = 0;
    this.stats.deaths = 0;
    this.stats.stagesCompleted = 0;
  }

  /** Test helper. */
  teleportPlayer(x: number, y: number, z: number): void {
    this.dying = false;
    this.deathTimer = 0;
    this.scratch.set(x, y, z).addScaledVector(this.player.physics.up, PLAYER_CENTER_HEIGHT);
    this.player.teleportTo(this.scratch);
    this.camera.reset();
    this.camera.snapBehind(this.player.controller.facing, this.player.physics.up);
  }

  private spawnJumpParticles(double: boolean): void {
    this.scratch.copy(this.player.position).addScaledVector(this.player.physics.up, -PLAYER_CENTER_HEIGHT + 0.1);
    this.ctx.particles.burst({
      position: this.scratch,
      count: double ? 22 : 10,
      color: this.instance?.def.theme.accent ?? 0x19e6ff,
      speed: double ? 3 : 1.6,
      spread: 1,
      life: 0.45,
      size: double ? 0.16 : 0.1,
      direction: this.player.physics.up.clone().multiplyScalar(-0.6),
    });
  }

  private spawnLandParticles(impact: number): void {
    this.scratch.copy(this.player.position).addScaledVector(this.player.physics.up, -PLAYER_CENTER_HEIGHT + 0.05);
    this.ctx.particles.burst({
      position: this.scratch,
      count: Math.min(30, 6 + Math.floor(impact * 1.2)),
      color: 0xdff6ff,
      speed: 1.2 + impact * 0.12,
      spread: 1,
      life: 0.4,
      size: 0.1,
      direction: new THREE.Vector3(0, 0.1, 0),
      drag: 5,
    });
  }

  private spawnTeleportParticles(from: THREE.Vector3, to: THREE.Vector3): void {
    const color = this.instance?.def.theme.accent ?? 0x19e6ff;
    this.ctx.particles.burst({ position: from, count: 40, color, speed: 4, life: 0.8, size: 0.18, direction: new THREE.Vector3(0, 1, 0) });
    this.ctx.particles.burst({ position: to, count: 40, color, speed: 4, life: 0.8, size: 0.18, direction: new THREE.Vector3(0, 1, 0) });
  }

  dispose(): void {
    this.unload();
  }
}
