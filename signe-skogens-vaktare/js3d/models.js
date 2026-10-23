// models.js – procedurella 3D-modeller i referensbildernas stil:
//  • Signe: ståtlig alvkrigare i heltäckande bladrustning med ornamenterad båge
//  • Djuren: fluffiga pastellvarelser med stora glansiga ögon (fur.js)
//  • Robotarna: vita, blanka robotdjur med cyanlysande paneler
//  • Miljön: lysande skymningsskog, jättesvampar, runstenar och grottväggar
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { furMesh } from './fur.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = (c) => new THREE.Color(c);

// ------------------------------------------------------------------
// Material
// ------------------------------------------------------------------
export function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.r ?? 0.6,
    metalness: o.m ?? 0,
    emissive: o.e ? col(o.e) : col('#000000'),
    emissiveIntensity: o.ei ?? 1,
    transparent: !!o.opacity,
    opacity: o.opacity ?? 1,
    flatShading: !!o.flat,
    side: o.side ?? THREE.FrontSide,
  });
}
// Lysande yta: HDR-färg (>1) så att bloom-passet fångar den.
export function glowMat(color, k = 2, o = {}) {
  return new THREE.MeshBasicMaterial({
    color: col(color).multiplyScalar(k),
    transparent: !!o.opacity || !!o.additive,
    opacity: o.opacity ?? 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !o.additive,
    side: o.side ?? THREE.FrontSide,
    vertexColors: !!o.vc,
  });
}

function mesh(geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  m.rotation.set(...r);
  if (typeof s === 'number') m.scale.setScalar(s);
  else m.scale.set(...s);
  m.castShadow = true;
  return m;
}
function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => c && g.add(c));
  return g;
}

// ------------------------------------------------------------------
// Geometri-kit för instansierade miljöobjekt (vertexfärger, sammanslagna)
// ------------------------------------------------------------------
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Färgar och placerar en geometri. grad: [nederkant, överkant] färg.
function part(geometry, color, o = {}) {
  // mjuka normaler (rundade former i stället för kantig lowpoly)
  let g = geometry.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!o.flat) {
    g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-3);
    g.computeVertexNormals();
  }
  g = g.index ? g.toNonIndexed() : g;
  if (o.displace) {
    const R = rand(o.seed || 1);
    const pos = g.attributes.position;
    const cache = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = pos.getX(i).toFixed(3) + ',' + pos.getY(i).toFixed(3) + ',' + pos.getZ(i).toFixed(3);
      if (!cache.has(key)) cache.set(key, 1 + (R() - 0.5) * o.displace);
      const k = cache.get(key);
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    if (!o.flat) {
      g.deleteAttribute('normal');
      g = mergeVertices(g, 1e-3);
      g.computeVertexNormals();
      g = g.toNonIndexed();
    } else g.computeVertexNormals();
  }
  const pos = g.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const c0 = col(Array.isArray(color) ? color[0] : color);
  const c1 = col(Array.isArray(color) ? color[1] : color);
  const top = o.top ? col(o.top) : null;
  const cols = new Float32Array(pos.count * 3);
  const nrm = g.attributes.normal;
  const R2 = rand((o.seed || 7) + 99);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = maxY > minY ? (pos.getY(i) - minY) / (maxY - minY) : 0;
    tmp.copy(c0).lerp(c1, k);
    if (top && nrm.getY(i) > (o.topAt ?? 0.55)) tmp.lerp(top, 0.85);
    const j = o.jitter ? 1 + (R2() - 0.5) * o.jitter : 1;
    cols[i * 3] = tmp.r * j;
    cols[i * 3 + 1] = tmp.g * j;
    cols[i * 3 + 2] = tmp.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Matrix4().compose(
    V3(...(o.p || [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r || [0, 0, 0]))),
    V3(...(typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s || [1, 1, 1]))
  );
  g.applyMatrix4(m);
  return g;
}
const merge = (parts) => mergeGeometries(parts.filter(Boolean), false);

