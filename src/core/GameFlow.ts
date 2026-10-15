import type { Game } from './Game';
import type { StageDefinition } from '../stages/StageTypes';
import { STAGE_COUNT } from '../utils/Constants';
import { CoreSequence } from '../mechanics/CoreSequence';
import { easeInOutCubic, easeOutCubic } from '../effects/Tween';

/**
 * High-level flow: menu ⇄ play, pause, death fade, stage complete → transition → next stage,
 * and the Stage 5 finale. Keeps `Game` focused on wiring.
 */
export class GameFlow {
  private fade = 0;
  private fadeTarget = 0;
  private core: CoreSequence | null = null;
  private pendingStage = 0;
  private transitionTimer = 0;
  private completeTimer = 0;
  private deathFadeTimer = 0;
  private wasDying = false;

  constructor(private readonly game: Game) {
    game.bus.on('player:died', () => {
      this.deathFadeTimer = 0;
      this.wasDying = true;
    });
  }

  enterMenu(): void {
    const game = this.game;
    game.input.releaseLock();
    game.stages.unload();
    game.stages.resetRun();
    game.cameraController.reset();
    // Menu backdrop: a quiet orbit around the start of Stage 1.
    game.stages.load(1);
    game.environment.applyTheme(game.stages.current!.theme, false);
    game.environment.setPower(0);
    game.scene.post.setGlitch(0);
    game.ui.showMenu();
    game.audio.setMusicIntensity(0.12);
    game.audio.startMusic();
    this.menuOrbit = true;
    this.fadeTarget = 0;
  }

  private menuOrbit = false;
  private menuAngle = 0;

  toMenu(): void {
    const game = this.game;
    this.cancelPending();
    game.setScreenshotPause(false);
    game.state.set('MENU');
    this.enterMenu();
  }

  private cancelPending(): void {
    this.completeTimer = 0;
    this.transitionTimer = 0;
    this.wasDying = false;
    this.core?.dispose();
    this.core = null;
  }

  /** Starts a run from `stage`. `instant` skips the fade (test hooks). */
  startRun(stage: number, instant = false): void {
    const game = this.game;
    this.cancelPending();
    this.menuOrbit = false;
    game.stages.resetRun();
    game.setScreenshotPause(false);
    if (instant) {
      this.loadStage(stage);
      game.state.set(game.state.is('MENU', 'PAUSED', 'STAGE_COMPLETE', 'GAME_COMPLETE') ? 'TRANSITION' : game.state.name);
      game.state.set('PLAYING');
      this.fade = 0;
      this.fadeTarget = 0;
      game.ui.showHud(game.stages.current!);
      game.audio.setMusicIntensity(game.stages.current!.theme.musicIntensity);
      game.audio.startMusic();
      return;
    }
    game.state.set('TRANSITION');
    game.ui.hideAll();
    this.pendingStage = stage;
    this.fadeTarget = 1;
    this.transitionTimer = 0.55;
  }

  private loadStage(stage: number): void {
    const game = this.game;
    game.stages.load(stage);
    const def = game.stages.current!;
    game.environment.applyTheme(def.theme, false);
    game.environment.setPower(0);
    game.scene.post.setGlitch(0);
  }

  pause(): void {
    const game = this.game;
    if (!game.state.is('PLAYING')) return;
    game.state.set('PAUSED');
    game.input.releaseLock();
    game.ui.showPause();
    game.audio.setPaused(true);
  }

  resume(): void {
    const game = this.game;
    if (!game.state.is('PAUSED')) return;
    game.state.set('PLAYING');
    game.ui.showHud(game.stages.current!);
    game.input.clearTransient();
    game.input.requestLock();
    game.audio.setPaused(false);
  }

  restartCheckpoint(): void {
    const game = this.game;
    if (!game.state.is('PAUSED', 'PLAYING')) return;
    game.stages.respawn();
    this.resume();
  }

