import { query, setVisible } from '../utils/dom';

const STEPS = ['INITIALIZING SYSTEM...', 'COMPILING SHADERS...', 'MAPPING SECTORS...', 'LINKING ENERGY GRID...', 'SYSTEM READY'];

/**
 * Short futuristic boot sequence. The bar paces itself over ~1.4 seconds while the first frames
 * warm the shader cache; when `ready` is given (the player character download) it holds at the
 * last step until that settles, so the game never shows a half-loaded player.
 */
export class LoadingScreen {
  private readonly root = query('#loading');
  private readonly status = query('#loading-status');
  private readonly fill = query('#loading-fill');

  async run(ready?: Promise<unknown>): Promise<void> {
    const automated = navigator.webdriver === true;
    const total = automated ? 120 : 1400;
    const start = performance.now();
    let settled = !ready;
    const settle = (): void => {
      settled = true;
    };
    ready?.then(settle, settle);
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const timed = Math.min(1, (performance.now() - start) / total);
        // Hold on the "linking" step (not "ready") while the character is still downloading.
        const k = settled ? timed : Math.min(timed, 0.79);
        this.fill.style.width = `${Math.round(k * 100)}%`;
        this.status.textContent = STEPS[Math.min(STEPS.length - 1, Math.floor(k * STEPS.length))];
        if (k >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    await new Promise((resolve) => setTimeout(resolve, automated ? 20 : 260));
    setVisible(this.root, false);
  }
}
