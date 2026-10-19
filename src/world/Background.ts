import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';
import type { StageTheme } from '../stages/StageTypes';

/**
 * Distant megastructures: instanced towers, rings and arcs far outside the play space.
 * They give the world its scale and light up during the Core sequence.
 */
export interface BackgroundStructures {
  group: THREE.Group;
  setTheme(theme: StageTheme, instant: boolean): void;
  setPower(power: number): void;
  update(delta: number, elapsed: number, focus: THREE.Vector3): void;
  dispose(): void;
}

const TOWER_COUNT = 44;
const RING_COUNT = 9;
const SHARD_COUNT = 140;

export function createBackgroundStructures(materials: MaterialLibrary, rng: () => number): BackgroundStructures {
  const group = new THREE.Group();
  group.name = 'background';

  // Towers: tall boxes arranged in a wide ring, well outside the play space.
  const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
  const towers = new THREE.InstancedMesh(towerGeometry, materials.shellDark, TOWER_COUNT);
  const towerLights = new THREE.InstancedMesh(towerGeometry, materials.emissiveDim.clone(), TOWER_COUNT);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < TOWER_COUNT; i += 1) {
    const angle = (i / TOWER_COUNT) * Math.PI * 2 + rng() * 0.2;
    const radius = 200 + rng() * 220;
    const height = 50 + rng() * 190;
    const width = 8 + rng() * 18;
    dummy.position.set(Math.cos(angle) * radius, height / 2 - 60 + rng() * 40, Math.sin(angle) * radius);
    dummy.scale.set(width, height, width * (0.6 + rng() * 0.8));
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);
    // A thin emissive strip near the top of each tower.
    dummy.scale.set(width * 1.02, 0.6 + rng() * 1.2, width * 0.3);
    dummy.position.y += height * (0.2 + rng() * 0.25);
    dummy.updateMatrix();
    towerLights.setMatrixAt(i, dummy.matrix);
  }
  towers.instanceMatrix.needsUpdate = true;
  towerLights.instanceMatrix.needsUpdate = true;
  group.add(towers, towerLights);

  // Rings: huge torus arcs floating at different heights and tilts.
  const ringGeometry = new THREE.TorusGeometry(1, 0.035, 8, 96);
  const rings = new THREE.InstancedMesh(ringGeometry, materials.emissiveDim.clone(), RING_COUNT);
  const ringSpin: number[] = [];
  const ringBase: THREE.Matrix4[] = [];
  for (let i = 0; i < RING_COUNT; i += 1) {
    const radius = 70 + rng() * 150;
    const angle = rng() * Math.PI * 2;
    const distance = 230 + rng() * 200;
    dummy.position.set(Math.cos(angle) * distance, 30 + rng() * 140, Math.sin(angle) * distance - 60);
    dummy.scale.setScalar(radius);
    dummy.rotation.set(Math.PI / 2 + (rng() - 0.5) * 0.9, rng() * Math.PI, (rng() - 0.5) * 0.6);
    dummy.updateMatrix();
    rings.setMatrixAt(i, dummy.matrix);
    ringBase.push(dummy.matrix.clone());
    ringSpin.push((rng() - 0.5) * 0.04);
  }
  rings.instanceMatrix.needsUpdate = true;
  group.add(rings);

  // Floating geometric shards drifting far out.
  const shardGeometry = new THREE.OctahedronGeometry(1, 0);
  const shards = new THREE.InstancedMesh(shardGeometry, materials.shellMid, SHARD_COUNT);
  const shardData: { base: THREE.Vector3; scale: number; phase: number; speed: number }[] = [];
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    const base = new THREE.Vector3((rng() - 0.5) * 320, (rng() - 0.5) * 120 + 10, (rng() - 0.5) * 320);
    if (base.length() < 90) base.setLength(90 + rng() * 80);
    shardData.push({ base, scale: 1.5 + rng() * 5, phase: rng() * Math.PI * 2, speed: 0.1 + rng() * 0.2 });
  }
  group.add(shards);

  const ringMaterial = rings.material as THREE.MeshStandardMaterial;
  const towerLightMaterial = towerLights.material as THREE.MeshStandardMaterial;
  const targetAccent = new THREE.Color(0x19e6ff);
  let power = 0;

  return {
    group,
    setTheme(theme, instant) {
      targetAccent.set(theme.accentSecondary);
      if (instant) {
        ringMaterial.emissive.copy(targetAccent);
        towerLightMaterial.emissive.copy(targetAccent);
      }
    },
    setPower(value) {
      power = value;
    },
    update(delta, elapsed) {
      const t = 1 - Math.exp(-delta / 0.8);
      ringMaterial.emissive.lerp(targetAccent, t);
      towerLightMaterial.emissive.lerp(targetAccent, t);
      ringMaterial.emissiveIntensity = 0.35 + power * 1.4;
      towerLightMaterial.emissiveIntensity = 0.5 + power * 1.8;
      for (let i = 0; i < RING_COUNT; i += 1) {
        dummy.matrix.copy(ringBase[i]);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.rotateY(elapsed * ringSpin[i]);
        dummy.updateMatrix();
        rings.setMatrixAt(i, dummy.matrix);
      }
      rings.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < SHARD_COUNT; i += 1) {
        const s = shardData[i];
        dummy.position.copy(s.base);
        dummy.position.y += Math.sin(elapsed * s.speed + s.phase) * 3;
        dummy.rotation.set(elapsed * s.speed * 0.5 + s.phase, elapsed * s.speed * 0.3, s.phase);
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        shards.setMatrixAt(i, dummy.matrix);
      }
      shards.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      group.removeFromParent();
      towerGeometry.dispose();
      ringGeometry.dispose();
      shardGeometry.dispose();
      ringMaterial.dispose();
      towerLightMaterial.dispose();
      towers.dispose();
      towerLights.dispose();
      rings.dispose();
      shards.dispose();
    },
  };
}
