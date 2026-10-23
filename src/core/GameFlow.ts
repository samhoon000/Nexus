import * as THREE from 'three';
import type { Game } from './Game';
import type { StageDefinition } from '../stages/StageTypes';
import { STAGE_COUNT } from '../utils/Constants';
import { CoreSequence } from '../mechanics/CoreSequence';
import { Stage6Victory } from '../mechanics/Stage6Sequence';
import { easeInOutCubic, easeOutCubic } from '../effects/Tween';
import { ArmorSystem } from '../combat/ArmorSystem';
import { EnergySword } from '../combat/EnergySword';
import { ArmoredGun } from '../combat/ArmoredGun';

/**
 * High-level flow: menu ⇄ play, pause, death fade, stage complete → transition → next stage,
 * Stage 5 Awakening, Stage 6 Fallen Legion combat mission, and victory finale.
 */
export class GameFlow {
  private fade = 0;
  private fadeTarget = 0;
  private core: CoreSequence | null = null;
  private stage6Victory: Stage6Victory | null = null;

  private pendingStage = 0;
  private transitionTimer = 0;
  private completeTimer = 0;
  private deathFadeTimer = 0;
  private briefingTimer = 0;
  private wasDying = false;

  constructor(private readonly game: Game) {
    game.bus.on('player:died', () => {
      this.deathFadeTimer = 0;
      this.wasDying = true;
    });

    game.bus.on('combat:stage:victory', ({ stage, nextStage }) => {
      this.onCombatStageVictory(stage, nextStage);
    });

    game.bus.on('combat:campaign:complete', () => {
      game.bus.emit('stage:portal:unlock', { stage: 10 });
    });

    game.bus.on('stage6:victory', () => {
      if (this.game.stages.stageIndex === 10) {
        this.onCampaignVictory();
      }
    });

    game.bus.on('stage:loaded', ({ stage }) => {
      if (stage !== 5) hideLevel5Completion();
      if (stage !== 6) {
        window.clearTimeout(this.briefingTimer);
        this.briefingTimer = 0;
        hideLevel6Warning();
      }
    });
  }

  enterMenu(): void {
    const game = this.game;
    game.input.releaseLock();
    game.stages.unload();
    game.stages.resetRun();
    game.cameraController.reset();
    game.combatHud.hide();

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
    game.combatHud.hide();
    game.setScreenshotPause(false);
    game.state.set('MENU');
    this.enterMenu();
  }

  private cancelPending(): void {
    this.completeTimer = 0;
    this.transitionTimer = 0;
    window.clearTimeout(this.briefingTimer);
    this.briefingTimer = 0;
    hideLevel6Warning();
    this.wasDying = false;
    this.core?.dispose();
    this.core = null;
    this.stage6Victory?.dispose();
    this.stage6Victory = null;
  }

  /** Starts a run from `stage`. `instant` skips the fade (test hooks). */
  startRun(stage: number, instant = false): void {
    const game = this.game;
    this.cancelPending();
    this.menuOrbit = false;
    game.stages.resetRun();
    game.setScreenshotPause(false);

    if (instant) {
      game.state.set(
        game.state.is('MENU', 'PAUSED', 'STAGE_COMPLETE', 'GAME_COMPLETE')
          ? 'TRANSITION'
          : game.state.name,
      );
      this.loadStage(stage, instant);
      if (stage < 6) {
        game.state.set('PLAYING');
        this.fade = 0;
        this.fadeTarget = 0;
        game.ui.showHud(game.stages.current!);
        game.audio.setMusicIntensity(game.stages.current!.theme.musicIntensity);
        game.audio.startMusic();
      }
      return;
    }

    game.state.set('TRANSITION');
    game.ui.hideAll();
    this.pendingStage = stage;
    this.fadeTarget = 1;
    this.transitionTimer = 0.55;
  }

