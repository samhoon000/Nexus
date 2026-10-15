import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';
import { createContactShadowTexture } from '../effects/Materials';
import { PLAYER_CENTER_HEIGHT } from '../utils/Constants';

/**
 * Procedural explorer robot. The origin is the body centre (= physics position) and +Z is forward.
 * Replace `buildProceduralBody` with a GLTF scene later; the named parts drive the animation.
 */
export interface PlayerModelParts {
  root: THREE.Group;
  /** Child that receives squash/stretch and lean. */
  body: THREE.Group;
  head: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  coreGlow: THREE.Sprite;
  visor: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  thrusterRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  thrusterGlow: THREE.Sprite;
  antennaTip: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  contactShadow: THREE.Mesh;
  disposables: Array<{ dispose(): void }>;
}

export function createPlayerModel(materials: MaterialLibrary): PlayerModelParts {
  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Group();
  body.name = 'playerBody';
  root.add(body);
  const disposables: Array<{ dispose(): void }> = [];

  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Torso: a rounded capsule-like shell.
  const torsoGeometry = track(new THREE.CapsuleGeometry(0.26, 0.22, 6, 16));
  const torso = new THREE.Mesh(torsoGeometry, materials.shellMid);
  torso.position.y = 0.02;
  torso.castShadow = true;
  body.add(torso);

  // Chest plate (lighter) and the energy core.
  const chestGeometry = track(new THREE.BoxGeometry(0.34, 0.3, 0.12));
  const chest = new THREE.Mesh(chestGeometry, materials.shellLight);
  chest.position.set(0, 0.04, 0.2);
  chest.castShadow = true;
  body.add(chest);

  const coreMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x08141c,
      emissive: 0x19e6ff,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      metalness: 0.1,
    }),
  );
  const core = new THREE.Mesh(track(new THREE.SphereGeometry(0.085, 16, 12)), coreMaterial);
  core.position.set(0, 0.04, 0.28);
  body.add(core);

  const coreGlow = new THREE.Sprite(materials.glowSprite.clone());
  (coreGlow.material as THREE.SpriteMaterial).opacity = 0.7;
  track(coreGlow.material);
  coreGlow.scale.setScalar(0.55);
  coreGlow.position.copy(core.position);
  body.add(coreGlow);

  // Shoulders + arms.
  const shoulderGeometry = track(new THREE.SphereGeometry(0.09, 12, 10));
  const armGeometry = track(new THREE.CylinderGeometry(0.045, 0.035, 0.3, 10));
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeometry, materials.trim);
    shoulder.position.set(side * 0.32, 0.18, 0.02);
    shoulder.castShadow = true;
    body.add(shoulder);
    const arm = new THREE.Mesh(armGeometry, materials.shellDark);
    arm.position.set(side * 0.34, -0.02, 0.02);
    arm.castShadow = true;
    body.add(arm);
    const hand = new THREE.Mesh(shoulderGeometry, materials.shellLight);
    hand.scale.setScalar(0.8);
    hand.position.set(side * 0.34, -0.2, 0.02);
    body.add(hand);
  }

  // Head with visor and antenna.
  const head = new THREE.Group();
  head.position.y = 0.44;
  body.add(head);
  const headGeometry = track(new THREE.BoxGeometry(0.4, 0.26, 0.34));
  const headMesh = new THREE.Mesh(headGeometry, materials.shellLight);
  headMesh.castShadow = true;
  head.add(headMesh);
  const visorMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x061018,
      emissive: 0x19e6ff,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.2,
    }),
  );
  const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.09, 0.04)), visorMaterial);
  visor.position.set(0, 0.01, 0.17);
  head.add(visor);
  const earGeometry = track(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeometry, materials.trim);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(side * 0.22, 0, 0);
    head.add(ear);
  }
  const antenna = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6)), materials.trim);
  antenna.position.set(0.12, 0.22, -0.05);
  head.add(antenna);
  const antennaTip = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 8, 8)), coreMaterial);
  antennaTip.position.set(0.12, 0.34, -0.05);
  head.add(antennaTip);

  // Hover skirt + thruster ring instead of legs.
  const skirtGeometry = track(new THREE.CylinderGeometry(0.16, 0.26, 0.2, 14));
  const skirt = new THREE.Mesh(skirtGeometry, materials.shellDark);
  skirt.position.y = -0.3;
  skirt.castShadow = true;
  body.add(skirt);
  const thrusterMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x08141c,
      emissive: 0x19e6ff,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    }),
  );
  const thrusterRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.035, 8, 24)), thrusterMaterial);
  thrusterRing.rotation.x = Math.PI / 2;
  thrusterRing.position.y = -0.42;
  body.add(thrusterRing);
  const thrusterGlow = new THREE.Sprite(materials.glowSprite.clone());
  track(thrusterGlow.material);
  (thrusterGlow.material as THREE.SpriteMaterial).opacity = 0.5;
  thrusterGlow.scale.set(0.6, 0.6, 0.6);
  thrusterGlow.position.y = -0.5;
  body.add(thrusterGlow);

  // Contact shadow disc at the feet (not parented to body so squash doesn't move it).
  const shadowTexture = track(createContactShadowTexture());
  const contactShadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.1, 1.1)),
    track(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -PLAYER_CENTER_HEIGHT + 0.02;
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  return {
    root,
    body,
    head,
    core,
    coreGlow,
    visor,
    thrusterRing,
    thrusterGlow,
    antennaTip,
    contactShadow,
    disposables,
  };
}
