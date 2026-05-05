type Wave = OscillatorType;

type PlayOptions = {
  freq: number;
  durationMs: number;
  volume?: number;
  type?: Wave;
  delayMs?: number;
};

const AMBIENT_NOTES = [174, 220, 261.63, 329.63];

export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private ambientTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const context = new Ctx();
    const master = context.createGain();
    master.gain.value = 0.35;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    return context;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
    if (!next) this.stopAmbient();
  }

  startAmbient(): void {
    if (!this.enabled || this.ambientTimer !== null) return;
    this.unlock();
    const playLoop = () => {
      if (!this.enabled) return;
      const base = AMBIENT_NOTES[Math.floor(Math.random() * AMBIENT_NOTES.length)];
      this.playTone({ freq: base, durationMs: 850, volume: 0.02, type: "sine" });
      this.playTone({ freq: base * 1.5, durationMs: 620, volume: 0.012, type: "triangle", delayMs: 180 });
    };
    playLoop();
    this.ambientTimer = window.setInterval(playLoop, 2400);
  }

  stopAmbient(): void {
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  playClick(): void {
    this.playTone({ freq: 520, durationMs: 55, volume: 0.03, type: "triangle" });
  }

  playSwipe(): void {
    this.playTone({ freq: 220, durationMs: 70, volume: 0.05, type: "sawtooth" });
    this.playTone({ freq: 280, durationMs: 85, volume: 0.04, type: "triangle", delayMs: 35 });
  }

  playMatch(): void {
    this.playTone({ freq: 470, durationMs: 110, volume: 0.05, type: "triangle" });
    this.playTone({ freq: 620, durationMs: 140, volume: 0.04, type: "sine", delayMs: 45 });
  }

  playCombo(cascadeCount: number): void {
    const clamped = Math.max(2, Math.min(6, cascadeCount));
    for (let i = 0; i < clamped; i += 1) {
      const freq = 410 + i * 90;
      this.playTone({
        freq,
        durationMs: 95 + i * 12,
        volume: 0.03 + i * 0.005,
        type: "square",
        delayMs: i * 60,
      });
    }
  }

  playSuccess(): void {
    this.playTone({ freq: 660, durationMs: 120, volume: 0.045, type: "triangle" });
    this.playTone({ freq: 880, durationMs: 170, volume: 0.04, type: "sine", delayMs: 55 });
  }

  playError(): void {
    this.playTone({ freq: 220, durationMs: 170, volume: 0.04, type: "square" });
    this.playTone({ freq: 170, durationMs: 210, volume: 0.03, type: "sawtooth", delayMs: 65 });
  }

  private playTone({ freq, durationMs, volume = 0.04, type = "sine", delayMs = 0 }: PlayOptions): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const master = this.master;
    if (!ctx || !master) return;

    const startTime = ctx.currentTime + delayMs / 1000;
    const endTime = startTime + durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }
}

let singleton: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!singleton) singleton = new SoundEngine();
  return singleton;
}
