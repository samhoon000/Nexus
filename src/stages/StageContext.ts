import type { EventBus } from '../core/EventBus';
import type { MaterialLibrary } from '../effects/Materials';
import type { ParticleSystem } from '../effects/Particles';
import type { TweenManager } from '../effects/Tween';
import type { World } from '../world/World';
import type { StageTheme } from './StageTypes';

/** Shared services handed to every mechanic system when a stage is built. */
export interface StageContext {
  world: World;
  materials: MaterialLibrary;
  bus: EventBus;
  particles: ParticleSystem;
  tweens: TweenManager;
  rng: () => number;
  theme: StageTheme;
}
