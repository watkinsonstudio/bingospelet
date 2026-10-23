// view.js – 3D-vyn (Three.js). Läser spellogikens tillstånd varje bildruta
// och ritar den lummiga, lysande skogen: isometrisk kamera, månljus med
// skuggor, punktljus från kristaller och eld, bloom och färggradering
// som styrs av tidsstormen.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { Terrain, cutout } from './terrain.js';
import * as M from './models.js';
import { Fx } from './fx.js';
import { furLights, setFurLayers } from './fur.js';

const SV = window.SV;
const T = 16;
const PITCH = 0.92; // kamerans lutning (radianer över horisonten)
const CHAR = 1.35; // figurerna lite större än verkligheten för läsbarhet
const LEVEL_SCALE = [0.8 * CHAR, 1.0 * CHAR, 1.28 * CHAR];
const ROBOT_SCALE = 1.15;

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTint: { value: new THREE.Color('#ffffff') },
    uTintAmt: { value: 0 },
    uVig: { value: 0.35 },
    uVigCol: { value: new THREE.Color('#060a24') },
    uFlash: { value: 0 },
    uSat: { value: 1.12 },
    uLow: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uTintAmt; uniform float uVig; uniform vec3 uVigCol; uniform float uFlash; uniform float uSat; uniform float uLow;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = mix(c.rgb, c.rgb * uTint * 1.4, uTintAmt);
      float d = distance(vUv, vec2(0.5));
      float v = smoothstep(0.32, 0.85, d) * uVig;
      c.rgb = mix(c.rgb, uVigCol, v);
      c.rgb = mix(c.rgb, vec3(1.0, 0.25, 0.3) * l + c.rgb * 0.7, uLow * smoothstep(0.35, 0.8, d));
      c.rgb += vec3(0.75, 0.82, 1.0) * uFlash;
      gl_FragColor = c;
    }`,
};

const v3 = new THREE.Vector3();

export const View = {
  ready: false,
  zoom: 21,
  zoomTarget: 21,

  init(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    this.quality = this.pickQuality(r);
    const low = this.quality === 'low';
    setFurLayers(low ? 9 : 14);
    r.setPixelRatio(low ? Math.min(window.devicePixelRatio || 1, 1) * 0.75 : Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = !low;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#14205a', 0.022);
    this.scene.background = new THREE.Color('#0c1440');
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 90);
    this.target = new THREE.Vector3();
    this.buildEnvMap();

    this.hemi = new THREE.HemisphereLight('#9ad0ff', '#2a3a10', 0.9);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight('#c8e8ff', 1.5);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const sc = this.moon.shadow.camera;
    sc.left = sc.bottom = -20;
    sc.right = sc.top = 20;
    sc.near = 1;
    sc.far = 70;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.03;
    this.scene.add(this.moon, this.moon.target);
    this.lights = Array.from({ length: 7 }, () => {
      const l = new THREE.PointLight('#ffffff', 0, 10, 1.6);
      this.scene.add(l);
      return l;
    });

    const size = new THREE.Vector2();
    r.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.75, 0.5, 1.05);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.overlay = document.getElementById('overlay');
    this.ov = { floaters: new Map(), pool: [] };
    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), M.glowMat('#bff8ff', 1.6, { additive: true, side: THREE.DoubleSide }));
    this.reticle.rotation.x = -Math.PI / 2;
    this.scene.add(this.reticle);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.onNewState(game);
    this.ready = true;
  },

  // Grafikkvalitet: sparat val, annars låg på mjukvarurendering.
  pickQuality(r) {
    const saved = SV.store.get('sv-quality');
    if (saved === 'low' || saved === 'high') return saved;
    if (/[?&]low\b/.test(location.search)) return 'low';
    try {
      const gl = r.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      if (/swiftshader|llvmpipe|software/i.test(name)) return 'low';
    } catch (e) {
      /* okänt kort – kör hög */
    }
    return 'high';
  },

  // Enkel miljökarta så att blanka robotar speglar skogens färger.
  buildEnvMap() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const s = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.25,0.45,1.0); vec3 mid = vec3(0.35,0.9,1.0); vec3 low = vec3(0.45,0.7,0.12); vec3 c = h > 0.0 ? mix(mid, top, h) : mix(mid, low, -h*2.0); c += vec3(1.0,0.3,0.9) * smoothstep(0.85, 1.0, dot(normalize(vP), normalize(vec3(1.0,0.2,0.3)))) * 1.5; gl_FragColor = vec4(c, 1.0); }',
      })
    );
    s.add(sky);
    this.scene.environment = pm.fromScene(s, 0.04).texture;
    pm.dispose();
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    if (this.fx) this.fx.uScale.value = h * this.renderer.getPixelRatio() * 0.9;
    this.viewH = h;
    this.viewW = w;
  },

  // ---------------------------------------------------------------
  // Ny värld (nytt spel / laddad sparning)
  // ---------------------------------------------------------------
  onNewState(game) {
    this.game = game;
    if (this.worldRoot) {
      this.scene.remove(this.worldRoot);
      this.terrain.dispose();
    }
    if (!this.fx) {
      this.fx = new Fx(this.scene);
      this.fx.uScale.value = this.viewH * this.renderer.getPixelRatio() * 0.9;
    } else this.fx.clear();
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    const w = game.world;
    this.terrain = new Terrain(this.scene, w);
    w.onChange = (what, x, y) => {
      this.terrain.onChange(what);
      if (what === 'block:' + SV.B.BARRICADE) {
        const b = this.barricades.get(x + ',' + y);
        if (b) b.visible = false;
      }
    };
    game.env.on('lightning', (x, y) => this.fx.lightning(x / T, y / T));
    const H = (x, z) => this.terrain.heightAt(x, z);
    const place = (obj, tx, tz) => {
      obj.position.set(tx, H(tx, tz), tz);
      this.worldRoot.add(obj);
      return obj;
    };
    this.crystals = new Map();
    w.crystals.forEach((c) => this.crystals.set(c, place(M.buildCrystal(), c.x / T, c.y / T)));
    this.chests = new Map();
    w.chests.forEach((k) => {
      const m = place(M.buildChest(k.open), k.x / T, k.y / T);
      m.rotation.y = Math.random() * 6;
      this.chests.set(k, m);
    });
    this.runes = new Map();
    w.runestones.forEach((r) => {
      const m = place(M.buildRunestone(), r.tx + 0.5, r.ty + 0.5);
      m.rotation.y = Math.PI / 4 + 0.3;
      this.runes.set(r, m);
    });
    w.big.forEach((o) => {
      const cx = o.x + o.w / 2, cz = o.y + o.h / 2;
      let m;
      if (o.kind === 'forge') m = M.buildForge();
      else if (o.kind === 'tent') m = M.buildTent();
      else if (o.kind === 'reactor') m = M.buildReactor();
      else {
        m = M.buildCore();
        this.core = m;
      }
      place(m, cx, cz);
      if (o.kind !== 'core') m.rotation.y = Math.PI / 4;
    });
    this.corePylons = w.core.pylons.map(([x, y]) => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.6, 8), M.std('#d8dce8', { m: 0.6, r: 0.25 }));
      post.position.y = 1.3;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), M.glowMat('#4a4a6a', 1));
      orb.position.y = 2.75;
      g.add(post, orb);
      g.userData.orb = orb;
      return place(g, x + 0.5, y + 0.5);
    });
    this.campfire = place(M.buildCampfire(), w.campfire.x / T, w.campfire.y / T);
    this.barricades = new Map();
    for (let y = 0; y < w.H; y++)
      for (let x = 0; x < w.W; x++)
        if (w.b(x, y) === SV.B.BARRICADE) this.barricades.set(x + ',' + y, place(M.buildBarricade(), x + 0.5, y + 0.5));
    this.posts = new Map();
    Object.values(w.bridgeSites).forEach((s) => {
      const m = place(M.buildBridgePosts(), s.post[0] + 0.5, s.post[1] + 0.5);
      m.rotation.y = s.dir === 'h' ? 0 : Math.PI / 2;
      this.posts.set(s, m);
    });
    this.waiting = new Map();
    w.animals.forEach((a) => {
      const m = place(M.buildCompanion(a.kind), a.x / T, a.y / T);
      m.scale.setScalar(LEVEL_SCALE[0]);
      m.rotation.y = Math.PI / 4;
      this.waiting.set(a, m);
    });
    this.signe = M.buildSigne(game.player.armor);
    this.signe.scale.setScalar(CHAR);
    this.worldRoot.add(this.signe);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), M.glowMat('#ffd25e', 0.6, { additive: true, opacity: 0.35 }));
    this.shield.position.y = 0.6;
    this.signe.add(this.shield);
    this.comps = new Map();
    this.robots = new Map();
    this.pickups = new Map();
    this.decoy = null;
    this.snapCamera();
  },

  onArmorChanged(armor) {
    if (this.signe) M.ArmorColorShader.apply(this.signe, armor);
    if (this.previewSigne) M.ArmorColorShader.apply(this.previewSigne, armor);
  },

  snapCamera() {
    const p = this.game.player;
    this.target.set(p.x / T, 0.6, p.y / T);
  },

  heightAt(x, z) {
    return this.terrain.heightAt(x, z);
  },

  // ---------------------------------------------------------------
  // Bildruta
  // ---------------------------------------------------------------
  render(game, dt) {
    if (!this.ready) return;
    const env = game.env, p = game.player, In = SV.Input;
    const s = env.visual;
    const time = env.time;
    const inGrotto = game.inGrotto;
    this.grottoK = THREE.MathUtils.lerp(this.grottoK || 0, inGrotto ? 1 : 0, Math.min(1, dt * 2.5));
    const gk = this.grottoK;

    // --- ljus och atmosfär från tidsstormen
    const sky = new THREE.Color().setRGB(env.sky[0] / 255, env.sky[1] / 255, env.sky[2] / 255, THREE.SRGBColorSpace);
    const fogC = sky.clone().multiplyScalar(0.42).lerp(new THREE.Color('#2a0a3a'), gk * 0.6);
    this.scene.fog.color.copy(fogC);
    this.scene.fog.density = 0.018 + s * 0.016 + gk * 0.01;
    this.scene.background.copy(fogC);
    const lc = new THREE.Color().setRGB(env.light.color[0] / 255, env.light.color[1] / 255, env.light.color[2] / 255, THREE.SRGBColorSpace);
    this.hemi.color.copy(sky).lerp(new THREE.Color('#bfe0ff'), 0.45);
    this.hemi.intensity = (1.05 * env.light.energy) * (1 - gk * 0.45);
    this.moon.color.copy(lc);
    this.moon.intensity = (1.7 * env.light.energy + env.flash * 4) * (1 - gk * 0.5);
    this.renderer.toneMappingExposure = 1.05 + env.flash * 0.6;
    furLights.uLightCol.value.copy(lc);
    furLights.uSky.value.copy(this.hemi.color);
    furLights.uTime.value = time;
    furLights.uWind.value = env.wind * 0.6;
    furLights.uRim.value.set(gk > 0.5 ? '#ff7ae8' : '#5ff0ff');

    // --- kamera
    if (In.zoom) this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget + In.zoom * 1.6, 12, 34);
    const zt = inGrotto ? Math.min(this.zoomTarget, 15) : this.zoomTarget;
    this.zoom = THREE.MathUtils.lerp(this.zoom, zt, Math.min(1, dt * 3));
    const yaw = game.started ? game.camYaw : game.camYaw + time * 0.04;
    const ptx = p.x / T, ptz = p.y / T;
    const lead = p.aimed ? 1.2 : 0.6;
    const tx = ptx + Math.cos(p.face) * lead, tz = ptz + Math.sin(p.face) * lead;
    this.target.x = THREE.MathUtils.lerp(this.target.x, tx, Math.min(1, dt * 5));
    this.target.z = THREE.MathUtils.lerp(this.target.z, tz, Math.min(1, dt * 5));
    this.target.y = THREE.MathUtils.lerp(this.target.y, this.heightAt(ptx, ptz) + 0.6, Math.min(1, dt * 5));
    const d = this.zoom;
    const sh = game.shakeAmt * 0.025;
    this.camera.position.set(this.target.x + Math.sin(yaw) * Math.cos(PITCH) * d + (Math.random() - 0.5) * sh, this.target.y + Math.sin(PITCH) * d + (Math.random() - 0.5) * sh, this.target.z + Math.cos(yaw) * Math.cos(PITCH) * d);
    this.camera.lookAt(this.target);
    this.moon.position.set(this.target.x - 10, 22, this.target.z + 6);
    this.moon.target.position.copy(this.target);
    furLights.uLightDir.value.copy(this.moon.position).sub(this.target).normalize();

    // --- siktet med musen
    if (In.mouse.inside) {
      const ndc = new THREE.Vector2((In.mouse.x / this.viewW) * 2 - 1, -(In.mouse.y / this.viewH) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.aimPlane, hit)) {
        In.aim.x = hit.x * T;
        In.aim.y = hit.z * T;
        this.reticle.position.set(hit.x, this.heightAt(hit.x, hit.z) + 0.05, hit.z);
      }
    }
    this.reticle.visible = game.started && !game.paused && In.aim.mode === 'mouse';

    // --- Signe
    const sg = this.signe;
    sg.visible = !game.playerDown && !(p.invuln > 0 && Math.floor(time * 14) % 2 === 0);
    sg.position.set(ptx, this.heightAt(ptx, ptz), ptz);
    const want = Math.PI / 2 - p.face;
    sg.rotation.y += angleLerp(sg.rotation.y, want, Math.min(1, dt * 14));
    const charge = In.down('staff') && In.holdTime('staff') > 0.3 && p.empCd <= 0 ? In.holdTime('staff') : 0;
    M.animateSigne(sg, { dt, moving: p.moving, speedK: Math.min(1.3, Math.hypot(In.move.x, In.move.y) + 0.3), shot: p.shot || 0, swing: p.swing, charge });
    this.shield.visible = p.shield > 0;
    this.shield.material.opacity = 0.25 + Math.sin(time * 6) * 0.08;
    if (charge > 0.6 && Math.random() < 0.5) this.fx.emit(ptx + (Math.random() - 0.5), 0.7 + Math.random() * 0.6, ptz + (Math.random() - 0.5), { color: '#9ff8ff', life: 0.3, size: 0.1, k: 3 });

    // --- djur
    const cm = game.companions;
    cm.unlocked.forEach((k) => {
      const c = cm.roster[k];
      let m = this.comps.get(k);
      if (!m) {
        m = M.buildCompanion(k);
        this.worldRoot.add(m);
        this.comps.set(k, m);
        m.userData.prev = [c.x, c.y];
      }
      const cx = c.x / T, cz = c.y / T;
      const [px, py] = m.userData.prev;
      const mv = Math.hypot(c.x - px, c.y - py);
      if (mv > 0.05) m.userData.yaw = Math.PI / 2 - Math.atan2(c.y - py, c.x - px);
      else if (k === cm.activeKind && !c.moving) m.userData.yaw = Math.PI / 2 - Math.atan2(p.y - c.y, p.x - c.x);
      m.userData.prev = [c.x, c.y];
      m.position.set(cx, this.heightAt(cx, cz), cz);
      if (m.userData.yaw !== undefined) m.rotation.y += angleLerp(m.rotation.y, m.userData.yaw, Math.min(1, dt * 10));
      const sc = LEVEL_SCALE[c.current_level - 1];
      m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x || sc, sc, Math.min(1, dt * 3)));
      M.animateCompanion(m, { dt, moving: c.moving || mv > 0.3, z: c.z / T, level: c.current_level, flying: k === 'owl' && k === cm.activeKind });
      if (c.current_level === 3 && Math.random() < dt * 8) this.fx.emit(cx + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.8, cz + (Math.random() - 0.5) * 0.8, { color: '#ffe27a', life: 1.2, size: 0.09, k: 3, v: [0, 0.4, 0] });
    });
    this.waiting.forEach((m, a) => {
      m.visible = !a.met;
      if (!a.met) M.animateCompanion(m, { dt, moving: false, z: a.kind === 'owl' ? 0 : 0, level: 1 });
    });

    // --- robotar
    const live = new Set();
    game.robots.forEach((r) => {
      live.add(r);
      let m = this.robots.get(r);
      if (!m) {
        m = M.buildRobot(r.type);
        m.scale.setScalar(ROBOT_SCALE);
        this.worldRoot.add(m);
        this.robots.set(r, m);
        m.userData.prev = [r.x, r.y];
        m.userData.yaw = Math.random() * 6;
      }
      const rx = r.x / T, rz = r.y / T;
      const [px, py] = m.userData.prev;
      const mv = Math.hypot(r.x - px, r.y - py);
      if (r.type === 'drone') {
        if (r.state !== 'patrol') m.userData.yaw = Math.PI / 2 - Math.atan2(p.y - r.y, p.x - r.x);
        else if (mv > 0.05) m.userData.yaw = Math.PI / 2 - Math.atan2(r.y - py, r.x - px);
      } else if (r.state === 'windup' || r.state === 'attack') m.userData.yaw = Math.PI / 2 - (r.atkA ?? 0);
      else if (mv > 0.05) m.userData.yaw = Math.PI / 2 - Math.atan2(r.y - py, r.x - px);
      m.userData.prev = [r.x, r.y];
      m.position.set(rx, this.heightAt(rx, rz), rz);
      if (r.active) m.rotation.y += angleLerp(m.rotation.y, m.userData.yaw, Math.min(1, dt * 8));
      M.animateRobot(m, {
        dt,
        moving: mv > 0.05,
        alert: r.state !== 'patrol' && r.state !== 'flee',
        windup: r.state === 'windup',
        frozen: r.frozen > 0,
        stunned: r.stun > 0,
        flash: r.flash > 0,
        disabled: !r.active,
        blind: r.blind > 0,
        fade: r.active ? 0 : Math.max(0, r.fade - 2.5) / 1.5,
        beam: r.active && r.blind <= 0 && r.stun <= 0 && r.frozen <= 0,
        searchRel: -(Math.PI / 2 - r.searchA) + m.rotation.y,
      });
    });
    this.robots.forEach((m, r) => {
      if (!live.has(r)) {
        this.worldRoot.remove(m);
        this.robots.delete(r);
      }
    });

    // --- upplockbart
    const pk = new Set();
    game.pickups.forEach((k) => {
      pk.add(k);
      let m = this.pickups.get(k);
      if (!m) {
        m = M.buildPickup(k.kind);
        this.worldRoot.add(m);
        this.pickups.set(k, m);
      }
      const x = k.x / T, z = k.y / T;
      m.position.set(x, this.heightAt(x, z) + 0.2 + k.z / T + Math.sin(time * 4 + k.x) * 0.04, z);
      m.rotation.y = time * 2 + k.x;
    });
    this.pickups.forEach((m, k) => {
      if (!pk.has(k)) {
        this.worldRoot.remove(m);
        this.pickups.delete(k);
      }
    });

    // --- skenbild (Räven)
    if (game.decoy) {
      if (!this.decoy) {
        this.decoy = M.buildSigne(p.armor);
        const holo = M.glowMat('#ff9a4a', 0.9, { additive: true, opacity: 0.5 });
        this.decoy.traverse((o) => o.isMesh && (o.material = holo));
        this.worldRoot.add(this.decoy);
      }
      this.decoy.visible = true;
      this.decoy.position.set(game.decoy.x / T, this.heightAt(game.decoy.x / T, game.decoy.y / T), game.decoy.y / T);
      this.decoy.rotation.y = time * 2;
    } else if (this.decoy) this.decoy.visible = false;

    // --- föremål i världen
    this.crystals.forEach((m, c) => {
      m.visible = !c.taken && !c.buried;
      if (!m.visible) return;
      m.rotation.y = time * 0.6;
      m.children.forEach((ch, i) => ch.isSprite || (ch.position.y += Math.sin(time * 2 + i) * 0.0008));
      m.userData.halo.material.opacity = 0.7 + Math.sin(time * 3 + c.x) * 0.25;
    });
    this.chests.forEach((m, k) => M.setChestOpen(m, k.open));
    this.runes.forEach((m, r) => m.userData.runes.color.set(r.read ? '#7ffff0' : '#3ab8b0').multiplyScalar(r.read ? 2.6 + Math.sin(time * 3) * 0.5 : 1.1));
    this.posts.forEach((m, s) => (m.visible = !s.built));
    this.barricades.forEach((m) => {
      if (!m.visible) return;
      m.userData.field.material.opacity = 0.4 + Math.sin(time * 12) * 0.15;
    });
    const lit = game.won;
    this.corePylons.forEach((g, i) => g.userData.orb.material.color.set(lit ? '#7ff3ff' : '#3a3a5a').multiplyScalar(lit ? 3 + Math.sin(time * 3 + i) : 1));
    if (this.core) {
      this.core.userData.core.material.color.set(lit ? '#bff8ff' : '#8a6aff').multiplyScalar(lit ? 3.5 : 1.2 + Math.sin(time * 1.5) * 0.3);
      this.core.userData.lights.rotation.y = time * 0.05;
    }
    const fl = this.campfire.userData.flames;
    fl.scale.set(1 + Math.sin(time * 13) * 0.08, 1 + Math.sin(time * 17) * 0.15, 1 + Math.cos(time * 11) * 0.08);
    if (Math.random() < dt * 10) this.fx.emit(this.campfire.position.x, 0.6, this.campfire.position.z, { color: '#ffb04a', life: 1, size: 0.08, k: 3, v: [(Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3] });
    // lodjurets dolda stig lyser upp
    if (game.companions.hiddenPathsOpen() && Math.random() < dt * 30) {
      const tx = Math.floor(ptx + (Math.random() - 0.5) * 16), tz = Math.floor(ptz + (Math.random() - 0.5) * 16);
      if (game.world.g(tx, tz) === SV.G.HIDDEN) this.fx.emit(tx + Math.random(), 0.3, tz + Math.random(), { color: '#d8ff8a', life: 1.4, size: 0.16, k: 3, v: [0, 0.4, 0] });
    }

    // genomsiktshålet följer Signes huvud på skärmen
    v3.set(ptx, sg.position.y + 1.1, ptz);
    const vz = v3.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    v3.project(this.camera);
    cutout.uCutP.value.set(v3.x, v3.y);
    cutout.uCutZ.value = -vz;
    cutout.uAspect.value = this.viewW / this.viewH;
    cutout.uCutR.value = game.started && !game.playerDown ? 0.2 * (21 / this.zoom) : 0;

    this.assignLights(game, time);
    this.fx.update(dt, game, this);
    this.terrain.update(time, env.wind);
    if (game.fogDirty) {
      game.fogDirty = false;
      this.terrain.updateFog();
    }
    this.terrain.mistU.uCol.value.copy(fogC).multiplyScalar(1.4);

    // --- färggradering
    const gu = this.grade.uniforms;
    gu.uTint.value.set('#b48aff').lerp(new THREE.Color('#ff7ae8'), gk);
    gu.uTintAmt.value = s * 0.24 + gk * 0.1;
    gu.uVig.value = 0.35 + s * 0.3 + gk * 0.25;
    gu.uFlash.value = env.flash * 0.35 + game.screenFlash * 0.8;
    gu.uLow.value = p.energy <= 2 && game.started && !game.paused ? 0.35 + Math.sin(time * 5) * 0.15 : 0;
    this.bloom.strength = 0.7 + gk * 0.15 + s * 0.12;

    this.composer.render(dt);
    this.updateOverlay(game, time);
  },

  // Punktljus till de närmaste ljuskällorna (kristaller, eld, staven …).
  assignLights(game, time) {
    const p = game.player;
    const px = p.x / T, pz = p.y / T;
    const cand = [];
    game.world.crystals.forEach((c) => !c.taken && !c.buried && cand.push({ x: c.x / T, y: 1.4, z: c.y / T, c: '#ff5ae8', i: 8, d: 9 }));
    cand.push({ x: this.campfire.position.x, y: 0.8, z: this.campfire.position.z, c: '#ff9a3a', i: 10 + Math.sin(time * 15) * 1.5, d: 10 });
    if (this.core) cand.push({ x: this.core.position.x, y: 2.5, z: this.core.position.z + 1.3, c: game.won ? '#7ff3ff' : '#8a6aff', i: game.won ? 25 : 8, d: 14 });
    const In = SV.Input;
    if (p.swing > 0 || (In.down('staff') && In.holdTime('staff') > 0.3)) cand.push({ x: px, y: 1.1, z: pz, c: '#7ff3ff', i: 6, d: 6, pri: true });
    game.projectiles.forEach((pr) => cand.push({ x: pr.x / T, y: 0.9, z: pr.y / T, c: pr.kind === 'frost' ? '#9ff0ff' : '#ff6ab8', i: 2.5, d: 4 }));
    cand.forEach((c) => (c.dist = c.pri ? -1 : Math.hypot(c.x - px, c.z - pz)));
    cand.sort((a, b) => a.dist - b.dist);
    this.lights.forEach((l, i) => {
      const c = cand[i];
      if (!c || c.dist > 26) {
        l.intensity = 0;
        return;
      }
      l.position.set(c.x, c.y, c.z);
      l.color.set(c.c);
      l.intensity = c.i;
      l.distance = c.d;
    });
  },

  // ---------------------------------------------------------------
  // Etiketter ovanpå 3D-scenen
  // ---------------------------------------------------------------
  project(x, y, z) {
    v3.set(x, y, z).project(this.camera);
    return { x: (v3.x * 0.5 + 0.5) * this.viewW, y: (-v3.y * 0.5 + 0.5) * this.viewH, ok: v3.z < 1 };
  },
  _el(cls) {
    const el = this.ov.pool.pop() || document.createElement('div');
    el.className = cls;
    el.style.opacity = '';
    this.overlay.appendChild(el);
    return el;
  },
  updateOverlay(game, time) {
    const used = [];
    const put = (cls, html, x, y, z, extra) => {
      const s = this.project(x, y, z);
      if (!s.ok || s.x < -50 || s.x > this.viewW + 50 || s.y < -50 || s.y > this.viewH + 50) return null;
      const el = this._el(cls);
      if (el._html !== html) {
        el.innerHTML = html;
        el._html = html;
      }
      el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
      if (extra) extra(el);
      used.push(el);
      return el;
    };
    const H = (x, z) => this.heightAt(x, z);
    game.floaters.forEach((f) => {
      const x = f.x / T, z = f.y / T;
      put('ov-float', f.text, x, H(x, z) + 1.4 + f.t * 0.8, z, (el) => {
        el.style.color = f.col;
        el.style.opacity = String(1 - Math.max(0, f.t - 0.6) / 0.4);
      });
    });
    if (!game.paused) {
      const cm = game.companions;
      cm.unlocked.forEach((k) => {
        const c = cm.roster[k];
        if (c.bubble) put('ov-bubble', c.bubble.text, c.x / T, H(c.x / T, c.y / T) + 1.0 + c.z / T, c.y / T);
      });
      game.world.animals.forEach((a) => {
        if (!a.met && Math.hypot(a.x - game.player.x, a.y - game.player.y) < 260) put('ov-mark', '?', a.x / T, H(a.x / T, a.y / T) + 1.1 + Math.sin(time * 3) * 0.08, a.y / T);
      });
      game.robots.forEach((r) => {
        if (!r.active || Math.hypot(r.x - game.player.x, r.y - game.player.y) > 320) return;
        const top = r.type === 'drone' ? 2.1 : r.type === 'bear' ? 1.7 : 1.0;
        const x = r.x / T, z = r.y / T;
        if (r.state === 'alert') put('ov-alert', '!', x, H(x, z) + top + 0.3, z);
        if (r.hp < r.maxHp) put('ov-hp', '<i></i>', x, H(x, z) + top, z, (el) => (el.firstChild.style.width = Math.max(0, (r.hp / r.maxHp) * 100) + '%'));
      });
      const it = game.interactTarget;
      if (it) {
        const x = it.x / T, z = it.y / T;
        put('ov-prompt', `<kbd>${SV.Input.label('interact')}</kbd>${it.label}`, x, H(x, z) + 1.6, z);
      }
    }
    // återvinn element som inte används denna bildruta
    Array.from(this.overlay.children).forEach((el) => {
      if (!used.includes(el)) {
        this.overlay.removeChild(el);
        if (this.ov.pool.length < 80) this.ov.pool.push(el);
      }
    });
  },

  // ---------------------------------------------------------------
  // Förhandsvisning (smedjan, galleriet, porträtt)
  // ---------------------------------------------------------------
  _preview() {
    if (this.pv) return this.pv;
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.environment = this.scene.environment;
    scene.add(new THREE.HemisphereLight('#bfe0ff', '#304020', 1.6));
    const key = new THREE.DirectionalLight('#fff4e0', 2.2);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7ff3ff', 1.6);
    rim.position.set(-3, 2, -3);
    scene.add(rim);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.pv = { r, scene, cam, models: new Map(), current: null };
    return this.pv;
  },
  previewModel(key, level = 1) {
    const pv = this._preview();
    if (!pv.models.has(key)) {
      let m;
      if (key === 'signe') {
        m = M.buildSigne(this.game.player.armor);
        this.previewSigne = m;
      } else if (key.startsWith('comp:')) m = M.buildCompanion(key.slice(5));
      else if (key.startsWith('robot:')) m = M.buildRobot(key.slice(6));
      pv.models.set(key, m);
    }
    const m = pv.models.get(key);
    if (key.startsWith('comp:')) {
      m.scale.setScalar(LEVEL_SCALE[level - 1] / CHAR);
      M.animateCompanion(m, { dt: 1 / 60, moving: false, level, flying: false });
    }
    if (key === 'signe') M.animateSigne(m, { dt: 1 / 60, moving: false, speedK: 1, shot: 0, swing: 0, charge: 0 });
    if (key.startsWith('robot:')) M.animateRobot(m, { dt: 1 / 60, moving: true, alert: false, beam: false, fade: 0, searchRel: 0 });
    return m;
  },
  // Ritar en modell till en 2D-canvas. framing: 'full' eller 'face'.
  renderPreview(target, key, opts = {}) {
    const pv = this._preview();
    const m = this.previewModel(key, opts.level || 1);
    if (pv.current !== m) {
      if (pv.current) pv.scene.remove(pv.current);
      pv.scene.add(m);
      pv.current = m;
    }
    m.rotation.y = opts.rot ?? 0.5;
    // ram in bara det som syns (inte isskal och sökarljus)
    const box = new THREE.Box3();
    m.updateMatrixWorld(true);
    m.traverseVisible((o) => {
      if (o.isMesh && !o.material.blending) box.expandByObject(o);
      else if (o.isMesh && o.material.blending === THREE.NormalBlending) box.expandByObject(o);
    });
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const W = target.width, Hh = target.height;
    pv.r.setSize(W, Hh, false);
    pv.cam.aspect = W / Hh;
    let h = Math.max(size.y, size.x / pv.cam.aspect, size.z / pv.cam.aspect) * 1.25;
    let look = center.clone();
    if (opts.framing === 'face') {
      h = size.y * 0.55;
      look.y = box.max.y - size.y * 0.3;
    }
    const dist = h / 2 / Math.tan((pv.cam.fov * Math.PI) / 360);
    pv.cam.position.set(look.x + dist * 0.15, look.y + dist * 0.18, look.z + dist);
    pv.cam.lookAt(look);
    pv.cam.updateProjectionMatrix();
    pv.r.render(pv.scene, pv.cam);
    const g = target.getContext('2d');
    g.clearRect(0, 0, W, Hh);
    g.drawImage(pv.r.domElement, 0, 0);
  },
  portrait(kind) {
    this._portraits = this._portraits || {};
    if (this._portraits[kind]) return this._portraits[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    this.renderPreview(c, 'comp:' + kind, { rot: 0.45, level: 1 });
    return (this._portraits[kind] = c.toDataURL());
  },
};

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d * t;
}
