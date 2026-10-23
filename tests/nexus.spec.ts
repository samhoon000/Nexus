import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

/**
 * Browser-level checks for NEXUS. Each test boots the game, drives it through the deterministic
 * test hooks plus real keyboard input, and asserts on diagnostics + console cleanliness.
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
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15_000 });
  return { errors };
}

const diag = (page: Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);
const hooks = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window.__THREE_GAME_TEST_HOOKS__ as unknown as Record<string, (...x: unknown[]) => unknown>)[f](...a), [fn, args] as const);

async function sampleCanvas(page: Page): Promise<{ variance: number; buckets: number }> {
  const canvas = page.locator('#game-canvas');
  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  const buckets = new Set<string>();
  const stride = Math.max(1, Math.floor((png.width * png.height) / 4096));
  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const o = pixel * 4;
    const r = png.data[o];
    const g = png.data[o + 1];
    const b = png.data[o + 2];
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    buckets.add(`${r >> 4},${g >> 4},${b >> 4}`);
  }
  return { variance: max - min, buckets: buckets.size };
}

test('boots to the main menu with a rendered scene and no errors', async ({ page }) => {
  const { errors } = await boot(page);
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#btn-start')).toBeVisible();
  const sample = await sampleCanvas(page);
  expect(sample.variance).toBeGreaterThan(20);
  expect(sample.buckets).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

test('START begins Stage 1 and WASD / Space move and jump the player', async ({ page }) => {
  const { errors } = await boot(page);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING', null, { timeout: 10_000 });
  await expect(page.locator('#hud')).toBeVisible();
  const start = await diag(page);
  expect(start.stage).toBe(1);
  expect(start.player.grounded).toBe(true);

  // Walk forward (camera faces -Z at spawn).
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  const moved = await diag(page);
  expect(moved.player.position.z).toBeLessThan(start.player.position.z - 1);

  // Jump (held for full height): y must rise above the standing height, then land again.
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  const airborne = await diag(page);
  await page.keyboard.up('Space');
  expect(airborne.player.grounded).toBe(false);
  expect(airborne.player.position.y).toBeGreaterThan(start.player.position.y + 0.8);
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 3000 });
  expect(errors).toEqual([]);
});

test('double jump reaches higher than a single jump', async ({ page }) => {
  await boot(page);
  await hooks(page, 'setState', 'active-play');
  const base = (await diag(page)).player.position.y;
  await page.keyboard.down('Space');
  let single = base;
  for (let i = 0; i < 14; i += 1) {
    await page.waitForTimeout(50);
    single = Math.max(single, (await diag(page)).player.position.y);
  }
  await page.keyboard.up('Space');
  await page.waitForTimeout(900);
  await page.keyboard.down('Space');
  await page.waitForTimeout(330);
  await page.keyboard.up('Space');
  await page.waitForTimeout(30);
  await page.keyboard.down('Space');
  let double = base;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(50);
    double = Math.max(double, (await diag(page)).player.position.y);
  }
  await page.keyboard.up('Space');
  expect(single - base).toBeGreaterThan(1.6);
  expect(double - base).toBeGreaterThan(single - base + 1.0);
});

test('every stage loads and renders without errors', async ({ page }) => {
  const { errors } = await boot(page);
  for (let stage = 1; stage <= 5; stage += 1) {
    await hooks(page, 'setState', `stage-${stage}`);
    await page.waitForTimeout(300);
    const d = await diag(page);
    expect(d.stage).toBe(stage);
    expect(d.state).toBe('PLAYING');
    expect(d.energyTotal).toBeGreaterThan(0);
    expect(d.renderer.calls).toBeGreaterThan(10);
    expect(d.renderer.calls, `stage ${stage} draw calls`).toBeLessThanOrEqual(320);
    expect(d.renderer.triangles, `stage ${stage} triangles`).toBeLessThanOrEqual(750_000);
    expect(d.player.character, `stage ${stage} player character`).toBe('glb');
    const sample = await sampleCanvas(page);
    expect(sample.buckets, `stage ${stage} canvas`).toBeGreaterThan(6);
  }
  expect(errors).toEqual([]);
});

test('falling off the world respawns at the spawn / checkpoint and counts a death', async ({ page }) => {
  await boot(page);
  await hooks(page, 'setState', 'active-play');
  const start = await diag(page);
  await hooks(page, 'teleportPlayer', 0, 0, 12); // off the start pad edge → falls
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.deaths ?? 0) >= 1, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 5000 });
  const after = await diag(page);
  expect(after.deaths).toBe(1);
  expect(Math.abs(after.player.position.z - start.player.position.z)).toBeLessThan(1);
  expect(Math.abs(after.player.position.y - start.player.position.y)).toBeLessThan(0.5);
});

test('collecting the required energy opens the portal and entering it completes the stage', async ({ page }) => {
  const { errors } = await boot(page);
  await hooks(page, 'setState', 'active-play');
  await hooks(page, 'grantEnergy', 8);
  await page.waitForTimeout(200);
  expect((await hooks(page, 'getState')) as { portalOpen: boolean }).toMatchObject({ portalOpen: true });
  // Walk into the Stage 1 portal.
  await hooks(page, 'teleportPlayer', 12, 2, -102.5);
  await hooks(page, 'setBotIntent', 0, -1, false);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 8000 });
  await hooks(page, 'setBotIntent', NaN, 0, false);
  await expect(page.locator('#stage-complete')).toBeVisible();
  // Transition into Stage 2.
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 2 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING', null, { timeout: 12_000 });
  expect(errors).toEqual([]);
});

test('Stage 4 portal still completes the stage and loads Stage 5', async ({ page }) => {
  const { errors } = await boot(page);
  await hooks(page, 'setState', 'stage-4');
  await hooks(page, 'grantEnergy', 10);
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__?.getState().portalOpen === true);
  await hooks(page, 'teleportPlayer', 0, 6, -156);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 8000 });
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 5 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
    null,
    { timeout: 12_000 },
  );
  expect(errors).toEqual([]);
});

test('ESC pauses, RESUME continues and gameplay input is ignored while paused', async ({ page }) => {
  await boot(page);
  await hooks(page, 'setState', 'active-play');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED');
  await expect(page.locator('#pause')).toBeVisible();
  const paused = await diag(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  const still = await diag(page);
  expect(still.player.position.z).toBeCloseTo(paused.player.position.z, 3);
  await page.click('#btn-resume');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
});

test('settings persist to localStorage across reloads', async ({ page }) => {
  await boot(page);
  await page.click('#btn-settings');
  await expect(page.locator('#settings')).toBeVisible();
  await page.locator('#set-sensitivity').fill('1.8');
  await page.locator('#set-quality button[data-value="medium"]').click();
  await page.reload();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'));
  expect(saved.settings.sensitivity).toBeCloseTo(1.8, 2);
  expect(saved.settings.quality).toBe('medium');
  expect((await diag(page)).canvas.dpr).toBeLessThanOrEqual(1.5);
});

test('stage completion unlocks the next stage in the save file', async ({ page }) => {
  await boot(page);
  await hooks(page, 'setState', 'active-play');
  await hooks(page, 'triggerAction', 'complete-stage');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'));
  expect(saved.highestUnlocked).toBe(2);
  expect(saved.completed).toContain(1);
});

test('Stage 5 compact armor box supports landing and grounded movement', async ({ page }) => {
  await boot(page);
  await hooks(page, 'startStage', 5);
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 5 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
    null,
    { timeout: 10_000 },
  );
  const upgradeCollider = (await hooks(page, 'getPlatforms') as Array<{ id: string; pos: number[]; size: number[]; enabled: boolean }>).find((platform) => platform.id === 'armor-upgrade-platform');
  expect(upgradeCollider).toMatchObject({ pos: [20, 17, -121], size: [3.6, 0.58, 2.8], enabled: true });
  await hooks(page, 'teleportPlayer', 18.5, 17.4, -121.5);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 3_000 });
  const landed = await diag(page);
    expect(landed.player.position.y).toBeCloseTo(17.6, 1);
  await hooks(page, 'setBotIntent', 0.2, 0, false, false);
  await page.waitForTimeout(120);
  await hooks(page, 'setBotIntent', Number.NaN, 0, false, false);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 3_000 });
  const walked = await diag(page);
    expect(walked.player.position.y).toBeCloseTo(17.6, 1);
  expect(walked.player.position.x).not.toBeCloseTo(landed.player.position.x, 2);
});

test('Stage 5 armor unlock opens a traversable exit and portal entry completes the stage', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await hooks(page, 'startStage', 5);
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 5 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
    null,
    { timeout: 10_000 },
  );
  const corePlaza = (await hooks(page, 'getPlatforms') as Array<{ id: string; pos: number[]; size: number[]; enabled: boolean }>).find((platform) => platform.id === 'core-plaza');
  expect(corePlaza).toMatchObject({ pos: [20, 16.4, -124], size: [14, 1.2, 14], enabled: false });
  await hooks(page, 'teleportPlayer', 20, 17.4, -121);
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING'
      && window.__THREE_GAME_TEST_HOOKS__?.getState().portalOpen === true,
    null,
    { timeout: 30_000, polling: 100 },
  );

  await page.waitForFunction(
    () => window.__THREE_GAME_TEST_HOOKS__?.getPlatforms()
      .filter((platform) => platform.id.startsWith('stage5-exit-rise-') && platform.enabled).length === 2,
    null,
    { timeout: 5_000 },
  );
  expect(await page.locator('#nexus-stage5-completion').count()).toBe(0);
  await hooks(page, 'setBotIntent', 0, -1, false, false);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 8_000 });
  await hooks(page, 'setBotIntent', Number.NaN, 0, false, false);
  await expect(page.locator('#stage-complete')).toBeVisible();

  await expect(page.locator('#nexus-stage5-completion')).toContainText('LEVEL 5 COMPLETED');
  await expect(page.locator('#nexus-stage5-completion')).toContainText('ARMOR IS BONDED');
  await expect(page.locator('#nexus-story-transition')).toBeHidden();
  await expect(page.locator('#nexus-skip-prompt')).toBeHidden();
  await expect(page.locator('#nexus-stage5-completion')).toHaveCSS('pointer-events', 'none');
  const completed = await page.evaluate(() => ({
    stageState: window.__THREE_GAME_TEST_HOOKS__!.getState(),
    portalOpen: window.__THREE_GAME_TEST_HOOKS__!.getState().portalOpen,
    state: window.__THREE_GAME_DIAGNOSTICS__?.state,
    stage: window.__THREE_GAME_DIAGNOSTICS__?.stage,
    save: JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'),
    oldBoardText: document.body.innerText.includes('PRESS CONTINUE TO COMPLETE LEVEL 5'),
    stage6WarningVisible: document.getElementById('nexus-stage6-warning')?.style.display === 'block',
  }));
  expect(completed).toMatchObject({ portalOpen: true, state: 'STAGE_COMPLETE', stage: 5, oldBoardText: false, stage6WarningVisible: false });
  expect(completed.save.completed).toContain(5);
  expect(completed.save.highestUnlocked).toBeGreaterThanOrEqual(6);
  expect(completed.stageState.finaleActivation).toEqual([20, 18, -121]);

  await page.screenshot({ path: 'artifacts/verify-level5-to-6/stage5-portal-open.png' });
  await hooks(page, 'setBotIntent', 0, -1, false, false);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 8_000 });
  await hooks(page, 'setBotIntent', Number.NaN, 0, false, false);
  await expect(page.locator('#stage-complete')).toBeVisible();
  await expect(page.locator('#sc-number')).toHaveText('5');
  await expect(page.locator('#sc-name')).toHaveText('THE CORE');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6, null, { timeout: 20_000 });
  await expect(page.locator('#nexus-stage6-warning')).toContainText('ROBOTS ARE NEARBY, BE AWARE');
  await expect(page.locator('#nexus-stage5-completion')).toBeHidden();
  await expect(page.locator('#hud-intro')).toBeHidden();
  await expect(page.locator('#nexus-controls-overlay')).toBeHidden();
  await page.waitForFunction(() => {
    const warning = document.getElementById('nexus-stage6-warning');
    const controls = document.getElementById('nexus-controls-overlay');
    return warning?.style.display === 'none' && controls?.style.display === 'flex';
  }, null, { timeout: 5_000 });
  expect((await diag(page)).state).not.toBe('PLAYING');
  await page.locator('#btn-controls-dismiss').click();
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
    null,
    { timeout: 5_000 },
  );
  expect((await hooks(page, 'getState') as { portalOpen: boolean }).portalOpen).toBe(true);
  expect((await hooks(page, 'getState') as { portalPosition: number[] }).portalPosition).toEqual([0, 2.2, -139]);
  await hooks(page, 'damagePlayer', 1000);
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__?.getState().dying === false, null, { timeout: 8_000 });
  expect((await hooks(page, 'getState') as { portalOpen: boolean }).portalOpen).toBe(true);
  await hooks(page, 'startStage', 6);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6, null, { timeout: 5_000 });
  expect((await hooks(page, 'getState') as { portalOpen: boolean }).portalOpen).toBe(true);
  expect((await hooks(page, 'getState') as { portalPosition: number[] }).portalPosition).toEqual([0, 2.2, -139]);
});

test('Level 6 red portal remains open and exits through the far sanctum ring', async ({ page }) => {
  await boot(page);
  await hooks(page, 'startStage', 6);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6, null, { timeout: 10_000 });
  await page.locator('#btn-controls-dismiss').click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING', null, { timeout: 5_000 });
  await hooks(page, 'teleportPlayer', 0, 4, -134);
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: 'artifacts/verify-level5-to-6/stage6-red-portal.png' });
  const portal = await hooks(page, 'getState') as { portalOpen: boolean; portalPosition: number[] };
  expect(portal.portalOpen).toBe(true);
  expect(portal.portalPosition).toEqual([0, 2.2, -139]);
  await hooks(page, 'teleportPlayer', 0, 2.2, -139);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 7, null, { timeout: 15_000 });
});

test('the Stage 10 campaign finale runs and shows the completion screen', async ({ page }) => {
  const { errors } = await boot(page);
  await hooks(page, 'setState', 'stage-10');
  await hooks(page, 'triggerAction', 'complete-stage');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'GAME_COMPLETE', null, { timeout: 20_000 });
  await expect(page.locator('#game-complete')).toBeVisible();
  await expect(page.locator('#game-complete')).toContainText('THE CORE HAS BEEN ACTIVATED');
  await expect(page.locator('#gc-stages')).toContainText('/ 10');
  expect(errors).toEqual([]);
});

test('combat campaign stages 6-10 load and render without errors', async ({ page }) => {
  const { errors } = await boot(page);
  for (let stage = 6; stage <= 10; stage += 1) {
    await hooks(page, 'setState', `stage-${stage}`);
    await page.waitForTimeout(300);
    const d = await diag(page);
    expect(d.stage).toBe(stage);
    expect(d.renderer.calls).toBeGreaterThan(5);
    expect(d.renderer.calls, `stage ${stage} draw calls`).toBeLessThanOrEqual(320);
    expect(d.renderer.triangles, `stage ${stage} triangles`).toBeLessThanOrEqual(750_000);
  }
  expect(errors).toEqual([]);
});

test('resizing the window resizes the canvas and keeps rendering', async ({ page }) => {
  const { errors } = await boot(page);
  await hooks(page, 'setState', 'active-play');
  await page.setViewportSize({ width: 900, height: 500 });
  await page.waitForTimeout(300);
  const d = await diag(page);
  expect(d.canvas.clientWidth).toBe(900);
  expect(d.canvas.clientHeight).toBe(500);
  expect(d.canvas.width).toBe(Math.floor(900 * d.canvas.dpr));
  const sample = await sampleCanvas(page);
  expect(sample.buckets).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});
