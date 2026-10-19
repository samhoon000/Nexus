import { SAVE_KEY, STAGE_COUNT } from '../utils/Constants';

export interface Settings {
  sensitivity: number;
  invertY: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  bloom: boolean;
  /** 'auto' resolves from device detection; tiers are defined in Constants.QUALITY. */
  quality: 'auto' | 'high' | 'medium' | 'low';
  /** Vibration on touch controls and key events (touch devices only). */
  haptics: boolean;
}

export interface SaveData {
  version: 1;
  highestUnlocked: number;
  completed: number[];
  bestTimes: Record<number, number>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  invertY: false,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  bloom: true,
  quality: 'auto',
  haptics: true,
};

const defaultSave = (): SaveData => ({
  version: 1,
  highestUnlocked: 1,
  completed: [],
  bestTimes: {},
  settings: { ...DEFAULT_SETTINGS },
});

/** localStorage persistence with a schema version; fails gracefully when storage is blocked. */
export class SaveSystem {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.version !== 1) return defaultSave();
      const base = defaultSave();
      return {
        version: 1,
        highestUnlocked: clampStage(parsed.highestUnlocked ?? 1),
        completed: Array.isArray(parsed.completed) ? parsed.completed.filter((n) => Number.isInteger(n)) : [],
        bestTimes: parsed.bestTimes && typeof parsed.bestTimes === 'object' ? parsed.bestTimes : {},
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
      };
    } catch {
      return defaultSave();
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage blocked (private mode / quota). The game still works for the session.
    }
  }

  get settings(): Settings {
    return this.data.settings;
  }

  updateSettings(patch: Partial<Settings>): void {
    Object.assign(this.data.settings, patch);
    this.save();
  }

  isUnlocked(stage: number): boolean {
    return stage <= this.data.highestUnlocked;
  }

  recordStageComplete(stage: number, time: number): void {
    if (!this.data.completed.includes(stage)) this.data.completed.push(stage);
    const best = this.data.bestTimes[stage];
    if (best === undefined || time < best) this.data.bestTimes[stage] = time;
    this.data.highestUnlocked = clampStage(Math.max(this.data.highestUnlocked, stage + 1));
    this.save();
  }

  reset(): void {
    const settings = { ...this.data.settings };
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }
}

const clampStage = (stage: number): number => Math.min(STAGE_COUNT, Math.max(1, Math.floor(stage)));
