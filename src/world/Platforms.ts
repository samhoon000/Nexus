import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OBB } from '../utils/CollisionUtils';
import type { MaterialLibrary } from '../effects/Materials';
import type { PlatformDef, PlatformStyle } from '../stages/StageTypes';
import { degToRad } from '../utils/MathUtils';

/** Solid world geometry the player collides with. */
export interface Collider {
  id: string;
  object: THREE.Object3D;
  obb: OBB;
  enabled: boolean;
  kind: 'solid' | 'hazard';
  /** Per-step transform delta for riding (set by moving / rotating / falling platforms). */
  prevMatrix: THREE.Matrix4 | null;
  /** Owning platform (null for plain world geometry). */
  platform: Platform | null;
}

export interface Platform {
  def: PlatformDef;
  group: THREE.Group;
  collider: Collider;
  /** Platform-centre rest position / rotation (collider box is local to the group). */
  basePosition: THREE.Vector3;
  baseQuaternion: THREE.Quaternion;
  trim: THREE.Mesh | null;
  trimMaterialBase: THREE.MeshStandardMaterial | null;
  /** Per-platform merged geometry (disposed with the platform). */
  ownedGeometry: THREE.BufferGeometry | null;
  /** Mutable runtime data owned by the mechanic systems. */
  state: Record<string, number | boolean>;
}

const SHARED_GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  edge: new THREE.BoxGeometry(1, 1, 1),
};

/**
 * Builds a platform: a dark shell, a lighter deck, an emissive trim strip around the edge,
 * underside conduits, and a collider that exactly matches the visual deck.
 */
export function createPlatform(def: PlatformDef, materials: MaterialLibrary): Platform {
  const [w, h, d] = def.size;
  const group = new THREE.Group();
  group.name = def.id ?? `platform-${def.kind ?? 'static'}`;

  const style = def.style ?? 'standard';
  const trimMaterial = trimMaterialFor(style, materials);
  let trim: THREE.Mesh | null = null;
  let clampGeometry: THREE.BufferGeometry | null = null;

  if (!def.colliderOnly) {
    const deck = new THREE.Mesh(SHARED_GEOMETRY.box, deckMaterialFor(style, materials));
    deck.scale.set(w - 0.12, h * 0.42, d - 0.12);
    deck.position.y = -h * 0.21;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    const shell = new THREE.Mesh(SHARED_GEOMETRY.box, materials.shellDark);
    shell.scale.set(w, h * 0.58, d);
    shell.position.y = -h * 0.42 - h * 0.29;
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    trim = new THREE.Mesh(SHARED_GEOMETRY.edge, trimMaterial.clone());
    trim.scale.set(w + 0.02, Math.min(0.08, h * 0.3), d + 0.02);
    trim.position.y = -h * 0.42 - 0.02;
    group.add(trim);

    if (w > 1.4 && d > 1.4) {
      const clampSize = Math.min(0.35, Math.min(w, d) * 0.18);
      const parts: THREE.BufferGeometry[] = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const part = new THREE.BoxGeometry(clampSize, h * 0.9, clampSize);
          part.translate(
            sx * (w / 2 - clampSize / 2 + 0.02),
            -h * 0.45,
            sz * (d / 2 - clampSize / 2 + 0.02),
          );
          parts.push(part);
        }
      }
      clampGeometry = mergeGeometries(parts, false);
      for (const part of parts) part.dispose();
      if (clampGeometry) {
        const clamps = new THREE.Mesh(clampGeometry, materials.trim);
        clamps.castShadow = true;
        group.add(clamps);
      }
    }

    if (h > 0.3) {
      const conduit = new THREE.Mesh(SHARED_GEOMETRY.box, materials.emissiveDim);
      conduit.scale.set(Math.max(0.2, w * 0.3), 0.08, Math.max(0.2, d * 0.3));
      conduit.position.y = -h - 0.02;
      group.add(conduit);
    }
  }

  group.position.set(def.pos[0], def.pos[1], def.pos[2]);
  if (def.rot) group.rotation.set(degToRad(def.rot[0]), degToRad(def.rot[1]), degToRad(def.rot[2]));
  group.updateMatrixWorld(true);

  const colliderPivot = new THREE.Object3D();
  colliderPivot.position.y = -h / 2;
  group.add(colliderPivot);
  group.updateMatrixWorld(true);

  const obb = new OBB([w / 2, h / 2, d / 2]);
  obb.refresh(colliderPivot);

  const collider: Collider = {
    id: group.name,
    object: colliderPivot,
    obb,
    enabled: !def.group && !def.visualOnly,
    kind: 'solid',
    prevMatrix: null,
    platform: null,
  };

  const platform: Platform = {
    def,
    group,
    collider,
    basePosition: group.position.clone(),
    baseQuaternion: group.quaternion.clone(),
    trim,
    trimMaterialBase: def.colliderOnly ? null : trimMaterial,
    ownedGeometry: clampGeometry,
    state: {},
  };
  collider.platform = platform;
  if (def.group) group.visible = false;
  return platform;
}

/** Plain invisible or visible collision box (walls, ramps). */
export function createBoxCollider(
  object: THREE.Object3D,
  halfExtents: [number, number, number],
  id = 'box',
): Collider {
  const obb = new OBB(halfExtents);
  object.updateMatrixWorld(true);
  obb.refresh(object);
  return { id, object, obb, enabled: true, kind: 'solid', prevMatrix: null, platform: null };
}

function deckMaterialFor(style: PlatformStyle, materials: MaterialLibrary): THREE.Material {
  switch (style) {
    case 'light':
      return materials.shellLight;
    case 'dark':
      return materials.groundContact;
    case 'core':
      return materials.shellMid;
    default:
      return materials.deckTop;
  }
}

function trimMaterialFor(style: PlatformStyle, materials: MaterialLibrary): THREE.MeshStandardMaterial {
  switch (style) {
    case 'hazard':
      return materials.emissiveOrange;
    case 'violet':
      return materials.emissiveViolet;
    case 'light':
      return materials.emissiveWhite;
    case 'core':
      return materials.emissiveBlue;
    default:
      return materials.emissiveCyan;
  }
}

export function disposePlatform(platform: Platform): void {
  platform.group.removeFromParent();
  if (platform.trim) (platform.trim.material as THREE.Material).dispose();
  platform.ownedGeometry?.dispose();
}
