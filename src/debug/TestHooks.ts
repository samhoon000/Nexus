import type { Game } from '../core/Game';

/**
 * Installs the deterministic hooks the Playwright suite and the canvas inspector depend on.
 * Keep these real: silent no-ops make screenshot baselines flaky.
 */
export function installTestHooks(game: Game): void {
  window.__THREE_GAME_TEST_HOOKS__ = {
    seed: (value: number) => game.reseed(value),
    setState: async (name: string) => {
      await game.applyTestState(name);
      return { state: name };
    },
    setPausedForScreenshot: (paused: boolean) => game.setScreenshotPause(paused),
    setReducedMotion: (enabled: boolean) => game.setReducedMotion(enabled),
    hideDebugUi: (hidden: boolean) => game.debug.setHidden(hidden),
    // Gameplay helpers for automated playtests.
    teleportPlayer: (x: number, y: number, z: number) => game.teleportPlayer(x, y, z),
    grantEnergy: (count: number) => game.grantEnergy(count),
    startStage: (stage: number) => game.startStage(stage),
    getState: () => game.getDebugState(),
    triggerAction: (action: string) => game.triggerAction(action),
    setBotIntent: (x: number, z: number, jump: boolean, hold?: boolean) => game.setBotIntent(x, z, jump, hold),
    getPlatforms: () => game.getPlatformSnapshot(),
    setInputMode: (mode: 'pointer' | 'touch') => game.setInputMode(mode),
    defeatHostiles: () => {
      game.combat?.defeatHostiles();
    },
    damagePlayer: (amount: number) => game.combat?.damagePlayerForTest(amount),
    hostileAttackPlayer: () => game.combat?.hostileAttackPlayerForTest(),
    damageRobot: (robotId: string, amount: number) => game.combat?.damageRobotForTest(robotId, amount),
    spawnHostile: (x: number, y: number, z: number, id: string) => game.combat?.spawnHostileForTest(x, y, z, id),
  };
}

export function removeTestHooks(): void {
  window.__THREE_GAME_TEST_HOOKS__ = undefined;
  window.__THREE_GAME_DIAGNOSTICS__ = undefined;
}
