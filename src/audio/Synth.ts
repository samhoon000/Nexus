/**
 * Procedural sound effects built from oscillators and filtered noise. Every recipe is a pure
 * function of (context, destination, rng) so the AudioManager can swap in decoded files later.
 */
export interface SynthTarget {
  ctx: AudioContext;
  out: AudioNode;
  rng: () => number;
}

interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  duration: number;
  gain?: number;
  attack?: number;
  delay?: number;
  detune?: number;
  filter?: number;
}

function tone(t: SynthTarget, o: ToneOptions): void {
  const { ctx, out } = t;
  const now = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, now);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), now + o.duration);
  if (o.detune) osc.detune.value = o.detune;
  const attack = o.attack ?? 0.008;
  const peak = o.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + o.duration);
  let node: AudioNode = osc;
  if (o.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = o.filter;
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + o.duration + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate * 1.5;
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return noiseBuffer;
}

interface NoiseOptions {
  duration: number;
  gain?: number;
  filter?: number;
  filterEnd?: number;
  type?: BiquadFilterType;
  q?: number;
  attack?: number;
  delay?: number;
}

function noise(t: SynthTarget, o: NoiseOptions): void {
  const { ctx, out } = t;
  const now = ctx.currentTime + (o.delay ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  source.playbackRate.value = 0.9 + t.rng() * 0.2;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.filter ?? 1200, now);
  if (o.filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.filterEnd), now + o.duration);
  const gain = ctx.createGain();
  const peak = o.gain ?? 0.15;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + (o.attack ?? 0.005));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + o.duration);
  source.connect(filter).connect(gain).connect(out);
  source.start(now);
  source.stop(now + o.duration + 0.05);
}

const vary = (t: SynthTarget, amount = 0.06): number => 1 + (t.rng() - 0.5) * amount * 2;

