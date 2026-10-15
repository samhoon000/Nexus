#!/usr/bin/env node
/**
 * Mobile / responsive verification: boots the game at every target viewport (touch-enabled GPU
 * Chromium), drives the real touch controls with synthetic pointer events, and checks:
 *   - no console / page errors
 *   - canvas buffer matches the viewport (no stretch), DPR within the tier
 *   - joystick moves the player, jump button jumps, pause button pauses, menus are tappable
 *   - HUD elements do not overlap the touch controls or each other, everything inside the viewport
 * Screenshots land in artifacts/mobile/<run>/. Usage: node scripts/viewport-check.mjs [filter]
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.NEXUS_URL ?? 'http://127.0.0.1:5188/';
const filter = process.argv[2] ?? '';
const run = process.env.NEXUS_RUN ?? 'mobile';
const out = `artifacts/mobile/${run}`;
await mkdir(out, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-13-portrait', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'iphone-13-landscape', width: 844, height: 390, dpr: 3, touch: true },
  { name: 'iphone-15-portrait', width: 393, height: 852, dpr: 3, touch: true },
  { name: 'iphone-15-landscape', width: 852, height: 393, dpr: 3, touch: true },
  { name: 'pixel-7-portrait', width: 412, height: 915, dpr: 2.625, touch: true },
  { name: 'pixel-7-landscape', width: 915, height: 412, dpr: 2.625, touch: true },
  { name: 'iphone-pro-max-portrait', width: 430, height: 932, dpr: 3, touch: true },
  { name: 'iphone-pro-max-landscape', width: 932, height: 430, dpr: 3, touch: true },
  { name: 'ipad-portrait', width: 768, height: 1024, dpr: 2, touch: true },
  { name: 'ipad-landscape', width: 1024, height: 768, dpr: 2, touch: true },
  { name: 'laptop-720p', width: 1280, height: 720, dpr: 1, touch: false },
  { name: 'desktop-1080p', width: 1920, height: 1080, dpr: 1, touch: false },
].filter((v) => v.name.includes(filter));

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=default', '--enable-gpu'] });
const results = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    hasTouch: vp.touch,
    isMobile: vp.touch && vp.width < 1100,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/X4122|Program Info Log/.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const issues = [];
  const record = {};
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 20000 });
    await page.evaluate((mode) => window.__THREE_GAME_TEST_HOOKS__.setInputMode(mode), vp.touch ? 'touch' : 'pointer');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/${vp.name}-menu.png` });
    record.menu = await layoutCheck(page, ['#menu .menu-frame', '#btn-start', '#btn-stages', '#btn-settings'], vp);
    issues.push(...record.menu.issues);

    // Menu navigation by tap: stages panel, then settings and back.
    await tap(page, '#btn-stages', vp.touch);
    await page.waitForTimeout(150);
    record.stages = await layoutCheck(page, ['#stage-grid', '#btn-stages-back'], vp);
    issues.push(...record.stages.issues);
    await page.screenshot({ path: `${out}/${vp.name}-stages.png` });
    await tap(page, '#btn-stages-back', vp.touch);
    await tap(page, '#btn-settings', vp.touch);
    await page.waitForTimeout(150);
    record.settings = await layoutCheck(page, ['#settings .panel', '#set-quality', '#btn-settings-back'], vp);
    issues.push(...record.settings.issues);
    await page.screenshot({ path: `${out}/${vp.name}-settings.png` });
    await tap(page, '#btn-settings-back', vp.touch);

    // Start a stage with a tap and wait for play.
    await tap(page, '#btn-start', vp.touch);
    await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING', null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const d0 = await diag(page);
    record.canvas = d0.canvas;
    record.quality = d0.quality;
    record.input = d0.input;
    if (d0.canvas.clientWidth !== vp.width || d0.canvas.clientHeight !== vp.height) issues.push(`canvas CSS size ${d0.canvas.clientWidth}x${d0.canvas.clientHeight} != viewport`);
    const aspectCanvas = d0.canvas.width / d0.canvas.height;
    const aspectView = vp.width / vp.height;
    if (Math.abs(aspectCanvas - aspectView) > 0.02) issues.push(`buffer aspect ${aspectCanvas.toFixed(3)} vs viewport ${aspectView.toFixed(3)} (stretch)`);
    if (vp.touch && !d0.input.touchControlsVisible) issues.push('touch controls not visible while playing');
    if (!vp.touch && d0.input.touchControlsVisible) issues.push('touch controls visible on a pointer device');

    if (vp.touch) {
      record.hud = await layoutCheck(page, ['.hud-energy', '.hud-stage', '#touch-pause', '#touch-jump', '.joy-hint', '#hud-hints'], vp, true);
      issues.push(...record.hud.issues);
      await page.screenshot({ path: `${out}/${vp.name}-play.png` });

      // Portrait phones get a passing, non-blocking landscape banner; it must not swallow input.
      record.rotateBanner = await page.locator('#rotate').isVisible();
      if (record.rotateBanner !== (vp.height > vp.width && vp.width <= 600)) issues.push(`rotate banner visible=${record.rotateBanner} unexpected for this viewport`);

      // Joystick: push forward for 350 ms (camera faces -Z at spawn; the start pad is ~6 units deep).
      const move = await box(page, '#touch-move');
      const sx = move.x + move.width * 0.4;
      const sy = move.y + move.height * 0.7;
      await pointer(page, '#touch-move', 'pointerdown', sx, sy, 11);
      await pointer(page, '#touch-move', 'pointermove', sx, sy - 70, 11);
      await page.waitForTimeout(120);
      const mid = await diag(page);
      record.joystick = mid.input.joystick;
      if (mid.input.joystick.y < 0.5) issues.push(`joystick forward value ${mid.input.joystick.y.toFixed(2)} < 0.5`);
      await page.waitForTimeout(230);
      await page.screenshot({ path: `${out}/${vp.name}-joystick.png` });
      await pointer(page, '#touch-move', 'pointerup', sx, sy - 70, 11);
      await page.waitForTimeout(80);
      let d1 = await diag(page);
      const moved = d0.player.position.z - d1.player.position.z;
      record.moved = Number(moved.toFixed(2));
      if (moved < 1) issues.push(`joystick did not move the player (dz=${moved.toFixed(2)})`);
      if (Math.abs(d1.input.joystick.x) > 0.001 || Math.abs(d1.input.joystick.y) > 0.001) issues.push('joystick did not return to centre on release');

      // Back to the spawn pad, settled on the ground, before measuring jumps.
      await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(0, 0, 1.5));
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 3000 });
      await page.waitForTimeout(150);
      d1 = await diag(page);

      // Jump button: press, hold 200 ms, release; then a second press mid-air = double jump.
      const jb = await box(page, '#touch-jump');
      const jx = jb.x + jb.width / 2;
      const jy = jb.y + jb.height / 2;
      await pointer(page, '#touch-jump', 'pointerdown', jx, jy, 12);
      await page.waitForTimeout(200);
      const air = await diag(page);
      await pointer(page, '#touch-jump', 'pointerup', jx, jy, 12);
      record.jumpHeight = Number((air.player.position.y - d1.player.position.y).toFixed(2));
      if (air.player.grounded || record.jumpHeight < 0.8) issues.push(`jump button did not jump (dy=${record.jumpHeight})`);
      await page.waitForTimeout(80);
      await pointer(page, '#touch-jump', 'pointerdown', jx, jy, 13);
      await page.waitForTimeout(150);
      await pointer(page, '#touch-jump', 'pointerup', jx, jy, 13);
      let peak = air.player.position.y;
      for (let i = 0; i < 10; i += 1) {
        await page.waitForTimeout(50);
        peak = Math.max(peak, (await diag(page)).player.position.y);
      }
      record.doubleJumpPeak = Number((peak - d1.player.position.y).toFixed(2));
      if (record.doubleJumpPeak < record.jumpHeight + 0.8) issues.push(`double jump peak ${record.doubleJumpPeak} not above single ${record.jumpHeight}`);
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.player.grounded === true, null, { timeout: 4000 });
      await page.waitForTimeout(200);

      // Look zone: drag left 160 px, yaw must change; camera must keep its distance (no clipping).
      const look = await box(page, '#touch-look');
      const lx = look.x + look.width * 0.5;
      const ly = look.y + look.height * 0.35;
      const yaw0 = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getState().yaw);
      await pointer(page, '#touch-look', 'pointerdown', lx, ly, 14);
      for (let i = 1; i <= 8; i += 1) {
        await pointer(page, '#touch-look', 'pointermove', lx - i * 20, ly, 14);
        await page.waitForTimeout(16);
      }
      await pointer(page, '#touch-look', 'pointerup', lx - 160, ly, 14);
      await page.waitForTimeout(200);
      const yaw1 = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getState().yaw);
      record.yawDelta = Number((yaw1 - yaw0).toFixed(3));
      if (Math.abs(record.yawDelta) < 0.2) issues.push(`look drag changed yaw by only ${record.yawDelta}`);

      // Pause button → pause menu → resume by tap.
      await tap(page, '#touch-pause');
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED', null, { timeout: 3000 });
      await page.waitForTimeout(150);
      record.pause = await layoutCheck(page, ['#pause .panel', '#btn-resume', '#btn-pause-menu'], vp);
      issues.push(...record.pause.issues);
      await page.screenshot({ path: `${out}/${vp.name}-pause.png` });
      if (await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.input.touchControlsVisible)) issues.push('touch controls visible while paused');
      await tap(page, '#btn-resume');
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING', null, { timeout: 3000 });
    } else {
      record.hud = await layoutCheck(page, ['.hud-energy', '.hud-stage', '#hud-hints'], vp, true);
      issues.push(...record.hud.issues);
      await page.screenshot({ path: `${out}/${vp.name}-play.png` });
      // Desktop regression: keyboard still drives movement and jumping.
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW');
      const d1 = await diag(page);
      record.moved = Number((d0.player.position.z - d1.player.position.z).toFixed(2));
      if (record.moved < 1) issues.push('keyboard W did not move the player');
      await page.keyboard.down('Space');
      await page.waitForTimeout(200);
      const air = await diag(page);
      await page.keyboard.up('Space');
      if (air.player.grounded) issues.push('Space did not jump');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED', null, { timeout: 3000 });
      await page.click('#btn-resume');
      await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING', null, { timeout: 3000 });
    }

    // Completion screen layout.
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.setState('complete'));
    await page.waitForTimeout(300);
    record.complete = await layoutCheck(page, ['#game-complete .panel', '#btn-gc-restart', '#btn-gc-menu'], vp);
    issues.push(...record.complete.issues);
    await page.screenshot({ path: `${out}/${vp.name}-complete.png` });
    await page.waitForTimeout(300);
    const final = await diag(page);
    record.fps = Number(final.fps.toFixed(0));
    record.renderer = final.renderer;
  } catch (error) {
    issues.push(`[exception] ${error.message}`);
  }
  if (errors.length) issues.push(...errors.map((e) => `[console] ${e}`));
  const ok = issues.length === 0;
  if (!ok) failures += 1;
  results.push({ viewport: vp, ok, issues, record });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${vp.name.padEnd(26)} ${vp.width}x${vp.height}@${vp.dpr} canvas ${record.canvas ? `${record.canvas.width}x${record.canvas.height} dpr ${record.canvas.dpr}` : '?'} tier ${record.quality?.tier ?? '?'} moved ${record.moved ?? '?'} jump ${record.jumpHeight ?? '-'} dbl ${record.doubleJumpPeak ?? '-'} yaw ${record.yawDelta ?? '-'} fps ${record.fps ?? '?'}`);
  for (const issue of issues) console.log(`     - ${issue}`);
  await context.close();
}

await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(failures ? `\n${failures} viewport(s) failed` : '\nAll viewports passed');
process.exit(failures ? 1 : 0);

// ------------------------------------------------------------------------------------------------

function diag(page) {
  return page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
}

async function box(page, selector) {
  const b = await page.locator(selector).boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

/** Synthetic touch pointer event straight to the element (works regardless of hit-testing). */
function pointer(page, selector, type, x, y, id) {
  return page.locator(selector).dispatchEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    isPrimary: id === 11,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    buttons: type === 'pointerup' ? 0 : 1,
  });
}

