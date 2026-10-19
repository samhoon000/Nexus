import * as THREE from 'three';
import type { CharacterRig } from '../player/CharacterRig';

/**
 * NEXUS Cyan Knight Oversized Energy Broadsword.
 * Matches the reference image:
 *  - Massive futuristic broad blade with dark titanium central spine
 *  - Dual bright cyan cutting edges converging to an angular tip
 *  - Circular glowing cyan power core emitter embedded in the crossguard
 *  - Ergonomic heavy hilt and glowing cyan pommel
 *  - Sweeping motion trail and dynamic attack swings
 */
export class EnergySword {
  readonly group = new THREE.Group();
  private readonly bladeGroup = new THREE.Group();
  private readonly trailParticles: THREE.Points;
  private readonly trailPositions: Float32Array;
  private readonly trailOpacities: Float32Array;
  private readonly trailColors: Float32Array;
  private trailHead = 0;
  private readonly TRAIL_COUNT = 24;

  private elapsedTime = 0;
  private materializeProgress = 0;
  private isMaterialized = false;
  private isSwinging = false;
  private swingTimer = 0;
  private _matDuration = 1.5;
  private _matStartTime = -1;

  readonly matHilt: THREE.MeshStandardMaterial;
  readonly matSpine: THREE.MeshStandardMaterial;
  readonly matSilverEdge: THREE.MeshStandardMaterial;
  readonly matCyanEdge: THREE.MeshStandardMaterial;
  readonly matCoreEmitter: THREE.MeshStandardMaterial;

