import * as THREE from 'three';
import type { EventBus, ObjectiveInfo } from '../core/EventBus';
import type { ParticleSystem } from '../effects/Particles';
import { RobotEntity, type RobotType } from './RobotEntity';
import type { ArmorSystem } from './ArmorSystem';
import type { EnergySword } from './EnergySword';
import { ArmoredGun } from './ArmoredGun';
import { ProjectileManager } from './ProjectileManager';
import {
  STAGE_6_SECTION_1_SPAWNS,
  STAGE_6_SECTION_2_SPAWNS,
  STAGE_6_SECTION_3_SPAWNS,
} from '../stages/Stage6';
import type { StageProgressSnapshot } from '../stages/StageTypes';

export type PlayerLifeState = 'ALIVE' | 'TAKING_DAMAGE' | 'DEAD' | 'RESPAWNING';

export interface CombatSystemConfig {
  scene: THREE.Scene;
  bus: EventBus;
  particles: ParticleSystem;
  playerGroup: THREE.Group;
  getPlayerPos: () => THREE.Vector3;
}

export interface CombatInputs {
  attackPressed: boolean;
  attackHeld?: boolean;
  gunPressed?: boolean;
  shieldHeld: boolean;
  rebootPressed: boolean;
  /** Shift / left-joystick double-tap: dodge roll */
  dodgePressed?: boolean;
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

interface Stage6Spawn {
  id: string;
  position: THREE.Vector3;
  type: RobotType;
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
  playerLifeState: PlayerLifeState = 'ALIVE';
  onPlayerDiedCallback: (() => void) | null = null;
  isShielding = false;
  private attackCooldown = 0;
  private readonly attackCooldownDuration = 0.48;

  // ---- Combo system ----
  /** Number of light-attack hits in current combo chain (resets on heavy or gap). */
  private comboCount = 0;
  /** Timer until combo resets if no follow-up attack (seconds). */
  private comboResetTimer = 0;
  private readonly COMBO_WINDOW = 0.85;       // seconds to chain next hit
  private readonly LIGHT_DAMAGE = 28;         // per light strike
  private readonly HEAVY_DAMAGE = 72;         // heavy finisher (3rd hit in chain)
  private readonly HEAVY_COOLDOWN = 0.72;     // longer recovery for heavy

  // ---- Per-swing hit tracking (prevents multi-tick damage during swing window) ----
  private readonly hitThisSwing = new Set<string>();

  // ---- Dodge roll ----
  private dodgeCooldown = 0;
  private readonly DODGE_COOLDOWN = 0.95;
  private isDodging = false;
  private dodgeTimer = 0;
  private readonly DODGE_DURATION = 0.28;     // iframe window seconds

  // ---- Skill energy ----
  skillEnergy = 0;
  readonly skillMaxEnergy = 100;
  private readonly SKILL_ENERGY_PER_HIT = 8;
  private readonly SKILL_ENERGY_PER_DODGE = 6;
  private readonly SKILL_COST = 50;
  private skillActive = false;
  private skillTimer = 0;
  private readonly SKILL_DURATION = 2.2;      // seconds of power strike mode

  // Equipment
  armor: ArmorSystem | null = null;
  sword: EnergySword | null = null;
  gun: ArmoredGun | null = null;
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

  // Stage 6 section tracking (3 distinct sequential sections)
  private stage6Section: 1 | 2 | 3 | 'complete' = 1;
  private stage6Section1Done = false;
  private stage6Section2Spawned = false;
  private stage6Section2Done = false;
  private stage6Section3Spawned = false;
  private stage6Section3Done = false;
  private stage6EncounterSpawns: Record<1 | 2 | 3, Stage6Spawn[]> = { 1: [], 2: [], 3: [] };

  // Charged power attack system
  private chargeTimer = 0;
  private isCharging = false;
  private attackTapQueued = false;
  private readonly CHARGE_THRESHOLD = 0.45;
  private readonly CHARGED_DAMAGE = 85;
  private readonly CHARGED_COOLDOWN = 0.82;

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

    // Build the visual Energy Shield barrier — refined, translucent holographic barrier
    this.shieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x041824,
      emissive: 0x00cce6,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.35,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const shieldGeo = new THREE.CylinderGeometry(0.85, 0.95, 1.4, 6, 1, true, 0, Math.PI);
    const shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMaterial);
    shieldMesh.rotation.y = Math.PI / 2;
    shieldMesh.position.set(0, 1.0, 0.7);

