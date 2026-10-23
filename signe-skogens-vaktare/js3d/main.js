// main.js – startpunkt för 3D-versionen. Kopplar 3D-vyn till den
// motoroberoende spellogiken (window.SV) och startar spelet.
import { View } from './view.js';

const SV = window.SV;

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

if (!webglOk()) {
  const el = document.getElementById('boot-error');
  el.hidden = false;
  el.textContent = 'Den här webbläsaren kan inte visa 3D-grafik (WebGL saknas eller är avstängt). Prova en aktuell Chrome, Edge eller Firefox.';
} else {
  SV.View = View;
  SV.bootGame();
}
