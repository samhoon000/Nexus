#!/usr/bin/env node
/**
 * Drives the sections the platform bot skips: Stage 3 sideways wall + inverted ceiling + teleporters,
 * Stage 5 sideways wall, Stage 2 rotating platform ride. Prints PASS/FAIL per check.
 * Usage: node scripts/gravity-check.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.NEXUS_URL ?? 'http://127.0.0.1:5188/';
await mkdir('artifacts/gravity', { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 20000 });

const hooks = (fn, ...args) => page.evaluate(([f, a]) => window.__THREE_GAME_TEST_HOOKS__[f](...a), [fn, args]);
const diag = () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const fmt = (v) => `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`;

/** Steer in world space until predicate passes or timeout. */
async function steerUntil(dx, dz, predicate, timeoutMs, jump = false) {
  const start = Date.now();
  let d = await diag();
  let jumped = false;
  while (Date.now() - start < timeoutMs) {
    d = await diag();
    if (predicate(d)) break;
    const doJump = jump && !jumped;
    jumped = jumped || doJump;
    await hooks('setBotIntent', dx, dz, doJump, true);
    await sleep(30);
  }
  await hooks('setBotIntent', NaN, 0, false);
  return d;
}

// ---------------------------------------------------------------- Stage 3: sideways wall
await hooks('setState', 'stage-3');
await sleep(300);
await hooks('teleportPlayer', 30, 14, -61); // island, near its +X edge
await sleep(300);
let d = await steerUntil(1, 0, (s) => s.player.up.x < -0.9 && s.player.grounded, 6000);
check('S3 sideways zone flips gravity to -X and lands on the wall', d.player.up.x < -0.9 && d.player.grounded, `up ${fmt(d.player.up)} pos ${fmt(d.player.position)}`);
const wallStart = d.player.position;
d = await steerUntil(0, -1, (s) => s.player.position.z < wallStart.z - 8 || s.deaths > 0, 6000);
check('S3 walks along the wall (-Z) while staying attached', d.player.position.z < wallStart.z - 8 && Math.abs(d.player.position.x - 35.4) < 0.4 && d.deaths === 0, `pos ${fmt(d.player.position)}`);
await page.screenshot({ path: 'artifacts/gravity/s3-wall.png' });
d = await steerUntil(0, -1, (s) => s.player.up.y > 0.9 && s.player.grounded && s.player.position.z < -81, 9000);
check('S3 leaving the wall restores gravity and lands on the pad below', d.player.up.y > 0.9 && d.player.grounded && d.player.position.y > 3 && d.player.position.y < 4.5 && d.deaths === 0, `pos ${fmt(d.player.position)} deaths ${d.deaths}`);

// ---------------------------------------------------------------- Stage 3: inverted ceiling
d = await steerUntil(0, -1, (s) => s.player.up.y < -0.9 && s.player.grounded, 8000);
check('S3 inverted zone flips gravity to -Y and lands on the ceiling', d.player.up.y < -0.9 && d.player.grounded && Math.abs(d.player.position.y - 11.4) < 0.4, `up ${fmt(d.player.up)} pos ${fmt(d.player.position)}`);
await page.screenshot({ path: 'artifacts/gravity/s3-ceiling.png' });
const ceilStart = d.player.position;
d = await steerUntil(0, -1, (s) => s.player.position.z < ceilStart.z - 6 || s.deaths > 0, 6000);
check('S3 walks along the ceiling', d.player.position.z < ceilStart.z - 6 && d.deaths === 0, `pos ${fmt(d.player.position)}`);
d = await steerUntil(0, -1, (s) => s.player.up.y > 0.9 && s.player.grounded && s.player.position.z < -114, 9000);
check('S3 leaving the ceiling drops onto the landing pad', d.player.up.y > 0.9 && d.player.grounded && d.player.position.y > 2 && d.player.position.y < 3.5 && d.deaths === 0, `pos ${fmt(d.player.position)} deaths ${d.deaths}`);
const energyBefore = d.energy;
check('S3 orbs along wall/ceiling were collectable', d.energy >= 4, `energy ${d.energy}`);
void energyBefore;

// ---------------------------------------------------------------- Stage 3: teleporter C → D, and no bounce back
d = await steerUntil(0, -1, (s) => Math.abs(s.player.position.x) < 5, 6000);
check('S3 teleporter C relocates the player to the final plaza', Math.abs(d.player.position.x) < 3 && d.player.position.z > -140 && d.player.position.z < -133, `pos ${fmt(d.player.position)}`);
await sleep(1600);
d = await diag();
check('S3 arrival pad does not bounce the player back', d.player.position.z > -140 && d.player.position.z < -133, `pos ${fmt(d.player.position)}`);
d = await steerUntil(0, -1, (s) => s.player.position.z < -138.2, 4000);
d = await steerUntil(0, 1, (s) => s.player.position.x > 20, 4000);
check('S3 re-entering the arrival pad after leaving it teleports back', Math.abs(d.player.position.x - 36) < 3, `pos ${fmt(d.player.position)}`);

// ---------------------------------------------------------------- Stage 5: sideways wall (+X up)
await hooks('setState', 'stage-5');
await sleep(300);
await hooks('teleportPlayer', -1.5, 6, -26);
await sleep(300);
d = await steerUntil(-1, 0, (s) => s.player.up.x > 0.9 && s.player.grounded, 6000);
check('S5 sideways zone flips gravity to +X and lands on the wall', d.player.up.x > 0.9 && d.player.grounded, `up ${fmt(d.player.up)} pos ${fmt(d.player.position)}`);
d = await steerUntil(0, -1, (s) => s.player.up.y > 0.9 && s.player.grounded && s.player.position.z < -44, 10000);
check('S5 wall walk ends on the landing pad with normal gravity', d.player.up.y > 0.9 && d.player.grounded && d.player.position.y > 1 && d.player.position.y < 2.5 && d.deaths === 0, `pos ${fmt(d.player.position)} deaths ${d.deaths}`);
await page.screenshot({ path: 'artifacts/gravity/s5-landing.png' });

// ---------------------------------------------------------------- Stage 2: rotating platform ride
await hooks('setState', 'stage-2');
await sleep(300);
await hooks('teleportPlayer', -5.6, 12, -100);
await sleep(600);
const a0 = await diag();
await sleep(2000);
const a1 = await diag();
const ang = (p) => Math.atan2(p.z + 100, p.x + 4);
const delta = Math.abs(ang(a1.player.position) - ang(a0.player.position));
check('S2 rotating platform carries a standing player around its pivot', a1.player.grounded && delta > 0.4 && Math.abs(a1.player.position.y - 12.6) < 0.3, `angle Δ ${delta.toFixed(2)} rad, pos ${fmt(a1.player.position)}`);

// ---------------------------------------------------------------- Stage 2: hazards in Stage 4 kill
await hooks('setState', 'stage-4');
await sleep(300);
await hooks('teleportPlayer', -2.2, 4, -100); // next to the side beam
await sleep(300);
d = await steerUntil(-1, 0, (s) => s.deaths > 0, 3000);
check('S4 energy beam kills on contact', d.deaths > 0, `deaths ${d.deaths}`);

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'NO CONSOLE ERRORS');
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
