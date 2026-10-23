import * as THREE from "three";

export type RobotFaction = "hostile" | "companion";
export type RobotState =
  | "SPAWNING"
  | "CHASE"
  | "TELEGRAPH"
  | "ATTACK"
  | "RECOVERY"
  | "STAGGER"
  | "DEFEATED"
  | "REBOOTING";

export type RobotType =
  | "grunt"
  | "ranger"
  | "heavy"
  | "shield"
  | "assassin"
  | "elite-grunt"
  | "elite-heavy"
  | "elite-assassin"
  | "elite-shield"
  | "warlord";

export interface RobotConfig {
  id: string;
  position: THREE.Vector3;
  type?: RobotType;
  faction?: RobotFaction;
  emergeFromGround?: boolean;
  nanotechMaterialize?: boolean;
}

const HOSTILE_EMISSIVE = 0xff2200;
const COMPANION_EMISSIVE = 0x19e6ff;
const ELITE_GOLD_EMISSIVE = 0xffaa00;
const WARLORD_EMISSIVE = 0xff1100;

export class RobotEntity {
  readonly id: string;
  readonly group = new THREE.Group();
  readonly type: RobotType;
  faction: RobotFaction;
  state: RobotState = "SPAWNING";
  health: number;
  readonly maxHealth: number;
  readonly damage: number;
  readonly moveSpeed: number;
  readonly scale: number;
  isDefeated = false;
  rebootTimer = 22;
  readonly maxRebootTime = 22;
  isEligibleForReboot = false;
  isTelegraphing = false;

  // Boss specific
  bossPhase = 1;

  // Visual groups
  private bodyGroup = new THREE.Group();
  private rightArmGroup!: THREE.Group;
  private leftArmGroup!: THREE.Group;
  private weaponGroup!: THREE.Group;
  private offhandGroup!: THREE.Group;
  private telegraphMesh!: THREE.Mesh;

  // Visual meshes
  private bodyMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private eyeMesh!: THREE.Mesh;
  private coreMesh!: THREE.Mesh;
  private markerRing!: THREE.Mesh;
  private healthBarFill!: THREE.Mesh;
  private shieldBarrierMesh: THREE.Mesh | null = null;

  // Ground emergence / Nanotech materialization
  private crackMeshes: THREE.Mesh[] = [];
  private spawnDepth = -2.5;
  private spawnDuration = 1.6;
  readonly nanotechMaterialize: boolean;

  // AI & attack timers
  private stateTimer = 0;
  private telegraphDuration = 0.65;
  private attackCooldown = 2.0;
  private cooldownTimer = 0;
  private attackDealsDamage = false;
  private attackDamageWindow = 0;
  private attackHitCount = 0;
  private attacksEnabled = true;

  // Token system: can this entity attack now?
  hasAttackToken = false;

  // Materials
  private matBody!: THREE.MeshStandardMaterial;
  private matArmor!: THREE.MeshStandardMaterial;
  private matEmissive!: THREE.MeshStandardMaterial;
  private matEye!: THREE.MeshStandardMaterial;
  private matWeapon!: THREE.MeshStandardMaterial;
  private markerMat!: THREE.MeshStandardMaterial;
  private matHealthBg!: THREE.MeshStandardMaterial;
  private matHealthFg!: THREE.MeshStandardMaterial;
  private matTelegraph!: THREE.MeshBasicMaterial;