// Kit = { lit: geometri (ljussatt), glow: geometri (lysande) }
export function buildKits() {
  const K = {};
  // --- Skymningsträd: indigoblå stam, kala grenar, turkos krona med lysknoppar
  K.treeBlue = [0, 1, 2].map((v) => {
    const R = rand(10 + v);
    const h = 2.4 + R() * 0.8;
    const lit = [part(new THREE.CylinderGeometry(0.14, 0.3, h, 7, 4), ['#1c1f4a', '#2e3478'], { p: [0, h / 2, 0], jitter: 0.15, seed: v })];
    for (let i = 0; i < 3; i++) {
      const a = R() * Math.PI * 2;
      lit.push(part(new THREE.CylinderGeometry(0.03, 0.07, 1.1, 5), '#2a2f6a', { p: [Math.cos(a) * 0.35, h * 0.62 + i * 0.2, Math.sin(a) * 0.35], r: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9] }));
    }
    const glow = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + R();
      const rr = 0.85 + R() * 0.45;
      const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, cy = h + 0.15 + R() * 0.5;
      lit.push(part(new THREE.IcosahedronGeometry(rr, 1), ['#0a1f45', '#1d5a62'], { p: [cx, cy, cz], s: [1, 0.78, 1], displace: 0.22, seed: v * 10 + i, jitter: 0.35, top: '#3f8a5a', topAt: 0.7 }));
      for (let k = 0; k < 5; k++) {
        const b = R() * Math.PI * 2, e = R() * 0.9;
        glow.push(part(new THREE.OctahedronGeometry(0.06 + R() * 0.04, 0), R() < 0.6 ? '#7ff3ff' : '#d8ff6a', { p: [cx + Math.cos(b) * rr * 0.95, cy + e * rr * 0.6, cz + Math.sin(b) * rr * 0.95] }));
      }
    }
    return { lit: merge(lit), glow: merge(glow), h };
  });
  // --- Frostgran (Dimkronorna): staplade koner i blåviolett med frostljus
  K.treeFrost = [0, 1].map((v) => {
    const R = rand(40 + v);
    const lit = [part(new THREE.CylinderGeometry(0.1, 0.22, 1.2, 6), '#22264e', { p: [0, 0.6, 0] })];
    const glow = [];
    for (let i = 0; i < 4; i++) {
      const r = 1.1 - i * 0.22, y = 0.9 + i * 0.62;
      lit.push(part(new THREE.ConeGeometry(r, 1.1, 8, 2), ['#141c46', '#3a3a82'], { p: [0, y + 0.45, 0], displace: 0.12, seed: v * 7 + i, top: '#b8b4f0', topAt: 0.8, jitter: 0.25 }));
      for (let k = 0; k < 6; k++) {
        const a = R() * Math.PI * 2;
        glow.push(part(new THREE.OctahedronGeometry(0.05, 0), '#e8e0ff', { p: [Math.cos(a) * r * 0.95, y, Math.sin(a) * r * 0.95] }));
      }
    }
    return { lit: merge(lit), glow: merge(glow), h: 3.4 };
  });
  // --- Ljusbjörk: ljus stam, limegrön krona med gula lysprickar
  K.treeBirch = [0, 1].map((v) => {
    const R = rand(70 + v);
    const lit = [part(new THREE.CylinderGeometry(0.1, 0.16, 2.2, 6), ['#b8b4d8', '#ecebf6'], { p: [0, 1.1, 0], jitter: 0.2 })];
    const glow = [];
    for (let i = 0; i < 3; i++) {
      const a = R() * Math.PI * 2;
      const p = [Math.cos(a) * 0.4, 2.3 + R() * 0.5, Math.sin(a) * 0.4];
      lit.push(part(new THREE.IcosahedronGeometry(0.75, 1), ['#2f6a22', '#8ac83a'], { p, displace: 0.25, seed: v * 5 + i, jitter: 0.3 }));
      for (let k = 0; k < 4; k++) {
        const b = R() * Math.PI * 2;
        glow.push(part(new THREE.OctahedronGeometry(0.05, 0), '#fff27a', { p: [p[0] + Math.cos(b) * 0.7, p[1] + (R() - 0.3) * 0.5, p[2] + Math.sin(b) * 0.7] }));
      }
    }
    return { lit: merge(lit), glow: merge(glow), h: 3 };
  });
  // --- Jättesvamp: krämig stam, lysande hatt (gul → orange)
  K.mushroom = [0, 1, 2].map((v) => {
    const R = rand(90 + v);
    const h = 1.0 + R() * 0.9, w = 0.6 + R() * 0.5;
    const hue = [['#d8a020', '#c84a10'], ['#c8b020', '#b83a18'], ['#a8c820', '#c86a10']][v];
    const lit = [part(new THREE.CylinderGeometry(0.1, 0.16, h, 8), ['#d8ccb0', '#f4ecd8'], { p: [0, h / 2, 0], r: [0, 0, (R() - 0.5) * 0.25] })];
    const cap = new THREE.SphereGeometry(w, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const glow = [part(cap, [hue[1], hue[0]], { p: [0, h - 0.05, 0], s: [1, 0.55, 1] }), part(new THREE.CircleGeometry(w * 0.98, 14), '#c8501a', { p: [0, h - 0.06, 0], r: [Math.PI / 2, 0, 0] })];
    return { lit: merge(lit), glow: merge(glow), h };
  });
  // --- Sten: blågrå med limegrön mossa ovanpå
  K.rock = [0, 1, 2].map((v) => ({
    lit: merge([part(new THREE.IcosahedronGeometry(0.55, 2), '#3a4878', { p: [0, 0.3, 0], s: [1.1, 0.75, 1], displace: 0.35, seed: 120 + v, top: '#86a830', topAt: 0.5, jitter: 0.2 })]),
    glow: v === 2 ? merge([part(new THREE.TorusGeometry(0.16, 0.025, 6, 16, Math.PI * 1.6), '#5ff0e0', { p: [0, 0.38, 0.46] })]) : null,
  }));
  // --- Grottvägg: hög, mörk sten med mossa, tickor och kristallflisor
  K.caveWall = [0, 1, 2].map((v) => {
    const R = rand(150 + v);
    const h = 1.5 + R() * 0.7;
    const lit = [part(new THREE.IcosahedronGeometry(0.8, 2), ['#1a1e48', '#38407a'], { p: [0, h / 2, 0], s: [0.85, h / 1.6, 0.85], displace: 0.3, seed: 150 + v, top: '#7a9a2a', topAt: 0.6, jitter: 0.25 })];
    const glow = [];
    for (let i = 0; i < 2; i++) {
      const a = R() * Math.PI * 2;
      glow.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14, 1, false, 0, Math.PI), ['#ff7a1a', '#ffc04a'], { p: [Math.cos(a) * 0.62, 0.4 + R() * 0.8, Math.sin(a) * 0.62], r: [0, -a + Math.PI / 2, 0] }));
    }
    if (v === 1) glow.push(part(new THREE.OctahedronGeometry(0.16, 0), '#7ab8ff', { p: [0.4, h * 0.85, 0.2], s: [0.6, 1.6, 0.6], r: [0.3, 0, 0.4] }));
    return { lit: merge(lit), glow: glow.length ? merge(glow) : null };
  });
  // --- Ruin: vit teknikpelare med cyan panel och rankor
  K.ruin = [0, 1].map((v) => ({
    lit: merge([
      part(new THREE.CylinderGeometry(0.42, 0.5, 1.5 + v * 0.4, 6), ['#9aa2b8', '#e4e8f2'], { p: [0, 0.75 + v * 0.2, 0], jitter: 0.1 }),
      part(new THREE.BoxGeometry(0.5, 0.5, 0.1), '#1c2030', { p: [0, 0.9, 0.45] }),
      part(new THREE.TorusGeometry(0.47, 0.05, 5, 12), '#3a8a3a', { p: [0, 1.1 + v * 0.3, 0], r: [Math.PI / 2 + 0.2, 0, 0] }),
    ]),
    glow: merge([part(new THREE.BoxGeometry(0.36, 0.08, 0.04), '#5ff0ff', { p: [0, 0.98, 0.5] }), part(new THREE.BoxGeometry(0.36, 0.08, 0.04), '#5ff0ff', { p: [0, 0.82, 0.5] })]),
  }));
  // --- Fallen stock med orange tickor
  K.log = [
    {
      lit: merge([
        part(new THREE.CylinderGeometry(0.32, 0.38, 1.9, 9), ['#2a2550', '#4a3a6a'], { p: [0, 0.32, 0], r: [0, 0, Math.PI / 2], jitter: 0.2 }),
        part(new THREE.CircleGeometry(0.36, 9), '#c8a070', { p: [-0.96, 0.32, 0], r: [0, -Math.PI / 2, 0] }),
      ]),
      glow: merge([0, 1, 2].map((i) => part(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12, 1, false, 0, Math.PI), ['#ff7a1a', '#ffc04a'], { p: [-0.5 + i * 0.5, 0.5 + (i % 2) * 0.1, 0.3], r: [0, Math.PI / 2, 0] }))),
    },
  ];
  // --- Skrothög: vita plåtar och cyan bitar
  K.scrap = [0, 1].map((v) => {
    const R = rand(200 + v);
    const lit = [], glow = [];
    for (let i = 0; i < 9; i++) lit.push(part(new THREE.BoxGeometry(0.2 + R() * 0.3, 0.06 + R() * 0.1, 0.15 + R() * 0.25), R() < 0.6 ? '#d8dce8' : '#3a3f50', { p: [(R() - 0.5) * 0.7, 0.05 + R() * 0.35, (R() - 0.5) * 0.7], r: [R(), R() * 3, R()] }));
    glow.push(part(new THREE.BoxGeometry(0.1, 0.1, 0.1), '#5ff0ff', { p: [0.1, 0.4, 0] }));
    return { lit: merge(lit), glow: merge(glow) };
  });
  // --- Energipelare
  K.pylon = [{ lit: merge([part(new THREE.CylinderGeometry(0.07, 0.12, 2.2, 6), ['#8a92a8', '#e8ecf4'], { p: [0, 1.1, 0] }), part(new THREE.BoxGeometry(0.7, 0.07, 0.07), '#c8ccd8', { p: [0, 1.9, 0] })]), glow: merge([part(new THREE.SphereGeometry(0.1, 8, 6), '#5ff0ff', { p: [0, 2.25, 0] })]) }];
  // --- Snår: täta klot med ormbunksblad och lysbär
  K.bush = [0, 1].map((v) => {
    const R = rand(260 + v);
    const lit = [], glow = [];
    for (let i = 0; i < 4; i++) lit.push(part(new THREE.IcosahedronGeometry(0.42 + R() * 0.2, 1), ['#0f3440', '#2a7a5a'], { p: [(R() - 0.5) * 0.6, 0.35 + R() * 0.3, (R() - 0.5) * 0.6], displace: 0.3, seed: v * 9 + i, jitter: 0.3 }));
    for (let i = 0; i < 5; i++) {
      const a = R() * Math.PI * 2;
      lit.push(part(new THREE.ConeGeometry(0.08, 0.7, 4), ['#3a8a2a', '#c8f04a'], { p: [Math.cos(a) * 0.4, 0.6, Math.sin(a) * 0.4], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6] }));
    }
    for (let i = 0; i < 4; i++) glow.push(part(new THREE.OctahedronGeometry(0.05, 0), R() < 0.5 ? '#ff6ad8' : '#7ff3ff', { p: [(R() - 0.5) * 0.9, 0.5 + R() * 0.4, (R() - 0.5) * 0.9] }));
    return { lit: merge(lit), glow: merge(glow) };
  });
  // --- Markdetaljer
  K.grass = [0, 1].map((v) => {
    const R = rand(300 + v);
    const lit = [];
    for (let i = 0; i < 3; i++) {
      const a = R() * Math.PI * 2;
      lit.push(part(new THREE.ConeGeometry(0.04, 0.35 + R() * 0.25, 3), ['#3a6a1a', '#c0e84a'], { p: [Math.cos(a) * 0.12, 0.17, Math.sin(a) * 0.12], r: [(R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5] }));
    }
    return { lit: merge(lit), glow: null };
  });
  K.fern = [{ lit: merge([0, 1.05, 2.1, 3.15, 4.2].map((i) => part(new THREE.ConeGeometry(0.07, 0.6, 3), ['#1f5a3a', '#7ad84a'], { p: [Math.cos(i) * 0.18, 0.18, Math.sin(i) * 0.18], r: [Math.sin(i) * 1.1, 0, -Math.cos(i) * 1.1], s: [1, 1, 0.3] }))), glow: null }];
  K.flower = [
    { lit: merge([part(new THREE.CylinderGeometry(0.012, 0.015, 0.4, 3), '#3a8a3a', { p: [0, 0.2, 0] })]), glow: merge([part(new THREE.SphereGeometry(0.06, 6, 4), '#bff8ff', { p: [0, 0.42, 0] })]) },
    { lit: merge([part(new THREE.CylinderGeometry(0.012, 0.015, 0.3, 3), '#3a8a3a', { p: [0, 0.15, 0] })]), glow: merge([part(new THREE.SphereGeometry(0.05, 6, 4), '#ff9ae8', { p: [0, 0.32, 0] })]) },
    { lit: merge([part(new THREE.CylinderGeometry(0.012, 0.015, 0.35, 3), '#3a8a3a', { p: [0, 0.17, 0] })]), glow: merge([part(new THREE.SphereGeometry(0.055, 6, 4), '#fff27a', { p: [0, 0.37, 0] })]) },
  ];
  K.smallShroom = [{ lit: merge([part(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5), '#f0e8d8', { p: [0, 0.1, 0] })]), glow: merge([part(new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), ['#ff5a2a', '#ffb04a'], { p: [0, 0.18, 0], s: [1, 0.6, 1] })]) }];
  K.fungiRing = [{ lit: null, glow: merge([part(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 18), ['#ff7a1a', '#ffc04a'], { p: [0, 0.02, 0] }), part(new THREE.TorusGeometry(0.28, 0.025, 5, 18), '#fff0c0', { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0] })]) }];
  K.pebble = [{ lit: merge([part(new THREE.IcosahedronGeometry(0.1, 0), '#5a6a9a', { p: [0, 0.05, 0], s: [1, 0.6, 1], flat: true })]), glow: null }];
  K.bolt = [{ lit: merge([part(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), '#c8ccd8', { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0.4] })]), glow: null }];
  K.plank = [{ lit: merge([part(new THREE.BoxGeometry(1.02, 0.1, 0.22), ['#5a3a2a', '#8a5a3a'], { p: [0, 0, -0.33] }), part(new THREE.BoxGeometry(1.02, 0.1, 0.22), ['#5a3a2a', '#8a5a3a'], { p: [0, 0, 0] }), part(new THREE.BoxGeometry(1.02, 0.1, 0.22), ['#5a3a2a', '#8a5a3a'], { p: [0, 0, 0.33] })]), glow: null }];
  return K;
}