  private loadStage(stage: number, instant = false): void {
    const game = this.game;
    game.stages.load(stage);
    game.combat?.resetForStage(stage);
    const def = game.stages.current!;
    game.environment.applyTheme(def.theme, false);
    game.environment.setPower(stage === 5 ? 0 : 0.4);
    game.scene.post.setGlitch(0);

    if (stage >= 6) {
      // Stage 6-10 Combat Missions: ensure Cyan Knight equipment is mounted
      this.ensureCyanKnightEquipped();
      game.combatHud.hide();

      if (stage === 6) {
        // Stage 6 remains out of gameplay until its controls guide is continued.
        if (instant) {
          this.showStage6Controls(stage);
        } else {
          this.briefingTimer = showLevel6Warning(() => {
            this.briefingTimer = 0;
            this.showStage6Controls(stage);
          });
        }
      } else {
        // Stages 7-10: initialize combat mission directly
        const center = new THREE.Vector3(0, 0, 0);
        game.combat?.initStageMission(stage, center);
        this.onStageCombatReady(stage);
      }
    } else {
      game.combatHud.hide();
    }
  }

  private showStage6Controls(stage: number): void {
    const game = this.game;
    game.ui.showControlsOverlay(() => {
      game.ui.showHud(game.stages.current!);
      game.combat?.initStage6PlatformMission();
      this.onStageCombatReady(stage);
    });
  }

  private ensureCyanKnightEquipped(): void {
    const game = this.game;
    if (!game.combat?.awakened) {
      const rig = game.player.model.character;
      if (rig) {
        const armor = new ArmorSystem(rig);
        const sword = new EnergySword(rig);
        const gun = new ArmoredGun(rig);
        armor.snapVisible();
        sword.snapVisible();
        // Gun is hidden until Stage 8 (setGun handles this)
        game.combat?.setAwakened(armor, sword);
        game.combat?.setGun(gun);
      }
    } else {
      game.combat.armor?.snapVisible();
      game.combat.sword?.snapVisible();
    }
  }

  private onStageCombatReady(_stage: number): void {
    const game = this.game;
    game.cameraController.cinematicTarget = null;
    game.cameraController.cinematicPosition = null;
    // Balanced camera view for combat arena — keeps Cyan Knight details clearly visible
    game.cameraController.distanceScale = 1.05;

    game.state.set('PLAYING');
    game.combatHud.show();
    game.input.requestLock();
    game.audio.setMusicIntensity(game.stages.current?.theme.musicIntensity ?? 0.95);
    game.audio.startMusic();
  }

  private onCombatStageVictory(stage: number, _nextStage: number): void {
    this.game.bus.emit('stage:portal:unlock', { stage });
  }

  private onCampaignVictory(): void {
    const game = this.game;
    game.combatHud.hide();
    game.state.set('STAGE_COMPLETE');

    this.stage6Victory = new Stage6Victory(game, () => {
      game.stages.bankStage();
      game.save.recordStageComplete(10, game.stages.stats.stageTime);
      this.gameComplete();
    });
    this.stage6Victory.start();
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
    game.ui.hidePause();

    if (game.stages.stageIndex >= 6) {
      game.combatHud.show();
    } else {
      game.ui.showHud(game.stages.current!);
    }

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
    if (def.id === 10) {
      this.onCampaignVictory();
      return;
    }
    game.stages.bankStage();
    game.save.recordStageComplete(def.id, game.stages.stats.stageTime);

    const stats = game.stages.stats;
    game.bus.emit('stage:complete', {
      stage: def.id,
      time: stats.stageTime,
      energy: game.stages.instance?.energy.count ?? 0,
      energyTotal: game.stages.instance?.energy.total ?? 0,
    });

    game.ui.showStageComplete(
      def,
      stats.stageTime,
      game.stages.instance?.energy.count ?? 0,
      game.stages.instance?.energy.total ?? 0,
    );
    if (def.id === 5) showLevel5Completion();

    game.cameraController.distanceScale = 1;
    game.tweens.tween(
      2.6,
      (t) => {
        game.cameraController.distanceScale = 1 + t * 2.4;
        game.cameraController.pitch = 0.42 + t * 0.35;
        game.environment.setPower(t * 0.35);
      },
      easeInOutCubic,
    );

    this.completeTimer = 3.4;
    this.pendingStage = Math.min(STAGE_COUNT, def.id + 1);
  }

