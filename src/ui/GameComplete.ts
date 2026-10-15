import type { RunStats } from '../stages/StageManager';
import { STAGE_COUNT } from '../utils/Constants';
import { query, setVisible } from '../utils/dom';
import { formatTime } from '../utils/MathUtils';

interface GameCompleteActions {
  restart(): void;
  mainMenu(): void;
  hover(): void;
  confirm(): void;
}

export class GameCompleteScreen {
  private readonly root = query('#game-complete');
  private readonly time = query('#gc-time');
  private readonly energy = query('#gc-energy');
  private readonly stages = query('#gc-stages');
  private readonly deaths = query('#gc-deaths');
  private readonly handlers: Array<[HTMLElement, string, EventListener]> = [];

  constructor(actions: GameCompleteActions) {
    this.listen(query('#btn-gc-restart'), 'click', () => actions.restart());
    this.listen(query('#btn-gc-menu'), 'click', () => actions.mainMenu());
  }

  private listen(element: HTMLElement, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.handlers.push([element, event, handler]);
  }

  show(stats: RunStats): void {
    this.time.textContent = formatTime(stats.totalTime);
    this.energy.textContent = `${stats.energy} / ${stats.energyTotal}`;
    this.stages.textContent = `${Math.min(STAGE_COUNT, stats.stagesCompleted)} / ${STAGE_COUNT}`;
    this.deaths.textContent = String(stats.deaths);
    setVisible(this.root, true);
  }

  hide(): void {
    setVisible(this.root, false);
  }

  dispose(): void {
    for (const [element, event, handler] of this.handlers) element.removeEventListener(event, handler);
  }
}
