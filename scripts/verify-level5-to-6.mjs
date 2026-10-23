import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.NEXUS_TEST_URL ?? 'http://127.0.0.1:5188/';
const evidenceDir = 'artifacts/verify-level5-to-6';
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(url);
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15000 });
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.startStage(5));
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 5 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
  null,
  { timeout: 10000 },
);

const stage5Start = await page.evaluate(() => ({
  portalOpen: window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen,
  controlsVisible: document.getElementById('nexus-controls-overlay')?.style.display === 'flex',
  platforms: window.__THREE_GAME_TEST_HOOKS__.getPlatforms(),
  worldObjects: window.__THREE_GAME_TEST_HOOKS__.getState().worldObjects,
  platformVisibility: window.__THREE_GAME_TEST_HOOKS__.getState().platformVisibility,
}));
if (stage5Start.portalOpen || stage5Start.controlsVisible) throw new Error('Stage 5 started with a Level 6 control or open exit portal.');
if (stage5Start.platforms.some((platform) => platform.id.includes('core-plaza')
  || (platform.pos[0] > 15 && platform.pos[0] < 25 && platform.pos[2] < -118
    && platform.pos[2] > -130 && (platform.size[0] >= 4 || platform.size[2] >= 4)))) {
  throw new Error(`Stage 5 still contains the oversized finale platform: ${JSON.stringify(stage5Start.platforms)} `);
}
if (stage5Start.worldObjects.some((object) => object.childNames.includes('decor-armorUpgrade'))) {
  throw new Error('The removed armour-upgrade deck is still registered in the live Stage 5 decor group.');
}

await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(20, 17.1, -117));
await page.waitForTimeout(100);
await page.screenshot({ path: `${evidenceDir}/stage5-upgrade-structure.png` });
const upgradePlatforms = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getPlatforms().filter((platform) => platform.id.includes('armor-upgrade')));
if (upgradePlatforms.length !== 0) throw new Error(`Removed Stage 5 armour platform collider was recreated: ${JSON.stringify(upgradePlatforms)}`);
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE'
    && window.__THREE_GAME_TEST_HOOKS__.getState().cinematicCamera,
  null,
  { timeout: 5000 },
);
const cinematicStart = await page.evaluate(() => ({
  state: window.__THREE_GAME_DIAGNOSTICS__?.state,
  camera: window.__THREE_GAME_TEST_HOOKS__.getState().cinematicCamera,
  platforms: window.__THREE_GAME_TEST_HOOKS__.getPlatforms(),
  worldObjects: window.__THREE_GAME_TEST_HOOKS__.getState().worldObjects,
  platformVisibility: window.__THREE_GAME_TEST_HOOKS__.getState().platformVisibility,
}));
if (cinematicStart.platforms.some((platform) => platform.id === 'stage5-exit-rise')) {
  throw new Error('The exit platform spawned before the armour cinematic finished.');
}
if (cinematicStart.worldObjects.some((object) => ['static-batches', 'portal'].includes(object.name) && object.visible)) {
  throw new Error('World platform batches or the portal remained visible during the armour cinematic.');
}
if (cinematicStart.platformVisibility.some((platform) => platform.visible)) {
  throw new Error(`Stage 5 platform trim meshes remained visible during the cinematic: ${JSON.stringify(cinematicStart.platformVisibility)}`);
}
await page.waitForTimeout(6000);
await page.screenshot({ path: `${evidenceDir}/stage5-armor-assembly.png` });
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING' && window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen,
  null,
  { timeout: 30000, polling: 100 },
);
await page.waitForFunction(() => {
  const platforms = window.__THREE_GAME_TEST_HOOKS__.getPlatforms();
  return platforms.filter((platform) => platform.id === 'stage5-exit-rise' && platform.enabled).length === 1;
}, null, { timeout: 5000 });
const afterArmor = await page.evaluate(() => ({
  message: document.getElementById('nexus-stage5-completion')?.innerText ?? '',
  state: window.__THREE_GAME_DIAGNOSTICS__?.state,
  stage: window.__THREE_GAME_DIAGNOSTICS__?.stage,
  portalOpen: window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen,
  portalPosition: window.__THREE_GAME_TEST_HOOKS__.getState().portalPosition,
  cinematicCamera: window.__THREE_GAME_TEST_HOOKS__.getState().cinematicCamera,
  worldObjects: window.__THREE_GAME_TEST_HOOKS__.getState().worldObjects,
  platformVisibility: window.__THREE_GAME_TEST_HOOKS__.getState().platformVisibility,
  activation: window.__THREE_GAME_TEST_HOOKS__.getState().finaleActivation,
  combat: window.__THREE_GAME_TEST_HOOKS__.getState().combat,
  save: JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'),
  legacyPrompt: document.body.innerText.includes('PRESS CONTINUE TO COMPLETE LEVEL 5'),
  platforms: window.__THREE_GAME_TEST_HOOKS__.getPlatforms(),
}));
if (afterArmor.message || afterArmor.state !== 'PLAYING' || afterArmor.stage !== 5 || !afterArmor.portalOpen) {
  throw new Error('Armor completion must restore control and open the exit without completing Stage 5.');
}
if (String(afterArmor.activation) !== '20,16.5,-117') throw new Error('Unexpected Stage 5 activation location.');
const exitBlocks = afterArmor.platforms.filter((platform) => platform.id === 'stage5-exit-rise');
if (exitBlocks.length !== 1 || exitBlocks.some((platform) => !platform.enabled)) throw new Error('The single rising exit platform did not settle with collision enabled.');
if (afterArmor.cinematicCamera) throw new Error('The cinematic camera did not restore to gameplay mode.');
if (afterArmor.worldObjects.some((object) => ['static-batches', 'portal'].includes(object.name) && !object.visible)) {
  throw new Error('Gameplay world visibility was not restored after the armour cinematic.');
}
if (!afterArmor.platformVisibility.some((platform) => platform.id === 'stage5-exit-rise' && platform.visible)) {
  throw new Error('The single Stage 5 exit platform was not visible after the armour cinematic.');
}
if (afterArmor.legacyPrompt) throw new Error('Obsolete Stage 5 Continue prompt remains.');
if (!afterArmor.combat?.awakened || !afterArmor.combat.hasArmor || !afterArmor.combat.hasSword) {
  throw new Error('Armor transformation did not attach the intended Stage 5 equipment.');
}
await page.screenshot({ path: `${evidenceDir}/stage5-portal-route.png` });

