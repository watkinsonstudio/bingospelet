// input-touch.js – pekskärmsstyrning för en framtida mobilversion.
// Laddas inte i PC-versionen. Kopplas in med:
//   SV.TouchInput.attach(SV.Input, stickZone, stickBase, stickKnob, buttons)
// Spaken skriver till Input.touchMove och knapparna (data-act="staff" osv.)
// använder samma handlingar som tangentbord och handkontroll.
(function () {
  'use strict';
  const SV = window.SV;

  const TouchInput = {
    attach(Input, zone, base, knob, buttons) {
      const R = 46; // spakens radie i CSS-pixlar
      const st = { active: false, id: null, ox: 0, oy: 0 };
      Input.touchMove = { x: 0, y: 0 };

      const move = (cx, cy) => {
        let dx = cx - st.ox, dy = cy - st.oy;
        const len = Math.hypot(dx, dy);
        if (len > R) {
          st.ox += (dx / len) * (len - R);
          st.oy += (dy / len) * (len - R);
          base.style.left = st.ox + 'px';
          base.style.top = st.oy + 'px';
          dx = cx - st.ox;
          dy = cy - st.oy;
        }
        const l2 = Math.hypot(dx, dy), dead = 6;
        const mag = l2 < dead ? 0 : Math.min(1, (l2 - dead) / (R - dead));
        Input.touchMove.x = l2 ? (dx / l2) * mag : 0;
        Input.touchMove.y = l2 ? (dy / l2) * mag : 0;
        Input.device = 'touch';
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const end = () => {
        st.active = false;
        st.id = null;
        Input.touchMove.x = Input.touchMove.y = 0;
        base.classList.remove('on');
        knob.style.transform = 'translate(0px, 0px)';
      };
      zone.addEventListener('pointerdown', (e) => {
        if (st.active) return;
        e.preventDefault();
        zone.setPointerCapture(e.pointerId);
        Object.assign(st, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY });
        base.style.left = st.ox + 'px';
        base.style.top = st.oy + 'px';
        base.classList.add('on');
        move(e.clientX, e.clientY);
      });
      zone.addEventListener('pointermove', (e) => st.active && e.pointerId === st.id && move(e.clientX, e.clientY));
      zone.addEventListener('pointerup', (e) => e.pointerId === st.id && end());
      zone.addEventListener('pointercancel', (e) => e.pointerId === st.id && end());

      buttons.forEach((btn) => {
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
          Input.press(act);
        });
        const up = (e) => {
          e.preventDefault();
          btn.classList.remove('held');
          Input.release(act);
        };
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
      });
    },
  };

  SV.TouchInput = TouchInput;
})();
