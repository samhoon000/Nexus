import * as THREE from 'three';
import type { EventBus, ObjectiveInfo } from '../core/EventBus';
import type { ParticleSystem } from '../effects/Particles';
import { RobotEntity, type RobotType } from './RobotEntity';
import type { ArmorSystem } from './ArmorSystem';
import type { EnergySword } from './EnergySword';
import { ProjectileManager } from './ProjectileManager';

export interface CombatSystemConfig {
  scene: THREE.Scene;
  bus: EventBus;
  particles: ParticleSystem;
  playerGroup: THREE.Group;
  getPlayerPos: () => THREE.Vector3;
}

export interface CombatInputs {
  attackPressed: boolean;
  shieldHeld: boolean;
  rebootPressed: boolean;
}

export const COMPANION_LIMIT = 4;
export const ATTACK_DAMAGE = 42;
export const ATTACK_RANGE = 3.6;
export const REBOOT_RANGE = 2.8;

export interface WaveConfig {
  title: string;
  description: string;
  enemies: Array<{ type: RobotType; count: number }>;
}

export class CombatSystem {
  private robots: RobotEntity[] = [];
  private companions: RobotEntity[] = [];
  private readonly scene: THREE.Scene;
  private readonly bus: EventBus;
  private readonly particles: ParticleSystem;
  private readonly getPlayerPos: () => THREE.Vector3;
  private readonly playerGroup: THREE.Group;
  private readonly projectiles: ProjectileManager;
  private elapsed = 0;

  // Player combat stats
  playerHealth = 100;
  readonly playerMaxHealth = 100;
  isShielding = false;
  private attackCooldown = 0;
  private readonly attackCooldownDuration = 0.48;

  // Equipment
  armor: ArmorSystem | null = null;
  sword: EnergySword | null = null;
  private _awakened = false;

  // Energy Shield mesh
  private readonly shieldGroup = new THREE.Group();
  private readonly shieldMaterial: THREE.MeshStandardMaterial;

  // Mission & Wave Progression State
  currentStageId = 6;
  currentWaveIndex = 0;
  private wavesForStage: WaveConfig[] = [];
  waveObjectiveTarget = 0;
  waveObjectiveProgress = 0;
  missionFinished = false;
  private interWaveTimer = 0;
  private inInterWave = false;
  private arenaCenter = new THREE.Vector3(0, 0, 0);

  // Boss tracking
  private warlordBoss: RobotEntity | null = null;

  // Attack token coordination (limits simultaneous enemy strikes)
  private maxActiveMeleeAttackers = 2;
  private maxActiveRangedAttackers = 1;

  // Scratch
  private readonly _scratch = new THREE.Vector3();
  private readonly _tipScratch = new THREE.Vector3();
  private readonly _forwardScratch = new THREE.Vector3();

  constructor(config: CombatSystemConfig) {
    this.scene = config.scene;
    this.bus = config.bus;
    this.particles = config.particles;
    this.getPlayerPos = config.getPlayerPos;
    this.playerGroup = config.playerGroup;
    this.projectiles = new ProjectileManager(this.scene, this.bus, this.particles);

    // Build the visual Energy Shield barrier
    this.shieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x002436,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.8,
      transparent: true,
      opacity: 0.72,
      roughness: 0.1,
      metalness: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const shieldGeo = new THREE.CylinderGeometry(0.85, 0.95, 1.4, 6, 1, true, 0, Math.PI);
    const shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMaterial);
    shieldMesh.rotation.y = Math.PI / 2;
    shieldMesh.position.set(0, 1.0, 0.7);