// ------------------------------------------------------------------
// Signe – ståtlig alvkrigare, 9 år, heltäckande bladrustning
// ------------------------------------------------------------------
// ArmorColorShader (GDD §5.3) i 3D: rustningszonerna har egna material
// (target_primary/target_secondary) som får spelarens valda färger.
export const ArmorColorShader = {
  apply(model, armor) {
    const z = model.userData.zones;
    if (!z) return;
    const shade = (c, k) => col(c).lerp(col('#0a0820'), k);
    z.helmet.color.copy(col(armor.helmet));
    z.chest.color.copy(col(armor.chest));
    z.chest2.color.copy(shade(armor.chest, 0.3));
    z.legs.color.copy(col(armor.legs));
    z.legs2.color.copy(shade(armor.legs, 0.35));
  },
};

function leaf(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.45, 0, len);
  s.quadraticCurveTo(-wid, len * 0.45, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -0.01);
  return g;
}

export function buildSigne(armor) {
  const skin = std('#f2c4a2', { r: 0.55 });
  const hairM = std('#f0a028', { r: 0.45, e: '#ff9a20', ei: 0.12 });
  const hairL = std('#ffd060', { r: 0.4, e: '#ffb030', ei: 0.15 });
  const gold = std('#e8b84a', { r: 0.3, m: 0.85 });
  const zones = {
    helmet: std('#2f8a5a', { r: 0.45, m: 0.3 }),
    chest: std('#4fc27a', { r: 0.4, m: 0.25 }),
    chest2: std('#2f7a4a', { r: 0.5, m: 0.2 }),
    legs: std('#3a4a6a', { r: 0.6 }),
    legs2: std('#26304a', { r: 0.7 }),
  };
  const boots = std('#3a2a2a', { r: 0.7 });
  const eyeM = std('#2a5ad8', { r: 0.15, e: '#2a6aff', ei: 0.4 });

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.58;
  root.add(hips);

  // ben
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.09, 0, 0);
    const thigh = mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), zones.legs, [0, -0.15, 0]);
    const knee = new THREE.Group();
    knee.position.y = -0.29;
    const shin = mesh(new THREE.CapsuleGeometry(0.058, 0.16, 4, 8), zones.legs2, [0, -0.12, 0]);
    const boot = mesh(new THREE.CapsuleGeometry(0.065, 0.12, 4, 8), boots, [0, -0.2, 0.03], [Math.PI / 2.4, 0, 0]);
    const cuff = mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), gold, [0, -0.1, 0], [Math.PI / 2, 0, 0]);
    const kneeGuard = mesh(leaf(0.14, 0.07), zones.chest, [0, 0.02, 0.06], [-0.2, 0, 0]);
    knee.add(shin, boot, cuff, kneeGuard);
    hip.add(thigh, knee);
    hips.add(hip);
    return { hip, knee };
  });

  // bladkjol
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const l = mesh(leaf(0.26, 0.09), i % 2 ? zones.chest : zones.chest2, [Math.sin(a) * 0.15, -0.02, Math.cos(a) * 0.15], [Math.PI - 0.25, a, 0]);
    l.rotation.order = 'YXZ';
    l.rotation.set(Math.PI + 0.32, a, 0);
    hips.add(l);
  }
  hips.add(mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), gold, [0, 0.03, 0], [Math.PI / 2, 0, 0]));

  // överkropp
  const torso = new THREE.Group();
  torso.position.y = 0.04;
  hips.add(torso);
  torso.add(mesh(new THREE.CapsuleGeometry(0.135, 0.18, 6, 12), zones.chest2, [0, 0.16, 0], [0, 0, 0], [1, 1, 0.8]));
  // bröstplåt av blad
  const plate = mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), zones.chest, [0, 0.2, 0.01], [-Math.PI / 2 + 0.15, 0, 0], [1, 0.75, 1.05]);
  torso.add(plate);
  torso.add(mesh(new THREE.OctahedronGeometry(0.035, 0), glowMat('#5ff0ff', 2.2), [0, 0.22, 0.13]));
  torso.add(mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), gold, [0, 0.17, 0.115], [0, 0, Math.PI]));
  // axelskydd
  [-1, 1].forEach((side) => {
    const sh = mesh(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), zones.chest, [side * 0.17, 0.3, 0], [0, 0, side * -0.5], [1.2, 0.8, 1]);
    torso.add(sh);
    torso.add(mesh(leaf(0.16, 0.07), zones.chest2, [side * 0.21, 0.31, 0], [0, side * Math.PI / 2, side * 1.9]));
    torso.add(mesh(new THREE.TorusGeometry(0.085, 0.01, 5, 14), gold, [side * 0.18, 0.28, 0], [Math.PI / 2, 0, side * -0.5]));
  });
  // mantel
  const cape = mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.55, 12, 3, true, Math.PI * 0.55, Math.PI * 0.9), std('#1f5a4a', { r: 0.8, side: THREE.DoubleSide }), [0, 0.06, -0.02]);
  torso.add(cape);

  // armar
  const arms = [-1, 1].map((side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.19, 0.28, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.048, 0.14, 4, 8), zones.legs, [0, -0.1, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.2;
    const fore = mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8), zones.helmet, [0, -0.08, 0]);
    const bracer = mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 12), gold, [0, -0.13, 0], [Math.PI / 2, 0, 0]);
    const hand = mesh(new THREE.SphereGeometry(0.042, 8, 6), skin, [0, -0.19, 0]);
    elbow.add(fore, bracer, hand);
    sh.add(upper, elbow);
    torso.add(sh);
    return { sh, elbow, hand };
  });

  // huvud
  const head = new THREE.Group();
  head.position.y = 0.48;
  torso.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 8), skin, [0, -0.06, 0]));
  head.add(mesh(new THREE.SphereGeometry(0.13, 18, 14), skin, [0, 0.05, 0], [0, 0, 0], [0.95, 1.05, 1]));
  [-1, 1].forEach((side) => {
    head.add(mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeM, [side * 0.05, 0.06, 0.112], [0, 0, 0], [1, 1.2, 0.6]));
    head.add(mesh(new THREE.SphereGeometry(0.009, 6, 4), glowMat('#ffffff', 1.5), [side * 0.05 - 0.008, 0.07, 0.126]));
    // alvöron
    head.add(mesh(new THREE.ConeGeometry(0.03, 0.15, 6), skin, [side * 0.14, 0.08, -0.01], [0, 0, side * -1.15], [1, 1, 0.5]));
  });
  head.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), std('#c86a6a'), [0, 0.0, 0.123]));
  // hår: lugg, kalott och långa böljande slingor
  head.add(mesh(new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, [0, 0.07, -0.01], [-0.25, 0, 0]));
  for (let i = -3; i <= 3; i++) head.add(mesh(new THREE.ConeGeometry(0.03, 0.12, 5), hairL, [i * 0.032, 0.11, 0.11], [Math.PI - 0.5, 0, i * 0.08]));
  const hair = new THREE.Group();
  hair.position.set(0, 0.1, -0.06);
  head.add(hair);
  const hairStrands = [];
  for (let i = 0; i < 11; i++) {
    const a = ((i - 5) / 5) * 1.25;
    const len = 0.5 + Math.abs(Math.sin(i * 1.7)) * 0.22;
    const pts = [V3(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.03), V3(Math.sin(a) * 0.15, -len * 0.35, -0.08), V3(Math.sin(a) * 0.13, -len * 0.7, -0.14), V3(Math.sin(a) * 0.1 + Math.sin(i) * 0.05, -len, -0.12)];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.035, 6, false);
    // smalnar mot spetsen
    const pos = tube.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const t = SVclamp(-pos.getY(k) / len, 0, 1);
      const c = pts[0].clone().lerp(pts[3], t);
      pos.setX(k, SVlerp(c.x, pos.getX(k), 1 - t * 0.7));
      pos.setZ(k, SVlerp(c.z, pos.getZ(k), 1 - t * 0.7));
    }
    tube.computeVertexNormals();
    const s = mesh(tube, i % 3 ? hairM : hairL);
    hair.add(s);
    hairStrands.push(s);
  }
  // hjälm: bladkrona i guld och zonfärg
  const crown = new THREE.Group();
  crown.position.y = 0.11;
  head.add(crown);
  crown.add(mesh(new THREE.TorusGeometry(0.142, 0.018, 6, 24), gold, [0, 0, 0], [Math.PI / 2 - 0.2, 0, 0]));
  for (let i = 0; i < 7; i++) {
    const a = ((i - 3) / 3) * 1.1;
    crown.add(mesh(leaf(0.13 - Math.abs(i - 3) * 0.015, 0.05), zones.helmet, [Math.sin(a) * 0.14, 0.02, Math.cos(a) * 0.14 - 0.02], [-0.35, a, 0]));
  }
  crown.add(mesh(new THREE.OctahedronGeometry(0.025, 0), glowMat('#5ff0ff', 2.5), [0, 0.03, 0.15]));

  // båge med bladformade ändar (närstrid) och strängen
  const bow = new THREE.Group();
  const bowM = std('#7a2a22', { r: 0.4, m: 0.2, e: '#3a0a0a', ei: 0.3 });
  const bowPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16 - 0.5;
    bowPts.push(V3(0, t * 0.9, -Math.cos(t * Math.PI) * 0.16 + Math.sin(t * 18) * 0.012));
  }
  bow.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bowPts), 32, 0.02, 6), bowM));
  [-1, 1].forEach((s) => {
    bow.add(mesh(new THREE.ConeGeometry(0.03, 0.18, 4), bowM, [0, s * 0.5, 0.02], [s * 0.4 + (s < 0 ? Math.PI : 0), 0, 0]));
    bow.add(mesh(new THREE.ConeGeometry(0.018, 0.1, 4), gold, [0, s * 0.33, -0.12], [Math.PI / 2, 0, 0]));
  });
  const bowGlow = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.92, 4), glowMat('#c8f8ff', 1.6), [0, 0, 0.16]);
  bow.add(bowGlow);
  const edge = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bowPts), 32, 0.008, 4), glowMat('#5ff0ff', 3, { additive: true }));
  edge.visible = false;
  bow.add(edge);
  bow.position.set(0, -0.2, 0.04);
  bow.rotation.set(0, Math.PI / 2, 0);
  arms[0].elbow.add(bow);
  // pilkoger
  torso.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 8), std('#5a3a2a'), [0.08, 0.2, -0.14], [0.35, 0, -0.3]));
  for (let i = 0; i < 3; i++) torso.add(mesh(new THREE.ConeGeometry(0.02, 0.06, 4), glowMat('#9fe6ff', 1.8), [0.1 + i * 0.015, 0.39, -0.2 + i * 0.01], [0.35, 0, -0.3]));

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  root.userData = { zones, legs, arms, torso, head, hair, hairStrands, bow, bowEdge: edge, hips, anim: { t: 0, swing: 0 } };
  ArmorColorShader.apply(root, armor);
  return root;
}
const SVclamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SVlerp = (a, b, t) => a + (b - a) * t;

