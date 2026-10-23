// input.js – virtuell analogspak, aktionsknappar och tangentbord.
// Varje handling har tillstånden down / pressed (denna bildruta) / released.
(function () {
  'use strict';
  const SV = window.SV;

  const ACTS = ['staff', 'frost', 'coop', 'super', 'interact', 'swap', 'menu'];
  const KEYS = {
    KeyJ: 'staff', KeyZ: 'staff',
    KeyK: 'frost', KeyX: 'frost',
    KeyL: 'coop', KeyC: 'coop',
    Space: 'super',
    KeyE: 'interact', Enter: 'interact',
    KeyQ: 'swap',
    Escape: 'menu', KeyP: 'menu',
  };
  const MOVE = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
  };

  const Input = {
    move: { x: 0, y: 0 },
    stick: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
    state: {},
    keysDown: new Set(),
    enabled: true,
    onFirstInteraction: null,

    init(stickZone, stickBase, stickKnob, buttons) {
      ACTS.forEach((a) => (this.state[a] = { down: false, pressed: false, released: false, t0: 0, held: 0 }));
      this._initKeyboard();
      this._initStick(stickZone, stickBase, stickKnob);
      buttons.forEach((btn) => this._initButton(btn));
      const first = () => {
        if (this.onFirstInteraction) this.onFirstInteraction();
        window.removeEventListener('pointerdown', first, true);
        window.removeEventListener('keydown', first, true);
      };
      window.addEventListener('pointerdown', first, true);
      window.addEventListener('keydown', first, true);
    },

    press(act) {
      const s = this.state[act];
      if (!s || s.down) return;
      s.down = true;
      s.pressed = true;
      s.t0 = performance.now();
    },
    release(act) {
      const s = this.state[act];
      if (!s || !s.down) return;
      s.down = false;
      s.released = true;
      s.held = (performance.now() - s.t0) / 1000;
    },
    down(act) {
      return this.enabled && this.state[act].down;
    },
    pressed(act) {
      return this.enabled && this.state[act].pressed;
    },
    released(act) {
      return this.enabled && this.state[act].released;
    },
    holdTime(act) {
      const s = this.state[act];
      return s.down ? (performance.now() - s.t0) / 1000 : s.held;
    },
    // Anropas sist i varje bildruta.
    endFrame() {
      ACTS.forEach((a) => {
        this.state[a].pressed = false;
        this.state[a].released = false;
      });
    },
    releaseAll() {
      ACTS.forEach((a) => this.release(a));
      this.keysDown.clear();
      this._endStick();
      this._updateKeyboardMove();
    },

    _initKeyboard() {
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        if (MOVE[e.code]) {
          this.keysDown.add(e.code);
          this._updateKeyboardMove();
          e.preventDefault();
        } else if (KEYS[e.code]) {
          if (!e.repeat) this.press(KEYS[e.code]);
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', (e) => {
        if (MOVE[e.code]) {
          this.keysDown.delete(e.code);
          this._updateKeyboardMove();
        } else if (KEYS[e.code]) this.release(KEYS[e.code]);
      });
      window.addEventListener('blur', () => this.releaseAll());
    },
    _updateKeyboardMove() {
      if (this.stick.active) return;
      let x = 0, y = 0;
      this.keysDown.forEach((k) => {
        x += MOVE[k][0];
        y += MOVE[k][1];
      });
      const len = Math.hypot(x, y) || 1;
      this.move.x = x / len;
      this.move.y = y / len;
    },

    // Dynamisk spak: lägger sig där tummen landar i vänstra zonen.
    _initStick(zone, base, knob) {
      const R = 46; // radie i CSS-pixlar
      this._stickEls = { base, knob };
      zone.addEventListener('pointerdown', (e) => {
        if (this.stick.active) return;
        e.preventDefault();
        zone.setPointerCapture(e.pointerId);
        const st = this.stick;
        st.active = true;
        st.id = e.pointerId;
        st.ox = e.clientX;
        st.oy = e.clientY;
        base.style.left = st.ox + 'px';
        base.style.top = st.oy + 'px';
        base.classList.add('on');
        this._moveStick(e.clientX, e.clientY, R);
      });
      zone.addEventListener('pointermove', (e) => {
        if (this.stick.active && e.pointerId === this.stick.id) this._moveStick(e.clientX, e.clientY, R);
      });
      const end = (e) => {
        if (e.pointerId === this.stick.id) this._endStick();
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
    },
    _moveStick(cx, cy, R) {
      const st = this.stick;
      let dx = cx - st.ox, dy = cy - st.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        // Spaken följer med om tummen glider långt bort.
        st.ox += (dx / len) * (len - R);
        st.oy += (dy / len) * (len - R);
        this._stickEls.base.style.left = st.ox + 'px';
        this._stickEls.base.style.top = st.oy + 'px';
        dx = cx - st.ox;
        dy = cy - st.oy;
      }
      const l2 = Math.hypot(dx, dy);
      const dead = 6;
      const mag = l2 < dead ? 0 : Math.min(1, (l2 - dead) / (R - dead));
      this.move.x = l2 ? (dx / l2) * mag : 0;
      this.move.y = l2 ? (dy / l2) * mag : 0;
      this._stickEls.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    },
    _endStick() {
      const st = this.stick;
      st.active = false;
      st.id = null;
      this.move.x = 0;
      this.move.y = 0;
      if (this._stickEls) {
        this._stickEls.base.classList.remove('on');
        this._stickEls.knob.style.transform = 'translate(0px, 0px)';
      }
      this._updateKeyboardMove();
    },

    _initButton(btn) {
      const act = btn.dataset.act;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (err) {
          /* äldre webbläsare */
        }
        btn.classList.add('held');
        this.press(act);
      });
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove('held');
        this.release(act);
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    },
  };

  SV.Input = Input;
})();