  readonly position = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, 1);

  constructor(config: RobotConfig) {
    this.id = config.id;
    this.type = config.type ?? "grunt";
    this.faction = config.faction ?? "hostile";
    this.group.position.copy(config.position);
    this.position.copy(config.position);

    // Set stats based on robot class
    const stats = this.resolveStats(this.type);
    this.maxHealth = stats.hp;
    this.health = this.maxHealth;
    this.damage = stats.damage;
    this.moveSpeed = stats.speed;
    this.scale = stats.scale;
    this.telegraphDuration = stats.telegraphTime;
    this.attackCooldown = stats.cooldown;

    this.group.scale.setScalar(this.scale);
    this.buildMesh();

    if (config.nanotechMaterialize) {
      this.nanotechMaterialize = true;
      this.spawnDuration = 2.2;
      this.state = "SPAWNING";
      this.bodyGroup.position.y = 0;
      this.bodyGroup.scale.setScalar(0.01);
      this.spawnDepth = 0;
    } else if (config.emergeFromGround !== false) {
      this.nanotechMaterialize = false;
      this.startEmerge();
    } else {
      this.nanotechMaterialize = false;
      this.bodyGroup.position.y = 0;
      this.state = "CHASE";
      this.spawnDepth = 0;
    }
  }

  private resolveStats(type: RobotType) {
    switch (type) {
      case "grunt":
        return { hp: 100, damage: 16, speed: 3.4, scale: 1.0, telegraphTime: 0.65, cooldown: 1.8 };
      case "ranger":
        return { hp: 85, damage: 14, speed: 2.8, scale: 0.95, telegraphTime: 0.85, cooldown: 2.4 };
      case "heavy":
        return { hp: 240, damage: 28, speed: 2.1, scale: 1.5, telegraphTime: 1.05, cooldown: 3.0 };
      case "shield":
        return { hp: 150, damage: 18, speed: 2.6, scale: 1.15, telegraphTime: 0.7, cooldown: 2.2 };
      case "assassin":
        return { hp: 95, damage: 12, speed: 4.4, scale: 0.9, telegraphTime: 0.45, cooldown: 1.5 };
      case "elite-grunt":
        return { hp: 180, damage: 24, speed: 3.8, scale: 1.25, telegraphTime: 0.55, cooldown: 1.6 };
      case "elite-heavy":
        return { hp: 360, damage: 36, speed: 2.4, scale: 1.75, telegraphTime: 0.9, cooldown: 2.5 };
      case "elite-assassin":
        return { hp: 150, damage: 16, speed: 4.8, scale: 1.05, telegraphTime: 0.4, cooldown: 1.3 };
      case "elite-shield":
        return { hp: 240, damage: 22, speed: 2.8, scale: 1.3, telegraphTime: 0.65, cooldown: 2.0 };
      case "warlord":
        return { hp: 1000, damage: 35, speed: 2.6, scale: 2.65, telegraphTime: 0.75, cooldown: 1.8 };
    }
  }

  get isBoss(): boolean {
    return this.type === "warlord";
  }

  get isCompanion(): boolean {
    return this.faction === "companion" || (this.faction as string) === "ally";
  }

  get isElite(): boolean {
    return (
      this.type === "elite-grunt" ||
      this.type === "elite-heavy" ||
      this.type === "elite-assassin" ||
      this.type === "elite-shield" ||
      this.type === "warlord"
    );
  }

  private buildMesh(): void {
    this.group.add(this.bodyGroup);

    // Materials
    const isElite = this.isElite;
    const emissiveColor = isElite
      ? this.isBoss
        ? WARLORD_EMISSIVE
        : ELITE_GOLD_EMISSIVE
      : HOSTILE_EMISSIVE;

    this.matBody = new THREE.MeshStandardMaterial({
      color: this.isBoss ? 0x08080c : 0x0e1017,
      metalness: 0.92,
      roughness: 0.2,
    });

    this.matArmor = new THREE.MeshStandardMaterial({
      color: isElite ? 0x1f1408 : 0x180b0b,
      metalness: 0.88,
      roughness: 0.25,
    });

    this.matEmissive = new THREE.MeshStandardMaterial({
      color: 0x1a0505,
      emissive: emissiveColor,
      emissiveIntensity: isElite ? 3.0 : 2.2,
      metalness: 0.1,
      roughness: 0.35,
    });

    this.matEye = new THREE.MeshStandardMaterial({
      color: 0x0a0000,
      emissive: emissiveColor,
      emissiveIntensity: isElite ? 5.5 : 4.5,
    });

    this.matWeapon = new THREE.MeshStandardMaterial({
      color: 0x150000,
      emissive: emissiveColor,
      emissiveIntensity: 3.2,
      metalness: 0.2,
      roughness: 0.3,
    });

    this.markerMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.matHealthBg = new THREE.MeshStandardMaterial({
      color: 0x1a0000,
      emissive: 0x110000,
      emissiveIntensity: 0.5,
    });

    this.matHealthFg = new THREE.MeshStandardMaterial({
      color: 0xff1100,
      emissive: emissiveColor,
      emissiveIntensity: 1.2,
    });

    this.matTelegraph = new THREE.MeshBasicMaterial({
      color: 0xff0022,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // -------------------------------------------------------------------------
    // TORSO
    // -------------------------------------------------------------------------
    this.bodyMesh = mk(new THREE.BoxGeometry(0.66, 0.72, 0.5), this.matBody);
    this.bodyMesh.position.y = 1.05;
    this.bodyGroup.add(this.bodyMesh);

    // Chest armor plate
    const chestPlate = mk(new THREE.BoxGeometry(0.56, 0.58, 0.1), this.matArmor);
    chestPlate.position.set(0, 1.08, 0.25);
    this.bodyGroup.add(chestPlate);

    // Chest core reactor
    this.coreMesh = mk(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), this.matEmissive);
    this.coreMesh.rotation.x = Math.PI / 2;
    this.coreMesh.position.set(0, 1.18, 0.31);
    this.bodyGroup.add(this.coreMesh);

    // Accent stripes
    for (const sy of [-0.09, 0.0, 0.09]) {
      const stripe = mk(new THREE.BoxGeometry(0.42, 0.02, 0.03), this.matEmissive);
      stripe.position.set(0, 1.05 + sy, 0.3);
      this.bodyGroup.add(stripe);
    }

    // Heavy shoulder reactor exhausts
    if (this.type === "heavy" || this.type === "elite-heavy" || this.isBoss) {
      for (const sx of [-1, 1]) {
        const exhaust = mk(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 8), this.matArmor);
        exhaust.position.set(sx * 0.28, 1.5, -0.22);
        exhaust.rotation.x = -0.3;
        this.bodyGroup.add(exhaust);

        const exhaustGlow = mk(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), this.matEmissive);
        exhaustGlow.position.set(sx * 0.28, 1.66, -0.27);
        exhaustGlow.rotation.x = -0.3;
        this.bodyGroup.add(exhaustGlow);
      }
    }

    // -------------------------------------------------------------------------
    // HEAD & VISOR
    // -------------------------------------------------------------------------
    this.headMesh = mk(new THREE.BoxGeometry(0.48, 0.42, 0.44), this.matBody);
    this.headMesh.position.y = 1.64;
    this.bodyGroup.add(this.headMesh);

    // Horizontal Eye Visor
    this.eyeMesh = mk(new THREE.BoxGeometry(0.35, 0.06, 0.04), this.matEye);
    this.eyeMesh.position.set(0, 1.68, 0.23);
    this.bodyGroup.add(this.eyeMesh);

    // Elite & Warlord Horns / Crest
    if (this.isBoss) {
      // Warlord Horned Crown
      for (const sx of [-1, 1]) {
        const horn = mk(new THREE.ConeGeometry(0.06, 0.42, 4), this.matArmor);
        horn.position.set(sx * 0.22, 2.05, 0.05);
        horn.rotation.z = -sx * 0.4;
        horn.rotation.x = -0.2;
        this.bodyGroup.add(horn);

        const hornGlow = mk(new THREE.ConeGeometry(0.03, 0.2, 4), this.matEmissive);
        hornGlow.position.set(sx * 0.28, 2.18, 0.05);
        hornGlow.rotation.z = -sx * 0.4;
        this.bodyGroup.add(hornGlow);
      }
    } else if (isElite) {
      const crest = mk(new THREE.BoxGeometry(0.06, 0.22, 0.35), this.matEmissive);
      crest.position.set(0, 1.95, -0.05);
      crest.rotation.x = 0.2;
      this.bodyGroup.add(crest);
    }

    // -------------------------------------------------------------------------
    // SHOULDERS & PAULDRONS
    // -------------------------------------------------------------------------
    for (const sx of [-1, 1]) {
      const p = mk(new THREE.BoxGeometry(0.24, 0.12, 0.34), this.matArmor);
      p.position.set(sx * 0.45, 1.36, 0);
      p.rotation.z = sx * 0.32;
      this.bodyGroup.add(p);
    }

    // -------------------------------------------------------------------------
    // ARMS & WEAPONS
    // -------------------------------------------------------------------------
    this.rightArmGroup = this.buildArm(1);
    this.leftArmGroup = this.buildArm(-1);
    this.bodyGroup.add(this.rightArmGroup, this.leftArmGroup);

    this.weaponGroup = new THREE.Group();
    this.offhandGroup = new THREE.Group();
    this.bodyGroup.add(this.weaponGroup, this.offhandGroup);

    this.buildWeapons();

    // -------------------------------------------------------------------------
    // LEGS
    // -------------------------------------------------------------------------
    for (const sx of [-1, 1]) {
      const lg = new THREE.Group();
      const thigh = mk(new THREE.BoxGeometry(0.22, 0.42, 0.22), this.matBody);
      thigh.position.set(sx * 0.17, 0.4, 0);
      lg.add(thigh);

      const shin = mk(new THREE.BoxGeometry(0.18, 0.38, 0.2), this.matBody);
      shin.position.set(sx * 0.17, 0.03, 0);
      lg.add(shin);

      const boot = mk(new THREE.BoxGeometry(0.24, 0.1, 0.32), this.matBody);
      boot.position.set(sx * 0.17, -0.15, 0.04);
      lg.add(boot);

      const bootGlow = mk(new THREE.BoxGeometry(0.24, 0.02, 0.32), this.matEmissive);
      bootGlow.position.set(sx * 0.17, -0.2, 0.04);
      lg.add(bootGlow);

      this.bodyGroup.add(lg);
    }

    // -------------------------------------------------------------------------
    // HEALTH BAR & MARKERS
    // -------------------------------------------------------------------------
    // In-world health bar (hidden for boss, boss has top HUD bar)
    if (!this.isBoss) {
      const hbBg = mk(new THREE.BoxGeometry(0.68, 0.06, 0.02), this.matHealthBg);
      hbBg.position.set(0, 2.3, 0);
      this.group.add(hbBg);

      this.healthBarFill = mk(new THREE.BoxGeometry(0.66, 0.042, 0.025), this.matHealthFg);
      this.healthBarFill.position.set(0, 2.3, 0.008);
      this.group.add(this.healthBarFill);
    } else {
      // Invisible dummy fill so code does not null-ref
      this.healthBarFill = mk(new THREE.BoxGeometry(0.01, 0.01, 0.01), this.matHealthFg);
      this.healthBarFill.visible = false;
      this.group.add(this.healthBarFill);
    }

    // Reboot Ring
    this.markerRing = mk(new THREE.TorusGeometry(0.6, 0.045, 6, 24), this.markerMat);
    this.markerRing.rotation.x = Math.PI / 2;
    this.markerRing.position.y = 0.06;
    this.markerRing.visible = false;
    this.group.add(this.markerRing);

    // Ground Attack Telegraph Ring
    const telegraphRadius = this.type === "heavy" || this.type === "elite-heavy" ? 4.5 : this.isBoss ? 8.5 : 2.5;
    this.telegraphMesh = mk(new THREE.RingGeometry(0.3, telegraphRadius, 32), this.matTelegraph);
    this.telegraphMesh.rotation.x = -Math.PI / 2;
    this.telegraphMesh.position.y = 0.05;
    this.telegraphMesh.visible = false;
    this.group.add(this.telegraphMesh);
  }

  private buildWeapons(): void {
    const wg = this.weaponGroup;
    const og = this.offhandGroup;

    if (this.type === "ranger") {
      // Long Arm Plasma Cannon (mounted on right arm)
      const cannon = mk(new THREE.CylinderGeometry(0.07, 0.09, 0.85, 8), this.matArmor);
      cannon.position.set(0.48, 0.65, 0.32);
      cannon.rotation.x = Math.PI / 2;
      wg.add(cannon);

      const barrel = mk(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), this.matWeapon);
      barrel.position.set(0.48, 0.65, 0.76);
      barrel.rotation.x = Math.PI / 2;
      wg.add(barrel);
    } else if (this.type === "heavy" || this.type === "elite-heavy") {
      // Massive Energy Maul / Crusher
      const shaft = mk(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 8), this.matArmor);
      shaft.position.set(0.55, 0.85, 0.2);
      shaft.rotation.x = Math.PI * 0.45;
      wg.add(shaft);

      const head = mk(new THREE.BoxGeometry(0.35, 0.45, 0.35), this.matArmor);
      head.position.set(0.55, 0.85 + 0.6, 0.2);
      wg.add(head);

      const headGlow = mk(new THREE.BoxGeometry(0.38, 0.25, 0.38), this.matWeapon);
      headGlow.position.set(0.55, 0.85 + 0.6, 0.2);
      wg.add(headGlow);
    } else if (this.type === "shield" || this.type === "elite-shield") {
      // Energy Sword in right hand
      const sword = mk(new THREE.BoxGeometry(0.06, 0.68, 0.03), this.matWeapon);
      sword.position.set(0.5, 0.85, 0.2);
      sword.rotation.set(Math.PI * 0.46, 0, 0.15);
      wg.add(sword);

      // Energy Shield on left forearm
      const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x220505,
        emissive: 0xff3300,
        emissiveIntensity: 3.2,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      this.shieldBarrierMesh = mk(new THREE.BoxGeometry(0.65, 1.1, 0.05), shieldMat);
      this.shieldBarrierMesh.position.set(-0.48, 0.85, 0.28);
      og.add(this.shieldBarrierMesh);
    } else if (this.type === "assassin" || this.type === "elite-assassin") {
      // Dual Energy Daggers
      for (const [side, grp] of [[1, wg], [-1, og]] as const) {
        const dagger = mk(new THREE.BoxGeometry(0.04, 0.46, 0.02), this.matWeapon);
        dagger.position.set(side * 0.45, 0.75, 0.2);
        dagger.rotation.set(Math.PI * 0.5, 0, side * 0.2);
        grp.add(dagger);
      }
    } else if (this.isBoss) {
      // THE WARLORD: Massive Greatsword
      const hilt = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), this.matArmor);
      hilt.position.set(0.55, 0.7, 0.15);
      hilt.rotation.set(Math.PI * 0.45, 0, 0.1);
      wg.add(hilt);

      const blade = mk(new THREE.BoxGeometry(0.12, 1.25, 0.04), this.matWeapon);
      blade.position.set(0.55, 1.3, 0.15);
      blade.rotation.set(Math.PI * 0.45, 0, 0.1);
      wg.add(blade);

      // Shoulder Missile Pods
      for (const sx of [-1, 1]) {
        const pod = mk(new THREE.BoxGeometry(0.24, 0.22, 0.38), this.matArmor);
        pod.position.set(sx * 0.48, 1.6, 0.05);
        this.bodyGroup.add(pod);

        for (let r = -1; r <= 1; r += 2) {
          for (let c = -1; c <= 1; c += 2) {
            const tube = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), this.matEmissive);
            tube.position.set(sx * 0.48 + c * 0.06, 1.6 + r * 0.06, 0.24);
            tube.rotation.x = Math.PI / 2;
            this.bodyGroup.add(tube);
          }
        }
      }
    } else {
      // Standard Grunt Energy Sword
      const sword = mk(new THREE.BoxGeometry(0.06, 0.68, 0.03), this.matWeapon);
      sword.position.set(0.5, 0.85, 0.2);
      sword.rotation.set(Math.PI * 0.48, 0, 0.15);
      wg.add(sword);
    }
  }

  private buildArm(side: number): THREE.Group {
    const g = new THREE.Group();
    const upper = mk(new THREE.BoxGeometry(0.18, 0.44, 0.18), this.matBody);
    upper.position.set(side * 0.41, 0.98, 0);
    g.add(upper);

    const lower = mk(new THREE.BoxGeometry(0.16, 0.38, 0.16), this.matBody);
    lower.position.set(side * 0.41, 0.58, 0);
    g.add(lower);
    return g;
  }

  private startEmerge(): void {
    this.state = "SPAWNING";
    this.bodyGroup.position.y = this.spawnDepth;

    for (let i = 0; i < 4; i++) {
      const crackMat = new THREE.MeshBasicMaterial({
        color: this.isElite ? 0xffaa00 : 0xff2200,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.9 + Math.random() * 0.6), crackMat);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = (i * Math.PI) / 2 + (Math.random() - 0.5) * 0.5;
      c.position.y = 0.02;
      c.visible = false;
      this.group.add(c);
      this.crackMeshes.push(c);
    }
  }

  /**
   * Main per-frame AI & animation update.
   */
  update(
    dt: number,
    targetPos: THREE.Vector3,
    elapsed: number,
    onMeleeAttack: (pos: THREE.Vector3) => void,
    onFireProjectile?: (origin: THREE.Vector3, targetPos: THREE.Vector3) => void,
    onShockwave?: (pos: THREE.Vector3, radius: number, damage: number) => void,
    allowAttack = true,
  ): void {
    this.group.position.copy(this.position);
    this.attacksEnabled = allowAttack;

    if (!allowAttack && (this.state === 'TELEGRAPH' || this.state === 'ATTACK' || this.state === 'RECOVERY')) {
      this.state = 'CHASE';
      this.stateTimer = 0;
      this.isTelegraphing = false;
      this.attackDealsDamage = false;
      this.attackDamageWindow = 0;
      this.hasAttackToken = false;
    }

    // Defeated animation
    if (this.state === "DEFEATED") {
      this.updateDefeated(dt);
      return;
    }

    // Cooldown countdown
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    // Look toward target (ignore Y for rotation)
    if (this.state !== "SPAWNING") {
      const dx = targetPos.x - this.position.x;
      const dz = targetPos.z - this.position.z;
      if (Math.hypot(dx, dz) > 0.05) {
        const targetAngle = Math.atan2(dx, dz);
        this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, dt * 8);
        this.forward.set(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y)).normalize();
      }
    }

    switch (this.state) {
      case "SPAWNING":
        this.updateSpawning(dt, elapsed);
        break;
      case "CHASE":
        this.updateChase(dt, targetPos);
        break;
      case "TELEGRAPH":
        this.updateTelegraph(dt);
        break;
      case "ATTACK":
        this.updateAttack(dt, targetPos, onMeleeAttack, onFireProjectile, onShockwave);
        break;
      case "RECOVERY":
        this.updateRecovery(dt);
        break;
      case "STAGGER":
        this.updateStagger(dt);
        break;
    }

    // Dynamic animations (only when active, not while spawning)
    if (this.state !== "SPAWNING") {
      this.bodyGroup.position.y = Math.sin(elapsed * 2.0 + this.id.charCodeAt(0)) * 0.04;
    }

    // Telegraph visibility & scaling
    this.telegraphMesh.visible = this.state === "TELEGRAPH";
    if (this.telegraphMesh.visible) {
      const prog = Math.min(1, this.stateTimer / this.telegraphDuration);
      this.telegraphMesh.scale.setScalar(0.2 + prog * 0.8);
      this.matTelegraph.opacity = 0.2 + prog * 0.45;
    }

    // Arm swing / strike animation
    const swing =
      this.state === "ATTACK" ? Math.sin(this.stateTimer * Math.PI * 4) * 0.7 : 0;
    this.rightArmGroup.rotation.x = swing;
    this.weaponGroup.rotation.x = swing * 0.9;

    // Health bar update
    if (this.healthBarFill && !this.isBoss) {
      const hpRatio = Math.max(0, this.health / this.maxHealth);
      this.healthBarFill.scale.x = Math.max(0.001, hpRatio);
      this.healthBarFill.position.x = (hpRatio - 1) * 0.32;
    }

    // Reboot marker pulsing
    if (this.markerRing.visible) {
      this.markerMat.opacity = 0.4 + Math.sin(elapsed * 4) * 0.25;
      this.markerRing.rotation.z += dt * 1.5;
    }
  }

  private updateSpawning(dt: number, _elapsed: number): void {
    this.stateTimer += dt;
    const t = Math.min(1, this.stateTimer / this.spawnDuration);

    if (this.nanotechMaterialize) {
      // Futuristic Nanotechnology Materialization
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const currentScale = THREE.MathUtils.lerp(0.02, 1.0, ease);
      this.bodyGroup.scale.setScalar(currentScale);
      this.bodyGroup.position.y = (1.0 - ease) * 0.35;

      // Energy pulse during nanite matrix formation
      const pulse = 1.0 + Math.sin(t * Math.PI * 5) * 0.75;
      if (this.matEmissive) {
        this.matEmissive.emissiveIntensity = pulse * 2.2;
      }
      if (this.matEye) {
        this.matEye.emissiveIntensity = pulse * (t > 0.6 ? 2.6 : 0.6);
      }

      if (t >= 1) {
        this.state = "CHASE";
        this.stateTimer = 0;
        this.bodyGroup.scale.setScalar(1.0);
        this.bodyGroup.position.y = 0;
        if (this.matEmissive) this.matEmissive.emissiveIntensity = 1.4;
        if (this.matEye) this.matEye.emissiveIntensity = 2.0;
      }
      return;
    }

    if (t >= 0.25) {
      for (const c of this.crackMeshes) c.visible = true;
    }

    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.bodyGroup.position.y = THREE.MathUtils.lerp(this.spawnDepth, 0, ease);

    if (t >= 1) {
      for (const c of this.crackMeshes) c.visible = false;
      this.state = "CHASE";
      this.stateTimer = 0;
      this.bodyGroup.position.y = 0;
    }
  }

  private updateChase(dt: number, targetPos: THREE.Vector3): void {
    const dist = this.position.distanceTo(targetPos);
    const canAttack = this.attacksEnabled && this.cooldownTimer <= 0 && (this.hasAttackToken || this.isCompanion);

    // Range-based positioning
    if (this.type === "ranger") {
      // Ranger tries to keep 8 - 14m distance
      if (dist < 7.0) {
        // Back away
        const away = new THREE.Vector3().subVectors(this.position, targetPos).normalize();
        this.position.addScaledVector(away, dt * this.moveSpeed);
      } else if (dist > 14.0) {
        // Close distance
        const towards = new THREE.Vector3().subVectors(targetPos, this.position).normalize();
        towards.y = 0;
        this.position.addScaledVector(towards, dt * this.moveSpeed);
      }

      // Check attack trigger
      if (dist <= 18.0 && canAttack) {
        this.state = "TELEGRAPH";
        this.stateTimer = 0;
        this.isTelegraphing = true;
      }
      return;
    }

    // Melee / Heavy / Assassin / Boss chase logic
    const idealEngageDist =
      this.type === "heavy" || this.type === "elite-heavy"
        ? 3.6
        : this.isBoss
          ? 4.8
          : 2.2;

    if (dist > idealEngageDist) {
      const dir = new THREE.Vector3(targetPos.x - this.position.x, 0, targetPos.z - this.position.z).normalize();
      this.position.addScaledVector(dir, dt * this.moveSpeed);
      this.position.y = targetPos.y;
    } else if (canAttack) {
      this.state = "TELEGRAPH";
      this.stateTimer = 0;
      this.isTelegraphing = true;
    }
  }

  private updateTelegraph(dt: number): void {
    this.stateTimer += dt;
    if (this.stateTimer >= this.telegraphDuration) {
      this.state = "ATTACK";
      this.stateTimer = 0;
      this.isTelegraphing = false;
      this.attackDealsDamage = true;
      this.attackDamageWindow = 0.35;
      this.attackHitCount = 0;
    }
  }

  private updateAttack(
    dt: number,
    targetPos: THREE.Vector3,
    onMeleeAttack: (pos: THREE.Vector3) => void,
    onFireProjectile?: (origin: THREE.Vector3, targetPos: THREE.Vector3) => void,
    onShockwave?: (pos: THREE.Vector3, radius: number, damage: number) => void,
  ): void {
    this.stateTimer += dt;
    this.attackDamageWindow -= dt;

    if (this.attackDealsDamage && this.attackDamageWindow > 0) {
      if (this.type === "ranger") {
        // Fire ranged projectile
        const origin = this.position.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(this.forward, 0.6);
        onFireProjectile?.(origin, targetPos);
        this.attackDealsDamage = false;
      } else if (this.type === "heavy" || this.type === "elite-heavy") {
        // Ground slam shockwave
        onShockwave?.(this.position.clone(), 4.5, this.damage);
        this.attackDealsDamage = false;
      } else if (this.isBoss) {
        // Boss attack: alternates cleave, shockwave stomp, or missile barrage based on phase
        if (this.bossPhase >= 2 && Math.random() < 0.45) {
          onShockwave?.(this.position.clone(), 8.0, 32);
        } else {
          onMeleeAttack(this.position.clone());
        }
        this.attackDealsDamage = false;
      } else if (this.type === "assassin" || this.type === "elite-assassin") {
        // Double dagger strike
        const dist = this.position.distanceTo(targetPos);
        if (dist < 2.5 && this.attackHitCount < 2) {
          onMeleeAttack(this.position.clone());
          this.attackHitCount++;
        }
      } else {
        // Standard melee strike
        const dist = this.position.distanceTo(targetPos);
        if (dist < 2.4) {
          onMeleeAttack(this.position.clone());
          this.attackDealsDamage = false;
        }
      }
    }

    if (this.stateTimer >= (this.isBoss ? 0.8 : 0.5)) {
      this.state = "RECOVERY";
      this.stateTimer = 0;
      this.cooldownTimer = this.attackCooldown;
      this.attackDealsDamage = false;
      this.hasAttackToken = false; // release attack token
    }
  }

  private updateRecovery(dt: number): void {
    this.stateTimer += dt;
    if (this.stateTimer >= (this.isBoss ? 0.5 : 0.35)) {
      this.state = "CHASE";
      this.stateTimer = 0;
    }
  }

  private updateStagger(dt: number): void {
    this.stateTimer += dt;
    if (this.stateTimer >= 0.45) {
      this.state = "CHASE";
      this.stateTimer = 0;
    }
  }

  private updateDefeated(dt: number): void {
    if (this.isEligibleForReboot) {
      this.rebootTimer -= dt;
      if (this.rebootTimer <= 0) {
        this.markerRing.visible = false;
        this.isEligibleForReboot = false;
      }
    }

    if (this.bodyGroup.rotation.x < 1.4) {
      this.bodyGroup.rotation.x = Math.min(1.4, this.bodyGroup.rotation.x + 0.05);
    }
  }

  /**
   * Check if an attack from `attackerPos` is blocked by this robot's shield (Shield Defenders).
   */
  isAttackBlockedFrom(attackerPos: THREE.Vector3): boolean {
    if (this.type !== "shield" && this.type !== "elite-shield") return false;
    if (this.state === "RECOVERY" || this.state === "STAGGER") return false;

    // Check angle: is attacker in front of shield?
    const toAttacker = new THREE.Vector3().subVectors(attackerPos, this.position).normalize();
    toAttacker.y = 0;
    toAttacker.normalize();

    const dot = this.forward.dot(toAttacker);
    return dot > 0.15; // Within ~80 degree frontal cone
  }

  takeDamage(amount: number): boolean {
    if (this.isDefeated || this.state === "SPAWNING") return false;

    this.health = Math.max(0, this.health - amount);

    // Update Boss phase if Warlord
    if (this.isBoss) {
      const hpPct = this.health / this.maxHealth;
      if (hpPct <= 0.35) {
        this.bossPhase = 3;
        this.matEmissive.emissiveIntensity = 5.0; // Overdrive glow
      } else if (hpPct <= 0.7) {
        this.bossPhase = 2;
      }
    }

    if (this.health <= 0) {
      this.defeat();
      return true;
    }

    // Heavy and Boss resist minor stagger
    if (this.type !== "heavy" && this.type !== "elite-heavy" && !this.isBoss) {
      this.state = "STAGGER";
      this.stateTimer = 0;
    }

    return false;
  }

  private defeat(): void {
    this.isDefeated = true;
    this.state = "DEFEATED";
    this.stateTimer = 0;
    this.hasAttackToken = false;
    this.isTelegraphing = false;
    this.telegraphMesh.visible = false;
    this.attackDealsDamage = false;
    this.attackDamageWindow = 0;

    // Boss cannot be rebooted
    if (!this.isBoss) {
      this.isEligibleForReboot = true;
      this.markerRing.visible = true;
      this.rebootTimer = this.maxRebootTime;
    }

    this.matEmissive.emissiveIntensity = 0.15;
    this.matEye.emissiveIntensity = 0.2;
    this.matWeapon.emissiveIntensity = 0.15;
  }

  reboot(): boolean {
    if (this.isBoss || !this.isDefeated || !this.isEligibleForReboot) return false;
    this.faction = "companion";
    this.isDefeated = false;
    this.state = "CHASE";
    this.stateTimer = 0;
    this.health = this.maxHealth;
    this.isEligibleForReboot = false;
    this.markerRing.visible = false;
    this.bodyGroup.rotation.x = 0;
    this.rightArmGroup.rotation.set(0, 0, 0);
    this.leftArmGroup.rotation.set(0, 0, 0);
    this.weaponGroup.rotation.set(0, 0, 0);
    this.attackDealsDamage = false;
    this.attackDamageWindow = 0;
    this.attackHitCount = 0;
    this.isTelegraphing = false;
    this.telegraphMesh.visible = false;
    this.cooldownTimer = 0.4;
    this.hasAttackToken = false;
    this.attacksEnabled = true;

    // Switch to companion cyan styling
    this.matEmissive.emissive.setHex(COMPANION_EMISSIVE);
    this.matEmissive.emissiveIntensity = 2.6;
    this.matEye.emissive.setHex(COMPANION_EMISSIVE);
    this.matEye.emissiveIntensity = 4.5;
    this.matWeapon.emissive.setHex(0x8a5cff);
    this.matWeapon.emissiveIntensity = 2.8;
    this.matHealthFg.emissive.setHex(COMPANION_EMISSIVE);
    return true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.matBody.dispose();
    this.matArmor.dispose();
    this.matEmissive.dispose();
    this.matEye.dispose();
    this.matWeapon.dispose();
    this.markerMat.dispose();
    this.matHealthBg.dispose();
    this.matHealthFg.dispose();
    this.matTelegraph.dispose();
    for (const c of this.crackMeshes) {
      (c.material as THREE.Material).dispose();
      c.geometry.dispose();
    }
  }
}

function mk(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.frustumCulled = false;
  return m;
}
