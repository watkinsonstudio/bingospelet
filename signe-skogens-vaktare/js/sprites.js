// sprites.js – all pixelkonst. Figurer ritas som teckenkartor (kontur läggs
// på automatiskt), miljöobjekt genereras procedurellt med seedad variation.
(function () {
  'use strict';
  const SV = window.SV;
  const Art = SV.Art;

  // ------------------------------------------------------------------
  // Signe – rustningszonerna ritas i shaderns målfärger (GDD §5.3):
  // target_primary (0.2, 0.6, 0.4) = #339966 och target_secondary
  // (0.8, 0.5, 0.2) = #cc8033. Benen får en tredje målfärg.
  // ------------------------------------------------------------------
  const ARMOR_TARGETS = {
    helmet: { base: '#339966', shade: '#24704a' },
    chest: { base: '#cc8033', shade: '#94592a' },
    legs: { base: '#3d4a7a', shade: '#2a3358' },
  };

  const SIGNE_PAL = {
    H: ARMOR_TARGETS.helmet.base, h: ARMOR_TARGETS.helmet.shade,
    C: ARMOR_TARGETS.chest.base, c: ARMOR_TARGETS.chest.shade,
    L: ARMOR_TARGETS.legs.base, l: ARMOR_TARGETS.legs.shade,
    v: '#5ee8f5', V: '#e4feff',
    r: '#e8693c', R: '#a9452a',
    s: '#f5c9a0', S: '#d99e7c', p: '#f2908c', m: '#a8445a',
    e: '#2a2340', w: '#ffffff',
    g: '#ffd25e', k: '#6ff6ff', b: '#3a3048',
  };

  const SIGNE_DOWN_TOP = Art.mirror([
    '....HHH', '..HHHHH', '.HHHHHH', '.hvvVvv', 'rhvvvvv', 'rRsssss', 'rRsswes', 'rRssees',
    'rRspssm', 'rR.SSss', '.g.CCCk', '..CCCCk', '.CCcCCC', '.sccccc', '...LLLL',
  ]);
  SIGNE_DOWN_TOP[2] = '.HHHwwHHHHHHH.';
  const SIGNE_UP_TOP = Art.mirror([
    '....HHH', '..HHHHH', '.HHHHHg', '.HHHHHH', 'rhhhhhh', 'rRrrrrr', 'rRrRrrr', 'rRrrRrr',
    'rRrrrrr', 'rR.RRrr', '.g.CCCC', '..CCCCC', '.CCcCCg', '.sccccc', '...LLLL',
  ]);
  const LEGS_FRONT = [
    ['...LLL..LLL...', '...lLL..LLl...', '...bbb..bbb...'],
    ['...LLL..LLL...', '...bbb..lLL...', '........bbb...'],
    ['...LLL..LLL...', '...lLL..bbb...', '...bbb........'],
  ];
  const SIGNE_SIDE_TOP = [
    '....HHHHHH....',
    '..HHHHHHHwHH..',
    '.HHHHHHHHHHHH.',
    '.hHHHHHvvvVvv.',
    'rhhhhhhvvvvvv.',
    'rRrrrrssssss..',
    'rRrrrsssswes..',
    'rRrrrssssees..',
    'rRrrSssspssm..',
    'rR..SSsssss...',
    'g...CCCCCCk...',
    '...CCCCCCCC...',
    '...CCcCsCCC...',
    '...ccccsccc...',
    '....LLLLLL....',
  ];
  const LEGS_SIDE = [
    ['.....LL.LL....', '.....lL.Ll....', '.....bb.bbb...'],
    ['....LL...LL...', '...lL.....Ll..', '..bb......bbb.'],
    ['.....LLLL.....', '.....lLLl.....', '.....bbbbb....'],
  ];

  function buildSigneBase() {
    const dirs = {};
    dirs.down = LEGS_FRONT.map((legs) => Art.fromMap(SIGNE_DOWN_TOP.concat(legs), SIGNE_PAL));
    dirs.up = LEGS_FRONT.map((legs) => Art.fromMap(SIGNE_UP_TOP.concat(legs), SIGNE_PAL));
    dirs.right = LEGS_SIDE.map((legs) => Art.fromMap(SIGNE_SIDE_TOP.concat(legs), SIGNE_PAL));
    return dirs;
  }

  // Färgsätt alla bildrutor via ArmorColorShader.
  function buildSigne(armor) {
    const base = SV.SPR._signeBase || (SV.SPR._signeBase = buildSigneBase());
    const pairs = [];
    ['helmet', 'chest', 'legs'].forEach((zone) => {
      const col = armor[zone];
      pairs.push({ target: ARMOR_TARGETS[zone].base, replace: col });
      pairs.push({ target: ARMOR_TARGETS[zone].shade, replace: SV.shadeHex(col, 0.3) });
    });
    const out = {};
    for (const dir of ['down', 'up', 'right']) out[dir] = base[dir].map((f) => SV.ArmorColorShader.apply(f, pairs));
    out.left = out.right.map((f) => Art.flip(f));
    return out;
  }

  // ------------------------------------------------------------------
  // Djur (sidovy åt höger, speglas för vänster)
  // ------------------------------------------------------------------
  const ANIMAL_MAPS = {
    dog: {
      pal: { B: '#c47f3e', b: '#8a5226', w: '#f6ecd9', n: '#2a2030', e: '#1f1830', t: '#ee6f86', c: '#3dd8ff' },
      frames: [
        [
          '...........bb...',
          '..........bBBb..',
          'b.........BBeBB.',
          '.b........BBBBBn',
          '.b.......cBBwwt.',
          '..BBBBBBBcBBw...',
          '..BBBBBBBBBBw...',
          '..BwwwwwwBBB....',
          '..B.B....B.B....',
          '..b.b....b.b....',
        ],
        [
          '...........bb...',
          '..........bBBb..',
          '..........BBeBB.',
          'b.........BBBBBn',
          '.bb......cBBwwt.',
          '..BBBBBBBcBBw...',
          '..BBBBBBBBBBw...',
          '..BwwwwwwBBB....',
          '...BB....BB.....',
          '...bb.....bb....',
        ],
      ],
    },
    lynx: {
      pal: { Y: '#d0aa7c', y: '#9a7650', d: '#6e5236', w: '#f1e6d2', e: '#8fdc4a', k: '#221a16', n: '#4a2e2e' },
      frames: [
        [
          '..........k..k..',
          '..........Yy.Yy.',
          '..........YYYYYY',
          '..........YeYYYn',
          'kk.......yYYYww.',
          'kYYYYdYYYYYYw...',
          '.YYdYYYYdYYYw...',
          '.YYYYYYYYYYY....',
          '.wwwwwwwwYYY....',
          '..Y.Y....Y.Y....',
          '..y.y....y.y....',
        ],
        [
          '..........k..k..',
          '..........Yy.Yy.',
          '..........YYYYYY',
          'kk........YeYYYn',
          'kY.......yYYYww.',
          '.YYYYdYYYYYYw...',
          '.YYdYYYYdYYYw...',
          '.YYYYYYYYYYY....',
          '.wwwwwwwwYYY....',
          '...YY....YY.....',
          '...yy.....yy....',
        ],
      ],
    },
    fox: {
      pal: { O: '#ec7a2c', o: '#b4521c', w: '#fbf2e4', k: '#2a1c1c', e: '#1f1830' },
      frames: [
        [
          '...........k..k..',
          '...........Oo.Oo.',
          '...........OOOOO.',
          '...........OeOOOw',
          'wOO.......oOOwwwk',
          'wOOO.....OOOOw...',
          '.wOOOOOOOOOOww...',
          '..oOOOOOOOOOw....',
          '...oowwwwwOO.....',
          '...k.k...k.k.....',
        ],
        [
          '...........k..k..',
          '...........Oo.Oo.',
          '...........OOOOO.',
          'wO.........OeOOOw',
          'wOOO......oOOwwwk',
          '.wOOO....OOOOw...',
          '..wOOOOOOOOOww...',
          '..oOOOOOOOOOw....',
          '...oowwwwwOO.....',
          '....kk...kk......',
        ],
      ],
    },
    beaver: {
      pal: { B: '#8e5c36', b: '#5e3a1e', t: '#3c3346', T: '#544a62', e: '#1a1010', w: '#f2b640', n: '#2a1a1a' },
      frames: [
        [
          '.........bBb...',
          '........BBBBeB.',
          '......BBBBBBBBn',
          '....BBBBBBBBBw.',
          'TT.BBBBBBBBBB..',
          'TTTBBBBBBBBB...',
          'tTt.bb...bb....',
        ],
        [
          '.........bBb...',
          '........BBBBeB.',
          '......BBBBBBBBn',
          'TT..BBBBBBBBBw.',
          'TTTBBBBBBBBBB..',
          '.tTBBBBBBBBB...',
          '.....bb.bb.....',
        ],
      ],
    },
    moose: {
      pal: { M: '#5c3c28', m: '#3e2818', a: '#e8d6a6', A: '#b9a172', e: '#140c0a', n: '#2a1a14', l: '#8a6a50', w: '#7a5a44' },
      frames: [
        [
          '..............a.a.a.....',
          '..............aaAaAa.a..',
          '...............AAAAAaa..',
          '..................AMa...',
          '.................mMMMM..',
          '.................MMeMMM.',
          '................mMMMMMMw',
          '.mmm.......mmmmMMMMMMMMw',
          'mMMMMMMMMMMMMMMMMm.wMMn.',
          'MMMMMMMMMMMMMMMMMm..mM..',
          'MMMMMMMMMMMMMMMMMm......',
          'mMMMMMMMMMMMMMMMm.......',
          '.mMMMMMMMMMMMMMm........',
          '..lMM.lM....lMM.lM......',
          '..lM..lM....lM..lM......',
          '..lM..lM....lM..lM......',
          '..lM..lM....lM..lM......',
          '..mm..mm....mm..mm......',
        ],
        [
          '..............a.a.a.....',
          '..............aaAaAa.a..',
          '...............AAAAAaa..',
          '..................AMa...',
          '.................mMMMM..',
          '.................MMeMMM.',
          '................mMMMMMMw',
          '.mmm.......mmmmMMMMMMMMw',
          'mMMMMMMMMMMMMMMMMm.wMMn.',
          'MMMMMMMMMMMMMMMMMm..mM..',
          'MMMMMMMMMMMMMMMMMm......',
          'mMMMMMMMMMMMMMMMm.......',
          '.mMMMMMMMMMMMMMm........',
          '...lMlM......lMlM.......',
          '...lMlM......lMlM.......',
          '..lM...lM...lM...lM.....',
          '..lM...lM...lM...lM.....',
          '..mm...mm...mm...mm.....',
        ],
      ],
    },
  };

  const OWL_PAL = { O: '#8a6a48', o: '#5e4630', F: '#e0c49c', E: '#ffa52a', k: '#1a1010', y: '#f0c040', L: '#c09c70', d: '#6e5236' };
  const OWL_HALF = ['o.....', 'oO....', '.OOOOO', 'OFFFFO', 'OFEkFF', 'OFEEFF', 'OOFFFy', 'OLdLLL', 'OLLdLL', 'OLdLLd', 'oOLLLL', '.oOOOO', '..y.y.'];

  function buildOwl() {
    const body = Art.fromMap(Art.mirror(OWL_HALF), OWL_PAL, { outline: false });
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const p = new Art.Pix(26, 18);
      // vingar
      const wingY = f === 0 ? 3 : 8;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const x0 = 13 + side * (6 + i);
          const yTop = wingY + (f === 0 ? -Math.floor(i / 2) : Math.floor(i / 2));
          for (let j = 0; j < 5 - Math.floor(i / 2); j++) p.set(x0, yTop + j + 2, j === 0 ? '#c09c70' : j % 2 ? '#8a6a48' : '#6e5236');
        }
      }
      const tmp = p.toCanvas();
      const g = tmp.getContext('2d');
      g.drawImage(body, 7, 2);
      const p2 = new Art.Pix(26, 18);
      const img = g.getImageData(0, 0, 26, 18);
      p2.d.set(img.data);
      p2.outline('#1b1730');
      frames.push(p2.toCanvas());
    }
    const perched = Art.fromMap(Art.mirror(OWL_HALF), OWL_PAL);
    return { right: frames, left: frames, perched };
  }

  // ------------------------------------------------------------------
  // Robotar – ögonfärgen byts beroende på AI-tillstånd.
  // ------------------------------------------------------------------
  const ROBOT_PAL = {
    M: '#a3afc2', m: '#6c778c', d: '#454d60', k: '#23262f', E: '#ff4a3a',
    y: '#d9962a', Y: '#ffcf5a', r: '#b0683e', g: '#ff4a3a', p: '#d4e2f2', c: '#5ee8f5',
  };
  const EYE = '#ff4a3a';

  const BEAR_TOP = Art.mirror([
    '..dd......', '..dMd.dddd', '..dMMdMMMM', '...dMMMMMM', '...dMkkkkk', '...dMkEEkk', '...dMMMMMM',
    '....dmMMyy', '.yy..dmmmm', 'yYYydMMMMM', 'yYYdMMMMMM', 'yYYdMMrMMg', 'dkkdMMMMMM', 'dkkdmMMMMM', '.dd.dmmmmm',
  ]);
  const BEAR_LEGS = [
    ['....dMMd....dMMd....', '....dMMd....dMMd....', '....kkkk....kkkk....'],
    ['....dMMd....dMMd....', '....kkkk....dMMd....', '............kkkk....'],
    ['....dMMd....dMMd....', '....dMMd....kkkk....', '....kkkk............'],
  ];
  const DRONE_HALF_A = ['pppp....', '.dd.....', '.ddddddd', '...dMMMM', '...dMkkk', '...dMkEE', '...dMkkk', '....dmmm', '.....Y..'];
  const DRONE_HALF_B = ['..pppp..', '.dd.....', '.ddddddd', '...dMMMM', '...dMkkk', '...dMkEE', '...dMkkk', '....dmmm', '.....Y..'];
  const HOUND_FRAMES = [
    [
      '...........dd...',
      '..........dMMd..',
      '..........MMEMMk',
      'd.........MMMMkk',
      '.d.......dMMcc..',
      '..dMMMMMMMMMc...',
      '..MMMyMMMMMM....',
      '..dmmmmmmmmd....',
      '..M.M....M.M....',
      '..k.k....k.k....',
    ],
    [
      '...........dd...',
      '..........dMMd..',
      '..........MMEMMk',
      '..........MMMMkk',
      'dd.......dMMcc..',
      '..dMMMMMMMMMc...',
      '..MMMyMMMMMM....',
      '..dmmmmmmmmd....',
      '...MM....MM.....',
      '...kk.....kk....',
    ],
  ];

  function robotVariants(frames, flipToo) {
    const make = (list) => ({
      patrol: list.map((f) => Art.swap(f, { [EYE]: '#ffb02e' })),
      alert: list,
      stunned: list.map((f) => Art.swap(f, { [EYE]: '#5a6070', '#ff4a3a': '#5a6070' })),
      frozen: list.map((f) => Art.tint(f, '#9fe6ff', 0.65)),
      flash: list.map((f) => Art.silhouette(f, '#ffffff')),
    });
    const out = { right: make(frames) };
    out.left = flipToo ? make(frames.map((f) => Art.flip(f))) : out.right;
    return out;
  }

  // ------------------------------------------------------------------
  // Procedurella miljöobjekt
  // ------------------------------------------------------------------
  function pine(seed, snowy, big) {
    const rnd = SV.rng(seed);
    const W = big ? 26 : 20, H = big ? 44 : 34;
    const p = new Art.Pix(W, H);
    const cx = W / 2;
    const trunkH = big ? 7 : 6;
    p.rect(Math.floor(cx) - 2, H - trunkH - 1, 4, trunkH, '#6a4428');
    p.rect(Math.floor(cx) - 2, H - trunkH - 1, 1, trunkH, '#8a5c38');
    const tiers = big ? 5 : 4;
    const top = 1;
    const bottom = H - trunkH - 1;
    const pal = snowy
      ? { l: '#4f8f74', b: '#2f6a58', d: '#1f4a40' }
      : big
      ? { l: '#4d9058', b: '#2d6a44', d: '#1c4a32' }
      : { l: SV.mixHex('#5aa05a', '#7ab04e', rnd()), b: '#2f7444', d: '#1f5034' };
    for (let t = 0; t < tiers; t++) {
      const y0 = top + Math.floor(((bottom - top) * t) / (tiers + 0.6));
      const y1 = top + Math.floor(((bottom - top) * (t + 1.6)) / (tiers + 0.6));
      const hw = ((W / 2 - 1) * (t + 1.4)) / (tiers + 0.4);
      for (let y = y0; y <= y1; y++) {
        const k = (y - y0) / (y1 - y0);
        const w = hw * k + 0.6;
        for (let x = 0; x < W; x++) {
          const dx = x + 0.5 - cx;
          if (Math.abs(dx) > w) continue;
          if (y === y1 && SV.hash(x, y, seed) < 0.35) continue;
          let col = pal.b;
          if (dx < -w * 0.35 && k < 0.85) col = pal.l;
          if (dx > w * 0.45 || k > 0.82) col = pal.d;
          if (SV.hash(x, y, seed + 3) < 0.08) col = pal.l;
          if (snowy && k < 0.35 && SV.hash(x, y, seed + 9) < 0.75) col = SV.hash(x, y, 4) < 0.5 ? '#f2f7fb' : '#cfdeea';
          p.set(x, y, col);
        }
      }
    }
    p.outline('#132219');
    return p.toCanvas();
  }

  function birch(seed) {
    const W = 18, H = 30;
    const p = new Art.Pix(W, H);
    p.rect(8, 12, 3, 17, '#ece8df');
    p.rect(10, 12, 1, 17, '#c9c2b4');
    for (let y = 13; y < 29; y += 3) p.set(8 + (SV.hash(y, 1, seed) * 3) | 0, y, '#2a2a2a');
    p.ellipse(9, 9, 8.3, 8.6, (x, y, nx, ny) => {
      const h = SV.hash(x, y, seed);
      if (h < 0.06) return null;
      if (nx + ny < -0.6) return '#b4e07c';
      if (nx + ny < -0.1) return h < 0.5 ? '#8fcc5e' : '#a2d870';
      if (nx + ny > 0.7) return '#4c8f3a';
      return h < 0.5 ? '#6cb44c' : '#7cc05a';
    });
    p.outline('#132219');
    return p.toCanvas();
  }

  function rock(seed, mossy) {
    const p = new Art.Pix(17, 14);
    p.ellipse(8.5, 8, 7.8, 5.8, (x, y, nx, ny) => {
      if (mossy && ny < -0.35 && SV.hash(x, y, seed) < 0.75) return SV.hash(x, y, 2) < 0.5 ? '#5aa04a' : '#7cbc5a';
      if (nx + ny < -0.5) return '#b8bdc6';
      if (nx + ny > 0.6) return '#5d616b';
      return SV.hash(x, y, seed) < 0.15 ? '#7d828c' : '#929780';
    });
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function runestone(active) {
    const p = new Art.Pix(13, 23);
    p.ellipse(6.5, 6, 5.5, 5.5, '#9196a0');
    p.rect(1, 6, 11, 16, '#9196a0');
    p.rect(9, 3, 3, 19, '#737884');
    p.rect(2, 4, 2, 17, '#a9aeb8');
    const rune = active ? '#7ff3ff' : '#454a56';
    [[5, 5], [6, 6], [7, 7], [6, 8], [5, 9], [6, 10], [6, 11], [6, 12], [4, 13], [5, 14], [7, 14], [8, 15], [6, 16], [6, 17], [5, 18], [7, 18]].forEach(([x, y]) => p.set(x, y, rune));
    p.rect(1, 20, 11, 2, '#5aa04a');
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function ruinWall(seed) {
    const p = new Art.Pix(16, 24);
    p.rect(0, 4, 16, 20, '#7d8288');
    p.rect(0, 4, 16, 3, '#9aa0a6');
    p.rect(0, 20, 16, 4, '#5f646b');
    p.rect(3, 9, 10, 7, '#3e4a58');
    p.rect(4, 10, 8, 5, '#2a3440');
    p.set(5, 11, '#3f8890');
    p.set(8, 13, '#3f8890');
    for (let i = 0; i < 16; i++) {
      const len = Math.floor(SV.hash(i, 3, seed) * 9);
      for (let j = 0; j < len; j++) p.set(i, 4 + j, SV.hash(i, j, seed) < 0.5 ? '#4f9a3e' : '#3e7d33');
    }
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function scrapHeap(seed) {
    const p = new Art.Pix(18, 13);
    const rnd = SV.rng(seed);
    for (let i = 0; i < 26; i++) {
      const x = rnd.int(2, 14), y = rnd.int(4, 10);
      const w = rnd.int(2, 4), h = rnd.int(1, 3);
      p.rect(x, y - Math.max(0, 4 - Math.abs(x - 8) / 2), w, h, rnd.pick(['#7b8494', '#9aa3b2', '#5a6170', '#a8643a', '#c9842e', '#4d5562']));
    }
    p.set(8, 3, '#ffd25e');
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function log(seed) {
    const p = new Art.Pix(20, 12);
    p.rect(2, 3, 16, 7, '#7a5232');
    p.rect(2, 3, 16, 2, '#9a6c42');
    p.rect(2, 9, 16, 1, '#5a3a22');
    p.ellipse(3, 6.5, 2.5, 3.6, (x, y, nx, ny, r) => (r < 0.35 ? '#b88a5a' : '#d8b080'));
    for (let x = 5; x < 18; x++) if (SV.hash(x, 0, seed) < 0.6) p.set(x, 2, '#5aa04a');
    p.set(12, 1, '#5aa04a');
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function barricade(frame) {
    const p = new Art.Pix(16, 22);
    p.rect(0, 2, 3, 20, '#5a6170');
    p.rect(13, 2, 3, 20, '#5a6170');
    p.rect(0, 2, 1, 20, '#8a93a2');
    p.set(1, 3, '#ff4a3a');
    p.set(14, 3, '#ff4a3a');
    for (let y = 5; y < 20; y++)
      for (let x = 3; x < 13; x++) {
        const s = (x + y + frame * 2) % 6;
        if (s < 2) p.set(x, y, s === 0 ? '#ff6a8a' : '#5ee8f5', 200);
      }
    p.rect(3, 7, 10, 2, '#454d60');
    p.rect(3, 15, 10, 2, '#454d60');
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function pylon(lit) {
    const p = new Art.Pix(12, 32);
    p.rect(5, 4, 2, 27, '#5a6170');
    p.rect(1, 6, 10, 2, '#454d60');
    p.set(1, 8, lit ? '#7ff3ff' : '#8a93a2');
    p.set(10, 8, lit ? '#7ff3ff' : '#8a93a2');
    p.rect(4, 0, 4, 4, lit ? '#7ff3ff' : '#6c778c');
    p.rect(3, 28, 6, 3, '#454d60');
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function reactor(seed) {
    const p = new Art.Pix(44, 36);
    p.rect(2, 22, 40, 12, '#6c7380');
    p.rect(2, 22, 40, 2, '#8a919e');
    p.ellipse(22, 22, 18, 17, (x, y, nx, ny) => {
      if (y > 22) return null;
      const crack = SV.hash(x, y, seed) < 0.1;
      if (crack) return '#2a3440';
      return nx + ny < -0.5 ? '#9ad0dc' : '#5a8a98';
    });
    p.rect(17, 25, 10, 9, '#2a3440');
    p.rect(19, 27, 6, 2, '#ffb02e');
    for (let i = 0; i < 44; i++) {
      const len = Math.floor(SV.hash(i, 9, seed) * 14);
      for (let j = 0; j < len; j++) if (SV.hash(i, j, seed + 2) < 0.7) p.set(i, 34 - j, SV.hash(i, j, 3) < 0.5 ? '#4f9a3e' : '#3e7d33');
    }
    p.outline('#1b1d26');
    return p.toCanvas();
  }

  function crystal() {
    const p = new Art.Pix(12, 18);
    const shard = (x0, y0, h, w) => {
      for (let y = 0; y < h; y++) {
        const ww = Math.max(1, Math.round(w * Math.min(1, (y + 1) / (h * 0.45))));
        for (let i = 0; i < ww; i++) p.set(x0 + i - (ww >> 1), y0 + y, i === 0 ? '#e4fdff' : i === ww - 1 ? '#7a5ae0' : y % 4 === 0 ? '#b6f7ff' : '#62d6f2');
      }
    };
    shard(6, 1, 15, 4);
    shard(3, 7, 9, 3);
    shard(9, 6, 10, 3);
    p.rect(2, 16, 9, 1, '#4a3a8a');
    p.outline('#241a4a');
    return p.toCanvas();
  }

  function chest(open) {
    const p = new Art.Pix(15, 13);
    p.rect(1, 5, 13, 7, '#9a6a3a');
    p.rect(1, 5, 13, 1, '#b8844e');
    p.rect(1, 8, 13, 1, '#6a4424');
    if (!open) {
      p.rect(1, 1, 13, 4, '#a8743e');
      p.rect(1, 1, 13, 1, '#c89458');
      p.rect(6, 4, 3, 3, '#5ee8f5');
      p.set(7, 5, '#e4feff');
    } else {
      p.rect(1, 0, 13, 2, '#7a5230');
      p.rect(2, 5, 11, 2, '#3a2414');
      p.set(5, 5, '#ffd25e');
      p.set(9, 5, '#5ee8f5');
    }
    p.outline('#1b1730');
    return p.toCanvas();
  }

  function forge() {
    const p = new Art.Pix(34, 30);
    // stenugn
    p.rect(2, 6, 16, 22, '#7a7f88');
    for (let y = 6; y < 28; y += 4) for (let x = 2 + ((y / 4) % 2) * 3; x < 18; x += 6) p.rect(x, y, 1, 4, '#5d616b');
    p.rect(2, 6, 16, 1, '#9aa0a8');
    p.rect(5, 15, 10, 8, '#2a1a14');
    p.rect(6, 17, 8, 6, '#ff8a2a');
    p.rect(7, 19, 6, 4, '#ffd25e');
    p.rect(8, 0, 4, 6, '#5d616b');
    // städ
    p.rect(21, 18, 12, 3, '#4a5160');
    p.rect(19, 17, 6, 2, '#4a5160');
    p.rect(24, 21, 5, 4, '#3a404c');
    p.rect(22, 25, 9, 3, '#3a404c');
    p.rect(21, 18, 12, 1, '#8a93a2');
    // skrot-plåt
    p.rect(26, 13, 6, 4, '#5ee8f5');
    p.rect(27, 14, 4, 2, '#b6f7ff');
    p.outline('#1b1730');
    return p.toCanvas();
  }

  function tent() {
    const p = new Art.Pix(32, 26);
    for (let y = 2; y < 25; y++) {
      const hw = (y - 2) * 0.68;
      for (let x = 0; x < 32; x++) {
        const dx = x + 0.5 - 16;
        if (Math.abs(dx) > hw) continue;
        let col = dx < 0 ? '#d9a85a' : '#b9883e';
        if (Math.abs(dx) < 3 && y > 13) col = '#3a2a1e';
        if (y % 6 === 0) col = SV.shadeHex(col, -0.12);
        p.set(x, y, col);
      }
    }
    p.set(16, 1, '#6a4428');
    p.set(16, 0, '#ff6a8a');
    p.outline('#1b1730');
    return p.toCanvas();
  }

  function campfire(frame) {
    const p = new Art.Pix(14, 14);
    p.rect(2, 10, 10, 2, '#7a5232');
    p.rect(4, 9, 6, 1, '#5a3a22');
    const heights = [[6, 4, 5], [5, 6, 4], [4, 5, 6]][frame];
    heights.forEach((h, i) => {
      const x = 4 + i * 2;
      for (let y = 0; y < h; y++) p.set(x, 9 - y, y > h - 2 ? '#ffe28a' : y > 1 ? '#ff9a2a' : '#ff5a2a');
      for (let y = 0; y < h - 2; y++) p.set(x + 1, 9 - y, '#ffb84a');
    });
    p.outline('#1b1730');
    return p.toCanvas();
  }

  function urkarnan(lit) {
    const W = 72, H = 88;
    const p = new Art.Pix(W, H);
    // rötter och stam
    for (let y = 40; y < H - 2; y++) {
      const spread = y > 74 ? (y - 74) * 1.6 : 0;
      const hw = 9 + spread;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - W / 2;
        if (Math.abs(dx) > hw) continue;
        if (spread && Math.abs(dx) > 9 && SV.hash(x, y, 77) < 0.35) continue;
        p.set(x, y, dx < -3 ? '#8a6040' : dx > 4 ? '#4e3220' : '#6c4a30');
      }
    }
    // kärnan
    p.ellipse(W / 2, 60, 4.5, 7, (x, y, nx, ny, r) => (lit ? (r < 0.4 ? '#ffffff' : '#7ff3ff') : r < 0.4 ? '#7a6aa8' : '#4a3a7a'));
    // krona
    const blobs = [[36, 22, 22, 17], [18, 30, 14, 11], [54, 30, 14, 11], [36, 10, 14, 10], [24, 16, 11, 9], [48, 16, 11, 9]];
    blobs.forEach(([cx, cy, rx, ry], i) =>
      p.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
        const h = SV.hash(x, y, 31 + i);
        if (lit && h < 0.025) return '#b6f7ff';
        if (nx + ny < -0.7) return '#8fd06a';
        if (nx + ny > 0.6) return '#2d6a44';
        return h < 0.5 ? '#4d9a50' : '#5fae58';
      })
    );
    p.outline('#132219');
    return p.toCanvas();
  }

  function bridgePosts() {
    const p = new Art.Pix(16, 12);
    p.rect(1, 2, 3, 9, '#7a5232');
    p.rect(12, 2, 3, 9, '#7a5232');
    p.rect(1, 2, 3, 1, '#a8784a');
    p.rect(12, 2, 3, 1, '#a8784a');
    p.line(3, 4, 12, 6, '#d8c08a');
    p.outline('#1b1730');
    return p.toCanvas();
  }

  function mound(sparkle) {
    const p = new Art.Pix(10, 6);
    p.ellipse(5, 4, 4.5, 2, '#7a5a3a');
    p.rect(3, 3, 4, 1, '#9a7650');
    if (sparkle) p.set(5, 2, '#ffd25e');
    p.outline('#2a1a10');
    return p.toCanvas();
  }

  function pickupScrap() {
    const p = new Art.Pix(9, 9);
    p.ellipse(4.5, 4.5, 3.6, 3.6, '#a3afc2');
    p.ellipse(4.5, 4.5, 1.3, 1.3, '#454d60');
    [[4, 0], [4, 8], [0, 4], [8, 4]].forEach(([x, y]) => p.set(x, y, '#a3afc2'));
    p.set(3, 2, '#e8eef6');
    p.outline('#1b1d26');
    return p.toCanvas();
  }
  function pickupChip() {
    const p = new Art.Pix(9, 9);
    p.rect(2, 2, 5, 5, '#2f8a5a');
    p.rect(3, 3, 3, 3, '#ffd25e');
    for (let i = 2; i < 7; i += 2) {
      p.set(i, 1, '#d8dde6');
      p.set(i, 7, '#d8dde6');
      p.set(1, i, '#d8dde6');
      p.set(7, i, '#d8dde6');
    }
    p.outline('#14231a');
    return p.toCanvas();
  }
  function pickupBerry() {
    const p = new Art.Pix(9, 9);
    p.ellipse(3.5, 5, 2.4, 2.4, '#d8324a');
    p.ellipse(6, 5.5, 2.2, 2.2, '#b8243a');
    p.set(3, 4, '#ff9aa8');
    p.rect(4, 1, 2, 2, '#4f9a3e');
    p.outline('#2a1020');
    return p.toCanvas();
  }

  function heartCell(full) {
    const p = new Art.Pix(7, 10);
    p.rect(2, 0, 3, 1, '#c9d2de');
    p.rect(0, 1, 7, 9, '#2a3040');
    if (full === 2) p.rect(1, 2, 5, 7, '#5ef59a');
    if (full === 1) p.rect(1, 6, 5, 3, '#ffcf5a');
    if (full === 2) p.rect(1, 2, 2, 7, '#a8ffcc');
    return p.toCanvas();
  }

  // ------------------------------------------------------------------
  function build() {
    const SPR = (SV.SPR = SV.SPR || {});
    SPR.signeBase = buildSigneBase;
    SPR.buildSigne = buildSigne;
    SPR.ARMOR_TARGETS = ARMOR_TARGETS;
    SPR.SIGNE_PAL = SIGNE_PAL;

    SPR.animals = {};
    for (const [name, def] of Object.entries(ANIMAL_MAPS)) {
      const right = def.frames.map((rows) => Art.fromMap(rows, def.pal));
      SPR.animals[name] = { right, left: right.map((f) => Art.flip(f)) };
    }
    SPR.animals.owl = buildOwl();

    const bear = BEAR_LEGS.map((legs) => Art.fromMap(BEAR_TOP.concat(legs), ROBOT_PAL));
    const drone = [DRONE_HALF_A, DRONE_HALF_B].map((h) => Art.fromMap(Art.mirror(h), ROBOT_PAL));
    const hound = HOUND_FRAMES.map((rows) => Art.fromMap(rows, ROBOT_PAL));
    SPR.robots = {
      bear: robotVariants(bear, false),
      drone: robotVariants(drone, false),
      hound: robotVariants(hound, true),
    };

    SPR.obj = {
      pine: [0, 1, 2, 3].map((i) => pine(100 + i, false, false)),
      pineSnow: [0, 1, 2].map((i) => pine(200 + i, true, false)),
      spruce: [0, 1].map((i) => pine(300 + i, true, true)),
      spruceDark: [0, 1].map((i) => pine(350 + i, false, true)),
      birch: [0, 1, 2].map((i) => birch(400 + i)),
      rock: [0, 1].map((i) => rock(500 + i, false)),
      rockMoss: [0, 1].map((i) => rock(520 + i, true)),
      runestone: runestone(false),
      runestoneLit: runestone(true),
      ruin: [0, 1, 2].map((i) => ruinWall(600 + i)),
      scrapHeap: [0, 1].map((i) => scrapHeap(700 + i)),
      log: log(800),
      barricade: [barricade(0), barricade(1), barricade(2)],
      pylon: pylon(false),
      pylonLit: pylon(true),
      reactor: reactor(900),
      crystal: crystal(),
      chest: chest(false),
      chestOpen: chest(true),
      forge: forge(),
      tent: tent(),
      campfire: [campfire(0), campfire(1), campfire(2)],
      urkarnan: urkarnan(false),
      urkarnanLit: urkarnan(true),
      bridgePosts: bridgePosts(),
      mound: mound(false),
      moundSparkle: mound(true),
    };
    SPR.pickup = { scrap: pickupScrap(), chip: pickupChip(), berry: pickupBerry() };
    SPR.cells = [heartCell(0), heartCell(1), heartCell(2)];
    return SPR;
  }

  SV.Sprites = { build, ARMOR_TARGETS, SIGNE_PAL };
})();