await page.evaluate(async () => {
  const hooks = window.__THREE_GAME_TEST_HOOKS__;
  hooks.setBotIntent(0, -1, true);
  await new Promise((resolve) => setTimeout(resolve, 850));
  hooks.setBotIntent(NaN, 0, false);
});
const platformLanding = await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.getState());
if (!platformLanding.grounded || Math.abs(platformLanding.position[2] - -122.5) > 1.8) {
  throw new Error(`Player did not jump onto and land on the single rising platform: ${JSON.stringify(platformLanding)}`);
}
await page.evaluate(async () => {
  const hooks = window.__THREE_GAME_TEST_HOOKS__;
  hooks.setBotIntent(0, -1, true);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  hooks.setBotIntent(NaN, 0, false);
});
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE'
    && document.getElementById('nexus-stage5-completion')?.classList.contains('visible') === true,
  null,
  { timeout: 8000, polling: 100 },
);
const stage5Complete = await page.evaluate(() => ({
  message: document.getElementById('nexus-stage5-completion')?.innerText ?? '',
  state: window.__THREE_GAME_DIAGNOSTICS__?.state,
  stage: window.__THREE_GAME_DIAGNOSTICS__?.stage,
  portalOpen: window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen,
  save: JSON.parse(localStorage.getItem('nexus.save.v1') ?? '{}'),
  showcases: document.querySelectorAll('#nexus-stage5-completion').length,
}));
if (!stage5Complete.message.includes('LEVEL 5 COMPLETED') || !stage5Complete.message.includes('ARMOR IS BONDED')) {
  throw new Error(`Stage 5 completion messages missing after entering portal: ${stage5Complete.message}`);
}
if (stage5Complete.state !== 'STAGE_COMPLETE' || stage5Complete.stage !== 5 || stage5Complete.showcases !== 1) {
  throw new Error('Stage 5 must complete exactly once after portal entry.');
}
if (!stage5Complete.save.completed?.includes(5) || stage5Complete.save.highestUnlocked < 6) throw new Error('Stage 5 completion was not saved.');
await page.screenshot({ path: `${evidenceDir}/stage5-bonding-complete.png` });

