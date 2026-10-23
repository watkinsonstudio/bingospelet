// art.js – pixelverktyg: teckenkartor → canvas, automatisk kontur,
// tonade varianter och ArmorColorShader (portad från GDD:ns GLSL-shader).
(function () {
  'use strict';
  const SV = window.SV;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [c, g];
  }

  // Pixelbuffert med enkla ritprimitiver.
  class Pix {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.d = new Uint8ClampedArray(w * h * 4);
    }
    set(x, y, col, a = 255) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
      const rgb = typeof col === 'string' ? SV.hexToRgb(col) : col;
      const i = (y * this.w + x) * 4;
      this.d[i] = rgb[0];
      this.d[i + 1] = rgb[1];
      this.d[i + 2] = rgb[2];
      this.d[i + 3] = a;
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      const i = (y * this.w + x) * 4;
      return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2]] : null;
    }
    alpha(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      return this.d[(y * this.w + x) * 4 + 3];
    }
    rect(x, y, w, h, col) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
    }
    ellipse(cx, cy, rx, ry, colFn) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          const r = nx * nx + ny * ny;
          if (r <= 1) this.set(x, y, typeof colFn === 'function' ? colFn(x, y, nx, ny, r) : colFn);
        }
    }
    line(x0, y0, x1, y1, col) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= n; i++) this.set(Math.round(SV.lerp(x0, x1, i / n)), Math.round(SV.lerp(y0, y1, i / n)), col);
    }
    // Lägger en 1px kontur runt alla ifyllda pixlar (inåt i bufferten).
    outline(col = '#1b1730') {
      const rgb = SV.hexToRgb(col);
      const marks = [];
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          if (this.alpha(x, y)) continue;
          if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) marks.push([x, y]);
        }
      marks.forEach(([x, y]) => this.set(x, y, rgb));
      return this;
    }
    toCanvas() {
      const [c, g] = makeCanvas(this.w, this.h);
      g.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
      return c;
    }
  }

  const Art = {
    makeCanvas,
    Pix,

    // Teckenkarta → canvas. '.' och ' ' är genomskinliga.
    // opts.outline lägger till en kontur och 1px marginal runt om.
    fromMap(rows, pal, opts = {}) {
      const pad = opts.outline === false ? 0 : 1;
      const w = Math.max(...rows.map((r) => r.length)) + pad * 2;
      const h = rows.length + pad * 2;
      const p = new Pix(w, h);
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ') continue;
          if (!(ch in pal)) {
            console.warn('Saknad palettfärg', ch);
            continue;
          }
          p.set(x + pad, y + pad, pal[ch]);
        }
      });
      if (pad) p.outline(opts.outline || '#1b1730');
      return p.toCanvas();
    },

    // Spegla vänsterhalvan av en symmetrisk karta.
    mirror(halfRows) {
      return halfRows.map((r) => r + r.split('').reverse().join(''));
    },

    flip(src) {
      const [c, g] = makeCanvas(src.width, src.height);
      g.translate(src.width, 0);
      g.scale(-1, 1);
      g.drawImage(src, 0, 0);
      return c;
    },

    // Färgtonar en sprite (t.ex. frusen = isblå), behåller alfa.
    tint(src, hex, amount) {
      const [c, g] = makeCanvas(src.width, src.height);
      g.drawImage(src, 0, 0);
      const img = g.getImageData(0, 0, c.width, c.height);
      const t = SV.hexToRgb(hex);
      for (let i = 0; i < img.data.length; i += 4) {
        if (!img.data[i + 3]) continue;
        const lum = (img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11) / 255;
        for (let k = 0; k < 3; k++) img.data[i + k] = SV.lerp(img.data[i + k], t[k] * (0.45 + lum * 0.8), amount);
      }
      g.putImageData(img, 0, 0);
      return c;
    },

    silhouette(src, hex) {
      const [c, g] = makeCanvas(src.width, src.height);
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = hex;
      g.fillRect(0, 0, c.width, c.height);
      return c;
    },

    // Byt ut enskilda palettfärger (exakt matchning) – används för robotögon m.m.
    swap(src, map) {
      const [c, g] = makeCanvas(src.width, src.height);
      g.drawImage(src, 0, 0);
      const img = g.getImageData(0, 0, c.width, c.height);
      const pairs = Object.entries(map).map(([a, b]) => [SV.hexToRgb(a), SV.hexToRgb(b)]);
      for (let i = 0; i < img.data.length; i += 4) {
        if (!img.data[i + 3]) continue;
        for (const [a, b] of pairs) {
          if (img.data[i] === a[0] && img.data[i + 1] === a[1] && img.data[i + 2] === a[2]) {
            img.data[i] = b[0];
            img.data[i + 1] = b[1];
            img.data[i + 2] = b[2];
            break;
          }
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    },
  };

  // ------------------------------------------------------------------
  // ArmorColorShader – direkt port av ArmorColorShader.gdshader.
  //   uniform target_*  : ursprungsfärger på sprite-arket
  //   uniform new_*     : färger valda i spelets UI
  //   uniform tolerance : max avstånd i RGB-rymden (0..1)
  // Fragmentlogiken körs per pixel: närmaste målfärg inom toleransen
  // ersätts, övriga pixlar lämnas orörda. GDD:n har två par (primary /
  // secondary); här tar shadern godtyckligt många par så att hjälm,
  // bröstplåt och ben (plus skuggtoner) kan färgas var för sig.
  // ------------------------------------------------------------------
  const ArmorColorShader = {
    tolerance: 0.1,
    apply(src, pairs, tolerance = this.tolerance) {
      const [c, g] = makeCanvas(src.width, src.height);
      g.drawImage(src, 0, 0);
      const img = g.getImageData(0, 0, c.width, c.height);
      const P = pairs.map((p) => ({
        t: SV.hexToRgb(p.target).map((v) => v / 255),
        n: SV.hexToRgb(p.replace),
      }));
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        // if (dist_primary < tolerance) ... else if (dist_secondary < tolerance) ...
        for (const p of P) {
          const dist = Math.hypot(r - p.t[0], gg - p.t[1], b - p.t[2]);
          if (dist < tolerance) {
            d[i] = p.n[0];
            d[i + 1] = p.n[1];
            d[i + 2] = p.n[2];
            break;
          }
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    },
  };

  SV.Art = Art;
  SV.ArmorColorShader = ArmorColorShader;
})();
