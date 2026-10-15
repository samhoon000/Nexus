import * as THREE from 'three';
import type { PlayerModelParts } from './PlayerModel';
import { easeOutBack, type TweenManager } from '../effects/Tween';
import { damp } from '../utils/MathUtils';
import { PLAYER } from '../utils/Constants';

/**
 * Procedural animation on the robot: hover bob, lean, squash/stretch, thruster and core pulses.
 * Driven by the real frame delta so it stays alive during hitstop.
 */
export class PlayerAnimation {
  private lean = new THREE.Vector2();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private hoverPhase = 0;
  private thrusterLevel = 1;
  private visorPulse = 0;
  private coreLevel = 0;

  constructor(
    private readonly parts: PlayerModelParts,
    private readonly tweens: TweenManager,
  ) {}

  update(
    delta: number,
    elapsed: number,
    options: {
      grounded: boolean;
      verticalSpeed: number;
      tangentSpeed: number;
      inputMagnitude: number;
      facingLocal: THREE.Vector2;
      energyRatio: number;
      reducedMotion: boolean;
    },
  ): void {
    const { body, head, thrusterRing, thrusterGlow, visor, core, coreGlow, antennaTip, contactShadow } = this.parts;

    // Hover bob while idle on the ground; damped while moving/jumping.
    if (!options.reducedMotion) this.hoverPhase += delta * 2.4;
    const idle = options.grounded ? 1 - Math.min(1, options.tangentSpeed / PLAYER.SPEED) : 0;
    const bob = Math.sin(this.hoverPhase) * 0.035 * idle;

    // Lean into movement direction (local x/z), and pitch with vertical velocity in the air.
    const targetLeanX = options.facingLocal.y * Math.min(1, options.tangentSpeed / PLAYER.SPEED) * 0.22;
    const targetLeanZ = -options.facingLocal.x * Math.min(1, options.tangentSpeed / PLAYER.SPEED) * 0.18;
    this.lean.x = damp(this.lean.x, targetLeanX, 0.12, delta);
    this.lean.y = damp(this.lean.y, targetLeanZ, 0.12, delta);
    const airPitch = options.grounded ? 0 : THREE.MathUtils.clamp(-options.verticalSpeed * 0.012, -0.25, 0.2);

    body.rotation.set(this.lean.x + airPitch, 0, this.lean.y);
    body.position.y = bob;
    body.scale.copy(this.scale);

    // Head looks slightly ahead / up when jumping.
    head.rotation.x = damp(head.rotation.x, options.grounded ? 0 : -0.18, 0.15, delta);

    // Thruster: brighter when airborne or moving fast.
    const thrusterTarget = options.grounded ? 0.8 + options.inputMagnitude * 0.6 : 1.9;
    this.thrusterLevel = damp(this.thrusterLevel, thrusterTarget, 0.1, delta);
    thrusterRing.material.emissiveIntensity = this.thrusterLevel;
    (thrusterGlow.material as THREE.SpriteMaterial).opacity = 0.25 + this.thrusterLevel * 0.22;
    thrusterGlow.scale.setScalar(0.5 + this.thrusterLevel * 0.18);

    // Core brightens with collected energy; subtle breathing pulse.
    this.coreLevel = damp(this.coreLevel, options.energyRatio, 0.5, delta);
    const pulse = options.reducedMotion ? 0 : Math.sin(elapsed * 3.2) * 0.25;
    core.material.emissiveIntensity = 1.6 + this.coreLevel * 2.2 + pulse;
    (coreGlow.material as THREE.SpriteMaterial).opacity = 0.45 + this.coreLevel * 0.35 + pulse * 0.1;
    coreGlow.scale.setScalar(0.5 + this.coreLevel * 0.3);
    antennaTip.material.emissiveIntensity = core.material.emissiveIntensity;

    // Visor flash after a double jump.
    this.visorPulse = Math.max(0, this.visorPulse - delta * 3);
    visor.material.emissiveIntensity = 1.4 + this.visorPulse * 3;

    // Contact shadow fades with height above ground (approximated by air time).
    const shadowOpacity = options.grounded ? 0.9 : 0.35;
    const material = contactShadow.material as THREE.MeshBasicMaterial;
    material.opacity = damp(material.opacity, shadowOpacity, 0.1, delta);
  }

  jump(double: boolean): void {
    this.squash(1.18, 0.22);
    if (double) this.visorPulse = 1;
  }

  land(impact: number): void {
    const amount = THREE.MathUtils.clamp(0.9 - impact * 0.012, 0.72, 0.92);
    this.squash(amount, 0.2);
  }

  /** Volume-preserving squash (y < 1) or stretch (y > 1) that settles with overshoot. */
  private squash(scaleY: number, duration: number): void {
    const startXZ = 1 / Math.sqrt(scaleY);
    this.tweens.tween(
      duration,
      (t) => {
        const y = scaleY + (1 - scaleY) * t;
        const xz = startXZ + (1 - startXZ) * t;
        this.scale.set(xz, y, xz);
      },
      easeOutBack,
      () => this.scale.set(1, 1, 1),
    );
  }

  stabilize(): void {
    this.hoverPhase = 0;
    this.scale.set(1, 1, 1);
    this.lean.set(0, 0);
  }
}
