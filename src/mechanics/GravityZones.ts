import * as THREE from 'three';
import type { GravityZoneDef } from '../stages/StageTypes';
import type { StageContext } from '../stages/StageContext';
import { OBB } from '../utils/CollisionUtils';
import { degToRad } from '../utils/MathUtils';

interface Zone {
  obb: OBB;
  up: THREE.Vector3;
  scale: number;
  shell: THREE.Mesh;
  edges: THREE.LineSegments;
}

export interface GravityResult {
  up: THREE.Vector3;
  scale: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Gravity is a function of position: inside a zone the player's "up" and gravity scale change.
 * Zones are drawn as translucent holographic volumes with glowing edges.
 */
export class GravityZones {
  private readonly zones: Zone[] = [];
  private readonly group = new THREE.Group();
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly edgeGeometry = new THREE.EdgesGeometry(this.boxGeometry);
  private readonly materials: THREE.Material[] = [];
  readonly current: GravityResult = { up: new THREE.Vector3(0, 1, 0), scale: 1 };

  constructor(private readonly ctx: StageContext, defs: GravityZoneDef[] = []) {
    this.group.name = 'gravity-zones';
    ctx.world.root.add(this.group);
    for (const def of defs) this.add(def);
  }

  private add(def: GravityZoneDef): void {
    const color = def.color ?? this.ctx.theme.accentSecondary;
    const shellMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
    this.materials.push(shellMaterial, edgeMaterial);

    const pivot = new THREE.Object3D();
    pivot.position.set(def.pos[0], def.pos[1], def.pos[2]);
    if (def.rot) pivot.rotation.set(degToRad(def.rot[0]), degToRad(def.rot[1]), degToRad(def.rot[2]));
    const shell = new THREE.Mesh(this.boxGeometry, shellMaterial);
    shell.scale.set(def.size[0], def.size[1], def.size[2]);
    const edges = new THREE.LineSegments(this.edgeGeometry, edgeMaterial);
    edges.scale.copy(shell.scale);
    pivot.add(shell, edges);
    this.group.add(pivot);
    pivot.updateMatrixWorld(true);

    const obb = new OBB([def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]);
    obb.refresh(pivot);
    const up = def.up ? new THREE.Vector3(...def.up).normalize() : WORLD_UP.clone();
    this.zones.push({ obb, up, scale: def.scale ?? 1, shell, edges });
  }

  /** Evaluates gravity at a position. Returns true when the result changed. */
  evaluate(position: THREE.Vector3): boolean {
    let up = WORLD_UP;
    let scale = 1;
    for (const zone of this.zones) {
      if (zone.obb.containsPoint(position)) {
        up = zone.up;
        scale = zone.scale;
        break;
      }
    }
    const changed = this.current.up.distanceToSquared(up) > 1e-8 || this.current.scale !== scale;
    this.current.up.copy(up);
    this.current.scale = scale;
    return changed;
  }

  update(elapsed: number): void {
    for (let i = 0; i < this.zones.length; i += 1) {
      const zone = this.zones[i];
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.5 + i);
      (zone.shell.material as THREE.MeshBasicMaterial).opacity = 0.05 + pulse * 0.05;
      (zone.edges.material as THREE.LineBasicMaterial).opacity = 0.4 + pulse * 0.4;
    }
  }

  get count(): number {
    return this.zones.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.boxGeometry.dispose();
    this.edgeGeometry.dispose();
    for (const material of this.materials) material.dispose();
    this.zones.length = 0;
  }
}
