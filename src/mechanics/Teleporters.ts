import * as THREE from 'three';
import type { TeleporterDef } from '../stages/StageTypes';
import type { StageContext } from '../stages/StageContext';
import { MECHANICS, PLAYER_CENTER_HEIGHT } from '../utils/Constants';
import { degToRad } from '../utils/MathUtils';

interface Teleporter {
  def: TeleporterDef;
  position: THREE.Vector3;
  group: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
}

export interface TeleportResult {
  position: THREE.Vector3;
  facing: THREE.Vector3;
  from: THREE.Vector3;
}

/**
 * Paired teleport pads. Entering one moves the player to its partner with a cooldown so the
 * arrival pad does not immediately send them back.
 */
export class Teleporters {
  private readonly pads: Teleporter[] = [];
  private readonly group = new THREE.Group();
  private cooldown = 0;
  private armed = true;
  private readonly ringGeometry = new THREE.TorusGeometry(1, 0.08, 10, 48);
  private readonly beamGeometry = new THREE.CylinderGeometry(0.75, 0.9, 3.2, 24, 1, true);
  private readonly baseGeometry = new THREE.CylinderGeometry(1.15, 1.3, 0.25, 24);
  private readonly materials: THREE.Material[] = [];
  private readonly result: TeleportResult = {
    position: new THREE.Vector3(),
    facing: new THREE.Vector3(0, 0, 1),
    from: new THREE.Vector3(),
  };

  constructor(private readonly ctx: StageContext, defs: TeleporterDef[] = []) {
    this.group.name = 'teleporters';
    ctx.world.root.add(this.group);
    for (const def of defs) this.add(def);
  }

  private add(def: TeleporterDef): void {
    const color = def.color ?? this.ctx.theme.accent;
    const group = new THREE.Group();
    const base = new THREE.Mesh(this.baseGeometry, this.ctx.materials.shellMid);
    base.position.y = 0.12;
    base.receiveShadow = true;
    group.add(base);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      emissive: color,
      emissiveIntensity: 2.2,
      roughness: 0.4,
    });
    const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    group.add(ring);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(this.beamGeometry, beamMaterial);
    beam.position.y = 1.85;
    group.add(beam);
    this.materials.push(ringMaterial, beamMaterial);
    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    this.group.add(group);
    this.pads.push({ def, position: group.position.clone(), group, ring, beam });
  }

  /** Returns a teleport result when the player entered a pad, otherwise null. */
  check(playerCenter: THREE.Vector3, up: THREE.Vector3): TeleportResult | null {
    if (this.cooldown > 0) return null;
    // Re-arm only once the player has stepped off every pad, so arrival never bounces back.
    let onAnyPad = false;
    for (const pad of this.pads) {
      if (playerCenter.distanceToSquared(pad.position) <= MECHANICS.TELEPORT_RADIUS * MECHANICS.TELEPORT_RADIUS) onAnyPad = true;
    }
    if (!this.armed) {
      if (!onAnyPad) this.armed = true;
      return null;
    }
    for (const pad of this.pads) {
      if (playerCenter.distanceToSquared(pad.position) > MECHANICS.TELEPORT_RADIUS * MECHANICS.TELEPORT_RADIUS) continue;
      const target = this.pads.find((p) => p.def.id === pad.def.to);
      if (!target) continue;
      this.cooldown = MECHANICS.TELEPORT_COOLDOWN;
      this.armed = false;
      this.result.from.copy(pad.position);
      this.result.position.copy(target.position).addScaledVector(up, PLAYER_CENTER_HEIGHT + 0.05);
      const yaw = degToRad(target.def.exitYaw ?? 0);
      this.result.facing.set(Math.sin(yaw), 0, Math.cos(yaw));
      return this.result;
    }
    return null;
  }

  update(dt: number, elapsed: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = 0; i < this.pads.length; i += 1) {
      const pad = this.pads[i];
      pad.ring.rotation.z = elapsed * 0.8 + i;
      pad.ring.position.y = 0.28 + Math.sin(elapsed * 2 + i) * 0.06;
      (pad.beam.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.06 * Math.sin(elapsed * 3 + i * 2);
      pad.beam.rotation.y = elapsed * 0.4;
    }
  }

  get count(): number {
    return this.pads.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.ringGeometry.dispose();
    this.beamGeometry.dispose();
    this.baseGeometry.dispose();
    for (const material of this.materials) material.dispose();
    this.pads.length = 0;
  }
}