// Spelar upp Signes rörelser: gång, andning, hugg, pilskott, laddning.
export function animateSigne(model, s) {
  const u = model.userData;
  const a = u.anim;
  a.t += s.dt * (s.moving ? 9 * s.speedK : 2);
  const w = s.moving ? Math.sin(a.t) : 0;
  u.legs[0].hip.rotation.x = w * 0.7;
  u.legs[1].hip.rotation.x = -w * 0.7;
  u.legs[0].knee.rotation.x = s.moving ? Math.max(0, -Math.cos(a.t)) * 0.8 : 0;
  u.legs[1].knee.rotation.x = s.moving ? Math.max(0, Math.cos(a.t)) * 0.8 : 0;
  u.hips.position.y = 0.58 + (s.moving ? Math.abs(Math.cos(a.t)) * 0.035 : Math.sin(a.t) * 0.006);
  u.torso.rotation.x = s.moving ? 0.12 : 0;
  // armar: bågarmen fram vid skott/hugg
  const [bowArm, drawArm] = u.arms;
  let bowX = s.moving ? -w * 0.5 : 0.1, bowZ = -0.15, drawX = s.moving ? w * 0.5 : 0.1, drawZ = 0.15, twist = 0;
  if (s.shot > 0) {
    const k = Math.min(1, s.shot / 0.12);
    bowX = -1.5;
    bowZ = -0.1;
    drawX = -1.5 + k * 0.4;
    drawZ = 0.6;
    twist = 0.5;
  }
  if (s.charge > 0) {
    bowX = -0.9;
    drawX = -1.1;
    drawZ = 0.4;
  }
  if (s.swing > 0) {
    const k = 1 - s.swing / 0.18;
    bowX = -1.3;
    bowZ = SVlerp(-1.4, 1.0, k);
    twist = SVlerp(-0.8, 0.8, k);
  }
  bowArm.sh.rotation.set(bowX, 0, bowZ);
  drawArm.sh.rotation.set(drawX, 0, drawZ);
  bowArm.elbow.rotation.x = s.shot > 0 ? 0 : -0.25;
  drawArm.elbow.rotation.x = s.shot > 0 ? -1.4 : -0.3;
  u.torso.rotation.y = twist;
  u.bowEdge.visible = s.swing > 0 || s.charge > 0.25;
  // håret fladdrar efter
  u.hair.rotation.x = 0.15 + (s.moving ? 0.45 * s.speedK : 0.05) + Math.sin(a.t * 0.5) * 0.04;
  u.hair.rotation.z = Math.sin(a.t * 0.37) * 0.06;
}

// ------------------------------------------------------------------
// Djuren – fluffiga pastellvarelser
// ------------------------------------------------------------------
const FUR = {
  dog: { a: '#fdeedb', b: '#f0c48a', c: '#ffd8f0' },
  lynx: { a: '#f4eefc', b: '#c8b0f0', c: '#a8f0e0' },
  owl: { a: '#f8f0e8', b: '#d8b890', c: '#ffd0a8' },
  moose: { a: '#f4ecf8', b: '#d8c0e8', c: '#ffd8b0' },
  fox: { a: '#fff4ec', b: '#f8b48c', c: '#f4a0d0' },
  beaver: { a: '#f8ece4', b: '#e0b49a', c: '#a8e8d8' },
};

