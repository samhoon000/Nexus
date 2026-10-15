#!/usr/bin/env node
/**
 * Player-character evidence: boots the game headless, visits every stage, records renderer
 * stats (draw calls, triangles) and the player diagnostics, and saves a close-up crop of the
 * player at spawn plus a mid-jump frame. Used to baseline the placeholder robot and to verify
 * the NEXUS GLB character after integration.
 *
 * Usage: node scripts/character-check.mjs [--url http://127.0.0.1:5188/] [--out artifacts/character] [--mobile]
 */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const url = flag('--url', process.env.NEXUS_URL ?? 'http://127.0.0.1:5188/');
const out = flag('--out', 'artifacts/character');
const mobile = argv.includes('--mobile');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext(
  mobile
    ? { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }
    : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
);
const page = await context.newPage();
const errors = [];
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  else if (m.text().includes('[NEXUS]')) logs.push(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 20000 });

const hooks = (fn, ...args) => page.evaluate(([f, a]) => window.__THREE_GAME_TEST_HOOKS__[f](...a), [fn, args]);
const diag = () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Crops the canvas screenshot to a box around the player (screen centre, lower half). */
async function cropPlayer(file, { scale = 1 } = {}) {
  const buffer = await page.locator('#game-canvas').screenshot();
  const png = PNG.sync.read(buffer);
  const w = Math.round(png.width * 0.26 * scale);
  const h = Math.round(png.height * 0.5 * scale);
  const x0 = Math.round(png.width / 2 - w / 2);
  const y0 = Math.round(png.height * 0.56 - h / 2);
  const crop = new PNG({ width: w, height: h });
  PNG.bitblt(png, crop, Math.max(0, x0), Math.max(0, y0), Math.min(w, png.width - x0), Math.min(h, png.height - y0), 0, 0);
  await writeFile(file, PNG.sync.write(crop));
  return { width: png.width, height: png.height };
}

/** Waits until the player stands still on the ground, then lets the pose settle. */
async function waitSettled() {
  await page.waitForFunction(
    () => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true && (window.__THREE_GAME_DIAGNOSTICS__?.player.speed ?? 1) < 0.2,
    null,
    { timeout: 8000 },
  );
  await sleep(700);
}

/** Captures `frames` player crops at ~`intervalMs` and lays them out side by side. */
async function captureStrip(file, frames, intervalMs) {
  const crops = [];
  for (let i = 0; i < frames; i += 1) {
    const png = PNG.sync.read(await page.locator('#game-canvas').screenshot());
    const w = Math.round(png.width * 0.2);
    const h = Math.round(png.height * 0.42);
    const x0 = Math.round(png.width / 2 - w / 2);
    const y0 = Math.round(png.height * 0.56 - h / 2);
    const crop = new PNG({ width: w, height: h });
    PNG.bitblt(png, crop, x0, y0, w, h, 0, 0);
    crops.push(crop);
    await sleep(intervalMs);
  }
  const strip = new PNG({ width: crops[0].width * crops.length, height: crops[0].height });
  crops.forEach((crop, i) => PNG.bitblt(crop, strip, 0, 0, crop.width, crop.height, i * crop.width, 0));
  await writeFile(file, PNG.sync.write(strip));
}

