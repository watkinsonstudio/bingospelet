// world.js – kartgenerering (Mossdalen, Järnforsen, Dimkronorna, Urkärnan),
// kristallgrottor, terräng, kollision och utforskning. Ingen grafik här:
// 3D-vyn läser ground/block-rutnätet och lyssnar på onChange.
(function () {
  'use strict';
  const SV = window.SV;
  const T = SV.TILE;

  const G = { GRASS: 0, MOSS: 1, DARK: 2, SNOW: 3, DIRT: 4, MUD: 5, SHALLOW: 6, DEEP: 7, BRIDGE: 8, FLOOR: 9, SITE: 10, THICKET: 11, HIDDEN: 12, CAVE: 13 };
  const B = {
    NONE: 0, PINE: 1, PINE_SNOW: 2, SPRUCE: 3, BIRCH: 4, ROCK: 5, ROCK_MOSS: 6, RUIN: 7, LOG: 8, BARRICADE: 9,
    SCRAPHEAP: 10, RUNESTONE: 11, PYLON: 12, PART: 13, CAMPFIRE: 14, SPRUCE_DARK: 15, CAVEWALL: 16,
  };
  const D = { NONE: 0, FLOWER_W: 1, FLOWER_Y: 2, FLOWER_B: 3, MUSHROOM: 4, TUFT: 5, PEBBLE: 6, BERRY: 7, BOLT: 8, LICHEN: 9, CABLE: 10 };

  const SECTORS = [
    { id: 'dim', name: 'Dimkronorna', y0: 0, y1: 44 },
    { id: 'jarn', name: 'Järnforsen', y0: 44, y1: 86 },
    { id: 'moss', name: 'Mossdalen', y0: 86, y1: 999 },
  ];

  const W = 96, H = 128;

  class World {
    constructor(seed = 20261023) {
      this.W = W;
      this.H = H;
      this.seed = seed;
      this.ground = new Uint8Array(W * H);
      this.block = new Uint8Array(W * H);
      this.deco = new Uint8Array(W * H);
      this.variant = new Uint8Array(W * H);
      this.revealed = new Uint8Array(W * H);
      this.blockHp = {}; // barrikader
      this.scrapHeapUsed = {};
      this.big = []; // stora objekt: {kind, x, y, w, h}
      this.crystals = [];
      this.chests = [];
      this.animals = [];
      this.runestones = [];
      this.buried = [];
      this.spawns = [];
      this.bridgeSites = {};
      this.grottos = [];
      this.onChange = null;
      this.changes = [];
      this.generate();
    }

    idx(x, y) {
      return y * W + x;
    }
    inBounds(x, y) {
      return x >= 0 && y >= 0 && x < W && y < H;
    }
    g(x, y) {
      return this.inBounds(x, y) ? this.ground[y * W + x] : G.DEEP;
    }
    b(x, y) {
      return this.inBounds(x, y) ? this.block[y * W + x] : B.ROCK;
    }
    setG(x, y, v) {
      if (this.inBounds(x, y)) this.ground[y * W + x] = v;
    }
    setB(x, y, v) {
      if (this.inBounds(x, y)) this.block[y * W + x] = v;
    }
    sectorAt(ty) {
      return SECTORS.find((s) => ty >= s.y0 && ty < s.y1) || SECTORS[2];
    }

    // ---------------- generering ----------------
    generate() {
      const rnd = SV.rng(this.seed);
      const s = this.seed;

      // 1. Grundterräng per sektor, med brusiga gränser.
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const jy = y + (SV.noise(x * 0.15, 3, s) - 0.5) * 6;
          const n = SV.fbm(x * 0.09, y * 0.09, s + 1);
          let gt;
          if (jy >= 86) gt = n > 0.56 ? G.MOSS : G.GRASS;
          else if (jy >= 44) gt = SV.fbm(x * 0.12, y * 0.12, s + 2) > 0.66 ? G.MUD : n > 0.6 ? G.GRASS : G.DARK;
          else gt = n > 0.47 ? G.SNOW : SV.fbm(x * 0.2, y * 0.2, s + 9) > 0.5 ? G.MOSS : G.DARK;
          this.setG(x, y, gt);
          this.variant[this.idx(x, y)] = Math.floor(SV.hash(x, y, s) * 256);
        }

      // 2. Skog: täthet styrs av brus så att det blir dungar och gläntor.
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const sec = this.sectorAt(y).id;
          const clump = SV.fbm(x * 0.11, y * 0.11, s + 4);
          const base = sec === 'moss' ? 0.1 : sec === 'jarn' ? 0.09 : 0.15;
          const dens = base * Math.max(0, clump - 0.3) * 3.2;
          const h = SV.hash(x, y, s + 5);
          if (h < dens) {
            let bt;
            if (sec === 'moss') bt = SV.hash(x, y, 6) < 0.4 ? B.BIRCH : B.PINE;
            else if (sec === 'jarn') bt = SV.hash(x, y, 6) < 0.25 ? B.SPRUCE_DARK : B.PINE;
            else bt = SV.hash(x, y, 6) < 0.35 ? B.SPRUCE : B.PINE_SNOW;
            this.setB(x, y, bt);
          } else if (h < dens + 0.012) {
            this.setB(x, y, sec === 'moss' ? B.ROCK_MOSS : B.ROCK);
          }
          // dekor
          const dh = SV.hash(x, y, s + 8);
          if (sec === 'moss') this.deco[this.idx(x, y)] = dh < 0.06 ? D.FLOWER_W : dh < 0.1 ? D.FLOWER_Y : dh < 0.13 ? D.FLOWER_B : dh < 0.15 ? D.MUSHROOM : dh < 0.2 ? D.TUFT : dh < 0.22 ? D.BERRY : 0;
          else if (sec === 'jarn') this.deco[this.idx(x, y)] = dh < 0.04 ? D.BOLT : dh < 0.1 ? D.TUFT : dh < 0.13 ? D.PEBBLE : dh < 0.145 ? D.MUSHROOM : 0;
          else this.deco[this.idx(x, y)] = dh < 0.08 ? D.LICHEN : dh < 0.12 ? D.PEBBLE : dh < 0.14 ? D.FLOWER_B : 0;
        }

      // 3. Ytterkant av tät skog.
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
          const thick = 2 + Math.floor(SV.noise(x * 0.3, y * 0.3, s + 11) * 2.5);
          if (edge < thick) this.setB(x, y, y < 44 ? B.PINE_SNOW : B.PINE);
        }

      // 4. Älven genom Järnforsen.
      this.riverY = (x) => 66 + Math.sin(x * 0.13) * 2.6 + Math.sin(x * 0.05 + 1) * 2;
      for (let x = 0; x < W; x++) {
        const cy = this.riverY(x);
        for (let y = Math.floor(cy - 4); y <= Math.ceil(cy + 4); y++) {
          const d = Math.abs(y + 0.5 - cy);
          if (d <= 1.7) this.water(x, y, G.DEEP);
          else if (d <= 2.6) this.water(x, y, G.SHALLOW);
        }
      }

      // 5. Sjön i öster med en ö.
      this.disc(80, 54, 7.5, (x, y, d) => {
        if (d < 2.2) {
          this.setG(x, y, G.MOSS);
          this.setB(x, y, B.NONE);
        } else if (d < 6.3) this.water(x, y, G.DEEP);
        else this.water(x, y, G.SHALLOW);
      });
      // Brobygge från västra stranden till ön.
      const site = [];
      for (let x = 73; x <= 77; x++) {
        if (this.g(x, 54) === G.DEEP) {
          this.setG(x, 54, G.SITE);
          site.push([x, 54]);
        }
      }
      this.bridgeSites.lake = { id: 'lake', tiles: site, built: false, post: [72, 54], dir: 'h' };

      // 6. Bäcken och dammen i Mossdalen (grunt vatten).
      for (let y = 84; y < 112; y++) {
        const cx = 27 + Math.sin(y * 0.28) * 2.2;
        for (let x = Math.floor(cx - 1); x <= Math.ceil(cx + 1); x++) if (Math.abs(x + 0.5 - cx) < 1.3) this.water(x, y, G.SHALLOW);
      }
      this.disc(29, 98, 4.2, (x, y, d) => {
        if (d < 1.2) {
          this.setG(x, y, G.MOSS);
          this.setB(x, y, B.NONE);
        } else this.water(x, y, G.SHALLOW);
      });

      // 7. Stigen från Skogsbasen till Urkärnan.
      const path = [[48, 120], [47, 110], [40, 103], [52, 92], [46, 80], [33, 72], [36, 66], [44, 60], [58, 54], [62, 46], [50, 38], [36, 28], [42, 20], [50, 16], [48, 12]];
      this.path = path;
      for (let i = 0; i < path.length - 1; i++) this.carve(path[i], path[i + 1], 1.3);

      // 8. Skogsbasen.
      this.base = { x: 48, y: 116 };
      this.disc(48, 115, 6.5, (x, y, d) => {
        this.setB(x, y, B.NONE);
        if (d < 3.6) this.setG(x, y, G.FLOOR);
        else if (this.g(x, y) !== G.DIRT) this.setG(x, y, G.MOSS);
      });
      this.addBig('forge', 51, 113, 2, 2);
      this.addBig('tent', 43, 113, 2, 1);
      this.setB(46, 116, B.CAMPFIRE);
      this.campfire = { x: 46.5 * T, y: 116.6 * T };
      this.spawn = { x: 48.5 * T, y: 118 * T };
      this.forgePos = { x: 52 * T, y: 114 * T };

      // 9. Urkärnan.
      this.disc(48, 8, 7.5, (x, y, d) => {
        this.setB(x, y, B.NONE);
        this.setG(x, y, d < 4.8 ? G.FLOOR : G.MOSS);
      });
      this.addBig('core', 46, 7, 4, 2);
      this.core = { x: 48 * T, y: 9 * T, pylons: [[42, 5], [54, 5], [42, 11], [54, 11]] };
      this.core.pylons.forEach(([x, y]) => this.setB(x, y, B.PYLON));

      // 10. Snårgläntan (Lodjurets dolda stig).
      this.disc(13, 103, 5.6, (x, y, d) => {
        this.setB(x, y, B.NONE);
        if (d >= 3.9) this.setG(x, y, G.THICKET);
        else this.setG(x, y, G.MOSS);
      });
      for (let x = 16; x <= 19; x++) if (this.g(x, 103) === G.THICKET) this.setG(x, 103, G.HIDDEN);
      for (let x = 19; x <= 21; x++) {
        this.setB(x, 103, B.NONE);
        if (this.g(x, 103) === G.THICKET) this.setG(x, 103, G.HIDDEN);
      }
      // fler snår utspridda i Mossdalen
      for (let i = 0; i < 9; i++) {
        const cx = rnd.int(8, 86), cy = rnd.int(90, 122);
        if (SV.dist(cx, cy, 48, 115) < 10 || SV.dist(cx, cy, 13, 103) < 9) continue;
        this.disc(cx, cy, rnd.range(1.2, 2.4), (x, y) => {
          if (this.g(x, y) !== G.DIRT && this.g(x, y) !== G.SHALLOW) {
            this.setG(x, y, G.THICKET);
            this.setB(x, y, B.NONE);
          }
        });
      }

      // 11. Stenringen i Dimkronorna, spärrad av fallna stockar (Älgen).
      this.disc(80, 22, 5.6, (x, y, d) => {
        this.setB(x, y, d >= 4 ? (SV.hash(x, y, 3) < 0.5 ? B.ROCK : B.RUIN) : B.NONE);
        if (d < 4) this.setG(x, y, G.SNOW);
      });
      for (let x = 74; x <= 76; x++) this.setB(x, 22, B.LOG);
      for (let x = 70; x <= 73; x++) {
        this.setB(x, 22, B.NONE);
        this.setG(x, 22, G.SNOW);
      }

      // 12. Robotdepån i Järnforsen, med barrikad.
      for (let y = 48; y <= 56; y++)
        for (let x = 9; x <= 19; x++) {
          const edge = x === 9 || x === 19 || y === 48 || y === 56;
          this.setB(x, y, edge ? B.RUIN : B.NONE);
          if (!edge) this.setG(x, y, G.FLOOR);
        }
      this.setB(19, 51, B.BARRICADE);
      this.setB(19, 52, B.BARRICADE);
      this.blockHp['19,51'] = 3;
      this.blockHp['19,52'] = 3;
      for (let x = 20; x <= 24; x++)
        for (let y = 51; y <= 52; y++) {
          this.setB(x, y, B.NONE);
          if (this.g(x, y) === G.DEEP || this.g(x, y) === G.SHALLOW) continue;
          this.setG(x, y, G.DIRT);
        }
      this.setB(11, 50, B.SCRAPHEAP);
      this.setB(17, 55, B.SCRAPHEAP);

      // 13. Ruiner, reaktorer, energiledningar, skrothögar i Järnforsen.
      this.addReactor(58, 79);
      this.addReactor(30, 57);
      for (let x = 8; x <= 40; x += 6) this.placeIfFree(x, 82, B.PYLON);
      for (let y = 46; y <= 60; y += 5) this.placeIfFree(70, y, B.PYLON);
      for (let i = 0; i < 26; i++) this.placeIfFree(rnd.int(5, 90), rnd.int(46, 84), B.SCRAPHEAP);
      for (let i = 0; i < 14; i++) {
        const x = rnd.int(5, 88), y = rnd.int(46, 84);
        const len = rnd.int(2, 4);
        const hor = rnd.chance(0.5);
        for (let k = 0; k < len; k++) this.placeIfFree(x + (hor ? k : 0), y + (hor ? 0 : k), B.RUIN);
      }
      for (let i = 0; i < 6; i++) this.placeIfFree(rnd.int(60, 90), rnd.int(92, 120), B.RUIN);
      for (let i = 0; i < 6; i++) this.placeIfFree(rnd.int(5, 90), rnd.int(6, 40), B.RUIN);
      for (let i = 0; i < 5; i++) this.placeIfFree(rnd.int(8, 88), rnd.int(90, 122), B.SCRAPHEAP);

      // Kristallgrottor: rundade klippväggar med en smal öppning mot stigen.
      [[53, 99, 3.2], [80, 106, 3.4], [62, 74, 3.0], [20, 30, 3.6], [64, 33, 3.0], [30, 12, 3.2]].forEach(([cx, cy, r]) => this.grotto(cx, cy, r));

      // Stigen ska alltid vara fri (efter allt annat).
      for (let i = 0; i < path.length - 1; i++) this.carve(path[i], path[i + 1], 1.3, true);

      // 14. Runstenar.
      const runes = [
        [41, 108, 'Runan lyser svagt: "Där snåren är tätast går lodjurets stig. Bara den som smyger ser vägen."'],
        [57, 84, 'Runan: "Älven är bred, men bävern bygger där stolparna står."'],
        [27, 45, 'Runan: "Stockarna i norr flyttas inte av händer – men av en konungs horn."'],
        [57, 16, 'Runan: "Åtta kristaller väcker Urkärnan. Då höjs skölden och stormen tystnar."'],
      ];
      runes.forEach(([x, y, text], i) => {
        this.clearAround(x, y, 1);
        this.setB(x, y, B.RUNESTONE);
        this.runestones.push({ id: 'r' + i, tx: x, ty: y, x: (x + 0.5) * T, y: (y + 1) * T, text, read: false });
      });

      // 15. Energikristaller (12 st).
      const crystals = [
        [53, 99, 'Mossdalen'], [13, 103, 'Snårgläntan'], [29, 98, 'Dammen'], [80, 106, 'Ruinerna i öster'],
        [80, 54, 'Ön i sjön'], [14, 52, 'Robotdepån'], [62, 74, 'Reaktorn'], [34, 77, 'Begravd', true],
        [80, 22, 'Stenringen'], [20, 30, 'Drönarfältet'], [64, 33, 'Klippan'], [30, 12, 'Kärnans grind'],
      ];
      crystals.forEach(([x, y, where, buried], i) => {
        this.setB(x, y, B.NONE);
        if (this.g(x, y) === G.DEEP || this.g(x, y) === G.SHALLOW || this.g(x, y) === G.THICKET) this.setG(x, y, G.MOSS);
        this.crystals.push({ id: 'c' + i, tx: x, ty: y, x: (x + 0.5) * T, y: (y + 0.7) * T, where, buried: !!buried, taken: false, seen: false });
      });

      // 16. Kistor.
      const chests = [[11, 101], [12, 54], [81, 53], [82, 21], [70, 96], [22, 74], [12, 30], [56, 40], [86, 70]];
      chests.forEach(([x, y], i) => {
        this.setB(x, y, B.NONE);
        if (this.g(x, y) === G.THICKET || this.g(x, y) === G.DEEP) this.setG(x, y, G.MOSS);
        this.chests.push({ id: 'k' + i, tx: x, ty: y, x: (x + 0.5) * T, y: (y + 0.8) * T, open: false });
      });

      // 17. Djur att bli vän med.
      const animals = [['fox', 67, 107], ['beaver', 24, 92], ['lynx', 40, 76], ['moose', 72, 74], ['owl', 52, 48]];
      animals.forEach(([kind, x, y]) => {
        this.clearAround(x, y, 1);
        this.animals.push({ kind, x: (x + 0.5) * T, y: (y + 0.8) * T, met: false });
      });

      // 18. Begravt skrot (Hunden hittar det).
      let tries = 0;
      while (this.buried.length < 46 && tries++ < 2000) {
        const x = rnd.int(4, W - 5), y = rnd.int(4, H - 5);
        if (this.isSolidTile(x, y) || this.g(x, y) === G.SHALLOW || this.g(x, y) === G.FLOOR) continue;
        this.buried.push({ id: 'b' + this.buried.length, x: (x + 0.5) * T, y: (y + 0.5) * T, dug: false, marked: 0 });
      }

      // 19. Robotpatruller.
      const sp = [
        ['hound', 70, 100, 3], ['hound', 30, 110, 2], ['hound', 80, 108, 3], ['bear', 18, 92, 1],
        ['bear', 62, 76, 1], ['bear', 22, 58, 1], ['bear', 46, 70, 1], ['bear', 84, 80, 1],
        ['hound', 30, 80, 3], ['hound', 70, 60, 3], ['drone', 50, 56, 2], ['drone', 14, 46, 1], ['drone', 86, 62, 1],
        ['drone', 20, 30, 3], ['drone', 62, 30, 2], ['drone', 36, 16, 2], ['bear', 30, 14, 1], ['bear', 76, 30, 1],
        ['hound', 44, 24, 3], ['hound', 14, 20, 2], ['bear', 60, 40, 1],
      ];
      sp.forEach(([type, x, y, n]) => {
        for (let k = 0; k < n; k++) {
          const ox = x + (k % 2) * 2 - 1, oy = y + Math.floor(k / 2) * 2;
          const p = this.findFree(ox, oy);
          if (p) this.spawns.push({ type, x: (p[0] + 0.5) * T, y: (p[1] + 0.5) * T });
        }
      });
    }

    grotto(cx, cy, r) {
      // öppningen pekar mot närmaste punkt på stigen
      let best = null, bd = Infinity;
      this.path.forEach(([px, py]) => {
        const d = Math.hypot(px - cx, py - cy);
        if (d < bd) {
          bd = d;
          best = [px, py];
        }
      });
      const open = Math.atan2(best[1] - cy, best[0] - cx);
      this.disc(cx, cy, r + 1.6, (x, y, d) => {
        const a = Math.atan2(y - cy, x - cx);
        const inGap = Math.abs(SV.angleDiff(open, a)) < 0.42;
        if (this.b(x, y) === B.PART) return;
        if (d < r || (inGap && d < r + 1.7)) {
          this.setB(x, y, B.NONE);
          this.setG(x, y, G.CAVE);
          this.deco[this.idx(x, y)] = 0;
        } else if (this.g(x, y) !== G.DIRT && this.g(x, y) !== G.BRIDGE) this.setB(x, y, B.CAVEWALL);
      });
      // en kort gång ut till stigen
      const ex = cx + Math.cos(open) * (r + 2.2), ey = cy + Math.sin(open) * (r + 2.2);
      this.carveLine([cx + Math.cos(open) * r, cy + Math.sin(open) * r], [ex, ey], 0.9);
      this.grottos.push({ x: cx, y: cy, r, open });
    }
    carveLine(a, b, r) {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) || 1;
      for (let i = 0; i <= n; i++) {
        this.disc(SV.lerp(a[0], b[0], i / n), SV.lerp(a[1], b[1], i / n), r, (x, y) => {
          if (this.b(x, y) === B.PART) return;
          this.setB(x, y, B.NONE);
          if (!this.isWaterG(this.g(x, y)) && this.g(x, y) !== G.BRIDGE) this.setG(x, y, G.CAVE);
        });
      }
    }
    inGrotto(px, py) {
      return this.groundAtPx(px, py) === G.CAVE;
    }

    water(x, y, type) {
      if (!this.inBounds(x, y)) return;
      const cur = this.g(x, y);
      if (type === G.SHALLOW && (cur === G.DEEP || cur === G.SITE)) return;
      this.setG(x, y, type);
      this.setB(x, y, B.NONE);
      this.deco[this.idx(x, y)] = 0;
    }
    disc(cx, cy, r, fn) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!this.inBounds(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d <= r) fn(x, y, d);
        }
    }
    carve(a, b, r, final) {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const cx = SV.lerp(a[0], b[0], t) + Math.sin(t * Math.PI * 2 + a[0]) * 0.6;
        const cy = SV.lerp(a[1], b[1], t);
        this.disc(cx, cy, r, (x, y) => {
          const cur = this.g(x, y);
          if (this.block[this.idx(x, y)] === B.PART || this.block[this.idx(x, y)] === B.PYLON) return;
          this.setB(x, y, B.NONE);
          if (cur === G.DEEP || cur === G.SHALLOW || cur === G.SITE || cur === G.BRIDGE) this.setG(x, y, G.BRIDGE);
          else if (cur !== G.FLOOR) this.setG(x, y, final && cur === G.THICKET ? G.DIRT : G.DIRT);
          this.deco[this.idx(x, y)] = SV.hash(x, y, 2) < 0.1 ? D.PEBBLE : 0;
        });
      }
    }
    addBig(kind, x, y, w, h) {
      // (x, y) = övre vänstra rutan i fotavtrycket
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          this.setB(x + i, y + j, B.PART);
          this.deco[this.idx(x + i, y + j)] = 0;
        }
      this.big.push({ kind, x, y, w, h });
    }
    addReactor(x, y) {
      this.clearAround(x + 1, y, 2);
      this.addBig('reactor', x, y, 3, 2);
    }
    placeIfFree(x, y, bt) {
      if (!this.inBounds(x, y)) return;
      const gt = this.g(x, y);
      if (this.b(x, y) !== B.NONE || gt === G.DIRT || gt === G.DEEP || gt === G.SHALLOW || gt === G.SITE || gt === G.BRIDGE || gt === G.FLOOR || gt === G.THICKET || gt === G.HIDDEN) return;
      this.setB(x, y, bt);
    }
    clearAround(cx, cy, r) {
      for (let y = cy - r; y <= cy + r; y++)
        for (let x = cx - r; x <= cx + r; x++) {
          if (this.b(x, y) !== B.PART) this.setB(x, y, B.NONE);
          if (this.g(x, y) === G.THICKET) this.setG(x, y, G.MOSS);
        }
    }
    findFree(x, y) {
      for (let r = 0; r < 6; r++)
        for (let j = -r; j <= r; j++)
          for (let i = -r; i <= r; i++) if (!this.isSolidTile(x + i, y + j) && this.g(x + i, y + j) !== G.SHALLOW) return [x + i, y + j];
      return null;
    }

    // ---------------- kollision och terräng ----------------
    // opts.hiddenOpen: Lodjuret är aktivt. opts.flying: ignorera allt utom kartkanten.
    isSolidTile(x, y, opts) {
      if (!this.inBounds(x, y)) return true;
      if (opts && opts.flying) return false;
      const gt = this.ground[y * W + x];
      if (gt === G.DEEP || gt === G.SITE || gt === G.THICKET) return true;
      if (gt === G.HIDDEN && !(opts && opts.hiddenOpen)) return true;
      return this.block[y * W + x] !== B.NONE;
    }
    isSolidPx(px, py, opts) {
      return this.isSolidTile(Math.floor(px / T), Math.floor(py / T), opts);
    }
    // Rör en kropp (halvbredd hw, halvhöjd hh kring fötterna) med glidning.
    moveBody(body, dx, dy, hw, hh, opts) {
      const test = (x, y) =>
        this.isSolidPx(x - hw, y - hh, opts) || this.isSolidPx(x + hw, y - hh, opts) || this.isSolidPx(x - hw, y + hh, opts) || this.isSolidPx(x + hw, y + hh, opts);
      let hit = false;
      if (dx) {
        if (!test(body.x + dx, body.y)) body.x += dx;
        else hit = true;
      }
      if (dy) {
        if (!test(body.x, body.y + dy)) body.y += dy;
        else hit = true;
      }
      return hit;
    }
    groundAtPx(px, py) {
      return this.g(Math.floor(px / T), Math.floor(py / T));
    }

    // ---------------- förändringar (sparas) ----------------
    buildBridge(id) {
      const site = this.bridgeSites[id];
      if (!site || site.built) return false;
      site.tiles.forEach(([x, y]) => {
        this.setG(x, y, G.BRIDGE);
        this.invalidate(x, y, 'bridge');
      });
      site.built = true;
      this.changes.push({ t: 'bridge', id });
      return true;
    }
    clearBlock(x, y) {
      if (this.b(x, y) === B.NONE) return;
      const was = this.b(x, y);
      this.setB(x, y, B.NONE);
      this.invalidate(x, y, 'block:' + was);
      this.changes.push({ t: 'clear', x, y });
    }
    applyChanges(list) {
      (list || []).forEach((c) => {
        if (c.t === 'bridge') this.buildBridge(c.id);
        if (c.t === 'clear') this.clearBlock(c.x, c.y);
      });
    }
    invalidate(x, y, what) {
      if (this.onChange) this.onChange(what || 'tile', x, y);
    }

    isWaterG(gt) {
      return gt === G.DEEP || gt === G.SHALLOW || gt === G.SITE;
    }
    // Returnerar antal nyupptäckta rutor.
    reveal(px, py, radius) {
      const cx = px / T, cy = py / T;
      let n = 0;
      const r = Math.ceil(radius);
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!this.inBounds(x, y)) continue;
          const i = y * W + x;
          if (this.revealed[i]) continue;
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > radius) continue;
          this.revealed[i] = 1;
          n++;
        }
      return n;
    }
    revealedFraction() {
      let n = 0;
      for (let i = 0; i < this.revealed.length; i++) n += this.revealed[i];
      return n / this.revealed.length;
    }
    // Komprimerad dimma för sparning (bitar → base64).
    fogToString() {
      const bytes = new Uint8Array(Math.ceil(this.revealed.length / 8));
      for (let i = 0; i < this.revealed.length; i++) if (this.revealed[i]) bytes[i >> 3] |= 1 << (i & 7);
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    }
    fogFromString(str) {
      try {
        const s = atob(str);
        for (let i = 0; i < this.revealed.length; i++) this.revealed[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
      } catch (e) {
        /* trasig sparning – börja om dimman */
      }
    }

    // Minikartans färg per ruta.
    tileMapColor(x, y) {
      const gt = this.g(x, y), bt = this.b(x, y);
      if (bt === B.PINE || bt === B.PINE_SNOW || bt === B.SPRUCE || bt === B.BIRCH || bt === B.SPRUCE_DARK) return y < 44 ? '#2f5a4a' : '#2a5a32';
      if (bt === B.RUIN || bt === B.PART || bt === B.BARRICADE) return '#6c7380';
      if (bt === B.ROCK || bt === B.ROCK_MOSS) return '#7d828c';
      if (bt === B.CAVEWALL) return '#2a3a6a';
      if (gt === G.CAVE) return '#7a3a8a';
      switch (gt) {
        case G.DEEP:
        case G.SITE:
          return '#2b6fa3';
        case G.SHALLOW:
          return '#4fa8c8';
        case G.BRIDGE:
        case G.DIRT:
          return '#b08a5a';
        case G.MUD:
          return '#6a4a2e';
        case G.SNOW:
          return '#dce6f0';
        case G.FLOOR:
          return '#8a8f96';
        case G.THICKET:
        case G.HIDDEN:
          return '#1e4a28';
        case G.MOSS:
          return '#3f8c4c';
        case G.DARK:
          return '#3d7535';
        default:
          return '#4f9a3e';
      }
    }
  }

  SV.World = World;
  SV.G = G;
  SV.B = B;
  SV.SECTORS = SECTORS;
})();
