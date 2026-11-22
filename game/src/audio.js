// Sound, all synthesized with WebAudio — no audio files, no network. Engine hum,
// sirens, gunshots, pickups and jingles, plus a low-key procedural music loop
// (bass + pad + a sparse lead) that starts once the player interacts.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.rainSrc = null;
    this.rainGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.3, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shot() { this.noise(0.14, 0.35, 900); this.tone(160, 0.08, 'square', 0.12, 60); }
  hit() { this.tone(220, 0.08, 'square', 0.15, 110); }
  hurt() { this.tone(140, 0.18, 'sawtooth', 0.18, 70); }
  coin() { this.tone(880, 0.09, 'sine', 0.18); this.tone(1320, 0.12, 'sine', 0.15, null, 0.07); }
  blip() { this.tone(660, 0.07, 'sine', 0.15); }
  mission() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.2, null, i * 0.12)); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, null, i * 0.13)); }
  wasted() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.16, null, i * 0.18)); }
  explosion() { this.noise(0.7, 0.5, 500); this.tone(90, 0.5, 'sine', 0.3, 30); }
  crash() { this.noise(0.2, 0.3, 700); }
  punch() { this.noise(0.08, 0.25, 500); }

  siren(level = 1) {
    if (!this.ctx || this.muted) return;
    if (level >= 4) {
      // Yelp: frantic rapid two-tone for 4–5 stars.
      for (let i = 0; i < 6; i += 1) {
        this.tone(i % 2 === 0 ? 950 : 700, 0.12, 'sine', 0.1, null, i * 0.12);
      }
      return;
    }
    // A short two-tone wail so the player notices the heat.
    this.tone(700, 0.35, 'sine', 0.1, 950);
    this.tone(950, 0.35, 'sine', 0.1, 700, 0.35);
  }

  /** A car horn: two short blasts, used when traffic is startled. */
  horn() {
    this.tone(370, 0.12, 'square', 0.08);
    this.tone(370, 0.14, 'square', 0.08, null, 0.16);
  }

  /** Looping rain patter (filtered noise). Call setRain(true/false). */
  setRain(on) {
    if (!this.ctx) return;
    if (on && !this.rainSrc) {
      const len = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.6;
      const g = this.ctx.createGain();
      g.gain.value = this.muted ? 0 : 0.05;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start();
      this.rainSrc = src;
      this.rainGain = g;
    } else if (!on && this.rainSrc) {
      try { this.rainSrc.stop(); } catch { /* already stopped */ }
      this.rainSrc = null;
      this.rainGain = null;
    }
    if (this.rainGain) this.rainGain.gain.value = on && !this.muted ? 0.05 : 0;
  }

  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speedRatio, driving, isBike = false) {
    if (!this.engineOsc || !this.engineGain) return;
    const target = driving ? 0.05 + speedRatio * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
    // A bike revs higher and buzzier than a car at the same speed.
    const base = isBike ? 85 : 50;
    const sweep = isBike ? 190 : 130;
    this.engineOsc.frequency.setTargetAtTime(base + speedRatio * sweep, this.ctx.currentTime, 0.08);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicOn = true;
    // A-minor groove: bass roots [A2, F2, C3, G2], a soft pad, sparse lead.
    const bassNotes = [110, 87.31, 130.81, 98];
    const padNotes = [220, 261.63, 329.63];
    const leadNotes = [440, 523.25, 587.33, 659.25, 523.25, 440, 392, 329.63];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.musicOn) return;
      const bar = this.musicStep % 4;
      const beat = Math.floor(this.musicStep / 4) % 8;
      this.tone(bassNotes[bar], 0.5, 'triangle', 0.1);
      if (beat === 0) {
        padNotes.forEach((f) => this.tone(f, 1.8, 'sine', 0.03));
      }
      if (beat % 2 === 0 && Math.random() < 0.5) {
        this.tone(leadNotes[(this.musicStep * 7) % leadNotes.length], 0.3, 'square', 0.03);
      }
      this.musicStep += 1;
    }, 300);
  }
}