    // Shield rim accent — subtle edge glow
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.65,
      blending: THREE.NormalBlending,
    });
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 24), rimMat);
    rimMesh.position.set(0, 1.0, 0.72);

    this.shieldGroup.add(shieldMesh, rimMesh);
    this.shieldGroup.visible = false;
    this.playerGroup.add(this.shieldGroup);

    // Listen for player respawn to immediately restore full combat capabilities
    this.bus.on('player:respawn', ({ cause }) => {
      this.onPlayerRespawn(cause);
    });
  }

  get comboHits(): number {
    return this.comboCount;
  }

  onPlayerRespawn(cause: 'combat' | 'fall' | 'hazard' | 'manual' = 'manual'): void {
    this.playerLifeState = 'ALIVE';
    this.playerHealth = this.playerMaxHealth;
    this.attackCooldown = 0;
    this.dodgeCooldown = 0;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.comboCount = 0;
    this.comboResetTimer = 0;
    this.attackTapQueued = false;
    this.isCharging = false;
    this.chargeTimer = 0;
    this.hitThisSwing.clear();
    this.isShielding = false;
    this.shieldGroup.visible = false;
    this.sword?.resetSwing();
    this.projectiles.clear();
    this.bus.emit('combat:damage_taken', { health: this.playerHealth });
    if (this.currentStageId === 6 && cause === 'combat') this.restartActiveStage6Encounter();
    else if (this.currentStageId >= 7 && !this.missionFinished) this.restartStageMission();
  }

  get awakened(): boolean {
    return this._awakened;
  }

  setAwakened(armor: ArmorSystem, sword: EnergySword, gun?: ArmoredGun): void {
    this._awakened = true;
    this.armor = armor;
    this.sword = sword;
    if (gun) this.gun = gun;
  }

  /** Clears run-owned combat entities and configures equipment for the selected stage. */
  resetForStage(stageId: number): void {
    this.clearAllRobots();
    this.projectiles.clear();
    this.currentStageId = stageId;
    this.currentWaveIndex = 0;
    this.wavesForStage = [];
    this.waveObjectiveTarget = 0;
    this.waveObjectiveProgress = 0;
    this.missionFinished = false;
    this.inInterWave = false;
    this.interWaveTimer = 0;
    this.warlordBoss = null;
    this.playerHealth = this.playerMaxHealth;
    this.playerLifeState = 'ALIVE';
    this.attackCooldown = 0;
    this.comboCount = 0;
    this.comboResetTimer = 0;
    this.dodgeCooldown = 0;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.skillEnergy = 0;
    this.skillActive = false;
    this.skillTimer = 0;
    this.chargeTimer = 0;
    this.isCharging = false;
    this.attackTapQueued = false;
    this.hitThisSwing.clear();
    this.isShielding = false;
    this.shieldGroup.visible = false;
    this.sword?.resetSwing();

    if (stageId <= 5) this.clearEquipment();
    this.bus.emit('combat:damage_taken', { health: this.playerHealth });
  }

  private clearEquipment(): void {
    this.armor?.dispose();
    this.sword?.dispose();
    this.gun?.dispose();
    this.armor = null;
    this.sword = null;
    this.gun = null;
    this._awakened = false;
  }

  setGun(gun: ArmoredGun): void {
    this.gun = gun;
    if (this.currentStageId >= 8) {
      this.gun.snapVisible();
    }
  }

  setPlayerDiedCallback(cb: () => void): void {
    this.onPlayerDiedCallback = cb;
  }

  /** Backward-compatible helper for Stage 6 */
  initStage6Mission(_arenaCenter: THREE.Vector3): void {
    this.initStage6PlatformMission();
  }

  /**
   * Initializes the mission and wave progression for Stages 6–10.
   */
  initStageMission(stageId: number, arenaCenter: THREE.Vector3): void {
    if (stageId === 6) {
      this.initStage6PlatformMission();
      return;
    }
    this.clearAllRobots();
    this.projectiles.clear();
    this.playerHealth = this.playerMaxHealth;
    this.playerLifeState = 'ALIVE';
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

  restartStageMission(): void {
    if (this.currentStageId === 6) {
      this.restartActiveStage6Encounter();
    } else {
      this.initStageMission(this.currentStageId, this.arenaCenter);
    }
    // Reset player life state on restart
    this.playerLifeState = 'ALIVE';
    this.attackCooldown = 0;
    this.comboCount = 0;
    this.comboResetTimer = 0;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.bus.emit('combat:damage_taken', { health: this.playerHealth });
  }

  getStage6ProgressSnapshot(): StageProgressSnapshot | null {
    if (this.currentStageId !== 6) return null;
    const completedSections = [
      this.stage6Section1Done ? 1 : 0,
      this.stage6Section2Done ? 2 : 0,
      this.stage6Section3Done ? 3 : 0,
    ].filter((section) => section > 0);
    const spawnedSections = [1, this.stage6Section2Spawned ? 2 : 0, this.stage6Section3Spawned ? 3 : 0]
      .filter((section) => section > 0);
    return {
      section: this.stage6Section === 'complete' ? 4 : this.stage6Section,
      completedSections,
      spawnedSections,
      finished: this.missionFinished,
    };
  }

  private spawnStage6Section(section: 1 | 2 | 3): void {
    for (const spawn of this.stage6EncounterSpawns[section]) {
      const existingHostile = this.robots.find((robot) => robot.id === spawn.id && robot.faction === 'hostile');
      if (existingHostile) continue;
      let id = spawn.id;
      let attempt = 1;
      while (this.robots.some((robot) => robot.id === id)) {
        attempt += 1;
        id = `${spawn.id}-attempt-${attempt}`;
      }
      this.spawnRobot(spawn.position, spawn.type, 'hostile', true, id);
    }
  }

  private restartActiveStage6Encounter(): void {
    if (this.currentStageId !== 6 || this.stage6Section === 'complete') return;
    const section = this.stage6Section;
    if ((section === 2 && !this.stage6Section2Spawned) || (section === 3 && !this.stage6Section3Spawned)) return;

    const prefix = `stage6-section-${section}-robot-`;
    const retained: RobotEntity[] = [];
    for (const robot of this.robots) {
      if (robot.id.startsWith(prefix) && robot.faction === 'hostile') robot.dispose();
      else retained.push(robot);
    }
    this.robots = retained;
    this.projectiles.clear();
    this.spawnStage6Section(section);
    this.currentWaveIndex = section - 1;
    this.waveObjectiveProgress = 0;
    this.waveObjectiveTarget = this.robots.filter((robot) => robot.id.startsWith(prefix) && robot.faction === 'hostile').length;
    this.inInterWave = false;
    this.interWaveTimer = 0;
    this.bus.emit('combat:wave:start', {
      stage: 6,
      wave: section,
      totalWaves: 3,
      title: `HOSTILE UNITS DETECTED — SECTION ${section}/3`,
    });
    this.bus.emit('objective:updated', this.getObjectiveInfo());
  }

  damagePlayerForTest(amount: number): void {
    this.onPlayerTakeDamage(amount);
  }

  hostileAttackPlayerForTest(): void {
    const attacker = this.robots.find((robot) =>
      robot.faction === 'hostile' && !robot.isDefeated && robot.state !== 'SPAWNING',
    );
    if (!attacker) throw new Error('No active hostile is available for the combat-death test.');
    attacker.position.copy(this.getPlayerPos());
    for (let hit = 0; hit < 10 && this.playerLifeState !== 'DEAD'; hit += 1) {
      this.onRobotMeleeAttack(attacker, this.getPlayerPos());
    }
  }

  damageRobotForTest(robotId: string, amount: number): void {
    const robot = this.robots.find((candidate) => candidate.id === robotId);
    if (!robot || robot.faction !== 'hostile') return;
    if (robot.takeDamage(amount)) this.handleRobotDefeated(robot);
  }

  spawnHostileForTest(x: number, y: number, z: number, stableId: string): void {
    if (this.robots.some((robot) => robot.id === stableId)) return;
    this.spawnRobot(new THREE.Vector3(x, y, z), 'grunt', 'hostile', false, stableId);
  }

  /**
   * Stage 6 scripted encounter: 3 sequential sections with futuristic nanotech materialization.
   * Section 1: 2 hostile grunts at the arrival dais.
   * Section 2: 2 hostile sentinels at the midlevel ledge.
   * Section 3: 2 elite defenders at the Reactor Sanctum (unlocks the exit portal).
   */
  initStage6PlatformMission(): void {
    this.clearAllRobots();
    this.projectiles.clear();
    this.playerHealth = this.playerMaxHealth;
    this.playerLifeState = 'ALIVE';
    this.currentStageId = 6;
    this.arenaCenter.set(0, 0, 0);
    this.currentWaveIndex = 0;
    this.missionFinished = false;
    this.inInterWave = false;
    this.interWaveTimer = 0;
    this.warlordBoss = null;
    this.attackCooldown = 0;
    this.comboCount = 0;
    this.comboResetTimer = 0;
    this.dodgeCooldown = 0;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.hitThisSwing.clear();
    this.isShielding = false;
    this.shieldGroup.visible = false;
    this.sword?.resetSwing();
    this.skillEnergy = 0;
    this.skillActive = false;
    this.skillTimer = 0;
    this.chargeTimer = 0;
    this.isCharging = false;
    this.attackTapQueued = false;

    // Reset 3 sections state
    this.stage6Section = 1;
    this.stage6Section1Done = false;
    this.stage6Section2Spawned = false;
    this.stage6Section2Done = false;
    this.stage6Section3Spawned = false;
    this.stage6Section3Done = false;

    this.wavesForStage = [
      {
        title: 'SECTION 1/3 — ARRIVAL SECTOR',
        description: 'Neutralize the 2 hostile nano units guarding the arrival dais.',
        enemies: [{ type: 'grunt', count: 2 }],
      },
      {
        title: 'SECTION 2/3 — MIDLEVEL LEDGE',
        description: 'Eliminate the 2 hostile nano units guarding the midlevel ledge.',
        enemies: [{ type: 'grunt', count: 2 }],
      },
      {
        title: 'FINAL SECTION — 3/3 — REACTOR SANCTUM',
        description: 'Defeat the 2 elite defenders guarding the Reactor Sanctum.',
        enemies: [
          { type: 'heavy', count: 1 },
          { type: 'elite-grunt', count: 1 },
        ],
      },
    ];
    this.waveObjectiveTarget = 2;
    this.waveObjectiveProgress = 0;

    this.stage6EncounterSpawns = {
      1: STAGE_6_SECTION_1_SPAWNS.map((pos, index) => ({
        id: `stage6-section-1-robot-${index + 1}`,
        position: new THREE.Vector3(...pos),
        type: 'grunt',
      })),
      2: STAGE_6_SECTION_2_SPAWNS.map((pos, index) => ({
        id: `stage6-section-2-robot-${index + 1}`,
        position: new THREE.Vector3(...pos),
        type: 'grunt',
      })),
      3: STAGE_6_SECTION_3_SPAWNS.map((pos, index) => ({
        id: `stage6-section-3-robot-${index + 1}`,
        position: new THREE.Vector3(...pos),
        type: index === 0 ? 'heavy' : 'elite-grunt',
      })),
    };
    this.spawnStage6Section(1);

    this.bus.emit('combat:wave:start', {
      stage: 6,
      wave: 1,
      totalWaves: 3,
      title: 'HOSTILE UNITS DETECTED — SECTION 1/3',
    });
    this.bus.emit('objective:updated', this.getObjectiveInfo());
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
    if (this.currentStageId === 6) {
      if (this.missionFinished || this.stage6Section === 'complete') {
        return {
          number: 3,
          title: 'SECTOR SECURED — ALL 3 SECTIONS CLEARED',
          description: 'All required hostile sections are defeated. The exit portal remains available.',
          progress: 'OBJECTIVES COMPLETE',
          completed: true,
        };
      }
      if (this.stage6Section === 2 && !this.stage6Section2Spawned) {
        return {
          number: 2,
          title: 'ADVANCE TO MIDLEVEL SECTOR (1 / 3 CLEARED)',
          description: 'Cross the floating bridges toward the midlevel ledge.',
          progress: 'OBJECTIVE: ADVANCE',
          completed: false,
        };
      }
      if (this.stage6Section === 3 && !this.stage6Section3Spawned) {
        return {
          number: 3,
          title: 'ASCEND TO REACTOR SANCTUM (2 / 3 CLEARED)',
          description: 'Cross the elevated conduits to reach the Reactor Sanctum.',
          progress: 'OBJECTIVE: ADVANCE',
          completed: false,
        };
      }
      const sectionNum = this.stage6Section as number;
      const sectionTitle =
        sectionNum === 1
          ? 'SECTION 1/3 — ARRIVAL SECTOR'
          : sectionNum === 2
          ? 'SECTION 2/3 — MIDLEVEL LEDGE'
          : 'FINAL SECTION — 3/3 — REACTOR SANCTUM';
      return {
        number: sectionNum,
        title: sectionTitle,
        description:
          sectionNum === 3
            ? 'Defeat the 2 elite defenders guarding the Reactor Sanctum.'
            : 'Neutralize the 2 hostile nano units in this sector.',
        progress: `${this.waveObjectiveProgress} / ${this.waveObjectiveTarget || 2} NEUTRALIZED`,
        completed: false,
      };
    }

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
    nanotechMaterialize = false,
    stableId?: string,
  ): RobotEntity {
    const id = stableId ?? `robot-${type}-${Date.now()}-${Math.random().toFixed(4)}`;
    const robot = new RobotEntity({
      id,
      position: pos.clone(),
      type,
      faction,
      emergeFromGround: !nanotechMaterialize,
      nanotechMaterialize,
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
    this.gun?.update(delta);

    // If player is dead, disable combat actions and inputs
    if (this.playerLifeState === 'DEAD') {
      this.isShielding = false;
      this.shieldGroup.visible = false;
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);

    // Skill energy regeneration (slow drain when idle)
    if (!this.skillActive) {
      this.skillEnergy = Math.min(this.skillMaxEnergy, this.skillEnergy);
    }

    // Skill active countdown
    if (this.skillActive) {
      this.skillTimer -= delta;
      if (this.skillTimer <= 0) {
        this.skillActive = false;
        this.skillTimer = 0;
      }
    }

    // Combo reset timer
    if (this.comboCount > 0) {
      this.comboResetTimer -= delta;
      if (this.comboResetTimer <= 0) {
        this.comboCount = 0;
        this.comboResetTimer = 0;
      }
    }

    // Dodge roll update
    if (this.isDodging) {
      this.dodgeTimer -= delta;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.dodgeTimer = 0;
      }
    }

    // Player Dodge (Shift key) — grants brief iframes
    if (inputs.dodgePressed && this.dodgeCooldown <= 0 && !this.isDodging) {
      this.performDodge();
    }

    const playerPos = this.getPlayerPos();
    this.playerGroup.getWorldDirection(this._forwardScratch);

    // Stage 6 spatial triggers for Section 2 and Section 3
    if (this.currentStageId === 6) {
      if (this.stage6Section === 2 && !this.stage6Section2Spawned) {
        // Trigger Section 2 when player reaches the midlevel ledge
        const distToMidLedge = playerPos.distanceTo(new THREE.Vector3(14, 6.0, -36));
        if ((playerPos.z <= -26 && playerPos.x >= 4) || distToMidLedge < 16) {
          this.stage6Section2Spawned = true;
          this.currentWaveIndex = 1;
          this.waveObjectiveTarget = 2;
          this.waveObjectiveProgress = 0;
          this.spawnStage6Section(2);
          this.bus.emit('combat:wave:start', {
            stage: 6,
            wave: 2,
            totalWaves: 3,
            title: 'HOSTILE UNITS DETECTED — SECTION 2/3',
          });
          this.bus.emit('objective:updated', this.getObjectiveInfo());
        }
      } else if (this.stage6Section === 3 && !this.stage6Section3Spawned) {
        // Trigger Section 3 when player enters Reactor Sanctum
        if (playerPos.z <= -106) {
          this.stage6Section3Spawned = true;
          this.currentWaveIndex = 2;
          this.waveObjectiveTarget = 2;
          this.waveObjectiveProgress = 0;
          this.spawnStage6Section(3);
          this.bus.emit('combat:wave:start', {
            stage: 6,
            wave: 3,
            totalWaves: 3,
            title: 'FINAL SECTION — 3/3',
          });
          this.bus.emit('objective:updated', this.getObjectiveInfo());
        }
      }
    }

    // Resolve a tap on release so the same press can also charge a power attack.
    if (inputs.attackPressed) this.attackTapQueued = true;

    // Player Sword Attack: Tap for combo attack, Hold LMB for charged power attack
    if (inputs.attackHeld && this.attackCooldown <= 0 && !this.isDodging) {
      this.chargeTimer += delta;
      if (this.chargeTimer >= this.CHARGE_THRESHOLD) {
        this.isCharging = true;
        if (Math.random() < 0.45) {
          this.particles.burst({
            position: playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8)),
            count: 4,
            color: 0x00f0ff,
            speed: 2.8,
            spread: 0.6,
            life: 0.28,
            size: 0.14,
          });
        }
      }
    } else {
      if (this.isCharging) {
        this.performChargedAttack();
      } else if (this.attackTapQueued && this.attackCooldown <= 0 && !this.isDodging) {
        this.performComboAttack();
      }
      this.attackTapQueued = false;
      this.isCharging = false;
      this.chargeTimer = 0;
    }

    // Player Gun Attack (R key, Middle Mouse, or mobile GUN button)
    if (inputs.gunPressed && this.gun?.isReadyToFire) {
      this.gun.fire(playerPos, this._forwardScratch, this.projectiles, this.particles, this.bus);
    }

    // Defensive Energy Shield
    const wasShielding = this.isShielding;
    this.isShielding = inputs.shieldHeld;
    this.shieldGroup.visible = this.isShielding;

    if (this.isShielding) {
      const pulse = Math.sin(this.elapsed * 5) * 0.12;
      this.shieldMaterial.emissiveIntensity = 0.65 + pulse;
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

    // Update Projectiles (including player projectile hits against enemies)
    this.projectiles.update(
      delta,
      playerPos,
      this._forwardScratch,
      this.isShielding,
      (damage) => this.onPlayerTakeDamage(damage),
      (projPos, damage) => this.checkPlayerProjectileHit(projPos, damage),
    );

    // Manage Attack Tokens for hostiles
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
              this.projectiles.spawn(orig, tgt.clone().sub(orig).normalize(), 18, robot.damage, 0xff2200, 0.25, 4.0, 'enemy');
            },
          );
        } else {
          robot.update(
            delta,
            playerPos,
            this.elapsed,
            (pos) => this.onRobotMeleeAttack(robot, pos),
            (orig, tgt) => {
              this.projectiles.spawn(orig, tgt.clone().sub(orig).normalize(), 18, robot.damage, 0xff2200, 0.25, 4.0, 'enemy');
            },
            (pos, radius, dmg) => this.onAreaShockwave(pos, radius, dmg),
          );
        }
      } else {
        // Friendly companion ally
        const target = this.findNearestHostile(robot.position);
        if (target) {
          robot.update(
            delta,
            target.position,
            this.elapsed,
            () => {
              const defeated = target.takeDamage(ATTACK_DAMAGE * 0.75);
              this.bus.emit('combat:hit', { robotId: target.id, damage: ATTACK_DAMAGE * 0.75 });
              this.particles.burst({
                position: target.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
                count: 18,
                color: target.isElite ? 0xffaa00 : 0xff3300,
                speed: 5.5,
                spread: 1.2,
                life: 0.35,
                size: 0.15,
              });
              if (defeated) {
                this.handleRobotDefeated(target);
              }
            },
            (orig, tgt) => {
              this.projectiles.spawn(orig, tgt.clone().sub(orig).normalize(), 24, 20, 0x00f0ff, 0.22, 3.5, 'player');
            },
          );
        } else {
          // No hostiles: follow hero with respectful leash
          const distToHero = robot.position.distanceTo(playerPos);
          if (distToHero > 4.5) {
            robot.update(delta, playerPos, this.elapsed, () => {}, undefined, undefined, false);
          } else {
            // Idle safely near player
            robot.update(delta, robot.position, this.elapsed, () => {}, undefined, undefined, false);
          }
        }
      }
    }

    // Filter out defeated companions to free companion slots
    this.companions = this.companions.filter((c) => !c.isDefeated);

    // Active sword strike hit detection — only checked during the active window
    if (this.sword?.inHitWindow) {
      this.checkSwordHits();
    } else {
      this.hitThisSwing.clear();
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


  /**
   * Acrobatic combo system:
   *  Hit 1 & 2: Fast light strikes (28 dmg, 0.48s cooldown)
   *  Hit 3: Heavy finisher (72 dmg, longer recovery) — resets combo
   *  Skill active: all strikes +40% damage and cyan burst
   */
  private performComboAttack(): void {
    this.comboCount++;
    this.comboResetTimer = this.COMBO_WINDOW;
    this.hitThisSwing.clear();

    const isHeavyFinisher = this.comboCount >= 3;
    const skillBonus = this.skillActive ? 1.4 : 1.0;

    if (isHeavyFinisher) {
      // Heavy finisher: bigger damage, longer cooldown, radiant finisher burst
      this.attackCooldown = this.HEAVY_COOLDOWN;
      this.comboCount = 0;
      this.comboResetTimer = 0;
      this.sword?.startSwing();
      const playerPos = this.getPlayerPos();
      this.playerGroup.getWorldDirection(this._scratch);
      this.bus.emit('combat:attack', { position: playerPos.clone(), facing: this._scratch.clone() });
      this.particles.burst({
        position: playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
        count: 28,
        color: this.skillActive ? 0x00f0ff : 0x8a5cff,
        speed: 8.5,
        spread: 1.2,
        life: 0.5,
        size: 0.22,
      });
      this._currentSwingDamage = Math.round(this.HEAVY_DAMAGE * skillBonus);
    } else {
      // Light strikes: Hit 1 is 28 dmg, Hit 2 is 34 dmg
      this.attackCooldown = this.attackCooldownDuration;
      this.sword?.startSwing();
      const playerPos = this.getPlayerPos();
      this.playerGroup.getWorldDirection(this._scratch);
      this.bus.emit('combat:attack', { position: playerPos.clone(), facing: this._scratch.clone() });
      this.particles.burst({
        position: playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
        count: 14,
        color: this.skillActive ? 0xffffff : 0x00f0ff,
        speed: 6.5,
        spread: 0.9,
        life: 0.38,
        size: 0.14,
      });
      const baseDmg = this.comboCount === 2 ? 34 : this.LIGHT_DAMAGE;
      this._currentSwingDamage = Math.round(baseDmg * skillBonus);
    }
  }

  /**
   * Charged Power Attack:
   * Unleashed by holding attack (LMB/F) >= 0.45s and releasing.
   * Deals heavy 85 damage with dual cyan & violet shockwave burst and longer recovery.
   */
  private performChargedAttack(): void {
    this.attackCooldown = this.CHARGED_COOLDOWN;
    this.comboCount = 0;
    this.comboResetTimer = 0;
    this.hitThisSwing.clear();
    this.sword?.startSwing();

    const playerPos = this.getPlayerPos();
    this.playerGroup.getWorldDirection(this._scratch);
    this.bus.emit('combat:attack', { position: playerPos.clone(), facing: this._scratch.clone(), charged: true });
    this.bus.emit('shake', { amount: 0.22 });

    // Radial cyan & violet shockwave bursts
    this.particles.burst({
      position: playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
      count: 40,
      color: 0x00f0ff,
      speed: 9.5,
      spread: 2.0,
      life: 0.6,
      size: 0.24,
    });
    this.particles.burst({
      position: playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
      count: 24,
      color: 0x8a5cff,
      speed: 7.5,
      spread: 1.6,
      life: 0.5,
      size: 0.18,
    });

    const skillBonus = this.skillActive ? 1.4 : 1.0;
    this._currentSwingDamage = Math.round(this.CHARGED_DAMAGE * skillBonus);
  }

  /** Current damage to deal during the active sword swing (set by performComboAttack). */
  private _currentSwingDamage = 42;

  /**
   * Dodge roll: grants iframes for DODGE_DURATION seconds, visual burst, and energy gain.
   */
  private performDodge(): void {
    this.isDodging = true;
    this.dodgeTimer = this.DODGE_DURATION;
    this.dodgeCooldown = this.DODGE_COOLDOWN;

    // Grant skill energy for well-timed dodge
    this.skillEnergy = Math.min(this.skillMaxEnergy, this.skillEnergy + this.SKILL_ENERGY_PER_DODGE);

    const playerPos = this.getPlayerPos();
    this.particles.burst({
      position: playerPos.clone().add(new THREE.Vector3(0, 0.6, 0)),
      count: 20,
      color: 0x00f0ff,
      speed: 5.5,
      spread: 1.4,
      life: 0.3,
      size: 0.12,
      direction: this._forwardScratch.clone().negate(),
    });
  }

  /**
   * Activate the skill (if enough energy): enters power-strike mode for SKILL_DURATION seconds.
   * While active, all attacks deal +40% damage and have enhanced visuals.
   */
  activateSkill(): void {
    if (this.skillEnergy < this.SKILL_COST) return;
    this.skillEnergy -= this.SKILL_COST;
    this.skillActive = true;
    this.skillTimer = this.SKILL_DURATION;

    const playerPos = this.getPlayerPos();
    this.particles.burst({
      position: playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
      count: 40,
      color: 0x8a5cff,
      speed: 7.0,
      spread: 1.6,
      life: 0.6,
      size: 0.2,
    });
  }

  get isSkillActive(): boolean {
    return this.skillActive;
  }

  private checkSwordHits(): void {
    if (!this.sword) return;
    this.sword.getBladeTipWorld(this._tipScratch);
    const playerPos = this.getPlayerPos();
    // Use combo-driven damage if set, else fallback constant
    const swingDamage = this._currentSwingDamage > 0 ? this._currentSwingDamage : ATTACK_DAMAGE;

    for (const robot of this.robots) {
      if (robot.faction !== 'hostile' || robot.state === 'SPAWNING' || robot.isDefeated) continue;
      // Per-swing hit registration: ensure robot only takes damage once per sword swing
      if (this.hitThisSwing.has(robot.id)) continue;

      const dist = this._tipScratch.distanceTo(robot.position);
      const distToPlayer = playerPos.distanceTo(robot.position);
      if (dist < ATTACK_RANGE || distToPlayer < 2.6) {
        this.hitThisSwing.add(robot.id);

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

        const defeated = robot.takeDamage(swingDamage);
        this.bus.emit('combat:hit', { robotId: robot.id, damage: swingDamage });

        // Gain skill energy on successful hit
        this.skillEnergy = Math.min(this.skillMaxEnergy, this.skillEnergy + this.SKILL_ENERGY_PER_HIT);

        // Impact spark explosion — color varies with combo state
        const hitColor = this.skillActive ? 0x8a5cff : robot.isElite ? 0xffaa00 : 0x00f0ff;
        this.particles.burst({
          position: robot.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
          count: 24,
          color: hitColor,
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

  defeatHostiles(): void {
    for (const r of this.robots) {
      if (r.faction === 'hostile' && !r.isDefeated) {
        if (r.state === 'SPAWNING') {
          r.state = 'CHASE';
        }
        const defeated = r.takeDamage(999);
        if (defeated) {
          this.handleRobotDefeated(r);
        }
      }
    }
  }

  private handleRobotDefeated(robot: RobotEntity): void {
    this.bus.emit('robot:defeated', { robotId: robot.id, position: robot.position.clone() });

    if (this.missionFinished) return;

    if (this.currentStageId === 6) {
      const activeHostiles = this.robots.filter((r) =>
        r.id.startsWith(`stage6-section-${this.stage6Section}-robot-`) && r.faction === 'hostile' && !r.isDefeated,
      ).length;
      this.waveObjectiveProgress = Math.min(2, Math.max(0, 2 - activeHostiles));
      this.bus.emit('objective:updated', this.getObjectiveInfo());

      if (activeHostiles === 0) {
        if (this.stage6Section === 1 && !this.stage6Section1Done) {
          this.stage6Section1Done = true;
          this.stage6Section = 2;
          this.bus.emit('combat:wave:cleared', { stage: 6, wave: 1, totalWaves: 3 });
          this.bus.emit('toast', { text: 'SECTION 1/3 CLEARED — ADVANCE TO MIDLEVEL SECTOR' });
          this.bus.emit('objective:updated', this.getObjectiveInfo());
        } else if (this.stage6Section === 2 && this.stage6Section2Spawned && !this.stage6Section2Done) {
          this.stage6Section2Done = true;
          this.stage6Section = 3;
          this.bus.emit('combat:wave:cleared', { stage: 6, wave: 2, totalWaves: 3 });
          this.bus.emit('toast', { text: 'SECTION 2/3 CLEARED — ASCEND TO REACTOR SANCTUM' });
          this.bus.emit('objective:updated', this.getObjectiveInfo());
        } else if (this.stage6Section === 3 && this.stage6Section3Spawned && !this.stage6Section3Done) {
          this.stage6Section3Done = true;
          this.stage6Section = 'complete';
          this.missionFinished = true;
          this.bus.emit('combat:wave:cleared', { stage: 6, wave: 3, totalWaves: 3 });
          this.bus.emit('toast', { text: 'STAGE 6 OBJECTIVES COMPLETE' });
          this.bus.emit('objective:updated', this.getObjectiveInfo());
        }
      }
      return;
    }

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
    if (this.currentStageId === 6) {
      // Stage 6 completes via stepping into the physical exit portal, not modal bypass
      return;
    }
    this.missionFinished = true;
    this.bus.emit('objective:updated', this.getObjectiveInfo());

    if (this.currentStageId === 10) {
      this.bus.emit('combat:campaign:complete', undefined);
    } else {
      this.bus.emit('combat:stage:victory', {
        stage: this.currentStageId,
        nextStage: this.currentStageId + 1,
      });
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

  private checkPlayerProjectileHit(projPos: THREE.Vector3, damage: number): boolean {
    for (const robot of this.robots) {
      if (robot.faction !== 'hostile' || robot.state === 'SPAWNING' || robot.isDefeated) continue;
      const robotCenter = robot.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      if (projPos.distanceTo(robotCenter) < 1.35 * robot.scale) {
        if (robot.isAttackBlockedFrom(projPos)) {
          this.bus.emit('combat:blocked', undefined);
          this.particles.burst({
            position: robotCenter,
            count: 20,
            color: 0xffaa00,
            speed: 5.5,
            spread: 1.2,
            life: 0.3,
            size: 0.15,
          });
          return true;
        }

        const defeated = robot.takeDamage(damage);
        this.bus.emit('combat:hit', { robotId: robot.id, damage });
        this.particles.burst({
          position: robotCenter,
          count: 22,
          color: robot.isElite ? 0xffaa00 : 0x00f0ff,
          speed: 6.5,
          spread: 1.3,
          life: 0.35,
          size: 0.16,
        });

        if (defeated) {
          this.handleRobotDefeated(robot);
        }
        return true;
      }
    }
    return false;
  }

  private onPlayerTakeDamage(amount: number): void {
    if (this.playerLifeState === 'DEAD') return;
    if (this.isDodging) return; // Iframes: dodge roll protects against incoming damage!

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

    // When health reaches 0, enter DEAD state
    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.playerLifeState = 'DEAD';
      this.isShielding = false;
      this.shieldGroup.visible = false;
      this.attackCooldown = 0;
      this.sword?.resetSwing();

      this.onPlayerDiedCallback?.();
    }
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

      if (this.performReboot(robot)) return;
    }
  }

  private performReboot(robot: RobotEntity): boolean {
    if (this.companions.includes(robot) || !robot.reboot()) return false;
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
    return true;
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
