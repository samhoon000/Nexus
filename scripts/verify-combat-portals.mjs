import { chromium } from '@playwright/test';

const url = 'http://127.0.0.1:5188/';
const portalPositions = {
  7: [0, 0, -98],
  8: [0, 0, -105],
  9: [0, 0, -115],
  10: [0, 0, 40],
};
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

const hooks = (name, ...args) => page.evaluate(
  ([hookName, hookArgs]) => window.__THREE_GAME_TEST_HOOKS__[hookName](...hookArgs),
  [name, args],
);

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15000 });

  for (let stage = 7; stage <= 10; stage += 1) {
    if (stage === 7) {
      await hooks('startStage', stage);
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 7 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
    } else {
      const [x, y, z] = portalPositions[stage - 1];
      await hooks('teleportPlayer', x, y, z);
      await page.waitForFunction(
        (nextStage) => window.__THREE_GAME_DIAGNOSTICS__?.stage === nextStage && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
        stage,
        { timeout: 12000 },
      );
    }

    const initial = await hooks('getState');
    if (initial.portalOpen) throw new Error(`Stage ${stage} portal opened before its mission was complete.`);
    console.log(`Stage ${stage}: mission loaded; exit portal is locked.`);

    let waveCount = 0;
    while (true) {
      await hooks('defeatHostiles');
      waveCount += 1;
      const opened = await page.waitForFunction(
        () => {
          const state = window.__THREE_GAME_TEST_HOOKS__.getState();
          return state.portalOpen || state.combat?.hostileCount > 0;
        },
        null,
        { timeout: 8000, polling: 100 },
      ).then(() => hooks('getState'));
      if (opened.portalOpen) break;
      if (waveCount > 10) throw new Error(`Stage ${stage} did not finish within 10 objective clears.`);
      await page.waitForTimeout(250);
    }

    console.log(`Stage ${stage}: completion recorded after ${waveCount} hostile-wave clear(s); one portal is open.`);
    if (stage === 7) {
      const deaths = (await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.deaths)) ?? 0;
      await hooks('triggerAction', 'hazard-death');
      await page.waitForFunction(
        (previousDeaths) => (window.__THREE_GAME_DIAGNOSTICS__?.deaths ?? 0) > previousDeaths
          && window.__THREE_GAME_TEST_HOOKS__.getState().dying === false,
        deaths,
        { timeout: 5000 },
      );
      const afterDeath = await hooks('getState');
      if (!afterDeath.portalOpen) throw new Error('Stage 7 portal closed after an environmental death.');
      console.log('Stage 7: unlocked portal remains open after environmental respawn.');
    }
    const [x, y, z] = portalPositions[stage];
    await hooks('teleportPlayer', x, y, z);
    if (stage < 10) {
      await page.waitForFunction(
        (nextStage) => window.__THREE_GAME_DIAGNOSTICS__?.stage === nextStage && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
        stage + 1,
        { timeout: 15000 },
      );
      const next = await hooks('getState');
      if (next.portalOpen) throw new Error(`Stage ${stage + 1} portal opened prematurely after transition.`);
      console.log(`Stage ${stage}: portal entry loaded Stage ${stage + 1}; next portal remains locked.`);
    } else {
      await page.waitForFunction(
        () => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE',
        null,
        { timeout: 5000 },
      );
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'GAME_COMPLETE', null, { timeout: 20000 });
      console.log('Stage 10: portal entry completed the campaign finale.');
    }
  }

  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log('Stages 7-10 portal progression passed with no browser errors.');
} finally {
  await browser.close();
}
