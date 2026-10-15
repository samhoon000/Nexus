#!/usr/bin/env node
/**
 * Scripted playtest: for each stage, steers the player platform-to-platform in definition order
 * using the game's own physics (world-space bot intent). The bot predicts its landing point from
 * live velocity and gravity, taps or holds the jump by gap size, brakes in the air when it would
 * overshoot, double-jumps only when it would fall short, and waits for moving / blink platforms.
 * Legs that need gravity frames, rotating bars or teleporters are skipped by teleporting.
 *
 * Usage: node scripts/bot-playtest.mjs [stage|all]
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.NEXUS_URL ?? 'http://127.0.0.1:5188/';
const which = process.argv[2] ?? 'all';
const stages = which === 'all' ? [1, 2, 3, 4, 5] : [Number(which)];
const out = 'artifacts/bot';
await mkdir(out, { recursive: true });

const GRAVITY = 30;
const CENTER_HEIGHT = 0.6;

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const infos = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  else if (m.text().includes('[NEXUS]')) infos.push(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('crash', () => errors.push('[crash] page crashed'));
page.on('framenavigated', (f) => { if (f === page.mainFrame()) errors.push(`[navigation] ${f.url()} at ${new Date().toISOString()}`); });
await page.goto(url);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 20000 });

const hooks = (fn, ...args) => page.evaluate(([f, a]) => window.__THREE_GAME_TEST_HOOKS__[f](...a), [fn, args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** One round trip: diagnostics + live platforms. */
const snapshot = async () => {
  const t0 = Date.now();
  const result = await page.evaluate(() => ({ d: window.__THREE_GAME_DIAGNOSTICS__, p: window.__THREE_GAME_TEST_HOOKS__.getPlatforms() }));
  const took = Date.now() - t0;
  if (took > 2000) errors.push(`[stall] snapshot took ${took}ms (frame ${result.d?.frame}, state ${result.d?.state})`);
  return result;
};

function footprint(p) {
  return { minX: p.pos[0] - p.size[0] / 2, maxX: p.pos[0] + p.size[0] / 2, minZ: p.pos[2] - p.size[2] / 2, maxZ: p.pos[2] + p.size[2] / 2 };
}
const inside = (f, x, z, pad = 0) => x > f.minX - pad && x < f.maxX + pad && z > f.minZ - pad && z < f.maxZ + pad;

/** Distance along direction d until leaving footprint f from point (x,z). */
function exitDistance(f, x, z, dx, dz) {
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (f.maxX - x) / dx);
  if (dx < -1e-6) t = Math.min(t, (f.minX - x) / dx);
  if (dz > 1e-6) t = Math.min(t, (f.maxZ - z) / dz);
  if (dz < -1e-6) t = Math.min(t, (f.minZ - z) / dz);
  return t;
}

/** Shortest horizontal distance from (x,z) to footprint f (0 when inside). */
function gapTo(f, x, z) {
  const dx = Math.max(f.minX - x, 0, x - f.maxX);
  const dz = Math.max(f.minZ - z, 0, z - f.maxZ);
  return Math.hypot(dx, dz);
}

/** Predicted landing xz given current position/velocity and target top height. */
function predictLanding(d, targetTop, gravityScale) {
  const g = GRAVITY * gravityScale;
  const p = d.player.position;
  const v = d.player.velocity;
  const dy = p.y - (targetTop + CENTER_HEIGHT);
  const disc = v.y * v.y + 2 * g * dy;
  const t = disc < 0 ? 0 : (v.y + Math.sqrt(disc)) / g;
  return { x: p.x + v.x * t, z: p.z + v.z * t, t };
}

const report = [];

