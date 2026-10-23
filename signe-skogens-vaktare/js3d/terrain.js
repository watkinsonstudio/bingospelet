// terrain.js – bygger världen i 3D från logikens rutnät: höjdfält med
// vertexfärger (limegröna ljusfläckar mot djupblå skuggor), glödande vatten,
// dimslöjor över outforskad mark och instansierad lummig vegetation.
import * as THREE from 'three';
import { buildKits } from './models.js';

const SV = window.SV;
const RES = 2; // höjdfältspunkter per ruta
const CH = 24; // rutor per chunk (för frustum culling av instanser)

export const sway = { uTime: { value: 0 }, uWind: { value: 0.3 } };
// Genomsiktshål: det som står mellan kameran och Signe får ett ditrat hål.
export const cutout = { uCutP: { value: new THREE.Vector2(0, 0) }, uCutZ: { value: 0 }, uCutR: { value: 0.22 }, uAspect: { value: 1 } };

const TILE_STYLE = {
  // höjd, färg, glöd
  deep: [-0.95, '#071c48', 0],
  shallow: [-0.38, '#14507a', 0],
  cave: [-0.04, '#2e1850', 0.12],
  thicket: [0.08, '#123c38', 0],
  dirt: [-0.02, '#9a7034', 0.08],
  mud: [-0.05, '#3a2244', 0.02],
  floor: [0.03, '#6a6478', 0.02],
  snow: [0.05, '#9a94d6', 0.05],
  moss: [0, '#6e8e1e', 0.05],
  grass: [0, '#5a8a26', 0.04],
  dark: [0, '#226452', 0.03],
};

function tileKey(world, tx, ty) {
  const G = SV.G;
  const g = world.g(tx, ty);
  const sec = ty < 44 ? 'dim' : ty < 86 ? 'jarn' : 'moss';
  switch (g) {
    case G.DEEP:
    case G.SITE:
    case G.BRIDGE:
      return 'deep';
    case G.SHALLOW:
      return 'shallow';
    case G.CAVE:
      return 'cave';
    case G.THICKET:
    case G.HIDDEN:
      return 'thicket';
    case G.DIRT:
      return 'dirt';
    case G.MUD:
      return 'mud';
    case G.FLOOR:
      return 'floor';
    case G.SNOW:
      return 'snow';
    case G.MOSS:
      return sec === 'dim' ? 'snow' : 'moss';
    case G.DARK:
      return sec === 'moss' ? 'grass' : 'dark';
    default:
      return sec === 'jarn' ? 'dark' : 'grass';
  }
}

function patchGlow(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * 2.0;');
  };
}

