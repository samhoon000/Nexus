#!/usr/bin/env node
// Captures the Stage 5 Core sequence at several moments plus a stage-complete transition frame.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.NEXUS_URL ?? 'http://127.0.0.1:5188/';
const out = 'artifacts/finale';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 20000 });
const hooks = (fn, ...args) => page.evaluate(([f, a]) => window.__THREE_GAME_TEST_HOOKS__[f](...a), [fn, args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Stage 1 complete → transition frame.
await hooks('setState', 'stage-1');
await hooks('grantEnergy', 8);
await hooks('teleportPlayer', 12, 2, -102.5);
await hooks('setBotIntent', 0, -1, false, false);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 8000 });
await hooks('setBotIntent', NaN, 0, false);
await sleep(1800);
await page.screenshot({ path: `${out}/stage-complete.png` });

// Stage 5 finale from the core plaza.
await hooks('setState', 'stage-5');
await hooks('grantEnergy', 14);
await hooks('teleportPlayer', 20, 17, -127.5);
await hooks('setBotIntent', 0, -1, false, false);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 8000 });
await hooks('setBotIntent', NaN, 0, false);
const t0 = Date.now();
for (const at of [1000, 2200, 4500, 7500]) {
  await sleep(Math.max(0, at - (Date.now() - t0)));
  await page.screenshot({ path: `${out}/core-${at}.png` });
}
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'GAME_COMPLETE', null, { timeout: 15000 });
await sleep(600);
await page.screenshot({ path: `${out}/game-complete.png` });
console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'NO CONSOLE ERRORS');
await browser.close();
