// pipe-muse audio — efectos sintetizados con Web Audio API (100% originales).
// Sin assets: osciladores + ruido con envolventes.

export type SfxName =
  | 'place'
  | 'boom'
  | 'glug'
  | 'spill'
  | 'clear'
  | 'over'
  | 'tick'
  | 'turn'
  | 'bad'
  | 'click';

export class AudioMan {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNoteAt = 0;
  private step = 0;
  muted = false;
  unlocked = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('pipe-muse-muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Debe llamarse desde un gesto de usuario (autoplay policy). */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.34;
      this.musicBus.connect(this.master);
      // Buffer de ruido reutilizable (1s).
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.unlocked = true;
      void this.ctx.resume();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('pipe-muse-muted', this.muted ? '1' : '0');
    } catch {
      // Sin almacenamiento: el silencio vive solo en memoria.
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  /** Dispara un efecto (o melodía corta). Silencioso si no hay unlock. */
  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'place':
        this.tone('square', 620, 880, t, 0.07, 0.16);
        break;
      case 'click':
        this.tone('square', 980, 980, t, 0.035, 0.1);
        break;
      case 'tick':
        this.tone('square', 1250, 1250, t, 0.05, 0.14);
        break;
      case 'glug': {
        const f = 260 + Math.random() * 120;
        this.tone('sine', f + 120, f - 60, t, 0.09, 0.22);
        break;
      }
      case 'boom':
        this.noise(t, 0.4, 2400, 160, 0.5);
        this.tone('sine', 150, 38, t, 0.38, 0.4);
        break;
      case 'spill':
        this.noise(t, 0.5, 900, 300, 0.35);
        this.tone('square', 420, 90, t, 0.45, 0.16);
        break;
      case 'turn':
        this.tone('square', 660, 660, t, 0.08, 0.16);
        this.tone('square', 880, 880, t + 0.09, 0.12, 0.16);
        break;
      case 'bad':
        this.tone('sawtooth', 150, 110, t, 0.22, 0.2);
        break;
      case 'clear':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, t + i * 0.09, 0.11, 0.16));
        break;
      case 'over':
        [440, 349, 294, 220].forEach((f, i) => this.tone('triangle', f, f * 0.99, t + i * 0.14, 0.16, 0.22));
        break;
    }
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    at: number,
    dur: number,
    vol: number,
    bus?: GainNode | null,
  ): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(bus ?? this.master);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, f0: number, f1: number, vol: number): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(f0, at);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  // ---------- chiptune original: "Tubería Nocturna" (bucle 2 compases) ----------

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    if (!this.ctx) return;
    const SPB = 60 / 150 / 2; // corcheas a 150bpm
    while (this.nextNoteAt < this.ctx.currentTime + 0.14) {
      this.playStep(this.step, this.nextNoteAt, SPB);
      this.nextNoteAt += SPB;
      this.step = (this.step + 1) % 32;
    }
  }

  private playStep(s: number, at: number, spb: number): void {
    if (!this.ctx || !this.musicBus) return;
    // Lead (cuadrada, La menor; melodía original).
    const lead: Array<number | 0> = [
      440, 0, 523, 0, 659, 0, 523, 0, 587, 0, 523, 440, 0, 392, 0, 0,
      440, 0, 523, 0, 659, 784, 0, 659, 587, 0, 659, 523, 0, 440, 392, 0,
    ];
    // Bajo (triangular).
    const bass: Array<number | 0> = [
      110, 0, 110, 0, 87, 0, 87, 0, 98, 0, 98, 0, 87, 0, 82, 0,
      110, 0, 110, 0, 87, 0, 87, 0, 98, 0, 82, 0, 82, 0, 82, 0,
    ];
    const l = lead[s];
    if (l) this.tone('square', l, l, at, spb * 0.92, 0.11, this.musicBus);
    const b = bass[s];
    if (b) this.tone('triangle', b, b, at, spb * 0.95, 0.2, this.musicBus);
    if (s % 2 === 0) this.hat(at);
  }

  private hat(at: number): void {
    if (!this.ctx || !this.musicBus || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.musicBus);
    src.start(at);
    src.stop(at + 0.06);
  }
}
