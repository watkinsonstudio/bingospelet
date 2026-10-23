// ui.js – HUD, notiser, dialoger, menyer och galleri (DOM-lagret).
// Menyerna går att styra med mus, tangentbord och handkontroll.
(function () {
  'use strict';
  const SV = window.SV;
  const $ = (id) => document.getElementById(id);

  const GALLERY = [
    { key: 'signe', name: 'Signe', sub: 'Skogens väktare', text: 'Nioårig alvkrigare i heltäckande bladrustning. Väktarbågens bladkanter laddas med el i närstrid, och pilarna är fyllda med flytande kväve som fryser robotarnas hydraulik.' },
    ...['dog', 'lynx', 'owl', 'moose', 'fox', 'beaver'].map((k) => ({ key: 'comp:' + k, comp: k })),
    { key: 'robot:bear', name: 'Björnrobot', sub: 'Tung närstrid', text: 'Trög men kraftfull. Laddar upp ett hydrauliskt slag framför sig. Frys den och gör sedan ett elhugg, så tar den 50 % mer skada.' },
    { key: 'robot:drone', name: 'Svävardrönare', sub: 'Avstånd och spaning', text: 'Söker av skogen med strålkastare och skjuter elbollar på avstånd. Skygga drönare flyr från neonfärgad rustning.' },
    { key: 'robot:hound', name: 'Mekanisk varg', sub: 'Snabb flock', text: 'Patrullerar i flock och gör snabba utfall. Kamouflagerustning gör det lättare att smyga förbi.' },
  ];

  const UI = {
    _last: {},
    _toastT: 0,
    _bannerT: 0,
    dialogOpen: false,

    init(game) {
      this.game = game;
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
      $('btn-quality').addEventListener('click', () => {
        const next = SV.View.quality === 'low' ? 'high' : 'low';
        this.confirm(`Byta till ${next === 'low' ? 'låg' : 'hög'} grafikkvalitet? Spelet sparas och laddas om.`, () => {
          SV.store.set('sv-quality', next);
          game.save();
          location.reload();
        });
      });
      if (SV.store.get('sv-muted')) {
        SV.Sfx.setMuted(true);
        $('btn-sound').textContent = 'Ljud: av';
      }
      this.refreshPrompts();
    },

    // Knappnamn i förmågefältet och hjälptexter följer senast använda enhet.
    refreshPrompts() {
      const L = (a) => SV.Input.label(a);
      document.querySelectorAll('[data-key]').forEach((el) => (el.textContent = L(el.dataset.key)));
      const pad = SV.Input.device === 'pad';
      $('hint-line').innerHTML = pad
        ? `<kbd>${L('swap')}</kbd> byt djur · <kbd>${L('map')}</kbd> karta · <kbd>${L('menu')}</kbd> meny · Håll <kbd>${L('staff')}</kbd> för EMP`
        : `<kbd>WASD</kbd> gå · musen siktar · <kbd>Tab</kbd> byt djur · <kbd>M</kbd> karta · <kbd>Esc</kbd> meny · Håll vänsterklick för EMP`;
      document.body.classList.toggle('pad', pad);
      this._last.it = null;
    },

    // ---------- HUD ----------
    update(game) {
      const p = game.player;
      const L = this._last;
      const e = Math.round(p.energy * 2) / 2;
      if (L.energy !== e || L.maxE !== p.maxEnergy) {
        L.energy = e;
        L.maxE = p.maxEnergy;
        const n = p.maxEnergy / 2;
        let html = '';
        for (let i = 0; i < n; i++) {
          const v = SV.clamp(p.energy - i * 2, 0, 2);
          html += `<i class="${v >= 1.5 ? 'full' : v >= 0.5 ? 'half' : ''}"></i>`;
        }
        $('energy-cells').innerHTML = html;
      }
      if (L.shield !== p.shield) {
        L.shield = p.shield;
        $('shield').hidden = !p.shield;
        $('shield').textContent = 'Sköld ×' + p.shield;
      }
      const coolKey = Math.floor(p.coolant) + '/' + p.maxCoolant;
      if (L.cool !== coolKey) {
        L.cool = coolKey;
        let html = '';
        for (let i = 0; i < p.maxCoolant; i++) html += `<i class="${i < p.coolant ? 'on' : ''}"></i>`;
        $('arrows').innerHTML = html;
      }
      if (L.scrap !== p.scrap) $('r-scrap').textContent = L.scrap = p.scrap;
      if (L.chips !== p.chips) $('r-chips').textContent = L.chips = p.chips;
      const crText = game.crystalCount() + ' / ' + game.CRYSTALS_NEEDED;
      if (L.cr !== crText) $('r-crystals').textContent = L.cr = crText;
      const s = Math.round(game.env.storm_intensity * 100);
      if (L.storm !== s) {
        L.storm = s;
        $('storm-bar').firstElementChild.style.width = s + '%';
        $('storm-state').textContent = game.env.label();
      }
      const sec = game.inGrotto ? 'Kristallgrotta' : game.currentSector ? game.currentSector.name : '';
      if (L.sec !== sec) $('sector-name').textContent = L.sec = sec;

      const c = game.companions.active;
      if (c) {
        const key = [c.kind, c.current_level, Math.floor(c.current_xp), c.is_super_available, Math.floor(c.super_meter), SV.Input.device].join('|');
        if (L.comp !== key) {
          L.comp = key;
          $('comp-name').textContent = c.companion_name;
          $('comp-level').textContent = `Nivå ${c.current_level} · ${c.title}`;
          const need = c.xp_to_next_level[c.current_level - 1];
          $('comp-xp').firstElementChild.style.width = (c.current_level >= 3 ? 100 : (c.current_xp / need) * 100) + '%';
          if (L.portrait !== c.kind && SV.View.ready) {
            L.portrait = c.kind;
            $('comp-portrait').src = SV.View.portrait(c.kind);
          }
          const sup = $('slot-super');
          sup.classList.toggle('locked', c.current_level < 3);
          sup.classList.toggle('ready', c.is_super_available);
          $('super-name').textContent = c.info.super.name;
          $('super-sub').textContent = c.current_level < 3 ? 'Låses upp på nivå 3' : c.is_super_available ? 'Redo!' : Math.floor(c.super_meter) + ' %';
          $('super-fill').style.height = (c.current_level < 3 ? 0 : c.super_meter) + '%';
          $('coop-name').textContent = c.coop().name;
        }
        const cd = Math.ceil(c.coopCd);
        if (L.cd !== cd) {
          L.cd = cd;
          $('slot-coop').classList.toggle('cd', cd > 0);
          $('coop-sub').textContent = cd > 0 ? cd + ' s' : 'Redo';
        }
      }
      const emp = p.empCd > 0 ? Math.ceil(p.empCd) : 0;
      if (L.emp !== emp) {
        L.emp = emp;
        $('staff-sub').textContent = emp ? `EMP om ${emp} s` : 'Håll in: EMP';
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

    drawMinimap(game, target, big) {
      const canvas = target || $('minimap');
      const w = game.world;
      if (!game.miniBase) return;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(game.miniBase, 0, 0, canvas.width, canvas.height);
      const sx = canvas.width / w.W, sy = canvas.height / w.H;
      const dot = (tx, ty, color, r = 1.5) => {
        g.fillStyle = color;
        g.beginPath();
        g.arc(tx * sx, ty * sy, r * (big ? 1.6 : 1), 0, Math.PI * 2);
        g.fill();
      };
      const owl2 = game.companions.activeKind === 'owl' && game.companions.active.current_level >= 2;
      const blink = Math.floor(game.time * 3) % 2 === 0;
      w.crystals.forEach((c) => {
        if (c.taken || (c.buried && !owl2)) return;
        if ((owl2 || c.seen || w.revealed[c.ty * w.W + c.tx]) && (blink || big)) dot(c.tx + 0.5, c.ty + 0.5, '#ff6ae8', 2);
      });
      if (owl2) w.chests.forEach((k) => !k.open && dot(k.tx + 0.5, k.ty + 0.5, '#ffcf5a'));
      dot(w.base.x, w.base.y, '#ff9a2a', 2);
      dot(w.core.x / 16, w.core.y / 16, '#a98aff', 2.5);
      w.animals.forEach((a) => !a.met && w.revealed[Math.floor(a.y / 16) * w.W + Math.floor(a.x / 16)] && dot(a.x / 16, a.y / 16, '#8fef8a'));
      const p = game.player;
      g.save();
      g.translate((p.x / 16) * sx, (p.y / 16) * sy);
      g.rotate(p.face + Math.PI / 2);
      g.fillStyle = '#ffffff';
      const k = big ? 2 : 1.2;
      g.beginPath();
      g.moveTo(0, -4 * k);
      g.lineTo(3 * k, 3 * k);
      g.lineTo(-3 * k, 3 * k);
      g.closePath();
      g.fill();
      g.restore();
    },

    // ---------- Notiser ----------
    toast(text, secs = 2.8) {
      const t = $('toast');
      t.textContent = text;
      t.classList.add('on');
      this._toastT = secs;
    },
    banner(sub, title) {
      $('banner-sub').textContent = sub;
      $('banner-title').textContent = title;
      $('banner').classList.add('on');
      this._bannerT = 2.8;
    },
    dialog(html) {
      const d = $('dialog');
      d.innerHTML = html + `<small><kbd>${SV.Input.device === 'pad' ? 'B' : 'Esc'}</kbd> eller klick stänger</small>`;
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
      this.focusPanel($('panel-confirm'));
    },

    // ---------- Navigering med handkontroll och piltangenter ----------
    topPanel() {
      return ['panel-confirm', 'panel-forge', 'panel-menu', 'panel-win', 'panel-title'].map($).find((p) => p && !p.hidden) || null;
    },
    focusPanel(panel) {
      const f = this.focusables(panel);
      if (f.length && SV.Input.device === 'pad') f[0].focus();
    },
    focusables(panel) {
      return Array.from(panel.querySelectorAll('button:not([disabled]), input, select')).filter((el) => el.offsetParent !== null);
    },
    navigate() {
      const In = SV.Input;
      const panel = this.topPanel();
      In.uiMode = !!panel;
      if (!panel) return;
      const list = this.focusables(panel);
      if (!list.length) return;
      let i = list.indexOf(document.activeElement);
      const move = (d) => {
        i = i < 0 ? 0 : (i + d + list.length) % list.length;
        list[i].focus();
        list[i].scrollIntoView({ block: 'nearest' });
        SV.Sfx.play('ui');
      };
      if (In.pressed('ui_down') || In.pressed('ui_right')) move(1);
      if (In.pressed('ui_up') || In.pressed('ui_left')) move(-1);
      if (In.pressed('ui_accept') && In.device === 'pad' && i >= 0) list[i].click();
    },

    // ---------- Meny ----------
    openMenu(tab) {
      this.game.pause(true);
      $('btn-quality').textContent = 'Grafik: ' + (SV.View.quality === 'low' ? 'låg' : 'hög');
      $('panel-menu').hidden = false;
      this.setTab(tab || this.menuTab || 'comps');
      this.focusPanel($('panel-menu'));
    },
    closeMenu() {
      $('panel-menu').hidden = true;
      cancelAnimationFrame(this._galRaf);
      this.game.pause(false);
    },
    setTab(t) {
      this.menuTab = t;
      cancelAnimationFrame(this._galRaf);
      document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      ['comps', 'map', 'gallery', 'help', 'test'].forEach((k) => ($('tab-' + k).hidden = k !== t));
      if (t === 'comps') this.renderComps();
      if (t === 'map') this.renderMap();
      if (t === 'gallery') this.renderGallery();
      if (t === 'help') this.renderHelp();
      if (t === 'test') this.renderTest();
    },

    renderComps() {
      const game = this.game;
      const cm = game.companions;
      const el = $('tab-comps');
      el.innerHTML = `<p>Ett djur i taget följer med Signe. De andra väntar vid lägerelden i Skogsbasen. Djuren får erfarenhet när ni utforskar, löser hinder och kortsluter robotar tillsammans.</p>
      <div class="comp-list">${SV.COMPANION_ORDER.map((k) => {
        const info = SV.COMPANION_INFO[k];
        const c = cm.roster[k];
        const got = cm.unlocked.includes(k);
        const img = SV.View.ready ? SV.View.portrait(k) : '';
        if (!got) return `<div class="comp locked"><header><img src="${img}" alt=""><div><h3>Okänd vän</h3><small class="muted">${info.trait}</small></div></header><p>Någonstans i skogen väntar ett djur på att bli din vän.</p></div>`;
        const lvl = c.current_level;
        const need = c.xp_to_next_level[lvl - 1];
        const xpPct = lvl >= 3 ? 100 : (c.current_xp / need) * 100;
        return `<div class="comp ${cm.activeKind === k ? 'active' : ''}">
          <header><img src="${img}" alt=""><div><h3>${info.name}</h3><div class="eyebrow">NIVÅ ${lvl} · ${c.title.toUpperCase()}</div></div></header>
          <div class="bar"><i style="width:${xpPct}%"></i></div>
          <small class="muted">${lvl >= 3 ? 'Maxnivå' : Math.floor(c.current_xp) + ' / ' + need + ' erfarenhet'} · ${info.focus}</small>
          <ol>${info.levels.map((t, i) => `<li class="${i < lvl ? 'got' : ''}">${t}</li>`).join('')}</ol>
          <small class="muted"><b>Samarbete:</b> ${c.coop().name}. ${c.coop().desc}</small>
          <small class="muted"><b class="gold">Superattack ${info.super.name}:</b> ${info.super.desc}</small>
          ${cm.activeKind === k ? '<span class="eyebrow">FÖLJER MED</span>' : `<button class="pbtn" type="button" data-pick="${k}">Ta med ${info.name.toLowerCase()}</button>`}
        </div>`;
      }).join('')}</div>`;
      el.querySelectorAll('img').forEach((img, i) => !cm.unlocked.includes(SV.COMPANION_ORDER[i]) && img.classList.add('silhouette'));
      el.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          cm.setActive(b.dataset.pick);
          SV.Sfx.play('ui');
          this.renderComps();
          this.focusPanel($('panel-menu'));
        })
      );
    },

    renderMap() {
      const el = $('tab-map');
      const game = this.game;
      el.innerHTML = `<div class="map-row">
        <canvas id="bigmap" width="288" height="384"></canvas>
        <div class="map-side">
          <div class="eyebrow">TECKENFÖRKLARING</div>
          <ul class="legend"><li><i style="background:#fff"></i>Signe</li><li><i style="background:#ff9a2a"></i>Skogsbasen och smedjan</li><li><i style="background:#a98aff"></i>Urkärnan</li><li><i style="background:#ff6ae8"></i>Energikristall</li><li><i style="background:#8fef8a"></i>Djur som väntar</li><li><i style="background:#ffcf5a"></i>Kista (Ugglan nivå 2)</li></ul>
          <p>${game.world.crystals.filter((c) => c.taken).length} av 12 kristaller hittade. ${game.CRYSTALS_NEEDED} behövs för att väcka Urkärnan längst i norr. Kristallerna ligger oftast i grottor med en smal öppning.</p>
          <p>Utforskat: ${Math.round(game.world.revealedFraction() * 100)} % av skogen.</p>
        </div>
      </div>`;
      this.drawMinimap(game, $('bigmap'), true);
    },

    renderGallery() {
      const el = $('tab-gallery');
      this.galIdx = this.galIdx || 0;
      this.galLvl = this.galLvl || 1;
      const item = GALLERY[this.galIdx];
      const info = item.comp ? SV.COMPANION_INFO[item.comp] : null;
      const name = info ? info.name : item.name;
      const sub = info ? info.trait : item.sub;
      const text = info ? `${info.focus}. ${info.levels[this.galLvl - 1]} Superattack: ${info.super.name}.` : item.text;
      el.innerHTML = `<div class="gallery">
        <canvas id="gal-canvas" width="420" height="420"></canvas>
        <div class="gal-side">
          <div class="eyebrow">${sub.toUpperCase()}</div>
          <h3 class="gal-name">${name}</h3>
          <p>${text}</p>
          ${item.comp ? `<div class="row">${[1, 2, 3].map((l) => `<button class="pbtn ${l === this.galLvl ? 'primary' : ''}" type="button" data-lvl="${l}">Nivå ${l}</button>`).join('')}</div>` : ''}
          <div class="row"><button class="pbtn" type="button" id="gal-prev">Föregående</button><button class="pbtn" type="button" id="gal-next">Nästa</button></div>
          <div class="gal-dots">${GALLERY.map((g, i) => `<i class="${i === this.galIdx ? 'on' : ''}"></i>`).join('')}</div>
        </div>
      </div>`;
      $('gal-prev').onclick = () => {
        this.galIdx = (this.galIdx + GALLERY.length - 1) % GALLERY.length;
        this.renderGallery();
        $('gal-prev').focus();
      };
      $('gal-next').onclick = () => {
        this.galIdx = (this.galIdx + 1) % GALLERY.length;
        this.renderGallery();
        $('gal-next').focus();
      };
      el.querySelectorAll('[data-lvl]').forEach((b) =>
        b.addEventListener('click', () => {
          this.galLvl = +b.dataset.lvl;
          this.renderGallery();
        })
      );
      const canvas = $('gal-canvas');
      const t0 = performance.now();
      const step = (now) => {
        if (!SV.View.ready || $('tab-gallery').hidden) return;
        SV.View.renderPreview(canvas, item.key, { rot: 0.4 + ((now - t0) / 1000) * 0.6, level: this.galLvl });
        this._galRaf = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._galRaf);
      this._galRaf = requestAnimationFrame(step);
    },

    renderHelp() {
      const L = (a) => SV.Input.label(a);
      $('tab-help').innerHTML = `<div class="help">
        <div class="keys-grid">
          <span>Gå</span><b>WASD / vänster spak</b>
          <span>Sikta</span><b>Musen / höger spak</b>
          <span>Elhugg (håll: EMP)</span><b>Vänsterklick / X</b>
          <span>Frostpil</span><b>Högerklick, mellanslag / RT</b>
          <span>Samarbete</span><b>Q / LB</b>
          <span>Superattack</span><b>F / RB</b>
          <span>Interagera</span><b>E / A</b>
          <span>Byt djur</span><b>Tab / Y</b>
          <span>Karta</span><b>M / Back</b>
          <span>Meny</span><b>Esc / Start</b>
          <span>Zooma</span><b>Mushjulet</b>
        </div>
        <p><b>Väktarbågen:</b> ${L('staff')} ger ett elhugg med bågens bladkanter. Håll in en stund och släpp för en EMP-pulsvåg som slår ut robotarnas motorer runt dig.</p>
        <p><b>Frostpilar:</b> tre träffar fryser en robot helt. En frusen robot tar 50 % mer skada av elhugg.</p>
        <p><b>Tidsstormen:</b> ingen klocka tickar. Stormen laddas upp när ni utforskar nya delar av skogen, och varje energikristall pressar tillbaka den. Ju högre storm, desto snabbare och vaksammare robotar.</p>
        <p><b>Smedjan</b> i Skogsbasen byter rustningens färger och uppgraderar vapnen med skrot och kretsar. Kamouflage gör dig svårare att upptäcka, neon lockar robotar men skrämmer drönare, grafit isolerar mot elstötar.</p>
        <p><b>Ingen fara:</b> tar energin slut går Signe tillbaka till Skogsbasen och behåller allt hon samlat.</p>
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
          <button class="pbtn" type="button" id="t-cave">Gå till en kristallgrotta</button>
        </div>
        <p id="t-log" class="eyebrow"></p>
      </div>`;
      const slider = $('t-storm');
      slider.addEventListener('input', () => {
        game.env.storm_intensity = parseFloat(slider.value);
        game.env.visual = game.env.storm_intensity;
        game.env._updateEnvironment();
        $('t-storm-v').textContent = game.env.storm_intensity.toFixed(2);
      });
      const log = (t) => ($('t-log').textContent = t);
      $('t-shout').addEventListener('click', () => {
        const res = game.testShieldBark();
        this.closeMenu();
        this.toast(res, 4);
      });
      $('t-all').addEventListener('click', () => {
        SV.COMPANION_ORDER.forEach((k) => game.companions.unlock(k, false));
        game.world.animals.forEach((a) => (a.met = true));
        log('ALLA DJUR VÄNTAR VID LÄGERELDEN.');
      });
      $('t-max').addEventListener('click', () => {
        const c = game.companions.active;
        while (c.current_level < 3) c.add_xp(c.xp_to_next_level[c.current_level - 1]);
        log(c.companion_name.toUpperCase() + ' ÄR NU NIVÅ 3.');
      });
      $('t-res').addEventListener('click', () => {
        game.player.scrap += 50;
        game.player.chips += 10;
        log('RESURSER TILLAGDA.');
      });
      $('t-crys').addEventListener('click', () => {
        const c = game.world.crystals.find((x) => !x.taken);
        if (c) game.takeCrystal(c);
        log('KRISTALL TILLAGD.');
      });
      $('t-fog').addEventListener('click', () => {
        game.world.reveal(48 * 16, 64 * 16, 200);
        game.fogDirty = true;
        game.rebuildMinimap();
        log('DIMMAN ÄR BORTA.');
      });
      $('t-cave').addEventListener('click', () => {
        const g = game.world.grottos[0];
        game.player.x = (g.x + 0.5 + Math.cos(g.open) * (g.r - 1)) * 16;
        game.player.y = (g.y + 0.5 + Math.sin(g.open) * (g.r - 1)) * 16;
        game.player.face = g.open + Math.PI;
        SV.View.snapCamera();
        this.closeMenu();
      });
    },
  };

  SV.UI = UI;
})();