  finale(_def: StageDefinition): void {
    const game = this.game;
    if (!game.state.is('PLAYING')) return;
    game.state.set('STAGE_COMPLETE');
    game.input.releaseLock();
    game.ui.hideAll();
    this.cancelPending();
    game.stages.beginFinaleSequence();

    // Start Stage 5 full 9-step Awakening cinematic
    this.core = new CoreSequence(game, () => this.onAwakeningComplete());
    this.core.start();
  }

  /**
   * Called when the Stage 5 awakening cinematic finishes (or is skipped).
   * Displays the story transition:
   *   NEXUS PROTOCOL AWAKENED
   *   NEW MISSION: THE FALLEN LEGION
   *   "The Core has awakened an army buried beneath the battlefield. Prepare for combat."
  * Then records Stage 5 complete and reveals its exit portal.
   */
  private onAwakeningComplete(): void {
    const game = this.game;

    // Restore cinematic camera
    game.cameraController.cinematicTarget = null;
    game.cameraController.cinematicPosition = null;
    game.cameraController.distanceScale = 1;

    if (!game.stages.completeFinale()) return;
    document.getElementById('nexus-cinematic-caption')?.remove();
    game.state.set('PLAYING');
    game.ui.showHud(game.stages.current!);
    game.input.requestLock();
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

  showGameCompleteNow(): void {
    const game = this.game;
    game.stages.bankStage();
    game.state.set('GAME_COMPLETE');
    game.environment.setPower(1);
    game.ui.showGameComplete(game.stages.stats);
  }

  update(delta: number): void {
    const game = this.game;

    // Fade overlay
    this.fade += (this.fadeTarget - this.fade) * (1 - Math.exp(-delta / 0.18));
    let flash = this.fade;

    // Death fade
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
        this.transitionTimer = 0;
        this.loadStage(this.pendingStage);
        if (this.pendingStage < 6) {
          game.ui.showHud(game.stages.current!);
          game.audio.setMusicIntensity(game.stages.current!.theme.musicIntensity);
          game.audio.startMusic();
          game.state.set('PLAYING');
          game.input.requestLock();
        }
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
    this.stage6Victory?.update(delta);
  }

  get isTransitioning(): boolean {
    return this.transitionTimer > 0;
  }
}

function showLevel6Warning(onContinue: () => void): number {
  let warning = document.getElementById('nexus-stage6-warning');
  if (!warning) {
    warning = document.createElement('div');
    warning.id = 'nexus-stage6-warning';
    warning.setAttribute('role', 'alert');
    warning.textContent = 'ROBOTS ARE NEARBY, BE AWARE';
    document.body.appendChild(warning);
  }
  warning.style.display = 'block';
  requestAnimationFrame(() => warning?.classList.add('visible'));
  return window.setTimeout(() => {
    warning?.classList.remove('visible');
    window.setTimeout(() => {
      if (warning) warning.style.display = 'none';
      onContinue();
    }, 300);
  }, 1800);
}

function hideLevel6Warning(): void {
  const warning = document.getElementById('nexus-stage6-warning');
  if (!warning) return;
  warning.classList.remove('visible');
  warning.style.display = 'none';
}

function showLevel5Completion(): void {
  let notice = document.getElementById('nexus-stage5-completion');
  if (!notice) {
    notice = document.createElement('section');
    notice.id = 'nexus-stage5-completion';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `
      <h2>LEVEL 5 COMPLETED</h2>
      <div class="stage5-bonded">ARMOR IS BONDED</div>
    `;
    document.body.appendChild(notice);
  }
  notice.style.display = 'block';
  requestAnimationFrame(() => notice?.classList.add('visible'));
}

function hideLevel5Completion(): void {
  const notice = document.getElementById('nexus-stage5-completion');
  if (!notice) return;
  notice.classList.remove('visible');
  notice.style.display = 'none';
  notice.remove();
}