  constructor(rig: CharacterRig) {
    this.matHilt = new THREE.MeshStandardMaterial({
      color: 0x0e1422,
      metalness: 0.88,
      roughness: 0.25,
    });

    this.matSpine = new THREE.MeshStandardMaterial({
      color: 0x141b2a,
      metalness: 0.94,
      roughness: 0.2,
      envMapIntensity: 2.2,
    });

    this.matSilverEdge = new THREE.MeshStandardMaterial({
      color: 0xe0e8f2,
      metalness: 0.95,
      roughness: 0.15,
      envMapIntensity: 2.5,
    });

    this.matCyanEdge = new THREE.MeshStandardMaterial({
      color: 0x001a24,
      emissive: 0x00f0ff,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0,
      metalness: 0.05,
      roughness: 0.1,
    });

    this.matCoreEmitter = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0,
      metalness: 0.1,
      roughness: 0.1,
    });

    const s = rig.group.scale.x; // scale multiplier
    const g = this.group;

    // --- Hilt & Handle ---
    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024 * s, 0.022 * s, 0.24 * s, 8),
      this.matHilt,
    );
    g.add(hilt);

    // Grip rings
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.027 * s, 0.027 * s, 0.016 * s, 8),
        this.matSilverEdge,
      );
      ring.position.y = (-0.08 + i * 0.04) * s;
      g.add(ring);
    }

    // Pommel
    const pommel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035 * s, 0.026 * s, 0.045 * s, 8),
      this.matSpine,
    );
    pommel.position.y = -0.13 * s;
    g.add(pommel);

    const pommelGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028 * s, 0.028 * s, 0.015 * s, 8),
      this.matCyanEdge,
    );
    pommelGlow.position.y = -0.155 * s;
    g.add(pommelGlow);

    // --- Crossguard with Circular Reactor Emitter ---
    const guardWidth = 0.22 * s;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(guardWidth, 0.045 * s, 0.065 * s),
      this.matSpine,
    );
    guard.position.y = 0.135 * s;
    g.add(guard);

    // Guard side angled quillons
    for (const sx of [-1, 1]) {
      const quillon = new THREE.Mesh(
        new THREE.BoxGeometry(0.04 * s, 0.07 * s, 0.05 * s),
        this.matSilverEdge,
      );
      quillon.position.set(sx * 0.12 * s, 0.15 * s, 0);
      quillon.rotation.z = -sx * 0.35;
      g.add(quillon);

      const qGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.015 * s, 0.05 * s, 0.02 * s),
        this.matCyanEdge,
      );
      qGlow.position.set(sx * 0.135 * s, 0.155 * s, 0);
      qGlow.rotation.z = -sx * 0.35;
      g.add(qGlow);
    }

    // Circular Guard Reactor Core Emitter (matches the reference artwork)
    const reactorRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048 * s, 0.048 * s, 0.075 * s, 16),
      this.matSilverEdge,
    );
    reactorRing.rotation.x = Math.PI / 2;
    reactorRing.position.y = 0.135 * s;
    g.add(reactorRing);

    const reactorCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034 * s, 0.034 * s, 0.08 * s, 16),
      this.matCoreEmitter,
    );
    reactorCore.rotation.x = Math.PI / 2;
    reactorCore.position.y = 0.135 * s;
    g.add(reactorCore);

    // --- Oversized Broad Blade ---
    const bladeY = 0.15 * s;
    this.bladeGroup.position.y = bladeY;
    g.add(this.bladeGroup);

    // Dark Titanium Center Spine — wider and longer
    const spineGeo = new THREE.BoxGeometry(0.085 * s, 1.05 * s, 0.042 * s);
    const spine = new THREE.Mesh(spineGeo, this.matSpine);
    spine.position.y = 0.52 * s;
    this.bladeGroup.add(spine);

    // Silver beveled inner facet
    const bevelGeo = new THREE.BoxGeometry(0.112 * s, 1.0 * s, 0.032 * s);
    const bevel = new THREE.Mesh(bevelGeo, this.matSilverEdge);
    bevel.position.y = 0.52 * s;
    this.bladeGroup.add(bevel);

    // Glowing Neon Cyan Cutting Edges (both left and right sides)
    for (const sx of [-1, 1]) {
      const edgeGeo = new THREE.BoxGeometry(0.038 * s, 1.0 * s, 0.022 * s);
      const edge = new THREE.Mesh(edgeGeo, this.matCyanEdge);
      edge.position.set(sx * 0.068 * s, 0.52 * s, 0);
      this.bladeGroup.add(edge);
    }

    // Angular Spear/Chisel Tip
    const tipSpine = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 * s, 0.22 * s, 4),
      this.matSpine,
    );
    tipSpine.position.y = (1.05 + 0.11) * s;
    tipSpine.rotation.y = Math.PI / 4;
    this.bladeGroup.add(tipSpine);

    const tipCyan = new THREE.Mesh(
      new THREE.ConeGeometry(0.085 * s, 0.225 * s, 4),
      this.matCyanEdge,
    );
    tipCyan.position.y = (1.05 + 0.11) * s;
    tipCyan.rotation.y = Math.PI / 4;
    this.bladeGroup.add(tipCyan);

    // --- Trail Particle System ---
    this.trailPositions = new Float32Array(this.TRAIL_COUNT * 3);
    this.trailOpacities = new Float32Array(this.TRAIL_COUNT);
    this.trailColors = new Float32Array(this.TRAIL_COUNT * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    trailGeo.setAttribute('opacity', new THREE.BufferAttribute(this.trailOpacities, 1));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

    const trailMat = new THREE.PointsMaterial({
      size: 0.08 * s,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.trailParticles = new THREE.Points(trailGeo, trailMat);
    g.add(this.trailParticles);

    // Mount to Hero's Right Hand
    g.rotation.set(Math.PI / 2.2, 0, -0.15);
    g.position.set(0.02 * s, 0.04 * s, 0.14 * s);
    rig.bones.Hand_R.add(g);

    this.hide();
  }

  materialize(duration = 1.5): void {
    this.group.visible = true;
    this.isMaterialized = false;
    this.materializeProgress = 0;
    this.matCyanEdge.opacity = 0;
    this.matCyanEdge.emissiveIntensity = 0;
    this.matCoreEmitter.emissiveIntensity = 0;
    this._matDuration = duration;
    this._matStartTime = this.elapsedTime;
  }

  get isFullyMaterialized(): boolean {
    return this.isMaterialized;
  }

  startSwing(): void {
    this.isSwinging = true;
    this.swingTimer = 0;
  }

  get inHitWindow(): boolean {
    return this.isSwinging && this.swingTimer >= 0.08 && this.swingTimer <= 0.38;
  }

  getBladeTipWorld(out: THREE.Vector3): THREE.Vector3 {
    this.bladeGroup.getWorldPosition(out);
    const s = this.group.scale.x || 1;
    out.y += 0.95 * s;
    return out;
  }

  update(delta: number): void {
    this.elapsedTime += delta;
    const t = this.elapsedTime;

    // Materialization ramp
    if (!this.isMaterialized && this._matStartTime >= 0) {
      const elapsed = t - this._matStartTime;
      this.materializeProgress = Math.min(1, elapsed / this._matDuration);
      const p = this.materializeProgress;
      this.matCyanEdge.opacity = p * 0.95;
      this.matCyanEdge.emissiveIntensity = p * 2.0;
      this.matCoreEmitter.emissiveIntensity = p * 2.5;
      if (p >= 1) this.isMaterialized = true;
    } else if (this.isMaterialized) {
      // Idle breathing pulse — sharp, luminous, controlled
      const b = Math.sin(t * 3.8) * 0.2;
      this.matCyanEdge.opacity = 0.95;
      this.matCyanEdge.emissiveIntensity = 2.0 + b;
      this.matCoreEmitter.emissiveIntensity = 2.5 + b * 0.5;
    }

    // Attack Swing Animation
    if (this.isSwinging) {
      this.swingTimer += delta;
      const progress = Math.min(1, this.swingTimer / 0.42);
      const arcAngle = Math.sin(progress * Math.PI) * 1.35;
      this.group.rotation.x = Math.PI / 2.2 + arcAngle;
      this.group.rotation.z = -0.15 - Math.sin(progress * Math.PI) * 0.6;

      if (this.inHitWindow) {
        this.emitTrailParticle();
      }

      if (this.swingTimer >= 0.42) {
        this.isSwinging = false;
        this.group.rotation.set(Math.PI / 2.2, 0, -0.15);
      }
    }

    // Fade trail particles
    for (let i = 0; i < this.TRAIL_COUNT; i++) {
      if (this.trailOpacities[i] > 0) {
        this.trailOpacities[i] = Math.max(0, this.trailOpacities[i] - delta * 3.0);
      }
    }
    (this.trailParticles.geometry.attributes.opacity as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitTrailParticle(): void {
    const tipPos = new THREE.Vector3();
    this.getBladeTipWorld(tipPos);
    this.trailParticles.worldToLocal(tipPos);

    const i = this.trailHead % this.TRAIL_COUNT;
    this.trailPositions[i * 3] = tipPos.x;
    this.trailPositions[i * 3 + 1] = tipPos.y;
    this.trailPositions[i * 3 + 2] = tipPos.z;
    this.trailOpacities[i] = 0.9;
    this.trailColors[i * 3] = 0.0;
    this.trailColors[i * 3 + 1] = 0.94;
    this.trailColors[i * 3 + 2] = 1.0;
    this.trailHead++;

    (this.trailParticles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.trailParticles.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  snapVisible(): void {
    this.group.visible = true;
    this.isMaterialized = true;
    this.materializeProgress = 1;
    this._matStartTime = this.elapsedTime;
    this.matCyanEdge.opacity = 0.95;
    this.matCyanEdge.emissiveIntensity = 2.0;
    this.matCoreEmitter.emissiveIntensity = 2.5;
  }

  hide(): void {
    this.group.visible = false;
    this.materializeProgress = 0;
    this.isMaterialized = false;
    this._matStartTime = -1;
    this.matCyanEdge.opacity = 0;
    this.matCyanEdge.emissiveIntensity = 0;
    this.matCoreEmitter.emissiveIntensity = 0;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.matHilt.dispose();
    this.matSpine.dispose();
    this.matSilverEdge.dispose();
    this.matCyanEdge.dispose();
    this.matCoreEmitter.dispose();
    this.trailParticles.geometry.dispose();
    (this.trailParticles.material as THREE.Material).dispose();
  }
}
