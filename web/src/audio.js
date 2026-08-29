export const MUSIC_TRACKS = Object.freeze({
  menu: Object.freeze({ src: 'assets/audio/menu.wav', gain: 1.00 }),
  level: Object.freeze({ src: 'assets/audio/level-loop.wav', gain: 1.00 }),
  marathon: Object.freeze({ src: 'assets/audio/marathon-loop.wav', gain: 1.00 }),
});

const MUSIC_MODES = new Set(Object.keys(MUSIC_TRACKS));
const clamp01 = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};
const BASE_SFX_GAIN = 0.72;
const BASE_MUSIC_GAIN = 0.38;

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.sfxVolume = 1;
    this.musicVolume = 1;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicRunning = false;
    this.musicMode = 'menu';
    this.musicSource = null;
    this.musicSourceGain = null;
    this.musicBuffers = new Map();
    this.musicLoadPromises = new Map();
    this.musicRequestId = 0;
    this.visibilityBound = false;
  }

  configure({ sfxVolume = 1, musicVolume = 1 }) {
    this.sfxVolume = clamp01(sfxVolume);
    this.musicVolume = clamp01(musicVolume);
    this.applyVolumeSettings();
    if (this.musicVolume <= 0) this.stopMusic();
  }

  applyVolumeSettings() {
    if (this.sfxBus) this.sfxBus.gain.value = BASE_SFX_GAIN * this.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = BASE_MUSIC_GAIN * this.musicVolume;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    const sfxBus = ctx.createGain();
    const musicBus = ctx.createGain();

    master.gain.value = 0.34;
    sfxBus.gain.value = BASE_SFX_GAIN * this.sfxVolume;
    musicBus.gain.value = BASE_MUSIC_GAIN * this.musicVolume;

    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;

    if (!this.visibilityBound) {
      document.addEventListener('visibilitychange', () => {
        if (this.musicVolume <= 0) return;
        if (document.hidden) this.stopMusic(false);
        else this.unlock();
      });
      this.visibilityBound = true;
    }

    return ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      return false;
    }

    if (this.musicVolume > 0) await this.startMusic();
    return ctx.state === 'running';
  }

  setMusicMode(mode) {
    const next = MUSIC_MODES.has(mode) ? mode : 'menu';
    if (next === this.musicMode) return;
    this.musicMode = next;
    this.musicStep = 0;

    if (this.musicVolume > 0 && this.ctx?.state === 'running' && !document.hidden) {
      this.stopMusic(false);
      void this.startMusic();
    }
  }

  async loadMusicBuffer(mode) {
    if (this.musicBuffers.has(mode)) return this.musicBuffers.get(mode);
    if (this.musicLoadPromises.has(mode)) return this.musicLoadPromises.get(mode);

    const ctx = this.ctx;
    const track = MUSIC_TRACKS[mode];
    if (!ctx || !track || typeof ctx.decodeAudioData !== 'function' || typeof window.fetch !== 'function') {
      return null;
    }

    const promise = (async () => {
      const response = await window.fetch(track.src);
      if (!response.ok) throw new Error(`Could not load music track: ${track.src}`);
      const encoded = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(encoded.slice(0));
      this.musicBuffers.set(mode, buffer);
      return buffer;
    })().catch(() => null).finally(() => {
      this.musicLoadPromises.delete(mode);
    });

    this.musicLoadPromises.set(mode, promise);
    return promise;
  }

  tone(freq = 440, dur = 0.08, type = 'sine', vol = 0.2, slide = 0) {
    if (this.sfxVolume <= 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, freq + slide),
        now + dur,
      );
    }

    gain.gain.setValueAtTime(Math.max(0.0001, vol), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    oscillator.connect(gain);
    gain.connect(this.sfxBus);
    oscillator.start(now);
    oscillator.stop(now + dur + 0.02);
  }

  shoot() {
    this.tone(820, 0.045, 'square', 0.12, -220);
  }

  hit() {
    this.tone(320, 0.05, 'triangle', 0.12, 110);
  }

  collect() {
    this.tone(720, 0.09, 'sine', 0.16, 450);
  }

  powerup() {
    this.tone(460, 0.08, 'triangle', 0.14, 260);
    setTimeout(() => this.tone(720, 0.1, 'sine', 0.12, 360), 55);
  }

  empty() {
    this.tone(165, 0.035, 'square', 0.055, -20);
  }

  extraLife() {
    this.tone(440, 0.09, 'triangle', 0.13, 220);
    setTimeout(() => this.tone(660, 0.1, 'triangle', 0.13, 250), 80);
    setTimeout(() => this.tone(990, 0.13, 'sine', 0.12, 180), 170);
  }

  proton() {
    this.tone(105, 0.22, 'sawtooth', 0.22, -55);
  }

  explode() {
    this.tone(150, 0.5, 'sawtooth', 0.24, -90);
    setTimeout(() => this.tone(80, 0.35, 'triangle', 0.14, 40), 70);
  }

  complete() {
    this.tone(520, 0.12, 'sine', 0.16, 220);
    setTimeout(() => this.tone(780, 0.18, 'sine', 0.14, 180), 130);
  }

  // Procedural fallback used only if a browser cannot decode one of the
  // bundled soundtrack files. Chromium/Electron/Android normally use the
  // authored loops above.
  playFallbackMusicNote(freq, duration = 0.52) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicBus) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const lead = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const modeGain = this.musicMode === 'menu' ? MUSIC_TRACKS.menu.gain : 1;

    lead.type = 'triangle';
    sub.type = 'sine';
    lead.frequency.value = freq;
    sub.frequency.value = freq / 2;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22 * modeGain, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    lead.connect(gain);
    sub.connect(gain);
    gain.connect(this.musicBus);

    lead.start(now);
    sub.start(now);
    lead.stop(now + duration + 0.03);
    sub.stop(now + duration + 0.03);
  }

  tickFallbackMusic() {
    if (this.musicVolume <= 0 || document.hidden) return;
    const pattern = this.musicMode === 'marathon'
      ? [220, 329.63, 440, 369.99, 246.94, 369.99, 493.88, 440]
      : [110, 164.81, 220, 164.81, 123.47, 185, 246.94, 185, 98, 146.83, 196, 146.83];
    const freq = pattern[this.musicStep % pattern.length];
    this.musicStep += 1;
    this.playFallbackMusicNote(freq, this.musicMode === 'marathon' ? 0.31 : 0.55);
  }

  startFallbackMusic() {
    this.musicRunning = true;
    this.tickFallbackMusic();
    const interval = this.musicMode === 'marathon' ? 250 : 420;
    this.musicTimer = window.setInterval(() => this.tickFallbackMusic(), interval);
  }

  async startMusic() {
    if (this.musicVolume <= 0 || this.musicRunning || !this.ctx || this.ctx.state !== 'running' || document.hidden) return;

    const requestId = ++this.musicRequestId;
    const mode = this.musicMode;
    const track = MUSIC_TRACKS[mode];
    const buffer = await this.loadMusicBuffer(mode);

    if (requestId !== this.musicRequestId || this.musicVolume <= 0 || document.hidden || this.musicMode !== mode) return;

    if (!buffer || typeof this.ctx.createBufferSource !== 'function') {
      this.startFallbackMusic();
      return;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = track.gain;

    source.connect(gain);
    gain.connect(this.musicBus);
    source.start();

    this.musicSource = source;
    this.musicSourceGain = gain;
    this.musicRunning = true;
  }

  stopMusic(resetStep = true) {
    this.musicRequestId += 1;

    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* source may already be stopped */ }
      try { this.musicSource.disconnect(); } catch { /* already disconnected */ }
      this.musicSource = null;
    }
    if (this.musicSourceGain) {
      try { this.musicSourceGain.disconnect(); } catch { /* already disconnected */ }
      this.musicSourceGain = null;
    }

    this.musicRunning = false;
    if (resetStep) this.musicStep = 0;
  }
}
