/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  state: string;
  stage: number;
  stageName: string;
  energy: number;
  energyRequired: number;
  energyTotal: number;
  checkpoint: number;
  deaths: number;
  complete: boolean;
  player: {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    speed: number;
    grounded: boolean;
    up: { x: number; y: number; z: number };
    gravityScale: number;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
    programs: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
  fps: number;
}

interface ThreeGameTestHooks {
  /** Re-seed the game RNG; all gameplay randomness must flow through it. */
  seed(value: number): void | Promise<void>;
  /** Acknowledge after setup/assets are ready; throw for unknown states. */
  setState(name: string): { state: string } | Promise<{ state: string }>;
  /** Stop simulation/state transitions immediately; keep rendering. Await optional synchronization. */
  setPausedForScreenshot(paused: boolean): void | Promise<void>;
  /** Stabilize ambient/idle visuals without requiring an unpaused simulation tick. */
  setReducedMotion(enabled: boolean): void | Promise<void>;
  /** Hide debug UI (lil-gui) before capturing. */
  hideDebugUi(hidden: boolean): void | Promise<void>;
  teleportPlayer(x: number, y: number, z: number): void;
  grantEnergy(count: number): void;
  startStage(stage: number): void;
  getState(): Record<string, unknown>;
  triggerAction(action: string): void;
  /** World-space steering for bots; pass NaN as x to release control. */
  setBotIntent(x: number, z: number, jump: boolean, hold?: boolean): void;
  getPlatforms(): Array<{ id: string; kind: string; pos: [number, number, number]; size: [number, number, number]; enabled: boolean }>;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
}