  stageComplete(def: StageDefinition): void {
    const game = this.game;
    if (!game.state.is('PLAYING')) return;
    game.state.set('STAGE_COMPLETE');
    game.input.releaseLock();
    game.stages.bankStage();
    game.save.recordStageComplete(def.id, game.stages.stats.stageTime);
    const stats = game.stages.stats;
    game.bus.emit('stage:complete', {
      stage: def.id,
      time: stats.stageTime,
      energy: game.stages.instance?.energy.count ?? 0,
      energyTotal: game.stages.instance?.energy.total ?? 0,
    });
    game.ui.showStageComplete(def, stats.stageTime, game.stages.instance?.energy.count ?? 0, game.stages.instance?.energy.total ?? 0);
    // Cinematic pull-back and a glimpse of the wider world.
    game.cameraController.distanceScale = 1;
    game.tweens.tween(2.6, (t) => {
      game.cameraController.distanceScale = 1 + t * 2.4;
      game.cameraController.pitch = 0.42 + t * 0.35;
      game.environment.setPower(t * 0.35);
    }, easeInOutCubic);
    this.completeTimer = 3.4;
    this.pendingStage = Math.min(STAGE_COUNT, def.id + 1);
  }

  finale(def: StageDefinition): void {
    const game = this.game;
    if (!game.state.is('PLAYING')) return;
    game.state.set('STAGE_COMPLETE');
    game.input.releaseLock();
    game.stages.bankStage();
    game.save.recordStageComplete(def.id, game.stages.stats.stageTime);
    game.ui.hideAll();
    this.cancelPending();
    this.core = new CoreSequence(game, () => this.gameComplete());
    this.core.start();
  }

  private gameComplete(): void {
    const game = this.game;
    game.state.set('GAME_COMPLETE');
    const stats = game.stages.stats;
    game.bus.emit('game:complete', {
      totalTime: stats.totalTime,
      energy: stats.energy,
      energyTotal: stats.energyTotal,
      stages: stats.stagesCompleted,
      deaths: stats.deaths,
    });
    game.ui.showGameComplete(stats);
  }

  /** Test hook: jump straight to the end screen. */
  showGameCompleteNow(): void {
    const game = this.game;
    game.stages.bankStage();
    game.state.set('GAME_COMPLETE');
    game.environment.setPower(1);
    game.ui.showGameComplete(game.stages.stats);
  }

  update(delta: number): void {
    const game = this.game;

    // Fade overlay (post flash to black).
    this.fade += (this.fadeTarget - this.fade) * (1 - Math.exp(-delta / 0.18));
    let flash = this.fade;

    // Death fade: quick dip to black and back around the respawn.
    if (this.wasDying) {
      this.deathFadeTimer += delta;
      const k = this.deathFadeTimer / 1.1;
      const dip = k < 0.5 ? easeOutCubic(k * 2) : 1 - easeOutCubic((k - 0.5) * 2);
      flash = Math.max(flash, dip * 0.9);
      if (k >= 1) this.wasDying = false;
    }
    game.scene.post.setFlash(flash, 0x02030a);

    if (game.state.is('TRANSITION') && this.transitionTimer > 0) {
      this.transitionTimer -= delta;
      if (this.transitionTimer <= 0) {
        this.loadStage(this.pendingStage);
        game.ui.showHud(game.stages.current!);
        game.audio.setMusicIntensity(game.stages.current!.theme.musicIntensity);
        game.audio.startMusic();
        game.state.set('PLAYING');
        game.input.requestLock();
        this.fadeTarget = 0;
      }
    }

    if (game.state.is('STAGE_COMPLETE') && this.completeTimer > 0) {
      this.completeTimer -= delta;
      if (this.completeTimer <= 0) {
        game.state.set('TRANSITION');
        game.ui.hideAll();
        this.fadeTarget = 1;
        this.transitionTimer = 0.6;
      }
    }

    if (this.menuOrbit && game.state.is('MENU')) {
      this.menuAngle += delta * 0.08;
      game.cameraController.yaw = this.menuAngle;
      game.cameraController.pitch = 0.3;
      game.cameraController.distanceScale = 2.2;
    }

    this.core?.update(delta);
  }

  get isTransitioning(): boolean {
    return this.transitionTimer > 0;
  }
}
