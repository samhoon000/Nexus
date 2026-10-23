import type { EventBus } from '../core/EventBus';
import type { GameStateName } from '../core/GameState';
import type { SaveSystem, Settings } from '../save/SaveSystem';
import type { RunStats } from '../stages/StageManager';
import type { StageDefinition } from '../stages/StageTypes';
import { query, setVisible } from '../utils/dom';
import { HUD } from './HUD';
import { LoadingScreen } from './LoadingScreen';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { SettingsPanel } from './SettingsPanel';
import { StageCompleteScreen } from './StageComplete';
import { GameCompleteScreen } from './GameComplete';
import { MobileControls } from './MobileControls';
import { ControlsOverlay } from './ControlsOverlay';
import type { InputManager } from '../input/InputManager';

export interface UIActions {
  start(stage: number): void;
  resume(): void;
  restartCheckpoint(): void;
  mainMenu(): void;
  settingChanged(key: keyof Settings, value: Settings[keyof Settings]): void;
  restartRun(): void;
}

/**
 * Owns every DOM screen and switches them from game state. UI dispatches intents through
 * `UIActions`; it never touches gameplay objects directly.
 */
export class UIManager {
  readonly loading = new LoadingScreen();
  readonly hud: HUD;
  readonly mobile: MobileControls;
  readonly controlsOverlay = new ControlsOverlay();
  private readonly menu: MainMenu;
  private readonly pause: PauseMenu;
  private readonly settings: SettingsPanel;
  private readonly stageComplete = new StageCompleteScreen();
  private readonly gameComplete: GameCompleteScreen;
  private readonly screens: HTMLElement[];
  private settingsReturn: 'menu' | 'pause' = 'menu';
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    bus: EventBus,
    private readonly save: SaveSystem,
    input: InputManager,
    actions: UIActions,
  ) {
    this.hud = new HUD(bus);
    this.mobile = new MobileControls(input);
    this.hud.setTouchMode(input.isTouch);
    this.unsubscribe.push(input.onModeChange((mode) => this.hud.setTouchMode(mode === 'touch')));
    this.menu = new MainMenu(save, {
      start: (stage) => actions.start(stage),
      openSettings: () => this.openSettings('menu'),
      hover: () => bus.emit('ui:hover', undefined),
      confirm: () => bus.emit('ui:confirm', undefined),
    });
    this.pause = new PauseMenu({
      resume: () => actions.resume(),
      restartCheckpoint: () => actions.restartCheckpoint(),
      openSettings: () => this.openSettings('pause'),
      openControls: () => this.showControlsOverlay(),
      mainMenu: () => actions.mainMenu(),
      hover: () => bus.emit('ui:hover', undefined),
      confirm: () => bus.emit('ui:confirm', undefined),
    });
    this.settings = new SettingsPanel(save, {
      changed: (key, value) => actions.settingChanged(key, value),
      back: () => this.closeSettings(),
      resetProgress: () => {
        save.reset();
        this.menu.refresh();
      },
      hover: () => bus.emit('ui:hover', undefined),
      confirm: () => bus.emit('ui:confirm', undefined),
    });
    this.gameComplete = new GameCompleteScreen({
      restart: () => actions.restartRun(),
      mainMenu: () => actions.mainMenu(),
      hover: () => bus.emit('ui:hover', undefined),
      confirm: () => bus.emit('ui:confirm', undefined),
    });
    this.screens = [
      query('#loading'),
      query('#menu'),
      query('#pause'),
      query('#settings'),
      query('#stage-complete'),
      query('#game-complete'),
    ];
    // Wire button sounds once for every button. Hover blips only make sense for a real cursor;
    // on touch the synthetic mouseenter would fire together with the tap.
    const hoverCapable = matchMedia('(hover: hover)').matches;
    for (const button of document.querySelectorAll<HTMLButtonElement>('#ui button')) {
      if (hoverCapable) button.addEventListener('mouseenter', () => bus.emit('ui:hover', undefined));
      button.addEventListener('click', () => bus.emit('ui:confirm', undefined));
    }
  }

  showControlsOverlay(onDismiss?: () => void): void {
    this.controlsOverlay.show(onDismiss);
  }

  hideAll(): void {
    for (const screen of this.screens) setVisible(screen, false);
    this.controlsOverlay.hide();
    this.hud.hide();
  }

  showMenu(): void {
    this.hideAll();
    this.menu.refresh();
    this.menu.show();
  }

  showHud(def: StageDefinition): void {
    for (const screen of this.screens) setVisible(screen, false);
    this.hud.show(def);
  }

  showPause(): void {
    for (const screen of this.screens) setVisible(screen, false);
    this.hud.showDimmed();
    this.pause.show();
  }

  hidePause(): void {
    this.pause.hide();
  }

  showStageComplete(def: StageDefinition, time: number, energy: number, total: number): void {
    for (const screen of this.screens) setVisible(screen, false);
    this.hud.hide();
    this.stageComplete.show(def, time, energy, total);
  }

  showGameComplete(stats: RunStats): void {
    this.hideAll();
    this.gameComplete.show(stats);
  }

  private openSettings(from: 'menu' | 'pause'): void {
    this.settingsReturn = from;
    for (const screen of this.screens) setVisible(screen, false);
    this.settings.show();
  }

  private closeSettings(): void {
    for (const screen of this.screens) setVisible(screen, false);
    if (this.settingsReturn === 'menu') {
      this.menu.refresh();
      this.menu.show();
    } else {
      this.pause.show();
    }
  }

  update(delta: number, stats: RunStats, state: GameStateName): void {
    void stats;
    this.hud.update(delta, state);
    this.mobile.update();
  }

  /** Shows the "click to engage" hint while playing with a mouse but without pointer lock. */
  setPointerLocked(locked: boolean, playing: boolean, needsLock: boolean): void {
    this.hud.setEngageVisible(playing && needsLock && !locked);
  }

  /** Touch controls are only on screen while playing in touch mode. */
  setTouchControlsVisible(visible: boolean): void {
    this.mobile.setVisible(visible);
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.hud.dispose();
    this.mobile.dispose();
    this.menu.dispose();
    this.pause.dispose();
    this.settings.dispose();
    this.gameComplete.dispose();
    void this.save;
  }
}
