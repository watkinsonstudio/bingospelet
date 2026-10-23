// ui.js – HUD, ikoner, notiser, dialoger och menyer (DOM-lagret).
(function () {
  'use strict';
  const SV = window.SV;
  const $ = (id) => document.getElementById(id);

  // ---------- Pixelikoner ----------
  function icon(rows, pal) {
    return SV.Art.fromMap(rows, pal).toDataURL();
  }
  function makeIcons() {
    const W = '#ffffff';
    return {
      staff: icon(['....yy', '...yy.', '..yyyy', '....yy', '...yy.', '..yy..', '.yy...'], { y: W }),
      frost: icon(['...w...', '.w.w.w.', '..www..', 'wwwwwww', '..www..', '.w.w.w.', '...w...'], { w: W }),
      coop: icon(['.w...w.', '.w...w.', '...w...', 'w.....w', '..www..', '.wwwww.', '.wwwww.'], { w: W }),
      super: icon(['...w...', '...w...', 'wwwwwww', '.wwwww.', '..www..', '.ww.ww.', 'ww...ww'], { w: W }),
      interact: icon(['..w.w..', '..w.w.w', 'w.wwwww', 'wwwwwww', '.wwwwww', '..wwww.', '..wwww.'], { w: W }),
      menu: icon(['wwwwwww', '.......', 'wwwwwww', '.......', 'wwwwwww'], { w: '#f1ece0' }),
      scrap: SV.SPR.pickup.scrap.toDataURL(),
      chip: SV.SPR.pickup.chip.toDataURL(),
      crystal: icon(['..c..', '.cCc.', '.cCc.', 'cCCCc', 'cCCCc', '.cCc.', '..c..'], { c: '#62d6f2', C: '#e4fdff' }),
    };
  }

  const UI = {
    icons: null,
    _last: {},
    _toastT: 0,
    _bannerT: 0,

    init(game) {
      this.game = game;
      this.icons = makeIcons();
      const setImg = (sel, key) => document.querySelectorAll(sel).forEach((img) => (img.src = this.icons[key]));
      setImg('#b-staff img', 'staff');
      setImg('#b-frost img', 'frost');
      setImg('#b-coop img', 'coop');
      setImg('#b-super img', 'super');
      setImg('#b-interact img', 'interact');
      $('ic-menu').src = this.icons.menu;
      $('ic-scrap').src = this.icons.scrap;
      $('ic-chip').src = this.icons.chip;
      $('ic-crystal').src = this.icons.crystal;

      $('menu-btn').addEventListener('click', () => this.openMenu());
      $('companion-card').addEventListener('click', () => this.openMenu('comps'));
      $('btn-resume').addEventListener('click', () => this.closeMenu());
      document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
      document.querySelectorAll('[data-ftab]').forEach((b) => b.addEventListener('click', () => SV.Forge.setTab(b.dataset.ftab)));
      $('btn-forge-close').addEventListener('click', () => SV.Forge.close());
      $('btn-sound').addEventListener('click', () => {
        SV.Sfx.unlock();
        SV.Sfx.setMuted(!SV.Sfx.muted);
        $('btn-sound').textContent = 'Ljud: ' + (SV.Sfx.muted ? 'av' : 'på');
        SV.store.set('sv-muted', SV.Sfx.muted);
      });
      $('btn-home').addEventListener('click', () => {
        this.closeMenu();
        game.returnToBase('Signe tar genvägen hem till Skogsbasen.');
      });
      $('btn-new').addEventListener('click', () =>
        this.confirm('Börja om från början? Allt du samlat försvinner.', () => {
          game.newGame();
          this.closeMenu();
        })
      );
      $('btn-win-close').addEventListener('click', () => {
        $('panel-win').hidden = true;
        game.pause(false);
      });
      $('dialog').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.closeDialog();
      });
      const muted = SV.store.get('sv-muted');
      if (muted) {
        SV.Sfx.setMuted(true);
        $('btn-sound').textContent = 'Ljud: av';
      }
    },

    // ---------- HUD ----------
    update(game) {
      const p = game.player;
      const L = this._last;
      const e = Math.round(p.energy * 2) / 2;
      if (L.energy !== e || L.maxE !== p.maxEnergy) {
        L.energy = e;
        L.maxE = p.maxEnergy;
        this.drawCells(p);
      }
      if (L.shield !== p.shield) {
        L.shield = p.shield;
        $('shield').hidden = !p.shield;
        $('shield').textContent = 'SKÖLD ×' + p.shield;
      }
      const cool = Math.round((p.coolant / p.maxCoolant) * 100);
      if (L.cool !== cool) {
        L.cool = cool;
        $('cool-bar').firstElementChild.style.width = cool + '%';
      }
      if (L.scrap !== p.scrap) $('r-scrap').textContent = L.scrap = p.scrap;
      if (L.chips !== p.chips) $('r-chips').textContent = L.chips = p.chips;
      const cr = game.crystalCount();
      const crText = cr + '/' + game.CRYSTALS_NEEDED;
      if (L.cr !== crText) $('r-crystals').textContent = L.cr = crText;

      const s = Math.round(game.env.storm_intensity * 100);
      if (L.storm !== s) {
        L.storm = s;
        $('storm-bar').firstElementChild.style.width = s + '%';
        $('storm-state').textContent = game.env.label();
      }
      const sec = game.currentSector ? game.currentSector.name : '';
      if (L.sec !== sec) $('sector-name').textContent = (L.sec = sec).toUpperCase();

      // djurkompis
      const c = game.companions.active;
      if (c) {
        const key = [c.kind, c.current_level, Math.floor(c.current_xp), c.is_super_available, Math.floor(c.super_meter)].join('|');
        if (L.comp !== key) {
          L.comp = key;
          $('comp-name').textContent = c.companion_name;
          $('comp-level').textContent = `NIVÅ ${c.current_level} · ${c.title.toUpperCase()}`;
          const need = c.xp_to_next_level[c.current_level - 1];
          $('comp-xp').firstElementChild.style.width = (c.current_level >= 3 ? 100 : (c.current_xp / need) * 100) + '%';
          const sup = $('comp-super');
          sup.className = c.current_level < 3 ? 'locked' : c.is_super_available ? 'ready' : '';
          sup.firstChild.textContent = c.current_level < 3 ? 'SUPER NIVÅ 3 ' : c.is_super_available ? 'SUPER REDO ' : 'SUPER ';
          sup.querySelector('i').style.width = (c.current_level < 3 ? 0 : c.super_meter) + '%';
          const bs = $('b-super');
          bs.classList.toggle('locked', c.current_level < 3);
          bs.classList.toggle('ready', c.is_super_available);
          bs.querySelector('span').textContent = c.current_level < 3 ? 'SUPER' : c.info.super.name.toUpperCase();
          $('coop-label').textContent = c.coop().name.toUpperCase();
          this.drawPortrait($('comp-portrait'), c);
        }
        const cd = Math.ceil(c.coopCd);
        if (L.cd !== cd) {
          L.cd = cd;
          $('b-coop').classList.toggle('cd', cd > 0);
          $('coop-cd').textContent = cd > 0 ? cd : '';
        }
      }
      // kontextknapp
      const it = game.interactTarget;
      const label = it ? it.label : '';
      if (L.it !== label) {
        L.it = label;
        $('b-interact').hidden = !it;
        $('interact-label').textContent = label.toUpperCase();
      }
      if (this._toastT > 0) {
        this._toastT -= game.dt;
        if (this._toastT <= 0) $('toast').classList.remove('on');
      }
      if (this._bannerT > 0) {
        this._bannerT -= game.dt;
        if (this._bannerT <= 0) $('banner').classList.remove('on');
      }
      this.drawMinimap(game);
    },

    drawCells(p) {
      const c = $('energy-cells');
      const n = p.maxEnergy / 2;
      c.width = n * 8;
      c.height = 11;
      const k = window.innerHeight < 460 ? 2 : 2.6;
      c.style.width = n * 8 * k + 'px';
      c.style.height = 11 * k + 'px';
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < n; i++) {
        const v = SV.clamp(p.energy - i * 2, 0, 2);
        const st = v >= 1.5 ? 2 : v >= 0.5 ? 1 : 0;
        g.drawImage(SV.SPR.cells[st], i * 8, 0);
      }
    },

    drawPortrait(canvas, c) {
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const spr = c.kind === 'owl' ? SV.SPR.animals.owl.perched : SV.SPR.animals[c.kind].right[0];
      const s = Math.min(1, 20 / Math.max(spr.width, spr.height));
      const w = spr.width * s, h = spr.height * s;
      g.drawImage(spr, (canvas.width - w) / 2, (canvas.height - h) / 2 + 1, w, h);
    },

    drawMinimap(game, target, big) {
      const canvas = target || $('minimap');
      const w = game.world;
      if (!game.miniBase) return;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(game.miniBase, 0, 0, canvas.width, canvas.height);
      const sx = canvas.width / w.W, sy = canvas.height / w.H;
      const dot = (tx, ty, col, r = 1) => {
        g.fillStyle = col;
        g.fillRect(Math.round(tx * sx - r), Math.round(ty * sy - r), r * 2 + (big ? 1 : 0), r * 2 + (big ? 1 : 0));
      };
      const owl2 = game.companions.activeKind === 'owl' && game.companions.active.current_level >= 2;
      const blink = Math.floor(game.time * 3) % 2 === 0;
      w.crystals.forEach((c) => {
        if (c.taken || (c.buried && !owl2)) return;
        if (owl2 || c.seen || w.revealed[c.ty * w.W + c.tx]) if (blink || big) dot(c.tx + 0.5, c.ty + 0.5, '#7ff3ff', big ? 2 : 1);
      });
      if (owl2) w.chests.forEach((k) => !k.open && dot(k.tx + 0.5, k.ty + 0.5, '#ffcf5a', big ? 2 : 1));
      dot(w.base.x, w.base.y, '#ff9a2a', big ? 2 : 1);
      dot(w.core.x / 16, w.core.y / 16, '#a98aff', big ? 3 : 1.5);
      w.animals.forEach((a) => !a.met && w.revealed[Math.floor(a.y / 16) * w.W + Math.floor(a.x / 16)] && dot(a.x / 16, a.y / 16, '#8fcf6a', big ? 2 : 1));
      dot(game.player.x / 16, game.player.y / 16, '#ffffff', big ? 2.5 : 1.5);
    },

    // ---------- Notiser ----------
    toast(text, secs = 2.6) {
      const t = $('toast');
      t.textContent = text;
      t.classList.add('on');
      this._toastT = secs;
    },
    banner(sub, title) {
      $('banner-sub').textContent = sub;
      $('banner-title').textContent = title;
      $('banner').classList.add('on');
      this._bannerT = 2.6;
    },
    dialog(html) {
      const d = $('dialog');
      d.innerHTML = html + '<small>TRYCK FÖR ATT STÄNGA</small>';
      d.hidden = false;
      this.dialogOpen = true;
    },
    closeDialog() {
      $('dialog').hidden = true;
      this.dialogOpen = false;
    },
    confirm(text, onYes) {
      $('confirm-text').textContent = text;
      $('panel-confirm').hidden = false;
      const close = () => ($('panel-confirm').hidden = true);
      $('btn-confirm-yes').onclick = () => {
        close();
        onYes();
      };
      $('btn-confirm-no').onclick = close;
    },

    // ---------- Meny ----------
    openMenu(tab) {
      this.game.pause(true);
      $('panel-menu').hidden = false;
      this.setTab(tab || this.menuTab || 'comps');
    },
    closeMenu() {
      $('panel-menu').hidden = true;
      this.game.pause(false);
    },
    setTab(t) {
      this.menuTab = t;
      document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      ['comps', 'map', 'help', 'test'].forEach((k) => ($('tab-' + k).hidden = k !== t));
      if (t === 'comps') this.renderComps();
      if (t === 'map') this.renderMap();
      if (t === 'help') this.renderHelp();
      if (t === 'test') this.renderTest();
    },

    renderComps() {
      const game = this.game;
      const cm = game.companions;
      const el = $('tab-comps');
      el.innerHTML = `<p>Ett djur i taget följer med Signe. De andra väntar vid lägerelden i Skogsbasen. Djuren får erfarenhet när ni utforskar, löser hinder och kortsluter robotar tillsammans.</p>
      <div class="comp-list" style="margin-top:10px">${SV.COMPANION_ORDER.map((k) => {
        const info = SV.COMPANION_INFO[k];
        const c = cm.roster[k];
        const got = cm.unlocked.includes(k);
        if (!got) return `<div class="comp locked"><header><canvas width="22" height="22" data-por="${k}"></canvas><div><h3>???</h3><small class="ptag">${info.trait}</small></div></header><p>Någonstans i skogen väntar ett djur på att bli din vän.</p></div>`;
        const lvl = c.current_level;
        const need = c.xp_to_next_level[lvl - 1];
        const xpPct = lvl >= 3 ? 100 : (c.current_xp / need) * 100;
        return `<div class="comp ${cm.activeKind === k ? 'active' : ''}">
          <header><canvas width="22" height="22" data-por="${k}"></canvas><div><h3>${info.name}</h3><div class="eyebrow" style="color:var(--moss)">NIVÅ ${lvl} · ${c.title.toUpperCase()}</div></div></header>
          <div class="bar"><i style="width:${xpPct}%"></i></div>
          <small style="color:var(--birch-dim)">${lvl >= 3 ? 'Maxnivå' : Math.floor(c.current_xp) + ' / ' + need + ' erfarenhet'} · Fokus: ${info.focus}</small>
          <ol>${info.levels.map((t, i) => `<li class="${i < lvl ? 'got' : ''}">${t}</li>`).join('')}</ol>
          <small style="color:var(--birch-dim)"><b style="color:var(--birch)">Samarbete:</b> ${c.coop().name} – ${c.coop().desc}</small>
          <small style="color:var(--birch-dim)"><b style="color:var(--amber)">Superattack ${info.super.name}:</b> ${info.super.desc}</small>
          ${cm.activeKind === k ? '<span class="eyebrow">FÖLJER MED</span>' : `<button class="pbtn" type="button" data-pick="${k}">Ta med ${info.name.toLowerCase()}</button>`}
        </div>`;
      }).join('')}</div>`;
      el.querySelectorAll('[data-por]').forEach((cv) => {
        const k = cv.dataset.por;
        if (cm.roster[k]) this.drawPortrait(cv, cm.roster[k]);
        else {
          this.drawPortrait(cv, { kind: k });
          const g = cv.getContext('2d');
          g.globalCompositeOperation = 'source-in';
          g.fillStyle = '#2f4c3d';
          g.fillRect(0, 0, 22, 22);
        }
      });
      el.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          cm.setActive(b.dataset.pick);
          SV.Sfx.play('ui');
          this.renderComps();
        })
      );
    },

    renderMap() {
      const el = $('tab-map');
      const game = this.game;
      el.innerHTML = `<div class="row" style="align-items:flex-start;gap:16px">
        <canvas id="bigmap" width="192" height="256" style="width:min(288px,70vw);height:auto;aspect-ratio:3/4;box-shadow:var(--frame)"></canvas>
        <div style="display:grid;gap:8px;min-width:0;flex:1">
          <div class="eyebrow">TECKEN</div>
          <small class="keys">VIT – SIGNE<br>ORANGE – SKOGSBASEN<br>LILA – URKÄRNAN<br>CYAN – ENERGIKRISTALL<br>GRÖN – DJUR SOM VÄNTAR<br>GUL – KISTA (UGGLAN NIVÅ 2)</small>
          <div class="eyebrow">KRISTALLER</div>
          <p>${game.world.crystals.filter((c) => c.taken).length} av 12 hittade. ${game.CRYSTALS_NEEDED} behövs för att väcka Urkärnan längst i norr.</p>
          <p>Utforskat: ${Math.round(game.world.revealedFraction() * 100)} % av skogen.</p>
        </div>
      </div>`;
      this.drawMinimap(game, $('bigmap'), true);
    },

    renderHelp() {
      $('tab-help').innerHTML = `<div style="display:grid;gap:10px">
        <p><b style="color:var(--birch)">Röra sig:</b> dra tummen i vänstra halvan av skärmen (WASD på tangentbord).</p>
        <p><b style="color:var(--birch)">El-stav:</b> tryck för en snabb elstöt. Håll in en stund och släpp för en EMP-pulsvåg som slår ut robotarnas motorer runt dig.</p>
        <p><b style="color:var(--birch)">Fryskastare:</b> skjuter salvor av flytande kväve. Tre träffar fryser en robot helt. En frusen robot tar 50 % mer skada av El-staven.</p>
        <p><b style="color:var(--birch)">Samarbete och Superattack:</b> varje djur har en egen samarbetsförmåga. På nivå 3 låses Superattacken upp; mätaren fylls när ni kortsluter robotar tillsammans.</p>
        <p><b style="color:var(--birch)">Tidsstormen:</b> ingen klocka tickar. Stormen laddas upp när ni utforskar nya delar av skogen, och varje energikristall pressar tillbaka den. Ju högre storm, desto snabbare och vaksammare robotar.</p>
        <p><b style="color:var(--birch)">Smedjan:</b> i Skogsbasen byter du rustningens färger och uppgraderar vapnen med skrot och kretsar. Rustningens stil påverkar robotarna: kamouflage gör dig svårare att upptäcka, neon lockar robotar men skrämmer drönare, grafit isolerar mot elstötar.</p>
        <p><b style="color:var(--birch)">Ingen fara:</b> tar energin slut går Signe tillbaka till Skogsbasen och behåller allt hon samlat.</p>
      </div>`;
    },

    renderTest() {
      const game = this.game;
      const el = $('tab-test');
      el.innerHTML = `<div class="test-grid">
        <p>Verktyg för att prova mekaniken i prototypen.</p>
        <label for="t-storm" class="eyebrow">STORM_INTENSITY: <span id="t-storm-v">${game.env.storm_intensity.toFixed(2)}</span></label>
        <input type="range" id="t-storm" min="0" max="1" step="0.01" value="${game.env.storm_intensity}">
        <div class="row">
          <button class="pbtn" type="button" id="t-shout">Testa Sköldskall mot 4 robotar</button>
          <button class="pbtn" type="button" id="t-all">Lås upp alla djur</button>
          <button class="pbtn" type="button" id="t-max">Aktivt djur till nivå 3</button>
          <button class="pbtn" type="button" id="t-res">+50 skrot, +10 kretsar</button>
          <button class="pbtn" type="button" id="t-crys">+1 kristall</button>
          <button class="pbtn" type="button" id="t-fog">Lyft all dimma</button>
        </div>
        <p id="t-log" class="keys"></p>
      </div>`;
      const slider = $('t-storm');
      slider.addEventListener('input', () => {
        game.env.storm_intensity = parseFloat(slider.value);
        game.env.visual = game.env.storm_intensity;
        game.env._updateEnvironment();
        $('t-storm-v').textContent = game.env.storm_intensity.toFixed(2);
      });
      $('t-shout').addEventListener('click', () => {
        const log = game.testShieldBark();
        this.closeMenu();
        this.toast(log, 4);
      });
      $('t-all').addEventListener('click', () => {
        SV.COMPANION_ORDER.forEach((k) => game.companions.unlock(k, false));
        game.world.animals.forEach((a) => (a.met = true));
        $('t-log').textContent = 'ALLA DJUR VÄNTAR VID LÄGERELDEN.';
      });
      $('t-max').addEventListener('click', () => {
        const c = game.companions.active;
        while (c.current_level < 3) c.add_xp(c.xp_to_next_level[c.current_level - 1]);
        $('t-log').textContent = c.companion_name.toUpperCase() + ' ÄR NU NIVÅ 3.';
      });
      $('t-res').addEventListener('click', () => {
        game.player.scrap += 50;
        game.player.chips += 10;
        $('t-log').textContent = 'RESURSER TILLAGDA.';
      });
      $('t-crys').addEventListener('click', () => {
        const c = game.world.crystals.find((x) => !x.taken);
        if (c) game.takeCrystal(c);
        $('t-log').textContent = 'KRISTALL TILLAGD.';
      });
      $('t-fog').addEventListener('click', () => {
        game.world.reveal(48 * 16, 64 * 16, 200);
        game.rebuildMinimap();
        $('t-log').textContent = 'DIMMAN ÄR BORTA.';
      });
    },
  };

  SV.UI = UI;
})();
