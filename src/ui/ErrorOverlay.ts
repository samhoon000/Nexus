import { el } from '../utils/dom';

/** Player-friendly fatal error screen; the technical detail is only printed in dev. */
export function showFatalError(message: string, error?: unknown): void {
  if (import.meta.env.DEV && error) console.error(error);
  const existing = document.querySelector('#fatal-error');
  if (existing) return;
  const root = el('div', 'screen fatal');
  root.id = 'fatal-error';
  root.append(
    el('div', 'title-mark', 'NEXUS'),
    el('p', 'fatal-message', message),
    el('p', 'fatal-hint', import.meta.env.DEV && error instanceof Error ? error.message : 'Reload the page to try again.'),
  );
  document.body.append(root);
}
