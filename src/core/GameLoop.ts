import { PHYSICS } from '../utils/Constants';

export interface LoopCallbacks {
  /** Fixed-step gameplay simulation. Called 0..MAX_SUBSTEPS times per frame. */
  fixedUpdate: (fixedDelta: number) => void;
  /** Per-frame update with the real (clamped) delta and accumulated elapsed seconds. */
  update: (delta: number, elapsed: number) => void;
  render: () => void;
}

/**
 * requestAnimationFrame loop with a clamped delta and a fixed-step accumulator for gameplay.
 * The accumulator is drained at most MAX_SUBSTEPS times so a tab sleep cannot spiral.
 */
export class GameLoop {
  private frameId = 0;
  private lastTime = 0;
  private running = false;
  private accumulator = 0;
  private elapsed = 0;
  private frame = 0;
  /** Scales the gameplay delta only (hitstop / slow motion). */
  timeScale = 1;
  /** When true, the accumulator is not advanced (pause / screenshot freeze). */
  simulationPaused = false;

  constructor(private readonly callbacks: LoopCallbacks) {}

  get frameCount(): number {
    return this.frame;
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;
    const rawDelta = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const delta = Math.min(Math.max(rawDelta, 0), PHYSICS.MAX_FRAME_DT);
    this.elapsed += delta;
    this.frame += 1;

    // A thrown error must not kill the frame loop: report it and keep rendering.
    try {
      if (!this.simulationPaused) {
        this.accumulator += delta * this.timeScale;
        let steps = 0;
        while (this.accumulator >= PHYSICS.FIXED_DT && steps < PHYSICS.MAX_SUBSTEPS) {
          this.callbacks.fixedUpdate(PHYSICS.FIXED_DT);
          this.accumulator -= PHYSICS.FIXED_DT;
          steps += 1;
        }
        if (steps === PHYSICS.MAX_SUBSTEPS) this.accumulator = 0;
      }
      this.callbacks.update(delta, this.elapsed);
      this.callbacks.render();
    } catch (error) {
      this.reportError(error);
    }
    this.frameId = requestAnimationFrame(this.tick);
  };

  private errorCount = 0;

  private reportError(error: unknown): void {
    this.errorCount += 1;
    if (this.errorCount <= 5) console.error('[NEXUS] frame error', error);
    if (this.errorCount === 5) console.error('[NEXUS] further frame errors suppressed');
  }
}
