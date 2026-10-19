/**
 * Generative ambient score: slow pad chords, a probabilistic arpeggio with echo, and a sub pulse.
 * `intensity` (0..1) opens the filter, densifies the arp and adds the pulse — rising per stage.
 */
const BPM = 76;
const BEAT = 60 / BPM;
const CHORDS: number[][] = [
  [45, 52, 57, 60, 64], // A minor (A C E)
  [41, 48, 53, 57, 60], // F major
  [48, 55, 60, 64, 67], // C major
  [43, 50, 55, 59, 62], // G major
];
const CHORD_BEATS = 8;
const SCALE = [0, 2, 3, 5, 7, 9, 10]; // A dorian-ish colour

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  private intensity = 0.2;
  private targetIntensity = 0.2;
  private running = false;
  private nextBeat = 0;
  private beatIndex = 0;
  private timer: number | null = null;
  private readonly padGain: GainNode;
  private readonly arpGain: GainNode;
  private readonly bassGain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;
  private padVoices: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private currentChord = -1;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
    private readonly rng: () => number,
  ) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.filter.Q.value = 0.7;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0001;
    this.padGain.connect(this.filter).connect(out);
    this.arpGain = ctx.createGain();
    this.arpGain.gain.value = 0.5;
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = BEAT * 0.75;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.38;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 2400;
    this.arpGain.connect(out);
    this.arpGain.connect(this.delay);
    this.delay.connect(echoFilter).connect(this.feedback).connect(this.delay);
    this.feedback.connect(out);
    this.bassGain = ctx.createGain();
    this.bassGain.gain.value = 0.0001;
    this.bassGain.connect(out);
  }

  setIntensity(value: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, value));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.beatIndex = 0;
    this.padGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.padGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.padGain.gain.exponentialRampToValueAtTime(0.9, this.ctx.currentTime + 3);
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.padGain.gain.cancelScheduledValues(now);
    this.padGain.gain.setValueAtTime(this.padGain.gain.value, now);
    this.padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    for (const voice of this.padVoices) this.releaseVoice(voice, 1.4);
    this.padVoices = [];
    this.currentChord = -1;
  }

  /** Quick swell for the finale. */
  climax(): void {
    this.setIntensity(1);
    const now = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.filter.frequency.exponentialRampToValueAtTime(6000, now + 4);
  }

  update(delta: number): void {
    this.intensity += (this.targetIntensity - this.intensity) * (1 - Math.exp(-delta / 2.5));
    const cutoff = 500 + this.intensity * 2600;
    this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.5);
    this.bassGain.gain.setTargetAtTime(this.intensity > 0.3 ? 0.35 : 0.0001, this.ctx.currentTime, 0.8);
  }

  private schedule(): void {
    const lookahead = this.ctx.currentTime + 0.18;
    while (this.nextBeat < lookahead) {
      this.playBeat(this.beatIndex, this.nextBeat);
      this.nextBeat += BEAT;
      this.beatIndex += 1;
    }
  }

  private playBeat(beat: number, time: number): void {
    const chordIndex = Math.floor(beat / CHORD_BEATS) % CHORDS.length;
    if (chordIndex !== this.currentChord) {
      this.currentChord = chordIndex;
      this.playPad(CHORDS[chordIndex], time);
    }
    const chord = CHORDS[chordIndex];
    const subdivisions = this.intensity > 0.65 ? 4 : this.intensity > 0.35 ? 2 : 1;
    const probability = 0.25 + this.intensity * 0.6;
    for (let s = 0; s < subdivisions; s += 1) {
      if (this.rng() > probability) continue;
      const pool = [...chord.slice(1), chord[2] + 12, chord[3] + 12, chord[1] + 12 + SCALE[Math.floor(this.rng() * SCALE.length)] - SCALE[0]];
      const note = pool[Math.floor(this.rng() * pool.length)] + 12;
      this.pluck(midi(note), time + (s / subdivisions) * BEAT, 0.08 + this.intensity * 0.06);
    }
    if (beat % 2 === 0) this.bass(midi(chord[0] - 12), time);
  }

  private playPad(chord: number[], time: number): void {
    for (const voice of this.padVoices) this.releaseVoice(voice, 2.5, time);
    this.padVoices = [];
    const voices = [chord[0], chord[1], chord[2], chord[3] + 12];
    for (const note of voices) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.09, time + 2.4);
      gain.connect(this.padGain);
      const oscs: OscillatorNode[] = [];
      for (const detune of [-7, 7]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midi(note);
        osc.detune.value = detune;
        osc.connect(gain);
        osc.start(time);
        oscs.push(osc);
      }
      this.padVoices.push({ osc: oscs, gain });
    }
  }

  private releaseVoice(voice: { osc: OscillatorNode[]; gain: GainNode }, release: number, time = this.ctx.currentTime): void {
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), time);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, time + release);
    for (const osc of voice.osc) osc.stop(time + release + 0.1);
  }

  private pluck(freq: number, time: number, gain: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = this.rng() > 0.5 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
    osc.connect(env).connect(this.arpGain);
    osc.start(time);
    osc.stop(time + 0.6);
  }

  private bass(freq: number, time: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.5, time + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, time + BEAT * 1.6);
    osc.connect(env).connect(this.bassGain);
    osc.start(time);
    osc.stop(time + BEAT * 1.7);
  }

  dispose(): void {
    this.stop();
  }
}
