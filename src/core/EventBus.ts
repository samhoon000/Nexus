import type * as THREE from 'three';
import type { GameStateName } from './GameState';

/** Every cross-system event and its payload. Add new events here first. */
export interface GameEvents {
  'state:changed': { from: GameStateName; to: GameStateName };
  'stage:loaded': { stage: number; name: string; energyRequired: number; energyTotal: number };
  'stage:complete': { stage: number; time: number; energy: number; energyTotal: number };
  'game:complete': { totalTime: number; energy: number; energyTotal: number; stages: number; deaths: number };
  'energy:collected': { position: THREE.Vector3; count: number; total: number };
  'energy:changed': { count: number; required: number; total: number };
  'checkpoint:activated': { index: number; position: THREE.Vector3 };
  'player:jump': { position: THREE.Vector3; double: boolean };
  'player:land': { position: THREE.Vector3; impact: number };
  'player:died': { position: THREE.Vector3; cause: 'fall' | 'hazard' };
  'player:respawn': { position: THREE.Vector3 };
  'teleport': { from: THREE.Vector3; to: THREE.Vector3 };
  'gravity:changed': { up: THREE.Vector3; scale: number; position: THREE.Vector3 };
  'platform:activated': { id: string; position: THREE.Vector3 };
  'platform:crumble': { position: THREE.Vector3 };
  'platform:fall': { position: THREE.Vector3 };
  'portal:opened': { position: THREE.Vector3 };
  'core:ignite': { position: THREE.Vector3 };
  'core:wave': { index: number };
  'settings:changed': { key: string; value: number | boolean };
  'ui:hover': undefined;
  'ui:confirm': undefined;
  'ui:back': undefined;
  'shake': { amount: number };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private readonly handlers = new Map<keyof GameEvents, Set<Handler<unknown>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
