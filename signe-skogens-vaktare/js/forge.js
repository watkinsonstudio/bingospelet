// forge.js – Smedjan i Skogsbasen: rustningsfärger (förvalda paletter och
// fri målarverkstad) samt uppgraderingar som betalas med skrot och kretsar.
// Färgerna går till ArmorColorShader i 3D-modellen via Player.setArmor.
(function () {
  'use strict';
  const SV = window.SV;

  const PALETTES = [
    { id: 'original', name: 'Väktarens grönska', helmet: '#2f8a5a', chest: '#4fc27a', legs: '#3a4a6a', cost: 0 },
    { id: 'opal', name: 'Opalalv', helmet: '#c8b0f0', chest: '#f4e8ff', legs: '#8a7ac8', cost: 6 },
    { id: 'mossvaktare', name: 'Mossväktare', helmet: '#4a6b3a', chest: '#6b5a3a', legs: '#3b4d2e', cost: 6 },
    { id: 'lavskog', name: 'Lavskog', helmet: '#76875a', chest: '#5c6e45', legs: '#6e5f45', cost: 6 },
    { id: 'norrsken', name: 'Neonnorrsken', helmet: '#39ff9a', chest: '#ff3df0', legs: '#3dd8ff', cost: 8 },
    { id: 'solflamma', name: 'Solflamma', helmet: '#ffd23d', chest: '#ff6a3d', legs: '#ff2d6f', cost: 8 },
    { id: 'grafit', name: 'Grafit', helmet: '#3a3d44', chest: '#2b2d33', legs: '#45474f', cost: 8 },
    { id: 'jarnmalm', name: 'Järnmalm', helmet: '#4d4a52', chest: '#3a3340', legs: '#55505c', cost: 8 },
    { id: 'lingon', name: 'Lingon & björk', helmet: '#c8324a', chest: '#efe6d8', legs: '#5a3a3a', cost: 6 },
    { id: 'fjallsjo', name: 'Fjällsjö', helmet: '#4d8fd6', chest: '#e8f2ff', legs: '#2d4a7a', cost: 6 },
  ];
  const PAINTER_COST = { scrap: 12 };
  const QUICK = ['#f1ece0', '#c8324a', '#ff6a3d', '#ffd23d', '#39ff9a', '#4a6b3a', '#6b5a3a', '#3dd8ff', '#4d8fd6', '#7656c0', '#ff3df0', '#2b2d33', '#5a6170', '#a3afc2', '#8a5226', '#14231a'];

  const UPGRADES = [
    {
      stat: 'staff', name: 'Väktarbågens elhugg', max: 5,
      desc: (p) => `Skada ${p.staffDamage()} · EMP-radie ${p.empRadius()}`,
      costs: [{ scrap: 10 }, { scrap: 18, chips: 1 }, { scrap: 28, chips: 3 }, { scrap: 40, chips: 5 }],
    },
    {
      stat: 'frost', name: 'Frostpilar', max: 5,
      desc: (p) => `Kyla per träff ${p.frostChill().toFixed(1)} · Frystid ${p.frostDuration().toFixed(1)} s`,
      costs: [{ scrap: 10 }, { scrap: 18, chips: 1 }, { scrap: 28, chips: 3 }, { scrap: 40, chips: 5 }],
    },
    {
      stat: 'cool', name: 'Pilkoger', max: 4,
      desc: (p) => `${p.maxCoolant} frostpilar innan kogret måste fyllas på`,
      costs: [{ scrap: 8 }, { scrap: 16, chips: 1 }, { scrap: 26, chips: 2 }],
    },
    {
      stat: 'plate', name: 'Rustningsplätering', max: 4,
      desc: (p) => `${p.maxEnergy / 2} energiceller`,
      costs: [{ scrap: 12 }, { scrap: 24, chips: 2 }, { scrap: 36, chips: 4 }],
    },
  ];

  const Forge = {
    PALETTES,
    UPGRADES,
    PAINTER_COST,
    canAfford(p, cost) {
      return p.scrap >= (cost.scrap || 0) && p.chips >= (cost.chips || 0);
    },
    pay(p, cost) {
      if (!this.canAfford(p, cost)) return false;
      p.scrap -= cost.scrap || 0;
      p.chips -= cost.chips || 0;
      return true;
    },
    costHtml(p, cost) {
      const part = (n, key, have) => `<span class="${have < n ? 'short' : ''}"><i class="ic ic-${key}"></i>${n}</span>`;
      let s = '';
      if (cost.scrap) s += part(cost.scrap, 'scrap', p.scrap);
      if (cost.chips) s += part(cost.chips, 'chip', p.chips);
      return `<span class="cost">${s || 'Gratis'}</span>`;
    },

    open(game) {
      this.game = game;
      this.tab = this.tab || 'armor';
      game.pause(true);
      document.getElementById('panel-forge').hidden = false;
      this.render();
      this._previewLoop();
      SV.UI.focusPanel(document.getElementById('panel-forge'));
    },
    close() {
      document.getElementById('panel-forge').hidden = true;
      cancelAnimationFrame(this._raf);
      this.game.pause(false);
      this.game.save();
    },
    setTab(t) {
      this.tab = t;
      document.querySelectorAll('[data-ftab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ftab === t)));
      document.getElementById('ftab-armor').hidden = t !== 'armor';
      document.getElementById('ftab-weapons').hidden = t !== 'weapons';
      this.render();
    },

    render() {
      const p = this.game.player;
      document.getElementById('forge-res').innerHTML = `<span><i class="ic ic-scrap"></i>${p.scrap} skrot</span><span><i class="ic ic-chip"></i>${p.chips} kretsar</span>`;
      if (this.tab === 'armor') this.renderArmor();
      else this.renderWeapons();
    },

    renderArmor() {
      const p = this.game.player;
      const el = document.getElementById('ftab-armor');
      const style = p.style;
      const presetHtml = PALETTES.map((pal) => {
        const owned = p.unlockedPalettes.includes(pal.id);
        const equipped = pal.helmet === p.armor.helmet && pal.chest === p.armor.chest && pal.legs === p.armor.legs;
        const st = SV.ArmorStyle.classify(pal);
        return `<button class="preset" type="button" data-pal="${pal.id}" aria-pressed="${equipped}">
          <span class="swatches"><i style="background:${pal.helmet}"></i><i style="background:${pal.chest}"></i><i style="background:${pal.legs}"></i></span>
          <span class="pname">${pal.name}</span>
          <span class="ptag">${st.name.toUpperCase()} · ${equipped ? 'BÄRS NU' : owned ? 'ÄGS' : ''}</span>
          ${owned ? '' : this.costHtml(p, { scrap: pal.cost })}
        </button>`;
      }).join('');
      const zones = [['helmet', 'Hjälm'], ['chest', 'Bröstplåt'], ['legs', 'Ben']];
      const painter = p.painterUnlocked
        ? zones.map(([z, label]) => `<div class="zone-row"><label for="paint-${z}">${label}</label><input type="color" id="paint-${z}" data-zone="${z}" value="${p.armor[z]}"><div class="quick">${QUICK.map((c) => `<button type="button" data-zone="${z}" data-col="${c}" style="background:${c}" aria-label="${label} ${c}"></button>`).join('')}</div></div>`).join('')
        : `<div class="row spread"><p>Lås upp ett fritt RGB/HEX-färghjul för hjälm, bröstplåt och ben.</p><div class="row">${this.costHtml(p, PAINTER_COST)}<button class="pbtn" type="button" id="btn-unlock-painter" ${this.canAfford(p, PAINTER_COST) ? '' : 'disabled'}>Lås upp</button></div></div>`;
      el.innerHTML = `<div class="forge-grid">
        <div style="display:flex;flex-direction:column;gap:10px">
          <canvas id="forge-preview" width="300" height="400"></canvas>
          <div class="style-badge" data-style="${style.id}"><b>${style.name}</b><small>${style.effect}</small></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <h3>Förvalda paletter</h3>
          <div class="presets">${presetHtml}</div>
          <h3>Fri målarverkstad</h3>
          <div class="painter">${painter}</div>
        </div>
      </div>`;
      el.querySelectorAll('[data-pal]').forEach((b) => b.addEventListener('click', () => this.choosePalette(b.dataset.pal)));
      el.querySelectorAll('input[type="color"]').forEach((inp) => inp.addEventListener('input', () => this.paint(inp.dataset.zone, inp.value, false)));
      el.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => this.paint(b.dataset.zone, b.dataset.col, true)));
      const unlock = el.querySelector('#btn-unlock-painter');
      if (unlock)
        unlock.addEventListener('click', () => {
          if (this.pay(p, PAINTER_COST)) {
            p.painterUnlocked = true;
            SV.Sfx.play('level');
            this.render();
          }
        });
    },

    choosePalette(id) {
      const p = this.game.player;
      const pal = PALETTES.find((x) => x.id === id);
      if (!p.unlockedPalettes.includes(id)) {
        if (!this.pay(p, { scrap: pal.cost })) {
          SV.Sfx.play('deny');
          return;
        }
        p.unlockedPalettes.push(id);
        SV.Sfx.play('level');
      } else SV.Sfx.play('ui');
      p.setArmor({ helmet: pal.helmet, chest: pal.chest, legs: pal.legs });
      this.render();
    },
    paint(zone, col, rerender) {
      const p = this.game.player;
      const armor = Object.assign({}, p.armor, { [zone]: col });
      p.setArmor(armor);
      if (rerender) {
        SV.Sfx.play('ui');
        this.render();
      } else {
        // uppdatera bara märket, behåll färgväljarens fokus
        const badge = document.querySelector('#ftab-armor .style-badge');
        if (badge) {
          badge.dataset.style = p.style.id;
          badge.innerHTML = `<b>${p.style.name}</b><small>${p.style.effect}</small>`;
        }
      }
    },

    renderWeapons() {
      const p = this.game.player;
      const el = document.getElementById('ftab-weapons');
      el.innerHTML = `<div class="upgrades">${UPGRADES.map((u) => {
        const lvl = p.stats[u.stat];
        const maxed = lvl >= u.max;
        const cost = maxed ? null : u.costs[lvl - 1];
        return `<div class="upg">
          <div class="row spread"><h3>${u.name}</h3><span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></div>
          <small>${u.desc(p)}</small>
          <div class="row spread">${maxed ? '<span class="cost">Max</span>' : this.costHtml(p, cost)}
          <button class="pbtn" type="button" data-upg="${u.stat}" ${maxed || !this.canAfford(p, cost) ? 'disabled' : ''}>Uppgradera</button></div>
        </div>`;
      }).join('')}</div>
      <p>Kortslutna robotar tappar skrot och ibland kretsar. Skrothögar i Järnforsen ger lite extra om du ger dem ett elhugg.</p>`;
      el.querySelectorAll('[data-upg]').forEach((b) =>
        b.addEventListener('click', () => {
          const u = UPGRADES.find((x) => x.stat === b.dataset.upg);
          const lvl = p.stats[u.stat];
          if (lvl < u.max && this.pay(p, u.costs[lvl - 1])) {
            p.stats[u.stat]++;
            if (u.stat === 'plate') p.energy = p.maxEnergy;
            if (u.stat === 'cool') p.coolant = p.maxCoolant;
            SV.Sfx.play('level');
            this.render();
          }
        })
      );
    },

    _previewLoop() {
      const t0 = performance.now();
      const step = (now) => {
        const c = document.getElementById('forge-preview');
        if (c && SV.View.ready) SV.View.renderPreview(c, 'signe', { rot: 0.3 + ((now - t0) / 1000) * 0.7 });
        this._raf = requestAnimationFrame(step);
      };
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(step);
    },
  };

  SV.Forge = Forge;
})();