function bigEye(iris = '#3a1f4a', rim = '#e8a070') {
  const g = new THREE.Group();
  const eyeGeo = new THREE.SphereGeometry(1, 20, 14);
  const cols = new Float32Array(eyeGeo.attributes.position.count * 3);
  const c0 = col('#140a20'), c1 = col(iris), c2 = col(rim), tmp = new THREE.Color();
  for (let i = 0; i < eyeGeo.attributes.position.count; i++) {
    const z = eyeGeo.attributes.position.getZ(i);
    const k = SVclamp((z - 0.55) / 0.45, 0, 1);
    tmp.copy(c2).lerp(c1, SVclamp((z - 0.2) / 0.5, 0, 1)).lerp(c0, k * k);
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  eyeGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  g.add(mesh(eyeGeo, m));
  g.add(mesh(new THREE.SphereGeometry(0.32, 8, 6), glowMat('#ffffff', 1.6), [-0.32, 0.36, 0.86]));
  g.add(mesh(new THREE.SphereGeometry(0.14, 6, 4), glowMat('#ffffff', 1.4), [0.3, -0.3, 0.92]));
  return g;
}

function furPart(geo, palette, o = {}) {
  const d = o.density ? [o.density[0] * 1.6, o.density[1] * 1.6] : undefined;
  return furMesh(geo, { a: palette.a, b: palette.b, c: palette.c, length: (o.length ?? 0.05) * 1.25, gravity: o.gravity ?? 0.4, density: d, pattern: o.pattern, shimmer: o.shimmer });
}

export function buildCompanion(kind) {
  const P = FUR[kind];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pink = std('#f6a8b8', { r: 0.5 });
  const ear = new THREE.MeshPhysicalMaterial({ color: '#ffe0f0', roughness: 0.3, iridescence: 1, iridescenceIOR: 1.6, sheen: 1, sheenColor: col('#c8f0ff'), side: THREE.DoubleSide });
  const sph = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);
  const parts = { legs: [], ears: [], tail: null, wings: [] };
  const U = root.userData;

  const addLegs = (len, spread, z, r = 0.07) =>
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
      const g = new THREE.Group();
      g.position.set(sx * spread, len, sz * z);
      const leg = furPart(new THREE.CapsuleGeometry(r, len, 3, 8), P, { length: 0.03, density: [40, 24] });
      leg.position.y = -len / 2;
      g.add(leg);
      g.add(mesh(sph(r * 1.05, 10, 8), pink, [0, -len - 0.01, 0.02], [0, 0, 0], [1, 0.6, 1.1]));
      body.add(g);
      parts.legs.push(g);
    });

  let headY = 0.42, headZ = 0.18, headR = 0.2, bodyR = 0.2;
  if (kind === 'owl') {
    body.add(furPart(sph(0.24), P, { length: 0.05, density: [60, 30], pattern: 5 }));
    body.children[0].scale.set(1, 1.15, 0.95);
    body.children[0].position.y = 0.3;
    headY = 0.55;
    headZ = 0.03;
    headR = 0.2;
    [-1, 1].forEach((s) => {
      const w = new THREE.Group();
      w.position.set(s * 0.2, 0.36, -0.02);
      const wing = furPart(sph(0.16), P, { length: 0.04, density: [50, 24] });
      wing.scale.set(0.35, 1, 0.8);
      wing.position.y = -0.08;
      w.add(wing);
      body.add(w);
      parts.wings.push(w);
    });
    [-1, 1].forEach((s) => body.add(mesh(new THREE.ConeGeometry(0.03, 0.06, 4), std('#e8a040'), [s * 0.07, 0.02, 0.06], [0, 0, 0], [1, 1, 1])));
  } else {
    const long = kind === 'moose' ? 0.3 : kind === 'beaver' ? 0.22 : 0.26;
    bodyR = kind === 'beaver' ? 0.24 : 0.19;
    const torso = furPart(new THREE.CapsuleGeometry(bodyR, long, 5, 14), P, { length: 0.06, density: [60, 40] });
    torso.rotation.x = Math.PI / 2;
    const legLen = kind === 'moose' ? 0.42 : kind === 'beaver' ? 0.08 : 0.16;
    torso.position.y = legLen + bodyR * 0.9;
    body.add(torso);
    addLegs(legLen, bodyR * 0.6, long * 0.5, kind === 'moose' ? 0.06 : 0.065);
    headY = torso.position.y + bodyR * (kind === 'moose' ? 1.3 : 1.0);
    headZ = long * 0.5 + bodyR * 0.75;
    headR = kind === 'moose' ? 0.19 : 0.21;
  }

  // huvud med jätteögon
  const head = new THREE.Group();
  head.position.set(0, headY, headZ);
  body.add(head);
  head.add(furPart(sph(headR), P, { length: 0.05, density: [64, 32], pattern: 4 }));
  const eyeIris = kind === 'owl' ? '#c86a10' : kind === 'lynx' ? '#4a2a7a' : '#3a1f4a';
  const eyeRim = kind === 'owl' ? '#ffd040' : '#f0b080';
  [-1, 1].forEach((s) => {
    const e = bigEye(eyeIris, eyeRim);
    e.scale.setScalar(headR * (kind === 'owl' ? 0.42 : 0.38));
    e.position.set(s * headR * 0.42, headR * 0.12, headR * 0.82);
    e.rotation.y = s * 0.25;
    head.add(e);
  });
  head.add(mesh(sph(headR * 0.1, 8, 6), pink, [0, -headR * 0.2, headR * 1.02]));
  if (kind !== 'owl') head.add(mesh(new THREE.TorusGeometry(headR * 0.12, headR * 0.02, 4, 10, Math.PI), std('#c86a8a'), [0, -headR * 0.38, headR * 0.98], [0, 0, Math.PI]));

  // öron per art
  const addEar = (pos, rot, scale, inner = true, tuft) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.set(...rot);
    const outer = furPart(sph(0.1, 16, 12), P, { length: 0.035, density: [40, 24], shimmer: 0.9 });
    outer.scale.set(...scale);
    outer.position.y = scale[1] * 0.08;
    g.add(outer);
    if (inner) {
      const inn = mesh(sph(0.1, 14, 10), ear, [0, scale[1] * 0.08, 0.035], [0, 0, 0], [scale[0] * 0.7, scale[1] * 0.85, scale[2] * 0.4]);
      g.add(inn);
    }
    if (tuft) g.add(mesh(new THREE.ConeGeometry(0.02, 0.12, 5), glowMat(tuft, 1.4), [0, scale[1] * 0.19, 0]));
    head.add(g);
    parts.ears.push(g);
  };
  if (kind === 'dog') [-1, 1].forEach((s) => addEar([s * headR * 1.0, headR * 0.35, -0.02], [0.2, 0, s * 2.5], [1.2, 2.6, 0.55]));
  if (kind === 'lynx') [-1, 1].forEach((s) => addEar([s * headR * 0.62, headR * 0.82, -0.02], [0, 0, s * -0.3], [0.75, 1.35, 0.45], true, '#6a3ac8'));
  if (kind === 'fox') [-1, 1].forEach((s) => addEar([s * headR * 0.62, headR * 0.75, -0.02], [0, 0, s * -0.45], [1.3, 2.6, 0.5]));
  if (kind === 'owl') [-1, 1].forEach((s) => addEar([s * headR * 0.6, headR * 0.85, 0], [0, 0, s * -0.4], [0.5, 1.4, 0.4], false));
  if (kind === 'beaver') [-1, 1].forEach((s) => addEar([s * headR * 0.75, headR * 0.6, 0], [0, 0, s * -0.6], [0.6, 0.6, 0.4]));
  if (kind === 'moose') [-1, 1].forEach((s) => addEar([s * headR * 0.95, headR * 0.45, -0.03], [0, 0, s * -1.2], [0.7, 1.6, 0.4]));
  if (kind === 'beaver') {
    head.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.015), std('#fff8f0', { r: 0.2 }), [0, -headR * 0.5, headR * 0.98]));
  }

  // lysande detaljer per art
  const glowBits = [];
  if (kind === 'dog') {
    const collar = mesh(new THREE.TorusGeometry(headR * 0.7, 0.02, 6, 20), glowMat('#5ff0ff', 2.2), [0, -headR * 0.65, -0.02], [Math.PI / 2 + 0.3, 0, 0]);
    head.add(collar);
  }
  if (kind === 'moose') {
    const antlers = new THREE.Group();
    [-1, 1].forEach((s) => {
      antlers.add(mesh(new THREE.ConeGeometry(0.035, 0.14, 6), glowMat('#ffd27a', 1.6), [s * 0.08, headR * 1.0, 0], [0, 0, s * -0.3]));
    });
    head.add(antlers);
    U.antlers = antlers;
    const big = new THREE.Group();
    [-1, 1].forEach((s) => {
      const pts = [V3(s * 0.06, headR, 0), V3(s * 0.22, headR + 0.12, -0.02), V3(s * 0.34, headR + 0.2, 0.02)];
      big.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.025, 5), glowMat('#ffd27a', 1.8)));
      for (let k = 0; k < 3; k++) big.add(mesh(new THREE.ConeGeometry(0.02, 0.12, 5), glowMat('#ffe6a8', 1.8), [s * (0.18 + k * 0.07), headR + 0.2 + k * 0.02, 0], [0, 0, s * -0.2]));
    });
    big.visible = false;
    head.add(big);
    U.bigAntlers = big;
  }

  // svans
  const tail = new THREE.Group();
  if (kind === 'fox') {
    tail.position.set(0, 0.36, -0.28);
    let prev = tail;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0.08, -0.08);
      seg.rotation.x = 0.35;
      const r = 0.13 + Math.sin(i / 3 * Math.PI) * 0.06;
      seg.add(furPart(sph(r, 16, 12), { a: i === 3 ? '#ffffff' : P.b, b: '#f4a0d0', c: '#ffe0c0' }, { length: 0.06, density: [44, 26], gravity: 0.2 }));
      prev.add(seg);
      prev = seg;
    }
  } else if (kind === 'beaver') {
    tail.position.set(0, 0.12, -0.32);
    const paddle = mesh(new THREE.SphereGeometry(0.16, 14, 8), std('#3a6a8a', { r: 0.3, e: '#3af0d0', ei: 0.35 }), [0, 0, -0.14], [0, 0, 0], [0.9, 0.18, 1.3]);
    tail.add(paddle);
  } else if (kind === 'owl') {
    tail.position.set(0, 0.12, -0.18);
    tail.add(mesh(new THREE.ConeGeometry(0.07, 0.15, 6), std('#c8a070'), [0, 0, -0.04], [-1.2, 0, 0]));
  } else {
    const len = kind === 'lynx' ? 1 : kind === 'moose' ? 1 : 2;
    tail.position.set(0, (kind === 'moose' ? 0.7 : 0.42), -0.3);
    let prev = tail;
    for (let i = 0; i < len + 1; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0.05, -0.07);
      seg.rotation.x = 0.4;
      seg.add(furPart(sph(0.08 - i * 0.012, 14, 10), i === len && kind === 'lynx' ? { a: '#6a3aa8', b: '#8a5ad8', c: '#c8a8ff' } : P, { length: 0.05, density: [36, 20] }));
      prev.add(seg);
      prev = seg;
    }
  }
  body.add(tail);
  parts.tail = tail;

  // aura (nivå 2 och 3) – en lysande ring på marken
  const aura = mesh(new THREE.RingGeometry(0.38, 0.46, 40), glowMat('#5ff0e0', 1.6, { additive: true, side: THREE.DoubleSide }), [0, 0.03, 0], [-Math.PI / 2, 0, 0]);
  aura.castShadow = false;
  aura.visible = false;
  root.add(aura);
  Object.assign(U, { kind, body, head, parts, aura, glowBits, t: Math.random() * 10 });
  return root;
}

