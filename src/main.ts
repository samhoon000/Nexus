import './styles.css';
import { Game } from './core/Game';
import { query } from './utils/dom';
import { showFatalError } from './ui/ErrorOverlay';

const canvas = query<HTMLCanvasElement>('#game-canvas');

let game: Game | null = null;

function supportsWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

if (!supportsWebGL2()) {
  showFatalError('WebGL 2 is not available in this browser. NEXUS needs a modern desktop browser with hardware acceleration.');
} else {
  try {
    game = new Game(canvas);
    void game.start().catch((error: unknown) => showFatalError('System initialisation failed.', error));
  } catch (error) {
    showFatalError('System initialisation failed.', error);
  }
}

window.addEventListener('error', (event) => {
  if (import.meta.env.DEV) console.error(event.error ?? event.message);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game?.dispose();
  });
}