await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6, null, { timeout: 20000, polling: 100 });
await page.waitForFunction(
  () => document.getElementById('nexus-stage6-warning')?.classList.contains('visible') === true,
  null,
  { timeout: 5000 },
);
const warningState = await page.evaluate(() => ({
  text: document.getElementById('nexus-stage6-warning')?.textContent,
  controlsVisible: document.getElementById('nexus-controls-overlay')?.style.display === 'flex',
  state: window.__THREE_GAME_DIAGNOSTICS__?.state,
  portalOpen: window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen,
  portalPosition: window.__THREE_GAME_TEST_HOOKS__.getState().portalPosition,
}));
if (warningState.text !== 'ROBOTS ARE NEARBY, BE AWARE') throw new Error('Level 6 warning text is missing or incorrect.');
if (warningState.controlsVisible) throw new Error('Level 6 warning and controls guide overlap.');
if (warningState.state === 'PLAYING') throw new Error('Level 6 gameplay started before Continue.');
if (!warningState.portalOpen || String(warningState.portalPosition) !== '0,2.2,-139') throw new Error('Level 6 far-end portal is not open at the expected position.');
await page.screenshot({ path: `${evidenceDir}/stage6-warning.png` });

await page.waitForFunction(() => {
  const warning = document.getElementById('nexus-stage6-warning');
  const controls = document.getElementById('nexus-controls-overlay');
  return warning?.style.display === 'none' && controls?.style.display === 'flex' && controls.style.opacity === '1';
}, null, { timeout: 6000 });
await page.screenshot({ path: `${evidenceDir}/stage6-controls-guide.png` });
await page.locator('#btn-controls-dismiss').click();
await page.waitForTimeout(350);
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6 && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
  null,
  { timeout: 10000 },
);
const stage6State = await page.evaluate(() => ({
  portalOpen: window.__THREE_GAME_TEST_HOOKS__.getState().portalOpen,
  robots: window.__THREE_GAME_TEST_HOOKS__.getState().combat?.robots ?? [],
  objective: document.querySelector('#combat-obj-title')?.textContent ?? '',
}));
if (!stage6State.portalOpen) throw new Error('Level 6 portal closed after deployment.');
if (!stage6State.objective.includes('SECTION 1/3')) throw new Error('Level 6 first encounter did not initialize.');
const liveSection1 = stage6State.robots.filter((robot) => robot.id.startsWith('stage6-section-1-') && !robot.defeated);
if (liveSection1.length !== 2) throw new Error(`Expected two live Section 1 robots; got ${liveSection1.length}.`);
await page.screenshot({ path: `${evidenceDir}/stage6-gameplay.png` });

await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.teleportPlayer(0, 2.2, -139));
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 7, null, { timeout: 15000 });
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.startStage(5));
await page.waitForFunction(
  () => window.__THREE_GAME_DIAGNOSTICS__?.stage === 5
    && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING',
  null,
  { timeout: 5000 },
);
const restarted = await page.evaluate(() => ({
  state: window.__THREE_GAME_TEST_HOOKS__.getState(),
  platforms: window.__THREE_GAME_TEST_HOOKS__.getPlatforms(),
}));
const restartedStage5 = restarted.state;
const restartedPlatforms = restarted.platforms;
if (restartedPlatforms.some((platform) => platform.id === 'stage5-exit-rise' || platform.id.includes('core-plaza'))) {
  throw new Error('Restarting Stage 5 retained a stale finale platform or restored the oversized plaza.');
}
if (restartedStage5.portalOpen || restartedStage5.cinematicCamera) throw new Error('Stage 5 restart retained finale state or camera.');
if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
console.log('Level 5 geometry removal, armour camera/state, single rising platform jump and portal progression, and restart cleanup passed.');
await browser.close();
