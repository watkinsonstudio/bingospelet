// audio.js – små syntljud med WebAudio (inga ljudfiler behövs).
(function () {
  'use strict';
  const SV = window.SV;

  const Sfx = {
    ctx: null,
    master: null,
    muted: false,
    _noiseBuf: null,

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this._noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) {
        this.ctx = null;
      }
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.2, freq = 2000, delay = 0, type = 'bandpass') {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.02);
    },

    play(name) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'zap':
          this.tone('square', 1400, 300, 0.09, 0.08);
          this.noise(0.08, 0.12, 4000);
          break;
        case 'charge':
          this.tone('sine', 300, 900, 0.25, 0.05);
          break;
        case 'emp':
          this.tone('sawtooth', 200, 40, 0.5, 0.15);
          this.noise(0.4, 0.2, 800, 0, 'lowpass');
          break;
        case 'frost':
          this.noise(0.15, 0.1, 6000, 0, 'highpass');
          this.tone('sine', 900, 1800, 0.12, 0.05);
          break;
        case 'freeze':
          this.tone('triangle', 1800, 2600, 0.2, 0.08);
          this.tone('triangle', 2400, 3200, 0.2, 0.05, 0.06);
          break;
        case 'hit':
          this.noise(0.06, 0.15, 1500);
          break;
        case 'robotDown':
          this.tone('sawtooth', 600, 60, 0.6, 0.1);
          this.noise(0.3, 0.1, 3000, 0.1);
          break;
        case 'hurt':
          this.tone('square', 220, 110, 0.18, 0.1);
          break;
        case 'pickup':
          this.tone('square', 660, 660, 0.05, 0.05);
          this.tone('square', 990, 990, 0.07, 0.05, 0.05);
          break;
        case 'crystal':
          [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.08, i * 0.08));
          break;
        case 'bark':
          this.tone('square', 420, 260, 0.08, 0.1);
          this.tone('square', 420, 240, 0.09, 0.1, 0.13);
          break;
        case 'alert':
          this.tone('square', 880, 1200, 0.08, 0.05);
          break;
        case 'level':
          [392, 523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.12, 0.06, i * 0.07));
          break;
        case 'super':
          this.tone('sawtooth', 120, 900, 0.5, 0.12);
          [523, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.08, 0.2 + i * 0.09));
          break;
        case 'thunder':
          this.noise(1.2, 0.25, 300, 0, 'lowpass');
          break;
        case 'ui':
          this.tone('square', 740, 740, 0.04, 0.04);
          break;
        case 'deny':
          this.tone('square', 200, 160, 0.12, 0.06);
          break;
        case 'build':
          [0, 0.12, 0.24].forEach((d) => this.noise(0.07, 0.15, 900, d));
          break;
        case 'win':
          [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.09, i * 0.13));
          break;
      }
    },
  };

  SV.Sfx = Sfx;
})();
