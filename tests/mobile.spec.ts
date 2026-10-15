import { expect, test, type Page } from '@playwright/test';

/**
 * Touch-mode checks (mobile-chrome project: iPhone viewport, DPR 3, touch). Drives the real
 * on-screen controls with pointer events and asserts on diagnostics, like the desktop suite.
 */

const IGNORED_CONSOLE = [/X4122/, /Program Info Log/];

async function boot(page: Page): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15_000 });
  return { errors };
}

const diag = (page: Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);

function pointer(page: Page, selector: string, type: string, x: number, y: number, id: number) {
  return page.locator(selector).dispatchEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    isPrimary: true,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
}

async function startTouchPlay(page: Page): Promise<void> {
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('active-play'));
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
  await page.waitForTimeout(150);
}

test('touch device boots into touch mode with controls shown only while playing', async ({ page }) => {
  const { errors } = await boot(page);
  expect(await page.evaluate(() => document.documentElement.dataset.input)).toBe('touch');
  await expect(page.locator('#touch-controls')).toBeHidden();
  await expect(page.locator('#hud-engage')).toBeHidden();
  await startTouchPlay(page);
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#touch-jump')).toBeVisible();
  await expect(page.locator('#touch-pause')).toBeVisible();
  // Portrait phone: the landscape banner is a passing hint that never takes input.
  await expect(page.locator('#rotate')).toBeVisible();
  expect(await page.locator('#rotate').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  const d = await diag(page);
  expect(d.input.mode).toBe('touch');
  expect(d.input.touchControlsVisible).toBe(true);
  // Phone form factor resolves AUTO quality to the medium tier and caps the DPR.
  expect(d.quality.formFactor).toBe('phone');
  expect(d.canvas.dpr).toBeLessThanOrEqual(1.5);
  expect(d.canvas.clientWidth).toBe(390);
  expect(errors).toEqual([]);
});

test('virtual joystick moves the player and recentres on release', async ({ page }) => {
  await boot(page);
  await startTouchPlay(page);
  const start = await diag(page);
  const zone = (await page.locator('#touch-move').boundingBox())!;
  const x = zone.x + zone.width * 0.4;
  const y = zone.y + zone.height * 0.7;
  await pointer(page, '#touch-move', 'pointerdown', x, y, 1);
  await pointer(page, '#touch-move', 'pointermove', x, y - 70, 1);
  await page.waitForTimeout(100);
  const pushed = await diag(page);
  expect(pushed.input.joystick.y).toBeGreaterThan(0.6);
  await expect(page.locator('#touch-joy-base')).toHaveClass(/is-active/);
  await page.waitForTimeout(300);
  await pointer(page, '#touch-move', 'pointerup', x, y - 70, 1);
  await page.waitForTimeout(60);
  const released = await diag(page);
  expect(start.player.position.z - released.player.position.z).toBeGreaterThan(1);
  expect(released.input.joystick.x).toBe(0);
  expect(released.input.joystick.y).toBe(0);
  await expect(page.locator('#touch-joy-base')).not.toHaveClass(/is-active/);
});

test('jump button jumps with variable height and double jumps in the air', async ({ page }) => {
  await boot(page);
  await startTouchPlay(page);
  const base = (await diag(page)).player.position.y;
  const button = (await page.locator('#touch-jump').boundingBox())!;
  const x = button.x + button.width / 2;
  const y = button.y + button.height / 2;
  // Short tap = cut jump.
  await pointer(page, '#touch-jump', 'pointerdown', x, y, 2);
  await page.waitForTimeout(40);
  await pointer(page, '#touch-jump', 'pointerup', x, y, 2);
  let short = base;
  for (let i = 0; i < 14; i += 1) {
    await page.waitForTimeout(50);
    short = Math.max(short, (await diag(page)).player.position.y);
  }
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true);
  await page.waitForTimeout(100);
  // Held jump, then a second press mid-air.
  await pointer(page, '#touch-jump', 'pointerdown', x, y, 3);
  await page.waitForTimeout(150);
  expect((await diag(page)).input.jumpHeld).toBe(true);
  await page.waitForTimeout(180);
  await pointer(page, '#touch-jump', 'pointerup', x, y, 3);
  await page.waitForTimeout(30);
  await pointer(page, '#touch-jump', 'pointerdown', x, y, 4);
  let peak = base;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(50);
    peak = Math.max(peak, (await diag(page)).player.position.y);
  }
  await pointer(page, '#touch-jump', 'pointerup', x, y, 4);
  expect(short - base).toBeGreaterThan(0.6);
  expect(peak - base).toBeGreaterThan(short - base + 1.5);
});

