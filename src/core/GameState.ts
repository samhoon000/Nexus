import type { EventBus } from './EventBus';

export type GameStateName =
  | 'LOADING'
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'STAGE_COMPLETE'
  | 'TRANSITION'
  | 'GAME_COMPLETE';

const TRANSITIONS: Record<GameStateName, GameStateName[]> = {
  LOADING: ['MENU'],
  MENU: ['TRANSITION', 'PLAYING'],
  PLAYING: ['PAUSED', 'STAGE_COMPLETE', 'GAME_COMPLETE', 'TRANSITION', 'MENU'],
  PAUSED: ['PLAYING', 'TRANSITION', 'MENU'],
  STAGE_COMPLETE: ['TRANSITION', 'MENU', 'GAME_COMPLETE', 'PLAYING'],
  TRANSITION: ['PLAYING', 'MENU', 'GAME_COMPLETE'],
  GAME_COMPLETE: ['MENU', 'TRANSITION'],
};

/** Strict finite state machine. Illegal transitions throw in dev and are ignored in prod. */
export class GameState {
  private current: GameStateName = 'LOADING';

  constructor(private readonly bus: EventBus) {}

  get name(): GameStateName {
    return this.current;
  }

  is(...names: GameStateName[]): boolean {
    return names.includes(this.current);
  }

  /** Gameplay simulation runs only in PLAYING. */
  get simulating(): boolean {
    return this.current === 'PLAYING';
  }

  set(next: GameStateName): boolean {
    if (next === this.current) return false;
    if (!TRANSITIONS[this.current].includes(next)) {
      const message = `Illegal state transition ${this.current} → ${next}`;
      if (import.meta.env.DEV) throw new Error(message);
      console.warn(message);
      return false;
    }
    const from = this.current;
    this.current = next;
    this.bus.emit('state:changed', { from, to: next });
    return true;
  }
}
