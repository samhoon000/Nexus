import * as THREE from 'three';
import type { PortalDef } from '../stages/StageTypes';
import type { StageContext } from '../stages/StageContext';
import { MECHANICS } from '../utils/Constants';
import { degToRad } from '../utils/MathUtils';
import { easeOutBack } from '../effects/Tween';

/**
 * Stage exit gate: a large ring with an inner holographic disc. Sealed until enough energy is
 * collected; once open, stepping through completes the stage.
 */
export class Portal {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  isOpen = false;
  private readonly ring: THREE.Mesh;
  private readonly innerRing: THREE.Mesh;
  private readonly disc: THREE.Mesh;
  private readonly ringMaterial: THREE.MeshStandardMaterial;
  private readonly discMaterial: THREE.MeshBasicMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly scratch = new THREE.Vector3();
  private pulse = 0;

  constructor(private readonly ctx: StageContext, def: PortalDef) {
    this.group.name = 'portal';
    const ringGeometry = new THREE.TorusGeometry(2.4, 0.22, 14, 64);
    const innerGeometry = new THREE.TorusGeometry(2.05, 0.06, 10, 64);
    const discGeometry = new THREE.CircleGeometry(1.88, 64);
    const baseGeometry = new THREE.BoxGeometry(6.4, 0.5, 1.6);
    const postGeometry = new THREE.BoxGeometry(0.5, 1.6, 0.5);
    this.geometries.push(ringGeometry, innerGeometry, discGeometry, baseGeometry, postGeometry);

    this.ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x10131c,
      emissive: ctx.theme.accent,
      emissiveIntensity: 0.25,
      metalness: 0.7,
      roughness: 0.35,
    });
    const discColor = new THREE.Color(ctx.theme.accent);
    if (ctx.theme.accent === 0xff2200) discColor.setHex(0xc71e32);
    this.discMaterial = new THREE.MeshBasicMaterial({
      color: discColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });

    this.ring = new THREE.Mesh(ringGeometry, ctx.materials.trim);
    this.ring.position.y = 2.9;
    this.ring.castShadow = true;
    this.innerRing = new THREE.Mesh(innerGeometry, this.ringMaterial);
    this.innerRing.position.y = 2.9;
    this.disc = new THREE.Mesh(discGeometry, this.discMaterial);
    this.disc.position.y = 2.9;
    this.disc.renderOrder = 1;
    const base = new THREE.Mesh(baseGeometry, ctx.materials.shellMid);
    base.position.y = 0.25;
    base.receiveShadow = true;
    const postL = new THREE.Mesh(postGeometry, ctx.materials.shellDark);
    postL.position.set(-2.7, 1.2, 0);
    const postR = postL.clone();
    postR.position.x = 2.7;
    this.group.add(this.ring, this.innerRing, this.disc, base, postL, postR);
    this.group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    this.group.rotation.y = degToRad(def.yaw ?? 0);
    this.position.copy(this.group.position);
    this.inverseRotation.copy(this.group.quaternion).invert();
    ctx.world.root.add(this.group);
  }

  private readonly inverseRotation = new THREE.Quaternion();

  setOpen(open: boolean): void {
    if (this.isOpen === open) return;
    this.isOpen = open;
    if (open) {
      this.ctx.tweens.tween(0.9, (t) => {
        this.ringMaterial.emissiveIntensity = 0.25 + t * 2.4;
        this.discMaterial.opacity = t * 0.3;
        this.disc.scale.setScalar(0.2 + 0.8 * t);
      }, easeOutBack);
      this.scratch.copy(this.position).y += 2.9;
      this.ctx.particles.burst({ position: this.scratch, count: 80, color: this.ctx.theme.accent, speed: 4.5, life: 1.2, size: 0.2 });
      this.ctx.bus.emit('portal:opened', { position: this.position });
    } else {
      this.ringMaterial.emissiveIntensity = 0.25;
      this.discMaterial.opacity = 0;
    }
  }

  /** True when the open portal was entered. */
  check(playerCenter: THREE.Vector3): boolean {
    if (!this.isOpen) return false;
    // Portal volume: a cylinder around the ring axis (local z), covering the ring's height.
    this.scratch.copy(playerCenter).sub(this.position);
    this.scratch.applyQuaternion(this.inverseRotation);
    const radial = Math.abs(this.scratch.x);
    return radial < MECHANICS.PORTAL_RADIUS && Math.abs(this.scratch.z) < 1.2 && this.scratch.y > -0.5 && this.scratch.y < 5.2;
  }

  update(elapsed: number): void {
    this.innerRing.rotation.z = elapsed * 0.4;
    this.ring.rotation.z = -elapsed * 0.1;
    if (this.isOpen) {
      this.pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2);
      this.ringMaterial.emissiveIntensity = 2.2 + this.pulse * 0.8;
      this.discMaterial.opacity = 0.28 + this.pulse * 0.025;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    this.ringMaterial.dispose();
    this.discMaterial.dispose();
  }
}
