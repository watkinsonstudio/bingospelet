// game.js – spelloop och spelregler. Scenstrukturen följer GDD §6:
// Player, CompanionManager och EnvironmentController är fristående delar som
// Game knyter ihop. All grafik ligger i js3d/ (SV.View), så logiken kan
// flyttas till en annan motor eller plattform utan att skrivas om.
(function () {
  'use strict';
  const SV = window.SV;
  const T = SV.TILE;
  const G = SV.G, B = SV.B;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'signe-skogens-vaktare-3d-v1';

  const Game = {
    CRYSTALS_NEEDED: 8,
    dt: 0,
    time: 0,
    paused: true,
    started: false,
    camYaw: Math.PI / 4, // isometrisk kameravinkel (sätts av vyn)

    // ================================================================
    // Uppstart
    // ================================================================
    init(hotData) {
      this.canvas = $('view');
      SV.UI.init(this);
      SV.Input.init(this.canvas);
      SV.Input.onFirstInteraction = () => SV.Sfx.unlock();
      SV.Input.onDeviceChange = () => SV.UI.refreshPrompts();

      const save = (hotData && hotData.save) || SV.store.get(SAVE_KEY);
      this.newState(null);
      SV.View.init(this, this.canvas);
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
      SV.UI.focusPanel($('panel-title'));
      if (hotData && hotData.save && hotData.running) this.startGame(hotData.save);

      this.last = performance.now();
      const loop = (now) => {
        this.dt = Math.min(0.05, Math.max(0, now - this.last) / 1000);
        this.last = now;
        this.frame();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    // Skärmriktning (upp = bort från kameran) → riktning i världen.
    toWorldDir(sx, sy) {
      const c = Math.cos(this.camYaw), s = Math.sin(this.camYaw);
      return [c * sx + s * sy, -s * sx + c * sy];
    },

    newState(save) {
      this.world = new SV.World();
      this.env = new SV.EnvironmentController();
      this.env.storm_intensity = 0.3;
      this.env.visual = 0.3;
      this.env._updateEnvironment();
      const sp = this.world.spawn;
      this.player = new SV.Player(sp.x, sp.y);
      this.player.face = -Math.PI * 0.75;
      this.companions = new SV.CompanionManager(this);
      this.companions.on('level_changed', (c, lvl) => {
        SV.Sfx.play('level');
        SV.UI.banner(c.companion_name.toUpperCase() + ' NÅR NIVÅ ' + lvl, SV.LEVEL_TITLES[lvl - 1]);
        this.addFx({ type: 'ring', x: c.x, y: c.y, r0: 2, r1: 30, life: 0.6, t: 0, col: lvl === 3 ? '#ffd25e' : '#8fcf6a', thick: 2 });
      });
      this.companions.on('super_ready', (c) => SV.UI.toast(`${c.info.super.name} är redo! Tryck ${SV.Input.label('super')}.`));
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
      this.inGrotto = false;
      this.stats = { robots: 0, start: Date.now() };
      this.hiddenBonus = false;
      this.reinforceToast = false;
      this.env.on('lightning', (x, y) => this.onLightning(x, y));
      if (save) this.applySave(save);
      this.player.setArmor(this.player.armor);
      this.world.reveal(this.player.x, this.player.y, this.companions.revealRadius());
      this.computeTileColors();
      this.rebuildMinimap();
      if (SV.View && SV.View.ready) SV.View.onNewState(this);
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
        setTimeout(() => this.say(this.player.x, this.player.y, '<b>Signe:</b> Tidsstormen laddar upp sig över skogen. Hunden och jag måste hitta energikristallerna i grottorna innan den växer sig för stark. Smedjan här i Skogsbasen hjälper mig rusta upp.'), 1600);
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
      In.poll();
      this.handleMenuKeys();
      SV.UI.navigate();
      this.time += this.dt;
      if (!this.paused) this.update(this.dt);
      else this.env.update(this.dt, this.player);
      SV.View.render(this, this.dt);
      In.endFrame();
    },

    handleMenuKeys() {
      const In = SV.Input;
      const open = (id) => !$(id).hidden;
      const back = In.pressed('ui_back'), menu = In.pressed('menu');
      if (!back && !menu && !In.pressed('map')) return;
      if (open('panel-confirm')) {
        if (back || menu) $('panel-confirm').hidden = true;
      } else if (open('panel-forge')) {
        if (back || menu) SV.Forge.close();
      } else if (open('panel-menu')) {
        if (back || menu) SV.UI.closeMenu();
      } else if (open('panel-win')) {
        if (back || menu) $('btn-win-close').click();
      } else if (this.started) {
        if (SV.UI.dialogOpen && (back || menu)) SV.UI.closeDialog();
        else if (menu) SV.UI.openMenu();
        else if (In.pressed('map')) SV.UI.openMenu('map');
      }
    },

    update(dt) {
      const In = SV.Input;
      const p = this.player;
      this.env.update(dt, p);

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

      // Kristallgrottorna: lila ljus och närmare kamera inne i grottan.
      const cave = this.world.inGrotto(p.x, p.y);
      if (cave !== this.inGrotto) {
        this.inGrotto = cave;
        if (cave) {
          const g = this.world.grottos.find((q) => Math.hypot(q.x + 0.5 - p.x / T, q.y + 0.5 - p.y / T) < q.r + 3);
          if (g && !g.visited) {
            g.visited = true;
            SV.UI.banner('DU HAR HITTAT', 'En kristallgrotta');
            SV.Sfx.play('crystal');
          }
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
          this.floater(p.x, p.y, '+1', '#5ef59a');
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
      this.fogDirty = true;
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
      this.addFx({ type: 'ring', x: cr.x, y: cr.y, r0: 2, r1: 46, life: 0.7, t: 0, col: '#7ff3ff', thick: 2 });
      this.addFx({ type: 'sparks', x: cr.x, y: cr.y, life: 0.8, t: 0, n: 18, col: '#b6f7ff' });
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
      if (SV.View.snapCamera) SV.View.snapCamera();
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
      if (near(w.forgePos.x, w.forgePos.y, 30)) return { label: 'Smedja', x: w.forgePos.x, y: w.forgePos.y, action: () => SV.Forge.open(this) };
      for (const a of w.animals) if (!a.met && near(a.x, a.y, 26)) return { label: 'Bli vän', x: a.x, y: a.y, action: () => this.befriend(a) };
      for (const k of w.chests) if (!k.open && near(k.x, k.y, 22)) return { label: 'Öppna', x: k.x, y: k.y, action: () => this.openChest(k) };
      for (const r of w.runestones) if (near(r.x, r.y, 24)) return { label: 'Läs', x: r.x, y: r.y, action: () => this.readRune(r) };
      if (near(w.core.x, w.core.y, 46)) return { label: this.won ? 'Urkärnan' : 'Väck kärnan', x: w.core.x, y: w.core.y, action: () => this.activateCore() };
      for (const site of Object.values(w.bridgeSites)) {
        if (site.built) continue;
        const sx = (site.post[0] + 0.5) * T, sy = (site.post[1] + 0.5) * T;
        if (near(sx, sy, 34)) return { label: 'Bygg bro', x: sx, y: sy, action: () => this.tryBridge(site) };
      }
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const bt = w.b(tx + i, ty + j);
          const cx = (tx + i + 0.5) * T, cy = (ty + j + 0.5) * T;
          if (bt === B.LOG && near(cx, cy, 22))
            return {
              label: 'Stock', x: cx, y: cy,
              action: () => this.say(cx, cy, 'Tunga fallna stockar. <b>Älgen</b> på nivå 2 kan knuffa undan dem med sin Stockknuff, och Urkraftens Rusning plöjer rakt igenom.'),
            };
          if (bt === B.BARRICADE && near(cx, cy, 22))
            return {
              label: 'Barrikad', x: cx, y: cy,
              action: () => this.say(cx, cy, `En el-barrikad (${w.blockHp[tx + i + ',' + (ty + j)] || 0} laddningar kvar). Håll in elhugget för en <b>EMP</b>, eller låt Älgens rusning eller Bäverns översvämning kortsluta den.`),
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
      this.addFx({ type: 'ring', x: a.x, y: a.y, r0: 2, r1: 28, life: 0.6, t: 0, col: '#8fcf6a', thick: 2 });
      this.say(a.x, a.y, `<b>${info.name}</b> (${info.trait.toLowerCase()}) följer nu med dig. ${info.levels[0]} <br>Samarbete: <b>${info.coop[0].name}</b>. De andra djuren väntar vid lägerelden – byt genom att trycka på djurkortet.`);
    },

    openChest(k) {
      k.open = true;
      SV.Sfx.play('pickup');
      this.spawnLoot(k.x, k.y, { scrap: 6 + Math.floor(Math.random() * 6), chips: 1 + Math.floor(Math.random() * 2), berry: 1 });
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
      this.addFx({ type: 'ring', x: w.core.x, y: w.core.y, r0: 10, r1: 260, life: 2, t: 0, col: '#b6f7ff', thick: 4 });
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
        this.floater(p.x, p.y, '+1 krets', '#8fef8a');
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
            if (SV.dist(pr.x, pr.y, r.x, r.y) < r.r + 4) {
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
        if (!this.playerDown && SV.dist(pr.x, pr.y, p.x, p.y) < 7) {
          p.hurt(pr.dmg, this, { x: pr.x, y: pr.y });
          return false;
        }
        if (this.decoy && SV.dist(pr.x, pr.y, this.decoy.x, this.decoy.y) < 8) return false;
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
      if (!this.miniBase) {
        this.miniBase = document.createElement('canvas');
        this.miniBase.width = w.W;
        this.miniBase.height = w.H;
      }
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
  };

  SV.Game = Game;

  // Startas av js3d/main.js när 3D-motorn har laddats. Behåller spelläget
  // om sidan uppdateras i en viewer som stöder det.
  SV.bootGame = function () {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) {
      try {
        hot.snapshot(() => ({ save: Game.started ? Game.serialize() : null, running: Game.started }));
      } catch (e) {
        /* ingen hot-reload */
      }
    }
    const boot = (data) => Game.init(data || {});
    if (hot && hot.ready) hot.ready(boot);
    else boot((hot && hot.data) || {});
  };
})();
