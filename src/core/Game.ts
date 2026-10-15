import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { GameLoop } from './GameLoop';
import { GameState, type GameStateName } from './GameState';
import { EventBus } from './EventBus';
import { Input } from './Input';
import { MaterialLibrary } from '../effects/Materials';
import { TweenManager } from '../effects/Tween';
import { ParticleSystem } from '../effects/Particles';
import { Environment } from '../world/Environment';
import { World } from '../world/World';
import { Player } from '../player/Player';
import type { MoveIntent } from '../player/PlayerController';
import { CameraController } from '../camera/CameraController';
import { StageManager, STAGES } from '../stages/StageManager';
import type { StageContext } from '../stages/StageContext';
import type { StageDefinition } from '../stages/StageTypes';
import { UIManager } from '../ui/UIManager';
import { AudioManager } from '../audio/AudioManager';
import { SaveSystem, type Settings } from '../save/SaveSystem';
import { DebugTools } from '../debug/DebugTools';
import { installTestHooks, removeTestHooks } from '../debug/TestHooks';
import { createSeededRandom } from '../utils/random';
import { CAMERA, STAGE_COUNT } from '../utils/Constants';
import { GameFlow } from './GameFlow';

/**
 * Composition root. Owns every system and routes the frame through them in a fixed order:
 * input → fixed-step gameplay → camera → effects → UI → render.
 */
export class Game {
  readonly bus = new EventBus();
  readonly state = new GameState(this.bus);
  readonly scene: SceneManager;
  readonly input: Input;
  readonly materials = new MaterialLibrary();
  readonly tweens = new TweenManager();
  readonly particles: ParticleSystem;
  readonly environment: Environment;
  readonly world: World;
  readonly player: Player;
  readonly cameraController: CameraController;
  readonly stages: StageManager;
  readonly ui: UIManager;
  readonly audio: AudioManager;
  readonly save = new SaveSystem();
  readonly debug: DebugTools;
  readonly flow: GameFlow;
  readonly loop: GameLoop;

  rng = createSeededRandom(1);
  private screenshotPaused = false;
  private reducedMotion = false;
  private readonly intent: MoveIntent = {
    input: new THREE.Vector2(),
    forward: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    jumpPressed: false,
    jumpHeld: false,
  };
  private readonly look = new THREE.Vector2();
  private readonly ctx: StageContext;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  private fps = 0;
  private readonly onResize = (): void => {
    this.scene.resize();
    this.applyPixelScale();
  };