// Låter träd och gräs vaja i vinden (styrka från tidsstormen) och skär
// ut ett genomsiktshål runt Signe när hon står bakom något.
function patchSway(mat, amount, cut = true) {
  mat.customProgramCacheKey = () => 'sway-' + amount + '-' + cut;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, sway, cutout);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;\nvarying vec4 vCut;\nvarying float vViewZ;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float hgt = max(0.0, position.y - 0.3);
        float ph = uTime * (1.1 + uWind) + ip.x * 0.6 + ip.z * 0.45;
        transformed.x += sin(ph) * hgt * ${amount.toFixed(3)} * (0.4 + uWind);
        transformed.z += cos(ph * 0.8) * hgt * ${(amount * 0.6).toFixed(3)} * (0.4 + uWind);`
      )
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCut = gl_Position;\nvViewZ = -mvPosition.z;');
    if (cut)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec2 uCutP;\nuniform float uCutZ;\nuniform float uCutR;\nuniform float uAspect;\nvarying vec4 vCut;\nvarying float vViewZ;')
        .replace(
          'void main() {',
          `void main() {
          if (vViewZ < uCutZ - 1.2) {
            vec2 sp = vCut.xy / vCut.w - uCutP;
            sp.x *= uAspect;
            float d = length(sp);
            if (d < uCutR) {
              float edge = smoothstep(uCutR, uCutR * 0.55, d);
              float bayer = fract((gl_FragCoord.x * 0.5 + gl_FragCoord.y * 0.25) + mod(gl_FragCoord.y, 2.0) * 0.5);
              if (bayer < edge * 0.85 + 0.1) discard;
            }
          }`
        );
  };
}

export class Terrain {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.kits = buildKits();
    this.litMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    patchSway(this.litMat, 0.0);
    this.swayMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    patchSway(this.swayMat, 0.06);
    this.grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    patchSway(this.grassMat, 0.25, false);
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7) });
    patchSway(this.glowMat, 0.0);
    this.glowSway = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7) });
    patchSway(this.glowSway, 0.06);
    this.buildGround();
    this.buildWater();
    this.buildMist();
    this.buildProps();
    this.buildBridges();
  }

  heightAt(x, z) {
    // x, z i rutor (världsenheter)
    const w = this.world;
    let h = 0, n = 0;
    for (let oy = -0.5; oy <= 0.5; oy += 0.5)
      for (let ox = -0.5; ox <= 0.5; ox += 0.5) {
        h += TILE_STYLE[tileKey(w, Math.floor(x + ox), Math.floor(z + oy))][0];
        n++;
      }
    h /= n;
    if (h > -0.2) h += (SV.noise(x * 0.35, z * 0.35, 4) - 0.5) * 0.14;
    return h;
  }

  buildGround() {
    const w = this.world;
    const nx = w.W * RES + 1, nz = w.H * RES + 1;
    const pos = new Float32Array(nx * nz * 3), cols = new Float32Array(nx * nz * 3), glow = new Float32Array(nx * nz);
    const tmp = new THREE.Color(), acc = new THREE.Color(), shadow = new THREE.Color('#10245e'), magenta = new THREE.Color('#d03ab8');
    const styleCol = {};
    Object.entries(TILE_STYLE).forEach(([k, v]) => (styleCol[k] = new THREE.Color(v[1])));
    const crystals = w.crystals;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = i / RES, z = j / RES;
        const idx = j * nx + i;
        acc.setRGB(0, 0, 0);
        let g = 0, n = 0;
        for (let oy = -0.5; oy <= 0.5; oy += 0.5)
          for (let ox = -0.5; ox <= 0.5; ox += 0.5) {
            const k = tileKey(w, Math.floor(x + ox), Math.floor(z + oy));
            acc.add(styleCol[k]);
            g += TILE_STYLE[k][2];
            n++;
          }
        acc.multiplyScalar(1 / n);
        g /= n;
        // ljusfläckar och djupblå skuggor
        const pool = SV.fbm(x * 0.07, z * 0.07, 11);
        const dark = 1 - THREE.MathUtils.smoothstep(pool, 0.32, 0.62);
        tmp.copy(acc).lerp(shadow, dark * 0.55);
        const detail = 0.88 + SV.noise(x * 1.7, z * 1.7, 3) * 0.24;
        tmp.multiplyScalar(detail);
        // magentaglöd nära kristaller i grottorna
        let mag = 0;
        for (const c of crystals) {
          const d = Math.hypot(c.tx + 0.5 - x, c.ty + 0.5 - z);
          if (d < 4.5) mag = Math.max(mag, 1 - d / 4.5);
        }
        if (mag > 0 && w.g(Math.floor(x), Math.floor(z)) === SV.G.CAVE) {
          tmp.lerp(magenta, mag * 0.6);
          g += mag * 0.35;
        }
        g += (1 - dark) * 0.04;
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = this.heightAt(x, z);
        pos[idx * 3 + 2] = z;
        cols[idx * 3] = tmp.r;
        cols[idx * 3 + 1] = tmp.g;
        cols[idx * 3 + 2] = tmp.b;
        glow[idx] = g;
      }
    const index = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    patchGlow(mat);
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.root.add(ground);
    this.ground = ground;
    // en stor mörk platta utanför kartan
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#0a1430', roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(w.W / 2, -0.3, w.H / 2);
    this.root.add(outer);
  }

  buildWater() {
    const w = this.world;
    const verts = [];
    for (let y = 0; y < w.H; y++)
      for (let x = 0; x < w.W; x++) {
        if (!(w.isWaterG(w.g(x, y)) || w.g(x, y) === SV.G.BRIDGE)) continue;
        const e = 0.5;
        const x0 = x - e + 0.5, x1 = x + e + 0.5, z0 = y - e + 0.5, z1 = y + e + 0.5;
        verts.push(x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    this.waterU = { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#0a2a7a') }, uLight: { value: new THREE.Color('#2ad8ff') } };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: this.waterU,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        void main(){
          vec2 p = vW.xz;
          float r = sin(p.x * 2.1 + uTime * 1.3) * sin(p.y * 1.7 - uTime * 1.1) + sin((p.x + p.y) * 3.3 + uTime * 2.0) * 0.5;
          vec3 c = mix(uDeep, uLight, smoothstep(0.2, 1.4, r) * 0.55 + 0.12);
          vec2 g = floor(p * 6.0);
          float glint = step(0.985, h(g + floor(uTime * 2.0))) * 2.5;
          c += vec3(0.6, 0.95, 1.0) * glint;
          gl_FragColor = vec4(c * 1.3, 0.78);
        }`,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = -0.16;
    water.renderOrder = 2;
    this.root.add(water);
  }

  // Dimslöjor över outforskad mark (krigsdimman).
  buildMist() {
    const w = this.world;
    this.fogData = new Uint8Array(w.W * w.H * 4);
    this.fogTex = new THREE.DataTexture(this.fogData, w.W, w.H, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.minFilter = THREE.LinearFilter;
    this.updateFog();
    this.mistU = { uTime: { value: 0 }, uFog: { value: this.fogTex }, uCol: { value: new THREE.Color('#1a2a6a') }, uSize: { value: new THREE.Vector2(w.W, w.H) } };
    const mk = (y, k) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { ...this.mistU, uK: { value: k } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
          uniform float uTime; uniform sampler2D uFog; uniform vec3 uCol; uniform vec2 uSize; uniform float uK; varying vec3 vW;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){
            vec2 uv = vW.xz / uSize;
            float rev = texture2D(uFog, uv).r;
            float m = n(vW.xz * 0.35 + vec2(uTime * 0.05, uTime * 0.03)) * 0.6 + n(vW.xz * 0.9 - uTime * 0.07) * 0.4;
            float a = (1.0 - smoothstep(0.15, 0.85, rev)) * (0.55 + m * 0.45) * uK;
            vec3 c = uCol * (0.8 + m * 0.6) + vec3(0.25, 0.35, 0.7) * m * 0.25;
            gl_FragColor = vec4(c, a);
          }`,
      });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w.W + 40, w.H + 40), mat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(w.W / 2, y, w.H / 2);
      p.renderOrder = 5;
      this.root.add(p);
    };
    mk(0.9, 0.55);
    mk(2.2, 0.42);
    mk(3.6, 0.32);
  }
  updateFog() {
    const w = this.world;
    for (let i = 0; i < w.W * w.H; i++) {
      const v = w.revealed[i] ? 255 : 0;
      this.fogData[i * 4] = v;
      this.fogData[i * 4 + 3] = 255;
    }
    this.fogTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------
  // Instansierade objekt, uppdelade i chunks
  // ------------------------------------------------------------------
  buildProps() {
    if (this.propRoot) {
      this.root.remove(this.propRoot);
      this.propRoot.traverse((o) => o.isInstancedMesh && o.dispose());
    }
    this.propRoot = new THREE.Group();
    this.root.add(this.propRoot);
    const w = this.world, B = SV.B, G = SV.G, D = { FLOWER_W: 1, FLOWER_Y: 2, FLOWER_B: 3, MUSHROOM: 4, TUFT: 5, PEBBLE: 6, BERRY: 7, BOLT: 8, LICHEN: 9 };
    const buckets = new Map();
    const add = (kit, v, x, y, z, rot, s, opts = {}) => {
      const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
      const key = cx + ',' + cz + '|' + kit + '|' + v + '|' + (opts.mat || '');
      if (!buckets.has(key)) buckets.set(key, { kit, v, mat: opts.mat, list: [], shadow: opts.shadow });
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s, s));
      buckets.get(key).list.push(m);
    };
    const coreP = new Set(w.core.pylons.map(([x, y]) => x + ',' + y));
    for (let ty = 0; ty < w.H; ty++)
      for (let tx = 0; tx < w.W; tx++) {
        const i = ty * w.W + tx;
        const bt = w.block[i], gt = w.ground[i];
        const h = SV.hash(tx, ty, 77), h2 = SV.hash(tx, ty, 78);
        const x = tx + 0.5 + (h - 0.5) * 0.3, z = ty + 0.5 + (h2 - 0.5) * 0.3;
        const y = this.heightAt(tx + 0.5, ty + 0.5);
        const rot = h * Math.PI * 2;
        const sec = ty < 44 ? 'dim' : ty < 86 ? 'jarn' : 'moss';
        switch (bt) {
          case B.PINE:
          case B.SPRUCE_DARK:
            if (sec === 'moss' && h2 < 0.3) add('mushroom', Math.floor(h * 3), x, y, z, rot, 0.9 + h2 * 0.8, { shadow: true });
            else add('treeBlue', Math.floor(h * 3), x, y, z, rot, 0.85 + h2 * 0.35, { mat: 'sway', shadow: true });
            break;
          case B.PINE_SNOW:
          case B.SPRUCE:
            add('treeFrost', Math.floor(h * 2), x, y, z, rot, 0.8 + h2 * 0.4, { mat: 'sway', shadow: true });
            break;
          case B.BIRCH:
            add('treeBirch', Math.floor(h * 2), x, y, z, rot, 0.85 + h2 * 0.3, { mat: 'sway', shadow: true });
            break;
          case B.ROCK:
          case B.ROCK_MOSS:
            add('rock', Math.floor(h * 3), x, y, z, rot, 0.9 + h2 * 0.5, { shadow: true });
            break;
          case B.CAVEWALL:
            add('caveWall', Math.floor(h * 3), tx + 0.5, y, ty + 0.5, rot, 0.95 + h2 * 0.3, { shadow: true });
            if (h2 < 0.25) add('mushroom', Math.floor(h * 3), tx + 0.5 + (h - 0.5) * 0.6, y, ty + 0.5 + (h2 - 0.5), rot, 0.55, { shadow: false });
            break;
          case B.RUIN:
            add('ruin', Math.floor(h * 2), tx + 0.5, y, ty + 0.5, Math.floor(h * 4) * (Math.PI / 2), 1, { shadow: true });
            break;
          case B.LOG:
            add('log', 0, tx + 0.5, y, ty + 0.5, Math.PI / 2 + (h - 0.5) * 0.3, 1, { shadow: true });
            break;
          case B.SCRAPHEAP:
            add('scrap', Math.floor(h * 2), x, y, z, rot, 1, {});
            break;
          case B.PYLON:
            if (!coreP.has(tx + ',' + ty)) add('pylon', 0, tx + 0.5, y, ty + 0.5, rot, 1, { shadow: true });
            break;
        }
        if (bt !== B.NONE) continue;
        if (gt === G.THICKET || gt === G.HIDDEN) {
          add('bush', Math.floor(h * 2), x, y, z, rot, 1.1 + h2 * 0.3, { mat: 'grass' });
          continue;
        }
        if (w.isWaterG(gt) || gt === G.BRIDGE || gt === G.FLOOR) continue;
        // markdetaljer från logikens dekorlager
        const d = w.deco[i];
        const fx = tx + 0.2 + h2 * 0.6, fz = ty + 0.2 + h * 0.6;
        if (d === D.FLOWER_W || d === D.FLOWER_B) add('flower', 0, fx, y, fz, rot, 1);
        else if (d === D.FLOWER_Y) add('flower', 2, fx, y, fz, rot, 1);
        else if (d === D.BERRY) add('flower', 1, fx, y, fz, rot, 1);
        else if (d === D.MUSHROOM) add('smallShroom', 0, fx, y, fz, rot, 1 + h2);
        else if (d === D.PEBBLE) add('pebble', 0, fx, y, fz, rot, 1 + h2);
        else if (d === D.BOLT) add('bolt', 0, fx, y, fz, rot, 1);
        else if (d === D.LICHEN) add('fungiRing', 0, fx, y + 0.01, fz, rot, 0.7);
        // extra lummighet
        if (gt === G.DIRT) {
          if (h < 0.05) add('fungiRing', 0, tx + h2, y + 0.01, ty + 0.5, rot, 0.6 + h * 6);
          continue;
        }
        const lush = sec === 'moss' ? 0.55 : sec === 'jarn' ? 0.4 : 0.3;
        if (h < lush) add('grass', Math.floor(h2 * 2), tx + 0.5 + (h2 - 0.5) * 0.7, y, ty + 0.5 + (h - 0.5) * 0.7, rot, 0.8 + h * 0.8, { mat: 'grass' });
        if (h2 < 0.12 && gt !== G.CAVE) add('fern', 0, tx + 0.3 + h * 0.4, y, ty + 0.3 + h2 * 3, rot, 0.9 + h, { mat: 'grass' });
        if (gt === G.CAVE && h2 < 0.25) add('flower', Math.floor(h * 3), fx, y, fz, rot, 1.2);
        if (gt === G.CAVE && h < 0.06) add('fungiRing', 0, fx, y + 0.01, fz, rot, 0.8);
      }
    buckets.forEach((b) => {
      const kit = this.kits[b.kit][b.v] || this.kits[b.kit][0];
      const make = (geo, mat, shadow) => {
        if (!geo) return;
        const im = new THREE.InstancedMesh(geo, mat, b.list.length);
        b.list.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = !!shadow;
        im.receiveShadow = true;
        this.propRoot.add(im);
      };
      const lit = b.mat === 'sway' ? this.swayMat : b.mat === 'grass' ? this.grassMat : this.litMat;
      make(kit.lit, lit, b.shadow);
      make(kit.glow, b.mat === 'sway' ? this.glowSway : this.glowMat, false);
    });
  }

  buildBridges() {
    if (this.bridgeMesh) this.root.remove(this.bridgeMesh);
    const w = this.world;
    const list = [];
    for (let y = 0; y < w.H; y++)
      for (let x = 0; x < w.W; x++) {
        if (w.g(x, y) !== SV.G.BRIDGE) continue;
        const vertical = w.g(x, y - 1) === SV.G.BRIDGE || w.g(x, y + 1) === SV.G.BRIDGE || w.isWaterG(w.g(x - 1, y));
        list.push(new THREE.Matrix4().compose(new THREE.Vector3(x + 0.5, -0.02, y + 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), vertical ? 0 : Math.PI / 2), new THREE.Vector3(1, 1, 1)));
      }
    const kit = this.kits.plank[0];
    const im = new THREE.InstancedMesh(kit.lit, this.litMat, Math.max(1, list.length));
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = list.length;
    im.receiveShadow = true;
    im.castShadow = true;
    this.bridgeMesh = im;
    this.root.add(im);
  }

  onChange(what) {
    if (what === 'bridge') this.buildBridges();
    else this.buildProps();
  }

  update(time, wind) {
    sway.uTime.value = time;
    sway.uWind.value = wind;
    this.waterU.uTime.value = time;
    this.mistU.uTime.value = time;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
