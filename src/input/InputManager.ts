import * as THREE from 'three';
import { KeyboardMouseInput } from './KeyboardMouseInput';
import type { TouchInput } from './TouchInput';

export type InputMode = 'pointer' | 'touch';

/**
 * Platform-independent input layer. Gameplay reads actions (MOVE, LOOK, JUMP, PAUSE) from here
 * only; the keyboard/mouse source and the touch source both feed the same reads, so there is one
 * movement, camera and jump path for every platform.
 *
 * `mode` tracks what the player is actually using: it starts from the device's primary pointer
 * and follows the last pointer type seen, so a touch laptop gets controls when touched and loses
 * them again when the mouse is picked up. Pointer lock is only ever requested for mouse play.
 */
export class InputManager {
  readonly keyboard: KeyboardMouseInput;
  private touch: TouchInput | null = null;
  private modeValue: InputMode = 'pointer';
  private readonly touchLook = new THREE.Vector2();
  private readonly modeListeners = new Set<(mode: InputMode) => void>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    initialMode: InputMode = 'pointer',
  ) {
    this.keyboard = new KeyboardMouseInput(canvas);
    this.modeValue = initialMode;
    canvas.addEventListener('pointerdown', this.onCanvasPointer);
  }

  private readonly onCanvasPointer = (event: PointerEvent): void => {
    this.setMode(event.pointerType === 'mouse' ? 'pointer' : 'touch');
  };

  attachTouch(touch: TouchInput): void {
    this.touch = touch;
  }

  get mode(): InputMode {
    return this.modeValue;
  }

  get isTouch(): boolean {
    return this.modeValue === 'touch';
  }

  setMode(mode: InputMode): void {
    if (this.modeValue === mode) return;
    this.modeValue = mode;
    if (mode === 'touch') this.keyboard.releaseLock();
    else this.touch?.releaseAll();
    for (const listener of this.modeListeners) listener(mode);
  }

  onModeChange(listener: (mode: InputMode) => void): () => void {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  // ---------------------------------------------------------------------------------------------
  // Pointer lock (mouse only)
  // ---------------------------------------------------------------------------------------------

  /** True when the current mode plays with a locked mouse cursor. */
  get needsPointerLock(): boolean {
    return this.modeValue === 'pointer';
  }

  get isLocked(): boolean {
    return this.keyboard.isLocked;
  }

  requestLock(): void {
    if (this.modeValue === 'touch') return;
    this.keyboard.requestLock();
  }

  releaseLock(): void {
    this.keyboard.releaseLock();
  }

  // ---------------------------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------------------------

  /** MOVE: keyboard digital vector plus joystick analog vector, clamped to unit length. */
  readMovement(target: THREE.Vector2): THREE.Vector2 {
    this.keyboard.readMovement(target);
    if (this.touch) {
      target.add(this.touch.movement);
      if (target.lengthSq() > 1) target.normalize();
    }
    return target;
  }

  /** LOOK: mouse / arrow keys plus touch drag, in radians. */
  consumeLook(target: THREE.Vector2, delta: number, sensitivity: number): THREE.Vector2 {
    this.keyboard.consumeLook(target, delta, sensitivity);
    if (this.touch) target.add(this.touch.consumeLook(this.touchLook, delta));
    return target;
  }

  /** JUMP: edge-triggered press from either source. */
  consumeJump(): boolean {
    const keyboard = this.keyboard.consumeJump();
    const touch = this.touch?.consumeJump() ?? false;
    return keyboard || touch;
  }

  get jumpHeld(): boolean {
    return this.keyboard.jumpHeld || (this.touch?.jumpHeld ?? false);
  }

  /** PAUSE: Escape, pointer-lock loss, or the touch pause button. */
  consumePause(): boolean {
    const keyboard = this.keyboard.consumePause();
    const touch = this.touch?.consumePause() ?? false;
    return keyboard || touch;
  }

  /** ATTACK: edge-triggered press from mouse/keyboard. */
  consumeAttack(): boolean {
    return this.keyboard.consumeAttack();
  }

  /** SHIELD: held state from mouse/keyboard. */
  get isShieldHeld(): boolean {
    return this.keyboard.shieldHeld;
  }

  /** REBOOT: edge-triggered press from keyboard. */
  consumeReboot(): boolean {
    return this.keyboard.consumeReboot();
  }

  isDown(code: string): boolean {
    return this.keyboard.isDown(code);
  }

  /** True while the player is actively dragging the look zone. */
  get isTouchLooking(): boolean {
    return this.touch?.isLooking ?? false;
  }

  clearTransient(): void {
    this.keyboard.clearTransient();
    this.touch?.clearTransient();
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointer);
    this.keyboard.dispose();
    this.touch?.dispose();
    this.touch = null;
    this.modeListeners.clear();
  }
}
