import type { SaveSystem, Settings } from '../save/SaveSystem';
import { query, setVisible } from '../utils/dom';

interface SettingsActions {
  changed(key: keyof Settings, value: Settings[keyof Settings]): void;
  back(): void;
  resetProgress(): void;
  hover(): void;
  confirm(): void;
}

/** Settings UI bound to SaveSystem.settings. Every change persists immediately. */
export class SettingsPanel {
  private readonly root = query('#settings');
  private readonly sensitivity = query<HTMLInputElement>('#set-sensitivity');
  private readonly invert = query<HTMLInputElement>('#set-invert');
  private readonly master = query<HTMLInputElement>('#set-master');
  private readonly music = query<HTMLInputElement>('#set-music');
  private readonly sfx = query<HTMLInputElement>('#set-sfx');
  private readonly bloom = query<HTMLInputElement>('#set-bloom');
  private readonly quality = query('#set-quality');
  private readonly handlers: Array<[HTMLElement, string, EventListener]> = [];

  constructor(
    private readonly save: SaveSystem,
    private readonly actions: SettingsActions,
  ) {
    this.bindRange(this.sensitivity, 'sensitivity', '#out-sensitivity', (v) => v.toFixed(2));
    this.bindRange(this.master, 'masterVolume', '#out-master', (v) => `${Math.round(v * 100)}%`);
    this.bindRange(this.music, 'musicVolume', '#out-music', (v) => `${Math.round(v * 100)}%`);
    this.bindRange(this.sfx, 'sfxVolume', '#out-sfx', (v) => `${Math.round(v * 100)}%`);
    this.bindToggle(this.invert, 'invertY');
    this.bindToggle(this.bloom, 'bloom');
    for (const button of this.quality.querySelectorAll<HTMLButtonElement>('button')) {
      this.listen(button, 'click', () => {
        const value = button.dataset.value as Settings['quality'];
        this.save.updateSettings({ quality: value });
        this.actions.changed('quality', value);
        this.syncQuality();
      });
    }
    this.listen(query('#btn-settings-back'), 'click', () => actions.back());
    this.listen(query('#btn-reset-progress'), 'click', () => actions.resetProgress());
    this.sync();
  }

  private listen(element: HTMLElement, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.handlers.push([element, event, handler]);
  }

  private bindRange(input: HTMLInputElement, key: keyof Settings, outputSelector: string, format: (v: number) => string): void {
    const output = query<HTMLOutputElement>(outputSelector);
    const apply = (): void => {
      const value = Number(input.value);
      output.value = format(value);
      const min = Number(input.min);
      const max = Number(input.max);
      input.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
    };
    this.listen(input, 'input', () => {
      const value = Number(input.value);
      this.save.updateSettings({ [key]: value } as Partial<Settings>);
      this.actions.changed(key, value);
      apply();
    });
    input.addEventListener('pointerdown', () => this.actions.hover());
    (input as HTMLInputElement & { __apply?: () => void }).__apply = apply;
  }

  private bindToggle(input: HTMLInputElement, key: keyof Settings): void {
    this.listen(input, 'change', () => {
      this.save.updateSettings({ [key]: input.checked } as Partial<Settings>);
      this.actions.changed(key, input.checked);
      this.actions.confirm();
    });
  }

  private sync(): void {
    const s = this.save.settings;
    this.sensitivity.value = String(s.sensitivity);
    this.master.value = String(s.masterVolume);
    this.music.value = String(s.musicVolume);
    this.sfx.value = String(s.sfxVolume);
    this.invert.checked = s.invertY;
    this.bloom.checked = s.bloom;
    for (const input of [this.sensitivity, this.master, this.music, this.sfx]) {
      (input as HTMLInputElement & { __apply?: () => void }).__apply?.();
    }
    this.syncQuality();
  }

  private syncQuality(): void {
    for (const button of this.quality.querySelectorAll<HTMLButtonElement>('button')) {
      button.classList.toggle('is-active', button.dataset.value === this.save.settings.quality);
    }
  }

  show(): void {
    this.sync();
    setVisible(this.root, true);
  }

  hide(): void {
    setVisible(this.root, false);
  }

  dispose(): void {
    for (const [element, event, handler] of this.handlers) element.removeEventListener(event, handler);
  }
}
