import { query, setVisible } from '../utils/dom';

const STEPS = ['INITIALIZING SYSTEM...', 'COMPILING SHADERS...', 'MAPPING SECTORS...', 'LINKING ENERGY GRID...', 'SYSTEM READY'];

/**
 * Short futuristic boot sequence. Procedural assets need no network, so the bar paces itself
 * over ~1.4 seconds while the first frames warm the shader cache.
 */
export class LoadingScreen {
  private readonly root = query('#loading');
  private readonly status = query('#loading-status');
  private readonly fill = query('#loading-fill');

  async run(): Promise<void> {
    const automated = navigator.webdriver === true;
    const total = automated ? 120 : 1400;
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const k = Math.min(1, (performance.now() - start) / total);
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