test('dragging the look zone rotates the camera and the pitch stays clamped', async ({ page }) => {
  await boot(page);
  await startTouchPlay(page);
  const state = () => page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.getState() as { yaw: number; pitch: number });
  const before = await state();
  const zone = (await page.locator('#touch-look').boundingBox())!;
  const x = zone.x + zone.width * 0.5;
  const y = zone.y + zone.height * 0.4;
  await pointer(page, '#touch-look', 'pointerdown', x, y, 5);
  for (let i = 1; i <= 10; i += 1) {
    await pointer(page, '#touch-look', 'pointermove', x - i * 15, y + i * 40, 5);
    await page.waitForTimeout(16);
  }
  await pointer(page, '#touch-look', 'pointerup', x - 150, y + 400, 5);
  await page.waitForTimeout(250);
  const after = await state();
  expect(Math.abs(after.yaw - before.yaw)).toBeGreaterThan(0.4);
  expect(after.pitch).toBeLessThanOrEqual(1.25);
  expect(after.pitch).toBeGreaterThanOrEqual(-0.55);
});

test('pause button pauses, resume and main menu are tappable, controls hide while paused', async ({ page }) => {
  await boot(page);
  await startTouchPlay(page);
  const pause = (await page.locator('#touch-pause').boundingBox())!;
  await page.touchscreen.tap(pause.x + pause.width / 2, pause.y + pause.height / 2);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED');
  await expect(page.locator('#pause')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeHidden();
  const resume = (await page.locator('#btn-resume').boundingBox())!;
  expect(resume.height).toBeGreaterThanOrEqual(40);
  await page.touchscreen.tap(resume.x + resume.width / 2, resume.y + resume.height / 2);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
  await expect(page.locator('#touch-controls')).toBeVisible();
  await page.touchscreen.tap(pause.x + pause.width / 2, pause.y + pause.height / 2);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED');
  const menu = (await page.locator('#btn-pause-menu').boundingBox())!;
  await page.touchscreen.tap(menu.x + menu.width / 2, menu.y + menu.height / 2);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU');
  await expect(page.locator('#menu')).toBeVisible();
});

test('hiding the page pauses the game and losing the pointer releases every control', async ({ page }) => {
  await boot(page);
  await startTouchPlay(page);
  const button = (await page.locator('#touch-jump').boundingBox())!;
  await pointer(page, '#touch-jump', 'pointerdown', button.x + 40, button.y + 40, 6);
  await page.waitForTimeout(50);
  expect((await diag(page)).input.jumpHeld).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED');
  expect((await diag(page)).input.jumpHeld).toBe(false);
  expect((await diag(page)).input.touchControlsVisible).toBe(false);
});

test('a mouse press switches to pointer mode and hides the touch controls', async ({ page }) => {
  await boot(page);
  await startTouchPlay(page);
  await expect(page.locator('#touch-controls')).toBeVisible();
  await page.locator('#game-canvas').dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 7, bubbles: true });
  await page.waitForTimeout(100);
  expect((await diag(page)).input.mode).toBe('pointer');
  await expect(page.locator('#touch-controls')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.input)).toBe('pointer');
  // A touch brings them straight back.
  await page.locator('#game-canvas').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 8, bubbles: true });
  await page.waitForTimeout(100);
  expect((await diag(page)).input.mode).toBe('touch');
  await expect(page.locator('#touch-controls')).toBeVisible();
});

test('every stage loads in touch mode within the draw-call budget and without errors', async ({ page }) => {
  const { errors } = await boot(page);
  for (let stage = 1; stage <= 5; stage += 1) {
    await page.evaluate((s) => window.__THREE_GAME_TEST_HOOKS__!.setState(`stage-${s}`), stage);
    await page.waitForTimeout(300);
    const d = await diag(page);
    expect(d.stage).toBe(stage);
    expect(d.state).toBe('PLAYING');
    expect(d.input.touchControlsVisible).toBe(true);
    expect(d.renderer.calls, `stage ${stage} draw calls`).toBeLessThanOrEqual(320);
    expect(d.renderer.triangles, `stage ${stage} triangles`).toBeLessThanOrEqual(750_000);
  }
  expect(errors).toEqual([]);
});