for (const stage of stages) {
  await hooks('setState', `stage-${stage}`);
  // Optional phase offset (ms) to probe moving-platform timing sensitivity: NEXUS_BOT_PHASE_MS=400.
  await sleep(300 + Number(process.env.NEXUS_BOT_PHASE_MS ?? 0));
  const { p: platforms } = await snapshot();
  const stageReport = { stage, legs: [], deaths: 0, energy: 0, portalOpen: false };

  for (let fromIndex = 0; fromIndex < platforms.length - 1; fromIndex += 1) {
    const toIndex = fromIndex + 1;
    const from = platforms[fromIndex];
    const to = platforms[toIndex];
    const far = Math.hypot(to.pos[0] - from.pos[0], to.pos[2] - from.pos[2]) > 22;
    const tall = Math.abs(to.pos[1] - from.pos[1]) > 9 && from.kind !== 'moving' && to.kind !== 'moving';
    const special = ['wall', 'ceiling', 'corridor'].includes(from.id) || ['wall', 'ceiling', 'corridor'].includes(to.id) || from.kind === 'rotating' || to.kind === 'rotating';
    const leg = { from: from.id, to: to.id, result: 'pending', seconds: 0, deaths: 0 };
    const beforeDeaths = (await snapshot()).d.deaths;

    if (far || tall || special) {
      const live = (await snapshot()).p[toIndex];
      await hooks('teleportPlayer', live.pos[0], live.pos[1], live.pos[2]);
      await sleep(250);
      leg.result = 'skipped';
      stageReport.legs.push(leg);
      continue;
    }

    // Activator-gated platforms: power them (the bot does not path to activator pads).
    if (!(await snapshot()).p[toIndex].enabled && to.kind === 'static') {
      await hooks('triggerAction', 'activate-groups');
      await sleep(1400);
    }

    // Make sure we start on `from`.
    {
      const { d, p } = await snapshot();
      if (!inside(footprint(p[fromIndex]), d.player.position.x, d.player.position.z, 0.2) || !d.player.grounded) {
        await hooks('teleportPlayer', p[fromIndex].pos[0], p[fromIndex].pos[1], p[fromIndex].pos[2]);
        await sleep(300);
      }
    }

    const start = Date.now();
    let doubleUsed = false;
    let hold = true;
    let enabledSince = 0;
    let lastEnabled = null;
    const trace = [];
    let lastPos = null;
    while (Date.now() - start < 20000) {
      const { d, p } = await snapshot();
      {
        const q = d.player.position;
        if (lastPos && Math.hypot(q.x - lastPos.x, q.y - lastPos.y, q.z - lastPos.z) > 6) {
          leg.result = 'ok';
          leg.note = 'teleported';
          break;
        }
        lastPos = { x: q.x, y: q.y, z: q.z };
        trace.push(`f${d.frame} ${d.state} ${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}${d.player.grounded ? 'g' : 'a'}`);
      }
      const target = p[toIndex];
      const current = p[fromIndex];
      const fTarget = footprint(target);
      const fCurrent = footprint(current);
      const px = d.player.position.x;
      const pz = d.player.position.z;
      const py = d.player.position.y;
      const now = Date.now();
      if (target.enabled !== lastEnabled) {
        // A platform already lit at first sight has unknown remaining time: wait for a fresh cycle.
        if (target.enabled) enabledSince = lastEnabled === null ? -Infinity : now;
        lastEnabled = target.enabled;
      }

      if (d.deaths > beforeDeaths) {
        leg.result = 'died';
        break;
      }
      if (d.player.grounded && inside(fTarget, px, pz, 0.1) && Math.abs(py - (target.pos[1] + CENTER_HEIGHT)) < 0.9) {
        leg.result = 'ok';
        break;
      }

      // Direction to the target centre.
      let dx = target.pos[0] - px;
      let dz = target.pos[2] - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-3) {
        dx /= dist;
        dz /= dist;
      }

      if (d.player.grounded) {
        doubleUsed = false;
        const exit = exitDistance(fCurrent, px, pz, dx, dz);
        const gap = gapTo(fTarget, px, pz);
        const rise = target.pos[1] - current.pos[1];
        const moving = target.kind === 'moving' || current.kind === 'moving';
        const blink = target.kind === 'blink';
        const notReady =
          !target.enabled ||
          (moving && (gap > 4.5 || Math.abs(rise) > 1.6)) ||
          (blink && now - enabledSince > 500);
        if (notReady && exit < 1.0) {
          await hooks('setBotIntent', 0, 0, false, false);
          await sleep(40);
          continue;
        }
        const ledge = exit < 0.45;
        const climb = rise > 0.4 && gap < 1.2 && exit < 1.6;
        const jump = ledge || climb;
        // Hold for long or high jumps; tap for short hops.
        hold = d.player.gravityScale < 0.9 ? false : gap > 2.8 || rise > 0.9;
        await hooks('setBotIntent', dx, dz, jump, hold);
      } else {
        const landing = predictLanding(d, target.pos[1], d.player.gravityScale);
        const willLand = inside(fTarget, landing.x, landing.z, -0.15);
        const falling = d.player.velocity.y < 0;
        // Overshoot check: does the landing point lie beyond the target centre along our travel?
        const vx = d.player.velocity.x;
        const vz = d.player.velocity.z;
        const along = (landing.x - target.pos[0]) * vx + (landing.z - target.pos[2]) * vz;
        const overshoot = !willLand && along > 0;
        let jump = false;
        if (!willLand && !overshoot && falling && !doubleUsed && gapTo(fTarget, landing.x, landing.z) > 0.2) {
          jump = true;
          doubleUsed = true;
        }
        // Steer: brake when overshooting, otherwise toward the centre.
        const sx = overshoot ? -dx : dx;
        const sz = overshoot ? -dz : dz;
        await hooks('setBotIntent', sx, sz, jump, hold || jump);
      }
      await sleep(25);
    }
    await hooks('setBotIntent', NaN, 0, false);
    if (leg.result === 'pending') leg.result = 'timeout';
    leg.seconds = (Date.now() - start) / 1000;
    const afterDeaths = (await snapshot()).d.deaths;
    leg.deaths = afterDeaths - beforeDeaths;
    if (leg.result !== 'ok') {
      if (trace.length) console.log(`     trace: ${trace.slice(-6).join(' | ')}`);
      // Let the death fade / respawn finish before relocating, or the respawn would undo it.
      for (let i = 0; i < 40; i += 1) {
        const s = await hooks('getState');
        if (!s.dying) break;
        await sleep(50);
      }
      const live = (await snapshot()).p[toIndex];
      await hooks('teleportPlayer', live.pos[0], live.pos[1], live.pos[2]);
      await sleep(300);
    }
    stageReport.legs.push(leg);
    console.log(`stage ${stage}  ${leg.result.padEnd(8)} ${leg.seconds.toFixed(1).padStart(5)}s  ${leg.from} → ${leg.to}`);
  }

  const { d: finalDiag } = await snapshot();
  const state = await hooks('getState');
  stageReport.deaths = finalDiag.deaths;
  stageReport.energy = finalDiag.energy;
  stageReport.portalOpen = state.portalOpen;
  await page.screenshot({ path: `${out}/stage-${stage}-end.png` });
  report.push(stageReport);
  const ok = stageReport.legs.filter((l) => l.result === 'ok').length;
  const failed = stageReport.legs.filter((l) => l.result === 'died' || l.result === 'timeout');
  console.log(`== Stage ${stage}: ${ok}/${stageReport.legs.length} legs ok, ${stageReport.legs.filter((l) => l.result === 'skipped').length} skipped, ${failed.length} failed, deaths ${stageReport.deaths}, energy ${stageReport.energy}/${finalDiag.energyTotal} (req ${finalDiag.energyRequired}), portal ${stageReport.portalOpen}`);
  for (const f of failed) console.log(`   FAILED ${f.result}: ${f.from} → ${f.to}`);
}

await writeFile(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
console.log(infos.join('\n'));
console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'NO CONSOLE ERRORS');
await browser.close();
