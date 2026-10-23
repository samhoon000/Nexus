import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const url = 'http://127.0.0.1:5188/';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const hooks = async (name, ...args) => page.evaluate(([method, values]) => {
  const hook = window.__THREE_GAME_TEST_HOOKS__;
  if (!hook) throw new Error('NEXUS test hooks are unavailable');
  return hook[method](...values);
}, [name, args]);
const state = () => hooks('getState');
const pause = (ms) => page.waitForTimeout(ms);

function assertNear(actual, expected, label, epsilon = 0.3) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: expected ${expected}, got ${actual}`);
}

function assertPosition(actual, expected, label) {
  assert.ok(Array.isArray(actual) && actual.length === 3, `${label}: missing position`);
  for (let axis = 0; axis < 3; axis += 1) assertNear(actual[axis], expected[axis], `${label}[${axis}]`);
}

async function startStage6() {
  await hooks('startStage', 6);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.stage === 6
    && window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
  await page.keyboard.press('Enter');
}

async function respawnAfter(cause, activateDeath) {
  const before = await state();
  await activateDeath();
  await page.waitForFunction(({ previousDeaths }) => {
    const current = window.__THREE_GAME_TEST_HOOKS__?.getState();
    return current?.deaths > previousDeaths && !current.dying && current.combat?.health === 100;
  }, { previousDeaths: before.deaths }, { timeout: 8000 });
  const after = await state();
  assert.equal(after.deathCause, cause, `expected death cause ${cause}`);
  assert.equal(after.portalOpen, true, 'Stage 6 exit portal must remain open after respawn');
  return after;
}

async function activateCheckpoint(id, pos) {
  await hooks('teleportPlayer', ...pos);
  await page.waitForFunction((expectedId) => window.__THREE_GAME_TEST_HOOKS__?.getState()?.checkpointId === expectedId,
    id, { timeout: 5000 });
  return state();
}

async function waitForSectionRobot(id) {
  await page.waitForFunction((robotId) => {
    const robots = window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.robots ?? [];
    const robot = robots.find((candidate) => candidate.id === robotId);
    return robot && robot.state !== 'SPAWNING';
  }, id, { timeout: 7000 });
}

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'MENU', null, { timeout: 15000 });

  console.log('Test A: no checkpoint, hostile death returns to original Stage 6 spawn');
  await startStage6();
  let current = await state();
  assert.equal(current.portalOpen, true, 'Stage 6 portal should be open while Section 1 hostiles are alive');
  assert.equal(current.checkpointId, null);
  await hooks('teleportPlayer', -3.8, 1.2, 2.5);
  await page.waitForFunction(() => {
    const robots = window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.robots ?? [];
    return robots.some((robot) => robot.faction === 'hostile' && robot.state !== 'SPAWNING');
  });
  current = await respawnAfter('combat', () => hooks('hostileAttackPlayer'));
  assertPosition(current.position, [0, 1.8, 9], 'original spawn body center');
  assert.equal(current.combat.lifeState, 'ALIVE');
  assert.equal(current.combat.hostileCount, 2);
  console.log('  passed');

  console.log('Test B: checkpoint 1 then 2, repeated combat deaths and manual checkpoint restart');
  current = await activateCheckpoint('stage6-checkpoint-1', [0, 6, -50]);
  assert.equal(current.checkpoint, 0);
  current = await activateCheckpoint('stage6-checkpoint-2', [0, 8, -107]);
  assert.equal(current.checkpoint, 1);
  assert.deepEqual(current.checkpointPosition, [0, 8, -107]);
  let activeRobot = current.combat.robots.find((robot) =>
    robot.id.startsWith('stage6-section-1-') && robot.faction === 'hostile' && !robot.defeated,
  );
  await waitForSectionRobot(activeRobot.id);
  await hooks('teleportPlayer', ...activeRobot.position);
  current = await respawnAfter('combat', () => hooks('hostileAttackPlayer'));
  assert.equal(current.checkpointId, 'stage6-checkpoint-2');
  assertPosition(current.position, [0, 8.6, -107], 'checkpoint 2 body center');
  activeRobot = current.combat.robots.find((robot) =>
    robot.id.startsWith('stage6-section-1-') && robot.faction === 'hostile' && !robot.defeated,
  );
  await waitForSectionRobot(activeRobot.id);
  await hooks('teleportPlayer', ...activeRobot.position);
  current = await respawnAfter('combat', () => hooks('hostileAttackPlayer'));
  assert.equal(current.checkpointId, 'stage6-checkpoint-2');
  assertPosition(current.position, [0, 8.6, -107], 'repeated checkpoint 2 body center');
  await hooks('triggerAction', 'pause');
  await page.locator('#btn-restart-checkpoint').click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'PLAYING');
  current = await state();
  assert.equal(current.checkpointId, 'stage6-checkpoint-2');
  assertPosition(current.position, [0, 8.6, -107], 'manual checkpoint restart body center');
  console.log('  passed');

  console.log('Test C: environmental fall after Section 1 completion preserves defeated robots');
  await hooks('defeatHostiles');
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.stage6Progress?.completedSections?.includes(1));
  current = await respawnAfter('fall', () => hooks('triggerAction', 'die'));
  const section1 = current.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-1-'));
  assert.equal(section1.length, 2);
  assert.ok(section1.every((robot) => robot.defeated));
  assert.deepEqual(current.combat.stage6Progress.completedSections, [1]);
  console.log('  passed');

  console.log('Test D: environmental hazard during Section 2 preserves one defeat and one live robot');
  await hooks('teleportPlayer', 14, 6, -36);
  const section2Ids = ['stage6-section-2-robot-1', 'stage6-section-2-robot-2'];
  await Promise.all(section2Ids.map(waitForSectionRobot));
  await hooks('damageRobot', section2Ids[0], 1000);
  current = await state();
  assert.equal(current.combat.robots.find((robot) => robot.id === section2Ids[0]).defeated, true);
  current = await respawnAfter('hazard', () => hooks('triggerAction', 'hazard-death'));
  const section2 = current.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-2-'));
  assert.equal(section2.length, 2);
  assert.equal(section2.filter((robot) => robot.defeated).length, 1);
  assert.equal(section2.filter((robot) => !robot.defeated).length, 1);
  assert.deepEqual(current.combat.stage6Progress.completedSections, [1]);
  console.log('  passed');

  console.log('Test E: hostile-combat death resets only active Section 2 at checkpoint 2');
  activeRobot = current.combat.robots.find((robot) =>
    robot.id.startsWith('stage6-section-2-') && robot.faction === 'hostile' && !robot.defeated,
  );
  await waitForSectionRobot(activeRobot.id);
  await hooks('teleportPlayer', ...activeRobot.position);
  current = await respawnAfter('combat', () => hooks('hostileAttackPlayer'));
  const resetSection2 = current.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-2-'));
  assert.equal(resetSection2.length, 2);
  assert.ok(resetSection2.every((robot) => !robot.defeated && robot.health === 100));
  assert.equal(current.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-1-') && !robot.defeated && robot.faction === 'hostile').length, 0);
  assert.equal(current.checkpointId, 'stage6-checkpoint-2');
  assertPosition(current.position, [0, 8.6, -107], 'combat restart checkpoint body center');
  console.log('  passed');

  console.log('Test F: rebooted allies follow safely and damage genuine hostiles');
  await hooks('teleportPlayer', 14, 6, -36);
  await Promise.all(section2Ids.map(waitForSectionRobot));
  await hooks('damageRobot', section2Ids[0], 1000);
  await hooks('teleportPlayer', 10, 6, -36);
  await page.keyboard.press('E');
  await page.waitForFunction(() => {
    const ally = window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.robots?.find((robot) => robot.id === 'stage6-section-2-robot-1');
    return ally?.faction === 'companion' && !ally.defeated;
  }, null, { timeout: 3000 });
  await hooks('damageRobot', section2Ids[1], 1000);
  await hooks('teleportPlayer', 18, 6, -36);
  await page.keyboard.press('E');
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.companionCount === 2, null, { timeout: 3000 });
  current = await state();
  assert.equal(current.combat.hostileCount, 0);
  assert.equal(current.combat.robots.filter((robot) => robot.faction === 'companion').length, 2);
  const playerHealth = current.combat.health;
  await pause(1200);
  current = await state();
  assert.equal(current.combat.health, playerHealth, 'allies must not damage the player without hostiles');
  assert.ok(current.combat.robots.filter((robot) => robot.faction === 'companion')
    .every((robot) => !['TELEGRAPH', 'ATTACK'].includes(robot.state)), 'allies should follow/idle rather than attack the player');

  await hooks('spawnHostile', 12.5, 6, -36, 'stage6-test-hostile-ally-ai');
  await page.waitForFunction(() => {
    const target = window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.robots?.find((robot) => robot.id === 'stage6-test-hostile-ally-ai');
    return target && target.state !== 'SPAWNING';
  }, null, { timeout: 5000 });
  const initialHostileHealth = (await state()).combat.robots.find((robot) => robot.id === 'stage6-test-hostile-ally-ai').health;
  await page.waitForFunction((initialHealth) => {
    const target = window.__THREE_GAME_TEST_HOOKS__?.getState()?.combat?.robots?.find((robot) => robot.id === 'stage6-test-hostile-ally-ai');
    return target && target.health < initialHealth;
  }, initialHostileHealth, { timeout: 12000, polling: 100 });
  current = await state();
  assert.equal(current.combat.robots.filter((robot) => robot.id === 'stage6-section-2-robot-1').length, 1);
  assert.equal(current.combat.robots.filter((robot) => robot.id === 'stage6-section-2-robot-2').length, 1);
  assert.equal(current.combat.robots.find((robot) => robot.id === 'stage6-test-hostile-ally-ai').faction, 'hostile');
  await hooks('teleportPlayer', 0, 2.2, -115);
  await Promise.all(['stage6-section-3-robot-1', 'stage6-section-3-robot-2'].map(waitForSectionRobot));
  activeRobot = (await state()).combat.robots.find((robot) =>
    robot.id.startsWith('stage6-section-3-') && robot.faction === 'hostile' && !robot.defeated,
  );
  await waitForSectionRobot(activeRobot.id);
  await hooks('teleportPlayer', ...activeRobot.position);
  current = await respawnAfter('combat', () => hooks('hostileAttackPlayer'));
  assert.equal(current.combat.robots.filter((robot) => robot.faction === 'companion').length, 2,
    'combat reset must retain successfully rebooted allies');
  assert.ok(current.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-3-robot-') && robot.faction === 'hostile').length >= 2,
    'only the active Section 3 hostile group should respawn after the combat death');
  assert.equal(new Set(current.combat.robots.map((robot) => robot.id)).size, current.combat.robots.length,
    'robot instance IDs must remain unique after encounter reset');
  console.log('  passed');

  console.log('Test G: three sections complete once; portal survives environmental respawn');
  await hooks('defeatHostiles');
  await hooks('teleportPlayer', 0, 2.2, -115);
  const section3Ids = ['stage6-section-3-robot-1', 'stage6-section-3-robot-2'];
  await Promise.all(section3Ids.map(waitForSectionRobot));
  await hooks('defeatHostiles');
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__?.getState()?.portalOpen === true, null, { timeout: 3000 });
  current = await state();
  assert.deepEqual(current.combat.stage6Progress.completedSections, [1, 2, 3]);
  assert.equal(current.combat.stage6Progress.finished, true);
  assert.equal(current.combat.robots.filter((robot) => robot.id.startsWith('stage6-section-3-')).length, 2);
  current = await respawnAfter('hazard', () => hooks('triggerAction', 'hazard-death'));
  assert.equal(current.portalOpen, true);
  assert.deepEqual(current.combat.stage6Progress.completedSections, [1, 2, 3]);
  await hooks('teleportPlayer', 6, 1.2, 5);
  await pause(200);
  await hooks('teleportPlayer', 0, 1.2, -1);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'STAGE_COMPLETE', null, { timeout: 5000 });
  await pause(500);
  assert.equal((await state()).stage, 6, 'portal transition must fire only once');
  console.log('  passed');

  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  console.log('All Level 6 checkpoint, death-cause, persistence, reboot, and portal tests passed.');
} finally {
  await browser.close();
}
