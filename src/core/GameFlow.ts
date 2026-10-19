import * as THREE from 'three';
import type { Game } from './Game';
import type { StageDefinition } from '../stages/StageTypes';
import { STAGE_COUNT } from '../utils/Constants';
import { CoreSequence } from '../mechanics/CoreSequence';
import { Stage6Opening, Stage6Victory } from '../mechanics/Stage6Sequence';
import { easeInOutCubic, easeOutCubic } from '../effects/Tween';
import { ArmorSystem } from '../combat/ArmorSystem';
import { EnergySword } from '../combat/EnergySword';
import { formatTime } from '../utils/MathUtils';

/**
 * High-level flow: menu ⇄ play, pause, death fade, stage complete → transition → next stage,
 * Stage 5 Awakening, Stage 6 Fallen Legion combat mission, and victory finale.
 */
export class GameFlow {
  private fade = 0;
  private fadeTarget = 0;
  private core: CoreSequence | null = null;
  private stage6Opening: Stage6Opening | null = null;
  private stage6Victory: Stage6Victory | null = null;

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

    game.bus.on('combat:stage:victory', ({ stage, nextStage }) => {
      this.onCombatStageVictory(stage, nextStage);
    });

    game.bus.on('combat:campaign:complete', () => {
      this.onCampaignVictory();
    });

    game.bus.on('stage6:victory', () => {
      if (this.game.stages.stageIndex === 10) {
        this.onCampaignVictory();
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
    this.wasDying = false;
    this.core?.dispose();
    this.core = null;
    this.stage6Opening?.dispose();
    this.stage6Opening = null;
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
      this.loadStage(stage);
      game.state.set(
        game.state.is('MENU', 'PAUSED', 'STAGE_COMPLETE', 'GAME_COMPLETE')
          ? 'TRANSITION'
          : game.state.name,
      );
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

  private loadStage(stage: number): void {
    const game = this.game;
    game.stages.load(stage);
    const def = game.stages.current!;
    game.environment.applyTheme(def.theme, false);
    game.environment.setPower(stage === 5 ? 0 : 0.4);
    game.scene.post.setGlitch(0);

    if (stage >= 6) {
      // Stage 6-10 Combat Missions: ensure Cyan Knight equipment is mounted
      this.ensureCyanKnightEquipped();
      game.combatHud.hide();

      if (stage === 6) {
        // Launch Level 6 opening cinematic
        this.stage6Opening = new Stage6Opening(game, () => this.onStageCombatReady(stage));
        this.stage6Opening.start();
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

  private ensureCyanKnightEquipped(): void {
    const game = this.game;
    if (!game.combat?.awakened) {
      const rig = game.player.model.character;
      if (rig) {
        const armor = new ArmorSystem(rig);
        const sword = new EnergySword(rig);
        armor.snapVisible();
        sword.snapVisible();
        game.combat?.setAwakened(armor, sword);
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

  private onCombatStageVictory(stage: number, nextStage: number): void {
    const game = this.game;
    game.stages.bankStage();
    game.save.recordStageComplete(stage, game.stages.stats.stageTime);

    const timeStr = formatTime(game.stages.stats.stageTime);
    const comps = game.combat?.companionCount ?? 0;
    const statsText = `MISSION TIME: ${timeStr} · LEGION COMPANIONS ACTIVE: ${comps} / 4`;

    game.combatHud.showVictoryModal(stage, nextStage, statsText, () => {
      this.startRun(nextStage);
    });
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

  finale(def: StageDefinition): void {
    const game = this.game;
    if (!game.state.is('PLAYING')) return;
    game.state.set('STAGE_COMPLETE');
    game.input.releaseLock();
    game.stages.bankStage();
    game.save.recordStageComplete(def.id, game.stages.stats.stageTime);
    game.ui.hideAll();
    this.cancelPending();

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
   * And unlocks and deploys the hero directly into Level 6!
   */
  private onAwakeningComplete(): void {
    const game = this.game;

    // Restore cinematic camera
    game.cameraController.cinematicTarget = null;
    game.cameraController.cinematicPosition = null;
    game.cameraController.distanceScale = 1;

    // Save Stage 5 completion and unlock Stage 6 in progression
    game.save.recordStageComplete(5, game.stages.stats.stageTime);

    // Show story transition modal
    showStoryTransition(() => {
      this.startRun(6);
    });
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
    this.stage6Opening?.update(delta);
    this.stage6Victory?.update(delta);
  }

  get isTransitioning(): boolean {
    return this.transitionTimer > 0;
  }
}

/**
 * Story transition modal displayed after Stage 5 awakening completes.
 */
function showStoryTransition(onContinue: () => void): void {
  let modal = document.getElementById('nexus-story-transition');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'nexus-story-transition';
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(2,4,10,0.94)',
      'display:flex', 'flex-direction:column', 'justify-content:center', 'align-items:center',
      'z-index:1000', 'font-family:Orbitron,Segoe UI,sans-serif',
      'text-align:center', 'padding:24px', 'backdrop-filter:blur(10px)',
      'transition:opacity 0.6s',
    ].join(';');
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="color:#00f0ff;font-size:clamp(13px,2.2vw,20px);letter-spacing:0.35em;font-weight:bold;margin-bottom:12px;text-shadow:0 0 16px rgba(0,240,255,0.7);">
      NEXUS PROTOCOL AWAKENED
    </div>
    <div style="color:#ffffff;font-size:clamp(22px,4.5vw,38px);letter-spacing:0.4em;font-weight:900;margin-bottom:16px;text-shadow:0 0 24px rgba(255,34,0,0.6);">
      NEW MISSION: THE FALLEN LEGION
    </div>
    <div style="color:rgba(210,235,255,0.85);font-size:clamp(12px,1.8vw,16px);letter-spacing:0.18em;max-width:650px;margin-bottom:34px;line-height:1.6;font-style:italic;">
      "The Core has awakened an army buried beneath the battlefield. Prepare for combat."
    </div>
    <button id="btn-deploy-legion" style="
      background:linear-gradient(90deg,#00f0ff,#3c7bff);color:#050914;font-family:Orbitron,sans-serif;
      font-size:clamp(12px,1.6vw,15px);font-weight:900;letter-spacing:0.25em;padding:14px 38px;
      border:none;border-radius:3px;cursor:pointer;box-shadow:0 0 24px rgba(0,240,255,0.7);
      transition:transform 0.15s,box-shadow 0.15s;
    ">DEPLOY TO BATTLEFIELD</button>
  `;
  modal.style.opacity = '1';
  modal.style.display = 'flex';

  let called = false;
  const proceed = (): void => {
    if (called) return;
    called = true;
    modal!.style.opacity = '0';
    setTimeout(() => {
      if (modal) modal.style.display = 'none';
    }, 600);
    onContinue();
  };

  const btn = document.getElementById('btn-deploy-legion');
  btn?.addEventListener('click', proceed, { once: true });

  // Auto deploy after 4.5 seconds if untouched
  setTimeout(proceed, 4500);
}
