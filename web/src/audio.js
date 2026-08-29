export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.sfx = true;
    this.music = true;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicRunning = false;
    this.visibilityBound = false;
  }

  configure({ sfx, music }) {
    this.sfx = Boolean(sfx);
    this.music = Boolean(music);
    if (!this.music) this.stopMusic();
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
    sfxBus.gain.value = 0.72;
    musicBus.gain.value = 0.38;

    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;

    if (!this.visibilityBound) {
      document.addEventListener('visibilitychange', () => {
        if (!this.music) return;
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

    if (this.music) this.startMusic();
    return ctx.state === 'running';
  }

  tone(freq = 440, dur = 0.08, type = 'sine', vol = 0.2, slide = 0) {
    if (!this.sfx) return;
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

  playMusicNote(freq, duration = 0.52) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicBus) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const lead = ctx.createOscillator();
    const sub = ctx.createOscillator();

    lead.type = 'triangle';
    sub.type = 'sine';
    lead.frequency.value = freq;
    sub.frequency.value = freq / 2;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    lead.connect(gain);
    sub.connect(gain);
    gain.connect(this.musicBus);

    lead.start(now);
    sub.start(now);
    lead.stop(now + duration + 0.03);
    sub.stop(now + duration + 0.03);
  }

  tickMusic() {
    if (!this.music || document.hidden) return;

    // A restrained procedural pulse rather than a barely-audible static hum.
    const pattern = [
      110.0, 164.81, 220.0, 164.81,
      123.47, 185.0, 246.94, 185.0,
      98.0, 146.83, 196.0, 146.83,
      110.0, 164.81, 220.0, 246.94,
    ];
    const freq = pattern[this.musicStep % pattern.length];
    this.musicStep += 1;
    this.playMusicNote(freq, 0.55);
  }

  startMusic() {
    if (!this.music || this.musicRunning || !this.ctx || this.ctx.state !== 'running') return;

    this.musicRunning = true;
    this.tickMusic();
    this.musicTimer = window.setInterval(() => this.tickMusic(), 420);
  }

  stopMusic(resetStep = true) {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicRunning = false;
    if (resetStep) this.musicStep = 0;
  }
}