export const Synth = {
  jump(t: SynthTarget): void {
    const v = vary(t);
    tone(t, { type: 'triangle', freq: 320 * v, freqEnd: 720 * v, duration: 0.16, gain: 0.16 });
    noise(t, { duration: 0.12, gain: 0.05, filter: 2400, filterEnd: 600, type: 'highpass' });
  },

  doubleJump(t: SynthTarget): void {
    const v = vary(t);
    tone(t, { type: 'triangle', freq: 420 * v, freqEnd: 1100 * v, duration: 0.2, gain: 0.16 });
    tone(t, { type: 'sine', freq: 840 * v, freqEnd: 1680 * v, duration: 0.22, gain: 0.08, delay: 0.03 });
    noise(t, { duration: 0.2, gain: 0.06, filter: 3200, filterEnd: 800, type: 'bandpass', q: 2 });
  },

  land(t: SynthTarget, impact: number): void {
    const k = Math.min(1, impact / 24);
    noise(t, { duration: 0.14 + k * 0.1, gain: 0.08 + k * 0.14, filter: 500 + k * 400, filterEnd: 120, type: 'lowpass' });
    tone(t, { type: 'sine', freq: 140 * vary(t), freqEnd: 60, duration: 0.14, gain: 0.08 + k * 0.1 });
  },

  orb(t: SynthTarget, index: number): void {
    const base = 660 * Math.pow(2, (index % 5) / 12);
    const v = vary(t, 0.02);
    tone(t, { type: 'sine', freq: base * v, duration: 0.32, gain: 0.14, attack: 0.004 });
    tone(t, { type: 'sine', freq: base * 2 * v, duration: 0.28, gain: 0.06, delay: 0.04 });
    tone(t, { type: 'triangle', freq: base * 1.5 * v, freqEnd: base * 3 * v, duration: 0.18, gain: 0.05 });
    noise(t, { duration: 0.1, gain: 0.03, filter: 6000, type: 'highpass' });
  },

  checkpoint(t: SynthTarget): void {
    [0, 0.09, 0.18].forEach((d, i) => {
      tone(t, { type: 'sine', freq: 523 * Math.pow(2, [0, 4, 7][i] / 12), duration: 0.5, gain: 0.12, delay: d });
    });
    tone(t, { type: 'sawtooth', freq: 130, duration: 0.6, gain: 0.05, filter: 500 });
    noise(t, { duration: 0.5, gain: 0.04, filter: 2000, filterEnd: 5000, type: 'bandpass', attack: 0.2 });
  },

  teleport(t: SynthTarget): void {
    tone(t, { type: 'sawtooth', freq: 180, freqEnd: 1800, duration: 0.3, gain: 0.08, filter: 2600 });
    tone(t, { type: 'sine', freq: 1800, freqEnd: 300, duration: 0.35, gain: 0.08, delay: 0.25 });
    noise(t, { duration: 0.5, gain: 0.1, filter: 800, filterEnd: 4000, type: 'bandpass', q: 3 });
  },

  activate(t: SynthTarget): void {
    tone(t, { type: 'sawtooth', freq: 70, freqEnd: 110, duration: 0.9, gain: 0.12, filter: 300, attack: 0.1 });
    [0, 0.12, 0.24, 0.36].forEach((d, i) => tone(t, { type: 'sine', freq: 330 * Math.pow(2, i * 5 / 12), duration: 0.4, gain: 0.07, delay: d }));
    noise(t, { duration: 0.8, gain: 0.05, filter: 400, filterEnd: 3000, type: 'bandpass', attack: 0.3 });
  },

  portalOpen(t: SynthTarget): void {
    tone(t, { type: 'sine', freq: 110, duration: 1.6, gain: 0.14, attack: 0.3 });
    tone(t, { type: 'sine', freq: 220, duration: 1.4, gain: 0.08, attack: 0.2, delay: 0.1 });
    tone(t, { type: 'triangle', freq: 440, freqEnd: 880, duration: 1.2, gain: 0.06, attack: 0.3, delay: 0.2 });
    noise(t, { duration: 1.5, gain: 0.06, filter: 600, filterEnd: 6000, type: 'bandpass', q: 2, attack: 0.5 });
  },

  crumble(t: SynthTarget): void {
    noise(t, { duration: 0.5, gain: 0.12, filter: 900, filterEnd: 150, type: 'lowpass' });
    tone(t, { type: 'square', freq: 90, freqEnd: 40, duration: 0.4, gain: 0.05, filter: 400 });
  },

  warning(t: SynthTarget): void {
    tone(t, { type: 'square', freq: 880, duration: 0.08, gain: 0.03, filter: 2000 });
  },

  death(t: SynthTarget): void {
    tone(t, { type: 'sawtooth', freq: 400, freqEnd: 60, duration: 0.7, gain: 0.1, filter: 1200 });
    noise(t, { duration: 0.6, gain: 0.1, filter: 2000, filterEnd: 200, type: 'lowpass' });
    tone(t, { type: 'sine', freq: 60, duration: 0.6, gain: 0.12 });
  },

  respawn(t: SynthTarget): void {
    tone(t, { type: 'sine', freq: 300, freqEnd: 900, duration: 0.4, gain: 0.08, attack: 0.05 });
    noise(t, { duration: 0.4, gain: 0.04, filter: 3000, filterEnd: 8000, type: 'highpass', attack: 0.1 });
  },

  gravity(t: SynthTarget): void {
    tone(t, { type: 'sine', freq: 200, freqEnd: 90, duration: 0.8, gain: 0.1, attack: 0.05 });
    tone(t, { type: 'triangle', freq: 400, freqEnd: 1200, duration: 0.6, gain: 0.04, attack: 0.1 });
    noise(t, { duration: 0.9, gain: 0.05, filter: 300, filterEnd: 1500, type: 'bandpass', q: 4, attack: 0.2 });
  },

  uiHover(t: SynthTarget): void {
    tone(t, { type: 'sine', freq: 1400 * vary(t, 0.02), duration: 0.05, gain: 0.025 });
  },

  uiConfirm(t: SynthTarget): void {
    tone(t, { type: 'sine', freq: 740, freqEnd: 1480, duration: 0.12, gain: 0.06 });
    tone(t, { type: 'triangle', freq: 1480, duration: 0.18, gain: 0.03, delay: 0.05 });
  },

  stageComplete(t: SynthTarget): void {
    const notes = [0, 4, 7, 12, 16];
    notes.forEach((n, i) => {
      tone(t, { type: 'sine', freq: 440 * Math.pow(2, n / 12), duration: 1.4 - i * 0.1, gain: 0.1, delay: i * 0.11, attack: 0.02 });
      tone(t, { type: 'triangle', freq: 880 * Math.pow(2, n / 12), duration: 0.8, gain: 0.03, delay: i * 0.11 + 0.02 });
    });
    tone(t, { type: 'sawtooth', freq: 110, duration: 2.2, gain: 0.07, filter: 500, attack: 0.3 });
    noise(t, { duration: 2, gain: 0.04, filter: 1000, filterEnd: 7000, type: 'bandpass', attack: 0.8 });
  },

  coreIgnite(t: SynthTarget): void {
    tone(t, { type: 'sine', freq: 40, duration: 4, gain: 0.25, attack: 0.4 });
    tone(t, { type: 'sawtooth', freq: 55, freqEnd: 110, duration: 3.5, gain: 0.12, filter: 400, attack: 0.6 });
    noise(t, { duration: 3, gain: 0.14, filter: 200, filterEnd: 9000, type: 'bandpass', q: 1.5, attack: 1.2 });
    [0, 7, 12, 19, 24].forEach((n, i) => {
      tone(t, { type: 'sine', freq: 220 * Math.pow(2, n / 12), duration: 3 - i * 0.3, gain: 0.07, delay: 0.6 + i * 0.18, attack: 0.1 });
    });
  },

  gameComplete(t: SynthTarget): void {
    const notes = [0, 7, 12, 16, 19, 24];
    notes.forEach((n, i) => {
      tone(t, { type: 'sine', freq: 330 * Math.pow(2, n / 12), duration: 2.6, gain: 0.09, delay: i * 0.14, attack: 0.05 });
    });
    tone(t, { type: 'sawtooth', freq: 82.5, duration: 4, gain: 0.08, filter: 600, attack: 0.5 });
  },
};