export function animateCompanion(model, s) {
  const U = model.userData;
  U.t += s.dt;
  const t = U.t;
  const run = s.moving ? 1 : 0;
  const k = t * (s.moving ? 11 : 2.5);
  U.parts.legs.forEach((g, i) => (g.rotation.x = run * Math.sin(k + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7));
  U.body.position.y = (s.moving ? Math.abs(Math.sin(k)) * 0.04 : Math.sin(t * 2) * 0.008) + (s.z || 0);
  U.parts.ears.forEach((g, i) => (g.rotation.x = Math.sin(t * 3 + i) * 0.08 - run * 0.3));
  if (U.parts.tail) {
    U.parts.tail.rotation.y = Math.sin(t * (s.moving ? 14 : 5)) * 0.45;
    U.parts.tail.rotation.x = run * 0.25;
  }
  U.head.rotation.y = s.moving ? 0 : Math.sin(t * 0.6) * 0.3;
  U.head.rotation.z = s.moving ? 0 : Math.sin(t * 0.43) * 0.12;
  U.parts.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (0.25 + Math.sin(t * (s.flying ? 18 : 2)) * (s.flying ? 0.9 : 0.05))));
  const lvl = s.level || 1;
  U.aura.visible = lvl >= 2;
  if (U.aura.visible) {
    U.aura.material.color.copy(col(lvl === 3 ? '#ffd25e' : '#5ff0e0')).multiplyScalar(1.4 + Math.sin(t * 3) * 0.4);
    U.aura.rotation.z = t * 0.5;
  }
  if (U.bigAntlers) {
    U.bigAntlers.visible = lvl === 3;
    U.antlers.visible = lvl < 3;
  }
}

// ------------------------------------------------------------------
// Robotar – vita, blanka robotdjur (referens: robot-isbjörnen)
// ------------------------------------------------------------------
function robotMats() {
  return {
    shell: new THREE.MeshPhysicalMaterial({ color: '#eef2f8', metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 }),
    inner: std('#1a1e2c', { r: 0.45, m: 0.7 }),
    joint: std('#4a5068', { r: 0.3, m: 0.9 }),
    panel: glowMat('#3ad8ff', 2.2),
    eye: glowMat('#4ab0ff', 3),
    disc: std('#c8ccd8', { r: 0.25, m: 0.8 }),
    claw: std('#2a2e3a', { r: 0.3, m: 0.6 }),
  };
}

function roboLeg(M, len, thick) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(thick, len * 0.4, 4, 10), M.shell, [0, -len * 0.25, 0]));
  g.add(mesh(new THREE.CylinderGeometry(thick * 0.8, thick * 0.8, thick * 1.6, 12), M.joint, [0, -len * 0.55, 0], [0, 0, Math.PI / 2]));
  g.add(mesh(new THREE.TorusGeometry(thick * 0.55, thick * 0.12, 6, 16), M.panel, [thick * 0.82, -len * 0.55, 0], [0, Math.PI / 2, 0]));
  const lower = new THREE.Group();
  lower.position.y = -len * 0.55;
  lower.add(mesh(new THREE.CapsuleGeometry(thick * 0.8, len * 0.3, 4, 10), M.shell, [0, -len * 0.22, 0.02]));
  lower.add(mesh(new THREE.BoxGeometry(thick * 2.1, thick * 0.7, thick * 2.4), M.shell, [0, -len * 0.45, thick * 0.3]));
  for (let i = -1; i <= 1; i++) lower.add(mesh(new THREE.ConeGeometry(thick * 0.18, thick * 0.6, 4), M.claw, [i * thick * 0.6, -len * 0.47, thick * 1.5], [Math.PI / 2, 0, 0]));
  g.add(lower);
  g.userData.lower = lower;
  return g;
}

