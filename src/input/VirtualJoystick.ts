import * as THREE from 'three';
import { TOUCH } from '../utils/Constants';

/**
 * Floating analog joystick model. The base appears where the thumb lands; the knob follows the
 * thumb within `radius`, with a dead zone and a response curve. Pure logic: the owning UI positions
 * the DOM from `origin` / `knobOffset`.
 */
export class VirtualJoystick {
  /** Normalised input: x = right, y = forward, length ≤ 1. */
  readonly value = new THREE.Vector2();
  /** Base centre in CSS pixels (relative to the zone element). */
  readonly origin = new THREE.Vector2();
  /** Knob offset from the base centre in CSS pixels. */
  readonly knobOffset = new THREE.Vector2();
  active = false;
  pointerId: number | null = null;

  constructor(
    readonly radius: number = TOUCH.JOYSTICK_RADIUS,
    private readonly deadZone: number = TOUCH.JOYSTICK_DEAD_ZONE,
    private readonly curve: number = TOUCH.JOYSTICK_CURVE,
  ) {}

  begin(pointerId: number, x: number, y: number): void {
    this.pointerId = pointerId;
    this.active = true;
    this.origin.set(x, y);
    this.knobOffset.set(0, 0);
    this.value.set(0, 0);
  }

  move(pointerId: number, x: number, y: number): void {
    if (!this.active || pointerId !== this.pointerId) return;
    const dx = x - this.origin.x;
    const dy = y - this.origin.y;
    const distance = Math.hypot(dx, dy);
    // Knob is clamped to the ring.
    const clamped = Math.min(distance, this.radius);
    if (distance > 1e-3) this.knobOffset.set((dx / distance) * clamped, (dy / distance) * clamped);
    else this.knobOffset.set(0, 0);
    // Dead zone, then remap the remaining travel to 0..1 through the response curve.
    const raw = clamped / this.radius;
    if (raw <= this.deadZone) {
      this.value.set(0, 0);
      return;
    }
    const magnitude = Math.pow((raw - this.deadZone) / (1 - this.deadZone), this.curve);
    // Screen y grows downward; forward is up on screen.
    this.value.set((dx / distance) * magnitude, (-dy / distance) * magnitude);
  }

  end(pointerId: number): void {
    if (pointerId !== this.pointerId) return;
    this.reset();
  }

  reset(): void {
    this.active = false;
    this.pointerId = null;
    this.value.set(0, 0);
    this.knobOffset.set(0, 0);
  }
}
