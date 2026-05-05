type Wave = OscillatorType;

type PlayOptions = {
  freq: number;
  durationMs: number;
  volume?: number;
  type?: Wave;
  delayMs?: number;
};

const MUSIC_TRACKS = ["/audio/Aura.mp3", "/audio/Lost Without My Squad.mp3"];

export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private sfxVolume = 0.75;
  private musicVolume = 0.45;
  private sfxBoost = 2.6;
  private music: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private onTrackEnded: (() => void) | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const context = new Ctx();
    const master = context.createGain();
    master.gain.value = this.sfxVolume;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    return context;
  }

  private ensureMusic(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.music) return this.music;
    const audio = new Audio(MUSIC_TRACKS[this.trackIndex]);
    audio.preload = "metadata";
    audio.loop = false;
    audio.volume = Math.max(0, Math.min(1, this.musicVolume));
    this.onTrackEnded = () => {
      this.trackIndex = (this.trackIndex + 1) % MUSIC_TRACKS.length;
      audio.src = MUSIC_TRACKS[this.trackIndex];
      if (this.enabled) {
        void audio.play().catch(() => {});
      }
    };
    audio.addEventListener("ended", this.onTrackEnded);
    this.music = audio;
    return audio;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
    const music = this.music;
    if (music) {
      music.muted = !next;
      if (!next) music.pause();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setSfxVolume(next: number): void {
    const clamped = Math.max(0, Math.min(1, next));
    this.sfxVolume = clamped;
    if (this.master) {
      this.master.gain.value = clamped;
    }
  }

  setMusicVolume(next: number): void {
    const clamped = Math.max(0, Math.min(1, next));
    this.musicVolume = clamped;
    const music = this.music;
    if (music) {
      music.volume = clamped;
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  async startMusic(): Promise<boolean> {
    if (!this.enabled) return false;
    this.unlock();
    const music = this.ensureMusic();
    if (!music) return false;
    try {
      await music.play();
      return true;
    } catch {
      return false;
    }
  }

  pauseMusic(): void {
    this.music?.pause();
  }

  isMusicPlaying(): boolean {
    const music = this.music;
    return !!music && !music.paused && !music.ended;
  }

  dispose(): void {
    if (this.music) {
      if (this.onTrackEnded) {
        this.music.removeEventListener("ended", this.onTrackEnded);
      }
      this.music.pause();
      this.music.src = "";
      this.music.load();
      this.music = null;
    }
    if (this.context) {
      void this.context.close().catch(() => {});
      this.context = null;
      this.master = null;
    }
    this.onTrackEnded = null;
  }

  playClick(): void {
    this.playTone({ freq: 520, durationMs: 52, volume: 0.06, type: "triangle" });
  }

  playSwap(): void {
    this.playTone({ freq: 230, durationMs: 70, volume: 0.08, type: "sawtooth" });
    this.playTone({ freq: 295, durationMs: 85, volume: 0.065, type: "triangle", delayMs: 28 });
  }

  playMatchPop(): void {
    this.playTone({ freq: 470, durationMs: 100, volume: 0.085, type: "triangle" });
    this.playTone({ freq: 620, durationMs: 130, volume: 0.075, type: "sine", delayMs: 38 });
  }

  playCombo(cascadeCount: number): void {
    const clamped = Math.max(2, Math.min(6, cascadeCount));
    for (let i = 0; i < clamped; i += 1) {
      this.playTone({
        freq: 410 + i * 90,
        durationMs: 90 + i * 11,
        volume: 0.055 + i * 0.006,
        type: "square",
        delayMs: i * 58,
      });
    }
  }

  playInvalidSwap(): void {
    this.playTone({ freq: 210, durationMs: 140, volume: 0.08, type: "square" });
    this.playTone({ freq: 165, durationMs: 180, volume: 0.07, type: "sawtooth", delayMs: 56 });
  }

  playLevelUp(): void {
    this.playTone({ freq: 580, durationMs: 100, volume: 0.09, type: "triangle" });
    this.playTone({ freq: 760, durationMs: 130, volume: 0.09, type: "sine", delayMs: 45 });
    this.playTone({ freq: 980, durationMs: 170, volume: 0.095, type: "sine", delayMs: 92 });
  }

  playGameOver(): void {
    this.playTone({ freq: 260, durationMs: 160, volume: 0.085, type: "square" });
    this.playTone({ freq: 200, durationMs: 210, volume: 0.08, type: "triangle", delayMs: 70 });
    this.playTone({ freq: 150, durationMs: 260, volume: 0.075, type: "sawtooth", delayMs: 150 });
  }

  playScoreSubmitSuccess(): void {
    this.playTone({ freq: 690, durationMs: 115, volume: 0.085, type: "triangle" });
    this.playTone({ freq: 900, durationMs: 165, volume: 0.085, type: "sine", delayMs: 58 });
  }

  playCheckInSuccess(): void {
    this.playTone({ freq: 500, durationMs: 95, volume: 0.08, type: "triangle" });
    this.playTone({ freq: 680, durationMs: 130, volume: 0.075, type: "sine", delayMs: 42 });
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
    const boostedVolume = Math.min(0.26, Math.max(0.018, volume * this.sfxBoost));
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(boostedVolume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.03);
  }
}

let singleton: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!singleton) singleton = new SoundEngine();
  return singleton;
}
