import * as THREE from 'three';
import type { CheckpointDef, StageProgressSnapshot } from '../stages/StageTypes';
import type { StageContext } from '../stages/StageContext';
import { MECHANICS } from '../utils/Constants';
import { easeOutBack } from '../effects/Tween';

interface Checkpoint {
  id: string;
  position: THREE.Vector3;
  facing: THREE.Vector3 | null;
  group: THREE.Group;
  ring: THREE.Mesh;
  pillar: THREE.Mesh;
  beam: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  beamMaterial: THREE.MeshBasicMaterial;
}

export interface ActiveCheckpoint {
  id: string | null;
  index: number;
  position: THREE.Vector3;
  facing: THREE.Vector3;
  progress: StageProgressSnapshot | null;
}

/**
 * Checkpoint pads. Index -1 means "spawn". Activating a checkpoint moves the respawn point and
 * lights the pad up; respawning never restarts the stage.
 */
export class Checkpoints {
  private readonly pads: Checkpoint[] = [];
  private readonly group = new THREE.Group();
  private readonly ringGeometry = new THREE.TorusGeometry(1.1, 0.07, 10, 48);
  private readonly pillarGeometry = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 10);
  private readonly beamGeometry = new THREE.CylinderGeometry(0.12, 0.3, 6, 12, 1, true);
  private readonly baseGeometry = new THREE.CylinderGeometry(1.3, 1.45, 0.2, 32);
  private readonly materials: THREE.Material[] = [];
  activeIndex = -1;
  readonly spawnPoint = new THREE.Vector3();
  readonly spawnFacing = new THREE.Vector3(0, 0, 1);
  private activeId: string | null = null;
  private activeProgress: StageProgressSnapshot | null = null;
  private readonly scratch = new THREE.Vector3();

  constructor(private readonly ctx: StageContext, defs: CheckpointDef[] = [], spawn: THREE.Vector3, spawnFacing: THREE.Vector3) {
    this.group.name = 'checkpoints';
    ctx.world.root.add(this.group);
    this.spawnPoint.copy(spawn);
    this.spawnFacing.copy(spawnFacing);
    for (const def of defs) this.add(def);
  }

  private add(def: CheckpointDef): void {
    const group = new THREE.Group();
    const base = new THREE.Mesh(this.baseGeometry, this.ctx.materials.shellMid);
    base.position.y = 0.1;
    base.receiveShadow = true;
    const material = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      emissive: this.ctx.theme.accent,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const ring = new THREE.Mesh(this.ringGeometry, material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    const pillar = new THREE.Mesh(this.pillarGeometry, this.ctx.materials.trim);
    pillar.position.set(0, 0.9, -1.0);
    pillar.castShadow = true;
    const lamp = new THREE.Mesh(this.pillarGeometry, material);
    lamp.scale.set(0.5, 0.15, 0.5);
    lamp.position.set(0, 1.75, -1.0);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: this.ctx.theme.accent,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(this.beamGeometry, beamMaterial);
    beam.position.y = 3.2;
    this.materials.push(material, beamMaterial);
    group.add(base, ring, pillar, lamp, beam);
    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    this.group.add(group);
    const facing = def.facing ? new THREE.Vector3(...def.facing) : null;
    if (facing) {
      facing.y = 0;
      if (facing.lengthSq() < 0.01) facing.set(0, 0, 1);
      facing.normalize();
    }
    this.pads.push({ id: def.id ?? `checkpoint-${this.pads.length + 1}`, position: group.position.clone(), facing, group, ring, pillar, beam, material, beamMaterial });
  }

  check(playerCenter: THREE.Vector3, playerFacing: THREE.Vector3): void {
    for (let i = 0; i < this.pads.length; i += 1) {
      if (i <= this.activeIndex) continue;
      const pad = this.pads[i];
      // 3D distance so pads work under any gravity direction.
      if (playerCenter.distanceToSquared(pad.position) > MECHANICS.CHECKPOINT_RADIUS * MECHANICS.CHECKPOINT_RADIUS) continue;
      this.activate(i, playerFacing);
    }
  }

  private activate(index: number, playerFacing: THREE.Vector3): void {
    const pad = this.pads[index];
    this.activeIndex = index;
    this.activeId = pad.id;
    this.spawnPoint.copy(pad.position);
    this.spawnFacing.copy(pad.facing ?? playerFacing);
    this.spawnFacing.y = 0;
    if (this.spawnFacing.lengthSq() < 0.01) this.spawnFacing.set(0, 0, -1);
    this.spawnFacing.normalize();
    const progress = this.ctx.getProgressSnapshot?.() ?? null;
    this.activeProgress = progress ? {
      ...progress,
      completedSections: [...progress.completedSections],
      spawnedSections: [...progress.spawnedSections],
    } : null;
    pad.material.emissiveIntensity = 2.4;
    this.ctx.tweens.tween(0.5, (t) => {
      pad.ring.scale.setScalar(1 + 0.5 * (1 - t));
      pad.beamMaterial.opacity = 0.35 * t;
    }, easeOutBack);
    this.scratch.copy(pad.position).y += 0.4;
    this.ctx.particles.burst({
      position: this.scratch,
      count: 60,
      color: this.ctx.theme.accent,
      speed: 4,
      spread: 0.6,
      direction: new THREE.Vector3(0, 1.2, 0),
      life: 1.1,
      size: 0.18,
      gravity: -2,
    });
    this.ctx.bus.emit('checkpoint:activated', {
      id: pad.id,
      index,
      position: pad.position.clone(),
      facing: this.spawnFacing.clone(),
      progress: this.activeProgress,
    });
  }

  get activeCheckpoint(): ActiveCheckpoint {
    return {
      id: this.activeId,
      index: this.activeIndex,
      position: this.spawnPoint.clone(),
      facing: this.spawnFacing.clone(),
      progress: this.activeProgress ? {
        ...this.activeProgress,
        completedSections: [...this.activeProgress.completedSections],
        spawnedSections: [...this.activeProgress.spawnedSections],
      } : null,
    };
  }

  update(elapsed: number): void {
    for (let i = 0; i < this.pads.length; i += 1) {
      const pad = this.pads[i];
      const active = i <= this.activeIndex;
      pad.ring.rotation.z = elapsed * (active ? 0.6 : 0.15);
      if (active) {
        pad.material.emissiveIntensity = 2 + Math.sin(elapsed * 2.5 + i) * 0.4;
        pad.beam.rotation.y = elapsed * 0.5;
      }
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.ringGeometry.dispose();
    this.pillarGeometry.dispose();
    this.beamGeometry.dispose();
    this.baseGeometry.dispose();
    for (const material of this.materials) material.dispose();
    this.pads.length = 0;
  }
}