export function buildRobot(type) {
  const M = robotMats();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legs = [];
  let head = null;
  if (type === 'bear' || type === 'hound') {
    const S = type === 'bear' ? 1 : 0.55;
    const legLen = (type === 'bear' ? 0.62 : 0.85) * S, thick = (type === 'bear' ? 0.13 : 0.1) * S;
    body.position.y = legLen + 0.1 * S;
    if (type === 'hound') body.scale.set(0.75, 0.9, 1.15);
    // bål: vita skalplåtar över en mörk mekanisk kärna med lysande paneler
    body.add(mesh(new THREE.CapsuleGeometry(0.32 * S, 0.7 * S, 6, 14), M.inner, [0, 0.12 * S, 0], [Math.PI / 2, 0, 0], [1, 1, 0.9]));
    body.add(mesh(new THREE.SphereGeometry(0.42 * S, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), M.shell, [0, 0.2 * S, -0.22 * S], [0, 0, 0], [1, 0.95, 1.2]));
    body.add(mesh(new THREE.SphereGeometry(0.42 * S, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), M.shell, [0, 0.22 * S, 0.24 * S], [0.15, 0, 0], [1, 0.95, 1.1]));
    for (let i = 0; i < 4; i++) body.add(mesh(new THREE.BoxGeometry(0.1 * S, 0.06 * S, 0.12 * S), M.panel, [0.3 * S, 0.12 * S + (i % 2) * 0.09 * S, -0.1 * S + Math.floor(i / 2) * 0.15 * S]));
    for (let i = 0; i < 5; i++) body.add(mesh(new THREE.BoxGeometry(0.16 * S, 0.035 * S, 0.06 * S), M.panel, [0, 0.62 * S, -0.35 * S + i * 0.16 * S]));
    // lysande paneler längs ryggen och sidorna (som referensens robotbjörn)
    [-1, 1].forEach((sx) => {
      for (let i = 0; i < 3; i++) {
        const pnl = mesh(new THREE.BoxGeometry(0.03 * S, 0.12 * S, 0.14 * S), M.panel, [sx * 0.41 * S, 0.34 * S, -0.3 * S + i * 0.2 * S], [0, 0, sx * -0.5]);
        body.add(pnl);
      }
    });
    // axelskivor
    [-1, 1].forEach((sx) => {
      [-1, 1].forEach((sz) => {
        const d = mesh(new THREE.CylinderGeometry(0.18 * S, 0.18 * S, 0.06 * S, 24), M.disc, [sx * 0.33 * S, 0.2 * S, sz * 0.3 * S], [0, 0, Math.PI / 2]);
        body.add(d);
        body.add(mesh(new THREE.TorusGeometry(0.11 * S, 0.012 * S, 6, 20), M.panel, [sx * 0.37 * S, 0.2 * S, sz * 0.3 * S], [0, Math.PI / 2, 0]));
        const leg = roboLeg(M, legLen, thick);
        leg.position.set(sx * 0.28 * S, 0.05 * S, sz * 0.3 * S);
        body.add(leg);
        legs.push(leg);
      });
    });
    // huvud
    head = new THREE.Group();
    head.position.set(0, 0.32 * S, 0.62 * S);
    body.add(head);
    head.add(mesh(new THREE.CylinderGeometry(0.13 * S, 0.16 * S, 0.2 * S, 12), M.joint, [0, -0.04 * S, -0.12 * S], [Math.PI / 2, 0, 0]));
    if (type === 'bear') {
      head.add(mesh(new THREE.SphereGeometry(0.22, 18, 14), M.shell, [0, 0.04, 0], [0, 0, 0], [1, 0.9, 1.05]));
      head.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 14), M.shell, [0, -0.02, 0.2], [Math.PI / 2, 0, 0]));
      head.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), M.inner, [0, 0.0, 0.32], [0, 0, 0], [1.3, 0.9, 0.8]));
      [-1, 1].forEach((s) => head.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), M.shell, [s * 0.15, 0.2, -0.04], [0, 0, 0], [1, 1, 0.6])));
    } else {
      head.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), M.shell, [0, 0.04, 0]));
      head.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 10), M.shell, [0, 0, 0.16], [Math.PI / 2, 0, 0]));
      [-1, 1].forEach((s) => head.add(mesh(new THREE.ConeGeometry(0.04, 0.12, 4), M.shell, [s * 0.07, 0.15, -0.02], [0, 0, s * -0.2])));
      body.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.5), M.panel, [0, 0.42 * S + 0.06, -0.05]));
    }
    [-1, 1].forEach((s) => head.add(mesh(new THREE.SphereGeometry(type === 'bear' ? 0.035 : 0.022, 10, 8), M.eye, [s * (type === 'bear' ? 0.09 : 0.055), 0.08, type === 'bear' ? 0.17 : 0.1])));
  } else {
    // drönare: vit skiva med koncentriska ringar, lins och rotorkapslar
    body.position.y = 1.5;
    body.add(mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.14, 32), M.shell));
    body.add(mesh(new THREE.TorusGeometry(0.36, 0.02, 6, 32), M.panel, [0, 0.03, 0], [Math.PI / 2, 0, 0]));
    body.add(mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 28), M.disc, [0, 0.08, 0], [Math.PI / 2, 0, 0]));
    body.add(mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.shell, [0, 0.07, 0]));
    body.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), M.inner, [0, -0.08, 0]));
    const lens = mesh(new THREE.SphereGeometry(0.06, 12, 8), M.eye, [0, -0.13, 0.04]);
    body.add(lens);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const pod = new THREE.Group();
      pod.position.set(Math.cos(a) * 0.48, 0.02, Math.sin(a) * 0.48);
      pod.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), M.disc));
      const rotor = mesh(new THREE.BoxGeometry(0.22, 0.01, 0.03), M.joint, [0, 0.05, 0]);
      pod.add(rotor);
      body.add(pod);
      legs.push(rotor);
    }
    // sökarljuskon
    const cone = mesh(new THREE.ConeGeometry(0.9, 1.6, 24, 1, true), glowMat('#fff2b0', 0.35, { additive: true, opacity: 0.4, side: THREE.DoubleSide }), [0, -0.8, 0]);
    cone.castShadow = false;
    const beam = new THREE.Group();
    beam.add(cone);
    body.add(beam);
    root.userData.beam = beam;
    root.userData.beamMat = cone.material;
  }
  // isskal som visas när roboten är frusen
  const ice = mesh(new THREE.IcosahedronGeometry(type === 'bear' ? 0.9 : type === 'drone' ? 0.55 : 0.5, 1), new THREE.MeshPhysicalMaterial({ color: '#bff0ff', transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0, clearcoat: 1, emissive: col('#4ab0ff'), emissiveIntensity: 0.25 }), [0, type === 'drone' ? 1.5 : type === 'bear' ? 0.75 : 0.42, 0]);
  ice.visible = false;
  ice.castShadow = false;
  root.add(ice);
  root.userData = Object.assign(root.userData, { type, M, body, legs, head, ice, t: Math.random() * 10, baseY: body.position.y, fall: 0 });
  return root;
}

const EYE = { patrol: col('#4ab0ff').multiplyScalar(3), alert: col('#ff3a6a').multiplyScalar(3.5), off: col('#202430') };
export function animateRobot(model, s) {
  const U = model.userData;
  U.t += s.dt * (s.frozen || s.stunned ? 0 : 1);
  const t = U.t;
  const moving = s.moving && !s.frozen && !s.stunned;
  if (U.type === 'drone') {
    U.body.position.y = U.baseY + Math.sin(t * 2.2) * 0.08 - U.fall * 1.3;
    U.legs.forEach((r) => (r.rotation.y += s.frozen ? 0 : s.dt * 30));
    if (U.beam) {
      U.beam.rotation.set(0.6, s.searchRel, 0, 'YXZ');
      U.beam.visible = s.beam;
      U.beamMat.color.copy(col(s.alert ? '#ff8a8a' : '#fff2b0')).multiplyScalar(0.35);
    }
  } else {
    const k = t * (s.alert ? 9 : 6);
    U.legs.forEach((g, i) => {
      g.rotation.x = moving ? Math.sin(k + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 : 0;
      g.userData.lower.rotation.x = moving ? Math.max(0, Math.sin(k + (i === 0 || i === 3 ? 0 : Math.PI))) * 0.5 : 0;
    });
    U.body.position.y = U.baseY + (moving ? Math.abs(Math.sin(k)) * 0.03 : 0) - U.fall * U.baseY * 0.6;
    U.body.rotation.z = U.fall * 1.2;
    if (U.head) U.head.rotation.x = s.windup ? -0.4 + Math.sin(t * 30) * 0.05 : moving ? Math.sin(k * 0.5) * 0.06 : Math.sin(t) * 0.05;
  }
  U.fall = s.disabled ? Math.min(1, U.fall + s.dt * 2) : 0;
  // ögon och paneler
  const flicker = s.stunned ? (Math.sin(t * 40) > 0.3 ? 1 : 0.15) : 1;
  const eyeC = s.disabled || s.blind ? EYE.off : s.alert ? EYE.alert : EYE.patrol;
  U.M.eye.color.copy(eyeC).multiplyScalar(flicker);
  U.M.panel.color.copy(col('#3ad8ff')).multiplyScalar(s.disabled ? 0.05 : 2.2 * flicker);
  U.M.shell.emissive.copy(s.flash ? col('#ffffff') : col('#000000'));
  U.M.shell.emissiveIntensity = s.flash ? 1.5 : 0;
  U.ice.visible = !!s.frozen;
  model.traverse((o) => {
    if (o.material && o.material.transparent !== undefined && s.fade !== undefined) {
      /* uttoning hanteras via synlighet */
    }
  });
  model.visible = s.fade < 1;
}

// ------------------------------------------------------------------
// Föremål och byggnader
// ------------------------------------------------------------------
export function buildCrystal() {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: '#6ab0ff', emissive: col('#3a7aff'), emissiveIntensity: 1.6, roughness: 0.05, transparent: true, opacity: 0.9, clearcoat: 1 });
  const shards = [[0, 0.55, 0, 0.16, 1], [0.14, 0.32, 0.05, 0.1, 0.6], [-0.13, 0.3, -0.04, 0.09, 0.55], [0.03, 0.25, -0.15, 0.08, 0.5]];
  shards.forEach(([x, y, z, r, h], i) => g.add(mesh(new THREE.OctahedronGeometry(r, 0), m, [x, y, z], [i * 0.3, i, i * 0.2 - 0.1], [1, h * 3.2, 1])));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('#ff4ae0'), color: col('#ffffff').multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(3.4, 3.4, 1);
  halo.position.y = 0.5;
  g.add(halo);
  g.scale.setScalar(1.6);
  g.userData = { halo };
  return g;
}

