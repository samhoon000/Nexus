import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import characterUrl from '../assets/characters/nexus-player/NEXUS_Player.glb?url';
import { CHARACTER } from '../utils/Constants';
import { CHARACTER_BONES, type CharacterBoneName, type CharacterRig } from './CharacterRig';

/**
 * Loads the NEXUS player GLB once and turns its 84 skinned primitives into one geometry with a
 * group per material (one draw call each), ready to instantiate as a `CharacterRig`.
 */
export interface CharacterAsset {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
  skeleton: THREE.Skeleton;
  rootBone: THREE.Bone;
  clips: THREE.AnimationClip[];
  height: number;
}

type VertexAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

const IDENTITY = new THREE.Matrix4();
let assetPromise: Promise<CharacterAsset> | null = null;

/** Fetches and prepares the GLB once; every caller shares the promise. A failure allows a retry. */
export function loadCharacterAsset(): Promise<CharacterAsset> {
  if (!assetPromise) {
    assetPromise = new GLTFLoader().loadAsync(characterUrl).then(prepareAsset);
    assetPromise.catch(() => {
      assetPromise = null;
    });
  }
  return assetPromise;
}

/** Builds an independent rig (own bones, skeleton and materials) sharing the merged geometry. */
export function createCharacterRig(asset: CharacterAsset): CharacterRig {
  const group = new THREE.Group();
  group.name = 'nexus-character';
  const rootBone = asset.rootBone.clone(true);
  const bones = asset.skeleton.bones.map((bone) => {
    const clone = rootBone.getObjectByName(bone.name) as THREE.Bone | undefined;
    if (!clone?.isBone) throw new Error(`NEXUS character: bone ${bone.name} missing from the cloned rig`);
    return clone;
  });
  const skeleton = new THREE.Skeleton(
    bones,
    asset.skeleton.boneInverses.map((matrix) => matrix.clone()),
  );
  const materials = asset.materials.map((material) => material.clone());
  const mesh = new THREE.SkinnedMesh(asset.geometry, materials);
  mesh.name = 'nexus-character-mesh';
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  // The player is always on screen and the rest-pose bounds would mis-cull animated limbs.
  mesh.frustumCulled = false;
  group.add(rootBone, mesh);
  // glTF skinned vertices live in the armature's space, so the bind matrix is the identity.
  mesh.bind(skeleton, IDENTITY);
  group.scale.setScalar(CHARACTER.SCALE);
  group.updateMatrixWorld(true);

  const byName = {} as Record<CharacterBoneName, THREE.Bone>;
  for (const name of CHARACTER_BONES) {
    const bone = skeleton.getBoneByName(name);
    if (!bone) throw new Error(`NEXUS character: bone ${name} missing`);
    byName[name] = bone;
  }
  const energy = (name: string): THREE.MeshStandardMaterial => {
    const material = materials.find((m) => m.name === name);
    if (!material) throw new Error(`NEXUS character: material ${name} missing`);
    return material as THREE.MeshStandardMaterial;
  };
  return {
    group,
    mesh,
    skeleton,
    bones: byName,
    materials: {
      energyCyan: energy('NX_EnergyCyan'),
      energyBlue: energy('NX_EnergyBlue'),
      energyViolet: energy('NX_EnergyViolet'),
      all: materials,
    },
    clips: asset.clips,
    height: asset.height,
    dispose: () => {
      group.removeFromParent();
      for (const material of materials) material.dispose();
      skeleton.dispose();
    },
  };
}

function prepareAsset(gltf: GLTF): CharacterAsset {
  const skinned: THREE.SkinnedMesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(object as THREE.SkinnedMesh);
  });
  if (skinned.length === 0) throw new Error('NEXUS_Player.glb contains no skinned meshes');
  const skeleton = skinned[0].skeleton;
  if (skinned.some((mesh) => mesh.skeleton !== skeleton)) throw new Error('NEXUS_Player.glb must use a single skin');
  const rootBone = skeleton.bones.find((bone) => !(bone.parent as THREE.Bone | null)?.isBone);
  if (!rootBone) throw new Error('NEXUS_Player.glb skeleton has no root bone');
  for (const name of CHARACTER_BONES) {
    if (!skeleton.getBoneByName(name)) throw new Error(`NEXUS_Player.glb is missing bone ${name}`);
  }
  const { geometry, materials } = mergeByMaterial(skinned);
  tuneMaterials(materials);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const box = geometry.boundingBox!;
  return { geometry, materials, skeleton, rootBone, clips: gltf.animations, height: box.max.y - box.min.y };
}

