import * as THREE from 'three';
import type { CharacterRig } from '../player/CharacterRig';

interface ArmorMotion {
  group: THREE.Group;
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  targetQuaternion: THREE.Quaternion;
  elapsed: number;
}

/**
 * NEXUS Full-Body Cyan Knight Armor System.
 * Faithfully recreates the visual reference:
 *  - Angular gunmetal & silver armor plating
 *  - Horizontal glowing cyan visor & helmet crest/ear fins
 *  - High-energy circular chest reactor with pulsating core
 *  - Multi-tiered aggressive shoulder pauldrons with cyan light under-glow
 *  - Armored gauntlets with protruding blade fins
 *  - Armored waist belt & hip tassets
 *  - Heavy thigh & knee armor with cyan light channels
 *  - Heavy armored greaves, calf thrusters & glowing sabaton boots
 *  - Tattered energy cape / split mantle hanging behind back
 *
 * Supports the 9-step awakening sequence and instant snap.
 */
export class ArmorSystem {
  // Groups grouped by awakening step
  private readonly helmetPieces: THREE.Group[] = [];
  private readonly chestPieces: THREE.Group[] = [];
  private readonly armPieces: THREE.Group[] = [];
  private readonly waistThighPieces: THREE.Group[] = [];
  private readonly shinBootPieces: THREE.Group[] = [];
  private readonly allPieces: THREE.Group[] = [];
  private readonly homeTransforms = new Map<THREE.Group, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  private readonly motions: ArmorMotion[] = [];

  private elapsedTime = 0;
  private isMaterialized = false;
  private currentStep = 0;

  readonly matDarkPlate: THREE.MeshStandardMaterial;
  readonly matSilverPlate: THREE.MeshStandardMaterial;
  readonly matCyanGlow: THREE.MeshStandardMaterial;
  readonly matVioletGlow: THREE.MeshStandardMaterial;
  readonly matReactorCore: THREE.MeshStandardMaterial;
  readonly matCape: THREE.MeshStandardMaterial;

