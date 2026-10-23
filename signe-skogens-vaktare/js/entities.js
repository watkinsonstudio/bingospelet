// entities.js – Signe (Player), robotfiender, projektiler, upplockbara
// föremål och effekter. Ingen ritlogik här kräver DOM, så testerna kan köra
// klasserna i Node.
(function () {
  'use strict';
  const SV = window.SV;
  const T = SV.TILE;

  // ==================================================================
  // Rustningsstilar (GDD §3 – rustningens utseende påverkar fiendernas AI)
  // ==================================================================
  const ArmorStyle = {
    STYLES: {
      camo: { id: 'camo', name: 'Kamouflage', effect: 'Robotarnas upptäcktsradie minskar med 35 %. Lättare att smyga.' },
      neon: { id: 'neon', name: 'Neon', effect: 'Drar till sig robotarnas uppmärksamhet, men skrämmer bort skygga drönare.' },
      graphite: { id: 'graphite', name: 'Isolerande grafit', effect: 'Halverar skadan från robotarnas elektriska motattacker.' },
      balanced: { id: 'balanced', name: 'Balanserad', effect: 'Ingen särskild effekt på robotarna.' },
    },
    classify(armor) {
      const hsl = ['helmet', 'chest', 'legs'].map((z) => SV.rgbToHsl(...SV.hexToRgb(armor[z])));
      const avgS = hsl.reduce((a, c) => a + c[1], 0) / 3;
      const avgL = hsl.reduce((a, c) => a + c[2], 0) / 3;
      const bright = hsl.filter(([, s, l]) => s > 0.7 && l > 0.45 && l < 0.85).length;
      const earthy = hsl.filter(([h, s, l]) => h >= 25 && h <= 160 && s < 0.6 && l < 0.5 && l > 0.12).length;
      if (bright >= 2) return this.STYLES.neon;
      if (avgL < 0.32 && avgS < 0.22) return this.STYLES.graphite;
      if (earthy >= 3 || (earthy >= 2 && avgS < 0.45)) return this.STYLES.camo;
      return this.STYLES.balanced;
    },
  };
  SV.ArmorStyle = ArmorStyle;

  // ==================================================================
  // Signe
  // ==================================================================
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.dir = 'down';
      this.face = Math.PI / 2; // vinkel i radianer
      this.moving = false;
      this.animT = 0;
      this.speed = 64;
      this.energy = 10;
      this.invuln = 0;
      this.shield = 0;
      this.staffCd = 0;
      this.empCd = 0;
      this.frostCd = 0;
      this.coolant = 6;
      this.coolTimer = 0;
      this.waterTimer = 0;
      this.chargeFx = 0;
      this.knock = { x: 0, y: 0 };
      this.swing = 0;
      this.stats = { staff: 1, frost: 1, cool: 1, plate: 1 };
      this.scrap = 0;
      this.chips = 0;
      this.armor = { helmet: '#339966', chest: '#cc8033', legs: '#3d4a7a' };
      this.unlockedPalettes = ['original'];
      this.painterUnlocked = false;
      this.style = ArmorStyle.classify(this.armor);
    }

    get maxEnergy() {
      return 8 + this.stats.plate * 2;
    }
    get maxCoolant() {
      return 4 + this.stats.cool * 2;
    }
    staffDamage() {
      return 6 + (this.stats.staff - 1) * 4;
    }
    empRadius() {
      return 46 + this.stats.staff * 4;
    }
    frostChill() {
      return 1 + (this.stats.frost - 1) * 0.4;
    }
    frostDuration() {
      return 2.2 + (this.stats.frost - 1) * 0.5;
    }

    setArmor(armor) {
      this.armor = Object.assign({}, armor);
      this.style = ArmorStyle.classify(this.armor);
      if (typeof document !== 'undefined' && SV.SPR && SV.SPR.buildSigne) this.frames = SV.SPR.buildSigne(this.armor);
    }

    // GDD: player.apply_energy_shield(2)
    apply_energy_shield(hits) {
      this.shield = Math.max(this.shield, hits);
    }

    terrainSpeed(game) {
      const gt = game.world.groundAtPx(this.x, this.y);
      const comp = game.companions.active;
      if ((gt === SV.G.MUD || gt === SV.G.SNOW) && !(comp && comp.kind === 'moose' && comp.near(this, 90))) return gt === SV.G.MUD ? 0.55 : 0.7;
      if (gt === SV.G.SHALLOW && !(comp && comp.kind === 'beaver')) return 0.55;
      return 1;
    }

    update(dt, game) {
      const In = SV.Input;
      const mx = In.move.x, my = In.move.y;
      const mag = Math.hypot(mx, my);
      this.moving = mag > 0.05;
      if (this.moving) {
        this.face = Math.atan2(my, mx);
        if (Math.abs(mx) > Math.abs(my) * 0.9) this.dir = mx > 0 ? 'right' : 'left';
        else this.dir = my > 0 ? 'down' : 'up';
      }
      const charging = In.down('staff') && In.holdTime('staff') > 0.3;
      const sp = this.speed * this.terrainSpeed(game) * (charging ? 0.5 : 1) * Math.min(1, mag);
      const opts = { hiddenOpen: game.companions.hiddenPathsOpen() };
      const dx = (this.moving ? Math.cos(this.face) * sp : 0) * dt + this.knock.x * dt;
      const dy = (this.moving ? Math.sin(this.face) * sp : 0) * dt + this.knock.y * dt;
      const wasHidden = game.world.groundAtPx(this.x, this.y) === SV.G.HIDDEN;
      game.world.moveBody(this, dx, dy, 4, 3, opts);
      if (!wasHidden && game.world.groundAtPx(this.x, this.y) === SV.G.HIDDEN) game.onHiddenPath();
      this.knock.x *= Math.pow(0.001, dt);
      this.knock.y *= Math.pow(0.001, dt);
      if (this.moving) this.animT += dt * (sp / 40);
      else this.animT = 0;

      this.invuln = Math.max(0, this.invuln - dt);
      this.staffCd = Math.max(0, this.staffCd - dt);
      this.empCd = Math.max(0, this.empCd - dt);
      this.frostCd = Math.max(0, this.frostCd - dt);
      this.swing = Math.max(0, this.swing - dt);

      // Kylvätska återhämtar sig.
      if (this.coolant < this.maxCoolant) {
        this.coolTimer += dt * (game.nearCampfire ? 3 : 1);
        if (this.coolTimer >= 0.8) {
          this.coolTimer = 0;
          this.coolant++;
        }
      }

      // Kallt vatten tär på energin (om inte Bävern hjälper till).
      const gt = game.world.groundAtPx(this.x, this.y);
      const comp = game.companions.active;
      if (gt === SV.G.SHALLOW && !(comp && comp.kind === 'beaver')) {
        this.waterTimer += dt;
        if (this.waterTimer > 2.5) {
          this.waterTimer = 0;
          this.hurt(1, game, { electric: false, silent: true, x: this.x, y: this.y });
          game.floater(this.x, this.y - 20, 'Kallt!', '#9fe6ff');
        }
      } else this.waterTimer = 0;

      // El-staven: snabb stöt direkt, laddad EMP när knappen släpps.
      if (In.pressed('staff') && this.staffCd <= 0) this.strike(game);
      if (charging && this.empCd <= 0) {
        this.chargeFx += dt;
        if (this.chargeFx > 0.2 && Math.floor(this.chargeFx * 6) !== Math.floor((this.chargeFx - dt) * 6)) SV.Sfx.play('charge');
      }
      if (In.released('staff')) {
        if (In.holdTime('staff') >= 0.6 && this.empCd <= 0) this.emp(game);
        this.chargeFx = 0;
      }

      // Fryskastaren: håll in för automateld.
      if ((In.pressed('frost') || In.down('frost')) && this.frostCd <= 0) {
        if (this.coolant >= 1) this.fireFrost(game);
        else if (In.pressed('frost')) {
          SV.Sfx.play('deny');
          game.floater(this.x, this.y - 22, 'Slut på kyla', '#9fe6ff');
        }
      }
    }

    strike(game) {
      this.staffCd = 0.3;
      this.swing = 0.18;
      SV.Sfx.play('zap');
      const reach = 24;
      const hx = this.x + Math.cos(this.face) * 10, hy = this.y - 6 + Math.sin(this.face) * 10;
      game.addFx({ type: 'arc', x: this.x, y: this.y - 6, a: this.face, life: 0.15, t: 0 });
      let hitAny = false;
      game.robots.forEach((r) => {
        if (r.state === 'disabled') return;
        const d = SV.dist(this.x, this.y - 6, r.x, r.y - r.h / 2);
        const ang = Math.atan2(r.y - r.h / 2 - (this.y - 6), r.x - this.x);
        if (d < reach + r.r && (d < 12 || Math.abs(SV.angleDiff(this.face, ang)) < 1.25)) {
          r.takeDamage(this.staffDamage(), 'shock', game, this);
          hitAny = true;
        }
      });
      // Skrothögar ger en liten slant skrot första gången.
      const tx = Math.floor(hx / T), ty = Math.floor(hy / T);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const x = tx + i, y = ty + j;
          if (game.world.b(x, y) === SV.B.SCRAPHEAP && !game.world.scrapHeapUsed[x + ',' + y] && SV.dist(hx, hy, (x + 0.5) * T, (y + 0.5) * T) < 20) {
            game.world.scrapHeapUsed[x + ',' + y] = true;
            game.spawnLoot((x + 0.5) * T, (y + 0.6) * T, { scrap: 2 });
            game.addFx({ type: 'sparks', x: (x + 0.5) * T, y: (y + 0.5) * T, life: 0.4, t: 0, n: 8 });
          }
        }
      if (hitAny) game.companions.chargeSuper(3);
    }

    emp(game) {
      this.empCd = 3;
      this.staffCd = 0.4;
      const R = this.empRadius();
      SV.Sfx.play('emp');
      game.shake(4);
      game.addFx({ type: 'ring', x: this.x, y: this.y - 6, r0: 4, r1: R, life: 0.45, t: 0, col: '#7ff3ff' });
      game.robots.forEach((r) => {
        if (r.state === 'disabled') return;
        if (SV.dist(this.x, this.y, r.x, r.y) < R + r.r) {
          r.apply_stun(2.5);
          r.takeDamage(4 + this.stats.staff * 2, 'emp', game, this);
        }
      });
      game.damageBarricadesNear(this.x, this.y, R, 1);
      game.companions.chargeSuper(6);
    }

    fireFrost(game) {
      this.frostCd = 0.26;
      this.coolant -= 1;
      this.coolTimer = 0;
      SV.Sfx.play('frost');
      // Siktesstöd: närmaste robot inom en kon framåt.
      let best = null, bestScore = Infinity;
      game.robots.forEach((r) => {
        if (r.state === 'disabled') return;
        const d = SV.dist(this.x, this.y, r.x, r.y);
        if (d > 150) return;
        const ang = Math.atan2(r.y - r.h / 2 - (this.y - 6), r.x - this.x);
        const diff = Math.abs(SV.angleDiff(this.face, ang));
        if (diff > 1.0) return;
        const score = d + diff * 60;
        if (score < bestScore) {
          bestScore = score;
          best = ang;
        }
      });
      const a = best !== null ? best : this.face;
      game.projectiles.push({ kind: 'frost', x: this.x + Math.cos(a) * 8, y: this.y - 6 + Math.sin(a) * 8, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, life: 0.85, r: 4, trail: 0 });
    }

    hurt(dmg, game, src = {}) {
      if (this.invuln > 0 && !src.silent) return false;
      if (this.shield > 0 && !src.silent) {
        this.shield--;
        this.invuln = 0.6;
        game.addFx({ type: 'ring', x: this.x, y: this.y - 8, r0: 8, r1: 18, life: 0.3, t: 0, col: '#ffd25e' });
        game.floater(this.x, this.y - 24, 'Sköld!', '#ffd25e');
        return false;
      }
      let amount = dmg;
      if (src.electric !== false && this.style.id === 'graphite') amount *= 0.5;
      this.energy = Math.max(0, this.energy - amount);
      if (!src.silent) {
        this.invuln = 1.0;
        SV.Sfx.play('hurt');
        game.shake(3);
        const a = Math.atan2(this.y - (src.y || this.y), this.x - (src.x || this.x));
        this.knock.x = Math.cos(a) * 140;
        this.knock.y = Math.sin(a) * 140;
      }
      if (this.energy <= 0) game.onPlayerDown();
      return true;
    }
  }

  // ==================================================================
  // Robotar
  // ==================================================================
  const ROBOT_TYPES = {
    bear: { name: 'Björnrobot', hp: 60, speed: 20, chase: 34, detect: 74, dmg: 3, r: 9, h: 18, scrap: [5, 7], chips: [1, 2], xp: 18 },
    drone: { name: 'Svävardrönare', hp: 22, speed: 34, chase: 50, detect: 96, dmg: 1, r: 6, h: 10, fly: true, scrap: [2, 3], chips: [0, 1], xp: 10 },
    hound: { name: 'Mekanisk hund', hp: 14, speed: 30, chase: 64, detect: 62, dmg: 1, r: 5, h: 10, scrap: [1, 3], chips: [0, 0], xp: 6 },
  };

  class Robot {
    constructor(type, x, y) {
      const def = ROBOT_TYPES[type];
      this.type = type;
      this.def = def;
      this.x = x;
      this.y = y;
      this.homeX = x;
      this.homeY = y;
      this.hp = def.hp;
      this.maxHp = def.hp;
      this.r = def.r;
      this.h = def.h;
      this.state = 'patrol';
      this.stateT = 0;
      this.stun = 0;
      this.frozen = 0;
      this.chill = 0;
      this.wet = 0;
      this.blind = 0;
      this.distract = null; // {target, t}
      this.flash = 0;
      this.dirX = 1;
      this.animT = Math.random() * 10;
      this.wander = null;
      this.lostT = 0;
      this.fireCd = 1 + Math.random();
      this.lunge = null;
      this.searchA = Math.random() * Math.PI * 2;
      this.fade = 0;
      this.knock = { x: 0, y: 0 };
      this.alertT = 0;
    }

    get active() {
      return this.state !== 'disabled';
    }

    // GDD: robot.apply_stun(4.0)
    apply_stun(seconds) {
      if (this.state === 'disabled') return;
      this.stun = Math.max(this.stun, seconds);
      this.lunge = null;
      if (this.state === 'windup' || this.state === 'attack') this.setState('chase');
    }

    setState(s) {
      this.state = s;
      this.stateT = 0;
    }

    takeDamage(amount, kind, game, source) {
      if (this.state === 'disabled') return;
      let dmg = amount;
      if (kind === 'shock' || kind === 'emp') {
        if (this.frozen > 0) dmg *= 1.5; // termisk chock
        if (this.wet > 0) dmg *= 1.5; // kortslutning i vatten
      }
      dmg = Math.round(dmg);
      this.hp -= dmg;
      this.flash = 0.12;
      if (kind !== 'emp') {
        const a = Math.atan2(this.y - (source ? source.y : this.y), this.x - (source ? source.x : this.x));
        const k = this.type === 'bear' ? 40 : 110;
        this.knock.x = Math.cos(a) * k;
        this.knock.y = Math.sin(a) * k;
      }
      game.floater(this.x, this.y - this.h - 4, String(dmg), kind === 'frost' ? '#9fe6ff' : '#fff27a');
      game.addFx({ type: 'sparks', x: this.x, y: this.y - this.h / 2, life: 0.3, t: 0, n: 5 });
      SV.Sfx.play('hit');
      if (this.state === 'patrol') {
        this.setState('chase');
        this.target = 'player';
      }
      if (this.hp <= 0) this.disable(game);
    }

    disable(game, opts = {}) {
      if (this.state === 'disabled') return;
      this.hp = 0;
      this.setState('disabled');
      this.stun = 0;
      this.frozen = 0;
      SV.Sfx.play('robotDown');
      game.addFx({ type: 'sparks', x: this.x, y: this.y - this.h / 2, life: 0.8, t: 0, n: 16 });
      const rnd = Math.random;
      const mult = opts.doubleLoot ? 2 : 1;
      const scrap = Math.round(SV.lerp(this.def.scrap[0], this.def.scrap[1] + 0.99, rnd()) - 0.49) * mult;
      const chips = Math.floor(SV.lerp(this.def.chips[0], this.def.chips[1] + 0.99, rnd())) * mult;
      game.spawnLoot(this.x, this.y - 2, { scrap, chips });
      game.onRobotDisabled(this);
    }

    speedMult(game) {
      let m = 1 + game.env.visual * 0.3;
      if (this.chill > 0) m *= Math.max(0.35, 1 - this.chill * 0.22);
      return m;
    }

    // Hur långt roboten ser Signe.
    detectRadius(game) {
      let r = this.def.detect * (1 + game.env.visual * 0.25) * game.detectionMod(this);
      if (this.blind > 0) r = 0;
      return r;
    }

    canSeePlayer(game) {
      const p = game.player;
      if (game.playerDown) return false;
      const d = SV.dist(this.x, this.y, p.x, p.y);
      const R = this.detectRadius(game);
      if (this.type === 'drone') {
        if (d < R * 0.35) return true;
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        return d < R * 1.15 && Math.abs(SV.angleDiff(this.searchA, ang)) < 0.5;
      }
      return d < R;
    }

    // Vem jagar roboten just nu?
    targetPos(game) {
      if (this.distract && this.distract.t > 0) return this.distract.target;
      if (game.decoy && game.decoy.t > 0 && SV.dist(this.x, this.y, game.decoy.x, game.decoy.y) < 170) return game.decoy;
      return game.player;
    }

    update(dt, game) {
      this.animT += dt;
      this.flash = Math.max(0, this.flash - dt);
      if (this.state === 'disabled') {
        this.fade += dt;
        return;
      }
      this.wet = Math.max(0, this.wet - dt);
      this.blind = Math.max(0, this.blind - dt);
      this.chill = Math.max(0, this.chill - dt * 0.45);
      if (this.distract) {
        this.distract.t -= dt;
        if (this.distract.t <= 0) this.distract = null;
      }
      const opts = { flying: !!this.def.fly };
      // rekyl
      if (Math.abs(this.knock.x) + Math.abs(this.knock.y) > 1) {
        game.world.moveBody(this, this.knock.x * dt, this.knock.y * dt, this.r * 0.6, 3, opts);
        this.knock.x *= Math.pow(0.002, dt);
        this.knock.y *= Math.pow(0.002, dt);
      }
      if (this.frozen > 0) {
        this.frozen -= dt;
        return;
      }
      if (this.stun > 0) {
        this.stun -= dt;
        if (Math.random() < dt * 6) game.addFx({ type: 'sparks', x: this.x + (Math.random() - 0.5) * 10, y: this.y - this.h, life: 0.3, t: 0, n: 1 });
        return;
      }
      this.stateT += dt;
      const p = game.player;
      const spdM = this.speedMult(game);
      const tgt = this.targetPos(game);
      const isPlayer = tgt === p;
      const shy = this.type === 'drone' && p.style.id === 'neon';

      // sökarljuset sveper
      if (this.type === 'drone') this.searchA += dt * (this.state === 'patrol' ? 0.9 : 0);

      switch (this.state) {
        case 'patrol': {
          if (!this.wander || this.stateT > 4 || SV.dist(this.x, this.y, this.wander.x, this.wander.y) < 4) {
            const a = Math.random() * Math.PI * 2, rr = Math.random() * 48;
            this.wander = { x: this.homeX + Math.cos(a) * rr, y: this.homeY + Math.sin(a) * rr };
            this.stateT = 0;
          }
          this.moveToward(this.wander.x, this.wander.y, this.def.speed * spdM, dt, game, opts);
          const lured = !isPlayer && SV.dist(this.x, this.y, tgt.x, tgt.y) < 170;
          if (lured || this.canSeePlayer(game)) {
            if (shy && !lured) {
              this.setState('flee');
              break;
            }
            this.setState('alert');
            this.alertT = 0.55;
            SV.Sfx.play('alert');
            game.companions.onRobotAlert(this);
          }
          break;
        }
        case 'alert':
          this.alertT -= dt;
          if (this.alertT <= 0) this.setState('chase');
          break;
        case 'flee': {
          const a = Math.atan2(this.y - p.y, this.x - p.x);
          this.moveToward(this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 30, this.def.chase * spdM, dt, game, opts);
          if (SV.dist(this.x, this.y, p.x, p.y) > 140 || this.stateT > 4) this.setState('patrol');
          break;
        }
        case 'chase': {
          const d = SV.dist(this.x, this.y, tgt.x, tgt.y);
          if (isPlayer && !this.canSeePlayer(game) && d > this.detectRadius(game) * 1.6) {
            this.lostT += dt;
            if (this.lostT > 2.5) {
              this.lostT = 0;
              this.setState('patrol');
              break;
            }
          } else this.lostT = 0;
          if (shy && isPlayer) {
            this.setState('flee');
            break;
          }
          if (this.type === 'drone') {
            // håll avstånd och skjut
            this.searchA = Math.atan2(tgt.y - this.y, tgt.x - this.x);
            const want = d < 56 ? -1 : d > 86 ? 1 : 0;
            const a = this.searchA + (want === 0 ? Math.PI / 2 : 0);
            const sgn = want === 0 ? Math.sin(this.animT) : want;
            this.moveToward(this.x + Math.cos(a) * 20 * sgn, this.y + Math.sin(a) * 20 * sgn, this.def.chase * spdM, dt, game, opts);
            this.fireCd -= dt;
            if (this.fireCd <= 0 && d < 130 && isPlayer) {
              this.fireCd = 1.7;
              const aa = Math.atan2(p.y - 6 - (this.y - 14), p.x - this.x);
              game.projectiles.push({ kind: 'bolt', x: this.x, y: this.y - 14, vx: Math.cos(aa) * 80, vy: Math.sin(aa) * 80, life: 2, r: 3, dmg: this.def.dmg });
              SV.Sfx.play('zap');
            }
          } else {
            const reach = this.type === 'bear' ? 20 : 30;
            if (d < reach && (isPlayer || tgt.isDecoy)) {
              this.setState('windup');
              this.atkA = Math.atan2(tgt.y - this.y, tgt.x - this.x);
            } else this.moveToward(tgt.x, tgt.y, this.def.chase * spdM, dt, game, opts);
          }
          break;
        }
        case 'windup': {
          const wind = this.type === 'bear' ? 0.65 : 0.35;
          if (this.stateT >= wind) {
            this.setState('attack');
            if (this.type === 'hound') this.lunge = { vx: Math.cos(this.atkA) * 150, vy: Math.sin(this.atkA) * 150, t: 0.22, hit: false };
            else {
              // hydraulisk smäll framför björnen
              const sx = this.x + Math.cos(this.atkA) * 12, sy = this.y + Math.sin(this.atkA) * 12;
              game.addFx({ type: 'ring', x: sx, y: sy, r0: 4, r1: 22, life: 0.3, t: 0, col: '#ffcf5a' });
              game.shake(3);
              SV.Sfx.play('emp');
              if (SV.dist(sx, sy, p.x, p.y) < 22 && !game.playerDown) p.hurt(this.def.dmg, game, { x: this.x, y: this.y });
              if (game.decoy && SV.dist(sx, sy, game.decoy.x, game.decoy.y) < 24) game.decoy.t = 0;
            }
          }
          break;
        }
        case 'attack': {
          if (this.lunge) {
            game.world.moveBody(this, this.lunge.vx * dt, this.lunge.vy * dt, this.r * 0.6, 3, opts);
            this.lunge.t -= dt;
            if (!this.lunge.hit && SV.dist(this.x, this.y, p.x, p.y) < 10 && !game.playerDown) {
              this.lunge.hit = true;
              p.hurt(this.def.dmg, game, { x: this.x, y: this.y });
            }
            if (this.lunge.t <= 0) this.lunge = null;
          }
          if (this.stateT > (this.type === 'bear' ? 0.9 : 0.6)) this.setState('chase');
          break;
        }
      }
    }

    moveToward(tx, ty, speed, dt, game, opts) {
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return;
      let vx = (dx / d) * speed * dt, vy = (dy / d) * speed * dt;
      if (this.avoid > 0) {
        this.avoid -= dt;
        const t = vx;
        vx = -vy * this.avoidSide;
        vy = t * this.avoidSide;
      }
      const hit = game.world.moveBody(this, vx, vy, this.r * 0.6, 3, opts);
      if (hit && !(this.avoid > 0)) {
        this.avoid = 0.5;
        this.avoidSide = Math.random() < 0.5 ? 1 : -1;
      }
      if (Math.abs(dx) > 1) this.dirX = dx > 0 ? 1 : -1;
    }

    spriteSet() {
      const set = SV.SPR.robots[this.type][this.dirX > 0 ? 'right' : 'left'];
      if (this.flash > 0) return set.flash;
      if (this.frozen > 0) return set.frozen;
      if (this.stun > 0 || this.state === 'disabled' || this.blind > 0) return set.stunned;
      if (this.state === 'patrol' || this.state === 'flee') return set.patrol;
      return set.alert;
    }
  }

  SV.Player = Player;
  SV.Robot = Robot;
  SV.ROBOT_TYPES = ROBOT_TYPES;
})();
