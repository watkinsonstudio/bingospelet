// game.js – spelloop, kamera, rendering och spelregler. Scenstrukturen
// följer GDD §6: Player, CompanionManager och EnvironmentController är
// fristående delar som Game knyter ihop.
(function () {
  'use strict';
  const SV = window.SV;
  const T = SV.TILE;
  const G = SV.G, B = SV.B;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'signe-skogens-vaktare-v1';

  const Game = {
    CRYSTALS_NEEDED: 8,
    dt: 0,
    time: 0,
    paused: true,
    started: false,

    // ================================================================
    // Uppstart
    // ================================================================
    init(hotData) {
      SV.Sprites.build();
      this.canvas = $('view');
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      SV.UI.init(this);
      SV.Input.init($('stick-zone'), $('stick-base'), $('stick-knob'), Array.from(document.querySelectorAll('[data-act]')));
      SV.Input.onFirstInteraction = () => SV.Sfx.unlock();

      const save = (hotData && hotData.save) || SV.store.get(SAVE_KEY);
      this.newState(null);
      $('btn-continue').hidden = !save;
      $('btn-start').addEventListener('click', () => {
        SV.Sfx.unlock();
        if (save) SV.UI.confirm('Starta ett nytt äventyr? Din sparade skog skrivs över.', () => this.startGame(null));
        else this.startGame(null);
      });
      $('btn-continue').addEventListener('click', () => {
        SV.Sfx.unlock();
        this.startGame(SV.store.get(SAVE_KEY) || save);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.started) this.save();
      });
      if (hotData && hotData.save && hotData.running) this.startGame(hotData.save);

      this.last = performance.now();
      const loop = (now) => {
        this.dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.frame();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
      this.canvas.width = w;
      this.canvas.height = h;
      this.zoom = Math.max(2, Math.round(Math.min(w, h) / (T * 12.5)));
    },

    newState(save) {
      this.world = new SV.World();
      this.env = new SV.EnvironmentController();
      this.env.storm_intensity = 0.3;
      this.env.visual = 0.3;
      this.env._updateEnvironment();
      const sp = this.world.spawn;
      this.player = new SV.Player(sp.x, sp.y);
      this.player.setArmor(this.player.armor);
      this.companions = new SV.CompanionManager(this);
      this.companions.on('level_changed', (c, lvl) => {
        SV.Sfx.play('level');
        SV.UI.banner(c.companion_name.toUpperCase() + ' NÅR NIVÅ ' + lvl, SV.LEVEL_TITLES[lvl - 1]);
        this.addFx({ type: 'ring', x: c.x, y: c.y - 6, r0: 2, r1: 30, life: 0.6, t: 0, col: lvl === 3 ? '#ffd25e' : '#8fcf6a', thick: 2 });
      });
      this.companions.on('super_ready', (c) => SV.UI.toast(`${c.info.super.name} är redo! Tryck på Super.`));
      this.companions.unlock('dog', true);
      this.robots = this.world.spawns.map((s) => new SV.Robot(s.type, s.x, s.y));
      this.pickups = [];
      this.projectiles = [];
      this.fx = [];
      this.floaters = [];
      this.decoy = null;
      this.visited = new Set(['moss']);
      this.currentSector = this.world.sectorAt(Math.floor(sp.y / T));
      this.won = false;
      this.playerDown = false;
      this.downT = 0;
      this.saveT = 0;
      this.screenFlash = 0;
      this.shakeAmt = 0;
      this.stats = { robots: 0, start: Date.now() };
      this.hiddenBonus = false;
      this.reinforceToast = false;
      this.env.on('lightning', (x, y) => this.onLightning(x, y));
      if (save) this.applySave(save);
      this.world.initFog();
      this.world.reveal(this.player.x, this.player.y, this.companions.revealRadius());
      this.cam = { x: this.player.x, y: this.player.y - 8 };
      this.computeTileColors();
      this.rebuildMinimap();
    },

    startGame(save) {
      SV.UI.closeDialog();
      $('panel-title').hidden = true;
      $('app').classList.remove('title');
      this.newState(save);
      this.started = true;
      this.pause(false);
      if (!save) {
        SV.UI.banner('SEKTOR', 'Mossdalen');
        setTimeout(() => SV.UI.dialog('<b>Signe:</b> Stormen laddar upp sig över skogen. Hunden och jag måste hitta energikristaller innan den växer sig för stark. Smedjan här i Skogsbasen hjälper mig bygga om utrustningen.'), 1600);
      } else SV.UI.toast('Välkommen tillbaka till skogen!');
    },

    newGame() {
      SV.store.remove(SAVE_KEY);
      this.startGame(null);
    },

    pause(p) {
      this.paused = p;
      SV.Input.releaseAll();
    },

    // ================================================================
    // Bildruta
    // ================================================================
    frame() {
      const In = SV.Input;
      if (In.pressed('menu') && this.started) {
        if (!$('panel-forge').hidden) SV.Forge.close();
        else if (!$('panel-menu').hidden) SV.UI.closeMenu();
        else if ($('panel-win').hidden && $('panel-confirm').hidden) SV.UI.openMenu();
      }
      this.time += this.dt;
      if (!this.paused) this.update(this.dt);
      else {
        // titelskärmen: låt stormen och partiklarna leva
        this.env.update(this.dt, this.view || { x: 0, y: 0, w: 300, h: 200 });
      }
      this.render();
      In.endFrame();
    },

    update(dt) {
      const In = SV.Input;
      const p = this.player;
      this.env.snowy = this.player.y < 46 * T;
      this.env.update(dt, this.view);

      if (this.playerDown) {
        this.downT -= dt;
        if (this.downT <= 0) {
          this.playerDown = false;
          this.returnToBase('Signe drog sig tillbaka till Skogsbasen för att ladda om. Allt hon samlat är kvar.');
        }
      } else p.update(dt, this);

      const c = this.companions.active;
      if (!this.playerDown && c) {
        if (In.pressed('super')) {
          if (c.current_level < 3) {
            SV.Sfx.play('deny');
            SV.UI.toast(`${c.info.super.name} låses upp när ${c.companion_name.toLowerCase()} når nivå 3.`);
          } else if (!c.is_super_available) {
            SV.Sfx.play('deny');
            SV.UI.toast(`Supermätaren laddas när ni kortsluter robotar tillsammans (${Math.floor(c.super_meter)} %).`);
          } else if (c.trigger_super(this)) this.stats.supers = (this.stats.supers || 0) + 1;
        }
        if (In.pressed('coop')) {
          if (!c.use_coop(this)) SV.Sfx.play('deny');
        }
        if (In.pressed('swap')) this.companions.cycle();
      }
      this.companions.update(dt);

      if (In.pressed('interact') && this.interactTarget && !this.playerDown) {
        SV.Sfx.play('ui');
        this.interactTarget.action();
      }

      this.robots.forEach((r) => r.update(dt, this));
      this.robots = this.robots.filter((r) => !(r.state === 'disabled' && r.fade > 4));
      this.separateRobots();
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      this.updateFx(dt);
      if (this.decoy) {
        this.decoy.t -= dt;
        if (this.decoy.t <= 0) {
          this.addFx({ type: 'puff', x: this.decoy.x, y: this.decoy.y, life: 0.4, t: 0 });
          this.decoy = null;
        }
      }
      this.world.buried.forEach((b) => (b.marked = Math.max(0, b.marked - dt)));
      this.world.crystals.forEach((cr) => (cr.ping = Math.max(0, (cr.ping || 0) - dt)));

      // Utforskning: dimman lyfts och stormen laddas.
      const n = this.world.reveal(p.x, p.y, this.companions.revealRadius());
      if (n) this.onReveal(n);
      const sec = this.world.sectorAt(Math.floor(p.y / T));
      if (sec !== this.currentSector) {
        this.currentSector = sec;
        SV.UI.banner('SEKTOR', sec.name);
        if (!this.visited.has(sec.id)) {
          this.visited.add(sec.id);
          this.env.storm_intensity += 0.05;
          SV.UI.toast('Luften blir mer laddad här. Tidsstormen växer.');
        }
      }

      // Kristaller plockas upp när Signe går fram till dem.
      this.world.crystals.forEach((cr) => {
        if (!cr.taken && !cr.buried && SV.dist(cr.x, cr.y, p.x, p.y) < 13) this.takeCrystal(cr);
        if (!cr.seen && !cr.buried && this.world.revealed[cr.ty * this.world.W + cr.tx]) cr.seen = true;
      });

      // Lägerelden laddar energi.
      this.nearCampfire = SV.dist(p.x, p.y, this.world.campfire.x, this.world.campfire.y) < 40;
      if (this.nearCampfire && p.energy < p.maxEnergy) {
        this.campT = (this.campT || 0) + dt;
        if (this.campT > 0.8) {
          this.campT = 0;
          p.energy = Math.min(p.maxEnergy, p.energy + 1);
          this.floater(p.x, p.y - 22, '+1', '#5ef59a');
        }
      }

      this.interactTarget = this.findInteract();
      if (SV.UI.dialogOpen && this.dialogAnchor && SV.dist(p.x, p.y, this.dialogAnchor.x, this.dialogAnchor.y) > 70) SV.UI.closeDialog();
      this.screenFlash = Math.max(0, this.screenFlash - dt * 1.2);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 18);
      if (this.miniDirty && (this.miniT = (this.miniT || 0) + dt) > 0.25) {
        this.miniT = 0;
        this.rebuildMinimap();
      }
      this.saveT += dt;
      if (this.saveT > 10) {
        this.saveT = 0;
        this.save();
      }
      SV.UI.update(this);
    },

    // Robotar ska inte klumpa ihop sig i varandra.
    separateRobots() {
      const rs = this.robots;
      for (let i = 0; i < rs.length; i++) {
        const a = rs[i];
        if (!a.active) continue;
        for (let j = i + 1; j < rs.length; j++) {
          const b = rs[j];
          if (!b.active || !!a.def.fly !== !!b.def.fly) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.8;
          if (d > 0 && d < min) {
            const push = (min - d) / 2;
            const opts = { flying: !!a.def.fly };
            this.world.moveBody(a, (-dx / d) * push, (-dy / d) * push, a.r * 0.6, 3, opts);
            this.world.moveBody(b, (dx / d) * push, (dy / d) * push, b.r * 0.6, 3, opts);
          }
        }
      }
    },

    // ================================================================
    // Händelser
    // ================================================================
    onReveal(n, fromCoop) {
      this.env.storm_intensity += n * 0.00009;
      this.companions.addXp(n * (fromCoop ? 0.08 : 0.2));
      this.miniDirty = true;
    },

    crystalCount() {
      return this.world.crystals.filter((c) => c.taken).length;
    },

    takeCrystal(cr) {
      cr.taken = true;
      this.env.storm_intensity -= 0.12;
      SV.Sfx.play('crystal');
      this.addFx({ type: 'ring', x: cr.x, y: cr.y - 8, r0: 2, r1: 46, life: 0.7, t: 0, col: '#7ff3ff', thick: 2 });
      this.addFx({ type: 'sparks', x: cr.x, y: cr.y - 8, life: 0.8, t: 0, n: 18, col: '#b6f7ff' });
      this.companions.addXp(35);
      const n = this.crystalCount();
      if (n === this.CRYSTALS_NEEDED) SV.UI.banner('ÅTTA KRISTALLER', 'Urkärnan kan väckas');
      else SV.UI.toast(`Energikristall! Stormen pressas tillbaka. (${n}/${this.CRYSTALS_NEEDED})`);
    },

    onRobotDisabled(r) {
      this.stats.robots++;
      this.companions.addXp(r.def.xp);
      this.companions.chargeSuper(12);
    },

    onHiddenPath() {
      if (this.hiddenBonus) return;
      this.hiddenBonus = true;
      SV.UI.toast('Lodjuret visar vägen genom snåren!');
      this.companions.addXp(20);
    },

    onPlayerDown() {
      if (this.playerDown) return;
      this.playerDown = true;
      this.downT = 1.6;
      SV.Sfx.play('robotDown');
      this.addFx({ type: 'puff', x: this.player.x, y: this.player.y, life: 0.6, t: 0 });
    },

    returnToBase(msg) {
      const p = this.player;
      p.x = this.world.spawn.x;
      p.y = this.world.spawn.y;
      p.energy = p.maxEnergy;
      p.coolant = p.maxCoolant;
      p.invuln = 1.5;
      p.knock.x = p.knock.y = 0;
      this.cam.x = p.x;
      this.cam.y = p.y;
      const c = this.companions.active;
      if (c) {
        c.action = null;
        c.task = null;
        c.z = 0;
        c.placeAt(p.x - 12, p.y + 4);
      }
      this.robots.forEach((r) => {
        if (r.active && r.state !== 'patrol') r.setState('patrol');
      });
      this.currentSector = this.world.sectorAt(Math.floor(p.y / T));
      SV.UI.toast(msg, 3.5);
    },

    onLightning(x, y) {
      if (!this.started || this.won || this.env.visual < 0.6) return;
      const p = this.player;
      if (SV.dist(x, y, p.x, p.y) < 90) return;
      const near = this.robots.filter((r) => r.active && SV.dist(r.x, r.y, p.x, p.y) < 320).length;
      const total = this.robots.filter((r) => r.active).length;
      if (near >= 5 || total > 36) return;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (this.world.isSolidTile(tx, ty) || this.world.g(tx, ty) === G.SHALLOW) return;
      const type = ty < 44 ? 'drone' : Math.random() < 0.6 ? 'hound' : 'drone';
      const r = new SV.Robot(type, x, y);
      r.setState('chase');
      this.robots.push(r);
      this.addFx({ type: 'ring', x, y, r0: 2, r1: 20, life: 0.5, t: 0, col: '#e0b8ff' });
      if (!this.reinforceToast) {
        this.reinforceToast = true;
        SV.UI.toast('Blixten laddade liv i en robot! Samla kristaller för att lugna stormen.', 3.5);
      }
    },

    // ================================================================
    // Interaktion
    // ================================================================
    findInteract() {
      const p = this.player, w = this.world;
      const near = (x, y, d) => SV.dist(p.x, p.y, x, y) < d;
      if (this.playerDown) return null;
      if (near(w.forgePos.x, w.forgePos.y, 30)) return { label: 'Smedja', x: w.forgePos.x, y: w.forgePos.y - 30, action: () => SV.Forge.open(this) };
      for (const a of w.animals) if (!a.met && near(a.x, a.y, 26)) return { label: 'Bli vän', x: a.x, y: a.y - 22, action: () => this.befriend(a) };
      for (const k of w.chests) if (!k.open && near(k.x, k.y, 22)) return { label: 'Öppna', x: k.x, y: k.y - 18, action: () => this.openChest(k) };
      for (const r of w.runestones) if (near(r.x, r.y, 24)) return { label: 'Läs', x: r.x, y: r.y - 26, action: () => this.readRune(r) };
      if (near(w.core.x, w.core.y, 46)) return { label: this.won ? 'Urkärnan' : 'Väck kärnan', x: w.core.x, y: w.core.y - 70, action: () => this.activateCore() };
      for (const site of Object.values(w.bridgeSites)) {
        if (site.built) continue;
        const sx = (site.post[0] + 0.5) * T, sy = (site.post[1] + 0.5) * T;
        if (near(sx, sy, 34)) return { label: 'Bygg bro', x: sx, y: sy - 16, action: () => this.tryBridge(site) };
      }
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const bt = w.b(tx + i, ty + j);
          const cx = (tx + i + 0.5) * T, cy = (ty + j + 0.5) * T;
          if (bt === B.LOG && near(cx, cy, 22))
            return {
              label: 'Stock', x: cx, y: cy - 14,
              action: () => this.say(cx, cy, 'Tunga fallna stockar. <b>Älgen</b> på nivå 2 kan knuffa undan dem med sin Stockknuff, och Urkraftens Rusning plöjer rakt igenom.'),
            };
          if (bt === B.BARRICADE && near(cx, cy, 22))
            return {
              label: 'Barrikad', x: cx, y: cy - 18,
              action: () => this.say(cx, cy, `En el-barrikad (${w.blockHp[tx + i + ',' + (ty + j)] || 0} laddningar kvar). Håll in El-staven för en <b>EMP</b>, eller låt Älgens rusning eller Bäverns översvämning kortsluta den.`),
            };
        }
      return null;
    },

    say(x, y, html) {
      this.dialogAnchor = { x, y };
      SV.UI.dialog(html);
    },

    befriend(a) {
      a.met = true;
      this.companions.unlock(a.kind, true);
      const info = SV.COMPANION_INFO[a.kind];
      SV.Sfx.play('level');
      SV.UI.banner('NY VÄN', info.name);
      this.addFx({ type: 'ring', x: a.x, y: a.y - 6, r0: 2, r1: 28, life: 0.6, t: 0, col: '#8fcf6a', thick: 2 });
      this.say(a.x, a.y, `<b>${info.name}</b> (${info.trait.toLowerCase()}) följer nu med dig. ${info.levels[0]} <br>Samarbete: <b>${info.coop[0].name}</b>. De andra djuren väntar vid lägerelden – byt genom att trycka på djurkortet.`);
    },

    openChest(k) {
      k.open = true;
      SV.Sfx.play('pickup');
      this.spawnLoot(k.x, k.y - 4, { scrap: 6 + Math.floor(Math.random() * 6), chips: 1 + Math.floor(Math.random() * 2), berry: 1 });
      this.companions.addXp(15);
      SV.UI.toast('Kistan innehöll skrot, kretsar och en bärkaka åt ditt djur.');
    },

    readRune(r) {
      if (!r.read) {
        r.read = true;
        this.companions.addXp(10);
      }
      this.say(r.x, r.y, r.text);
    },

    tryBridge(site) {
      const c = this.companions.active;
      if (c && c.kind === 'beaver' && c.current_level >= 2) this.buildBridge(site);
      else this.say((site.post[0] + 0.5) * T, (site.post[1] + 0.5) * T, 'Gamla brostolpar vid strandkanten. <b>Bävern</b> på nivå 2 kan bygga en träbro härifrån.');
    },

    nearBridgeSite(d) {
      return Object.values(this.world.bridgeSites).find((s) => !s.built && SV.dist(this.player.x, this.player.y, (s.post[0] + 0.5) * T, (s.post[1] + 0.5) * T) < d);
    },

    buildBridge(site) {
      if (!this.world.buildBridge(site.id)) return;
      SV.Sfx.play('build');
      SV.UI.toast('Bävern byggde en bro!');
      site.tiles.forEach(([x, y]) => this.addFx({ type: 'dirt', x: (x + 0.5) * T, y: (y + 0.5) * T, life: 0.6, t: 0 }));
      this.companions.addXp(60);
      this.computeTileColors();
      this.miniDirty = true;
    },

    clearLogsNear(px, py, rTiles) {
      const w = this.world;
      let n = 0;
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      const r = Math.ceil(rTiles);
      for (let y = ty - r; y <= ty + r; y++)
        for (let x = tx - r; x <= tx + r; x++) {
          if (w.b(x, y) === B.LOG && Math.hypot(x - tx, y - ty) <= rTiles) {
            w.clearBlock(x, y);
            this.addFx({ type: 'dirt', x: (x + 0.5) * T, y: (y + 0.5) * T, life: 0.6, t: 0 });
            n++;
          }
        }
      if (n) {
        this.computeTileColors();
        this.miniDirty = true;
      }
      return n;
    },

    smashObstaclesAt(px, py) {
      const w = this.world;
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      for (let y = ty - 1; y <= ty + 1; y++)
        for (let x = tx - 1; x <= tx + 1; x++) {
          const bt = w.b(x, y);
          if (bt === B.LOG || bt === B.BARRICADE || bt === B.SCRAPHEAP) {
            w.clearBlock(x, y);
            this.addFx({ type: 'sparks', x: (x + 0.5) * T, y: (y + 0.5) * T, life: 0.5, t: 0, n: 10 });
            if (bt === B.SCRAPHEAP) this.spawnLoot((x + 0.5) * T, (y + 0.5) * T, { scrap: 2 });
          }
        }
      this.computeTileColors();
      this.miniDirty = true;
    },

    damageBarricadesNear(px, py, R, dmg) {
      const w = this.world;
      const r = Math.ceil(R / T);
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      for (let y = ty - r; y <= ty + r; y++)
        for (let x = tx - r; x <= tx + r; x++) {
          if (w.b(x, y) !== B.BARRICADE) continue;
          if (SV.dist(px, py, (x + 0.5) * T, (y + 0.5) * T) > R + 8) continue;
          const key = x + ',' + y;
          w.blockHp[key] = (w.blockHp[key] || 1) - dmg;
          this.addFx({ type: 'sparks', x: (x + 0.5) * T, y: (y + 0.3) * T, life: 0.5, t: 0, n: 10 });
          if (w.blockHp[key] <= 0) {
            w.clearBlock(x, y);
            SV.UI.toast('Barrikaden kortslöts!');
            this.companions.addXp(15);
          } else this.floater((x + 0.5) * T, y * T, `Barriär ${w.blockHp[key]}/3`, '#ff9ab0');
        }
    },

    activateCore() {
      const w = this.world;
      if (this.won) {
        this.say(w.core.x, w.core.y, 'Urkärnan sjunger lågt. Skölden vilar över skogen.');
        return;
      }
      const n = this.crystalCount();
      if (n < this.CRYSTALS_NEEDED) {
        this.say(w.core.x, w.core.y, `Urkärnan sover. Den behöver <b>${this.CRYSTALS_NEEDED} energikristaller</b> för att höja skölden – du har ${n}.`);
        return;
      }
      this.won = true;
      SV.Sfx.play('win');
      this.shake(8);
      this.screenFlash = 1;
      this.env.storm_intensity = 0;
      this.robots.forEach((r) => r.active && r.apply_stun(6));
      this.addFx({ type: 'ring', x: w.core.x, y: w.core.y - 40, r0: 10, r1: 260, life: 2, t: 0, col: '#b6f7ff', thick: 4 });
      SV.UI.banner('URKÄRNAN', 'Skölden höjs');
      setTimeout(() => {
        const mins = Math.max(1, Math.round((Date.now() - this.stats.start) / 60000));
        $('win-text').textContent = `Med ${n} energikristaller väckte Signe Urkärnan. Tidsstormen har lagt sig och skogen andas ut. ${this.stats.robots} robotar kortslöts, ${this.companions.unlocked.length} av 6 djur blev vänner, och ${Math.round(this.world.revealedFraction() * 100)} % av skogen utforskades på ungefär ${mins} minuter.`;
        $('panel-win').hidden = false;
        this.pause(true);
        this.save();
      }, 2600);
    },

    // ================================================================
    // Loot, projektiler och effekter
    // ================================================================
    spawnLoot(x, y, loot) {
      const add = (kind, value) => {
        const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 40;
        this.pickups.push({ kind, value, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, z: 0, vz: 60 + Math.random() * 40, age: 0 });
      };
      let scrap = loot.scrap || 0;
      while (scrap > 0) {
        const v = scrap > 6 ? 2 : 1;
        add('scrap', v);
        scrap -= v;
      }
      for (let i = 0; i < (loot.chips || 0); i++) add('chip', 1);
      for (let i = 0; i < (loot.berry || 0); i++) add('berry', 1);
    },

    collectPickup(pk, viaFox) {
      const i = this.pickups.indexOf(pk);
      if (i < 0) return;
      this.pickups.splice(i, 1);
      const p = this.player;
      if (pk.kind === 'scrap') {
        p.scrap += pk.value;
        this.floater(viaFox ? pk.x : p.x, (viaFox ? pk.y : p.y) - 20, '+' + pk.value + ' skrot', '#d4e2f2');
      } else if (pk.kind === 'chip') {
        p.chips += pk.value;
        this.floater(p.x, p.y - 26, '+1 krets', '#8fef8a');
      } else {
        this.companions.addXp(50);
        const c = this.companions.active;
        this.floater(c ? c.x : p.x, (c ? c.y : p.y) - 18, 'Mums! +50', '#ff9aa8');
      }
      SV.Sfx.play('pickup');
    },

    updatePickups(dt) {
      const p = this.player;
      this.pickups.slice().forEach((k) => {
        k.age += dt;
        if (k.z > 0 || k.vz > 0) {
          k.vz -= 260 * dt;
          k.z = Math.max(0, k.z + k.vz * dt);
          if (k.z === 0) k.vz = k.vz < -40 ? -k.vz * 0.35 : 0;
          const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
          if (!this.world.isSolidPx(nx, ny)) {
            k.x = nx;
            k.y = ny;
          }
          k.vx *= Math.pow(0.05, dt);
          k.vy *= Math.pow(0.05, dt);
        }
        const d = SV.dist(k.x, k.y, p.x, p.y);
        if (k.age > 0.4 && d < 28 && !this.playerDown) {
          k.x += ((p.x - k.x) / d) * 140 * dt;
          k.y += ((p.y - k.y) / d) * 140 * dt;
        }
        if (k.age > 0.4 && d < 8) this.collectPickup(k);
      });
    },

    updateProjectiles(dt) {
      const p = this.player;
      this.projectiles = this.projectiles.filter((pr) => {
        pr.life -= dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.life <= 0) return false;
        if (pr.kind === 'frost') {
          pr.trail += dt;
          if (pr.trail > 0.03) {
            pr.trail = 0;
            this.addFx({ type: 'frost', x: pr.x, y: pr.y, life: 0.25, t: 0 });
          }
          const tx = Math.floor(pr.x / T), ty = Math.floor((pr.y + 6) / T);
          const bt = this.world.b(tx, ty);
          if (bt !== B.NONE && bt !== B.CAMPFIRE) {
            this.addFx({ type: 'frostburst', x: pr.x, y: pr.y, life: 0.3, t: 0 });
            return false;
          }
          for (const r of this.robots) {
            if (!r.active) continue;
            const ry = r.y - r.h / 2 - (r.def.fly ? 12 : 0);
            if (SV.dist(pr.x, pr.y, r.x, ry) < r.r + 4) {
              r.chill += p.frostChill();
              r.takeDamage(2 + p.stats.frost, 'frost', this, pr);
              if (r.active && r.chill >= 3 && r.frozen <= 0) {
                r.frozen = p.frostDuration();
                r.chill = 3;
                r.lunge = null;
                SV.Sfx.play('freeze');
                this.floater(r.x, r.y - r.h - 10, 'Fryst!', '#b6f7ff');
              }
              this.companions.chargeSuper(2);
              this.addFx({ type: 'frostburst', x: pr.x, y: pr.y, life: 0.3, t: 0 });
              return false;
            }
          }
          return true;
        }
        // drönarens elbolt
        if (!this.playerDown && SV.dist(pr.x, pr.y, p.x, p.y - 6) < 7) {
          p.hurt(pr.dmg, this, { x: pr.x, y: pr.y });
          return false;
        }
        if (this.decoy && SV.dist(pr.x, pr.y, this.decoy.x, this.decoy.y - 6) < 8) return false;
        return true;
      });
    },

    addFx(f) {
      if (f.type === 'sparks') {
        f.parts = Array.from({ length: f.n || 6 }, () => {
          const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 70;
          return { x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20 };
        });
      }
      if (f.type === 'dirt' || f.type === 'puff') {
        f.parts = Array.from({ length: 6 }, () => {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 20 + Math.random() * 40;
          return { x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s };
        });
      }
      this.fx.push(f);
    },
    updateFx(dt) {
      this.fx = this.fx.filter((f) => {
        f.t += dt;
        if (f.parts)
          f.parts.forEach((q) => {
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.vy += (f.type === 'puff' ? -20 : 160) * dt;
          });
        return f.t < f.life;
      });
      this.floaters = this.floaters.filter((fl) => {
        fl.t += dt;
        fl.y -= 18 * dt;
        return fl.t < fl.life;
      });
    },
    toast(text, secs) {
      SV.UI.toast(text, secs);
    },
    floater(x, y, text, col) {
      this.floaters.push({ x, y, text, col, t: 0, life: 1 });
    },
    shake(n) {
      this.shakeAmt = Math.max(this.shakeAmt, n);
    },

    // Spelare upptäcks mindre/mer beroende på rustning och djur.
    detectionMod(robot) {
      const style = this.player.style.id;
      let m = this.companions.detectionMod();
      if (style === 'camo') m *= 0.65;
      if (style === 'neon' && robot.type !== 'drone') m *= 1.35;
      return m;
    },

    // ================================================================
    // Testläge: GDD §6.3 – Hundens Sköldskall mot fiendernas stun
    // ================================================================
    testShieldBark() {
      const cm = this.companions;
      cm.unlock('dog', true);
      const dog = cm.active;
      while (dog.current_level < 3) dog.add_xp(dog.xp_to_next_level[dog.current_level - 1]);
      dog.is_super_available = true;
      const p = this.player;
      const bots = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        let x = p.x + Math.cos(a) * 46, y = p.y + Math.sin(a) * 46;
        if (this.world.isSolidPx(x, y)) {
          x = p.x + Math.cos(a) * 20;
          y = p.y + Math.sin(a) * 20;
        }
        const r = new SV.Robot('hound', x, y);
        r.setState('chase');
        this.robots.push(r);
        bots.push(r);
      }
      dog.placeAt(p.x - 8, p.y + 2);
      const ok = dog.trigger_super(this);
      const stunned = bots.filter((r) => r.stun >= 3.99).length;
      return ok ? `Sköldskall testat: ${stunned}/4 robotar paralyserade i 4 s, Signes sköld: ${p.shield} träffar.` : 'Sköldskall kunde inte utlösas.';
    },

    // ================================================================
    // Minikarta
    // ================================================================
    computeTileColors() {
      const w = this.world;
      this.tileCols = new Array(w.W * w.H);
      for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) this.tileCols[y * w.W + x] = SV.hexToRgb(w.tileMapColor(x, y));
    },
    rebuildMinimap() {
      const w = this.world;
      if (!this.miniBase) this.miniBase = SV.Art.makeCanvas(w.W, w.H)[0];
      const g = this.miniBase.getContext('2d');
      const img = g.createImageData(w.W, w.H);
      for (let i = 0; i < w.W * w.H; i++) {
        const c = w.revealed[i] ? this.tileCols[i] : [13, 20, 24];
        img.data[i * 4] = c[0];
        img.data[i * 4 + 1] = c[1];
        img.data[i * 4 + 2] = c[2];
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.miniDirty = false;
    },

    // ================================================================
    // Sparning
    // ================================================================
    serialize() {
      const p = this.player, w = this.world;
      return {
        v: 1,
        player: { x: p.x, y: p.y, energy: p.energy, scrap: p.scrap, chips: p.chips, stats: p.stats, armor: p.armor, pal: p.unlockedPalettes, painter: p.painterUnlocked },
        comps: this.companions.serialize(),
        storm: this.env.storm_intensity,
        fog: w.fogToString(),
        changes: w.changes,
        crystals: w.crystals.map((c) => (c.taken ? 2 : c.buried ? 0 : 1)),
        chests: w.chests.filter((k) => k.open).map((k) => k.id),
        dug: w.buried.filter((b) => b.dug).map((b) => b.id),
        met: w.animals.filter((a) => a.met).map((a) => a.kind),
        runes: w.runestones.filter((r) => r.read).map((r) => r.id),
        heaps: Object.keys(w.scrapHeapUsed),
        blockHp: w.blockHp,
        won: this.won,
        visited: Array.from(this.visited),
        stats: this.stats,
        hidden: this.hiddenBonus,
      };
    },
    save() {
      if (!this.started) return;
      SV.store.set(SAVE_KEY, this.serialize());
    },
    applySave(s) {
      const p = this.player, w = this.world;
      w.applyChanges(s.changes);
      Object.assign(w.blockHp, s.blockHp || {});
      (s.heaps || []).forEach((k) => (w.scrapHeapUsed[k] = true));
      if (s.fog) w.fogFromString(s.fog);
      (s.crystals || []).forEach((st, i) => {
        const c = w.crystals[i];
        if (!c) return;
        c.taken = st === 2;
        if (st >= 1) c.buried = false;
      });
      w.chests.forEach((k) => (k.open = (s.chests || []).includes(k.id)));
      w.buried.forEach((b) => (b.dug = (s.dug || []).includes(b.id)));
      w.animals.forEach((a) => (a.met = (s.met || []).includes(a.kind)));
      w.runestones.forEach((r) => (r.read = (s.runes || []).includes(r.id)));
      const sp = s.player || {};
      p.x = sp.x || p.x;
      p.y = sp.y || p.y;
      if (w.isSolidPx(p.x, p.y)) {
        p.x = w.spawn.x;
        p.y = w.spawn.y;
      }
      p.scrap = sp.scrap || 0;
      p.chips = sp.chips || 0;
      p.stats = Object.assign({ staff: 1, frost: 1, cool: 1, plate: 1 }, sp.stats);
      p.energy = Math.min(p.maxEnergy, sp.energy || p.maxEnergy);
      p.coolant = p.maxCoolant;
      p.unlockedPalettes = sp.pal || ['original'];
      p.painterUnlocked = !!sp.painter;
      if (sp.armor) p.setArmor(sp.armor);
      this.companions.load(s.comps);
      this.env.storm_intensity = s.storm != null ? s.storm : 0.3;
      this.env.visual = this.env.storm_intensity;
      this.env._updateEnvironment();
      this.won = !!s.won;
      this.visited = new Set(s.visited || ['moss']);
      this.stats = Object.assign({ robots: 0, start: Date.now() }, s.stats);
      this.hiddenBonus = !!s.hidden;
      if (this.won) w.core.lit = true;
    },

    // ================================================================
    // Rendering
    // ================================================================
    render() {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height, Z = this.zoom;
      const vw = W / Z, vh = H / Z;
      const p = this.player;
      const tx = p.x, ty = p.y - 10;
      this.cam.x += (tx - this.cam.x) * Math.min(1, this.dt * 7);
      this.cam.y += (ty - this.cam.y) * Math.min(1, this.dt * 7);
      const wpx = this.world.W * T, hpx = this.world.H * T;
      let cx = SV.clamp(this.cam.x, vw / 2, wpx - vw / 2);
      let cy = SV.clamp(this.cam.y, vh / 2, hpx - vh / 2);
      if (this.shakeAmt > 0) {
        cx += (Math.random() - 0.5) * this.shakeAmt;
        cy += (Math.random() - 0.5) * this.shakeAmt;
      }
      const view = (this.view = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0a130f';
      ctx.fillRect(0, 0, W, H);
      const ox = Math.round(view.x * Z), oy = Math.round(view.y * Z);
      ctx.setTransform(Z, 0, 0, Z, -ox, -oy);
      this.snap = (v) => Math.round(v * Z) / Z;

      this.drawGround(ctx, view);
      this.drawWorldObjects(ctx, view);
      this.drawFx(ctx);

      // krigsdimma (mjuk tack vare bilinjär uppskalning)
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.world.fogCanvas, 0, 0, this.world.W * T, this.world.H * T);
      ctx.imageSmoothingEnabled = false;

      this.env.render(ctx, view);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.env.renderGrade(ctx, W, H);
      if (this.screenFlash > 0) {
        ctx.fillStyle = `rgba(255,250,225,${this.screenFlash * 0.8})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (p.energy <= 2 && !this.paused) {
        const a = 0.18 + Math.sin(this.time * 5) * 0.08;
        const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        vg.addColorStop(0, 'rgba(255,60,60,0)');
        vg.addColorStop(1, `rgba(255,60,60,${a})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }
      if (this.playerDown) {
        ctx.fillStyle = `rgba(10,19,15,${1 - this.downT / 1.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      this.drawScreenText(ctx, view);
    },

    drawGround(ctx, view) {
      const S = 16 * T;
      const w = this.world;
      const x0 = Math.floor(view.x / S), y0 = Math.floor(view.y / S);
      const x1 = Math.floor((view.x + view.w) / S), y1 = Math.floor((view.y + view.h) / S);
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          if (cx < 0 || cy < 0 || cx * 16 >= w.W || cy * 16 >= w.H) continue;
          ctx.drawImage(w.getChunk(cx, cy), cx * S, cy * S);
        }
      // förbered en grannchunk per bildruta så att det inte hackar senare
      if (!this.prewarm) this.prewarm = { i: 0 };
      const total = Math.ceil(w.W / 16) * Math.ceil(w.H / 16);
      for (let k = 0; k < total && this.prewarm.i < total; k++) {
        const i = this.prewarm.i;
        const cx = i % Math.ceil(w.W / 16), cy = Math.floor(i / Math.ceil(w.W / 16));
        if (!w.chunks[cx + ',' + cy]) {
          w.getChunk(cx, cy);
          break;
        }
        this.prewarm.i++;
      }

      // vattenglitter och detaljer per ruta
      const tx0 = Math.max(0, Math.floor(view.x / T)), ty0 = Math.max(0, Math.floor(view.y / T));
      const tx1 = Math.min(w.W - 1, Math.floor((view.x + view.w) / T)), ty1 = Math.min(w.H - 1, Math.floor((view.y + view.h) / T));
      const lynx = this.companions.hiddenPathsOpen();
      const tick = Math.floor(this.time * 2);
      for (let y = ty0; y <= ty1; y++)
        for (let x = tx0; x <= tx1; x++) {
          const gt = w.ground[y * w.W + x];
          if (gt === G.DEEP || gt === G.SHALLOW || gt === G.SITE) {
            const h = SV.hash(x, y, tick);
            if (h < 0.35) {
              ctx.fillStyle = gt === G.DEEP ? 'rgba(170,215,240,0.7)' : 'rgba(220,245,255,0.8)';
              ctx.fillRect(x * T + Math.floor(SV.hash(x, y, tick + 1) * 13), y * T + Math.floor(SV.hash(x, y, tick + 2) * 14), 2, 1);
            }
          } else if (gt === G.HIDDEN && lynx) {
            const a = 0.25 + Math.sin(this.time * 3 + x) * 0.12;
            ctx.fillStyle = `rgba(214,255,176,${a})`;
            for (let i = 0; i < 4; i++) ctx.fillRect(x * T + 2 + i * 4, y * T + 7 + ((i % 2) * 2 - 1), 2, 2);
          }
        }
      // hundens markeringar och uppgrävda hål
      w.buried.forEach((b) => {
        if (b.x < view.x - 10 || b.x > view.x + view.w + 10 || b.y < view.y - 10 || b.y > view.y + view.h + 10) return;
        if (b.dug) {
          ctx.fillStyle = 'rgba(60,36,20,0.6)';
          ctx.fillRect(b.x - 3, b.y - 1, 6, 3);
        } else if (b.marked > 0) ctx.drawImage(SV.SPR.obj.moundSparkle, Math.round(b.x - 5), Math.round(b.y - 4));
      });
    },

    drawWorldObjects(ctx, view) {
      const w = this.world, O = SV.SPR.obj, p = this.player;
      const list = [];
      const pad = 3;
      const tx0 = Math.max(0, Math.floor(view.x / T) - pad), ty0 = Math.max(0, Math.floor(view.y / T) - 1);
      const tx1 = Math.min(w.W - 1, Math.floor((view.x + view.w) / T) + pad), ty1 = Math.min(w.H - 1, Math.floor((view.y + view.h) / T) + pad + 2);
      const frame3 = Math.floor(this.time * 8) % 3;
      for (let y = ty0; y <= ty1; y++)
        for (let x = tx0; x <= tx1; x++) {
          const bt = w.block[y * w.W + x];
          if (bt === B.NONE || bt === B.PART) continue;
          const v = w.variant[y * w.W + x];
          let spr = null, shadow = 6, dx = 0, tree = false;
          switch (bt) {
            case B.PINE: spr = O.pine[v % 4]; dx = (v % 5) - 2; tree = true; break;
            case B.PINE_SNOW: spr = O.pineSnow[v % 3]; dx = (v % 5) - 2; tree = true; break;
            case B.SPRUCE: spr = O.spruce[v % 2]; dx = (v % 3) - 1; shadow = 8; tree = true; break;
            case B.SPRUCE_DARK: spr = O.spruceDark[v % 2]; dx = (v % 3) - 1; shadow = 8; tree = true; break;
            case B.BIRCH: spr = O.birch[v % 3]; dx = (v % 5) - 2; tree = true; break;
            case B.ROCK: spr = O.rock[v % 2]; break;
            case B.ROCK_MOSS: spr = O.rockMoss[v % 2]; break;
            case B.RUIN: spr = O.ruin[v % 3]; shadow = 0; break;
            case B.LOG: spr = O.log; break;
            case B.BARRICADE: spr = O.barricade[frame3]; shadow = 0; break;
            case B.SCRAPHEAP: spr = O.scrapHeap[v % 2]; break;
            case B.RUNESTONE: {
              const r = w.runestones.find((q) => q.tx === x && q.ty === y);
              spr = r && r.read ? O.runestoneLit : O.runestone;
              break;
            }
            case B.PYLON: {
              const core = w.core.pylons.some(([px, py]) => px === x && py === y);
              spr = (core && (this.won || w.core.lit)) || (!core && Math.sin(this.time * 2 + x * 3) > 0.97) ? O.pylonLit : O.pylon;
              break;
            }
            case B.CAMPFIRE: spr = O.campfire[frame3]; shadow = 0; break;
          }
          if (!spr) continue;
          const bx = (x + 0.5) * T + dx, by = (y + 1) * T;
          list.push({ y: by - (bt === B.LOG ? 4 : 0), spr, x: bx, by, shadow, tree, kind: bt });
        }
      w.big.forEach((o) => {
        const bx = (o.x + o.w / 2) * T, by = (o.y + o.h) * T;
        if (bx < view.x - 60 || bx > view.x + view.w + 60 || by < view.y - 10 || by > view.y + view.h + 100) return;
        let spr;
        if (o.kind === 'forge') spr = O.forge;
        else if (o.kind === 'tent') spr = O.tent;
        else if (o.kind === 'reactor') spr = O.reactor;
        else spr = this.won ? O.urkarnanLit : O.urkarnan;
        list.push({ y: by, spr, x: bx, by: by + (o.kind === 'core' ? 4 : 2), shadow: o.kind === 'core' ? 0 : 0 });
      });
      // brostolpar
      Object.values(w.bridgeSites).forEach((s) => {
        if (s.built) return;
        list.push({ y: (s.post[1] + 1) * T, spr: O.bridgePosts, x: (s.post[0] + 0.5) * T, by: (s.post[1] + 1) * T - 2, shadow: 0 });
      });
      // dynamiska saker
      w.crystals.forEach((c) => {
        if (c.taken || c.buried) return;
        list.push({ y: c.y, draw: () => this.drawCrystal(ctx, c) });
      });
      w.chests.forEach((k) => list.push({ y: k.y, spr: k.open ? O.chestOpen : O.chest, x: k.x, by: k.y + 2, shadow: 5 }));
      w.animals.forEach((a) => !a.met && list.push({ y: a.y, draw: () => this.drawWaitingAnimal(ctx, a) }));
      this.companions.unlocked.forEach((k) => {
        const c = this.companions.roster[k];
        list.push({ y: c.y, draw: () => this.drawCompanion(ctx, c, k === this.companions.activeKind) });
      });
      if (!this.playerDown) list.push({ y: p.y, draw: () => this.drawPlayer(ctx) });
      this.robots.forEach((r) => {
        if (r.x < view.x - 40 || r.x > view.x + view.w + 40 || r.y < view.y - 40 || r.y > view.y + view.h + 60) return;
        list.push({ y: r.y + (r.def.fly ? 14 : 0), draw: () => this.drawRobot(ctx, r) });
      });
      this.pickups.forEach((k) => list.push({ y: k.y, draw: () => this.drawPickup(ctx, k) }));
      if (this.decoy) list.push({ y: this.decoy.y, draw: () => this.drawDecoy(ctx) });

      // skuggor först
      ctx.fillStyle = 'rgba(10,20,14,0.28)';
      list.forEach((o) => {
        if (!o.spr || !o.shadow) return;
        ctx.beginPath();
        ctx.ellipse(o.x, o.by - 1, o.shadow, o.shadow * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      // drönarnas sökarljus på marken
      this.robots.forEach((r) => {
        if (r.type !== 'drone' || !r.active || r.blind > 0 || r.stun > 0 || r.frozen > 0) return;
        const R = r.detectRadius(this) * 1.15;
        ctx.fillStyle = r.state === 'patrol' ? 'rgba(255,240,170,0.13)' : 'rgba(255,120,100,0.15)';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.arc(r.x, r.y, R, r.searchA - 0.5, r.searchA + 0.5);
        ctx.closePath();
        ctx.fill();
      });

      list.sort((a, b) => a.y - b.y);
      const snap = this.snap;
      list.forEach((o) => {
        if (o.draw) return o.draw();
        let alpha = 1;
        if (o.tree && p.y < o.by - 2 && p.y > o.by - o.spr.height + 4 && Math.abs(p.x - o.x) < o.spr.width / 2) alpha = 0.55;
        if (alpha < 1) ctx.globalAlpha = alpha;
        ctx.drawImage(o.spr, snap(o.x - o.spr.width / 2), snap(o.by - o.spr.height));
        if (alpha < 1) ctx.globalAlpha = 1;
        if (o.kind === B.CAMPFIRE) {
          const gl = ctx.createRadialGradient(o.x, o.by - 6, 0, o.x, o.by - 6, 34);
          gl.addColorStop(0, 'rgba(255,170,80,0.28)');
          gl.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(o.x - 34, o.by - 40, 68, 68);
        }
      });
    },

    shadow(ctx, x, y, r) {
      ctx.fillStyle = 'rgba(10,20,14,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    drawPlayer(ctx) {
      const p = this.player, snap = this.snap;
      if (!p.frames) p.setArmor(p.armor);
      this.shadow(ctx, p.x, p.y, 6);
      const blink = p.invuln > 0 && Math.floor(this.time * 14) % 2 === 0;
      const frameIdx = p.moving ? 1 + (Math.floor(p.animT * 4) % 2) : 0;
      const spr = p.frames[p.dir][frameIdx];
      const bob = p.moving && frameIdx === 1 ? -1 : 0;
      const sx = snap(p.x - spr.width / 2), sy = snap(p.y - spr.height + 2 + bob);
      const staffBehind = p.dir === 'up';
      if (staffBehind) this.drawStaff(ctx, p);
      if (!blink) ctx.drawImage(spr, sx, sy);
      if (!staffBehind) this.drawStaff(ctx, p);
      if (p.shield > 0) {
        ctx.strokeStyle = `rgba(255,210,94,${0.5 + Math.sin(this.time * 6) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 9, 12, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // laddning av EMP
      const In = SV.Input;
      if (In.down('staff') && In.holdTime('staff') > 0.3 && p.empCd <= 0) {
        const k = Math.min(1, (In.holdTime('staff') - 0.3) / 0.3);
        ctx.strokeStyle = k >= 1 ? '#ffffff' : 'rgba(127,243,255,0.8)';
        ctx.lineWidth = k >= 1 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 6, 6 + k * 14 + (k >= 1 ? Math.sin(this.time * 20) : 0), 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    drawStaff(ctx, p) {
      const a = p.face + (p.swing > 0 ? (p.swing / 0.18 - 0.5) * 1.6 : 0);
      const hx = p.x + (p.dir === 'left' ? -4 : p.dir === 'right' ? 4 : 5), hy = p.y - 6;
      const len = 11;
      const ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len * 0.8 - 2;
      ctx.strokeStyle = '#3a3048';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = '#c9d2de';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      const glow = p.swing > 0 || (SV.Input.down('staff') && p.empCd <= 0);
      ctx.fillStyle = glow ? '#ffffff' : '#7ff3ff';
      ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
      if (glow) {
        ctx.fillStyle = 'rgba(127,243,255,0.35)';
        ctx.fillRect(Math.round(ex) - 3, Math.round(ey) - 3, 7, 7);
      }
    },

    drawCompanion(ctx, c, active) {
      const snap = this.snap;
      const anim = SV.SPR.animals[c.kind];
      let spr;
      if (c.kind === 'owl') spr = active || c.z > 4 ? anim[c.dirX > 0 ? 'right' : 'left'][Math.floor(c.animT * 6) % 2] : anim.perched;
      else spr = anim[c.dirX > 0 ? 'right' : 'left'][c.moving ? Math.floor(c.animT * 7) % 2 : 0];
      const s = c.scale;
      const w = spr.width * s, h = spr.height * s;
      this.shadow(ctx, c.x, c.y, (w / 2.6) * (c.z > 0 ? 0.7 : 1));
      if (c.current_level >= 2) {
        const t = this.time;
        const col = c.current_level === 3 ? '255,210,94' : '143,207,106';
        ctx.strokeStyle = `rgba(${col},${0.35 + Math.sin(t * 3) * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, w / 2 + 3, (w / 2 + 3) * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (c.current_level === 3 && Math.floor(t * 8 + c.x) % 5 === 0) {
          ctx.fillStyle = '#ffe28a';
          ctx.fillRect(Math.round(c.x + Math.sin(t * 5) * w * 0.5), Math.round(c.y - c.z - h * (0.3 + ((t * 0.7) % 0.7))), 1, 1);
        }
      }
      ctx.drawImage(spr, snap(c.x - w / 2), snap(c.y - h + 1 - c.z), w, h);
      if (c.bubble) this.bubble(ctx, c.x, c.y - h - c.z - 4, c.bubble.text);
    },

    drawWaitingAnimal(ctx, a) {
      const anim = SV.SPR.animals[a.kind];
      const spr = a.kind === 'owl' ? anim.perched : anim.left[0];
      this.shadow(ctx, a.x, a.y, spr.width / 2.6);
      ctx.drawImage(spr, this.snap(a.x - spr.width / 2), this.snap(a.y - spr.height + 1));
      const bob = Math.sin(this.time * 3) * 1.5;
      ctx.fillStyle = '#ffcf5a';
      ctx.font = '700 9px "Pixelify Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', a.x, a.y - spr.height - 3 + bob);
    },

    drawRobot(ctx, r) {
      const snap = this.snap;
      const set = r.spriteSet();
      let frame = 0;
      if (r.type === 'drone') frame = Math.floor(r.animT * 12) % 2;
      else if (r.type === 'bear') frame = r.state !== 'patrol' || r.wander ? (r.stun > 0 || r.frozen > 0 || !r.active ? 0 : 1 + (Math.floor(r.animT * 4) % 2)) : 0;
      else frame = r.stun > 0 || r.frozen > 0 || !r.active ? 0 : Math.floor(r.animT * 8) % 2;
      const spr = set[Math.min(frame, set.length - 1)];
      const hover = r.def.fly ? 12 + Math.sin(r.animT * 3) * 2 : 0;
      const fall = r.active ? 0 : Math.min(1, r.fade * 3);
      this.shadow(ctx, r.x, r.y, r.r * (r.def.fly ? 0.7 : 1));
      if (!r.active) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, r.fade - 2.5) / 1.5);
      const wind = r.state === 'windup' ? Math.sin(this.time * 40) * 1 : 0;
      const hY = r.def.fly ? hover * (1 - fall) : 0;
      ctx.drawImage(spr, snap(r.x - spr.width / 2 + wind), snap(r.y - spr.height + 1 - hY));
      ctx.globalAlpha = 1;
      if (!r.active) {
        if (Math.random() < 0.05) this.addFx({ type: 'puff', x: r.x, y: r.y - 6, life: 0.6, t: 0 });
        return;
      }
      const top = r.y - spr.height - hY;
      if (r.state === 'windup') {
        ctx.fillStyle = r.type === 'bear' ? 'rgba(255,207,90,0.35)' : 'rgba(255,90,70,0.3)';
        ctx.beginPath();
        ctx.arc(r.x + Math.cos(r.atkA) * 12, r.y + Math.sin(r.atkA) * 12, r.type === 'bear' ? 20 : 8, 0, Math.PI * 2);
        ctx.fill();
      }
      // statusikoner
      ctx.textAlign = 'center';
      ctx.font = '700 9px "Pixelify Sans", sans-serif';
      if (r.state === 'alert') {
        ctx.fillStyle = '#ff5a4a';
        ctx.fillText('!', r.x, top - 2);
      } else if (r.distract || (this.decoy && r.state === 'chase' && r.targetPos(this) === this.decoy)) {
        ctx.fillStyle = '#ffcf5a';
        ctx.fillText('?', r.x, top - 2);
      }
      if (r.stun > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.time * 5 + (i * Math.PI * 2) / 3;
          ctx.fillStyle = i % 2 ? '#7ff3ff' : '#ffe28a';
          ctx.fillRect(Math.round(r.x + Math.cos(a) * 7), Math.round(top + 2 + Math.sin(a) * 2), 1, 1);
        }
      }
      if (r.frozen > 0) {
        ctx.fillStyle = 'rgba(220,250,255,0.85)';
        ctx.fillRect(Math.round(r.x - spr.width / 2), Math.round(r.y - 2), spr.width, 2);
      }
      if (r.wet > 0 && Math.floor(this.time * 4) % 2 === 0) {
        ctx.fillStyle = '#7ab8ff';
        ctx.fillRect(Math.round(r.x + 4), Math.round(top + 6), 1, 2);
      }
      if (r.hp < r.maxHp) {
        const bw = Math.max(10, r.r * 2);
        ctx.fillStyle = '#0a130f';
        ctx.fillRect(Math.round(r.x - bw / 2) - 1, Math.round(top - 6) - 1, bw + 2, 3);
        ctx.fillStyle = r.frozen > 0 ? '#9fe6ff' : '#ff8a5a';
        ctx.fillRect(Math.round(r.x - bw / 2), Math.round(top - 6), Math.max(0, Math.round((bw * r.hp) / r.maxHp)), 1);
      }
    },

    drawCrystal(ctx, c) {
      const spr = SV.SPR.obj.crystal;
      const bob = Math.sin(this.time * 2.4 + c.x) * 1.5;
      const pulse = 0.35 + Math.sin(this.time * 3 + c.y) * 0.12;
      const gl = ctx.createRadialGradient(c.x, c.y - 8, 0, c.x, c.y - 8, 26);
      gl.addColorStop(0, `rgba(127,243,255,${pulse})`);
      gl.addColorStop(1, 'rgba(127,243,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(c.x - 26, c.y - 34, 52, 52);
      this.shadow(ctx, c.x, c.y, 4);
      ctx.drawImage(spr, this.snap(c.x - spr.width / 2), this.snap(c.y - spr.height - 2 + bob));
      if (c.ping > 0) {
        ctx.strokeStyle = `rgba(255,230,168,${Math.min(1, c.ping / 2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y - 8, 10 + ((this.time * 20) % 16), 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    drawPickup(ctx, k) {
      const spr = SV.SPR.pickup[k.kind];
      this.shadow(ctx, k.x, k.y, 3);
      const bob = k.z > 0 ? 0 : Math.sin(this.time * 4 + k.x) * 0.8;
      ctx.drawImage(spr, this.snap(k.x - spr.width / 2), this.snap(k.y - spr.height - k.z + bob));
    },

    drawDecoy(ctx) {
      const d = this.decoy;
      const spr = this.player.frames.down[0];
      ctx.globalAlpha = 0.45 + Math.sin(this.time * 12) * 0.15;
      ctx.drawImage(SV.Art.tint ? spr : spr, this.snap(d.x - spr.width / 2), this.snap(d.y - spr.height + 2));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,154,74,0.7)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    },

    drawFx(ctx) {
      this.projectiles.forEach((pr) => {
        if (pr.kind === 'frost') {
          ctx.fillStyle = '#e4fdff';
          ctx.fillRect(Math.round(pr.x) - 1, Math.round(pr.y) - 1, 3, 3);
          ctx.fillStyle = 'rgba(127,243,255,0.45)';
          ctx.fillRect(Math.round(pr.x) - 2, Math.round(pr.y) - 2, 5, 5);
        } else {
          ctx.fillStyle = Math.floor(this.time * 20) % 2 ? '#ffffff' : '#ff6a8a';
          ctx.fillRect(Math.round(pr.x) - 1, Math.round(pr.y) - 1, 3, 3);
          ctx.fillStyle = 'rgba(255,106,138,0.35)';
          ctx.fillRect(Math.round(pr.x) - 3, Math.round(pr.y) - 3, 7, 7);
        }
      });
      this.fx.forEach((f) => {
        const k = f.t / f.life;
        switch (f.type) {
          case 'ring': {
            const r = SV.lerp(f.r0, f.r1, 1 - Math.pow(1 - k, 2));
            ctx.strokeStyle = f.col;
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = f.thick || 1.5;
            ctx.beginPath();
            ctx.ellipse(f.x, f.y, r, r * 0.6, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          }
          case 'arc': {
            ctx.strokeStyle = '#e4fdff';
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 1 - k;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 18, f.a - 0.9, f.a + 0.9);
            ctx.stroke();
            ctx.strokeStyle = '#7ff3ff';
            ctx.beginPath();
            let px = f.x, py = f.y;
            ctx.moveTo(px, py);
            for (let i = 1; i <= 4; i++) {
              const d = i * 6;
              px = f.x + Math.cos(f.a) * d + (Math.random() - 0.5) * 6;
              py = f.y + Math.sin(f.a) * d + (Math.random() - 0.5) * 6;
              ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          }
          case 'sparks':
            ctx.fillStyle = f.col || (Math.random() < 0.5 ? '#fff27a' : '#7ff3ff');
            f.parts.forEach((q) => ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1));
            break;
          case 'dirt':
            ctx.fillStyle = '#7a5a3a';
            f.parts.forEach((q) => ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1));
            break;
          case 'puff':
            ctx.fillStyle = `rgba(200,205,215,${0.7 * (1 - k)})`;
            f.parts.forEach((q) => ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2));
            break;
          case 'frost':
            ctx.fillStyle = `rgba(200,245,255,${1 - k})`;
            ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
            break;
          case 'frostburst':
            ctx.strokeStyle = `rgba(200,245,255,${1 - k})`;
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(f.x, f.y);
              ctx.lineTo(f.x + Math.cos(a) * 6 * k + Math.cos(a), f.y + Math.sin(a) * 6 * k);
              ctx.stroke();
            }
            break;
          case 'splash': {
            const r = f.r * Math.min(1, k * 1.6);
            ctx.fillStyle = `rgba(90,170,230,${0.35 * (1 - k)})`;
            ctx.beginPath();
            ctx.ellipse(f.x, f.y, r, r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(220,245,255,${0.8 * (1 - k)})`;
            ctx.lineWidth = f.big ? 3 : 1.5;
            ctx.stroke();
            break;
          }
        }
      });
    },

    bubble(ctx, x, y, text) {
      this.bubbles = this.bubbles || [];
      this.bubbles.push({ x, y, text });
    },

    drawScreenText(ctx, view) {
      const Z = this.zoom;
      const toS = (x, y) => [(x - view.x) * Z, (y - view.y) * Z];
      const fs = Math.max(11, Math.round(Z * 3.2));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${fs}px "Silkscreen", monospace`;
      this.floaters.forEach((f) => {
        const [sx, sy] = toS(f.x, f.y);
        ctx.globalAlpha = 1 - Math.max(0, f.t - 0.6) / 0.4;
        ctx.fillStyle = '#0a130f';
        ctx.fillText(f.text, sx + 2, sy + 2);
        ctx.fillStyle = f.col;
        ctx.fillText(f.text, sx, sy);
      });
      ctx.globalAlpha = 1;
      // pratbubblor
      ctx.font = `${fs}px "Pixelify Sans", sans-serif`;
      (this.bubbles || []).forEach((b) => {
        const [sx, sy] = toS(b.x, b.y);
        const w = ctx.measureText(b.text).width + fs;
        ctx.fillStyle = 'rgba(241,236,224,0.95)';
        ctx.fillRect(sx - w / 2, sy - fs * 1.4, w, fs * 1.5);
        ctx.fillStyle = '#0f1c17';
        ctx.fillText(b.text, sx, sy - fs * 0.3);
      });
      this.bubbles = [];
      // markering ovanför det man kan interagera med
      const it = this.interactTarget;
      if (it && !this.paused) {
        const [sx, sy] = toS(it.x, it.y + Math.sin(this.time * 5) * 1.5);
        const s = Z * 1.5;
        ctx.fillStyle = '#ffcf5a';
        ctx.beginPath();
        ctx.moveTo(sx - s * 2, sy - s * 2);
        ctx.lineTo(sx + s * 2, sy - s * 2);
        ctx.lineTo(sx, sy);
        ctx.closePath();
        ctx.fill();
      }
    },
  };

  SV.Game = Game;

  // Start – stöd för att behålla spelläget när sidan uppdateras i en viewer.
  function boot(data) {
    Game.init(data || {});
  }
  window.addEventListener('DOMContentLoaded', () => {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) {
      try {
        hot.snapshot(() => ({ save: Game.started ? Game.serialize() : null, running: Game.started }));
      } catch (e) {
        /* ingen hot-reload */
      }
    }
    if (hot && hot.ready) hot.ready(boot);
    else boot((hot && hot.data) || {});
  });
})();
