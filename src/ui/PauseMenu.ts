import { query, setVisible } from '../utils/dom';

interface PauseActions {
  resume(): void;
  restartCheckpoint(): void;
  openSettings(): void;
  mainMenu(): void;
  hover(): void;
  confirm(): void;
}

export class PauseMenu {
  private readonly root = query('#pause');
  private readonly handlers: Array<[HTMLElement, string, EventListener]> = [];

  constructor(actions: PauseActions) {
    this.listen(query('#btn-resume'), 'click', () => actions.resume());
    this.listen(query('#btn-restart-checkpoint'), 'click', () => actions.restartCheckpoint());
    this.listen(query('#btn-pause-settings'), 'click', () => actions.openSettings());
    this.listen(query('#btn-pause-menu'), 'click', () => actions.mainMenu());
  }

  private listen(element: HTMLElement, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.handlers.push([element, event, handler]);
  }

  show(): void {
    setVisible(this.root, true);
    query<HTMLButtonElement>('#btn-resume').focus({ preventScroll: true });
  }

  hide(): void {
    setVisible(this.root, false);
  }

  dispose(): void {
    for (const [element, event, handler] of this.handlers) element.removeEventListener(event, handler);
  }
}
