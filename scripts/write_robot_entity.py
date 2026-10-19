#!/usr/bin/env python3
"""Writes the enhanced RobotEntity.ts with better red armor appearance."""
import os

content = '''\
import * as THREE from "three";

export type RobotFaction = "hostile" | "companion";
export type RobotState = "SPAWNING" | "CHASE" | "TELEGRAPH" | "ATTACK" | "RECOVERY" | "STAGGER" | "DEFEATED" | "REBOOTING";

export interface RobotConfig {
  id: string;
  position: THREE.Vector3;
  faction?: RobotFaction;
  emergeFromGround?: boolean;
}

const HOSTILE_EMISSIVE = 0xff2200;
const COMPANION_EMISSIVE = 0x19e6ff;

/**
 * A combat robot entity — Dark Armored Red Knight variant.
 * Visually distinct from the Cyan Knight player:
 *  - Dark gunmetal body with crimson illuminated armor plating
 *  - Angular shoulder pauldrons with red glow underside
 *  - Horizontal red visor
 *  - Chest armor with bright red core reactor gem
 *  - Chunky greave boots with red ankle vents
 *  - Heavy energy blade weapon
 *
 * Can be hostile (red) or rebooted companion (cyan).
 * Rises dramatically from the ground during spawning.
 */
export class RobotEntity {
  readonly id: string;
  readonly group = new THREE.Group();
  faction: RobotFaction;
  state: RobotState = "SPAWNING";
  health = 100;
  readonly maxHealth = 100;
  isDefeated = false;
  rebootTimer = 18;
  readonly maxRebootTime = 18;
  isEligibleForReboot = false;
  isTelegraphing = false;

  // Visual groups
  private bodyGroup = new THREE.Group();
  private shoulderGroup_L!: THREE.Group;
  private shoulderGroup_R!: THREE.Group;
  private rightArmGroup!: THREE.Group;
  private leftArmGroup!: THREE.Group;

  // Visual meshes
  private bodyMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private eyeMesh!: THREE.Mesh;
  private coreMesh!: THREE.Mesh;
  private weaponMesh!: THREE.Mesh;
  private markerRing!: THREE.Mesh;
  private healthBarMesh!: THREE.Mesh;
  private healthBarFill!: THREE.Mesh;

  // Ground emergence
  private crackMeshes: THREE.Mesh[] = [];
  private spawnDepth = -2.5;
  private readonly spawnDuration = 1.8;

  // AI state machine
  private stateTimer = 0;
  private readonly telegraphDuration = 0.65;
  private readonly attackCooldown = 2.0;
  private cooldownTimer = 0;
  private attackDealsDamage = false;
  private attackDamageWindow = 0;

  // Materials (kept for reboot recoloring)
  private matBody!: THREE.MeshStandardMaterial;
  private matArmor!: THREE.MeshStandardMaterial;
  private matEmissive!: THREE.MeshStandardMaterial;
  private matEye!: THREE.MeshStandardMaterial;
  private matWeapon!: THREE.MeshStandardMaterial;
  private markerMat!: THREE.MeshStandardMaterial;
  private matHealthBg!: THREE.MeshStandardMaterial;
  private matHealthFg!: THREE.MeshStandardMaterial;
  private extraMaterials: THREE.Material[] = [];

  private readonly elapsedRef: { t: number } = { t: 0 };

  readonly position = new THREE.Vector3();

  constructor(config: RobotConfig) {
    this.id = config.id;
    this.faction = config.faction ?? "hostile";
    this.group.position.copy(config.position);
    this.position.copy(config.position);

    this.buildMesh();

    if (config.emergeFromGround !== false) {
      this.startEmerge();
    } else {
      this.bodyGroup.position.y = 0;
      this.state = "CHASE";
      this.spawnDepth = 0;
    }
  }

  private buildMesh(): void {
    this.group.add(this.bodyGroup);

    // -------------------------------------------------------------------------
    // Materials
    // -------------------------------------------------------------------------
    this.matBody = new THREE.MeshStandardMaterial({
      color: 0x0f1015,  // very dark gunmetal
      metalness: 0.92,
      roughness: 0.18,
    });

    this.matArmor = new THREE.MeshStandardMaterial({
      color: 0x1a0a0a,  // dark near-black with warmth
      metalness: 0.88,
      roughness: 0.25,
    });

    this.matEmissive = new THREE.MeshStandardMaterial({
      color: 0x220000,
      emissive: HOSTILE_EMISSIVE,
      emissiveIntensity: 2.2,
      metalness: 0.1,
      roughness: 0.35,
    });

    this.matEye = new THREE.MeshStandardMaterial({
      color: 0x0a0000,
      emissive: HOSTILE_EMISSIVE,
      emissiveIntensity: 4.5,
    });

    this.matWeapon = new THREE.MeshStandardMaterial({
      color: 0x150000,
      emissive: HOSTILE_EMISSIVE,
      emissiveIntensity: 3.0,
      metalness: 0.2,
      roughness: 0.3,
    });

    this.markerMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 1.5,
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
      color: 0xff0000,
      emissive: 0xff2200,
      emissiveIntensity: 1.2,
    });

    this.extraMaterials.push(this.matHealthBg, this.matHealthFg, this.matArmor);

    // -------------------------------------------------------------------------
    // TORSO — angular armored box body
    // -------------------------------------------------------------------------
    this.bodyMesh = mk(new THREE.BoxGeometry(0.65, 0.72, 0.48), this.matBody);
    this.bodyMesh.position.y = 1.05;
    this.bodyGroup.add(this.bodyMesh);

    // Chest armor plate
    const chestPlate = mk(new THREE.BoxGeometry(0.55, 0.58, 0.08), this.matArmor);
    chestPlate.position.set(0, 1.08, 0.24);
    this.bodyGroup.add(chestPlate);

    // Chest core reactor gem
    this.coreMesh = mk(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), this.matEmissive);
    this.coreMesh.rotation.x = Math.PI / 2;
    this.coreMesh.position.set(0, 1.18, 0.29);
    this.bodyGroup.add(this.coreMesh);

    // Core outer ring
    const coreRing = mk(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), this.matArmor);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.set(0, 1.18, 0.27);
    this.bodyGroup.add(coreRing);

    // Chest accent stripes
    for (const sy of [-0.1, 0.0, 0.1]) {
      const stripe = mk(new THREE.BoxGeometry(0.42, 0.018, 0.025), this.matEmissive);
      stripe.position.set(0, 1.05 + sy, 0.29);
      this.bodyGroup.add(stripe);
    }

    // Abdomen segmented plates
    for (let i = 0; i < 3; i++) {
      const ab = mk(new THREE.BoxGeometry(0.44, 0.06, 0.06), this.matArmor);
      ab.position.set(0, 0.78 - i * 0.075, 0.22);
      this.bodyGroup.add(ab);
    }

    // -------------------------------------------------------------------------
    // HEAD — angular helmet with horizontal visor
    // -------------------------------------------------------------------------
    this.headMesh = mk(new THREE.BoxGeometry(0.48, 0.42, 0.44), this.matBody);
    this.headMesh.position.y = 1.64;
    this.bodyGroup.add(this.headMesh);

    // Helmet dome accent (slightly larger dark plate on top)
    const helmTop = mk(new THREE.BoxGeometry(0.45, 0.06, 0.42), this.matArmor);
    helmTop.position.y = 1.87;
    this.bodyGroup.add(helmTop);

    // Antenna spike
    const antenna = mk(new THREE.CylinderGeometry(0.012, 0.008, 0.16, 6), this.matEmissive);
    antenna.position.set(0, 2.02, 0);
    this.bodyGroup.add(antenna);

    // Cheek plates (angular side armor)
    for (const sx of [-1, 1]) {
      const cheek = mk(new THREE.BoxGeometry(0.06, 0.28, 0.42), this.matArmor);
      cheek.position.set(sx * 0.24, 1.64, 0);
      cheek.rotation.y = sx * 0.12;
      this.bodyGroup.add(cheek);
    }

    // Horizontal Red Visor
    this.eyeMesh = mk(new THREE.BoxGeometry(0.34, 0.058, 0.04), this.matEye);
    this.eyeMesh.position.set(0, 1.68, 0.23);
    this.bodyGroup.add(this.eyeMesh);

    // Brow ridge above visor
    const brow = mk(new THREE.BoxGeometry(0.38, 0.03, 0.03), this.matEmissive);
    brow.position.set(0, 1.72, 0.23);
    this.bodyGroup.add(brow);

    // Chin plate
    const chin = mk(new THREE.BoxGeometry(0.24, 0.08, 0.06), this.matArmor);
    chin.position.set(0, 1.49, 0.2);
    this.bodyGroup.add(chin);

    // -------------------------------------------------------------------------
    // SHOULDERS — multi-tiered angular pauldrons
    // -------------------------------------------------------------------------
    for (const sx of [-1, 1]) {
      const sg = new THREE.Group();
      sg.position.set(sx * 0.44, 1.35, 0);

      // Main pauldron (large angular top plate)
      const main = mk(new THREE.BoxGeometry(0.22, 0.1, 0.32), this.matArmor);
      main.rotation.z = sx * 0.35;
      main.position.set(sx * 0.04, 0.06, 0);
      sg.add(main);

      // Mid shoulder ring
      const mid = mk(new THREE.BoxGeometry(0.18, 0.07, 0.28), this.matBody);
      mid.rotation.z = sx * 0.42;
      mid.position.set(sx * 0.06, -0.01, 0);
      sg.add(mid);

      // Red glow underplate
      const glow = mk(new THREE.BoxGeometry(0.15, 0.022, 0.24), this.matEmissive);
      glow.rotation.z = sx * 0.42;
      glow.position.set(sx * 0.07, -0.06, 0);
      sg.add(glow);

      // Outer spike/pointed edge
      const spike = mk(new THREE.BoxGeometry(0.06, 0.14, 0.08), this.matArmor);
      spike.position.set(sx * 0.14, 0.02, 0);
      spike.rotation.z = sx * 0.55;
      sg.add(spike);

      if (sx < 0) this.shoulderGroup_L = sg;
      else this.shoulderGroup_R = sg;
      this.bodyGroup.add(sg);
    }

    // -------------------------------------------------------------------------
    // ARMS
    // -------------------------------------------------------------------------
    this.leftArmGroup = this.buildArm(-1);
    this.rightArmGroup = this.buildArm(1);
    this.bodyGroup.add(this.leftArmGroup, this.rightArmGroup);

    // -------------------------------------------------------------------------
    // WEAPON — heavy red energy blade on right arm
    // -------------------------------------------------------------------------
    const wg = new THREE.Group();
    // Hilt
    const wHilt = mk(new THREE.CylinderGeometry(0.026, 0.022, 0.22, 8), this.matArmor);
    wg.add(wHilt);
    // Grip rings
    for (let i = 0; i < 3; i++) {
      const ring = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 8), this.matEmissive);
      ring.position.y = (-0.06 + i * 0.06);
      wg.add(ring);
    }
    // Guard
    const wGuard = mk(new THREE.BoxGeometry(0.2, 0.04, 0.06), this.matArmor);
    wGuard.position.y = 0.13;
    wg.add(wGuard);
    // Blade body
    const wBlade = mk(new THREE.BoxGeometry(0.06, 0.62, 0.03), this.matWeapon);
    wBlade.position.y = 0.46;
    wg.add(wBlade);
    // Blade edges
    for (const sx of [-1, 1]) {
      const edge = mk(new THREE.BoxGeometry(0.015, 0.58, 0.02), this.matEmissive);
      edge.position.set(sx * 0.035, 0.46, 0);
      wg.add(edge);
    }
    // Tip
    const wTip = mk(new THREE.ConeGeometry(0.038, 0.12, 4), this.matWeapon);
    wTip.position.y = 0.81;
    wTip.rotation.y = Math.PI / 4;
    wg.add(wTip);

    wg.rotation.set(Math.PI * 0.48, 0, 0.15);
    wg.position.set(0.52, 0.85, 0.2);
    this.weaponMesh = wBlade; // reference for animation
    this.bodyGroup.add(wg);

    // -------------------------------------------------------------------------
    // LEGS — heavy armored greaves
    // -------------------------------------------------------------------------
    for (const sx of [-1, 1]) {
      const lg = new THREE.Group();

      // Thigh
      const thigh = mk(new THREE.BoxGeometry(0.22, 0.42, 0.22), this.matBody);
      thigh.position.set(sx * 0.17, 0.4, 0);
      lg.add(thigh);

      // Thigh armor plate
      const thighPlate = mk(new THREE.BoxGeometry(0.2, 0.35, 0.04), this.matArmor);
      thighPlate.position.set(sx * 0.17, 0.4, 0.1);
      lg.add(thighPlate);

      // Thigh glow stripe
      const thighGlow = mk(new THREE.BoxGeometry(0.1, 0.26, 0.022), this.matEmissive);
      thighGlow.position.set(sx * 0.17, 0.4, 0.12);
      lg.add(thighGlow);

      // Knee cap
      const knee = mk(new THREE.BoxGeometry(0.2, 0.075, 0.16), this.matArmor);
      knee.position.set(sx * 0.17, 0.22, 0.04);
      lg.add(knee);

      // Knee glow slot
      const kneeGlow = mk(new THREE.BoxGeometry(0.15, 0.025, 0.04), this.matEmissive);
      kneeGlow.position.set(sx * 0.17, 0.22, 0.1);
      lg.add(kneeGlow);

      // Shin
      const shin = mk(new THREE.BoxGeometry(0.18, 0.38, 0.2), this.matBody);
      shin.position.set(sx * 0.17, 0.03, 0);
      lg.add(shin);

      // Shin front plate
      const shinPlate = mk(new THREE.BoxGeometry(0.12, 0.32, 0.04), this.matArmor);
      shinPlate.position.set(sx * 0.17, 0.03, 0.1);
      lg.add(shinPlate);

      // Shin glow stripe
      const shinGlow = mk(new THREE.BoxGeometry(0.06, 0.24, 0.02), this.matEmissive);
      shinGlow.position.set(sx * 0.17, 0.03, 0.13);
      lg.add(shinGlow);

      // Boot
      const boot = mk(new THREE.BoxGeometry(0.24, 0.1, 0.32), this.matBody);
      boot.position.set(sx * 0.17, -0.15, 0.04);
      lg.add(boot);

      // Boot toe cap
      const toeCap = mk(new THREE.BoxGeometry(0.22, 0.08, 0.1), this.matArmor);
      toeCap.position.set(sx * 0.17, -0.15, 0.12);
      lg.add(toeCap);

      // Boot sole glow rim
      const bootGlow = mk(new THREE.BoxGeometry(0.24, 0.022, 0.32), this.matEmissive);
      bootGlow.position.set(sx * 0.17, -0.2, 0.04);
      lg.add(bootGlow);

      this.bodyGroup.add(lg);
    }

    // -------------------------------------------------------------------------
    // FLOATING HEALTH BAR (above robot's head)
    // -------------------------------------------------------------------------
    const hbBg = mk(new THREE.BoxGeometry(0.64, 0.055, 0.02), this.matHealthBg);
    hbBg.position.set(0, 2.25, 0);
    hbBg.frustumCulled = false;
    this.group.add(hbBg);

    this.healthBarFill = mk(new THREE.BoxGeometry(0.62, 0.038, 0.025), this.matHealthFg);
    this.healthBarFill.position.set(0, 2.25, 0.008);
    this.healthBarFill.frustumCulled = false;
    this.group.add(this.healthBarFill);

    // -------------------------------------------------------------------------
    // REBOOT MARKER RING
    // -------------------------------------------------------------------------
    this.markerRing = mk(new THREE.TorusGeometry(0.55, 0.045, 6, 24), this.markerMat);
    this.markerRing.rotation.x = Math.PI / 2;
    this.markerRing.position.y = 0.06;
    this.markerRing.visible = false;
    this.group.add(this.markerRing);
  }

  private buildArm(side: number): THREE.Group {
    const g = new THREE.Group();

    // Upper arm
    const upper = mk(new THREE.BoxGeometry(0.18, 0.44, 0.18), this.matBody);
    upper.position.set(side * 0.41, 0.98, 0);
    g.add(upper);

    // Upper arm outer plate
    const upperPlate = mk(new THREE.BoxGeometry(0.04, 0.36, 0.04), this.matArmor);
    upperPlate.position.set(side * 0.5, 0.98, 0);
    g.add(upperPlate);

    // Upper arm glow line
    const upperGlow = mk(new THREE.BoxGeometry(0.015, 0.3, 0.018), this.matEmissive);
    upperGlow.position.set(side * 0.505, 0.98, 0);
    g.add(upperGlow);

    // Forearm
    const lower = mk(new THREE.BoxGeometry(0.16, 0.38, 0.16), this.matBody);
    lower.position.set(side * 0.41, 0.58, 0);
    g.add(lower);

    // Forearm front plate
    const lowerPlate = mk(new THREE.BoxGeometry(0.12, 0.32, 0.04), this.matArmor);
    lowerPlate.position.set(side * 0.41, 0.58, 0.08);
    g.add(lowerPlate);

    // Forearm glow stripe
    const lowerGlow = mk(new THREE.BoxGeometry(0.06, 0.26, 0.02), this.matEmissive);
    lowerGlow.position.set(side * 0.41, 0.58, 0.10);
    g.add(lowerGlow);

    // Elbow accent ring
    const elbow = mk(new THREE.BoxGeometry(0.18, 0.04, 0.18), this.matEmissive);
    elbow.position.set(side * 0.41, 0.78, 0);
    g.add(elbow);

    return g;
  }

  private startEmerge(): void {
    this.state = "SPAWNING";
    this.bodyGroup.position.y = this.spawnDepth;

    // Ground cracks: ring of glowing fractures
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const crack = mk(
        new THREE.BoxGeometry(0.08, 0.02, 0.55 + Math.random() * 0.35),
        new THREE.MeshStandardMaterial({ color: 0x220000, emissive: HOSTILE_EMISSIVE, emissiveIntensity: 2.8 }),
      );
      crack.position.set(Math.cos(a) * 0.55, 0.01, Math.sin(a) * 0.55);
      crack.rotation.y = a;
      crack.visible = false;
      this.group.add(crack);
      this.crackMeshes.push(crack);
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    elapsed: number,
    onAttack: (pos: THREE.Vector3) => void,
  ): void {
    this.elapsedRef.t = elapsed;

    if (this.state === "SPAWNING") {
      this.updateSpawning(dt, elapsed);
      return;
    }
    if (this.state === "DEFEATED") {
      this.updateDefeated(dt);
      return;
    }
    if (this.state === "REBOOTING") return;

    this.group.position.copy(this.position);

    // Face the player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    switch (this.state) {
      case "CHASE": this.updateChase(dt, playerPos); break;
      case "TELEGRAPH": this.updateTelegraph(dt); break;
      case "ATTACK": this.updateAttack(dt, playerPos, onAttack); break;
      case "RECOVERY": this.updateRecovery(dt); break;
      case "STAGGER": this.updateStagger(dt); break;
    }

    // Idle body bob
    this.bodyGroup.position.y = Math.sin(elapsed * 1.8 + this.id.charCodeAt(0)) * 0.035;

    // Arm swing during attack
    const swingAngle = this.state === "ATTACK"
      ? Math.sin(this.stateTimer * Math.PI * 4) * 0.55
      : 0;
    this.rightArmGroup.rotation.x = swingAngle;

    // Eye pulse
    const pulse = 3.2 + Math.sin(elapsed * 4.5) * 0.9;
    this.matEye.emissiveIntensity = this.state === "TELEGRAPH"
      ? 6.5 + Math.sin(elapsed * 14) * 2.5
      : pulse;

    // Core pulse
    this.matEmissive.emissiveIntensity = 1.8 + Math.sin(elapsed * 3.2) * 0.5;

    // Health bar update
    const hpRatio = Math.max(0, this.health / this.maxHealth);
    this.healthBarFill.scale.x = Math.max(0.001, hpRatio);
    this.healthBarFill.position.x = (hpRatio - 1) * 0.31;

    // Marker ring pulse
    if (this.markerRing.visible) {
      this.markerMat.opacity = 0.4 + Math.sin(elapsed * 3.5) * 0.25;
      this.markerRing.rotation.z += dt * 1.5;
    }
  }

  private updateSpawning(dt: number, elapsed: number): void {
    this.stateTimer += dt;
    const t = Math.min(1, this.stateTimer / this.spawnDuration);

    if (t >= 0.3) {
      for (const c of this.crackMeshes) c.visible = true;
    }

    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.bodyGroup.position.y = THREE.MathUtils.lerp(this.spawnDepth, 0, ease);
    this.bodyGroup.position.y += Math.sin(elapsed * 8) * 0.015 * (1 - t);

    if (t >= 1) {
      for (const c of this.crackMeshes) c.visible = false;
      this.state = "CHASE";
      this.stateTimer = 0;
      this.bodyGroup.position.y = 0;
    }
  }

  private updateChase(dt: number, playerPos: THREE.Vector3): void {
    const dist = this.position.distanceTo(playerPos);
    const speed = this.faction === "companion" ? 3.8 : 3.0;

    if (dist > 2.5) {
      const dir = new THREE.Vector3(
        playerPos.x - this.position.x,
        0,
        playerPos.z - this.position.z,
      ).normalize();
      this.position.addScaledVector(dir, dt * speed);
      this.position.y = playerPos.y;
    } else if (this.cooldownTimer <= 0) {
      this.state = "TELEGRAPH";
      this.stateTimer = 0;
      this.isTelegraphing = true;
    }

    if (this.faction === "companion" && dist < 3.5) {
      const dir = new THREE.Vector3(
        this.position.x - playerPos.x,
        0,
        this.position.z - playerPos.z,
      ).normalize();
      this.position.addScaledVector(dir, dt * 1.5);
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
    }
  }

  private updateAttack(dt: number, playerPos: THREE.Vector3, onAttack: (pos: THREE.Vector3) => void): void {
    this.stateTimer += dt;
    this.attackDamageWindow -= dt;

    if (this.attackDealsDamage && this.attackDamageWindow > 0) {
      const dist = this.position.distanceTo(playerPos);
      if (dist < 2.2) {
        onAttack(this.position.clone());
        this.attackDealsDamage = false;
      }
    }

    if (this.stateTimer >= 0.5) {
      this.state = "RECOVERY";
      this.stateTimer = 0;
      this.cooldownTimer = this.attackCooldown;
      this.attackDealsDamage = false;
    }
  }

  private updateRecovery(dt: number): void {
    this.stateTimer += dt;
    if (this.stateTimer >= 0.38) {
      this.state = "CHASE";
      this.stateTimer = 0;
    }
  }

  private updateStagger(dt: number): void {
    this.stateTimer += dt;
    if (this.stateTimer >= 0.48) {
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
    // Slump to ground animation
    if (this.bodyGroup.rotation.x < 1.4) {
      this.bodyGroup.rotation.x = Math.min(1.4, this.bodyGroup.rotation.x + 0.045);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isDefeated || this.state === "SPAWNING") return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.defeat();
      return true;
    }
    this.state = "STAGGER";
    this.stateTimer = 0;
    // Pulse core on hit
    this.coreMesh.scale.setScalar(1.6);
    setTimeout(() => { this.coreMesh.scale.setScalar(1); }, 120);
    return false;
  }

  private defeat(): void {
    this.isDefeated = true;
    this.state = "DEFEATED";
    this.stateTimer = 0;
    this.isEligibleForReboot = true;
    this.markerRing.visible = true;
    this.rebootTimer = this.maxRebootTime;
    // Dim the emissive
    this.matEmissive.emissiveIntensity = 0.15;
    this.matEye.emissiveIntensity = 0.25;
    this.matWeapon.emissiveIntensity = 0.15;
    this.matBody.color.setHex(0x0a0808);
    this.matArmor.color.setHex(0x0c0808);
    // Health bar turns off
    this.matHealthFg.emissiveIntensity = 0;
  }

  /** Convert this robot to a friendly companion. */
  reboot(): void {
    this.faction = "companion";
    this.isDefeated = false;
    this.state = "CHASE";
    this.health = this.maxHealth;
    this.isEligibleForReboot = false;
    this.markerRing.visible = false;
    this.bodyGroup.rotation.x = 0;

    // Switch to cyan/violet color scheme
    this.matEmissive.emissive.setHex(COMPANION_EMISSIVE);
    this.matEmissive.emissiveIntensity = 2.4;
    this.matEye.emissive.setHex(COMPANION_EMISSIVE);
    this.matEye.emissiveIntensity = 4.5;
    this.matWeapon.emissive.setHex(0x8a5cff);
    this.matWeapon.emissiveIntensity = 2.8;
    this.matBody.color.setHex(0x080e1a);
    this.matArmor.color.setHex(0x0a1020);
    this.matHealthFg.color.setHex(0x00f0ff);
    this.matHealthFg.emissive.setHex(COMPANION_EMISSIVE);
    this.matHealthFg.emissiveIntensity = 1.2;
    this.markerMat.color.setHex(COMPANION_EMISSIVE);
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
'''

target = os.path.join('src', 'combat', 'RobotEntity.ts')
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Written {len(content)} bytes to {target}')
