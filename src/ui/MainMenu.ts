import type { SaveSystem } from '../save/SaveSystem';
import { STAGE_COUNT } from '../utils/Constants';
import { el, query, setVisible } from '../utils/dom';
import { formatTime } from '../utils/MathUtils';

const STAGE_NAMES = [
  'AWAKENING',
  'THE NETWORK',
  'DISTORTION',
  'THE COLLAPSE',
  'THE CORE',
  'THE FALLEN LEGION',
  'REINFORCED ASSAULT',
  'ADVANCED COMBAT ZONE',
  'FINAL ASSAULT',
  'THE WARLORD',
];

interface MenuActions {
  start(stage: number): void;
  openSettings(): void;
  hover(): void;
  confirm(): void;
}

export class MainMenu {
  private readonly root = query('#menu');
  private readonly main = query('#menu-main');
  private readonly stagesPanel = query('#menu-stages');
  private readonly grid = query('#stage-grid');
  private readonly startButton = query<HTMLButtonElement>('#btn-start');
  private readonly handlers: Array<[HTMLElement, string, EventListener]> = [];

  constructor(
    private readonly save: SaveSystem,
    private readonly actions: MenuActions,
  ) {
    this.listen(this.startButton, 'click', () => actions.start(1));
    this.listen(query('#btn-stages'), 'click', () => this.showStages(true));
    this.listen(query('#btn-stages-back'), 'click', () => this.showStages(false));
    this.listen(query('#btn-settings'), 'click', () => actions.openSettings());
    this.refresh();
  }

  private listen(element: HTMLElement, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.handlers.push([element, event, handler]);
  }

  show(): void {
    setVisible(this.root, true);
    this.showStages(false);
  }

  hide(): void {
    setVisible(this.root, false);
  }

  private showStages(visible: boolean): void {
    setVisible(this.main, !visible);
    setVisible(this.stagesPanel, visible);
  }

  /** Rebuild the stage grid from save data. */
  refresh(): void {
    const cards: HTMLElement[] = [];
    for (let stage = 1; stage <= STAGE_COUNT; stage += 1) {
      const unlocked = this.save.isUnlocked(stage);
      const best = this.save.data.bestTimes[stage];
      const card = el('button', 'stage-card');
      card.type = 'button';
      card.disabled = !unlocked;
      card.append(
        el('strong', undefined, String(stage)),
        el('span', undefined, STAGE_NAMES[stage - 1]),
        el('em', undefined, best !== undefined ? formatTime(best) : unlocked ? 'OPEN' : 'LOCKED'),
      );
      card.addEventListener('mouseenter', () => this.actions.hover());
      card.addEventListener('click', () => {
        this.actions.confirm();
        this.actions.start(stage);
      });
      cards.push(card);
    }
    this.grid.replaceChildren(...cards);
    this.startButton.textContent = this.save.data.highestUnlocked > 1 ? 'START · STAGE 1' : 'START';
  }

  dispose(): void {
    for (const [element, event, handler] of this.handlers) element.removeEventListener(event, handler);
  }
}
