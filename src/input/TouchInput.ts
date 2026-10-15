import * as THREE from 'three';
import { TOUCH } from '../utils/Constants';
import { VirtualJoystick } from './VirtualJoystick';

export interface TouchZones {
  /** Left zone: floating joystick. */
  move: HTMLElement;
  /** Right zone: drag to look. */
  look: HTMLElement;
  jump: HTMLElement;
  pause: HTMLElement;
}

export interface TouchInputEvents {
  /** A touch pointer started on any control (used to switch the UI into touch mode). */
  onTouchUsed?: () => void;
  /** A mouse pointer landed on a zone (hybrid devices: hand it to pointer lock). */
  onMouseUsed?: () => void;
  onJumpPressed?: () => void;
  onPausePressed?: () => void;
}

/**
 * Pointer-event handling for the touch control zones. Produces the same intents as the keyboard:
 * an analog MOVE vector, a LOOK delta in pixels, an edge-triggered JUMP with a held flag, and
 * PAUSE. Every pointer is tracked by id so multi-touch (move + look + jump at once) works and a
 * missed release can never leave a control stuck down.
 */
export class TouchInput {
  readonly joystick = new VirtualJoystick();
  private lookPointer: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private lookPendingX = 0;
  private lookPendingY = 0;
  private jumpPointer: number | null = null;
  private jumpQueued = false;
  private jumpHeldFlag = false;
  private pauseQueued = false;
  private readonly listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions?]> = [];

  constructor(
    private readonly zones: TouchZones,
    private readonly events: TouchInputEvents = {},
  ) {
    this.bindMove();
    this.bindLook();
    this.bindButton(zones.jump, 'jump');
    this.bindButton(zones.pause, 'pause');
    const release = (): void => this.releaseAll();
    this.listen(window, 'blur', release);
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    // Long-press callouts and pinch gestures must never reach the page under the controls.
    for (const zone of [zones.move, zones.look, zones.jump, zones.pause]) {
      this.listen(zone, 'contextmenu', (event) => event.preventDefault());
      this.listen(zone, 'touchstart', (event) => event.preventDefault(), { passive: false });
    }
  }

  // ---------------------------------------------------------------------------------------------

  private listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.listeners.push([target, type, handler, options]);
  }

  private acceptPointer(event: PointerEvent): boolean {
    if (event.pointerType === 'mouse') {
      this.events.onMouseUsed?.();
      return false;
    }
    this.events.onTouchUsed?.();
    return true;
  }

  private bindMove(): void {
    const zone = this.zones.move;
    this.listen(zone, 'pointerdown', (e) => {
      const event = e as PointerEvent;
      if (!this.acceptPointer(event) || this.joystick.active) return;
      event.preventDefault();
      const rect = zone.getBoundingClientRect();
      capture(zone, event.pointerId);
      this.joystick.begin(event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
    });
    this.listen(zone, 'pointermove', (e) => {
      const event = e as PointerEvent;
      if (event.pointerId !== this.joystick.pointerId) return;
      const rect = zone.getBoundingClientRect();
      this.joystick.move(event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
    });
    const end = (e: Event): void => this.joystick.end((e as PointerEvent).pointerId);
    this.listen(zone, 'pointerup', end);
    this.listen(zone, 'pointercancel', end);
    this.listen(zone, 'lostpointercapture', end);
  }

  private bindLook(): void {
    const zone = this.zones.look;
    this.listen(zone, 'pointerdown', (e) => {
      const event = e as PointerEvent;
      if (!this.acceptPointer(event) || this.lookPointer !== null) return;
      event.preventDefault();
      capture(zone, event.pointerId);
      this.lookPointer = event.pointerId;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
    });
    this.listen(zone, 'pointermove', (e) => {
      const event = e as PointerEvent;
      if (event.pointerId !== this.lookPointer) return;
      this.lookPendingX += event.clientX - this.lookLastX;
      this.lookPendingY += event.clientY - this.lookLastY;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
    });
    const end = (e: Event): void => {
      if ((e as PointerEvent).pointerId === this.lookPointer) this.lookPointer = null;
    };
    this.listen(zone, 'pointerup', end);
    this.listen(zone, 'pointercancel', end);
    this.listen(zone, 'lostpointercapture', end);
  }

  private bindButton(button: HTMLElement, action: 'jump' | 'pause'): void {
    this.listen(button, 'pointerdown', (e) => {
      const event = e as PointerEvent;
      // Buttons accept any pointer type: a hybrid user can tap them with a mouse too.
      if (event.pointerType !== 'mouse') this.events.onTouchUsed?.();
      event.preventDefault();
      if (action === 'pause') {
        this.pauseQueued = true;
        this.events.onPausePressed?.();
        return;
      }
      if (this.jumpPointer !== null) return;
      capture(button, event.pointerId);
      this.jumpPointer = event.pointerId;
      this.jumpQueued = true;
      this.jumpHeldFlag = true;
      this.events.onJumpPressed?.();
    });
    if (action !== 'jump') return;
    const end = (e: Event): void => {
      if ((e as PointerEvent).pointerId !== this.jumpPointer) return;
      this.jumpPointer = null;
      this.jumpHeldFlag = false;
    };
    this.listen(button, 'pointerup', end);
    this.listen(button, 'pointercancel', end);
    this.listen(button, 'lostpointercapture', end);
  }

  // ---------------------------------------------------------------------------------------------
  // Intent reads
  // ---------------------------------------------------------------------------------------------

  /** Analog movement (x = right, y = forward), length ≤ 1. */
  get movement(): THREE.Vector2 {
    return this.joystick.value;
  }

  get isLooking(): boolean {
    return this.lookPointer !== null;
  }

  /**
   * Drains the smoothed look delta (pixels) into `target`. A short exponential release keeps
   * touch look fluid at low frame rates without adding noticeable lag.
   */
  consumeLook(target: THREE.Vector2, delta: number): THREE.Vector2 {
    const k = TOUCH.LOOK_SMOOTHING > 0 ? 1 - Math.exp(-delta / TOUCH.LOOK_SMOOTHING) : 1;
    const dx = this.lookPendingX * k;
    const dy = this.lookPendingY * k;
    this.lookPendingX -= dx;
    this.lookPendingY -= dy;
    if (Math.abs(this.lookPendingX) < 0.01) this.lookPendingX = 0;
    if (Math.abs(this.lookPendingY) < 0.01) this.lookPendingY = 0;
    return target.set(dx * TOUCH.LOOK_SENSITIVITY, dy * TOUCH.LOOK_SENSITIVITY);
  }

  consumeJump(): boolean {
    const pressed = this.jumpQueued;
    this.jumpQueued = false;
    return pressed;
  }

  get jumpHeld(): boolean {
    return this.jumpHeldFlag;
  }

  consumePause(): boolean {
    const pressed = this.pauseQueued;
    this.pauseQueued = false;
    return pressed;
  }

  clearTransient(): void {
    this.jumpQueued = false;
    this.pauseQueued = false;
    this.lookPendingX = 0;
    this.lookPendingY = 0;
  }

  /** Drops every active pointer (blur, hidden tab, state change). */
  releaseAll(): void {
    this.joystick.reset();
    this.lookPointer = null;
    this.jumpPointer = null;
    this.jumpHeldFlag = false;
    this.clearTransient();
  }

  dispose(): void {
    for (const [target, type, handler, options] of this.listeners) target.removeEventListener(type, handler, options);
    this.listeners.length = 0;
    this.releaseAll();
  }
}

/** Pointer capture keeps a sliding thumb bound to its control; it throws when the pointer is already gone. */
function capture(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // No active pointer (synthetic event or already released): the control still works by id.
  }
}
