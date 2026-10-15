import * as THREE from 'three';
import type { HazardDef } from '../stages/StageTypes';
import type { StageContext } from '../stages/StageContext';
import type { Collider } from './Platforms';
import { OBB } from '../utils/CollisionUtils';
import { degToRad } from '../utils/MathUtils';

interface Beam {
  def: HazardDef;
  collider: Collider;
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
}

/**
 * Energy beams: hazard colliders (touch = death) with an optional on/off cycle and a warning
 * flicker before switching on.
 */
export class Hazards {
  private readonly beams: Beam[] = [];
  private readonly group = new THREE.Group();
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly capGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  private readonly materials: THREE.Material[] = [];
  private time = 0;

  constructor(private readonly ctx: StageContext, defs: HazardDef[] = []) {
    this.group.name = 'hazards';
    ctx.world.root.add(this.group);
    for (const def of defs) this.add(def);
  }

  private add(def: HazardDef): void {
    const group = new THREE.Group();
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7a2a,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(coreMaterial, haloMaterial);
    const core = new THREE.Mesh(this.boxGeometry, coreMaterial);
    core.scale.set(def.size[0], def.size[1], def.size[2]);
    const halo = new THREE.Mesh(this.boxGeometry, haloMaterial);
    halo.scale.set(def.size[0] + 0.25, def.size[1] + 0.25, def.size[2] + 0.25);
    group.add(core, halo);
    // Emitter caps at both ends of the longest axis.
    const longest = def.size.indexOf(Math.max(...def.size));
    for (const sign of [-1, 1]) {
      const cap = new THREE.Mesh(this.capGeometry, this.ctx.materials.trim);
      cap.scale.set(0.6, 0.5, 0.6);
      if (longest === 0) {
        cap.rotation.z = Math.PI / 2;
        cap.position.x = sign * (def.size[0] / 2 + 0.2);
      } else if (longest === 1) {
        cap.position.y = sign * (def.size[1] / 2 + 0.2);
      } else {
        cap.rotation.x = Math.PI / 2;
        cap.position.z = sign * (def.size[2] / 2 + 0.2);
      }
      group.add(cap);
    }
    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    if (def.rot) group.rotation.set(degToRad(def.rot[0]), degToRad(def.rot[1]), degToRad(def.rot[2]));
    this.group.add(group);
    group.updateMatrixWorld(true);

    const obb = new OBB([def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]);
    obb.refresh(group);
    const collider: Collider = {
      id: 'beam',
      object: group,
      obb,
      enabled: true,
      kind: 'hazard',
      prevMatrix: null,
      platform: null,
    };
    this.ctx.world.addCollider(collider);
    this.beams.push({ def, collider, group, core, halo });
  }

  update(dt: number): void {
    this.time += dt;
    for (const beam of this.beams) {
      let on = true;
      let warn = 0;
      if (beam.def.cycle) {
        const period = beam.def.cycle.on + beam.def.cycle.off;
        const t = (this.time + (beam.def.cycle.phase ?? 0) * period) % period;
        on = t < beam.def.cycle.on;
        if (!on && t > period - 0.5) warn = (t - (period - 0.5)) / 0.5;
      }
      beam.collider.enabled = on;
      beam.core.visible = on;
      beam.halo.visible = on || warn > 0;
      const halo = beam.halo.material as THREE.MeshBasicMaterial;
      halo.opacity = on ? 0.2 + 0.1 * Math.sin(this.time * 18) : warn * 0.12 * (Math.sin(this.time * 40) > 0 ? 1 : 0.2);
    }
  }

  get count(): number {
    return this.beams.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.boxGeometry.dispose();
    this.capGeometry.dispose();
    for (const material of this.materials) material.dispose();
    this.beams.length = 0;
  }
}
