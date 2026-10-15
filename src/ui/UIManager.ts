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
    actions: UIActions,
  ) {
    this.hud = new HUD(bus);
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
    // Wire button sounds once for every button.
    for (const button of document.querySelectorAll<HTMLButtonElement>('#ui button')) {
      button.addEventListener('mouseenter', () => bus.emit('ui:hover', undefined));
      button.addEventListener('click', () => bus.emit('ui:confirm', undefined));
    }
  }

  hideAll(): void {
    for (const screen of this.screens) setVisible(screen, false);
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
  }

  /** Shows the "click to engage" hint while playing without pointer lock. */
  setPointerLocked(locked: boolean, playing: boolean): void {
    this.hud.setEngageVisible(playing && !locked);
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.hud.dispose();
    this.menu.dispose();
    this.pause.dispose();
    this.settings.dispose();
    this.gameComplete.dispose();
    void this.save;
  }
}