  constructor(readonly canvas: HTMLCanvasElement) {
    this.scene = new SceneManager(canvas);
    this.input = new Input(canvas);
    this.particles = new ParticleSystem(() => this.rng());
    this.scene.scene.add(this.particles.points);
    this.environment = new Environment(this.scene.scene, this.materials, () => this.rng());
    this.world = new World(this.scene.scene);
    this.player = new Player(this.materials, this.tweens);
    this.scene.scene.add(this.player.group);
    this.cameraController = new CameraController(this.scene.camera);
    this.ctx = {
      world: this.world,
      materials: this.materials,
      bus: this.bus,
      particles: this.particles,
      tweens: this.tweens,
      rng: () => this.rng(),
      theme: STAGES[0].theme,
    };
    this.flow = new GameFlow(this);
    this.stages = new StageManager(this.ctx, this.player, this.cameraController, {
      onStageComplete: (def) => this.flow.stageComplete(def),
      onFinaleReached: (def) => this.flow.finale(def),
    });
    this.audio = new AudioManager(this.bus, this.save.settings);
    this.ui = new UIManager(this.bus, this.save, {
      start: (stage) => this.flow.startRun(stage),
      resume: () => this.flow.resume(),
      restartCheckpoint: () => this.flow.restartCheckpoint(),
      mainMenu: () => this.flow.toMenu(),
      settingChanged: (key, value) => this.applySetting(key, value),
      restartRun: () => this.flow.startRun(1),
    });
    this.debug = new DebugTools(this);
    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      update: (delta, elapsed) => this.update(delta, elapsed),
      render: () => this.render(),
    });

    this.environment.applyTheme(STAGES[0].theme, true);
    this.applyAllSettings();
    this.bindFeedback();
    window.addEventListener('resize', this.onResize);
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.applyPixelScale();
    installTestHooks(this);
    this.publishDiagnostics();
  }

  private readonly onCanvasPointerDown = (): void => {
    if (this.state.is('PLAYING')) this.input.requestLock();
  };

  /** Camera and screen feedback for world events (audio has its own bindings). */
  private bindFeedback(): void {
    this.bus.on('platform:crumble', () => this.cameraController.addTrauma(0.18));
    this.bus.on('platform:fall', () => this.cameraController.addTrauma(0.22));
    this.bus.on('platform:activated', () => this.cameraController.addTrauma(0.2));
    this.bus.on('energy:collected', () => this.cameraController.punchFov(1.5));
    this.bus.on('checkpoint:activated', () => this.cameraController.punchFov(3));
    this.bus.on('gravity:changed', () => {
      this.cameraController.addTrauma(0.25);
      this.cameraController.punchFov(5);
    });
    this.bus.on('portal:opened', () => this.cameraController.addTrauma(0.2));
  }

  /** Boot: show loading, then the menu. */
  async start(): Promise<void> {
    this.loop.start();
    await this.ui.loading.run();
    this.state.set('MENU');
    this.flow.enterMenu();
    const params = new URLSearchParams(window.location.search);
    const stageParam = Number(params.get('stage'));
    if (import.meta.env.DEV && stageParam >= 1 && stageParam <= STAGE_COUNT) this.flow.startRun(stageParam);
  }

  // ---------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------

  private fixedUpdate(dt: number): void {
    if (!this.state.simulating || this.screenshotPaused) return;
    if (this.bot) {
      // Automated playtests steer in world space: forward = -Z, right = +X.
      this.intent.input.set(this.bot.x, -this.bot.z);
      this.intent.jumpPressed = this.bot.jump;
      this.intent.jumpHeld = this.bot.hold;
      this.bot.jump = false;
      this.stages.fixedUpdate(dt, this.intent, true);
      return;
    }
    this.input.readMovement(this.intent.input);
    this.intent.jumpPressed = this.input.consumeJump();
    this.intent.jumpHeld = this.input.jumpHeld;
    this.stages.fixedUpdate(dt, this.intent, false);
  }

  /** World-space steering for scripted playtests (null = real input). */
  private bot: { x: number; z: number; jump: boolean; hold: boolean } | null = null;

  setBotIntent(x: number, z: number, jump: boolean, hold = true): void {
    if (Number.isNaN(x)) {
      this.bot = null;
      return;
    }
    if (!this.bot) this.bot = { x, z, jump, hold };
    else {
      this.bot.x = x;
      this.bot.z = z;
      this.bot.jump = this.bot.jump || jump;
      this.bot.hold = hold;
    }
  }

  /** Live platform snapshot for scripted playtests. */
  getPlatformSnapshot(): Array<{ id: string; kind: string; pos: [number, number, number]; size: [number, number, number]; enabled: boolean }> {
    const stage = this.stages.instance;
    if (!stage) return [];
    return stage.platforms.map((p, i) => {
      const top = p.group.position;
      return {
        id: p.def.id ?? `${p.def.kind ?? 'static'}#${i}`,
        kind: p.def.kind ?? 'static',
        pos: [top.x, top.y, top.z],
        size: [p.def.size[0], p.def.size[1], p.def.size[2]],
        enabled: p.collider.enabled && p.group.visible,
      };
    });
  }

  private update(delta: number, elapsed: number): void {
    this.scene.resize();
    this.fpsAccumulator += delta;
    this.fpsFrames += 1;
    if (this.fpsAccumulator >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccumulator;
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }

    if (this.screenshotPaused) {
      this.cameraController.update(0, this.player.position, this.player.physics.up, this.world.colliders);
      this.publishDiagnostics();
      return;
    }

    const animDelta = this.reducedMotion ? 0 : delta;
    const animElapsed = this.reducedMotion ? 0 : elapsed;

    if (this.state.is('PLAYING')) {
      if (this.input.consumePause()) this.flow.pause();
      this.input.consumeLook(this.look, delta, CAMERA.SENSITIVITY);
      if (!this.stages.dying) this.cameraController.applyLook(this.look);
    } else {
      this.input.clearTransient();
      if (this.state.is('PAUSED') && this.input.consumePause()) this.flow.resume();
    }

    this.player.animate(delta, animElapsed, this.reducedMotion);
    this.player.group.visible = !this.stages.dying;
    this.cameraController.update(delta, this.player.position, this.player.physics.up, this.world.colliders);
    this.stages.update(animDelta, animElapsed);
    this.tweens.update(delta);
    this.particles.update(animDelta);
    this.materials.update(animElapsed);
    this.environment.update(delta, animElapsed, this.player.position, this.scene.scene);
    this.scene.post.setTime(elapsed);
    this.updateInstability(animElapsed);
    this.ui.setPointerLocked(this.input.isLocked, this.state.is('PLAYING'));
    this.flow.update(delta);
    this.ui.update(delta, this.stages.stats, this.state.name);
    this.audio.update(delta);
    this.debug.update(delta);
    this.publishDiagnostics();
  }

  private render(): void {
    this.scene.render();
  }

  /** Stage 4 style instability: intermittent screen glitches driven by the theme. */
  private updateInstability(elapsed: number): void {
    const instability = this.state.is('PLAYING', 'PAUSED') ? (this.stages.current?.theme.instability ?? 0) : 0;
    if (instability <= 0) {
      this.scene.post.setGlitch(0);
      return;
    }
    const gate = Math.sin(elapsed * 1.7) * Math.sin(elapsed * 3.1 + 1.3);
    const burst = gate > 0.72 ? (gate - 0.72) / 0.28 : 0;
    this.scene.post.setGlitch(burst * instability * 1.6);
  }

  // ---------------------------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------------------------

  private applyAllSettings(): void {
    const s = this.save.settings;
    for (const key of Object.keys(s) as (keyof Settings)[]) this.applySetting(key, s[key]);
  }

  applySetting(key: keyof Settings, value: Settings[keyof Settings]): void {
    const s = this.save.settings;
    switch (key) {
      case 'sensitivity':
        this.cameraController.sensitivity = Number(value);
        break;
      case 'invertY':
        this.cameraController.invertY = Boolean(value);
        break;
      case 'bloom':
        this.scene.post.setBloomEnabled(Boolean(value) && s.quality !== 'low');
        break;
      case 'quality': {
        const dpr = value === 'high' ? 2 : value === 'medium' ? 1.5 : 1;
        this.scene.setMaxDpr(dpr);
        this.scene.post.setBloomEnabled(s.bloom && value !== 'low');
        this.scene.renderer.shadowMap.enabled = value !== 'low';
        this.applyPixelScale();
        break;
      }
      case 'masterVolume':
      case 'musicVolume':
      case 'sfxVolume':
        this.audio.applyVolumes(s);
        break;
    }
    this.bus.emit('settings:changed', { key, value: value as number | boolean });
  }

  private applyPixelScale(): void {
    const height = this.scene.size.height * this.scene.pixelRatio;
    this.particles.setPixelScale(height);
    this.environment.setPixelScale(height);
  }

  // ---------------------------------------------------------------------------------------------
  // Test & debug hooks
  // ---------------------------------------------------------------------------------------------

  reseed(value: number): void {
    this.rng = createSeededRandom(value);
  }

  setScreenshotPause(paused: boolean): void {
    this.screenshotPaused = paused;
    this.loop.simulationPaused = paused;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.player.animation.stabilize();
      this.stages.instance?.energy.stabilize();
    }
  }

  async applyTestState(name: string): Promise<void> {
    const stageMatch = /^stage-([1-5])$/.exec(name);
    if (name === 'menu') {
      this.flow.toMenu();
    } else if (name === 'active-play' || stageMatch) {
      const stage = stageMatch ? Number(stageMatch[1]) : 1;
      this.flow.startRun(stage, true);
    } else if (name === 'complete') {
      this.flow.startRun(5, true);
      this.flow.showGameCompleteNow();
    } else if (name === 'paused') {
      this.flow.startRun(1, true);
      this.flow.pause();
    } else {
      throw new Error(`Unknown test state: ${name}`);
    }
    this.update(0, this.loop.elapsedSeconds);
    this.render();
    this.publishDiagnostics();
  }

  teleportPlayer(x: number, y: number, z: number): void {
    this.stages.teleportPlayer(x, y, z);
  }

  grantEnergy(count: number): void {
    this.stages.instance?.energy.grant(count);
  }

  startStage(stage: number): void {
    this.flow.startRun(stage, true);
  }

  triggerAction(action: string): void {
    switch (action) {
      case 'pause':
        this.flow.pause();
        break;
      case 'resume':
        this.flow.resume();
        break;
      case 'die':
        this.stages.die('fall');
        break;
      case 'complete-stage':
        if (this.stages.current) {
          if (this.stages.current.finale) this.flow.finale(this.stages.current);
          else this.flow.stageComplete(this.stages.current);
        }
        break;
      case 'open-portal':
        this.stages.instance?.portal.setOpen(true);
        break;
      case 'activate-groups':
        this.stages.instance?.energy.activateAll();
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  getDebugState(): Record<string, unknown> {
    const p = this.player.physics;
    return {
      state: this.state.name,
      stage: this.stages.stageIndex,
      position: p.position.toArray(),
      velocity: p.velocity.toArray(),
      grounded: p.grounded,
      up: p.up.toArray(),
      gravityScale: p.gravityScale,
      energy: this.stages.instance?.energy.count ?? 0,
      checkpoint: this.stages.instance?.checkpoints.activeIndex ?? -1,
      deaths: this.stages.stats.deaths,
      portalOpen: this.stages.instance?.portal.isOpen ?? false,
      dying: this.stages.dying,
    };
  }

  get currentStage(): StageDefinition | null {
    return this.stages.current;
  }

  get stateName(): GameStateName {
    return this.state.name;
  }

  private publishDiagnostics(): void {
    const info = this.scene.renderer.info;
    const p = this.player.physics;
    const stage = this.stages.instance;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.loop.frameCount,
      elapsed: this.loop.elapsedSeconds,
      state: this.state.name,
      stage: this.stages.stageIndex,
      stageName: stage?.def.name ?? '',
      energy: stage?.energy.count ?? 0,
      energyRequired: stage?.energy.required ?? 0,
      energyTotal: stage?.energy.total ?? 0,
      checkpoint: stage?.checkpoints.activeIndex ?? -1,
      deaths: this.stages.stats.deaths,
      complete: this.state.is('GAME_COMPLETE'),
      player: {
        position: { x: p.position.x, y: p.position.y, z: p.position.z },
        velocity: { x: p.velocity.x, y: p.velocity.y, z: p.velocity.z },
        speed: p.velocity.length(),
        grounded: p.grounded,
        up: { x: p.up.x, y: p.up.y, z: p.up.z },
        gravityScale: p.gravityScale,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: this.scene.pixelRatio,
      },
      fps: this.fps,
    };
  }

  dispose(): void {
    this.loop.stop();
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.stages.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.ui.dispose();
    this.debug.dispose();
    this.player.dispose();
    this.particles.dispose();
    this.environment.dispose();
    this.materials.dispose();
    this.scene.dispose();
    this.bus.clear();
    removeTestHooks();
  }
}
