import GUI from 'lil-gui';
import type { Game } from '../core/Game';
import { CAMERA, CHARACTER, PLAYER, RENDER, STAGE_COUNT } from '../utils/Constants';
import { el } from '../utils/dom';

/**
 * Development tools behind `?debug`: live tuning (lil-gui), a diagnostics overlay and
 * stage/respawn shortcuts. Never constructed in production unless the flag is present.
 */
export class DebugTools {
  private gui: GUI | null = null;
  private overlay: HTMLElement | null = null;
  readonly enabled: boolean;
  private accumulator = 0;

  constructor(private readonly game: Game) {
    this.enabled = new URLSearchParams(window.location.search).has('debug');
    if (!this.enabled) return;

    this.gui = new GUI({ title: 'NEXUS debug' });
    const movement = this.gui.addFolder('Movement');
    movement.add(PLAYER, 'SPEED', 3, 14, 0.1);
    movement.add(PLAYER, 'ACCELERATION', 10, 80, 1);
    movement.add(PLAYER, 'DECELERATION', 10, 90, 1);
    movement.add(PLAYER, 'AIR_CONTROL', 0, 1, 0.01);
    movement.add(PLAYER, 'JUMP_FORCE', 5, 18, 0.1);
    movement.add(PLAYER, 'DOUBLE_JUMP_FORCE', 5, 18, 0.1);
    movement.add(PLAYER, 'GRAVITY', 10, 50, 0.5);
    movement.add(PLAYER, 'COYOTE_TIME', 0, 0.3, 0.01);
    movement.add(PLAYER, 'JUMP_BUFFER', 0, 0.3, 0.01);
    movement.close();
    const camera = this.gui.addFolder('Camera');
    camera.add(CAMERA, 'DISTANCE', 3, 14, 0.1);
    camera.add(CAMERA, 'FOV', 40, 90, 1);
    camera.add(CAMERA, 'FOLLOW_LAG', 0.01, 0.4, 0.01);
    camera.add(CAMERA, 'SENSITIVITY', 0.0005, 0.006, 0.0001);
    camera.close();
    const character = this.gui.addFolder('Character');
    character.add(CHARACTER, 'SCALE', 0.8, 1.4, 0.01).onChange((v: number) => game.player.model.character?.group.scale.setScalar(v));
    character.add(CHARACTER, 'ENERGY_CYAN_BASE', 0, 4, 0.05);
    character.add(CHARACTER, 'ENERGY_CYAN_GAIN', 0, 4, 0.05);
    character.add(CHARACTER, 'ENERGY_BLUE', 0, 4, 0.05);
    character.add(CHARACTER, 'STRIDE_RATE', 1, 4, 0.05);
    character.add(CHARACTER, 'RUN_LEAN', 0, 0.3, 0.005);
    character.add(CHARACTER, 'TURN_LEAN', 0, 0.3, 0.005);
    character.close();
    const render = this.gui.addFolder('Render');
    render.add(RENDER, 'BLOOM_STRENGTH', 0, 2, 0.01).onChange((v: number) => game.scene.post.setBloomStrength(v));
    render.add({ post: true }, 'post').onChange((v: boolean) => game.scene.setPostEnabled(v));
    render.close();
    const actions = {
      stage: 1,
      go: () => game.startStage(actions.stage),
      restart: () => game.startStage(game.stages.stageIndex || 1),
      respawn: () => game.stages.respawn(),
      openPortal: () => game.stages.instance?.portal.setOpen(true),
      grantEnergy: () => game.grantEnergy(5),
      kill: () => game.stages.die('fall'),
    };
    const flow = this.gui.addFolder('Stage');
    flow.add(actions, 'stage', 1, STAGE_COUNT, 1);
    flow.add(actions, 'go').name('Teleport to stage');
    flow.add(actions, 'restart').name('Restart stage');
    flow.add(actions, 'respawn').name('Respawn at checkpoint');
    flow.add(actions, 'openPortal').name('Open portal');
    flow.add(actions, 'grantEnergy').name('Grant 5 energy');
    flow.add(actions, 'kill').name('Kill player');

    this.overlay = el('div');
    this.overlay.id = 'debug-overlay';
    document.body.append(this.overlay);
  }

  update(delta: number): void {
    if (!this.overlay) return;
    this.accumulator += delta;
    if (this.accumulator < 0.12) return;
    this.accumulator = 0;
    const d = window.__THREE_GAME_DIAGNOSTICS__;
    if (!d) return;
    const p = d.player;
    const up = `${p.up.x.toFixed(0)},${p.up.y.toFixed(0)},${p.up.z.toFixed(0)}`;
    this.overlay.textContent =
      `FPS ${d.fps.toFixed(0)}   state ${d.state}\n` +
      `stage ${d.stage} ${d.stageName}   checkpoint ${d.checkpoint}   deaths ${d.deaths}\n` +
      `pos ${p.position.x.toFixed(2)} ${p.position.y.toFixed(2)} ${p.position.z.toFixed(2)}\n` +
      `vel ${p.velocity.x.toFixed(1)} ${p.velocity.y.toFixed(1)} ${p.velocity.z.toFixed(1)}  grounded ${p.grounded}\n` +
      `gravity up ${up}  scale ${p.gravityScale}\n` +
      `energy ${d.energy}/${d.energyRequired}/${d.energyTotal}\n` +
      `calls ${d.renderer.calls}  tris ${(d.renderer.triangles / 1000).toFixed(0)}k  geo ${d.renderer.geometries}  tex ${d.renderer.textures}\n` +
      `canvas ${d.canvas.width}x${d.canvas.height} @${d.canvas.dpr.toFixed(2)}`;
  }

  setHidden(hidden: boolean): void {
    if (this.gui) {
      if (hidden) this.gui.hide();
      else this.gui.show();
    }
    if (this.overlay) this.overlay.style.display = hidden ? 'none' : '';
  }

  dispose(): void {
    this.gui?.destroy();
    this.gui = null;
    this.overlay?.remove();
    this.overlay = null;
    void this.game;
  }
}
