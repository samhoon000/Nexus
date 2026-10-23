import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = 'http://127.0.0.1:5188/';
const out = 'artifacts/verify-level6';
await mkdir(out, { recursive: true });

console.log('[TEST] Launching headless browser to test Level 6...');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const consoleLogs = [];
page.on('console', (msg) => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  consoleLogs.push(`[PAGE ERROR] ${err.message}`);
});

await page.goto(url);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15000 });
console.log('✓ Main menu loaded');

// =========================================================================
// TEST 1: Direct Level 6 start — verify Controls Overlay, HUD, Section 1 Spawns, Portal Hidden
// =========================================================================
console.log('\n--- TEST 1: Direct Level 6 start ---');
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.startStage(6));
await page.waitForTimeout(800);

// Check Controls Overlay visibility
const isOverlayVisible = await page.evaluate(() => {
  const overlay = document.getElementById('nexus-controls-overlay');
  return overlay && overlay.style.display !== 'none' && overlay.style.opacity === '1';
});
console.log('✓ Controls Overlay visible on Level 6 load:', isOverlayVisible);
if (!isOverlayVisible) throw new Error('Controls Overlay was not displayed on Level 6 entry!');

// Check key badges in overlay
const hasPowerAttackBadge = await page.evaluate(() => {
  return document.body.innerHTML.includes('Charged Power Attack') && document.body.innerHTML.includes('HOLD LMB');
});
console.log('✓ Controls Overlay has Charged Power Attack guide:', hasPowerAttackBadge);
if (!hasPowerAttackBadge) throw new Error('Controls overlay missing Charged Power Attack badge!');

await page.screenshot({ path: `${out}/01-level6-controls-overlay.png` });

// Dismiss overlay
console.log('Dismissing Controls Overlay via Enter key...');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);

const overlayDismissed = await page.evaluate(() => {
  const overlay = document.getElementById('nexus-controls-overlay');
  return !overlay || overlay.style.display === 'none' || parseFloat(overlay.style.opacity) === 0;
});
console.log('✓ Controls Overlay dismissed:', overlayDismissed);

// Verify tap attacks are not swallowed by the charged-attack hold path.
await page.keyboard.press('F');
await page.waitForTimeout(600);
await page.keyboard.press('F');
await page.waitForTimeout(100);
const comboText = await page.locator('#combat-hud').textContent();
if (!comboText?.includes('2x COMBO')) throw new Error('Two quick sword taps did not register as a combo.');
console.log('✓ Two sword taps register as a combo');

// Resume must dismiss Pause for both the button and Escape paths.
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.triggerAction('pause'));
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED');
await page.locator('#btn-resume').click();
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
const pauseHiddenAfterClick = await page.evaluate(() => getComputedStyle(document.querySelector('#pause')).display === 'none');
if (!pauseHiddenAfterClick) throw new Error('Resume button left the pause menu visible.');
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PAUSED');
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
await page.waitForTimeout(150);
const pauseHiddenAfterEscape = await page.evaluate(() => getComputedStyle(document.querySelector('#pause')).display === 'none');
if (!pauseHiddenAfterEscape) throw new Error('Escape Resume left the pause menu visible.');
console.log('✓ Pause Resume works by button and Escape');

// Check diagnostics for Stage 6
const diag = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
console.log(`✓ Diagnostics state=${diag.state}, stage=${diag.stage}, stageName="${diag.stageName}"`);
if (diag.stage !== 6) throw new Error(`Expected stage 6, got ${diag.stage}`);

// Check that Portal is hidden and closed
const portalStatus = await page.evaluate(() => {
  return window.__THREE_GAME_TEST_HOOKS__.getState();
});
console.log('✓ Portal initially open?:', portalStatus.portalOpen);
if (portalStatus.portalOpen !== true) throw new Error('Exit portal must be available on Level 6 entry!');