const report = { url, mobile, stages: [], errors, logs };
for (let stage = 1; stage <= 5; stage += 1) {
  await hooks('setState', `stage-${stage}`);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
  await sleep(700);
  const d = await diag();
  const full = await page.locator('#game-canvas').screenshot();
  await writeFile(`${out}/stage-${stage}${mobile ? '-mobile' : ''}.png`, full);
  await cropPlayer(`${out}/stage-${stage}${mobile ? '-mobile' : ''}-player.png`);
  // Mid-jump frame (real input through the bot intent so the animation state machine runs).
  await hooks('setBotIntent', 0, 0, true, true);
  await sleep(230);
  const air = await diag();
  await cropPlayer(`${out}/stage-${stage}${mobile ? '-mobile' : ''}-jump.png`);
  await hooks('setBotIntent', NaN, 0, false);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 5000 });
  report.stages.push({
    stage,
    name: d.stageName,
    calls: d.renderer.calls,
    triangles: d.renderer.triangles,
    geometries: d.renderer.geometries,
    textures: d.renderer.textures,
    programs: d.renderer.programs,
    fps: d.fps,
    player: d.player,
    airborne: { grounded: air.player.grounded, y: air.player.position.y },
    canvas: d.canvas,
    quality: d.quality,
  });
  console.log(`stage ${stage} ${d.stageName.padEnd(14)} character ${d.player.character}  calls ${String(d.renderer.calls).padStart(4)}  tris ${String(d.renderer.triangles).padStart(7)}  geo ${d.renderer.geometries}  prog ${d.renderer.programs}  fps ${d.fps.toFixed(0)}  airborne ${!air.player.grounded}`);
  if (d.player.character !== 'glb') errors.push(`stage ${stage}: player character is '${d.player.character}', expected 'glb'`);
}
// Locomotion frames on stage 1: run, fall, landing crouch, then idle facing the camera.
const suffix = mobile ? '-mobile' : '';
await hooks('setState', 'stage-1');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
await sleep(300);
await hooks('setBotIntent', 0, -1, false, false);
await sleep(450);
const run = await diag();
report.run = { speed: run.player.speed, position: run.player.position };
await cropPlayer(`${out}/run${suffix}-player.png`);
await hooks('setBotIntent', NaN, 0, false);
console.log(`run speed ${run.player.speed.toFixed(2)}`);
await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.speed ?? 1) < 0.2);
await hooks('setBotIntent', 0, 0, true, true);
await sleep(620);
const falling = await diag();
await cropPlayer(`${out}/fall${suffix}-player.png`);
await hooks('setBotIntent', NaN, 0, false);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 5000 });
await sleep(40);
await cropPlayer(`${out}/land${suffix}-player.png`);
console.log(`fall frame vertical speed ${falling.player.velocity.y.toFixed(2)} grounded ${falling.player.grounded}`);
// Side-view run strip across the camera on the 9 m activator plaza (x 7.5..16.5). The bot turns
// around near each edge so the strip also shows the turn, and the player never leaves the deck.
await hooks('teleportPlayer', 8.5, 2, -74);
await sleep(300);
let stripDirection = 1;
await hooks('setBotIntent', stripDirection, 0, false, false);
// Patrol independently of the (slow, DPR 2) screenshot cadence: poll the position on a timer.
let patrolBusy = false;
const patrol = setInterval(async () => {
  if (patrolBusy) return;
  patrolBusy = true;
  try {
    const x = (await diag()).player.position.x;
    const next = x > 14.2 ? -1 : x < 9.8 ? 1 : stripDirection;
    if (next !== stripDirection) {
      stripDirection = next;
      await hooks('setBotIntent', stripDirection, 0, false, false);
    }
  } finally {
    patrolBusy = false;
  }
}, 40);
await sleep(150);
await captureStrip(`${out}/run-strip${suffix}.png`, 6, 0);
clearInterval(patrol);
await hooks('setBotIntent', NaN, 0, false);
await sleep(200);
// Front view from the open activator plaza: walk toward the camera (+Z), then stop.
await hooks('teleportPlayer', 12, 2, -74);
await sleep(250);
await hooks('setBotIntent', 0, 1, false, false);
await sleep(320);
await hooks('setBotIntent', NaN, 0, false);
await sleep(600);
await cropPlayer(`${out}/front${suffix}-player.png`);
await writeFile(`${out}/front${suffix}.png`, await page.locator('#game-canvas').screenshot());

// Stage 3 gravity frames: the sideways wall and the inverted ceiling.
await hooks('setState', 'stage-3');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
await sleep(300);
await hooks('teleportPlayer', 30, 14, -61);
await hooks('setBotIntent', 1, 0, false, false);
await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.up.x ?? 0) < -0.9, null, { timeout: 6000 });
await hooks('setBotIntent', NaN, 0, false);
await waitSettled();
const wall = await diag();
await writeFile(`${out}/gravity-wall${suffix}.png`, await page.locator('#game-canvas').screenshot());
await cropPlayer(`${out}/gravity-wall${suffix}-player.png`);
console.log(`sideways wall up ${wall.player.up.x.toFixed(2)},${wall.player.up.y.toFixed(2)} grounded ${wall.player.grounded}`);
await hooks('teleportPlayer', 36, 4, -104);
await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.up.y ?? 0) < -0.9, null, { timeout: 6000 });
await waitSettled();
const ceiling = await diag();
await writeFile(`${out}/gravity-ceiling${suffix}.png`, await page.locator('#game-canvas').screenshot());
await cropPlayer(`${out}/gravity-ceiling${suffix}-player.png`);
console.log(`inverted ceiling up ${ceiling.player.up.y.toFixed(2)} grounded ${ceiling.player.grounded} y ${ceiling.player.position.y.toFixed(2)}`);
report.gravity = { wall: wall.player, ceiling: ceiling.player };

await writeFile(`${out}/report${mobile ? '-mobile' : ''}.json`, JSON.stringify(report, null, 2));
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
