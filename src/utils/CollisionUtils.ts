import * as THREE from 'three';

/**
 * Oriented bounding box backed by a Three.js object's world matrix.
 * `halfExtents` are in the object's local space; `refresh()` pulls the current transform.
 */
export class OBB {
  readonly halfExtents = new THREE.Vector3();
  readonly matrix = new THREE.Matrix4();
  readonly inverse = new THREE.Matrix4();
  readonly center = new THREE.Vector3();
  /** Bounding-sphere radius for a cheap broadphase reject. */
  radius = 0;

  constructor(halfExtents: THREE.Vector3 | [number, number, number]) {
    if (Array.isArray(halfExtents)) this.halfExtents.set(...halfExtents);
    else this.halfExtents.copy(halfExtents);
    this.radius = this.halfExtents.length();
  }

  setHalfExtents(x: number, y: number, z: number): void {
    this.halfExtents.set(x, y, z);
    this.radius = this.halfExtents.length();
  }

  refresh(object: THREE.Object3D): void {
    this.matrix.copy(object.matrixWorld);
    this.inverse.copy(this.matrix).invert();
    this.center.setFromMatrixPosition(this.matrix);
  }

  containsPoint(point: THREE.Vector3): boolean {
    scratchLocal.copy(point).applyMatrix4(this.inverse);
    const h = this.halfExtents;
    return (
      Math.abs(scratchLocal.x) <= h.x &&
      Math.abs(scratchLocal.y) <= h.y &&
      Math.abs(scratchLocal.z) <= h.z
    );
  }
}

export interface SphereContact {
  /** World-space push-out vector (normal * penetration depth). */
  push: THREE.Vector3;
  normal: THREE.Vector3;
  depth: number;
}

const scratchLocal = new THREE.Vector3();
const scratchClosest = new THREE.Vector3();
const scratchDelta = new THREE.Vector3();
const scratchNormalMatrix = new THREE.Matrix3();

/**
 * Sphere vs OBB. Writes the contact into `out` and returns true when penetrating.
 * Handles the "centre inside the box" case by pushing along the axis of least penetration.
 */
export function sphereVsOBB(
  center: THREE.Vector3,
  radius: number,
  box: OBB,
  out: SphereContact,
): boolean {
  // Broadphase.
  scratchDelta.subVectors(center, box.center);
  const reach = radius + box.radius;
  if (scratchDelta.lengthSq() > reach * reach) return false;

  scratchLocal.copy(center).applyMatrix4(box.inverse);
  const h = box.halfExtents;
  scratchClosest.set(
    Math.max(-h.x, Math.min(h.x, scratchLocal.x)),
    Math.max(-h.y, Math.min(h.y, scratchLocal.y)),
    Math.max(-h.z, Math.min(h.z, scratchLocal.z)),
  );
  scratchDelta.subVectors(scratchLocal, scratchClosest);
  const distSq = scratchDelta.lengthSq();

  if (distSq > radius * radius) return false;

  if (distSq > 1e-10) {
    const dist = Math.sqrt(distSq);
    out.depth = radius - dist;
    scratchDelta.multiplyScalar(1 / dist);
  } else {
    // Centre is inside the box: find the face with the least penetration.
    const dx = h.x - Math.abs(scratchLocal.x);
    const dy = h.y - Math.abs(scratchLocal.y);
    const dz = h.z - Math.abs(scratchLocal.z);
    if (dy <= dx && dy <= dz) {
      scratchDelta.set(0, Math.sign(scratchLocal.y) || 1, 0);
      out.depth = dy + radius;
    } else if (dx <= dz) {
      scratchDelta.set(Math.sign(scratchLocal.x) || 1, 0, 0);
      out.depth = dx + radius;
    } else {
      scratchDelta.set(0, 0, Math.sign(scratchLocal.z) || 1);
      out.depth = dz + radius;
    }
  }

  scratchNormalMatrix.setFromMatrix4(box.matrix);
  out.normal.copy(scratchDelta).applyMatrix3(scratchNormalMatrix).normalize();
  out.push.copy(out.normal).multiplyScalar(out.depth);
  return true;
}

/**
 * Ray vs OBB (slab test). Returns the distance along the ray or -1 when missed.
 */
export function rayVsOBB(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  box: OBB,
  maxDistance: number,
): number {
  scratchLocal.copy(origin).applyMatrix4(box.inverse);
  scratchDelta.copy(direction).transformDirection(box.inverse);
  // transformDirection normalises; the inverse of a rigid transform keeps lengths so this is fine.
  let tMin = 0;
  let tMax = maxDistance;
  const h = box.halfExtents;
  const o = [scratchLocal.x, scratchLocal.y, scratchLocal.z];
  const d = [scratchDelta.x, scratchDelta.y, scratchDelta.z];
  const e = [h.x, h.y, h.z];
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(d[i]) < 1e-8) {
      if (Math.abs(o[i]) > e[i]) return -1;
      continue;
    }
    const inv = 1 / d[i];
    let t1 = (-e[i] - o[i]) * inv;
    let t2 = (e[i] - o[i]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }
  return tMin;
}

export const createContact = (): SphereContact => ({
  push: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  depth: 0,
});
