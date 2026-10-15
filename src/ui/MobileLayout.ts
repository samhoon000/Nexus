import type { DeviceProfile } from '../core/Device';
import type { InputMode } from '../input/InputManager';
import { query, setVisible } from '../utils/dom';

export interface LayoutCallbacks {
  /** The page was hidden (tab switch, app backgrounded). */
  hidden(): void;
  /** The page became visible again. */
  visible(): void;
}

/**
 * Viewport and platform presentation: `data-*` attributes on <html> drive the responsive CSS
 * (input mode, form factor, orientation), the live viewport height variable tracks the mobile
 * address bar, the landscape recommendation overlay, fullscreen, and visibility pause.
 */
export class MobileLayout {
  private readonly html = document.documentElement;
  private readonly rotate = query('#rotate');
  private readonly fullscreenButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="fullscreen"]'));
  /** The landscape banner shows once per play session, then stays out of the way. */
  private rotateShown = false;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];

  constructor(
    private readonly device: DeviceProfile,
    initialMode: InputMode,
    callbacks: LayoutCallbacks,
  ) {
    this.html.dataset.form = device.formFactor;
    this.setInputMode(initialMode);
    this.listen(window, 'resize', () => this.refresh());
    this.listen(window, 'orientationchange', () => this.refresh());
    if (window.visualViewport) this.listen(window.visualViewport, 'resize', () => this.refresh());
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) callbacks.hidden();
      else callbacks.visible();
    });
    this.listen(window, 'pagehide', () => callbacks.hidden());
    // iOS pinch-zoom gesture events bypass touch-action.
    this.listen(document, 'gesturestart', (event) => event.preventDefault());
    for (const button of this.fullscreenButtons) {
      this.listen(button, 'click', () => void this.toggleFullscreen());
    }
    this.listen(document, 'fullscreenchange', () => this.syncFullscreenLabel());
    this.syncFullscreenLabel();
    this.refresh();
  }

  private listen(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  setInputMode(mode: InputMode): void {
    this.html.dataset.input = mode;
    this.refresh();
  }

  /** Called from the game flow so the landscape hint only appears during play. */
  setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    if (!playing) {
      this.rotateShown = false;
      this.hideRotate();
    }
    this.refresh();
  }

  private hideRotate(): void {
    setVisible(this.rotate, false);
    if (this.rotateTimer !== null) clearTimeout(this.rotateTimer);
    this.rotateTimer = null;
  }

  get isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  private refresh(): void {
    const portrait = this.isPortrait;
    this.html.dataset.orientation = portrait ? 'portrait' : 'landscape';
    // Live viewport height: 100vh ignores the collapsing address bar on mobile browsers.
    const height = window.visualViewport?.height ?? window.innerHeight;
    this.html.style.setProperty('--vvh', `${Math.round(height)}px`);
    const touch = this.html.dataset.input === 'touch';
    const phone = this.device.formFactor === 'phone';
    if (touch && phone && portrait && this.playing && !this.rotateShown) {
      // Non-blocking: play continues in portrait; the banner fades by itself.
      this.rotateShown = true;
      setVisible(this.rotate, true);
      this.rotateTimer = setTimeout(() => this.hideRotate(), ROTATE_BANNER_MS);
    } else if (!portrait) {
      this.hideRotate();
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Fullscreen
  // ---------------------------------------------------------------------------------------------

  get fullscreenSupported(): boolean {
    return Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.fullscreenSupported) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // Best effort: lock to landscape where the platform allows it.
      const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
      await orientation.lock?.('landscape').catch(() => undefined);
    } catch {
      // Fullscreen refused (iOS Safari, iframe policy). The game plays inline instead.
    }
  }

  private syncFullscreenLabel(): void {
    const active = Boolean(document.fullscreenElement);
    for (const button of this.fullscreenButtons) {
      button.textContent = active ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
      button.classList.toggle('is-hidden', !this.fullscreenSupported);
    }
  }

  dispose(): void {
    for (const [target, type, handler] of this.listeners) target.removeEventListener(type, handler);
    this.listeners.length = 0;
    this.hideRotate();
  }
}

const ROTATE_BANNER_MS = 4500;
