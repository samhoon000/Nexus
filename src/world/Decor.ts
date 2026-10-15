import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';
import type { DecorDef } from '../stages/StageTypes';
import { degToRad } from '../utils/MathUtils';

/**
 * Non-colliding set dressing built from shared geometry: towers, rings, pylons, holo panels,
 * rails, arches, cube clusters, conduits, monoliths. Each returns a group; the stage disposes it.
 */
export class DecorKit {
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  private readonly torus = new THREE.TorusGeometry(1, 0.05, 10, 72);
  private readonly plane = new THREE.PlaneGeometry(1, 1);
  private readonly octa = new THREE.OctahedronGeometry(1, 0);
  private readonly extraMaterials: THREE.Material[] = [];

  constructor(private readonly materials: MaterialLibrary) {}

  create(def: DecorDef, accent: THREE.MeshStandardMaterial): THREE.Group {
    const group = new THREE.Group();
    group.name = `decor-${def.kind}`;
    const m = this.materials;
    switch (def.kind) {
      case 'tower': {
        const body = new THREE.Mesh(this.box, m.shellDark);
        body.castShadow = false;
        group.add(body);
        for (let i = 0; i < 4; i += 1) {
          const strip = new THREE.Mesh(this.box, accent);
          strip.scale.set(1.02, 0.01, 0.2);
          strip.position.set(0, -0.4 + i * 0.25, 0.42);
          group.add(strip);
        }
        const cap = new THREE.Mesh(this.box, m.trim);
        cap.scale.set(0.7, 0.04, 0.7);
        cap.position.y = 0.52;
        group.add(cap);
        break;
      }
      case 'ring': {
        const ring = new THREE.Mesh(this.torus, accent);
        group.add(ring);
        const inner = new THREE.Mesh(this.torus, m.shellMid);
        inner.scale.setScalar(0.92);
        group.add(inner);
        break;
      }
      case 'pylon': {
        const post = new THREE.Mesh(this.cylinder, m.shellMid);
        post.scale.set(0.3, 2.4, 0.3);
        post.position.y = 1.2;
        post.castShadow = true;
        group.add(post);
        const light = new THREE.Mesh(this.cylinder, accent);
        light.scale.set(0.34, 0.12, 0.34);
        light.position.y = 2.0;
        group.add(light);
        const tip = new THREE.Mesh(this.octa, m.trim);
        tip.scale.setScalar(0.22);
        tip.position.y = 2.65;
        group.add(tip);
        break;
      }
      case 'holoPanel': {
        const frame = new THREE.Mesh(this.box, m.trim);
        frame.scale.set(2.1, 1.3, 0.06);
        group.add(frame);
        const panel = new THREE.Mesh(this.plane, m.holo);
        panel.scale.set(1.95, 1.15, 1);
        panel.position.z = 0.04;
        group.add(panel);
        const stand = new THREE.Mesh(this.cylinder, m.shellDark);
        stand.scale.set(0.12, 1.4, 0.12);
        stand.position.y = -1.2;
        group.add(stand);
        break;
      }
      case 'rail': {
        const rail = new THREE.Mesh(this.box, accent);
        group.add(rail);
        break;
      }
      case 'arch': {
        const archRing = new THREE.Mesh(this.torus, m.trim);
        archRing.scale.setScalar(2.8);
        archRing.position.y = 2.8;
        group.add(archRing);
        const glow = new THREE.Mesh(this.torus, accent);
        glow.scale.set(2.6, 2.6, 1.5);
        glow.position.y = 2.8;
        group.add(glow);
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(this.box, m.shellMid);
          leg.scale.set(0.5, 2.8, 0.5);
          leg.position.set(side * 2.75, 1.4, 0);
          group.add(leg);
        }
        break;
      }
      case 'cubeCluster': {
        const offsets: [number, number, number, number][] = [
          [0, 0, 0, 1.6],
          [1.4, 0.9, -0.6, 0.9],
          [-1.2, 1.4, 0.8, 0.7],
          [0.5, -1.3, 1.1, 0.8],
          [-0.9, -0.4, -1.3, 0.55],
        ];
        offsets.forEach(([x, y, z, s], i) => {
          const cube = new THREE.Mesh(this.box, i % 2 ? m.shellLight : m.shellMid);
          cube.position.set(x, y, z);
          cube.scale.setScalar(s);
          cube.rotation.set(i * 0.4, i * 0.7, 0);
          group.add(cube);
          const edge = new THREE.Mesh(this.box, accent);
          edge.position.copy(cube.position);
          edge.rotation.copy(cube.rotation);
          edge.scale.set(s * 1.02, s * 0.05, s * 1.02);
          group.add(edge);
        });
        break;
      }
      case 'conduit': {
        const tube = new THREE.Mesh(this.cylinder, m.shellDark);
        tube.rotation.x = Math.PI / 2;
        group.add(tube);
        const line = new THREE.Mesh(this.cylinder, accent);
        line.rotation.x = Math.PI / 2;
        line.scale.set(0.35, 1.01, 0.35);
        group.add(line);
        break;
      }
      case 'core': {
        // The Core: a towering column with a suspended energy sphere and orbiting rings.
        const column = new THREE.Mesh(this.cylinder, m.shellDark);
        column.scale.set(10, 60, 10);
        column.position.y = -24;
        group.add(column);
        const collar = new THREE.Mesh(this.cylinder, m.trim);
        collar.scale.set(12, 1.2, 12);
        collar.position.y = 5.5;
        group.add(collar);
        for (let i = 0; i < 6; i += 1) {
          const seam = new THREE.Mesh(this.box, accent);
          seam.scale.set(0.3, 54, 0.3);
          const a = (i / 6) * Math.PI * 2;
          seam.position.set(Math.cos(a) * 5.05, -24, Math.sin(a) * 5.05);
          group.add(seam);
        }
        const orbMaterial = new THREE.MeshStandardMaterial({
          color: 0x08141c,
          emissive: 0x19e6ff,
          emissiveIntensity: 0.6,
          roughness: 0.2,
          metalness: 0.1,
        });
        const orb = new THREE.Mesh(this.octa, orbMaterial);
        orb.name = 'coreOrb';
        orb.scale.setScalar(4.5);
        orb.position.y = 14;
        group.add(orb);
        const cage = new THREE.Mesh(this.octa, m.trim);
        cage.scale.setScalar(6.2);
        cage.position.y = 14;
        cage.rotation.y = Math.PI / 4;
        (cage.material as THREE.Material).side = THREE.DoubleSide;
        group.add(cage);
        const ringMaterial = new THREE.MeshStandardMaterial({
          color: 0x0a0d16,
          emissive: 0x19e6ff,
          emissiveIntensity: 0.45,
          roughness: 0.4,
          metalness: 0.2,
        });
        for (let i = 0; i < 3; i += 1) {
          const ring = new THREE.Mesh(this.torus, ringMaterial);
          ring.scale.setScalar(6 + i * 1.8);
          ring.position.y = 14;
          ring.rotation.set(Math.PI / 2 + i * 0.5, i * 0.8, 0);
          ring.name = `coreRing${i}`;
          group.add(ring);
        }
        this.extraMaterials.push(orbMaterial, ringMaterial);
        break;
      }
      case 'monolith': {
        const slab = new THREE.Mesh(this.box, m.shellDark);
        slab.scale.set(1.2, 5, 0.6);
        slab.position.y = 2.5;
        slab.castShadow = true;
        group.add(slab);
        const seam = new THREE.Mesh(this.box, accent);
        seam.scale.set(0.08, 4.4, 0.62);
        seam.position.y = 2.5;
        group.add(seam);
        const cap = new THREE.Mesh(this.octa, m.trim);
        cap.scale.set(0.5, 0.7, 0.5);
        cap.position.y = 5.5;
        group.add(cap);
        break;
      }
    }

    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    if (def.rot) group.rotation.set(degToRad(def.rot[0]), degToRad(def.rot[1]), degToRad(def.rot[2]));
    if (typeof def.scale === 'number') group.scale.setScalar(def.scale);
    else if (def.scale) group.scale.set(def.scale[0], def.scale[1], def.scale[2]);
    return group;
  }

  dispose(): void {
    this.box.dispose();
    this.cylinder.dispose();
    this.torus.dispose();
    this.plane.dispose();
    this.octa.dispose();
    for (const material of this.extraMaterials) material.dispose();
  }
}
