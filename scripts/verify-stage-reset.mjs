import { chromium } from '@playwright/test';

const url = process.env.NEXUS_TEST_URL ?? 'http://127.0.0.1:5188/';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15000 });
  const hooks = (name, ...args) => page.evaluate(
    ([hookName, hookArgs]) => window.__THREE_GAME_TEST_HOOKS__[hookName](...hookArgs),
    [name, args],
  );

  await hooks('startStage', 7);
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 7
      && window.__THREE_GAME_TEST_HOOKS__.getState().combat?.hostileCount > 0,
    null,
    { timeout: 10000 },
  );
  const laterStage = await page.evaluate(() => ({
    combat: window.__THREE_GAME_TEST_HOOKS__.getState().combat,
    save: JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'),
  }));
  if (!laterStage.combat?.awakened || !laterStage.combat.hasArmor || !laterStage.combat.hasSword) {
    throw new Error('Stage 7 did not initialize its intended Cyan Knight equipment.');
  }
  if (laterStage.combat.hostileCount === 0) throw new Error('Stage 7 did not spawn its configured enemies.');
  const highestUnlocked = laterStage.save.highestUnlocked;

  await hooks('startStage', 1);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 1, null, { timeout: 5000 });
  await page.waitForTimeout(2500);
  const replay = await page.evaluate(() => ({
    combat: window.__THREE_GAME_TEST_HOOKS__.getState().combat,
    save: JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'),
  }));
  if (replay.combat?.hostileCount !== 0 || replay.combat?.robots?.length !== 0 || replay.combat?.companionCount !== 0) {
    throw new Error(`Stale later-level robot entities remain in Stage 1: ${JSON.stringify(replay.combat)}`);
  }
  if (replay.combat?.awakened || replay.combat?.hasArmor || replay.combat?.hasSword || replay.combat?.hasGun) {
    throw new Error('Later-level armor or weapons remained equipped in Stage 1.');
  }
  if (replay.save.highestUnlocked !== highestUnlocked) throw new Error('Starting Level 1 changed permanent unlock progress.');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
  console.log('Stage 7 equipment/enemy initialization and Level 1 replay cleanup passed; permanent unlock progress was preserved.');
} finally {
  await browser.close();
}