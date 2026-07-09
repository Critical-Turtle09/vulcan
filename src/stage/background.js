// SPEC v1.6 THE STAGE — the perpetual stage motion. Doctrine 5 (tiny heartbeat) +
// doctrine 11 (backgrounds perpetually move): a near-black field with a slow drifting
// luminance haze and an always-on fine film grain, rendered GPU-side (shader weight,
// not DOM animation — the design bar). No ember here — heat is reserved for meaning.
// The orb (Z4) arrives in G3 and takes the center of this field.
import * as THREE from 'three';
import raw from '../../tokens.json';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec3  uBg;
  uniform vec3  uBgDeep;
  uniform float uGrain;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; } return s; }

  void main() {
    vec2 uv = vUv;
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    // slow drifting haze — sub-perceptual luminance variation (the field breathes)
    float n = fbm(uv * asp * 2.4 + vec2(uTime * 0.012, uTime * 0.008));
    float haze = (n - 0.5) * 0.05;
    // radial settle — center barely lifted, edges sink to bg.deep (a faint vignette)
    float r = distance(uv, vec2(0.5)) * 1.35;
    vec3 col = mix(uBg, uBgDeep, clamp(r, 0.0, 1.0));
    col += haze;
    // fine film grain, always on
    float g = hash(uv * uRes + fract(uTime) * vec2(37.0, 91.0));
    col += (g - 0.5) * uGrain;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

export function createBackground(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const toLin = (hex) => { const c = new THREE.Color(hex).convertSRGBToLinear(); return new THREE.Vector3(c.r, c.g, c.b); };
  const uniforms = {
    uTime:   { value: 0 },
    uRes:    { value: new THREE.Vector2(1, 1) },
    uBg:     { value: toLin(raw.stage.bg) },
    uBgDeep: { value: toLin(raw.stage['bg.deep']) },
    uGrain:  { value: raw.stage['grain.amp'] },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }
  resize();
  window.addEventListener('resize', resize);

  return {
    render(t) { uniforms.uTime.value = t; renderer.render(scene, cam); },
    resize,
    renderer,
  };
}
