// Synthesized WebAudio: engine hum, sirens, gunshots, rain and a
// procedural music loop. No audio files are used.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.rainGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: sawtooth through a lowpass, gain follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      // Rain: looped filtered noise.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.4;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(bp); bp.connect(this.rainGain); this.rainGain.connect(this.ctx.destination);
      src.start();
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.suspend();
    if (!m && this.ctx) this.ctx.resume();
  }

  engine(speedRatio, bike) {
    if (!this.ctx || this.muted) return;
    this.engineOsc.frequency.value = 55 + speedRatio * (bike ? 320 : 190);
    this.engineGain.gain.value = 0.02 + speedRatio * 0.05;
  }

  rain(on) {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(on && !this.muted ? 0.05 : 0, this.ctx.currentTime, 0.4);
  }

  siren(stars) {
    if (!this.ctx || this.muted || stars === 0) return;
    if (!this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'triangle';
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0.02;
      this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this.ctx.destination);
      this._sirenOsc.start();
      this._sirenT = 0;
    }
    this._sirenT += 0.016;
    // Yelp at 4-5 stars, slow wail at 1-3.
    const rate = stars >= 4 ? 6 : 1.6;
    const f = 700 + Math.sin(this._sirenT * rate * Math.PI * 2) * 320;
    this._sirenOsc.frequency.value = f;
    this._sirenGain.gain.value = 0.018;
  }

  stopSiren() {
    if (this._sirenGain) this._sirenGain.gain.value = 0;
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  gunshot(far) { this.blip(far ? 160 : 220, 0.12, 'square', far ? 0.04 : 0.1); }
  punch() { this.blip(90, 0.08, 'sine', 0.12); }
  pickup() { this.blip(880, 0.12, 'sine', 0.08); this.blip(1320, 0.14, 'sine', 0.06); }
  mission() { this.blip(523, 0.15, 'triangle', 0.09); this.blip(659, 0.2, 'triangle', 0.09); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.1), i * 110)); }
  lose() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.07), i * 140)); }
  horn() { this.blip(370, 0.3, 'sawtooth', 0.06); }

  startMusic() {
    if (!this.ctx) return;
    // Simple minor-key bass loop, one note every 0.42s.
    const notes = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = notes[this.musicStep % notes.length];
      this.musicStep += 1;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.035, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.42);
    }, 420);
  }
}