function attribute(geometry: THREE.BufferGeometry, name: string): VertexAttribute {
  const value = geometry.getAttribute(name) as VertexAttribute | undefined;
  if (!value) throw new Error(`NEXUS_Player.glb primitive lacks ${name}`);
  return value;
}

/**
 * Concatenates every primitive into one geometry. Primitives of one glTF mesh share a vertex
 * buffer (the exporter writes shared accessors), so each distinct position attribute is copied once
 * and only the index lists are split per material.
 */
function mergeByMaterial(meshes: THREE.SkinnedMesh[]): { geometry: THREE.BufferGeometry; materials: THREE.Material[] } {
  const blocks = new Map<VertexAttribute, { geometry: THREE.BufferGeometry; offset: number }>();
  let vertexCount = 0;
  for (const mesh of meshes) {
    const position = attribute(mesh.geometry, 'position');
    if (!blocks.has(position)) {
      blocks.set(position, { geometry: mesh.geometry, offset: vertexCount });
      vertexCount += position.count;
    }
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const skinIndex = new Uint16Array(vertexCount * 4);
  const skinWeight = new Float32Array(vertexCount * 4);
  for (const block of blocks.values()) {
    copyAttribute(attribute(block.geometry, 'position'), position, block.offset, 3);
    copyAttribute(attribute(block.geometry, 'normal'), normal, block.offset, 3);
    if (block.geometry.getAttribute('uv')) copyAttribute(attribute(block.geometry, 'uv'), uv, block.offset, 2);
    copyAttribute(attribute(block.geometry, 'skinIndex'), skinIndex, block.offset, 4);
    copyAttribute(attribute(block.geometry, 'skinWeight'), skinWeight, block.offset, 4);
  }

  const materials: THREE.Material[] = [];
  const indexLists: number[][] = [];
  for (const mesh of meshes) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    let slot = materials.indexOf(material);
    if (slot < 0) {
      slot = materials.length;
      materials.push(material);
      indexLists.push([]);
    }
    const offset = blocks.get(attribute(mesh.geometry, 'position'))!.offset;
    const list = indexLists[slot];
    const index = mesh.geometry.index;
    if (index) for (let i = 0; i < index.count; i += 1) list.push(index.getX(i) + offset);
    else for (let i = 0; i < attribute(mesh.geometry, 'position').count; i += 1) list.push(i + offset);
  }
  const total = indexLists.reduce((sum, list) => sum + list.length, 0);
  const index = vertexCount > 65535 ? new Uint32Array(total) : new Uint16Array(total);
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'nexus-character';
  let start = 0;
  for (let slot = 0; slot < indexLists.length; slot += 1) {
    index.set(indexLists[slot], start);
    geometry.addGroup(start, indexLists[slot].length, slot);
    start += indexLists[slot].length;
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  return { geometry, materials };
}

function copyAttribute(source: VertexAttribute, target: Float32Array | Uint16Array, vertexOffset: number, itemSize: number): void {
  for (let i = 0; i < source.count; i += 1) {
    const o = (vertexOffset + i) * itemSize;
    target[o] = source.getX(i);
    if (itemSize > 1) target[o + 1] = source.getY(i);
    if (itemSize > 2) target[o + 2] = source.getZ(i);
    if (itemSize > 3) target[o + 3] = source.getW(i);
  }
}

/** Adapts the Blender materials to the game's render pipeline (ACES, bloom threshold 0.82). */
function tuneMaterials(materials: THREE.Material[]): void {
  for (const material of materials) {
    // Every part is a closed, solidified shell: back faces are never visible.
    material.side = THREE.FrontSide;
    const standard = material as THREE.MeshStandardMaterial;
    switch (material.name) {
      case 'NX_EnergyCyan':
        standard.emissiveIntensity = CHARACTER.ENERGY_CYAN_BASE;
        break;
      case 'NX_EnergyBlue':
        standard.emissiveIntensity = CHARACTER.ENERGY_BLUE;
        break;
      case 'NX_EnergyViolet':
        standard.emissiveIntensity = CHARACTER.ENERGY_VIOLET;
        break;
      default:
        standard.envMapIntensity = CHARACTER.ENV_MAP_INTENSITY;
        break;
    }
  }
}
