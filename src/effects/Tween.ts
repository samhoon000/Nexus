export type Easing = (t: number) => number;

export const easeLinear: Easing = (t) => t;
export const easeInQuad: Easing = (t) => t * t;
export const easeOutQuad: Easing = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic: Easing = (t) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

interface ActiveTween {
  elapsed: number;
  delay: number;
  duration: number;
  easing: Easing;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
  cancelled: boolean;
}

export interface TweenHandle {
  cancel(): void;
}

/** Minimal tween manager driven by the real frame delta. */
export class TweenManager {
  private readonly tweens: ActiveTween[] = [];

  tween(
    durationSec: number,
    onUpdate: (value: number) => void,
    easing: Easing = easeOutCubic,
    onComplete?: () => void,
    delay = 0,
  ): TweenHandle {
    const entry: ActiveTween = {
      elapsed: 0,
      delay,
      duration: Math.max(0.0001, durationSec),
      easing,
      onUpdate,
      onComplete,
      cancelled: false,
    };
    this.tweens.push(entry);
    return { cancel: () => (entry.cancelled = true) };
  }

  /** Fire a callback after a delay (uses game-visible real time, not setTimeout). */
  after(delaySec: number, callback: () => void): TweenHandle {
    return this.tween(0.0001, () => undefined, easeLinear, callback, delaySec);
  }

  update(delta: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      const t = this.tweens[i];
      if (t.cancelled) {
        this.tweens.splice(i, 1);
        continue;
      }
      if (t.delay > 0) {
        t.delay -= delta;
        if (t.delay > 0) continue;
        t.elapsed += -t.delay;
        t.delay = 0;
      } else {
        t.elapsed += delta;
      }
      const k = Math.min(t.elapsed / t.duration, 1);
      t.onUpdate(t.easing(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        t.onComplete?.();
      }
    }
  }

  clear(): void {
    this.tweens.length = 0;
  }
}
