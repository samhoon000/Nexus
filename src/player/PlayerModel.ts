import * as THREE from 'three';
import type { MaterialLibrary } from '../effects/Materials';
import { createContactShadowTexture } from '../effects/Materials';
import { CHARACTER, PLAYER_CENTER_HEIGHT } from '../utils/Constants';
import type { CharacterRig } from './CharacterRig';
import { createFallbackModel, type FallbackParts } from './PlayerFallbackModel';

export type CharacterKind = 'loading' | 'glb' | 'fallback';

/**
 * Visual hierarchy of the player. `root` sits at the physics body centre with +Z facing and +Y
 * along the gravity up vector; `body` is a pivot at the feet that carries lean and roll; the
 * NEXUS character (or the procedural fallback) hangs under it. Nothing here touches collision.
 *
 *   root (physics position + orientation)
 *   ├── contactShadow
 *   └── body (pivot at the feet)
 *       └── character rig  |  fallback robot
 */
export interface PlayerModelParts {
  root: THREE.Group;
  body: THREE.Group;
  contactShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  character: CharacterRig | null;
  /** Soft halo on the chest core, parented to the chest bone. */
  coreGlow: THREE.Sprite | null;
  fallback: FallbackParts | null;
  kind: CharacterKind;
  disposables: Array<{ dispose(): void }>;
}

/** Chest-core centre in model metres (from the GLB's NX_Torso_Core bounds), nudged in front of the dome. */
const CORE_POSITION = new THREE.Vector3(0, 0.93, 0.17);
const scratchMatrix = new THREE.Matrix4();

export function createPlayerModel(): PlayerModelParts {
  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Group();
  body.name = 'playerBody';
  body.position.y = -PLAYER_CENTER_HEIGHT;
  root.add(body);
  const disposables: Array<{ dispose(): void }> = [];

  const shadowTexture = createContactShadowTexture();
  const shadowGeometry = new THREE.PlaneGeometry(1.1, 1.1);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  disposables.push(shadowTexture, shadowGeometry, shadowMaterial);
  const contactShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -PLAYER_CENTER_HEIGHT + 0.02;
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  return { root, body, contactShadow, character: null, coreGlow: null, fallback: null, kind: 'loading', disposables };
}

/** Mounts the loaded NEXUS character under the body pivot. */
export function attachCharacter(parts: PlayerModelParts, rig: CharacterRig, materials: MaterialLibrary): void {
  parts.fallback?.group.removeFromParent();
  parts.fallback = null;
  parts.character = rig;
  parts.kind = 'glb';
  parts.body.add(rig.group);

  const glow = new THREE.Sprite(materials.glowSprite.clone());
  glow.name = 'coreGlow';
  glow.material.opacity = 0.6;
  glow.scale.setScalar(CHARACTER.GLOW_SCALE);
  // Express the core position in the chest bone's frame so the halo rides the animation.
  rig.group.updateMatrixWorld(true);
  glow.position.copy(CORE_POSITION).applyMatrix4(rig.group.matrixWorld).applyMatrix4(scratchMatrix.copy(rig.bones.Chest.matrixWorld).invert());
  rig.bones.Chest.add(glow);
  parts.coreGlow = glow;
  parts.disposables.push(glow.material, rig);
}

/** Mounts the procedural stand-in when the GLB is unavailable. */
export function attachFallback(parts: PlayerModelParts, materials: MaterialLibrary): void {
  if (parts.character) return;
  const fallback = createFallbackModel(materials, parts.disposables);
  fallback.group.position.y = PLAYER_CENTER_HEIGHT;
  parts.body.add(fallback.group);
  parts.fallback = fallback;
  parts.kind = 'fallback';
}