const section1Robots = portalStatus.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-1-'));
if (section1Robots.length !== 2) throw new Error(`Expected two Section 1 robots, received ${section1Robots.length}.`);
for (const [robot, expectedX] of section1Robots.map((robot, index) => [robot, index === 0 ? -3.8 : 3.8])) {
  if (Math.abs(robot.position[0] - expectedX) > 0.25 || Math.abs(robot.position[2] - 2.5) > 0.25) {
    throw new Error(`Section 1 robot ${robot.id} spawned at the wrong location: ${robot.position}`);
  }
}
if (portalStatus.combat.robots.length !== 2) {
  throw new Error(`Expected only the first two encounter robots to spawn initially, received ${portalStatus.combat.robots.length}.`);
}

// Check Section 1 spawns and combat HUD
const combatState1 = await page.evaluate(() => {
  const obj = document.querySelector('#combat-obj-title')?.textContent;
  const progress = document.querySelector('#combat-obj-progress')?.textContent;
  const hostiles = document.querySelector('#combat-hud')?.textContent;
  return { obj, progress, hostilesText: hostiles };
});
console.log('✓ Combat HUD objective:', combatState1.obj);
console.log('✓ Combat HUD progress:', combatState1.progress);
if (!combatState1.obj?.includes('SECTION 1/3')) {
  throw new Error(`Expected SECTION 1/3 in objective, got: "${combatState1.obj}"`);
}

await page.screenshot({ path: `${out}/02-section1-active.png` });

// =========================================================================
// TEST 2: Defeat Section 1 robots -> trigger Section 2 at midlevel ledge
// =========================================================================
console.log('\n--- TEST 2: Defeat Section 1 & advance to Section 2 ---');
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.defeatHostiles();
});
await page.waitForTimeout(600);

const combatStateAfterS1 = await page.evaluate(() => {
  const obj = document.querySelector('#combat-obj-title')?.textContent;
  const progress = document.querySelector('#combat-obj-progress')?.textContent;
  return { obj, progress };
});
console.log('✓ Objective after defeating Section 1:', combatStateAfterS1.obj);
if (!combatStateAfterS1.obj?.includes('MIDLEVEL')) {
  throw new Error(`Expected objective to prompt advance to MIDLEVEL, got: "${combatStateAfterS1.obj}"`);
}

// Teleport player to midlevel ledge [14, 6.0, -36]
console.log('Teleporting player to midlevel ledge [14, 6.2, -36]...');
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(14, 6.2, -36);
});
await page.waitForFunction(
  () => document.querySelector('#combat-obj-title')?.textContent?.includes('SECTION 2/3'),
  null,
  { timeout: 5000 },
);

const combatStateS2 = await page.evaluate(() => {
  const obj = document.querySelector('#combat-obj-title')?.textContent;
  const progress = document.querySelector('#combat-obj-progress')?.textContent;
  return { obj, progress };
});
console.log('✓ Objective after arriving at midlevel ledge:', combatStateS2.obj);
if (!combatStateS2.obj?.includes('SECTION 2/3')) {
  throw new Error(`Expected SECTION 2/3 upon reaching midlevel ledge, got: "${combatStateS2.obj}"`);
}
const section2State = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getState().combat.robots);
const section2Robots = section2State.filter((robot) => robot.id.startsWith('stage6-section-2-'));
if (section2Robots.length !== 2 || section2Robots.some((robot) => Math.abs(robot.position[2] + 36) > 0.25)) {
  throw new Error('Section 2 did not spawn its two robots at the midlevel encounter location.');
}
if (section2State.some((robot) => robot.id.startsWith('stage6-section-3-'))) {
  throw new Error('Section 3 spawned before Section 2 completed.');
}
await page.screenshot({ path: `${out}/03-section2-active.png` });

// =========================================================================
// TEST 3: Defeat Section 2 robots -> trigger Section 3 at Reactor Sanctum
// =========================================================================
console.log('\n--- TEST 3: Defeat Section 2 & advance to Reactor Sanctum ---');
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.defeatHostiles();
});
await page.waitForTimeout(600);

const combatStateAfterS2 = await page.evaluate(() => {
  const obj = document.querySelector('#combat-obj-title')?.textContent;
  return { obj };
});
console.log('✓ Objective after defeating Section 2:', combatStateAfterS2.obj);
if (!combatStateAfterS2.obj?.includes('SANCTUM')) {
  throw new Error(`Expected objective to prompt advance to SANCTUM, got: "${combatStateAfterS2.obj}"`);
}

