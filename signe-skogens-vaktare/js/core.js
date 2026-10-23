// core.js – gemensam namnrymd, matte, färger, signaler och brus.
// Alla moduler hänger på window.SV så att spelet kan köras som vanliga
// <script>-taggar (fungerar offline, i en enda HTML-fil och i Node-testerna).
(function () {
  'use strict';
  const SV = (window.SV = window.SV || {});

  SV.TILE = 16; // en ruta = 16 konstpixlar

  // ---------- Matte ----------
  SV.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SV.lerp = (a, b, t) => a + (b - a) * t;
  SV.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  SV.approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  SV.angleDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // Deterministisk slump (mulberry32) så att världen blir likadan varje gång.
  SV.rng = function (seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (a, b) => a + next() * (b - a);
    next.int = (a, b) => Math.floor(a + next() * (b - a + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    return next;
  };

  // Snabb heltalshash för per-pixel-variation.
  SV.hash = (x, y, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // Mjukt värdebrus (0..1).
  SV.noise = (x, y, s = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = SV.hash(xi, yi, s), b = SV.hash(xi + 1, yi, s);
    const c = SV.hash(xi, yi + 1, s), d = SV.hash(xi + 1, yi + 1, s);
    return SV.lerp(SV.lerp(a, b, u), SV.lerp(c, d, u), v);
  };
  SV.fbm = (x, y, s = 0) => SV.noise(x, y, s) * 0.6 + SV.noise(x * 2.1, y * 2.1, s + 7) * 0.3 + SV.noise(x * 4.3, y * 4.3, s + 13) * 0.1;

  // ---------- Färger ----------
  SV.hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  SV.rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => SV.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  SV.mixRgb = (a, b, t) => [SV.lerp(a[0], b[0], t), SV.lerp(a[1], b[1], t), SV.lerp(a[2], b[2], t)];
  SV.mixHex = (a, b, t) => SV.rgbToHex(...SV.mixRgb(SV.hexToRgb(a), SV.hexToRgb(b), t));
  // f < 0 mörkare, f > 0 ljusare
  SV.shadeHex = (hex, f) => SV.mixHex(hex, f < 0 ? '#14101e' : '#ffffff', Math.abs(f));

  SV.rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  };

  // Motsvarar Godots Gradient.sample(t)
  SV.Gradient = class {
    constructor(stops) {
      this.stops = stops.map(([t, hex]) => [t, SV.hexToRgb(hex)]);
    }
    sample(t) {
      const s = this.stops;
      if (t <= s[0][0]) return s[0][1].slice();
      for (let i = 1; i < s.length; i++) {
        if (t <= s[i][0]) {
          const k = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
          return SV.mixRgb(s[i - 1][1], s[i][1], k);
        }
      }
      return s[s.length - 1][1].slice();
    }
  };

  // ---------- Signaler (Godots signal/emit_signal) ----------
  SV.Emitter = class {
    constructor() {
      this._handlers = {};
    }
    on(evt, fn) {
      (this._handlers[evt] = this._handlers[evt] || []).push(fn);
      return this;
    }
    emit(evt, ...args) {
      (this._handlers[evt] || []).forEach((fn) => fn(...args));
    }
  };

  // ---------- Lagring (kan saknas i privata fönster) ----------
  SV.store = {
    get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* lagring blockerad – spelet fungerar ändå */
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        /* ignorera */
      }
    },
  };
})();
