// companions.js – modulärt djurkompis-system (GDD §4 och §5.1).
// Companion är basklassen (CompanionBase.gd); varje art ärver och
// överskuggar execute_super_ability() samt sina samarbetsförmågor.
(function () {
  'use strict';
  const SV = window.SV;
  const T = SV.TILE;

  const LEVEL_TITLES = ['Nyfiken hjälpare', 'Skogsväktare', 'Skogens Mästare'];
  const LEVEL_SCALE = [1, 1.17, 1.34];

  // ==================================================================
  // Basklass – motsvarar class_name Companion i GDD:n
  // ==================================================================
  class Companion extends SV.Emitter {
    constructor(kind) {
      super();
      this.kind = kind;
      this.companion_name = '';
      this.current_level = 1;
      this.current_xp = 0.0;
      this.xp_to_next_level = [100.0, 350.0, 0.0];
      this.is_super_available = false;
      this.super_meter = 0; // 0–100, laddas i strid när nivå 3 är nådd
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.dirX = 1;
      this.animT = Math.random() * 3;
      this.moving = false;
      this.task = null;
      this.action = null;
      this.coopCd = 0;
      this.speed = 74;
      this.bubble = null; // {text, t}
    }

    // ---------- GDD: erfarenhet och nivåer ----------
    add_xp(amount) {
      if (this.current_level >= 3) return;
      this.current_xp += amount;
      if (this.current_xp >= this.xp_to_next_level[this.current_level - 1]) this.level_up();
    }

    level_up() {
      if (this.current_level < 3) {
        this.current_level += 1;
        this.current_xp = 0.0;
        this.emit('level_changed', this.current_level);
        if (this.current_level === 3) {
          this.is_super_available = true;
          this.super_meter = 100;
          this.emit('super_ready');
        }
      }
    }

    trigger_super(game) {
      if (this.current_level === 3 && this.is_super_available) {
        if (!this.can_execute_super(game)) return false;
        this.execute_super_ability(game);
        this.is_super_available = false;
        this.super_meter = 0;
        return true;
      }
      return false;
    }

    // Mätaren för Superattacken: fylls av samarbete i strid.
    charge_super(amount) {
      if (this.current_level < 3 || this.is_super_available) return;
      this.super_meter = Math.min(100, this.super_meter + amount);
      if (this.super_meter >= 100) {
        this.is_super_available = true;
        this.emit('super_ready');
      }
    }

    // Överskuggas av specifika djurklasser
    execute_super_ability(game) {}
    can_execute_super(game) {
      return true;
    }

    // ---------- samarbetsförmågor ----------
    get info() {
      return COMPANION_INFO[this.kind];
    }
    get title() {
      return LEVEL_TITLES[this.current_level - 1];
    }
    get scale() {
      return LEVEL_SCALE[this.current_level - 1];
    }
    coop() {
      return this.info.coop[Math.min(this.current_level, 2) - 1];
    }
    use_coop(game) {
      if (this.coopCd > 0) return false;
      const c = this.coop();
      const ok = this.do_coop(game, c.id);
      if (ok !== false) {
        this.coopCd = c.cd;
        return true;
      }
      return false;
    }
    do_coop(game, id) {
      return false;
    }

    // ---------- passiva förmågor (överskuggas) ----------
    revealRadius() {
      return 8;
    }
    detectionMod() {
      return 1;
    }

    // ---------- rörelse ----------
    near(p, d) {
      return SV.dist(this.x, this.y, p.x, p.y) < d;
    }
    say(text, t = 1.2) {
      this.bubble = { text, t };
    }
    placeAt(x, y) {
      this.x = x;
      this.y = y;
    }

    update(dt, game) {
      this.animT += dt;
      this.coopCd = Math.max(0, this.coopCd - dt);
      if (this.bubble) {
        this.bubble.t -= dt;
        if (this.bubble.t <= 0) this.bubble = null;
      }
      if (this.action) {
        this.updateAction(dt, game);
        return;
      }
      this.think(dt, game);
      const p = game.player;
      let tx, ty, sp = this.speed;
      if (this.task) {
        tx = this.task.x;
        ty = this.task.y;
        this.task.timeout -= dt;
        if (SV.dist(this.x, this.y, tx, ty) < 5) {
          const t = this.task;
          this.task = null;
          t.onArrive && t.onArrive();
        } else if (this.task.timeout <= 0) this.task = null;
        sp *= 1.3;
      } else {
        // följ Signe en bit bakom
        const back = p.face + Math.PI;
        tx = p.x + Math.cos(back) * 20 + Math.cos(back + Math.PI / 2) * 6;
        ty = p.y + Math.sin(back) * 14;
      }
      const d = SV.dist(this.x, this.y, tx, ty);
      this.moving = d > 6;
      if (d > 220) {
        // tappat bort sig – hoppa fram till Signe
        this.x = p.x - 10;
        this.y = p.y + 4;
        game.addFx({ type: 'puff', x: this.x, y: this.y, life: 0.4, t: 0 });
      } else if (this.moving) {
        const k = Math.min(1, (d - 4) / 30);
        const vx = ((tx - this.x) / d) * sp * (0.4 + k * 0.9) * dt;
        const vy = ((ty - this.y) / d) * sp * (0.4 + k * 0.9) * dt;
        const opts = { flying: this.kind === 'owl', hiddenOpen: true };
        const hit = game.world.moveBody(this, vx, vy, 3, 2, opts);
        if (hit && d > 60) {
          // fastnat bakom ett hinder: smyg igenom snåren
          this.x += vx;
          this.y += vy;
        }
        if (Math.abs(tx - this.x) > 1) this.dirX = tx > this.x ? 1 : -1;
      }
    }
    think(dt, game) {}
    updateAction(dt, game) {
      this.action.t -= dt;
      if (this.action.update) this.action.update(dt);
      if (this.action.t <= 0) {
        const a = this.action;
        this.action = null;
        a.done && a.done();
      }
    }
  }

  // ==================================================================
  // 1. Hunden – beskydd och resurssökning
  // ==================================================================
  class DogCompanion extends Companion {
    constructor() {
      super('dog');
      this.companion_name = 'Hunden';
      this.barkCd = 0;
      this.sniff = 0;
      this.digging = 0;
    }
    sniffRadius() {
      return (this.current_level >= 2 ? 96 : 52) * (this.sniff > 0 ? 2.5 : 1);
    }
    think(dt, game) {
      this.barkCd = Math.max(0, this.barkCd - dt);
      this.sniff = Math.max(0, this.sniff - dt);
      if (this.task) return;
      const R = this.sniffRadius();
      const spot = game.world.buried.find((b) => !b.dug && SV.dist(b.x, b.y, this.x, this.y) < R && SV.dist(b.x, b.y, game.player.x, game.player.y) < R + 40);
      if (spot) {
        spot.marked = 4;
        this.task = {
          x: spot.x,
          y: spot.y,
          timeout: 5,
          onArrive: () => {
            this.action = {
              t: 0.8,
              update: () => {
                if (Math.random() < 0.3) game.addFx({ type: 'dirt', x: this.x, y: this.y, life: 0.4, t: 0 });
              },
              done: () => {
                spot.dug = true;
                game.spawnLoot(spot.x, spot.y, { scrap: 2 + Math.floor(Math.random() * 3) });
                game.companions.addXp(6);
                this.say('Voff!');
              },
            };
          },
        };
      }
      // Hittar även begravda kristaller.
      game.world.crystals.forEach((c) => {
        if (c.buried && !c.taken && SV.dist(c.x, c.y, this.x, this.y) < R) {
          c.buried = false;
          c.seen = true;
          this.say('Voff! Voff!', 2);
          game.toast('Hunden grävde fram en dold energikristall!');
          game.addFx({ type: 'dirt', x: c.x, y: c.y, life: 0.6, t: 0 });
        }
      });
    }
    // Nivå 1: skäller när fiender närmar sig
    onRobotAlert(robot, game) {
      if (this.barkCd > 0) return;
      this.barkCd = 5;
      this.say('Voff!');
      SV.Sfx.play('bark');
    }
    do_coop(game, id) {
      if (id === 'sniff') {
        this.sniff = 7;
        this.say('*nosar*', 1.5);
        game.addFx({ type: 'ring', x: this.x, y: this.y, r0: 4, r1: this.sniffRadius(), life: 0.6, t: 0, col: '#ffd25e' });
        return true;
      }
      if (id === 'distract') {
        const target = nearestRobot(game, this.x, this.y, 170);
        if (!target) {
          game.toast('Ingen robot att distrahera i närheten.');
          return false;
        }
        target.distract = { target: this, t: 5 };
        target.setState('chase');
        SV.Sfx.play('bark');
        this.say('VOFF!', 2);
        game.addFx({ type: 'ring', x: this.x, y: this.y - 6, r0: 2, r1: 26, life: 0.4, t: 0, col: '#ffd25e' });
        // springer i en cirkel bort från Signe
        const a0 = Math.atan2(target.y - this.y, target.x - this.x) + Math.PI;
        let ang = a0;
        this.action = {
          t: 5,
          update: (dt) => {
            ang += dt * 1.4;
            const cx = game.player.x + Math.cos(a0) * 50, cy = game.player.y + Math.sin(a0) * 50;
            const tx = cx + Math.cos(ang) * 30, ty = cy + Math.sin(ang) * 30;
            const d = SV.dist(this.x, this.y, tx, ty) || 1;
            game.world.moveBody(this, ((tx - this.x) / d) * 95 * dt, ((ty - this.y) / d) * 95 * dt, 3, 2, { hiddenOpen: true });
            this.dirX = tx > this.x ? 1 : -1;
            this.moving = true;
          },
        };
        return true;
      }
      return false;
    }
    // Superattack: Sköldskall (GDD DogCompanion.gd)
    execute_super_ability(game) {
      game.toast('Sköldskall! Sonisk chockvåg utlöses.');
      SV.Sfx.play('bark');
      SV.Sfx.play('super');
      game.shake(6);
      game.addFx({ type: 'ring', x: this.x, y: this.y - 6, r0: 4, r1: 120, life: 0.7, t: 0, col: '#ffd25e', thick: 3 });
      game.addFx({ type: 'ring', x: this.x, y: this.y - 6, r0: 4, r1: 90, life: 0.5, t: 0, col: '#fff2b0' });
      const targets = game.robots; // get_nodes_in_group("robots")
      for (const robot of targets) {
        if (robot.active && SV.dist(this.x, this.y, robot.x, robot.y) < 120.0) robot.apply_stun(4.0);
      }
      // Ge Signe energisköld
      const player = game.player; // get_first_node_in_group("player")
      if (player) player.apply_energy_shield(2);
    }
  }

  // ==================================================================
  // 2. Lodjuret – agilitet och överraskningsattacker
  // ==================================================================
  class LynxCompanion extends Companion {
    constructor() {
      super('lynx');
      this.companion_name = 'Lodjuret';
      this.speed = 82;
      this.stealth = 0;
    }
    think(dt) {
      this.stealth = Math.max(0, this.stealth - dt);
    }
    detectionMod() {
      let m = this.current_level >= 2 ? 0.75 : 1; // tystare steg
      if (this.stealth > 0) m *= 0.35;
      return m;
    }
    do_coop(game, id) {
      this.stealth = id === 'stealth2' ? 8 : 5;
      this.say('*smyger*', 1.5);
      game.toast('Smyg! Robotarna har svårt att upptäcka er.');
      game.robots.forEach((r) => {
        if (r.active && r.state === 'chase' && SV.dist(r.x, r.y, game.player.x, game.player.y) > 40) r.setState('patrol');
      });
      return true;
    }
    can_execute_super(game) {
      if (!strongestRobot(game, 220)) {
        game.toast('Skugghopp behöver en robot i närheten.');
        return false;
      }
      return true;
    }
    // Superattack: Skugghopp – slår ut minneskretsarna på den starkaste roboten
    execute_super_ability(game) {
      const target = strongestRobot(game, 220);
      const sx = this.x, sy = this.y;
      SV.Sfx.play('super');
      game.toast('Skugghopp! Lodjuret slår ut minneskretsarna.');
      this.action = {
        t: 0.55,
        update: () => {
          const k = 1 - this.action.t / 0.55;
          this.x = SV.lerp(sx, target.x, k);
          this.y = SV.lerp(sy, target.y, k);
          this.z = Math.sin(k * Math.PI) * 40;
          this.dirX = target.x > sx ? 1 : -1;
        },
        done: () => {
          this.z = 0;
          game.shake(5);
          game.addFx({ type: 'ring', x: target.x, y: target.y - 6, r0: 2, r1: 30, life: 0.4, t: 0, col: '#c9a6ff' });
          game.floater(target.x, target.y - 26, 'Minne raderat!', '#e0c8ff');
          target.disable(game);
        },
      };
    }
  }

  // ==================================================================
  // 3. Ugglan – rekognosering och synfält
  // ==================================================================
  class OwlCompanion extends Companion {
    constructor() {
      super('owl');
      this.companion_name = 'Ugglan';
      this.speed = 90;
    }
    revealRadius() {
      return this.current_level >= 2 ? 13 : 11.5;
    }
    update(dt, game) {
      super.update(dt, game);
      if (!this.action) this.z = 14 + Math.sin(this.animT * 3) * 2;
    }
    do_coop(game, id) {
      const R = id === 'scout2' ? 26 : 17;
      const n = game.world.reveal(game.player.x, game.player.y, R);
      game.onReveal(n, true);
      game.world.crystals.forEach((c) => {
        if (!c.taken && SV.dist(c.x, c.y, game.player.x, game.player.y) < R * T * 1.3) {
          c.seen = true;
          c.ping = 6;
        }
      });
      this.say('Hoo-hoo!', 1.5);
      game.addFx({ type: 'ring', x: game.player.x, y: game.player.y, r0: 10, r1: R * T, life: 0.9, t: 0, col: '#ffe6a8' });
      return true;
    }
    // Superattack: Bländande Vingslag
    execute_super_ability(game) {
      SV.Sfx.play('super');
      game.toast('Bländande Vingslag! Robotarnas sensorer är utslagna.');
      game.screenFlash = 0.9;
      game.robots.forEach((r) => {
        if (r.active && SV.dist(r.x, r.y, game.player.x, game.player.y) < 230) {
          r.blind = 7;
          r.apply_stun(1.2);
          if (r.state === 'chase' || r.state === 'alert') r.setState('patrol');
        }
      });
      game.addFx({ type: 'ring', x: this.x, y: this.y - this.z, r0: 4, r1: 200, life: 0.8, t: 0, col: '#fff8d8', thick: 4 });
    }
  }

  // ==================================================================
  // 4. Älgen – tunga hinder och terrängpåverkan
  // ==================================================================
  class MooseCompanion extends Companion {
    constructor() {
      super('moose');
      this.companion_name = 'Älgen';
      this.speed = 64;
    }
    do_coop(game, id) {
      let pushed = 0;
      game.robots.forEach((r) => {
        if (!r.active) return;
        const d = SV.dist(r.x, r.y, game.player.x, game.player.y);
        if (d < 48) {
          const a = Math.atan2(r.y - game.player.y, r.x - game.player.x);
          r.knock.x = Math.cos(a) * 260;
          r.knock.y = Math.sin(a) * 260;
          r.apply_stun(1);
          pushed++;
        }
      });
      let cleared = 0;
      if (id === 'push2') cleared = game.clearLogsNear(game.player.x, game.player.y, 2.6);
      game.addFx({ type: 'ring', x: this.x, y: this.y - 6, r0: 4, r1: 48, life: 0.35, t: 0, col: '#e8d6a6' });
      SV.Sfx.play('emp');
      game.shake(3);
      if (cleared) {
        game.toast('Älgen knuffade undan stockarna!');
        game.companions.addXp(40);
      } else if (!pushed) this.say('*frustar*', 1);
      return true;
    }
    // Superattack: Urkraftens Rusning
    execute_super_ability(game) {
      const p = game.player;
      const a = p.face;
      const sx = p.x, sy = p.y;
      const len = 170;
      this.x = sx;
      this.y = sy;
      SV.Sfx.play('super');
      game.toast('Urkraftens Rusning!');
      const hitSet = new Set();
      this.action = {
        t: 0.75,
        update: () => {
          const k = 1 - this.action.t / 0.75;
          this.x = sx + Math.cos(a) * len * k;
          this.y = sy + Math.sin(a) * len * k;
          this.dirX = Math.cos(a) >= 0 ? 1 : -1;
          this.moving = true;
          game.addFx({ type: 'dirt', x: this.x, y: this.y, life: 0.4, t: 0 });
          game.shake(2);
          game.robots.forEach((r) => {
            if (!r.active || hitSet.has(r)) return;
            if (SV.dist(r.x, r.y, this.x, this.y) < 22) {
              hitSet.add(r);
              r.knock.x = Math.cos(a) * 300;
              r.knock.y = Math.sin(a) * 300;
              r.apply_stun(r.type === 'bear' ? 4 : 3);
              r.takeDamage(30, 'impact', game, this);
            }
          });
          game.smashObstaclesAt(this.x, this.y);
        },
        done: () => {
          // ställ tillbaka älgen på fri mark
          if (game.world.isSolidPx(this.x, this.y)) {
            this.x = p.x;
            this.y = p.y + 6;
          }
        },
      };
    }
  }

  // ==================================================================
  // 5. Räven – sensorstörning och stöld
  // ==================================================================
  class FoxCompanion extends Companion {
    constructor() {
      super('fox');
      this.companion_name = 'Räven';
      this.speed = 88;
    }
    think(dt, game) {
      // Nivå 1: samlar automatiskt upp skrot som tappats på marken.
      if (this.task) return;
      const pk = game.pickups.find((k) => !k.claimed && k.age > 0.5 && SV.dist(k.x, k.y, this.x, this.y) < 100);
      if (pk) {
        pk.claimed = true;
        this.task = {
          x: pk.x,
          y: pk.y,
          timeout: 3,
          onArrive: () => game.collectPickup(pk, true),
        };
      }
    }
    do_coop(game, id) {
      if (id === 'fetch') {
        let n = 0;
        game.pickups.slice().forEach((k) => {
          if (SV.dist(k.x, k.y, game.player.x, game.player.y) < 200) {
            game.collectPickup(k, true);
            n++;
          }
        });
        this.say(n ? 'Hämtat!' : '*sniffar*', 1.2);
        game.addFx({ type: 'ring', x: this.x, y: this.y - 4, r0: 4, r1: 40, life: 0.3, t: 0, col: '#ff9a4a' });
        return true;
      }
      // Nivå 2: elektronisk skenbild
      game.decoy = { x: game.player.x, y: game.player.y + 2, t: 6, isDecoy: true };
      game.robots.forEach((r) => {
        if (r.active && SV.dist(r.x, r.y, game.decoy.x, game.decoy.y) < 170 && r.state !== 'disabled') {
          r.distract = { target: game.decoy, t: 6 };
          if (r.state === 'patrol') r.setState('chase');
        }
      });
      this.say('*fniss*', 1.2);
      game.toast('Skenbild utplacerad – robotarna luras!');
      return true;
    }
    can_execute_super(game) {
      if (!nearestRobot(game, game.player.x, game.player.y, 180)) {
        game.toast('Kretskupp behöver en robot i närheten.');
        return false;
      }
      return true;
    }
    // Superattack: Kretskupp
    execute_super_ability(game) {
      const target = nearestRobot(game, game.player.x, game.player.y, 180);
      const sx = this.x, sy = this.y;
      SV.Sfx.play('super');
      game.toast('Kretskupp! Räven knycker batteriet.');
      this.action = {
        t: 0.5,
        update: () => {
          const k = 1 - this.action.t / 0.5;
          this.x = SV.lerp(sx, target.x, k);
          this.y = SV.lerp(sy, target.y, k);
          this.dirX = target.x > sx ? 1 : -1;
          this.moving = true;
        },
        done: () => {
          game.floater(target.x, target.y - 26, 'Strömlös!', '#ffcf5a');
          target.disable(game, { doubleLoot: true });
        },
      };
    }
  }

  // ==================================================================
  // 6. Bävern – terrängmodifiering och vattenteknik
  // ==================================================================
  class BeaverCompanion extends Companion {
    constructor() {
      super('beaver');
      this.companion_name = 'Bävern';
      this.speed = 66;
    }
    do_coop(game, id) {
      if (id === 'build') {
        const site = game.nearBridgeSite(48);
        if (site) {
          game.buildBridge(site);
          return true;
        }
      }
      // Plask: blöta robotar kortsluts lättare
      const R = id === 'build' ? 64 : 52;
      let n = 0;
      game.robots.forEach((r) => {
        if (r.active && SV.dist(r.x, r.y, game.player.x, game.player.y) < R) {
          r.wet = 6;
          r.chill += 1;
          n++;
        }
      });
      game.addFx({ type: 'splash', x: game.player.x, y: game.player.y, r: R, life: 0.5, t: 0 });
      SV.Sfx.play('frost');
      this.say(n ? 'Plask!' : '*plask*', 1);
      if (n) game.toast('Robotarna är blöta – El-staven gör extra skada!');
      return true;
    }
    // Superattack: Översvämning
    execute_super_ability(game) {
      SV.Sfx.play('super');
      game.toast('Översvämning! Vattenvågen kortsluter robotarna.');
      game.shake(6);
      game.addFx({ type: 'splash', x: game.player.x, y: game.player.y, r: 190, life: 1.1, t: 0, big: true });
      game.robots.forEach((r) => {
        if (r.active && SV.dist(r.x, r.y, game.player.x, game.player.y) < 190) {
          r.wet = 8;
          r.apply_stun(3);
          r.takeDamage(25, 'shock', game, game.player);
        }
      });
      game.damageBarricadesNear(game.player.x, game.player.y, 190, 99);
    }
  }

  // ------------------------------------------------------------------
  function nearestRobot(game, x, y, maxD, filter) {
    let best = null, bd = maxD;
    game.robots.forEach((r) => {
      if (!r.active || (filter && !filter(r))) return;
      const d = SV.dist(x, y, r.x, r.y);
      if (d < bd) {
        bd = d;
        best = r;
      }
    });
    return best;
  }
  function strongestRobot(game, maxD) {
    let best = null;
    game.robots.forEach((r) => {
      if (!r.active || SV.dist(game.player.x, game.player.y, r.x, r.y) > maxD) return;
      if (!best || r.maxHp > best.maxHp || (r.maxHp === best.maxHp && r.hp > best.hp)) best = r;
    });
    return best;
  }

  // ------------------------------------------------------------------
  // Beskrivningar (texten följer GDD:ns djurgalleri)
  // ------------------------------------------------------------------
  const COMPANION_INFO = {
    dog: {
      name: 'Hunden', trait: 'Modig & lojal', focus: 'Beskydd och resurssökning',
      levels: ['Hittar dolt skrot i marken nära er. Skäller när fiender närmar sig.', 'Större sökradie. Kan distrahera en robot genom att skälla.', 'Låser upp Superattacken Sköldskall.'],
      coop: [{ id: 'sniff', name: 'Nosa', cd: 9, desc: 'Söker av ett stort område efter begravt skrot.' }, { id: 'distract', name: 'Distrahera', cd: 12, desc: 'Skäller och lockar till sig en robot i 5 sekunder.' }],
      super: { name: 'Sköldskall', desc: 'Sonisk chockvåg i 360°: alla robotar i närheten paralyseras i 4 s och Signe får en sköld som tål 2 träffar.' },
    },
    lynx: {
      name: 'Lodjuret', trait: 'Smygande & snabb', focus: 'Agilitet och överraskningsattacker',
      levels: ['Avslöjar dolda stigar genom täta snår.', 'Minskar hela gruppens stegljud (robotar ser er sämre).', 'Låser upp Superattacken Skugghopp.'],
      coop: [{ id: 'stealth', name: 'Smyg', cd: 14, desc: 'I 5 s ser robotarna er knappt.' }, { id: 'stealth2', name: 'Skuggsmyg', cd: 12, desc: 'I 8 s ser robotarna er knappt.' }],
      super: { name: 'Skugghopp', desc: 'Lodjuret hoppar från trädkronorna och slår ut minneskretsarna på den starkaste roboten i området.' },
    },
    owl: {
      name: 'Ugglan', trait: 'Vis & klarsynt', focus: 'Rekognosering och synfält',
      levels: ['Skingrar dimman i en större radie runt Signe.', 'Markerar energikristaller och kistor på minikartan.', 'Låser upp Superattacken Bländande Vingslag.'],
      coop: [{ id: 'scout', name: 'Spana', cd: 15, desc: 'Lyfter dimman långt bort och pekar ut kristaller.' }, { id: 'scout2', name: 'Högspaning', cd: 15, desc: 'Lyfter dimman ännu längre bort.' }],
      super: { name: 'Bländande Vingslag', desc: 'Ett intensivt ljus bländar alla robotars optiska sensorer och strålkastare.' },
    },
    moose: {
      name: 'Älgen', trait: 'Kraftfull & lugn', focus: 'Tunga hinder och terräng',
      levels: ['Signe tar sig fram i snö och gyttja utan att sakta in.', 'Knuffar undan fallna träd och mindre blockader.', 'Låser upp Superattacken Urkraftens Rusning.'],
      coop: [{ id: 'push', name: 'Knuff', cd: 8, desc: 'Knuffar undan robotar runt Signe.' }, { id: 'push2', name: 'Stockknuff', cd: 8, desc: 'Knuffar robotar och fallna stockar ur vägen.' }],
      super: { name: 'Urkraftens Rusning', desc: 'Älgen rusar framåt och plöjer igenom hinder och barrikader och slår omkull tunga björnrobotar.' },
    },
    fox: {
      name: 'Räven', trait: 'Listig & teknisk', focus: 'Sensorstörning och stöld',
      levels: ['Samlar automatiskt upp skrot som tappats på marken.', 'Kan placera ut en elektronisk skenbild som lurar patrullerna.', 'Låser upp Superattacken Kretskupp.'],
      coop: [{ id: 'fetch', name: 'Hämta', cd: 8, desc: 'Hämtar allt skrot i närheten.' }, { id: 'decoy', name: 'Skenbild', cd: 12, desc: 'En elektronisk skenbild lockar robotarna i 6 s.' }],
      super: { name: 'Kretskupp', desc: 'Räven smyger fram och knycker en robots batteri – roboten blir strömlös och tappar dubbelt skrot.' },
    },
    beaver: {
      name: 'Bävern', trait: 'Byggare & vattenexpert', focus: 'Terräng och vattenteknik',
      levels: ['Signe korsar grunt vatten utan att frysa eller sakta in.', 'Bygger träbroar där brostolparna står.', 'Låser upp Superattacken Översvämning.'],
      coop: [{ id: 'splash', name: 'Plask', cd: 6, desc: 'Blöter ner robotar – El-staven gör 50 % mer skada.' }, { id: 'build', name: 'Bygg / Plask', cd: 6, desc: 'Bygger bro vid brostolpar, annars Plask.' }],
      super: { name: 'Översvämning', desc: 'En vattenvåg sköljer över stridsfältet och kortsluter robotar och el-barrikader.' },
    },
  };

  const CLASSES = { dog: DogCompanion, lynx: LynxCompanion, owl: OwlCompanion, moose: MooseCompanion, fox: FoxCompanion, beaver: BeaverCompanion };
  const ORDER = ['dog', 'fox', 'beaver', 'lynx', 'moose', 'owl'];

  // ==================================================================
  // CompanionManager – fristående nod som håller i följet
  // ==================================================================
  class CompanionManager extends SV.Emitter {
    constructor(game) {
      super();
      this.game = game;
      this.roster = {};
      this.unlocked = [];
      this.activeKind = null;
    }
    create(kind) {
      const c = new CLASSES[kind]();
      c.on('level_changed', (lvl) => this.emit('level_changed', c, lvl));
      c.on('super_ready', () => this.emit('super_ready', c));
      this.roster[kind] = c;
      return c;
    }
    unlock(kind, makeActive = true) {
      if (!this.roster[kind]) this.create(kind);
      if (!this.unlocked.includes(kind)) this.unlocked.push(kind);
      this.unlocked.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      if (makeActive) this.setActive(kind);
    }
    setActive(kind) {
      if (!this.unlocked.includes(kind)) return;
      const p = this.game.player;
      const prev = this.active;
      this.activeKind = kind;
      const c = this.active;
      c.task = null;
      c.action = null;
      c.z = 0;
      c.placeAt(p.x - 12, p.y + 4);
      if (prev && prev !== c) this.parkAtBase(prev);
      this.emit('changed', c);
    }
    cycle() {
      if (this.unlocked.length < 2) return;
      const i = this.unlocked.indexOf(this.activeKind);
      this.setActive(this.unlocked[(i + 1) % this.unlocked.length]);
    }
    parkAtBase(c) {
      const i = ORDER.indexOf(c.kind);
      const w = this.game.world;
      const a = (i / ORDER.length) * Math.PI * 2;
      c.placeAt(w.campfire.x + Math.cos(a) * 26, w.campfire.y + Math.sin(a) * 16 + 4);
      c.task = null;
      c.action = null;
      c.z = 0;
    }
    get active() {
      return this.activeKind ? this.roster[this.activeKind] : null;
    }
    update(dt) {
      const c = this.active;
      if (c) c.update(dt, this.game);
      // vilande djur nosar runt vid lägerelden
      this.unlocked.forEach((k) => {
        if (k === this.activeKind) return;
        const r = this.roster[k];
        r.animT += dt;
        r.coopCd = Math.max(0, r.coopCd - dt);
        r.moving = false;
        if (r.kind === 'owl') r.z = 2;
      });
    }
    addXp(n) {
      const c = this.active;
      if (c) c.add_xp(n);
    }
    chargeSuper(n) {
      const c = this.active;
      if (c) c.charge_super(n);
    }
    hiddenPathsOpen() {
      return this.activeKind === 'lynx';
    }
    revealRadius() {
      const c = this.active;
      return c ? c.revealRadius() : 8;
    }
    detectionMod() {
      const c = this.active;
      return c ? c.detectionMod() : 1;
    }
    onRobotAlert(robot) {
      const c = this.active;
      if (c && c.onRobotAlert && SV.dist(robot.x, robot.y, this.game.player.x, this.game.player.y) < 160) c.onRobotAlert(robot, this.game);
    }
    serialize() {
      const out = { active: this.activeKind, list: {} };
      this.unlocked.forEach((k) => {
        const c = this.roster[k];
        out.list[k] = { lvl: c.current_level, xp: c.current_xp, sup: c.is_super_available, meter: c.super_meter };
      });
      return out;
    }
    load(data) {
      if (!data) return;
      Object.entries(data.list || {}).forEach(([k, v]) => {
        this.unlock(k, false);
        const c = this.roster[k];
        c.current_level = v.lvl;
        c.current_xp = v.xp;
        c.is_super_available = v.sup;
        c.super_meter = v.meter;
      });
      if (data.active) this.setActive(data.active);
      this.unlocked.forEach((k) => k !== this.activeKind && this.parkAtBase(this.roster[k]));
    }
  }

  SV.Companion = Companion;
  SV.Companions = CLASSES;
  SV.COMPANION_INFO = COMPANION_INFO;
  SV.COMPANION_ORDER = ORDER;
  SV.LEVEL_TITLES = LEVEL_TITLES;
  SV.CompanionManager = CompanionManager;
})();
