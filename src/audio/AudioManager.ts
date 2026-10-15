import type { EventBus } from '../core/EventBus';
import type { Settings } from '../save/SaveSystem';
import { createSeededRandom } from '../utils/random';
import { Music } from './Music';
import { Synth, type SynthTarget } from './Synth';

/**
 * Web Audio owner: gesture unlock, volume groups (master / music / sfx / ui), event bindings,
 * generative music and pause ducking. Sounds are procedural; swap `Synth` for decoded buffers
 * later without touching gameplay code.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private music: Music | null = null;
  private settings: Settings;
  private readonly rng = createSeededRandom(7);
  private musicWanted = false;
  private pendingIntensity = 0.2;
  private paused = false;
  private readonly unsubscribe: Array<() => void> = [];
  private landCooldown = 0;

  constructor(bus: EventBus, settings: Settings) {
    this.settings = settings;
    const unlock = (): void => {
      void this.unlock();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    this.unsubscribe.push(() => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    });
    this.bind(bus);
  }

  private async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => undefined);
      return;
    }
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ctx = new AudioContextClass();
      await this.ctx.resume();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.uiGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    this.master.connect(compressor).connect(ctx.destination);
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.uiGain.connect(this.master);
    this.music = new Music(ctx, this.musicGain, this.rng);
    this.music.setIntensity(this.pendingIntensity);
    this.applyVolumes(this.settings);
    if (this.musicWanted) this.music.start();
  }

  private target(group: 'sfx' | 'ui'): SynthTarget | null {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    const out = group === 'ui' ? this.uiGain : this.sfxGain;
    if (!out) return null;
    return { ctx: this.ctx, out, rng: this.rng };
  }

  private bind(bus: EventBus): void {
    const sfx = (fn: (t: SynthTarget) => void) => (): void => {
      const t = this.target('sfx');
      if (t) fn(t);
    };
    this.unsubscribe.push(
      bus.on('player:jump', ({ double }) => {
        const t = this.target('sfx');
        if (!t) return;
        if (double) Synth.doubleJump(t);
        else Synth.jump(t);
      }),
      bus.on('player:land', ({ impact }) => {
        if (this.landCooldown > 0 || impact < 2) return;
        this.landCooldown = 0.08;
        const t = this.target('sfx');
        if (t) Synth.land(t, impact);
      }),
      bus.on('energy:collected', ({ count }) => {
        const t = this.target('sfx');
        if (t) Synth.orb(t, count);
      }),
      bus.on('checkpoint:activated', sfx(Synth.checkpoint)),
      bus.on('teleport', sfx(Synth.teleport)),
      bus.on('platform:activated', sfx(Synth.activate)),
      bus.on('platform:crumble', sfx(Synth.crumble)),
      bus.on('platform:fall', sfx(Synth.crumble)),
      bus.on('portal:opened', sfx(Synth.portalOpen)),
      bus.on('player:died', sfx(Synth.death)),
      bus.on('player:respawn', sfx(Synth.respawn)),
      bus.on('gravity:changed', sfx(Synth.gravity)),
      bus.on('stage:complete', sfx(Synth.stageComplete)),
      bus.on('core:ignite', () => {
        const t = this.target('sfx');
        if (t) Synth.coreIgnite(t);
        this.music?.climax();
      }),
      bus.on('game:complete', sfx(Synth.gameComplete)),
      bus.on('ui:hover', () => {
        const t = this.target('ui');
        if (t) Synth.uiHover(t);
      }),
      bus.on('ui:confirm', () => {
        const t = this.target('ui');
        if (t) Synth.uiConfirm(t);
      }),
    );
  }

  applyVolumes(settings: Settings): void {
    this.settings = settings;
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain || !this.uiGain) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.masterVolume, now, 0.05);
    this.musicGain.gain.setTargetAtTime(settings.musicVolume * (this.paused ? 0.35 : 1), now, 0.2);
    this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.05);
    this.uiGain.gain.setTargetAtTime(settings.sfxVolume * 0.8, now, 0.05);
  }

  setMusicIntensity(value: number): void {
    this.pendingIntensity = value;
    this.music?.setIntensity(value);
  }

  startMusic(): void {
    this.musicWanted = true;
    this.music?.start();
  }

  stopMusic(): void {
    this.musicWanted = false;
    this.music?.stop();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyVolumes(this.settings);
  }

  update(delta: number): void {
    this.landCooldown = Math.max(0, this.landCooldown - delta);
    this.music?.update(delta);
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.music?.dispose();
    void this.ctx?.close();
    this.ctx = null;
  }
}
