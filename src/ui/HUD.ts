import type { EventBus } from '../core/EventBus';
import type { GameStateName } from '../core/GameState';
import type { StageDefinition } from '../stages/StageTypes';
import { el, query, setVisible } from '../utils/dom';

/**
 * In-game HUD: energy count + segmented meter (top-left), stage label (top-right), fading control
 * hints (bottom-right), checkpoint toasts and the stage intro title.
 */
export class HUD {
  private readonly root = query('#hud');
  private readonly energyCount = query('#hud-energy-count');
  private readonly energyTotal = query('#hud-energy-total');
  private readonly meter = query('#hud-energy-meter');
  private readonly objective = query('#hud-objective');
  private readonly stageNumber = query('#hud-stage-number');
  private readonly stageName = query('#hud-stage-name');
  private readonly hints = query('#hud-hints');
  private readonly toast = query('#hud-toast');
  private readonly intro = query('#hud-intro');
  private readonly introNumber = query('#hud-intro-number');
  private readonly introName = query('#hud-intro-name');
  private readonly introSub = query('#hud-intro-sub');
  private readonly engage = query('#hud-engage');
  private readonly unsubscribe: Array<() => void> = [];
  private hintTimer = 0;
  private toastTimer = 0;
  private introTimer = 0;
  private segments: HTMLElement[] = [];
  private required = 0;
  private touchMode = false;

  constructor(bus: EventBus) {
    this.unsubscribe.push(
      bus.on('energy:changed', ({ count, required, total }) => this.setEnergy(count, required, total)),
      bus.on('energy:collected', () => this.punch()),
      bus.on('checkpoint:activated', () => this.showToast('CHECKPOINT SYNCHRONIZED')),
      bus.on('portal:opened', () => {
        this.showToast('GATEWAY ONLINE');
        this.objective.textContent = 'GATEWAY ONLINE — PROCEED';
        this.objective.classList.add('is-open');
      }),
      bus.on('platform:activated', () => this.showToast('STRUCTURE POWERED')),
      bus.on('gravity:changed', ({ scale, up }) => {
        if (up.y > 0.99 && scale === 1) this.showToast('GRAVITY NORMALIZED');
        else if (scale < 1) this.showToast('LOW GRAVITY FIELD');
        else if (up.y < -0.99) this.showToast('GRAVITY INVERTED');
        else this.showToast('GRAVITY SHIFT');
      }),
      bus.on('teleport', () => this.showToast('RELOCATED')),
      bus.on('player:respawn', () => this.showToast('RESTORED AT CHECKPOINT')),
      bus.on('toast', ({ text }) => this.showToast(text)),
    );
  }

  /** Switches key-name hints for touch wording. */
  setTouchMode(touch: boolean): void {
    this.touchMode = touch;
  }

  show(def: StageDefinition): void {
    setVisible(this.root, true);
    this.root.style.opacity = '1';
    this.stageNumber.textContent = String(def.id);
    this.stageName.textContent = def.name;
    if (def.id === 6) {
      this.objective.textContent = 'REACH THE FAR-END EXIT PORTAL';
    } else {
      this.objective.textContent = 'COLLECT ENERGY TO OPEN THE GATEWAY';
    }
    this.objective.classList.remove('is-open');
    const hints = (this.touchMode ? def.touchHints : undefined) ?? def.hints ?? [];
    this.hints.replaceChildren(...hints.map((hint) => el('div', undefined, hint)));
    this.hints.style.opacity = '1';
    this.hintTimer = hints.length ? 9 : 0;
    this.introNumber.textContent = String(def.id);
    this.introName.textContent = def.name;
    this.introSub.textContent = def.subtitle;
    this.restartAnimation(this.intro);
    this.introTimer = 3.6;
    setVisible(this.engage, false);
  }

  showDimmed(): void {
    setVisible(this.root, true);
    this.root.style.opacity = '0.35';
    setVisible(this.engage, false);
  }

  hide(): void {
    setVisible(this.root, false);
  }

  setEngageVisible(visible: boolean): void {
    setVisible(this.engage, visible && navigator.webdriver !== true);
  }

  private setEnergy(count: number, required: number, total: number): void {
    this.energyCount.textContent = String(count);
    this.energyTotal.textContent = String(total);
    if (this.segments.length !== total || this.required !== required) {
      this.required = required;
      this.segments = [];
      for (let i = 0; i < total; i += 1) {
        const segment = el('i');
        if (i < required) segment.classList.add('is-required');
        this.segments.push(segment);
      }
      this.meter.replaceChildren(...this.segments);
    }
    this.segments.forEach((segment, i) => segment.classList.toggle('is-filled', i < count));
  }

  private punch(): void {
    this.energyCount.animate(
      [{ transform: 'scale(1.25)', color: '#ffffff' }, { transform: 'scale(1)', color: '#dff6ff' }],
      { duration: 180, easing: 'ease-out' },
    );
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.restartAnimation(this.toast);
    this.toastTimer = 2.4;
  }

  private restartAnimation(element: HTMLElement): void {
    setVisible(element, false);
    void element.offsetWidth;
    setVisible(element, true);
  }

  update(delta: number, state: GameStateName): void {
    if (state !== 'PLAYING') return;
    if (this.hintTimer > 0) {
      this.hintTimer -= delta;
      if (this.hintTimer <= 0) this.hints.style.opacity = '0';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= delta;
      if (this.toastTimer <= 0) setVisible(this.toast, false);
    }
    if (this.introTimer > 0) {
      this.introTimer -= delta;
      if (this.introTimer <= 0) setVisible(this.intro, false);
    }
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
  }
}