    // Shield rim accent
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x19e6ff,
      emissiveIntensity: 4.0,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 24), rimMat);
    rimMesh.position.set(0, 1.0, 0.72);

    this.shieldGroup.add(shieldMesh, rimMesh);
    this.shieldGroup.visible = false;
    this.playerGroup.add(this.shieldGroup);
  }

  get awakened(): boolean {
    return this._awakened;
  }

  setAwakened(armor: ArmorSystem, sword: EnergySword): void {
    this._awakened = true;
    this.armor = armor;
    this.sword = sword;
  }

  /** Backward-compatible helper for Stage 6 */
  initStage6Mission(arenaCenter: THREE.Vector3): void {
    this.initStageMission(6, arenaCenter);
  }

  /**
   * Initializes the mission and wave progression for Stages 6–10.
   */
  initStageMission(stageId: number, arenaCenter: THREE.Vector3): void {
    this.clearAllRobots();
    this.projectiles.clear();
    this.playerHealth = this.playerMaxHealth;
    this.currentStageId = stageId;
    this.arenaCenter.copy(arenaCenter);
    this.currentWaveIndex = 0;
    this.missionFinished = false;
    this.inInterWave = false;
    this.interWaveTimer = 0;
    this.warlordBoss = null;

    // Build the wave configurations according to campaign design
    this.wavesForStage = this.buildWavesForStage(stageId);

    // Launch Wave 1
    this.startWave(0);
  }

  private buildWavesForStage(stageId: number): WaveConfig[] {
    switch (stageId) {
      case 6: // Stage 6: The Fallen Legion (Initial Invasion - 6 waves)
        return [
          {
            title: 'WAVE 1 — AWAKENING RECON',
            description: 'Neutralize the initial squad of 4 awakened red Grunts.',
            enemies: [{ type: 'grunt', count: 4 }],
          },
          {
            title: 'WAVE 2 — RANGED DEPLOYMENT',
            description: 'Enemy Rangers deployed. Block incoming plasma with your Energy Shield (RMB).',
            enemies: [
              { type: 'grunt', count: 4 },
              { type: 'ranger', count: 2 },
            ],
          },
          {
            title: 'WAVE 3 — HEAVY SECTOR BREACH',
            description: 'Heavy armor robot detected! Jump over ground shockwaves.',
            enemies: [
              { type: 'grunt', count: 3 },
              { type: 'heavy', count: 1 },
            ],
          },
          {
            title: 'WAVE 4 — COMBINED HOSTILE FORCE',
            description: 'Combined arms assault. Defeat the enemy and press E to reboot companions.',
            enemies: [
              { type: 'grunt', count: 4 },
              { type: 'ranger', count: 2 },
              { type: 'heavy', count: 1 },
            ],
          },
          {
            title: 'WAVE 5 — BATTLEFIELD PURGE',
            description: 'Heavy battalion reinforcement wave.',
            enemies: [
              { type: 'grunt', count: 5 },
              { type: 'ranger', count: 3 },
            ],
          },
          {
            title: 'WAVE 6 — ELITE VANGUARD',
            description: 'Eliminate the Elite Vanguard Commander and accompanying squad.',
            enemies: [
              { type: 'elite-grunt', count: 1 },
              { type: 'ranger', count: 2 },
              { type: 'grunt', count: 3 },
            ],
          },
        ];

      case 7: // Stage 7: Reinforced Assault (Shield Defenders & Hazards - 7 waves)
        return [
          {
            title: 'WAVE 1 — PHALANX ADVANCE',
            description: 'Shield Defenders deployed! Frontal attacks are deflected; flank or strike during recovery.',
            enemies: [
              { type: 'shield', count: 2 },
              { type: 'grunt', count: 4 },
            ],
          },
          {
            title: 'WAVE 2 — SHIELD & BARRAGE',
            description: 'Rangers firing behind Shield coverage. Break their line.',
            enemies: [
              { type: 'shield', count: 2 },
              { type: 'ranger', count: 3 },
              { type: 'grunt', count: 2 },
            ],
          },
          {
            title: 'WAVE 3 — SIEGE HAMMERS',
            description: 'Twin Heavies approaching through hazardous terrain.',
            enemies: [
              { type: 'heavy', count: 2 },
              { type: 'ranger', count: 2 },
              { type: 'grunt', count: 2 },
            ],
          },
          {
            title: 'WAVE 4 — REINFORCED SQUAD',
            description: 'Balanced hostile assault team.',
            enemies: [
              { type: 'shield', count: 2 },
              { type: 'heavy', count: 1 },
              { type: 'ranger', count: 3 },
              { type: 'grunt', count: 3 },
            ],
          },
          {
            title: 'WAVE 5 — PLASMA CONDUIT COMBAT',
            description: 'Coordinate with companions to split enemy formations.',
            enemies: [
              { type: 'shield', count: 3 },
              { type: 'ranger', count: 3 },
              { type: 'grunt', count: 4 },
            ],
          },
          {
            title: 'WAVE 6 — HEAVY PHALANX',
            description: 'Heavy units flanked by Shield defenders.',
            enemies: [
              { type: 'heavy', count: 2 },
              { type: 'shield', count: 3 },
              { type: 'ranger', count: 3 },
            ],
          },
          {
            title: 'WAVE 7 — ELITE PHALANX COMMANDER',
            description: 'Neutralize the Elite Shield Commander to secure Level 7.',
            enemies: [
              { type: 'elite-shield', count: 1 },
              { type: 'heavy', count: 2 },
              { type: 'ranger', count: 3 },
              { type: 'grunt', count: 3 },
            ],
          },
        ];

      case 8: // Stage 8: Advanced Combat Zone (Fast Dual-Blade Assassins - 8 waves)
        return [
          {
            title: 'WAVE 1 — SHADOW STRIKE',
            description: 'Assassin robots detected! High speed dual-blade strikes.',
            enemies: [
              { type: 'assassin', count: 3 },
              { type: 'grunt', count: 3 },
            ],
          },
          {
            title: 'WAVE 2 — INFILTRATOR FLANK',
            description: 'Assassins dashing from flanks while Rangers suppress.',
            enemies: [
              { type: 'assassin', count: 3 },
              { type: 'ranger', count: 3 },
              { type: 'shield', count: 2 },
            ],
          },
          {
            title: 'WAVE 3 — HAMMER & DAGGERS',
            description: 'Heavies providing area pressure while Assassins strike rapidly.',
            enemies: [
              { type: 'heavy', count: 2 },
              { type: 'assassin', count: 3 },
              { type: 'grunt', count: 2 },
            ],
          },
          {
            title: 'WAVE 4 — SKYBRIDGE AMBUSH',
            description: 'Multi-tiered enemy forces engaging across the arena.',
            enemies: [
              { type: 'assassin', count: 4 },
              { type: 'ranger', count: 3 },
              { type: 'grunt', count: 3 },
            ],
          },
          {
            title: 'WAVE 5 — ADVANCED FORMATION',
            description: 'Combined strike squad.',
            enemies: [
              { type: 'shield', count: 3 },
              { type: 'heavy', count: 2 },
              { type: 'assassin', count: 3 },
            ],
          },
          {
            title: 'WAVE 6 — RAPID ASSAULT',
            description: 'High-speed Assassin squad.',
            enemies: [
              { type: 'assassin', count: 5 },
              { type: 'ranger', count: 4 },
            ],
          },
          {
            title: 'WAVE 7 — ELITE SIEGE INVASION',
            description: 'Elite Heavy leading rapid Assassin escorts.',
            enemies: [
              { type: 'elite-heavy', count: 1 },
              { type: 'assassin', count: 4 },
              { type: 'ranger', count: 3 },
            ],
          },
          {
            title: 'WAVE 8 — TWIN SHADOW ASSASSINS',
            description: 'Neutralize the Twin Elite Assassins to unlock the Citadel approach.',
            enemies: [
              { type: 'elite-assassin', count: 2 },
              { type: 'shield', count: 2 },
              { type: 'ranger', count: 3 },
              { type: 'grunt', count: 3 },
            ],
          },
        ];

      case 9: // Stage 9: Final Assault (Combined-Arms Full Battalion - 9 waves)
        return [
          {
            title: 'WAVE 1 — CITADEL BREACH',
            description: 'Outer defenses active. All robot divisions deployed.',
            enemies: [
              { type: 'grunt', count: 5 },
              { type: 'ranger', count: 3 },
              { type: 'shield', count: 2 },
            ],
          },
          {
            title: 'WAVE 2 — INFILTRATOR COUNTER',
            description: 'Assassins and Heavies pushing forward.',
            enemies: [
              { type: 'assassin', count: 4 },
              { type: 'heavy', count: 2 },
              { type: 'grunt', count: 3 },
            ],
          },
          {
            title: 'WAVE 3 — DEFENSIVE LINE',
            description: 'Shield wall protecting heavy artillery.',
            enemies: [
              { type: 'shield', count: 4 },
              { type: 'ranger', count: 4 },
              { type: 'assassin', count: 2 },
            ],
          },
          {
            title: 'WAVE 4 — CRUSHING ASSAULT',
            description: 'Multiple Heavies charging the line.',
            enemies: [
              { type: 'heavy', count: 3 },
              { type: 'assassin', count: 3 },
              { type: 'grunt', count: 4 },
            ],
          },
          {
            title: 'WAVE 5 — SIEGE FORMATION',
            description: 'High-density tactical battalion.',
            enemies: [
              { type: 'shield', count: 3 },
              { type: 'heavy', count: 2 },
              { type: 'ranger', count: 4 },
              { type: 'assassin', count: 3 },
            ],
          },
          {
            title: 'WAVE 6 — ELITE VANGUARD PATROL',
            description: 'Elite Grunt and Elite Assassin vanguard squad.',
            enemies: [
              { type: 'elite-grunt', count: 1 },
              { type: 'elite-assassin', count: 1 },
              { type: 'shield', count: 3 },
              { type: 'ranger', count: 3 },
            ],
          },
          {
            title: 'WAVE 7 — TITAN SIEGE',
            description: 'Elite Heavy leading reinforced legion.',
            enemies: [
              { type: 'elite-heavy', count: 1 },
              { type: 'heavy', count: 2 },
              { type: 'ranger', count: 4 },
              { type: 'assassin', count: 3 },
            ],
          },
          {
            title: 'WAVE 8 — CITADEL BULWARK',
            description: 'Elite Shield commander with heavy shock troops.',
            enemies: [
              { type: 'elite-shield', count: 1 },
              { type: 'elite-grunt', count: 1 },
              { type: 'assassin', count: 4 },
              { type: 'ranger', count: 4 },
            ],
          },
          {
            title: 'WAVE 9 — CITADEL HIGH COMMAND',
            description: 'Defeat the Citadel High Command officers to reach the Warlord!',
            enemies: [
              { type: 'elite-heavy', count: 1 },
              { type: 'elite-assassin', count: 1 },
              { type: 'elite-shield', count: 1 },
              { type: 'ranger', count: 4 },
              { type: 'grunt', count: 4 },
            ],
          },
        ];

      case 10: // Stage 10: The Warlord (Colossal Boss Arena - 4 phases)
      default:
        return [
          {
            title: 'PHASE 1 — ROYAL GUARD INITIATION',
            description: "Defeat the Warlord's 4 Elite Royal Guards.",
            enemies: [
              { type: 'elite-grunt', count: 2 },
              { type: 'elite-shield', count: 2 },
            ],
          },
          {
            title: 'PHASE 2 — THE WARLORD AWAKENS',
            description: 'The Warlord descends! Dodge heavy greatsword cleaves and ground shockwaves.',
            enemies: [
              { type: 'warlord', count: 1 },
              { type: 'ranger', count: 2 },
            ],
          },
          {
            title: 'PHASE 3 — ORDNANCE BARRAGE',
            description: 'Warlord Phase 2: Shoulder missile batteries engaged. Jump or shield shockwave stomps!',
            enemies: [
              { type: 'heavy', count: 1 },
              { type: 'assassin', count: 2 },
            ],
          },
          {
            title: 'PHASE 4 — OVERDRIVE FRENZY',
            description: 'Warlord Phase 3: Total overdrive active! Strike during post-combo stagger windows!',
            enemies: [
              { type: 'shield', count: 2 },
              { type: 'assassin', count: 2 },
            ],
          },
        ];
    }
  }

  private startWave(waveIdx: number): void {
    if (waveIdx >= this.wavesForStage.length) {
      this.finishMission();
      return;
    }

    this.currentWaveIndex = waveIdx;
    this.inInterWave = false;
    const wave = this.wavesForStage[waveIdx];

    // Calculate total enemies
    let total = 0;
    for (const e of wave.enemies) total += e.count;
    this.waveObjectiveTarget = total;
    this.waveObjectiveProgress = 0;

    // Emit wave started
    this.bus.emit('combat:wave:start', {
      stage: this.currentStageId,
      wave: waveIdx + 1,
      totalWaves: this.wavesForStage.length,
      title: wave.title,
    });
    this.bus.emit('objective:updated', this.getObjectiveInfo());

    // Spawn enemies spread around the arena
    this.spawnWaveEnemies(wave);
  }

  private spawnWaveEnemies(wave: WaveConfig): void {
    const playerPos = this.getPlayerPos();
    const spawnOffsets: THREE.Vector3[] = [
      new THREE.Vector3(-24, 0, -22),
      new THREE.Vector3(24, 0, -22),
      new THREE.Vector3(-32, 0, 8),
      new THREE.Vector3(32, 0, 8),
      new THREE.Vector3(0, 0, -38),
      new THREE.Vector3(-18, 0, -42),
      new THREE.Vector3(18, 0, -42),
      new THREE.Vector3(-28, 0, 24),
      new THREE.Vector3(28, 0, 24),
      new THREE.Vector3(0, 0, 36),
    ];

    let spawnIdx = 0;
    for (const group of wave.enemies) {
      for (let i = 0; i < group.count; i++) {
        const offset = spawnOffsets[spawnIdx % spawnOffsets.length];
        spawnIdx++;

        // Make sure spawn is away from player
        const spawnPos = this.arenaCenter.clone().add(offset);
        if (spawnPos.distanceTo(playerPos) < 12) {
          spawnPos.addScaledVector(offset.clone().normalize(), 14);
        }

        const robot = this.spawnRobot(spawnPos, group.type, 'hostile');
        if (group.type === 'warlord') {
          this.warlordBoss = robot;
        }
      }
    }
  }

  getObjectiveInfo(): ObjectiveInfo {
    const wave = this.wavesForStage[this.currentWaveIndex];
    const waveNum = this.currentWaveIndex + 1;
    const totalWaves = this.wavesForStage.length;

    if (this.missionFinished) {
      return {
        number: totalWaves,
        title: this.currentStageId === 10 ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE',
        description:
          this.currentStageId === 10
            ? 'The Warlord has fallen. The NEXUS network is restored.'
            : 'Sector secured. Advance to the next combat zone.',
        progress: 'VICTORY',
        completed: true,
      };
    }

    if (this.inInterWave) {
      return {
        number: waveNum,
        title: `WAVE ${waveNum} CLEARED`,
        description: 'Prepare for incoming enemy reinforcement wave...',
        progress: `NEXT WAVE IN ${Math.max(1, Math.ceil(this.interWaveTimer))}s`,
        completed: false,
      };
    }

    return {
      number: waveNum,
      title: `${wave?.title ?? `WAVE ${waveNum}`} (${waveNum} / ${totalWaves})`,
      description: wave?.description ?? 'Neutralize hostile robotic forces.',
      progress: `${this.waveObjectiveProgress} / ${this.waveObjectiveTarget} NEUTRALIZED`,
      completed: false,
    };
  }

  spawnRobot(
    pos: THREE.Vector3,
    type: RobotType = 'grunt',
    faction: 'hostile' | 'companion' = 'hostile',
  ): RobotEntity {
    const id = `robot-${type}-${Date.now()}-${Math.random().toFixed(4)}`;
    const robot = new RobotEntity({
      id,
      position: pos.clone(),
      type,
      faction,
      emergeFromGround: true,
    });
    this.scene.add(robot.group);
    this.robots.push(robot);
    this.bus.emit('robot:spawn', { robotId: id, position: pos });
    return robot;
  }

  update(delta: number, inputs: CombatInputs): void {
    if (!this._awakened) return;
    this.elapsed += delta;

    this.armor?.update(delta);
    this.sword?.update(delta);

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    // Player Sword Attack
    if (inputs.attackPressed && this.attackCooldown <= 0) {
      this.performAttack();
    }

    // Defensive Energy Shield
    const wasShielding = this.isShielding;
    this.isShielding = inputs.shieldHeld;
    this.shieldGroup.visible = this.isShielding;

    if (this.isShielding) {
      const pulse = Math.sin(this.elapsed * 6) * 0.4;
      this.shieldMaterial.emissiveIntensity = 2.8 + pulse;
      if (!wasShielding) {
        this.bus.emit('combat:shield:start', undefined);
      }
    } else if (wasShielding) {
      this.bus.emit('combat:shield:end', undefined);
    }

    // Reboot fallen companion
    if (inputs.rebootPressed) {
      this.tryReboot();
    }

    // Inter-wave timer
    if (this.inInterWave) {
      this.interWaveTimer -= delta;
      if (this.interWaveTimer <= 0) {
        this.startWave(this.currentWaveIndex + 1);
      }
    }

    const playerPos = this.getPlayerPos();
    this.playerGroup.getWorldDirection(this._forwardScratch);

    // Update Projectiles
    this.projectiles.update(
      delta,
      playerPos,
      this._forwardScratch,
      this.isShielding,
      (damage) => this.onPlayerTakeDamage(damage),
    );

    // Manage Attack Tokens (prevents all enemies striking simultaneously)
    this.coordinateAttackTokens(playerPos);

    // Update Robots & Companions
    for (const robot of this.robots) {
      if (robot.faction === 'hostile') {
        const nearestComp = this.findNearestCompanion(robot.position);
        const distToHero = robot.position.distanceTo(playerPos);
        const distToComp = nearestComp ? robot.position.distanceTo(nearestComp.position) : Infinity;

        if (nearestComp && distToComp < 4.0 && distToComp < distToHero) {
          robot.update(
            delta,
            nearestComp.position,
            this.elapsed,
            () => {
              nearestComp.takeDamage(robot.damage * 0.8);
            },
            (orig, tgt) => {
              this.projectiles.spawn(orig, tgt.clone().sub(orig).normalize(), 18, robot.damage);
            },
          );
        } else {
          robot.update(
            delta,
            playerPos,
            this.elapsed,
            (pos) => this.onRobotMeleeAttack(robot, pos),
            (orig, tgt) => {
              this.projectiles.spawn(orig, tgt.clone().sub(orig).normalize(), 18, robot.damage);
            },
            (pos, radius, dmg) => this.onAreaShockwave(pos, radius, dmg),
          );
        }
      } else {
        // Friendly companion
        const target = this.findNearestHostile(robot.position);
        if (target) {
          robot.update(
            delta,
            target.position,
            this.elapsed,
            () => {
              target.takeDamage(ATTACK_DAMAGE * 0.7);
            },
            (orig, tgt) => {
              this.projectiles.spawn(orig, tgt.clone().sub(orig).normalize(), 22, 20, 0x00f0ff);
            },
          );
        } else {
          robot.update(delta, playerPos, this.elapsed, () => {});
        }
      }
    }

    // Active sword strike hit detection
    if (this.sword?.inHitWindow) {
      this.checkSwordHits();
    }

    // Publish Boss HUD updates if boss is present
    if (this.warlordBoss && !this.warlordBoss.isDefeated) {
      this.bus.emit('combat:boss:update', {
        name: 'THE WARLORD',
        title: 'SUPREME CORRUPTED GUARDIAN',
        hp: this.warlordBoss.health,
        maxHp: this.warlordBoss.maxHealth,
        phase: this.warlordBoss.bossPhase,
      });
    }
  }

  private coordinateAttackTokens(playerPos: THREE.Vector3): void {
    let currentMelee = 0;
    let currentRanged = 0;

    for (const r of this.robots) {
      if (r.faction !== 'hostile' || r.isDefeated) continue;
      if (r.hasAttackToken) {
        if (r.type === 'ranger') currentRanged++;
        else currentMelee++;
      }
    }

    for (const r of this.robots) {
      if (r.faction !== 'hostile' || r.isDefeated || r.hasAttackToken) continue;
      const d = r.position.distanceTo(playerPos);

      if (r.type === 'ranger') {
        if (currentRanged < this.maxActiveRangedAttackers && d < 18) {
          r.hasAttackToken = true;
          currentRanged++;
        }
      } else {
        if (currentMelee < this.maxActiveMeleeAttackers && d < 6) {
          r.hasAttackToken = true;
          currentMelee++;
        }
      }
    }
  }

  private performAttack(): void {
    this.attackCooldown = this.attackCooldownDuration;
    this.sword?.startSwing();

    const playerPos = this.getPlayerPos();
    this.playerGroup.getWorldDirection(this._scratch);

    this.bus.emit('combat:attack', {
      position: playerPos.clone(),
      facing: this._scratch.clone(),
    });

    // Slash particle wave
    this.particles.burst({
      position: playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
      count: 16,
      color: 0x00f0ff,
      speed: 6.5,
      spread: 0.9,
      life: 0.4,
      size: 0.16,
    });
  }

  private checkSwordHits(): void {
    this.sword!.getBladeTipWorld(this._tipScratch);
    const playerPos = this.getPlayerPos();

    for (const robot of this.robots) {
      if (robot.faction !== 'hostile' || robot.state === 'SPAWNING' || robot.isDefeated) continue;

      const dist = this._tipScratch.distanceTo(robot.position);
      if (dist < ATTACK_RANGE) {
        // Check if robot is a Shield Defender blocking from the front
        if (robot.isAttackBlockedFrom(playerPos)) {
          this.bus.emit('combat:blocked', undefined);
          // Block spark deflection
          this.particles.burst({
            position: robot.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
            count: 22,
            color: 0xffaa00,
            speed: 6,
            spread: 1.2,
            life: 0.3,
            size: 0.16,
          });
          continue;
        }

        const defeated = robot.takeDamage(ATTACK_DAMAGE);
        this.bus.emit('combat:hit', { robotId: robot.id, damage: ATTACK_DAMAGE });

        // Impact spark explosion
        this.particles.burst({
          position: robot.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
          count: 24,
          color: robot.isElite ? 0xffaa00 : 0xff3300,
          speed: 7,
          spread: 1.4,
          life: 0.38,
          size: 0.16,
        });

        if (defeated) {
          this.handleRobotDefeated(robot);
        }
      }
    }
  }

  private handleRobotDefeated(robot: RobotEntity): void {
    this.bus.emit('robot:defeated', { robotId: robot.id, position: robot.position.clone() });

    if (this.missionFinished) return;

    this.waveObjectiveProgress++;
    this.bus.emit('objective:updated', this.getObjectiveInfo());

    // Check if wave is completed
    const remainingHostiles = this.robots.filter((r) => r.faction === 'hostile' && !r.isDefeated).length;
    if (remainingHostiles === 0 || this.waveObjectiveProgress >= this.waveObjectiveTarget) {
      this.handleWaveCompleted();
    }
  }

  private handleWaveCompleted(): void {
    const waveNum = this.currentWaveIndex + 1;
    const totalWaves = this.wavesForStage.length;

    this.bus.emit('combat:wave:cleared', {
      stage: this.currentStageId,
      wave: waveNum,
      totalWaves,
    });

    if (waveNum >= totalWaves) {
      this.finishMission();
    } else {
      // Enter brief inter-wave breather
      this.inInterWave = true;
      this.interWaveTimer = 3.5;
      this.bus.emit('objective:updated', this.getObjectiveInfo());
    }
  }

  private finishMission(): void {
    this.missionFinished = true;
    this.bus.emit('objective:updated', this.getObjectiveInfo());

    if (this.currentStageId === 10) {
      this.bus.emit('combat:campaign:complete', undefined);
      this.bus.emit('stage6:victory', undefined);
    } else {
      this.bus.emit('combat:stage:victory', {
        stage: this.currentStageId,
        nextStage: this.currentStageId + 1,
      });
      if (this.currentStageId === 6) {
        this.bus.emit('stage6:victory', undefined);
      }
    }
  }

  private onRobotMeleeAttack(robot: RobotEntity, pos: THREE.Vector3): void {
    if (robot.faction !== 'hostile') return;
    const playerPos = this.getPlayerPos();
    if (pos.distanceTo(playerPos) > 3.0) return;

    this.bus.emit('robot:attack', { robotId: robot.id, position: pos });

    if (this.isShielding) {
      this.bus.emit('combat:blocked', undefined);
      this.particles.burst({
        position: playerPos.clone().add(new THREE.Vector3(0, 1.0, 0.4)),
        count: 26,
        color: 0x00f0ff,
        speed: 6,
        spread: 1.8,
        life: 0.35,
        size: 0.16,
      });
    } else {
      this.onPlayerTakeDamage(robot.damage);
    }
  }

  private onAreaShockwave(pos: THREE.Vector3, radius: number, damage: number): void {
    const playerPos = this.getPlayerPos();
    const dist = pos.distanceTo(playerPos);

    if (dist <= radius) {
      // If player is airborne (jumping) above height 0.6: avoided shockwave!
      if (playerPos.y > 0.6) {
        this.particles.burst({
          position: playerPos.clone(),
          count: 10,
          color: 0x00f0ff,
          speed: 3,
          spread: 0.8,
          life: 0.3,
          size: 0.12,
        });
        return;
      }

      if (this.isShielding) {
        this.bus.emit('combat:blocked', undefined);
        this.onPlayerTakeDamage(damage * 0.3); // Minor chip damage through shield
      } else {
        this.onPlayerTakeDamage(damage);
      }
    }
  }

  private onPlayerTakeDamage(amount: number): void {
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    const playerPos = this.getPlayerPos();

    this.particles.burst({
      position: playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)),
      count: 20,
      color: 0xff1100,
      speed: 4.5,
      spread: 1.0,
      life: 0.32,
      size: 0.15,
    });

    this.bus.emit('combat:damage_taken', { health: this.playerHealth });
  }

  private tryReboot(): void {
    const playerPos = this.getPlayerPos();
    for (const robot of this.robots) {
      if (!robot.isEligibleForReboot || !robot.isDefeated) continue;
      const dist = playerPos.distanceTo(robot.position);
      if (dist > REBOOT_RANGE) continue;

      if (this.companions.length >= COMPANION_LIMIT) {
        this.bus.emit('companion:limit', { limit: COMPANION_LIMIT });
        return;
      }

      this.performReboot(robot);
      return;
    }
  }

  private performReboot(robot: RobotEntity): void {
    robot.reboot();
    this.companions.push(robot);

    // Cyan energy transfer particle burst
    this.particles.burst({
      position: robot.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
      count: 70,
      color: 0x00f0ff,
      speed: 5.5,
      spread: 2.2,
      life: 0.9,
      size: 0.2,
    });

    this.bus.emit('robot:rebooted', { robotId: robot.id, position: robot.position.clone() });
  }

  private findNearestHostile(from: THREE.Vector3): RobotEntity | null {
    let nearest: RobotEntity | null = null;
    let nearestDist = Infinity;
    for (const robot of this.robots) {
      if (robot.faction !== 'hostile' || robot.isDefeated || robot.state === 'SPAWNING') continue;
      const d = from.distanceTo(robot.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = robot;
      }
    }
    return nearest;
  }

  private findNearestCompanion(from: THREE.Vector3): RobotEntity | null {
    let nearest: RobotEntity | null = null;
    let nearestDist = Infinity;
    for (const robot of this.companions) {
      if (robot.isDefeated) continue;
      const d = from.distanceTo(robot.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = robot;
      }
    }
    return nearest;
  }

  getDefeatedNearby(playerPos: THREE.Vector3): RobotEntity | null {
    for (const robot of this.robots) {
      if (!robot.isEligibleForReboot || !robot.isDefeated) continue;
      if (playerPos.distanceTo(robot.position) <= REBOOT_RANGE) return robot;
    }
    return null;
  }

  get activeRobots(): readonly RobotEntity[] {
    return this.robots;
  }

  get activeCompanions(): readonly RobotEntity[] {
    return this.companions;
  }

  get hostileCount(): number {
    return this.robots.filter((r) => r.faction === 'hostile' && !r.isDefeated).length;
  }

  get companionCount(): number {
    return this.companions.length;
  }

  clearAllRobots(): void {
    for (const r of this.robots) r.dispose();
    this.robots = [];
    this.companions = [];
    this.warlordBoss = null;
  }

  dispose(): void {
    this.clearAllRobots();
    this.projectiles.dispose();
    this.shieldGroup.removeFromParent();
    this.shieldMaterial.dispose();
  }
}
