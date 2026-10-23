// environment.js – EnvironmentController (GDD §5.2).
// Ingen nedräkning: storm_intensity (0.0–1.0) styr himmel/dimma, ljus,
// vind och partikeltäthet. Kristaller pressar tillbaka stormen.
// Klassen räknar bara ut värden; 3D-vyn läser dem varje bildruta.
(function () {
  'use strict';
  const SV = window.SV;

  class EnvironmentController extends SV.Emitter {
    constructor() {
      super();
      // sky_gradient: lummig skymning → laddad violett tidsstorm
      this.sky_gradient = new SV.Gradient([
        [0.0, '#2b6fd6'],
        [0.35, '#2a4fb8'],
        [0.65, '#4a2f9a'],
        [1.0, '#3a1460'],
      ]);
      // ljuset i luften (hemisfär/månljus)
      this.light_gradient = new SV.Gradient([
        [0.0, '#c8f0ff'],
        [0.5, '#b0a8ff'],
        [1.0, '#d08aff'],
      ]);
      this.light = { color: [200, 240, 255], energy: 1 };
      this.sky = [43, 111, 214];
      this.particle = { amount_ratio: 0, speed_scale: 0.5 };
      this._storm = 0;
      this.visual = 0; // det synliga värdet glider mjukt mot storm_intensity
      this.time = 0;
      this.wind = 0;
      this.flash = 0;
      this.nextLightning = 4;
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
      this.sky = this.sky_gradient.sample(s);
      this.light.color = this.light_gradient.sample(s);
      // GDD: lerp(1.0, 0.4). Lite mildare så att robotarna syns tydligt.
      this.light.energy = SV.lerp(1.0, 0.6, s);
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

    // focus: {x, y} i världens px-koordinater – blixten slår ner i närheten.
    update(dt, focus) {
      this.time += dt;
      const prev = this.visual;
      this.visual = SV.approach(this.visual, this._storm, dt * 0.12);
      if (prev !== this.visual) this._updateEnvironment();
      const s = this.visual;
      this.wind = SV.lerp(0.15, 1.6, s) * (0.8 + Math.sin(this.time * 0.4) * 0.2);
      if (s > 0.55) {
        this.nextLightning -= dt;
        if (this.nextLightning <= 0) {
          this.nextLightning = SV.lerp(9, 3, (s - 0.55) / 0.45) * (0.6 + Math.random() * 0.8);
          this.flash = 0.6 + s * 0.4;
          const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
          const wx = (focus ? focus.x : 0) + Math.cos(a) * d, wy = (focus ? focus.y : 0) + Math.sin(a) * d;
          SV.Sfx.play('thunder');
          this.emit('lightning', wx, wy);
        }
      }
      this.flash = Math.max(0, this.flash - dt * 2.2);
    }
  }

  SV.EnvironmentController = EnvironmentController;
})();
