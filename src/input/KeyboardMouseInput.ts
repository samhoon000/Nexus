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
  private attackQueued = false;
  private shieldHeldFlag = false;
  private rebootQueued = false;
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
    if (event.code === 'KeyF') this.attackQueued = true;
    if (event.code === 'KeyE') this.rebootQueued = true;
    if (event.code === 'KeyQ') this.shieldHeldFlag = true;
    if (event.code === 'Escape') this.pauseQueued = true;
    if (GAME_KEYS.has(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    if (event.code === 'Space') this.jumpHeldFlag = false;
    if (event.code === 'KeyQ') this.shieldHeldFlag = false;
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.jumpHeldFlag = false;
    this.shieldHeldFlag = false;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.attackQueued = true;
    } else if (event.button === 2) {
      this.shieldHeldFlag = true;
      event.preventDefault();
    }
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) {
      this.shieldHeldFlag = false;
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
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
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('contextmenu', this.onContextMenu);
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

  /** Edge-triggered attack press (Left Click or F key). */
  consumeAttack(): boolean {
    const pressed = this.attackQueued;
    this.attackQueued = false;
    return pressed;
  }

  /** Shield held status (Right Click or Q key). */
  get shieldHeld(): boolean {
    return this.shieldHeldFlag;
  }

  /** Edge-triggered reboot press (E key). */
  consumeReboot(): boolean {
    const pressed = this.rebootQueued;
    this.rebootQueued = false;
    return pressed;
  }

  clearTransient(): void {
    this.jumpQueued = false;
    this.attackQueued = false;
    this.rebootQueued = false;
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
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('contextmenu', this.onContextMenu);
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
  'KeyE',
  'KeyF',
  'KeyQ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
