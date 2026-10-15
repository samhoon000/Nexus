import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';

/**
 * Procedural stand-in used only when the NEXUS character GLB cannot be loaded, so the game stays
 * playable offline or with a broken asset path. Origin is the body centre, +Z is forward.
 */
export interface FallbackParts {
  group: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  coreGlow: THREE.Sprite;
  visor: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  thrusterRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
}

export function createFallbackModel(materials: MaterialLibrary, disposables: Array<{ dispose(): void }>): FallbackParts {
  const group = new THREE.Group();
  group.name = 'player-fallback';
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const torso = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.26, 0.22, 6, 16)), materials.shellMid);
  torso.position.y = 0.02;
  torso.castShadow = true;
  group.add(torso);

  const chest = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.3, 0.12)), materials.shellLight);
  chest.position.set(0, 0.04, 0.2);
  chest.castShadow = true;
  group.add(chest);

  const coreMaterial = track(
    new THREE.MeshStandardMaterial({ color: 0x08141c, emissive: 0x19e6ff, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.1 }),
  );
  const core = new THREE.Mesh(track(new THREE.SphereGeometry(0.085, 16, 12)), coreMaterial);
  core.position.set(0, 0.04, 0.28);
  group.add(core);

  const coreGlow = new THREE.Sprite(track(materials.glowSprite.clone()));
  coreGlow.material.opacity = 0.7;
  coreGlow.scale.setScalar(0.55);
  coreGlow.position.copy(core.position);
  group.add(coreGlow);

  const shoulderGeometry = track(new THREE.SphereGeometry(0.09, 12, 10));
  const armGeometry = track(new THREE.CylinderGeometry(0.045, 0.035, 0.3, 10));
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeometry, materials.trim);
    shoulder.position.set(side * 0.32, 0.18, 0.02);
    shoulder.castShadow = true;
    group.add(shoulder);
    const arm = new THREE.Mesh(armGeometry, materials.shellDark);
    arm.position.set(side * 0.34, -0.02, 0.02);
    arm.castShadow = true;
    group.add(arm);
    const hand = new THREE.Mesh(shoulderGeometry, materials.shellLight);
    hand.scale.setScalar(0.8);
    hand.position.set(side * 0.34, -0.2, 0.02);
    group.add(hand);
  }

  const head = new THREE.Group();
  head.position.y = 0.44;
  group.add(head);
  const headMesh = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.26, 0.34)), materials.shellLight);
  headMesh.castShadow = true;
  head.add(headMesh);
  const visorMaterial = track(
    new THREE.MeshStandardMaterial({ color: 0x061018, emissive: 0x19e6ff, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2 }),
  );
  const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.09, 0.04)), visorMaterial);
  visor.position.set(0, 0.01, 0.17);
  head.add(visor);

  const skirt = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.26, 0.2, 14)), materials.shellDark);
  skirt.position.y = -0.3;
  skirt.castShadow = true;
  group.add(skirt);
  const thrusterMaterial = track(new THREE.MeshStandardMaterial({ color: 0x08141c, emissive: 0x19e6ff, emissiveIntensity: 1.4, roughness: 0.4 }));
  const thrusterRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.035, 8, 24)), thrusterMaterial);
  thrusterRing.rotation.x = Math.PI / 2;
  thrusterRing.position.y = -0.42;
  group.add(thrusterRing);

  return { group, core, coreGlow, visor, thrusterRing };
}
