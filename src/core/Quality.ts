import { ADAPTIVE, QUALITY, type QualityProfile, type QualityTier } from '../utils/Constants';
import type { DeviceProfile } from './Device';

export type QualitySetting = QualityTier | 'auto';

/** Resolves the user's quality setting to a concrete tier. */
export function resolveTier(setting: QualitySetting, device: DeviceProfile): QualityTier {
  return setting === 'auto' ? device.tier : setting;
}

export function profileFor(tier: QualityTier): QualityProfile {
  return QUALITY[tier];
}

/**
 * Dynamic render-scale controller for AUTO quality. Watches the measured frame rate and steps the
 * render scale down when the GPU cannot keep up, then cautiously back up when it has headroom.
 * It only ever scales within [MIN_SCALE, 1] of the tier's resolution, so a manual tier is
 * deterministic and tests see a fixed DPR.
 */
export class AdaptiveResolution {
  scale = 1;
  private lowStreak = 0;
  private highStreak = 0;
  private enabled = false;

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.lowStreak = 0;
    this.highStreak = 0;
    if (!enabled) this.scale = 1;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Feed one half-second FPS sample. Returns true when the scale changed. */
  sample(fps: number, active: boolean): boolean {
    if (!this.enabled || !active || fps <= 0) {
      this.lowStreak = 0;
      this.highStreak = 0;
      return false;
    }
    if (fps < ADAPTIVE.FPS_LOW) {
      this.lowStreak += 1;
      this.highStreak = 0;
      if (this.lowStreak >= ADAPTIVE.SAMPLES_DOWN && this.scale > ADAPTIVE.MIN_SCALE) {
        this.scale = Math.max(ADAPTIVE.MIN_SCALE, this.scale - ADAPTIVE.STEP_DOWN);
        this.lowStreak = 0;
        return true;
      }
      return false;
    }
    this.lowStreak = 0;
    if (fps > ADAPTIVE.FPS_HIGH && this.scale < 1) {
      this.highStreak += 1;
      if (this.highStreak >= ADAPTIVE.SAMPLES_UP) {
        this.scale = Math.min(1, this.scale + ADAPTIVE.STEP_UP);
        this.highStreak = 0;
        return true;
      }
    } else {
      this.highStreak = 0;
    }
    return false;
  }
}