  constructor(private readonly rig: CharacterRig) {
    this.matDarkPlate = new THREE.MeshStandardMaterial({
      color: 0x0e1420,
      metalness: 0.94,
      roughness: 0.18,
      envMapIntensity: 2.2,
    });

    this.matSilverPlate = new THREE.MeshStandardMaterial({
      color: 0xdde4f0,
      metalness: 0.96,
      roughness: 0.12,
      envMapIntensity: 2.4,
    });

    this.matCyanGlow = new THREE.MeshStandardMaterial({
      color: 0x001828,
      emissive: 0x00f0ff,
      emissiveIntensity: 0,
      metalness: 0.1,
      roughness: 0.15,
    });

    this.matVioletGlow = new THREE.MeshStandardMaterial({
      color: 0x100720,
      emissive: 0x8a5cff,
      emissiveIntensity: 0,
      metalness: 0.1,
      roughness: 0.18,
    });

    this.matReactorCore = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0,
      metalness: 0.1,
      roughness: 0.1,
    });

    this.matCape = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      emissive: 0x002244,
      emissiveIntensity: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.4,
    });

    this.buildArmor();
    this.hide();
  }

  private buildArmor(): void {
    const b = this.rig.bones;
    const s = this.rig.group.scale.x; // scale multiplier (~1.15)

    // =========================================================================
    // STEP 3: HELMET (Head bone)
    // =========================================================================
    this.addPiece(b.Head, this.helmetPieces, (g) => {
      g.position.set(0, 0.045 * s, 0);

      // Main cranial dome
      const dome = mk(new THREE.SphereGeometry(0.15 * s, 12, 10), this.matDarkPlate);
      dome.scale.set(0.95, 1.05, 1.08);
      g.add(dome);

      // Top Crest / Mohawk fin
      const crest = mk(new THREE.BoxGeometry(0.024 * s, 0.08 * s, 0.22 * s), this.matSilverPlate);
      crest.position.set(0, 0.14 * s, 0.01 * s);
      crest.rotation.x = -0.12;
      g.add(crest);

      const crestTip = mk(new THREE.BoxGeometry(0.012 * s, 0.03 * s, 0.18 * s), this.matCyanGlow);
      crestTip.position.set(0, 0.17 * s, 0.01 * s);
      g.add(crestTip);

      // Ear fins / antennae
      for (const sx of [-1, 1]) {
        const ear = mk(new THREE.BoxGeometry(0.025 * s, 0.13 * s, 0.06 * s), this.matSilverPlate);
        ear.position.set(sx * 0.145 * s, 0.03 * s, -0.01 * s);
        ear.rotation.z = -sx * 0.25;
        ear.rotation.y = sx * 0.1;
        g.add(ear);

        const earGlow = mk(new THREE.BoxGeometry(0.012 * s, 0.09 * s, 0.025 * s), this.matCyanGlow);
        earGlow.position.set(sx * 0.152 * s, 0.04 * s, 0);
        earGlow.rotation.z = -sx * 0.25;
        g.add(earGlow);

        // Jaw / cheek angular plates
        const cheek = mk(new THREE.BoxGeometry(0.035 * s, 0.08 * s, 0.09 * s), this.matDarkPlate);
        cheek.position.set(sx * 0.12 * s, -0.04 * s, 0.04 * s);
        cheek.rotation.y = sx * 0.35;
        g.add(cheek);
      }

      // Horizontal Cyan Visor - vivid glowing line across eyes
      const visor = mk(new THREE.BoxGeometry(0.18 * s, 0.028 * s, 0.035 * s), this.matCyanGlow);
      visor.position.set(0, 0.015 * s, 0.135 * s);
      g.add(visor);

      // Chin and mouthplate
      const chin = mk(new THREE.BoxGeometry(0.08 * s, 0.05 * s, 0.06 * s), this.matSilverPlate);
      chin.position.set(0, -0.07 * s, 0.1 * s);
      g.add(chin);
    });

    // =========================================================================
    // STEP 4: CHEST & GLOWING CIRCULAR REACTOR (Chest bone)
    // =========================================================================
    this.addPiece(b.Chest, this.chestPieces, (g) => {
      g.position.set(0, 0.02 * s, 0.04 * s);

      // Main angular breastplate
      const mainPlate = mk(new THREE.BoxGeometry(0.33 * s, 0.29 * s, 0.1 * s), this.matDarkPlate);
      g.add(mainPlate);

      // Beveled silver collar & pectoral wings
      for (const sx of [-1, 1]) {
        const wing = mk(new THREE.BoxGeometry(0.12 * s, 0.16 * s, 0.035 * s), this.matSilverPlate);
        wing.position.set(sx * 0.11 * s, 0.06 * s, 0.055 * s);
        wing.rotation.z = -sx * 0.15;
        g.add(wing);

        // Rib glowing conduits
        const ribGlow = mk(new THREE.BoxGeometry(0.018 * s, 0.14 * s, 0.02 * s), this.matCyanGlow);
        ribGlow.position.set(sx * 0.14 * s, -0.05 * s, 0.055 * s);
        ribGlow.rotation.z = sx * 0.22;
        g.add(ribGlow);
      }

      // Center Circular Reactor Housing
      const reactorRing = mk(new THREE.CylinderGeometry(0.075 * s, 0.075 * s, 0.028 * s, 16), this.matSilverPlate);
      reactorRing.rotation.x = Math.PI / 2;
      reactorRing.position.set(0, 0.045 * s, 0.065 * s);
      g.add(reactorRing);

      // Inner glowing ring
      const innerRing = mk(new THREE.CylinderGeometry(0.062 * s, 0.062 * s, 0.03 * s, 16), this.matCyanGlow);
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.set(0, 0.045 * s, 0.066 * s);
      g.add(innerRing);

      // Core pulsating emitter
      const core = mk(new THREE.CylinderGeometry(0.042 * s, 0.042 * s, 0.034 * s, 16), this.matReactorCore);
      core.rotation.x = Math.PI / 2;
      core.position.set(0, 0.045 * s, 0.068 * s);
      g.add(core);

      // Lower abdominal plating
      const abPlate = mk(new THREE.BoxGeometry(0.24 * s, 0.07 * s, 0.03 * s), this.matDarkPlate);
      abPlate.position.set(0, -0.11 * s, 0.05 * s);
      g.add(abPlate);

      const abTrim = mk(new THREE.BoxGeometry(0.18 * s, 0.015 * s, 0.02 * s), this.matVioletGlow);
      abTrim.position.set(0, -0.11 * s, 0.065 * s);
      g.add(abTrim);
    });

    // =========================================================================
    // STEP 5: SHOULDERS & ARMS (Shoulders, UpperArms, Forearms, Hands)
    // =========================================================================
    // Multi-tiered angular shoulder pauldrons
    for (const [bone, sx] of [[b.Shoulder_L, -1], [b.Shoulder_R, 1]] as [THREE.Bone, number][]) {
      this.addPiece(bone, this.armPieces, (g) => {
        g.position.set(sx * 0.06 * s, 0.03 * s, 0);

        // Top main pointed pauldron (Dark)
        const topPlate = mk(new THREE.BoxGeometry(0.16 * s, 0.05 * s, 0.16 * s), this.matDarkPlate);
        topPlate.rotation.z = sx * 0.45;
        topPlate.position.set(sx * 0.03 * s, 0.05 * s, 0);
        g.add(topPlate);

        // Layer 2 flared silver wing
        const midPlate = mk(new THREE.BoxGeometry(0.18 * s, 0.03 * s, 0.14 * s), this.matSilverPlate);
        midPlate.rotation.z = sx * 0.52;
        midPlate.position.set(sx * 0.05 * s, 0.02 * s, 0);
        g.add(midPlate);

        // Cyan light layer beneath pauldrons
        const underGlow = mk(new THREE.BoxGeometry(0.15 * s, 0.015 * s, 0.12 * s), this.matCyanGlow);
        underGlow.rotation.z = sx * 0.52;
        underGlow.position.set(sx * 0.055 * s, 0.005 * s, 0);
        g.add(underGlow);

        // Lower pauldron tier
        const lowerPlate = mk(new THREE.BoxGeometry(0.13 * s, 0.035 * s, 0.12 * s), this.matDarkPlate);
        lowerPlate.rotation.z = sx * 0.58;
        lowerPlate.position.set(sx * 0.07 * s, -0.025 * s, 0);
        g.add(lowerPlate);
      });
    }

    // Upper arms (bicep guards)
    for (const [bone, sx] of [[b.UpperArm_L, -1], [b.UpperArm_R, 1]] as [THREE.Bone, number][]) {
      this.addPiece(bone, this.armPieces, (g) => {
        g.position.set(0, -0.08 * s, 0);
        const bicep = mk(new THREE.CylinderGeometry(0.075 * s, 0.065 * s, 0.18 * s, 8), this.matDarkPlate);
        g.add(bicep);

        // Outer silver plate
        const plate = mk(new THREE.BoxGeometry(0.04 * s, 0.14 * s, 0.03 * s), this.matSilverPlate);
        plate.position.set(sx * 0.065 * s, 0, 0);
        g.add(plate);

        // Vertical cyan channel
        const glow = mk(new THREE.BoxGeometry(0.012 * s, 0.12 * s, 0.02 * s), this.matCyanGlow);
        glow.position.set(sx * 0.075 * s, 0, 0);
        g.add(glow);
      });
    }

    // Forearm gauntlets with outer blade fins
    for (const [bone, sx] of [[b.Forearm_L, -1], [b.Forearm_R, 1]] as [THREE.Bone, number][]) {
      this.addPiece(bone, this.armPieces, (g) => {
        g.position.set(0, -0.09 * s, 0);
        const bracer = mk(new THREE.CylinderGeometry(0.068 * s, 0.055 * s, 0.2 * s, 8), this.matDarkPlate);
        g.add(bracer);

        // Silver dorsal forearm plate
        const dorsal = mk(new THREE.BoxGeometry(0.065 * s, 0.16 * s, 0.035 * s), this.matSilverPlate);
        dorsal.position.set(0, 0, 0.05 * s);
        g.add(dorsal);

        // Outward projecting angular blade fin (visible in reference image!)
        const fin = mk(new THREE.BoxGeometry(0.02 * s, 0.18 * s, 0.08 * s), this.matDarkPlate);
        fin.position.set(sx * 0.065 * s, 0, -0.01 * s);
        fin.rotation.y = sx * 0.2;
        g.add(fin);

        const finGlow = mk(new THREE.BoxGeometry(0.01 * s, 0.15 * s, 0.02 * s), this.matCyanGlow);
        finGlow.position.set(sx * 0.075 * s, 0, -0.01 * s);
        g.add(finGlow);
      });
    }

    // Hands & Knuckles
    for (const bone of [b.Hand_L, b.Hand_R]) {
      this.addPiece(bone, this.armPieces, (g) => {
        g.position.set(0, -0.025 * s, 0.02 * s);
        const back = mk(new THREE.BoxGeometry(0.095 * s, 0.065 * s, 0.065 * s), this.matDarkPlate);
        g.add(back);

        const knuckle = mk(new THREE.BoxGeometry(0.088 * s, 0.02 * s, 0.04 * s), this.matSilverPlate);
        knuckle.position.set(0, 0.035 * s, 0.01 * s);
        g.add(knuckle);

        const glow = mk(new THREE.BoxGeometry(0.065 * s, 0.01 * s, 0.02 * s), this.matCyanGlow);
        glow.position.set(0, 0.038 * s, 0.015 * s);
        g.add(glow);
      });
    }

    // =========================================================================
    // STEP 6: WAIST, HIPS, THIGHS & KNEES (Hips, Thighs, Shins top)
    // =========================================================================
    // Armored waist belt & hip tassets
    this.addPiece(b.Hips, this.waistThighPieces, (g) => {
      g.position.set(0, 0.04 * s, 0.015 * s);

      // Belt ring
      const belt = mk(new THREE.CylinderGeometry(0.185 * s, 0.17 * s, 0.075 * s, 12), this.matDarkPlate);
      g.add(belt);

      // Glowing central buckle
      const buckle = mk(new THREE.BoxGeometry(0.075 * s, 0.055 * s, 0.04 * s), this.matSilverPlate);
      buckle.position.set(0, 0, 0.16 * s);
      g.add(buckle);

      const buckleGlow = mk(new THREE.BoxGeometry(0.05 * s, 0.025 * s, 0.02 * s), this.matCyanGlow);
      buckleGlow.position.set(0, 0, 0.18 * s);
      g.add(buckleGlow);

      // Flared Hip Tassets (skirt plates on sides)
      for (const sx of [-1, 1]) {
        const tasset = mk(new THREE.BoxGeometry(0.05 * s, 0.15 * s, 0.12 * s), this.matDarkPlate);
        tasset.position.set(sx * 0.17 * s, -0.06 * s, 0);
        tasset.rotation.z = -sx * 0.25;
        g.add(tasset);

        const tassetSilver = mk(new THREE.BoxGeometry(0.03 * s, 0.12 * s, 0.09 * s), this.matSilverPlate);
        tassetSilver.position.set(sx * 0.185 * s, -0.06 * s, 0);
        tassetSilver.rotation.z = -sx * 0.25;
        g.add(tassetSilver);

        const tassetTrim = mk(new THREE.BoxGeometry(0.015 * s, 0.13 * s, 0.02 * s), this.matCyanGlow);
        tassetTrim.position.set(sx * 0.19 * s, -0.06 * s, 0.04 * s);
        tassetTrim.rotation.z = -sx * 0.25;
        g.add(tassetTrim);
      }
    });

    // Thighs
    for (const bone of [b.Thigh_L, b.Thigh_R]) {
      this.addPiece(bone, this.waistThighPieces, (g) => {
        g.position.set(0, -0.11 * s, 0.02 * s);

        const thigh = mk(new THREE.CylinderGeometry(0.1 * s, 0.082 * s, 0.25 * s, 8), this.matDarkPlate);
        g.add(thigh);

        // Front silver quadriceps plate
        const plate = mk(new THREE.BoxGeometry(0.1 * s, 0.22 * s, 0.04 * s), this.matSilverPlate);
        plate.position.set(0, 0, 0.08 * s);
        g.add(plate);

        // Dual vertical glowing cyan conduits
        for (const cx of [-0.032, 0.032]) {
          const glow = mk(new THREE.BoxGeometry(0.014 * s, 0.18 * s, 0.02 * s), this.matCyanGlow);
          glow.position.set(cx * s, 0, 0.1 * s);
          g.add(glow);
        }
      });
    }

    // Knees (anchored to top of Shin bones)
    for (const [bone, sx] of [[b.Shin_L, -1], [b.Shin_R, 1]] as [THREE.Bone, number][]) {
      this.addPiece(bone, this.waistThighPieces, (g) => {
        g.position.set(0, 0.045 * s, 0.045 * s);

        // Knee cop
        const knee = mk(new THREE.BoxGeometry(0.095 * s, 0.08 * s, 0.075 * s), this.matSilverPlate);
        g.add(knee);

        // Horizontal cyan glow slot
        const glow = mk(new THREE.BoxGeometry(0.075 * s, 0.025 * s, 0.025 * s), this.matCyanGlow);
        glow.position.set(0, 0, 0.04 * s);
        g.add(glow);

        // Side pivot ring
        const pivot = mk(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.02 * s, 10), this.matCyanGlow);
        pivot.rotation.z = Math.PI / 2;
        pivot.position.set(sx * 0.055 * s, 0, 0);
        g.add(pivot);
      });
    }

    // =========================================================================
    // STEP 7: SHINS, BOOTS & TATTERED CAPE (Shin, Foot bones, and Spine)
    // =========================================================================
    // Shins / Greaves
    for (const bone of [b.Shin_L, b.Shin_R]) {
      this.addPiece(bone, this.shinBootPieces, (g) => {
        g.position.set(0, -0.11 * s, 0.03 * s);

        // Greave casing
        const greave = mk(new THREE.BoxGeometry(0.088 * s, 0.23 * s, 0.08 * s), this.matDarkPlate);
        g.add(greave);

        // Silver anterior shin ridge
        const ridge = mk(new THREE.BoxGeometry(0.05 * s, 0.21 * s, 0.035 * s), this.matSilverPlate);
        ridge.position.set(0, 0, 0.048 * s);
        g.add(ridge);

        // Vertical cyan glow stripe
        const glow = mk(new THREE.BoxGeometry(0.015 * s, 0.17 * s, 0.02 * s), this.matCyanGlow);
        glow.position.set(0, 0, 0.065 * s);
        g.add(glow);

        // Rear calf thruster plate
        const calf = mk(new THREE.BoxGeometry(0.065 * s, 0.18 * s, 0.04 * s), this.matDarkPlate);
        calf.position.set(0, 0, -0.06 * s);
        g.add(calf);
      });
    }

    // Heavy Sabaton Armored Boots
    for (const [bone, sx] of [[b.Foot_L, -1], [b.Foot_R, 1]] as [THREE.Bone, number][]) {
      this.addPiece(bone, this.shinBootPieces, (g) => {
        g.position.set(0, -0.028 * s, 0.04 * s);

        // Main boot shell
        const boot = mk(new THREE.BoxGeometry(0.125 * s, 0.09 * s, 0.21 * s), this.matDarkPlate);
        g.add(boot);

        // Silver toe cap
        const toe = mk(new THREE.BoxGeometry(0.12 * s, 0.075 * s, 0.07 * s), this.matSilverPlate);
        toe.position.set(0, -0.01 * s, 0.08 * s);
        g.add(toe);

        // Glowing cyan sole rim
        const sole = mk(new THREE.BoxGeometry(0.13 * s, 0.022 * s, 0.22 * s), this.matCyanGlow);
        sole.position.set(0, -0.055 * s, 0);
        g.add(sole);

        // Glowing ankle thruster vent
        const vent = mk(new THREE.BoxGeometry(0.025 * s, 0.035 * s, 0.05 * s), this.matCyanGlow);
        vent.position.set(sx * 0.065 * s, 0.01 * s, -0.04 * s);
        g.add(vent);
      });
    }

    // Tattered Segmented Cape (Attached to Chest/Upper Back)
    this.addPiece(b.Chest, this.shinBootPieces, (g) => {
      g.position.set(0, 0.08 * s, -0.09 * s);

      // Create segmented cape panels with jagged hem (split into 4 panels)
      const capeSegments = 4;
      const totalWidth = 0.44 * s;
      const capeLength = 0.82 * s;
      const segWidth = totalWidth / capeSegments;

      for (let i = 0; i < capeSegments; i++) {
        const offset = (i - (capeSegments - 1) / 2) * segWidth;
        const panelGeo = new THREE.PlaneGeometry(segWidth * 0.92, capeLength);
        const panel = new THREE.Mesh(panelGeo, this.matCape);
        panel.position.set(offset, -capeLength * 0.48, 0);
        panel.rotation.x = 0.15 + (Math.abs(offset) * 0.3); // drape back slightly
        panel.rotation.y = (offset / totalWidth) * 0.25;
        g.add(panel);

        // Glowing cyan bottom trim
        const trimGeo = new THREE.BoxGeometry(segWidth * 0.92, 0.025 * s, 0.01 * s);
        const trim = mk(trimGeo, this.matCyanGlow);
        trim.position.set(offset, -capeLength * 0.96, 0.01 * s);
        trim.rotation.x = panel.rotation.x;
        trim.rotation.y = panel.rotation.y;
        g.add(trim);
      }
    });
  }

  private addPiece(bone: THREE.Bone, list: THREE.Group[], build: (g: THREE.Group) => void): void {
    const g = new THREE.Group();
    build(g);
    bone.add(g);
    list.push(g);
    this.allPieces.push(g);
    this.homeTransforms.set(g, { position: g.position.clone(), quaternion: g.quaternion.clone() });
  }

  private revealPieces(pieces: THREE.Group[], reveal: boolean, x: number, y: number, z: number): void {
    if (!reveal) return;
    for (const [index, piece] of pieces.entries()) {
      if (piece.visible) continue;
      const home = this.homeTransforms.get(piece);
      if (!home) continue;

      piece.visible = true;
      const side = index % 2 === 0 ? -1 : 1;
      piece.position.copy(home.position).add(new THREE.Vector3(x * side, y, z));
      this.motions.push({
        group: piece,
        startPosition: piece.position.clone(),
        targetPosition: home.position.clone(),
        startQuaternion: piece.quaternion.clone(),
        targetQuaternion: home.quaternion.clone(),
        elapsed: 0,
      });
    }
  }

  setStep(step: number): void {
    this.currentStep = step;
    const s = step;

    this.revealPieces(this.helmetPieces, s >= 3, 0, 0.58, -0.18);
    this.revealPieces(this.chestPieces, s >= 4, 0, 0.12, 0.62);
    this.revealPieces(this.armPieces, s >= 5, 0.48, 0.12, -0.12);
    this.revealPieces(this.waistThighPieces, s >= 6, 0, 0.46, -0.1);
    this.revealPieces(this.shinBootPieces, s >= 7, 0, -0.5, -0.08);

    // Emissive levels ramp up with suit assembly
    const progress = Math.max(0, Math.min(1, (s - 2) / 6));
    this.matCyanGlow.emissiveIntensity = progress * 1.8;
    this.matVioletGlow.emissiveIntensity = progress * 1.4;
    this.matReactorCore.emissiveIntensity = s >= 4 ? 2.4 : 0;

    if (s >= 9) {
      this.isMaterialized = true;
    }
  }

  snapVisible(): void {
    this.motions.length = 0;
    for (const p of this.allPieces) {
      p.visible = true;
      const home = this.homeTransforms.get(p);
      if (home) {
        p.position.copy(home.position);
        p.quaternion.copy(home.quaternion);
      }
    }
    this.currentStep = 9;
    this.isMaterialized = true;
    this.matCyanGlow.emissiveIntensity = 1.8;
    this.matVioletGlow.emissiveIntensity = 1.4;
    this.matReactorCore.emissiveIntensity = 2.4;
  }

  hide(): void {
    this.motions.length = 0;
    for (const p of this.allPieces) {
      p.visible = false;
      const home = this.homeTransforms.get(p);
      if (home) {
        p.position.copy(home.position);
        p.quaternion.copy(home.quaternion);
      }
    }
    this.currentStep = 0;
    this.isMaterialized = false;
    this.matCyanGlow.emissiveIntensity = 0;
    this.matVioletGlow.emissiveIntensity = 0;
    this.matReactorCore.emissiveIntensity = 0;
  }

  get isFullyMaterialized(): boolean {
    return this.isMaterialized;
  }

  update(delta: number): void {
    this.elapsedTime += delta;
    const t = this.elapsedTime;

    for (let i = this.motions.length - 1; i >= 0; i -= 1) {
      const motion = this.motions[i];
      motion.elapsed = Math.min(0.62, motion.elapsed + delta);
      const progress = motion.elapsed / 0.62;
      const eased = 1 - Math.pow(1 - progress, 3);
      motion.group.position.lerpVectors(motion.startPosition, motion.targetPosition, eased);
      motion.group.quaternion.slerpQuaternions(motion.startQuaternion, motion.targetQuaternion, eased);
      if (progress >= 1) this.motions.splice(i, 1);
    }

    if (this.isMaterialized || this.currentStep >= 4) {
      // Reactor and suit breathing glow — balanced, controlled, non-destructive
      const pulse = Math.sin(t * 3.0) * 0.15 + Math.sin(t * 1.4) * 0.08;
      const baseCyan = this.isMaterialized ? 1.8 : 1.2;
      this.matCyanGlow.emissiveIntensity = baseCyan + pulse;
      this.matVioletGlow.emissiveIntensity = 1.4 + pulse * 0.4;
      this.matReactorCore.emissiveIntensity = (this.isMaterialized ? 2.4 : 1.6) + pulse * 0.6;
    }
  }

  dispose(): void {
    for (const p of this.allPieces) p.removeFromParent();
    this.matDarkPlate.dispose();
    this.matSilverPlate.dispose();
    this.matCyanGlow.dispose();
    this.matVioletGlow.dispose();
    this.matReactorCore.dispose();
    this.matCape.dispose();
  }
}

function mk(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = false;
  m.frustumCulled = false;
  return m;
}
