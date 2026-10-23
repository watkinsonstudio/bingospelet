// input.js – tangentbord, mus och handkontroll (Gamepad API, standardlayout
// för Xbox/PlayStation). Alla enheter skriver till samma handlingar så att
// spellogiken inte bryr sig om vad som styr. Pekskärm: se input-touch.js.
(function () {
  'use strict';
  const SV = window.SV;

  const ACTS = ['staff', 'frost', 'coop', 'super', 'interact', 'swap', 'menu', 'map', 'ui_up', 'ui_down', 'ui_left', 'ui_right', 'ui_accept', 'ui_back'];
  const KEYS = {
    KeyJ: 'staff',
    KeyK: 'frost', Space: 'frost',
    KeyQ: 'coop',
    KeyF: 'super',
    KeyE: 'interact', Enter: 'interact',
    Tab: 'swap',
    Escape: 'menu', KeyP: 'menu',
    KeyM: 'map',
  };
  const MOVE = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
  };
  const UI_KEYS = { ArrowUp: 'ui_up', ArrowDown: 'ui_down', ArrowLeft: 'ui_left', ArrowRight: 'ui_right', Escape: 'ui_back' };
  // Standardlayout: 0 A/Kryss, 1 B/Cirkel, 2 X/Fyrkant, 3 Y/Triangel, 4 LB, 5 RB,
  // 6 LT, 7 RT, 8 Back/Share, 9 Start/Options, 12–15 styrkors.
  const PAD = { 0: ['interact', 'ui_accept'], 1: ['ui_back'], 2: ['staff'], 3: ['swap'], 4: ['coop'], 5: ['super'], 6: ['coop'], 7: ['frost'], 8: ['map'], 9: ['menu'], 12: ['ui_up'], 13: ['ui_down'], 14: ['ui_left'], 15: ['ui_right'] };
  const DEAD = 0.2;

  const Input = {
    move: { x: 0, y: 0 }, // skärmriktning, -1..1
    aim: { mode: 'none', x: 0, y: 0 }, // 'mouse' (världspunkt i px), 'stick' (skärmriktning) eller 'none'
    mouse: { x: 0, y: 0, inside: false, moved: 0 },
    zoom: 0,
    device: 'kbm', // 'kbm' | 'pad' | 'touch'
    padName: '',
    state: {},
    keysDown: new Set(),
    uiMode: false,
    touchMove: null,
    onDeviceChange: null,
    onFirstInteraction: null,
    _pad: {},

    init(canvas) {
      ACTS.forEach((a) => (this.state[a] = { down: false, pressed: false, released: false, t0: 0, held: 0, src: new Set() }));
      window.addEventListener('keydown', (e) => {
        if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        this._setDevice('kbm');
        // i menyer sköter webbläsaren Tab/Enter/mellanslag (fokus och klick)
        if (this.uiMode && (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space')) return;
        if (UI_KEYS[e.code] && !e.repeat) this.press(UI_KEYS[e.code], 'k' + e.code);
        if (MOVE[e.code]) {
          this.keysDown.add(e.code);
          e.preventDefault();
        } else if (KEYS[e.code]) {
          if (!e.repeat) this.press(KEYS[e.code], 'k' + e.code);
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', (e) => {
        if (MOVE[e.code]) this.keysDown.delete(e.code);
        if (KEYS[e.code]) this.release(KEYS[e.code], 'k' + e.code);
        if (UI_KEYS[e.code]) this.release(UI_KEYS[e.code], 'k' + e.code);
      });
      window.addEventListener('blur', () => this.releaseAll());

      canvas.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.inside = true;
        this.mouse.moved = performance.now();
        this._setDevice('kbm');
      });
      canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
      canvas.addEventListener('mousedown', (e) => {
        this._setDevice('kbm');
        if (e.button === 0) this.press('staff', 'm0');
        if (e.button === 2) this.press('frost', 'm2');
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.release('staff', 'm0');
        if (e.button === 2) this.release('frost', 'm2');
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('wheel', (e) => {
        this.zoom += Math.sign(e.deltaY);
        e.preventDefault();
      }, { passive: false });
      window.addEventListener('gamepadconnected', (e) => {
        this.padName = e.gamepad.id;
        this._setDevice('pad');
      });
      const first = () => {
        if (this.onFirstInteraction) this.onFirstInteraction();
        window.removeEventListener('pointerdown', first, true);
        window.removeEventListener('keydown', first, true);
      };
      window.addEventListener('pointerdown', first, true);
      window.addEventListener('keydown', first, true);
    },

    _setDevice(d) {
      if (this.device === d) return;
      this.device = d;
      if (this.onDeviceChange) this.onDeviceChange(d);
    },

    // En handling kan hållas av flera källor samtidigt (t.ex. mus + tangent).
    press(act, src = 'x') {
      const s = this.state[act];
      if (!s) return;
      s.src.add(src);
      if (s.down) return;
      s.down = true;
      s.pressed = true;
      s.t0 = performance.now();
    },
    release(act, src = 'x') {
      const s = this.state[act];
      if (!s) return;
      s.src.delete(src);
      if (!s.down || s.src.size) return;
      s.down = false;
      s.released = true;
      s.held = (performance.now() - s.t0) / 1000;
    },
    down(act) {
      return this.state[act].down;
    },
    pressed(act) {
      return this.state[act].pressed;
    },
    released(act) {
      return this.state[act].released;
    },
    holdTime(act) {
      const s = this.state[act];
      return s.down ? (performance.now() - s.t0) / 1000 : s.held;
    },
    endFrame() {
      ACTS.forEach((a) => {
        this.state[a].pressed = false;
        this.state[a].released = false;
      });
      this.zoom = 0;
    },
    releaseAll() {
      ACTS.forEach((a) => {
        this.state[a].src.clear();
        if (this.state[a].down) {
          this.state[a].down = false;
          this.state[a].released = true;
        }
      });
      this.keysDown.clear();
    },

    // Anropas i början av varje bildruta.
    poll() {
      // tangentbord
      let x = 0, y = 0;
      this.keysDown.forEach((k) => {
        x += MOVE[k][0];
        y += MOVE[k][1];
      });
      const len = Math.hypot(x, y) || 1;
      this.move.x = x / len;
      this.move.y = y / len;
      if (this.touchMove && (this.touchMove.x || this.touchMove.y)) {
        this.move.x = this.touchMove.x;
        this.move.y = this.touchMove.y;
      }
      this.aim.mode = this.device === 'kbm' && this.mouse.inside ? 'mouse' : 'none';

      // handkontroll
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads || []).find((p) => p && p.connected);
      if (!pad) return;
      const ax = (i) => {
        const v = pad.axes[i] || 0;
        return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
      };
      const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
      let any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0;
      if (lx || ly) {
        const m = Math.min(1, Math.hypot(lx, ly));
        const l = Math.hypot(lx, ly);
        this.move.x = (lx / l) * m;
        this.move.y = (ly / l) * m;
      }
      if (rx || ry) {
        this.aim.mode = 'stick';
        this.aim.x = rx;
        this.aim.y = ry;
      }
      // vänster spak navigerar menyer
      const nav = { ui_up: ly < -0.6, ui_down: ly > 0.6, ui_left: lx < -0.6, ui_right: lx > 0.6 };
      Object.entries(nav).forEach(([act, on]) => {
        const key = 'stick-' + act;
        if (on && !this._pad[key]) this.press(act, key);
        if (!on && this._pad[key]) this.release(act, key);
        this._pad[key] = on;
      });
      pad.buttons.forEach((b, i) => {
        const on = b.pressed || b.value > 0.5;
        const was = !!this._pad[i];
        if (on !== was) {
          any = true;
          (PAD[i] || []).forEach((act) => (on ? this.press(act, 'p' + i) : this.release(act, 'p' + i)));
        }
        this._pad[i] = on;
      });
      if (any) {
        this.padName = pad.id;
        this._setDevice('pad');
      }
    },

    // Knappnamn för hjälptexter, beroende på vad spelaren använder.
    label(act) {
      const ps = /054c|playstation|dualsense|dualshock/i.test(this.padName);
      const pad = {
        staff: ps ? '□' : 'X', frost: ps ? 'R2' : 'RT', coop: ps ? 'L1' : 'LB', super: ps ? 'R1' : 'RB',
        interact: ps ? '✕' : 'A', swap: ps ? '△' : 'Y', menu: ps ? 'Options' : 'Start', map: ps ? 'Share' : 'Back',
      };
      const kbm = { staff: 'Vänsterklick', frost: 'Högerklick', coop: 'Q', super: 'F', interact: 'E', swap: 'Tab', menu: 'Esc', map: 'M' };
      return (this.device === 'pad' ? pad : kbm)[act] || '';
    },
  };

  SV.Input = Input;
})();