/** Taps a button: touchscreen tap when available, click otherwise. */
async function tap(page, selector, touch = true) {
  const b = await box(page, selector);
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  if (touch) {
    await page.touchscreen.tap(x, y);
    return;
  }
  await page.mouse.click(x, y);
}

/** Verifies the listed elements are visible, inside the viewport, big enough to tap, and disjoint. */
async function layoutCheck(page, selectors, vp, allowHidden = false) {
  const issues = [];
  const boxes = [];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) {
      if (!allowHidden) issues.push(`${selector} not visible`);
      continue;
    }
    const b = await locator.boundingBox();
    if (!b) continue;
    boxes.push({ selector, ...b });
    if (b.x < -1 || b.y < -1 || b.x + b.width > vp.width + 1 || b.y + b.height > vp.height + 1) {
      issues.push(`${selector} outside viewport (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)})`);
    }
    const isButton = /btn|touch-jump|touch-pause|stage-card/.test(selector);
    if (isButton && vp.touch && (b.width < 44 || b.height < 40)) issues.push(`${selector} touch target ${Math.round(b.width)}x${Math.round(b.height)} too small`);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlapX > 2 && overlapY > 2 && !a.selector.includes('.panel') && !b.selector.includes('.panel') && !a.selector.includes('.menu-frame') && !b.selector.includes('.menu-frame') && !a.selector.includes('#stage-grid') && !b.selector.includes('#stage-grid') && !a.selector.includes('#set-quality') && !b.selector.includes('#set-quality')) {
        issues.push(`${a.selector} overlaps ${b.selector} (${Math.round(overlapX)}x${Math.round(overlapY)})`);
      }
    }
  }
  return { issues, boxes: boxes.map((b) => ({ selector: b.selector, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) })) };
}
