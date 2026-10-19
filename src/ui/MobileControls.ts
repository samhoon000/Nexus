import { TouchInput } from '../input/TouchInput';
import type { InputManager } from '../input/InputManager';
import { TOUCH } from '../utils/Constants';
import { query, setVisible } from '../utils/dom';

/**
 * On-screen touch controls: floating joystick (left), look zone (right), jump and pause buttons.
 * Owns the DOM and its press feedback; the intents themselves come from `TouchInput`, which the
 * `InputManager` reads like any other source. Shown only while playing in touch mode.
 */
export class MobileControls {
  readonly touch: TouchInput;
  private readonly root = query('#touch-controls');
  private readonly moveZone = query('#touch-move');
  private readonly joyBase = query('#touch-joy-base');
  private readonly joyKnob = query('#touch-joy-knob');
  private readonly lookZone = query('#touch-look');
  private readonly jump = query<HTMLButtonElement>('#touch-jump');
  private readonly pause = query<HTMLButtonElement>('#touch-pause');
  private visible = false;
  private hapticsEnabled = true;
  private knobX = 0;
  private knobY = 0;
  private baseShown = false;
  private doubleReady = true;

  constructor(private readonly input: InputManager) {
    this.touch = new TouchInput(
      { move: this.moveZone, look: this.lookZone, jump: this.jump, pause: this.pause },
      {
        onTouchUsed: () => input.setMode('touch'),
        onMouseUsed: () => {
          input.setMode('pointer');
          input.requestLock();
        },
        onJumpPressed: () => this.pulse(TOUCH.HAPTIC_TAP),
        onPausePressed: () => this.pulse(TOUCH.HAPTIC_TAP),
      },
    );
    input.attachTouch(this.touch);
    // Pressed visuals follow pointer capture so a thumb sliding off the button still reads as held.
    for (const button of [this.jump, this.pause]) {
      button.addEventListener('pointerdown', () => button.classList.add('is-pressed'));
      const release = (): void => button.classList.remove('is-pressed');
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    }
    this.joyBase.style.setProperty('--joy-radius', `${TOUCH.JOYSTICK_RADIUS}px`);
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    setVisible(this.root, visible);
    if (!visible) this.touch.releaseAll();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setHaptics(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  /** Short vibration when the platform supports it and the player wants it. */
  pulse(ms: number): void {
    if (!this.hapticsEnabled || !this.input.isTouch) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // Vibration blocked (no gesture yet / unsupported). Purely cosmetic.
    }
  }

  /** Jump button ring lights up while a double jump is still available. */
  setDoubleJumpAvailable(available: boolean): void {
    if (this.doubleReady === available) return;
    this.doubleReady = available;
    this.jump.classList.toggle('is-double-ready', available);
  }

  /** Per-frame: positions the floating joystick base and knob. */
  update(): void {
    if (!this.visible) return;
    const joy = this.touch.joystick;
    if (joy.active !== this.baseShown) {
      this.baseShown = joy.active;
      this.joyBase.classList.toggle('is-active', joy.active);
      if (joy.active) {
        this.joyBase.style.left = `${joy.origin.x}px`;
        this.joyBase.style.top = `${joy.origin.y}px`;
      }
    }
    if (joy.knobOffset.x !== this.knobX || joy.knobOffset.y !== this.knobY) {
      this.knobX = joy.knobOffset.x;
      this.knobY = joy.knobOffset.y;
      this.joyKnob.style.transform = `translate(${this.knobX.toFixed(1)}px, ${this.knobY.toFixed(1)}px)`;
    }
  }

  dispose(): void {
    this.touch.dispose();
  }
}
