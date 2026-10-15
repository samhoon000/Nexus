import * as THREE from 'three';

/**
 * Keyboard + mouse input abstracted into intents. Pointer lock is requested on the canvas while
 * playing; arrow keys rotate the camera as a no-mouse fallback (also used by automated tests).
 */
export class KeyboardMouseInput {
  private readonly keys = new Set<string>();
  private readonly keyVector = new THREE.Vector2();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private jumpQueued = false;
  private jumpHeldFlag = false;
  private pauseQueued = false;
  private locked = false;
  /** Set when the browser exits pointer lock without us asking (Escape key). */
  private lockLostQueued = false;
  private lockWanted = false;
  /** Keyboard camera rotation rate in rad/s. */
  readonly keyLookRate = 2.2;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      return;
    }
    this.keys.add(event.code);
    if (event.code === 'Space') {
      this.jumpQueued = true;
      this.jumpHeldFlag = true;
    }
    if (event.code === 'Escape') this.pauseQueued = true;
    if (GAME_KEYS.has(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    if (event.code === 'Space') this.jumpHeldFlag = false;
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.jumpHeldFlag = false;
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseDeltaX += event.movementX;
    this.mouseDeltaY += event.movementY;
  };

  private readonly onLockChange = (): void => {
    const nowLocked = document.pointerLockElement === this.canvas;
    if (this.locked && !nowLocked && this.lockWanted) this.lockLostQueued = true;
    this.locked = nowLocked;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  requestLock(): void {
    this.lockWanted = true;
    if (this.locked) return;
    try {
      const result = this.canvas.requestPointerLock({ unadjustedMovement: true } as PointerLockOptions);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => this.canvas.requestPointerLock());
      }
    } catch {
      try {
        this.canvas.requestPointerLock();
      } catch {
        // Pointer lock unavailable (automation / permissions). Keyboard look still works.
      }
    }
  }

  releaseLock(): void {
    this.lockWanted = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  readMovement(target: THREE.Vector2): THREE.Vector2 {
    this.keyVector.set(0, 0);
    if (this.keys.has('KeyA')) this.keyVector.x -= 1;
    if (this.keys.has('KeyD')) this.keyVector.x += 1;
    if (this.keys.has('KeyW')) this.keyVector.y += 1;
    if (this.keys.has('KeyS')) this.keyVector.y -= 1;
    target.copy(this.keyVector);
    if (target.lengthSq() > 1) target.normalize();
    return target;
  }

  /** Consumes the accumulated mouse delta plus keyboard look, in radians-per-pixel units. */
  consumeLook(target: THREE.Vector2, delta: number, sensitivity: number): THREE.Vector2 {
    target.set(this.mouseDeltaX * sensitivity, this.mouseDeltaY * sensitivity);
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    if (this.keys.has('ArrowLeft')) target.x -= this.keyLookRate * delta;
    if (this.keys.has('ArrowRight')) target.x += this.keyLookRate * delta;
    if (this.keys.has('ArrowUp')) target.y -= this.keyLookRate * delta;
    if (this.keys.has('ArrowDown')) target.y += this.keyLookRate * delta;
    return target;
  }

  /** Edge-triggered jump press (consumed on read). */
  consumeJump(): boolean {
    const pressed = this.jumpQueued;
    this.jumpQueued = false;
    return pressed;
  }

  get jumpHeld(): boolean {
    return this.jumpHeldFlag;
  }

  consumePause(): boolean {
    const pressed = this.pauseQueued || this.lockLostQueued;
    this.pauseQueued = false;
    this.lockLostQueued = false;
    return pressed;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  clearTransient(): void {
    this.jumpQueued = false;
    this.pauseQueued = false;
    this.lockLostQueued = false;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.releaseLock();
  }
}

const GAME_KEYS = new Set([
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
