// fx.js – partiklar och effekter: eldflugor, bubblor, gnistor, regn,
// blixtar, chockvågsringar, el-hugg och projektiler. Läser spellogikens
// fx/projektil-listor och skapar det visuella.
import * as THREE from 'three';
import { glowMat, radialTexture } from './models.js';

const MAX = 5000;
const T = 16;

const pVert = `
  attribute float size; attribute float alpha; attribute float kind; attribute vec3 pcol;
  uniform float uScale;
  varying vec3 vCol; varying float vA; varying float vKind;
  void main(){
    vCol = pcol; vA = alpha; vKind = kind;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const pFrag = `
  varying vec3 vCol; varying float vA; varying float vKind;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a;
    if (vKind < 0.5) a = smoothstep(0.5, 0.0, d);
    else {
      a = smoothstep(0.5, 0.44, d) * smoothstep(0.3, 0.44, d) * 0.9 + smoothstep(0.12, 0.0, length(c - vec2(-0.16, 0.16))) * 0.9 + 0.06 * step(d, 0.5);
    }
    if (a * vA < 0.01) discard;
    gl_FragColor = vec4(vCol * a * vA, 1.0);
  }`;

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.kind = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.tag = new Uint8Array(MAX); // 1 = eldfluga, 2 = bubbla, 3 = stormgnista, 4 = snö
    this.baseA = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('pcol', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('kind', new THREE.BufferAttribute(this.kind, 1));
    this.uScale = { value: 600 };
    const mat = new THREE.ShaderMaterial({ vertexShader: pVert, fragmentShader: pFrag, uniforms: { uScale: this.uScale }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.root.add(this.points);
    this.next = 0;
    this.counts = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // regn som streck
    const RN = 900;
    this.rainN = RN;
    this.rainPos = new Float32Array(RN * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 0.7, 1.2), transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
    for (let i = 0; i < RN; i++) this._resetRain(i, 0, 0, true);

    this.rings = new Map();
    this.proj = new Map();
    this.bolts = [];
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 48);
    this.arcGeo = new THREE.RingGeometry(0.55, 1.05, 24, 1, -1.0, 2.0);
    this.c = new THREE.Color();
  }

  emit(x, y, z, o = {}) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    if (this.tag[i]) this.counts[this.tag[i]]--;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    const v = o.v || [0, 0, 0];
    this.vel[i * 3] = v[0];
    this.vel[i * 3 + 1] = v[1];
    this.vel[i * 3 + 2] = v[2];
    this.c.set(o.color || '#ffffff').multiplyScalar(o.k ?? 2);
    this.col[i * 3] = this.c.r;
    this.col[i * 3 + 1] = this.c.g;
    this.col[i * 3 + 2] = this.c.b;
    this.size[i] = o.size || 0.15;
    this.baseA[i] = o.alpha ?? 1;
    this.alpha[i] = this.baseA[i];
    this.kind[i] = o.bubble ? 1 : 0;
    this.life[i] = this.maxLife[i] = o.life || 1;
    this.grav[i] = o.g || 0;
    this.tag[i] = o.tag || 0;
    if (o.tag) this.counts[o.tag]++;
  }

  burst(x, y, z, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (o.speed || 2) * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, { ...o, v: [Math.cos(a) * s, (o.up ?? 1.5) * (0.5 + Math.random()), Math.sin(a) * s], life: (o.life || 0.6) * (0.6 + Math.random() * 0.6) });
    }
  }

  _resetRain(i, cx, cz, anywhere) {
    const x = cx + (Math.random() - 0.5) * 40, z = cz + (Math.random() - 0.5) * 40, y = anywhere ? Math.random() * 14 : 14;
    this.rainPos.set([x, y, z, x - 0.15, y + 0.8, z - 0.1], i * 6);
  }

  ring(f, focusH = 0.15) {
    const m = new THREE.Mesh(this.ringGeo, glowMat(f.col || '#7ff3ff', 2.4, { additive: true, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(f.x / T, focusH, f.y / T);
    this.root.add(m);
    return m;
  }

  lightning(wx, wz) {
    const pts = [];
    let x = wx + (Math.random() - 0.5) * 4, z = wz + (Math.random() - 0.5) * 4;
    for (let i = 0; i <= 12; i++) {
      const y = 16 - (i / 12) * 16;
      x += (wx - x) * 0.25 + (Math.random() - 0.5) * 1.2;
      z += (wz - z) * 0.25 + (Math.random() - 0.5) * 1.2;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(3, 3.2, 4), transparent: true }));
    this.root.add(line);
    this.bolts.push({ line, t: 0.35 });
    this.burst(wx, 0.3, wz, 30, { color: '#d8b8ff', speed: 4, up: 3, life: 0.6, size: 0.2 });
  }

  update(dt, game, view) {
    const env = game.env;
    const s = env.visual;
    const p = game.player;
    const fx = p.x / T, fz = p.y / T;
    // --- omgivning: eldflugor, stormgnistor, snö, bubblor vid kristaller
    const flies = Math.round(140 * (1 - s * 0.6));
    for (let k = this.counts[1]; k < flies; k++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 16;
      this.emit(fx + Math.cos(a) * r, 0.3 + Math.random() * 2.2, fz + Math.sin(a) * r, { tag: 1, life: 4 + Math.random() * 5, size: 0.1 + Math.random() * 0.12, color: ['#c8ff6a', '#7ff3ff', '#ffe27a', '#ff9ae8'][Math.floor(Math.random() * 4)], k: 2.2, alpha: 0.9 });
    }
    const storm = Math.round(Math.max(0, s - 0.45) * 220);
    for (let k = this.counts[3]; k < storm; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 16;
      this.emit(fx + Math.cos(a) * r, 0.5 + Math.random() * 4, fz + Math.sin(a) * r, { tag: 3, life: 0.6 + Math.random() * 1.6, size: 0.08 + Math.random() * 0.08, color: Math.random() < 0.5 ? '#c8a8ff' : '#ff8af0', k: 3, v: [env.wind * 3, (Math.random() - 0.5) * 2, env.wind * 1.5] });
    }
    const snow = p.y < 46 * T ? 160 : 0;
    for (let k = this.counts[4]; k < snow; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 18;
      this.emit(fx + Math.cos(a) * r, 1 + Math.random() * 7, fz + Math.sin(a) * r, { tag: 4, life: 5, size: 0.07, color: '#e8e8ff', k: 1.4, v: [env.wind * 0.8, -0.6, 0.2] });
    }
    game.world.crystals.forEach((c) => {
      if (c.taken || c.buried) return;
      const cx = c.tx + 0.5, cz = c.ty + 0.5;
      if (Math.abs(cx - fx) > 22 || Math.abs(cz - fz) > 22) return;
      if (Math.random() < dt * 4) this.emit(cx + (Math.random() - 0.5) * 5, 0.2, cz + (Math.random() - 0.5) * 5, { tag: 2, bubble: true, life: 3 + Math.random() * 3, size: 0.25 + Math.random() * 0.3, color: '#bfe8ff', k: 1.3, alpha: 0.8, v: [0, 0.35 + Math.random() * 0.3, 0] });
      if (Math.random() < dt * 6) this.emit(cx + (Math.random() - 0.5) * 2, 0.4 + Math.random(), cz + (Math.random() - 0.5) * 2, { life: 1.5, size: 0.12, color: '#ff8af0', k: 3, v: [0, 0.4, 0] });
    });

    // --- simulera
    const t = env.time;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        if (this.tag[i]) {
          this.counts[this.tag[i]]--;
          this.tag[i] = 0;
        }
        continue;
      }
      const tg = this.tag[i];
      if (tg === 1) {
        this.vel[i * 3] += (Math.sin(t * 1.3 + i) * 0.6 + env.wind * 0.6) * dt;
        this.vel[i * 3 + 1] = Math.sin(t * 1.7 + i * 0.7) * 0.15;
        this.vel[i * 3 + 2] += Math.cos(t * 1.1 + i * 1.3) * 0.6 * dt;
        this.vel[i * 3] *= 0.98;
        this.vel[i * 3 + 2] *= 0.98;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      let a = this.baseA[i] * Math.min(1, k * 3) * Math.min(1, (1 - k) * 6 + 0.2);
      if (tg === 1) a *= 0.55 + Math.sin(t * 4 + i * 1.7) * 0.45;
      this.alpha[i] = a;
    }
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = g.alpha.needsUpdate = g.pcol.needsUpdate = g.size.needsUpdate = g.kind.needsUpdate = true;

    // --- regn
    const rainOn = Math.max(0, s - 0.3) / 0.7;
    this.rain.visible = rainOn > 0.02;
    if (this.rain.visible) {
      this.rain.material.opacity = 0.12 + rainOn * 0.35;
      const n = Math.floor(this.rainN * rainOn);
      for (let i = 0; i < this.rainN; i++) {
        const o = i * 6;
        if (i >= n) {
          this.rainPos[o + 1] = this.rainPos[o + 4] = -50;
          continue;
        }
        const vy = 22 * dt, vx = env.wind * 6 * dt;
        this.rainPos[o] += vx;
        this.rainPos[o + 3] += vx;
        this.rainPos[o + 1] -= vy;
        this.rainPos[o + 4] -= vy;
        if (this.rainPos[o + 1] < -0.2 || Math.abs(this.rainPos[o] - fx) > 22 || Math.abs(this.rainPos[o + 2] - fz) > 22) this._resetRain(i, fx, fz, this.rainPos[o + 1] < -40);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // --- logikens effekter
    const alive = new Set();
    game.fx.forEach((f) => {
      alive.add(f);
      const h = 0.6;
      if (!f._v) {
        f._v = true;
        const x = f.x / T, z = f.y / T;
        if (f.type === 'sparks') this.burst(x, h, z, f.n || 6, { color: f.col || (Math.random() < 0.5 ? '#fff27a' : '#7ff3ff'), speed: 2.5, up: 2.5, g: 6, life: 0.6, size: 0.1, k: 3 });
        if (f.type === 'dirt') this.burst(x, 0.15, z, 6, { color: '#8a6a4a', speed: 1.5, up: 2, g: 8, life: 0.5, size: 0.12, k: 0.7 });
        if (f.type === 'puff') this.burst(x, 0.3, z, 8, { color: '#c8d0e8', speed: 0.8, up: 0.8, life: 0.8, size: 0.35, k: 0.6, alpha: 0.6 });
        if (f.type === 'frost') this.emit(x, 0.9, z, { color: '#bff8ff', life: 0.35, size: 0.12, k: 2.5 });
        if (f.type === 'frostburst') this.burst(x, 0.9, z, 12, { color: '#d8faff', speed: 2, up: 1, g: 2, life: 0.4, size: 0.1, k: 2.5 });
        if (f.type === 'splash') this.burst(x, 0.2, z, f.big ? 140 : 40, { color: '#7ac8ff', speed: f.r / T * 1.4, up: 3, g: 8, life: 0.9, size: 0.16, k: 1.6 });
        if (f.type === 'ring' || f.type === 'splash') this.rings.set(f, this.ring(f));
        if (f.type === 'arc') {
          const m = new THREE.Mesh(this.arcGeo, glowMat('#9ff8ff', 3, { additive: true, side: THREE.DoubleSide }));
          m.rotation.set(-Math.PI / 2, 0, -f.a);
          m.position.set(x, 0.75, z);
          m.scale.setScalar(1.5);
          this.root.add(m);
          this.rings.set(f, m);
          this.burst(x + Math.cos(f.a) * 1.1, 0.75, z + Math.sin(f.a) * 1.1, 10, { color: '#bff8ff', speed: 2, up: 1, life: 0.3, size: 0.08, k: 3 });
        }
      }
      const m = this.rings.get(f);
      if (m) {
        const k = f.t / f.life;
        if (f.type === 'arc') {
          m.material.opacity = 1 - k;
          m.material.transparent = true;
          m.rotation.z = -f.a + (k - 0.5) * 1.2;
        } else {
          const r = THREE.MathUtils.lerp(f.r0 || 2, f.r1 || f.r || 30, 1 - Math.pow(1 - k, 2)) / T;
          m.scale.set(r, r, 1);
          m.material.opacity = 1 - k;
          m.material.transparent = true;
        }
      }
    });
    this.rings.forEach((m, f) => {
      if (!alive.has(f)) {
        this.root.remove(m);
        m.material.dispose();
        this.rings.delete(f);
      }
    });

    // --- projektiler
    const live = new Set();
    game.projectiles.forEach((pr) => {
      live.add(pr);
      let m = this.proj.get(pr);
      if (!m) {
        if (pr.kind === 'frost') {
          m = new THREE.Group();
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), glowMat('#e8fcff', 2.2));
          shaft.rotation.z = Math.PI / 2;
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), glowMat('#7ff3ff', 3.5));
          tip.rotation.z = -Math.PI / 2;
          tip.position.x = 0.36;
          m.add(shaft, tip);
        } else {
          m = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('#ff6ab8'), color: new THREE.Color(4, 3, 4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          m.scale.set(0.6, 0.6, 1);
        }
        this.root.add(m);
        this.proj.set(pr, m);
      }
      const y = pr.kind === 'frost' ? 0.85 : 0.6 + pr.life * 0.4;
      m.position.set(pr.x / T, y, pr.y / T);
      if (pr.kind === 'frost') m.rotation.y = -Math.atan2(pr.vy, pr.vx);
      if (pr.kind === 'frost' && Math.random() < 0.7) this.emit(pr.x / T, y, pr.y / T, { color: '#bff8ff', life: 0.3, size: 0.09, k: 2.5 });
      if (pr.kind === 'bolt' && Math.random() < 0.6) this.emit(pr.x / T, y, pr.y / T, { color: '#ff8ad8', life: 0.25, size: 0.1, k: 3 });
    });
    this.proj.forEach((m, pr) => {
      if (!live.has(pr)) {
        this.root.remove(m);
        this.proj.delete(pr);
      }
    });

    // --- blixtar
    this.bolts = this.bolts.filter((b) => {
      b.t -= dt;
      b.line.material.opacity = Math.max(0, b.t / 0.35);
      if (b.t <= 0) {
        this.root.remove(b.line);
        b.line.geometry.dispose();
        return false;
      }
      return true;
    });
  }

  clear() {
    this.rings.forEach((m) => this.root.remove(m));
    this.rings.clear();
    this.proj.forEach((m) => this.root.remove(m));
    this.proj.clear();
    this.life.fill(0);
    this.tag.fill(0);
    this.counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  }
}
