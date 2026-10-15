#!/usr/bin/env node
// Quick developer smoke run: loads the game in GPU Chromium, drives a few inputs via the test
// hooks and reports console errors, diagnostics and screenshots. Usage: node scripts/smoke.mjs [state]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.NEXUS_URL ?? 'http://127.0.0.1:5188/';
const state = process.argv[2] ?? 'active-play';
const out = 'artifacts/smoke';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=default', '--enable-gpu'] });
const dpr = Number(process.env.NEXUS_DPR ?? 1);
const page = await browser.newPage({ viewport: { width: Number(process.env.NEXUS_W ?? 1280), height: Number(process.env.NEXUS_H ?? 720) }, deviceScaleFactor: dpr });
const errors = [];
const infos = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  else if (m.text().includes('[NEXUS]')) infos.push(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(url);
await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5, null, { timeout: 15000 });
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15000 });
await page.screenshot({ path: `${out}/menu.png` });

await page.evaluate((s) => window.__THREE_GAME_TEST_HOOKS__.setState(s), state);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/${state}-start.png` });
const before = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

// Walk forward, jump, double jump.
await page.keyboard.down('KeyW');
await page.waitForTimeout(500);
await page.keyboard.press('Space');
await page.waitForTimeout(250);
await page.keyboard.press('Space');
await page.waitForTimeout(700);
await page.keyboard.up('KeyW');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/${state}-moved.png` });
const after = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

console.log('BEFORE', JSON.stringify({ state: before.state, stage: before.stage, pos: before.player.position, grounded: before.player.grounded }));
console.log('AFTER ', JSON.stringify({ state: after.state, stage: after.stage, pos: after.player.position, grounded: after.player.grounded, energy: after.energy }));
console.log('RENDER', JSON.stringify(after.renderer), 'fps', after.fps.toFixed(1), 'canvas', JSON.stringify(after.canvas));
console.log(infos.join('\n'));
console.log(errors.length ? `ERRORS (${errors.length}):\n${errors.join('\n')}` : 'NO CONSOLE ERRORS');
await browser.close();