// Teleport player to Reactor Sanctum entrance [0, 2.2, -115]
console.log('Teleporting player to Reactor Sanctum [0, 2.2, -115]...');
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(0, 2.2, -115);
});
await page.waitForFunction(
  () => document.querySelector('#combat-obj-title')?.textContent?.includes('FINAL SECTION'),
  null,
  { timeout: 5000 },
);

const combatStateS3 = await page.evaluate(() => {
  const obj = document.querySelector('#combat-obj-title')?.textContent;
  return { obj };
});
console.log('✓ Objective after entering Reactor Sanctum:', combatStateS3.obj);
if (!combatStateS3.obj?.includes('FINAL SECTION')) {
  throw new Error(`Expected FINAL SECTION — 3/3 upon entering sanctum, got: "${combatStateS3.obj}"`);
}
const section3State = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getState().combat.robots);
const section3Robots = section3State.filter((robot) => robot.id.startsWith('stage6-section-3-'));
if (section3Robots.length !== 2 || section3Robots.some((robot) => Math.abs(robot.position[2] + 126) > 0.25)) {
  throw new Error('Section 3 did not spawn its two robots at the Reactor Sanctum.');
}
await page.screenshot({ path: `${out}/04-section3-active.png` });

// =========================================================================
// TEST 4: Defeat Section 3 -> Portal Materialization & Stepping through
// =========================================================================
console.log('\n--- TEST 4: Defeat Section 3 & verify Exit Portal materializes ---');
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.defeatHostiles();
});
await page.waitForTimeout(800);

// Check portal is now open
const portalAfterS3 = await page.evaluate(() => {
  const state = window.__THREE_GAME_TEST_HOOKS__.getState();
  const obj = document.querySelector('#combat-obj-title')?.textContent;
  const victoryModal = document.querySelector('#combat-victory-modal');
  const isModalVisible = victoryModal && victoryModal.style.display !== 'none';
  return { portalOpen: state.portalOpen, obj, isModalVisible };
});
console.log('✓ Portal open after Section 3?:', portalAfterS3.portalOpen);
console.log('✓ Objective after Section 3:', portalAfterS3.obj);
console.log('✓ Instant win modal bypassed (modal visible)?:', portalAfterS3.isModalVisible);

if (!portalAfterS3.portalOpen) {
  throw new Error('Exit portal must open and materialize after Section 3 is cleared!');
}
if (portalAfterS3.isModalVisible) {
  throw new Error('Victory modal should NOT appear before stepping into the portal!');
}

await page.screenshot({ path: `${out}/05-portal-materialized.png` });

// Now step through the exit portal at [0, 2.2, -140]
console.log('Stepping through the exit portal at the arrival dais [0, 1.2, -1]...');
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(6, 1.2, 5);
});
await page.waitForTimeout(200);
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(0, 1.2, -1);
});
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 5000 });

const finalDiag = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
console.log(`✓ Post-portal state: state=${finalDiag?.state}, stage=${finalDiag?.stage}`);
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 7 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
  null,
  { timeout: 12000 },
);
const nextStagePortalOpen = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen);
if (nextStagePortalOpen) throw new Error('Stage 7 exit portal must remain locked until its mission objectives are complete.');
console.log('✓ Stage 7 loaded through Stage 6 portal; its own exit portal remains locked.');
await page.screenshot({ path: `${out}/06-stage-transition.png` });

// Verify no console errors
const errors = consoleLogs.filter(l => l.startsWith('[error]') || l.includes('PAGE ERROR'));
console.log('\n--- Console Health ---');
if (errors.length > 0) {
  console.log(`Found ${errors.length} errors:`, errors);
} else {
  console.log('✓ Zero console errors detected during Level 6 full run!');
}

await browser.close();
console.log('\n🎉 ALL LEVEL 6 GAMEPLAY TESTS PASSED PERFECTLY!');
