// fur.js – fluffig päls med "shell"-teknik. En kroppsdel ritas som ett
// InstancedMesh där varje instans är ett skal en bit längre ut längs
// normalen; fragmentshadern skär ut tunna strån som smalnar mot spetsen.
// Ger referensbildens pastelliga, skimrande gosedjurspäls.
import * as THREE from 'three';

export let FUR_LAYERS = 14;
export function setFurLayers(n) {
  FUR_LAYERS = n;
}

// Delade ljus-uniforms som vyn uppdaterar varje bildruta.
export const furLights = {
  uLightDir: { value: new THREE.Vector3(0.4, 1, 0.3).normalize() },
  uLightCol: { value: new THREE.Color('#d8f0ff') },
  uSky: { value: new THREE.Color('#5a8aff') },
  uGround: { value: new THREE.Color('#203a20') },
  uRim: { value: new THREE.Color('#5ff0ff') },
  uTime: { value: 0 },
  uWind: { value: 0.3 },
};

const vert = /* glsl */ `
  attribute float aLayer;
  uniform float uLength;
  uniform vec3 uGravity;
  uniform float uTime;
  uniform float uWind;
  varying vec2 vUv;
  varying float vLayer;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vObj;
  void main() {
    vLayer = aLayer;
    vUv = uv;
    vObj = position;
    vec3 p = position + normal * uLength * aLayer;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    float k = aLayer * aLayer;
    wp.xyz += uGravity * k * uLength;
    wp.x += sin(uTime * 2.3 + wp.z * 3.0) * uWind * k * uLength * 0.6;
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec3 uColC;
  uniform vec2 uDensity;
  uniform float uPattern;
  uniform vec3 uLightDir;
  uniform vec3 uLightCol;
  uniform vec3 uSky;
  uniform vec3 uGround;
  uniform vec3 uRim;
  uniform float uGlow;
  uniform float uShimmer;
  varying vec2 vUv;
  varying float vLayer;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vObj;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 cell = vUv * uDensity;
    vec2 id = floor(cell);
    vec2 f = fract(cell) - 0.5;
    float r = hash(id);
    float len = 0.45 + 0.55 * r;
    if (vLayer > len) discard;
    float thick = (1.0 - vLayer / len) * 0.8;
    vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
    if (vLayer > 0.04 && length(f + off * 0.35) > thick) discard;

    // pastellfärger i mjuka fläckar + skimmer
    float n = noise(vObj.xy * uPattern + vObj.z * 1.7);
    vec3 col = mix(uColA, uColB, smoothstep(0.5, 0.85, n));
    float fres = pow(1.0 - max(dot(normalize(vN), vView), 0.0), 2.0);
    col = mix(col, uColC, (fres * 0.6 + vLayer * 0.35) * uShimmer);
    col *= mix(0.72, 1.08, vLayer / len);

    vec3 N = normalize(vN);
    float diff = max(dot(N, normalize(uLightDir)), 0.0) * 0.7 + 0.3;
    vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
    // pastellerna ska förbli ljusa även i skogens blå nattljus
    vec3 light = mix(vec3(1.0), uLightCol, 0.25) * (0.6 + diff * 0.45) + hemi * 0.12;
    vec3 lit = col * light;
    lit += uRim * fres * 0.4 * (0.4 + vLayer);
    lit += col * uGlow;
    gl_FragColor = vec4(lit, 1.0);
  }
`;

// Skapar ett pälsklätt nät av en geometri med uv (t.ex. SphereGeometry).
export function furMesh(geometry, opts = {}) {
  const g = geometry.clone();
  const layers = opts.layers || FUR_LAYERS;
  const layerAttr = new Float32Array(layers);
  for (let i = 0; i < layers; i++) layerAttr[i] = i / (layers - 1);
  g.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layerAttr, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uLength: { value: opts.length || 0.06 },
      uGravity: { value: new THREE.Vector3(0, -(opts.gravity ?? 0.5), 0) },
      uColA: { value: new THREE.Color(opts.a || '#f6f0f4') },
      uColB: { value: new THREE.Color(opts.b || '#d8c0f0') },
      uColC: { value: new THREE.Color(opts.c || '#a8f0e0') },
      uDensity: { value: new THREE.Vector2(...(opts.density || [110, 60])) },
      uPattern: { value: opts.pattern || 3.0 },
      uGlow: { value: opts.glow || 0 },
      uShimmer: { value: opts.shimmer ?? 0.6 },
      ...furLights,
    },
  });
  const mesh = new THREE.InstancedMesh(g, mat, layers);
  const id = new THREE.Matrix4();
  for (let i = 0; i < layers; i++) mesh.setMatrixAt(i, id);
  // gränssfär med marginal för stråna, så att djur utanför bild hoppas över
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius *= 1.4;
  mesh.castShadow = false;
  mesh.userData.fur = mat;
  return mesh;
}
