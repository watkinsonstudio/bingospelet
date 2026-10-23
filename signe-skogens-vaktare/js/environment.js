// environment.js – EnvironmentController (GDD §5.2).
// Ingen nedräkning: storm_intensity (0.0–1.0) styr himlens färgton,
// ljusstyrka, vind och partikeltäthet. Kristaller pressar tillbaka stormen.
(function () {
  'use strict';
  const SV = window.SV;

  class EnvironmentController extends SV.Emitter {
    constructor() {
      super();
      // sky_gradient: klar nordisk dag → laddad violett tidsstorm
      this.sky_gradient = new SV.Gradient([
        [0.0, '#fff3d6'],
        [0.3, '#e2ecff'],
        [0.55, '#a9a4e6'],
        [0.8, '#7656c0'],
        [1.0, '#4a2f86'],
      ]);
      this.light = { color: [255, 243, 214], energy: 1 };
      this.particle = { amount_ratio: 0, speed_scale: 0.5 };
      this._storm = 0;
      this.visual = 0; // det synliga värdet glider mjukt mot storm_intensity
      this.time = 0;
      this.wind = 0;
      this.flash = 0;
      this.bolt = null;
      this.nextLightning = 4;
      this.particles = [];
      this.clouds = [];
      for (let i = 0; i < 6; i++) this.clouds.push({ x: Math.random() * 900, y: Math.random() * 700, r: 80 + Math.random() * 90 });
      this.snowy = false;
      this._updateEnvironment();
    }

    get storm_intensity() {
      return this._storm;
    }
    // Motsvarar GDScript-settern: clamp + _update_environment()
    set storm_intensity(value) {
      this._storm = SV.clamp(value, 0, 1);
      this._updateEnvironment();
    }

    _updateEnvironment() {
      const s = this.visual;
      // Justera färgton och ljus baserat på stormens intensitet
      this.light.color = this.sky_gradient.sample(s);
      // GDD använder lerp(1.0, 0.4); på mobilskärm blir det för mörkt för att se robotarna.
      this.light.energy = SV.lerp(1.0, 0.8, s);
      // Öka partikelmängd (elektriska urladdningar/vind)
      this.particle.amount_ratio = s;
      this.particle.speed_scale = SV.lerp(0.5, 2.5, s);
      this.emit('changed', this._storm);
    }

    label() {
      const s = this._storm;
      if (s < 0.25) return 'Lugnt';
      if (s < 0.5) return 'Blåsigt';
      if (s < 0.75) return 'Laddat';
      return 'Tidsstorm';
    }

    update(dt, view) {
      this.time += dt;
      // Den visuella stormen följer det logiska värdet mjukt (ca 3 s).
      const prev = this.visual;
      this.visual = SV.approach(this.visual, this._storm, dt * 0.12);
      if (prev !== this.visual) this._updateEnvironment();
      const s = this.visual;
      this.wind = SV.lerp(6, 80, s) * (0.8 + Math.sin(this.time * 0.4) * 0.2);

      // Blixtar när atmosfären är laddad.
      if (s > 0.55) {
        this.nextLightning -= dt;
        if (this.nextLightning <= 0) {
          this.nextLightning = SV.lerp(9, 3, (s - 0.55) / 0.45) * (0.6 + Math.random() * 0.8);
          this.flash = 0.6 + s * 0.4;
          const wx = view.x + Math.random() * view.w, wy = view.y + Math.random() * view.h * 0.8;
          this.bolt = { x: wx, y: wy, t: 0.35, seed: Math.random() * 1000 };
          SV.Sfx.play('thunder');
          this.emit('lightning', wx, wy);
        }
      }
      this.flash = Math.max(0, this.flash - dt * 2.2);
      if (this.bolt) {
        this.bolt.t -= dt;
        if (this.bolt.t <= 0) this.bolt = null;
      }
      this._updateParticles(dt, view);
    }

    _updateParticles(dt, view) {
      const s = this.visual;
      const ratio = this.particle.amount_ratio;
      const target = {
        leaf: Math.round((1 - ratio) * 14 + 4),
        rain: Math.round(Math.max(0, ratio - 0.3) * 260),
        spark: Math.round(Math.max(0, ratio - 0.5) * 40),
        snow: this.snowy ? Math.round(30 + ratio * 70) : 0,
      };
      const counts = { leaf: 0, rain: 0, spark: 0, snow: 0 };
      this.particles.forEach((p) => counts[p.kind]++);
      for (const kind of Object.keys(target)) {
        for (let i = counts[kind]; i < target[kind]; i++) this.particles.push(this._spawn(kind, view, true));
      }
      const speed = this.particle.speed_scale;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.kind === 'rain') {
          p.x += (this.wind * 1.4 + 20) * dt;
          p.y += 260 * dt * (0.8 + speed * 0.2);
        } else if (p.kind === 'leaf') {
          p.x += (this.wind + Math.sin(this.time * 2 + p.seed) * 8) * dt;
          p.y += (8 + Math.cos(this.time * 1.3 + p.seed) * 6) * dt;
        } else if (p.kind === 'snow') {
          p.x += (this.wind * 0.8 + Math.sin(this.time + p.seed) * 5) * dt;
          p.y += (16 + speed * 6) * dt;
        } else {
          p.x += (Math.random() - 0.5) * 40 * dt + this.wind * 0.3 * dt;
          p.y += (Math.random() - 0.5) * 40 * dt;
        }
        const out = p.x < view.x - 20 || p.x > view.x + view.w + 20 || p.y < view.y - 30 || p.y > view.y + view.h + 20;
        const tooMany = counts[p.kind] > target[p.kind];
        if (p.life <= 0 || out) {
          if (tooMany) {
            this.particles.splice(i, 1);
            counts[p.kind]--;
          } else Object.assign(p, this._spawn(p.kind, view, out && p.life > 0));
        }
      }
    }
    _spawn(kind, view, anywhere) {
      const x = view.x - 20 + Math.random() * (view.w + 40);
      const y = anywhere ? view.y + Math.random() * view.h : view.y - 10;
      const base = { kind, x, y, seed: Math.random() * 100, life: 2 + Math.random() * 6 };
      if (kind === 'rain' && !anywhere) base.x -= 40;
      if (kind === 'spark') base.life = 0.2 + Math.random() * 0.6;
      base.col = kind === 'leaf' ? ['#ffd25e', '#9ad66e', '#e8a040', '#f5f0d0'][Math.floor(Math.random() * 4)] : null;
      return base;
    }

    // Ritas ovanpå världen (i världskoordinater, ctx har kamerans transform).
    render(ctx, view) {
      const s = this.visual;
      // Molnskuggor som driver med vinden.
      ctx.save();
      const cloudAlpha = 0.05 + s * 0.16;
      this.clouds.forEach((c) => {
        c.x += this.wind * 0.016;
        const span = 1200;
        const cx = view.x + ((((c.x - view.x * 0.6) % span) + span) % span) - 200;
        const cy = view.y + ((((c.y - view.y * 0.6) % 900) + 900) % 900) - 150;
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r);
        gr.addColorStop(0, `rgba(20,16,50,${cloudAlpha})`);
        gr.addColorStop(1, 'rgba(20,16,50,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(cx - c.r, cy - c.r, c.r * 2, c.r * 2);
      });
      ctx.restore();

      // Partiklar
      ctx.save();
      this.particles.forEach((p) => {
        if (p.kind === 'rain') {
          ctx.strokeStyle = 'rgba(200,220,255,0.45)';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (this.wind * 1.4 + 20) * 0.03, p.y - 7);
          ctx.stroke();
        } else if (p.kind === 'leaf') {
          ctx.fillStyle = p.col;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          if (Math.sin(this.time * 4 + p.seed) > 0) ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y), 1, 1);
        } else if (p.kind === 'snow') {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        } else {
          ctx.fillStyle = Math.random() < 0.5 ? '#b6f7ff' : '#e0b8ff';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      });
      ctx.restore();

      if (this.bolt) this._drawBolt(ctx, view);
    }

    _drawBolt(ctx, view) {
      const b = this.bolt;
      const rnd = SV.rng(Math.floor(b.seed));
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.t * 4);
      let x = b.x + (rnd() - 0.5) * 60, y = view.y - 10;
      ctx.strokeStyle = '#e8f6ff';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = '#9fd8ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        x = SV.lerp(x, b.x, 0.25) + (rnd() - 0.5) * 14;
        y = SV.lerp(view.y - 10, b.y, i / steps);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Färgton och ljus läggs över hela skärmen (skärmkoordinater).
    renderGrade(ctx, w, h) {
      const s = this.visual;
      const [r, g, b] = this.light.color;
      const e = this.light.energy;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const k = 0.45 + s * 0.3;
      ctx.fillStyle = `rgb(${SV.lerp(255, r, k) * e},${SV.lerp(255, g, k) * e},${SV.lerp(255, b, k) * e})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      // Vinjett som laddas upp med stormen.
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(30,10,60,0)');
      vg.addColorStop(1, `rgba(30,10,60,${0.12 + s * 0.38})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      if (this.flash > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(210,225,255,${this.flash * 0.55})`;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }
  }

  SV.EnvironmentController = EnvironmentController;
})();