let _radial = {};
export function radialTexture(color) {
  if (_radial[color]) return _radial[color];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  const cc = col(color);
  const rgb = `${Math.round(cc.r * 255)},${Math.round(cc.g * 255)},${Math.round(cc.b * 255)}`;
  gr.addColorStop(0, `rgba(${rgb},0.9)`);
  gr.addColorStop(0.35, `rgba(${rgb},0.35)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _radial[color] = t;
  return t;
}

export function buildChest(open) {
  const g = new THREE.Group();
  const wood = std('#6a3a2a', { r: 0.7 });
  const gold = std('#e8b84a', { r: 0.3, m: 0.85 });
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.32, 0.4), wood, [0, 0.16, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.62, 0.04, 0.42), gold, [0, 0.3, 0]));
  const lid = new THREE.Group();
  lid.position.set(0, 0.32, -0.2);
  lid.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12, 1, false, 0, Math.PI), wood, [0, 0, 0.2], [0, 0, Math.PI / 2]));
  lid.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), glowMat('#5ff0ff', 2), [0, 0.02, 0.41]));
  g.add(lid);
  const glow = mesh(new THREE.CircleGeometry(0.18, 16), glowMat('#ffd27a', 2.5), [0, 0.33, 0], [-Math.PI / 2, 0, 0]);
  glow.visible = false;
  g.add(glow);
  g.userData = { lid, glow };
  setChestOpen(g, open);
  return g;
}
export function setChestOpen(g, open) {
  g.userData.lid.rotation.x = open ? -1.9 : 0;
  g.userData.glow.visible = open;
}

export function buildRunestone() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 10), std('#5a6a98', { r: 0.8, flat: false }), [0, 0.7, 0], [0, 0, 0], [1, 1, 0.45]));
  const runes = glowMat('#5ff0e0', 1.2);
  const spiral = new THREE.Group();
  for (let i = 0; i < 3; i++) spiral.add(mesh(new THREE.TorusGeometry(0.07 + i * 0.06, 0.012, 4, 24, Math.PI * 1.5), runes, [0, 0, 0], [0, 0, i * 1.3]));
  spiral.position.set(0, 0.8, 0.15);
  g.add(spiral);
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 14), std('#7aa030'), [0, 0.12, 0], [Math.PI / 2, 0, 0]));
  g.userData = { runes };
  return g;
}

export function buildForge() {
  const g = new THREE.Group();
  const stone = std('#4a5478', { r: 0.9 });
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.3, 8), stone, [-0.4, 0.65, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8), stone, [-0.4, 1.6, 0]));
  g.add(mesh(new THREE.CircleGeometry(0.3, 16), glowMat('#ff8a2a', 3), [-0.4, 0.5, 0.62]));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), std('#3a4058', { m: 0.9, r: 0.3 }), [0.5, 0.62, 0.1]));
  g.add(mesh(new THREE.BoxGeometry(0.25, 0.45, 0.22), std('#2a2e3a', { m: 0.8, r: 0.4 }), [0.5, 0.3, 0.1]));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.2), glowMat('#5ff0ff', 2), [0.55, 0.74, 0.1]));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), std('#6a4a3a'), [0.75, 0.86, 0.05], [0, 0, 0.6]));
  return g;
}
export function buildTent() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(0.9, 1.4, 6, 1, true), std('#c89a5a', { r: 0.9, side: THREE.DoubleSide }), [0, 0.7, 0]));
  g.add(mesh(new THREE.CircleGeometry(0.3, 12), std('#1a1420', { side: THREE.DoubleSide }), [0, 0.3, 0.72], [0.45, 0, 0]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat(['#ffd27a', '#7ff3ff', '#ff9ae8'][i % 3], 2.4), [Math.cos(a) * 0.62, 0.55, Math.sin(a) * 0.62]));
  }
  return g;
}
export function buildCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), std('#4a2a2a'), [0, 0.08, 0], [Math.PI / 2, i * 1.05, 0.2]));
  const flames = new THREE.Group();
  [['#ff5a1a', 0.22, 0.55], ['#ffa02a', 0.15, 0.45], ['#ffe27a', 0.08, 0.32]].forEach(([c, r, h]) => flames.add(mesh(new THREE.ConeGeometry(r, h, 8), glowMat(c, 3, { additive: true }), [0, h / 2 + 0.05, 0])));
  g.add(flames);
  g.userData = { flames };
  return g;
}
export function buildReactor() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.4, 16), std('#c8ccd8', { m: 0.6, r: 0.3 }), [0, 0.2, 0]));
  g.add(mesh(new THREE.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#8ad8ff', transparent: true, opacity: 0.45, roughness: 0.05, clearcoat: 1, emissive: col('#2a7aff'), emissiveIntensity: 0.4 }), [0, 0.4, 0]));
  g.add(mesh(new THREE.TorusKnotGeometry(0.35, 0.08, 64, 8), glowMat('#5ff0ff', 1.8), [0, 0.9, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI), std('#3a8a3a'), [Math.cos(a) * 1.35, 0.35, Math.sin(a) * 1.35], [0, -a, 0]));
  }
  return g;
}
export function buildCore() {
  const g = new THREE.Group();
  const bark = std('#2a2560', { r: 0.8 });
  // massiv vriden stam med rötter
  const trunk = new THREE.CylinderGeometry(0.9, 1.6, 5, 12, 8);
  const pos = trunk.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), a = y * 0.5;
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
  }
  trunk.computeVertexNormals();
  g.add(mesh(trunk, bark, [0, 2.5, 0]));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const pts = [V3(Math.cos(a) * 0.8, 1.0, Math.sin(a) * 0.8), V3(Math.cos(a) * 1.8, 0.4, Math.sin(a) * 1.8), V3(Math.cos(a) * 2.6, 0.05, Math.sin(a) * 2.6)];
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.22, 6), bark));
  }
  const core = mesh(new THREE.SphereGeometry(0.55, 24, 16), glowMat('#8a6aff', 1.2), [0, 2.0, 1.2]);
  g.add(core);
  const canopy = new THREE.Group();
  const leaf = std('#1a6a7a', { r: 0.7, e: '#0a3a4a', ei: 0.4 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    canopy.add(mesh(new THREE.IcosahedronGeometry(1.6 + (i % 3) * 0.3, 1), leaf, [Math.cos(a) * 2, 5.2 + (i % 2) * 0.7, Math.sin(a) * 2]));
  }
  canopy.add(mesh(new THREE.IcosahedronGeometry(2.2, 1), leaf, [0, 6.4, 0]));
  g.add(canopy);
  const lights = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3;
    lights.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), glowMat(i % 3 ? '#7ff3ff' : '#ff9ae8', 2.5), [Math.cos(a) * r, 3.8 + Math.random() * 3.2, Math.sin(a) * r]));
  }
  g.add(lights);
  g.userData = { core, lights };
  return g;
}

export function buildBarricade() {
  const g = new THREE.Group();
  const post = new THREE.MeshPhysicalMaterial({ color: '#e8ecf4', metalness: 0.4, roughness: 0.25, clearcoat: 1 });
  [-0.45, 0.45].forEach((z) => {
    g.add(mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), post, [0, 0.7, z]));
    g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), glowMat('#ff4a8a', 3), [0, 1.45, z]));
  });
  const field = mesh(new THREE.PlaneGeometry(0.9, 1.2), glowMat('#ff4ae0', 1.2, { additive: true, opacity: 0.55, side: THREE.DoubleSide }), [0, 0.7, 0], [0, Math.PI / 2, 0]);
  field.castShadow = false;
  g.add(field);
  g.userData = { field };
  return g;
}

export function buildBridgePosts() {
  const g = new THREE.Group();
  const wood = std('#6a4a3a', { r: 0.8 });
  [-0.4, 0.4].forEach((z) => g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), wood, [0, 0.45, z])));
  g.add(mesh(new THREE.TorusGeometry(0.4, 0.015, 4, 12, Math.PI), std('#e8d8a0'), [0, 0.75, 0], [0, Math.PI / 2, 0]));
  return g;
}

export function buildPickup(kind) {
  if (kind === 'scrap') return mesh(new THREE.TorusGeometry(0.09, 0.04, 6, 8), std('#dfe4ee', { m: 0.8, r: 0.3 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
  if (kind === 'chip') {
    const g = group(mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), std('#1f6a4a', { r: 0.4 })), mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), glowMat('#ffd25e', 2), [0, 0.01, 0]));
    return g;
  }
  return group(mesh(new THREE.SphereGeometry(0.08, 10, 8), std('#e0304a', { r: 0.3, e: '#ff2a4a', ei: 0.4 }), [-0.05, 0, 0]), mesh(new THREE.SphereGeometry(0.07, 10, 8), std('#c8203a', { r: 0.3, e: '#ff2a4a', ei: 0.4 }), [0.06, 0, 0.02]));
}
