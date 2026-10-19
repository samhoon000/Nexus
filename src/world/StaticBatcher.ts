import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Merges static meshes that share a material into one mesh per material. Platform shells, decks,
 * clamps and set dressing collapse from hundreds of draw calls to a handful. Meshes keep their
 * world transform; the originals are removed from the scene graph.
 */
export class StaticBatcher {
  private readonly buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly shadowFlags = new Map<THREE.Material, { cast: boolean; receive: boolean }>();
  private readonly merged: THREE.Mesh[] = [];
  private readonly scratch = new THREE.Matrix4();

  /** Queue every mesh under `root` (optionally filtered) and detach it. */
  collect(root: THREE.Object3D, filter: (mesh: THREE.Mesh) => boolean = () => true): void {
    root.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material) && !(mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh && filter(mesh)) {
        meshes.push(mesh);
      }
    });
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone();
      // Drop attributes that differ between primitive types so merging never fails.
      for (const name of Object.keys(geometry.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
      }
      if (!geometry.attributes.uv) {
        const count = geometry.attributes.position.count;
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      this.scratch.copy(mesh.matrixWorld);
      geometry.applyMatrix4(this.scratch);
      const material = mesh.material as THREE.Material;
      const bucket = this.buckets.get(material) ?? [];
      bucket.push(geometry);
      this.buckets.set(material, bucket);
      const flags = this.shadowFlags.get(material) ?? { cast: false, receive: false };
      flags.cast = flags.cast || mesh.castShadow;
      flags.receive = flags.receive || mesh.receiveShadow;
      this.shadowFlags.set(material, flags);
      mesh.removeFromParent();
    }
  }

  /** Build the merged meshes into `target`. Returns the number of draw calls produced. */
  build(target: THREE.Object3D): number {
    for (const [material, geometries] of this.buckets) {
      if (geometries.length === 0) continue;
      const indexed = geometries.every((g) => g.index !== null);
      const prepared = indexed ? geometries : geometries.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(prepared, false);
      if (!merged) continue;
      for (const g of geometries) g.dispose();
      const mesh = new THREE.Mesh(merged, material);
      const flags = this.shadowFlags.get(material);
      mesh.castShadow = flags?.cast ?? false;
      mesh.receiveShadow = flags?.receive ?? false;
      mesh.name = 'static-batch';
      // Large merged bounds would be culled too eagerly if they were stale.
      merged.computeBoundingSphere();
      target.add(mesh);
      this.merged.push(mesh);
    }
    this.buckets.clear();
    return this.merged.length;
  }

  dispose(): void {
    for (const mesh of this.merged) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.merged.length = 0;
  }
}
