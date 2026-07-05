// Slice 0 — MATERIAL TEST (spec §9). One full-screen scene, no UI, no data feeds.
// void + grain + atmosphere -> particle-terrain drifting -> node heartbeat ->
// ember event ignites, propagates two hops, cools -> mono-caps label resolves
// per-glyph, holds, dissolves. Camera drifts on Perlin. Every value from tokens.
import * as THREE from 'three';
import { TOKENS, color, scene, motion, injectCSSVars } from './tokens.js';
import { simplex3 } from './noise.js';
import { createTerrain } from './terrain.js';
import { createNetwork } from './network.js';
import { createLabel } from './label.js';
import { createPost } from './post.js';

injectCSSVars();

const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setClearColor(color('void'), 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);

const w0 = window.innerWidth, h0 = window.innerHeight;
renderer.setSize(w0, h0);

const worldScene = new THREE.Scene();
worldScene.background = color('void');
// atmosphere — distant terrain fades into HAZE (not black), giving the staged
// war-table horizon: ridgelines dissolving into depth fog (§6 STAGE).
worldScene.fog = new THREE.FogExp2(color('haze').getHex(), scene('fog.density'));

const [cx, cy, cz] = scene('camera.pos');
const [lx, ly, lz] = scene('camera.look');
const camera = new THREE.PerspectiveCamera(scene('camera.fov'), w0 / h0, 0.1, 400);
const camBase = new THREE.Vector3(cx, cy, cz);
const camLook = new THREE.Vector3(lx, ly, lz);
camera.position.copy(camBase);
camera.lookAt(camLook);

// ---- world objects ----
const terrain = createTerrain();
const network = createNetwork(terrain);
worldScene.add(terrain.object);
worldScene.add(network.object);

const label = createLabel(labelLayer);

// ---- post ----
const post = createPost(renderer, worldScene, camera, { w: w0, h: h0 });

// ---- reveal + event choreography ----
const formMs = scene('terrain.formMs');
const holdMs = scene('event.holdMs');
const coolMs = scene('event.coolMs');
const gapMs = scene('event.loopGapMs');
const driftAmp = motion('idle.camera.driftAmp');
const driftPeriod = motion('idle.camera.driftPeriod');

const LABEL_TEXT = '◢ EVENT 0447Z · FAB-18 HSINCHU · EUV THROUGHPUT −12% · SIM';

let t = 0;           // seconds since start
let reveal = 0;      // global granular formation 0..1
let phase = 'form';  // form -> settle -> event -> hold -> cool -> gap -> (event)
let phaseT = 0;      // ms in current phase
let labeled = false;

function setPhase(p) { phase = p; phaseT = 0; }

let frozen = false;        // audit harness: hold current reveal/phase
let revealOverride = null;

function step(dt) {
  if (frozen) { if (revealOverride !== null) reveal = revealOverride; return; }
  phaseT += dt * 1000;

  // global reveal easing (granular formation of the whole patch)
  if (phase === 'form') {
    reveal = Math.min(phaseT / formMs, 1);
    reveal = reveal * reveal * (3 - 2 * reveal);
    if (phaseT >= formMs) { reveal = 1; setPhase('settle'); }
  } else {
    reveal = 1;
  }

  if (phase === 'settle' && phaseT > 900) setPhase('event');

  if (phase === 'event' && !labeled) {
    network.triggerEvent(0);
    label.resolve(LABEL_TEXT);
    labeled = true;
  }
  if (phase === 'event' && phaseT > 700) setPhase('hold');

  if (phase === 'hold' && phaseT > holdMs) {
    label.dissolve();
    setPhase('cool');
  }

  // let nodes finish cooling before looping
  if (phase === 'cool' && phaseT > coolMs) setPhase('gap');

  if (phase === 'gap' && phaseT > gapMs) { labeled = false; setPhase('event'); }
}

function driftCamera() {
  if (reduce) { camera.position.copy(camBase); camera.lookAt(camLook); return; }
  const p1 = driftPeriod[0], p2 = driftPeriod[1];
  const ax = simplex3(t / p1, 0.0, 0.0);
  const ay = simplex3(0.0, t / p2, 11.3);
  const az = simplex3(7.7, 0.0, t / ((p1 + p2) * 0.5));
  const mag = camBase.length();
  camera.position.set(
    camBase.x + ax * driftAmp * mag,
    camBase.y + ay * driftAmp * mag,
    camBase.z + az * driftAmp * mag * 0.6
  );
  // target drifts a touch less — keeps the world "breathing" not swaying
  const tx = simplex3(t / (p1 * 1.7), 3.0, 0.0) * driftAmp * mag * 0.5;
  camera.lookAt(camLook.x + tx, camLook.y, camLook.z);
}

let lastMs = performance.now();
function frame() {
  const nowMs = performance.now();
  const dt = Math.min((nowMs - lastMs) / 1000, 0.05);
  lastMs = nowMs;
  t += dt;

  step(dt);
  driftCamera();

  // drive world uniforms
  terrain.uniforms.uTime.value = t;
  terrain.uniforms.uReveal.value = reveal;
  terrain.uniforms.uDrift.value = t * scene('terrain.driftSpeed');
  terrain.uniforms.uPixelRatio.value = dpr;

  network.update(dt, t, reveal, dpr);

  label.update(network.seedWorld(), camera, window.innerWidth, window.innerHeight, reveal);
  post.setTime(t);

  post.composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// expose internals for the self-audit harness (screenshot-driven tuning)
window.__vulcan = {
  fire() { frozen = false; setPhase('event'); labeled = false; },
  state: () => ({ phase, reveal, t, labelState: label.state }),
  freeze(v) { frozen = true; revealOverride = (v === undefined ? null : v); },
  unfreeze() { frozen = false; revealOverride = null; },
  restartForm() { frozen = false; revealOverride = null; reveal = 0; labeled = false; label.dissolve(); setPhase('form'); },
  terrain, network, post, camera, worldScene, renderer,
  // project a world point to pixel coords — used to confirm terrain is in-frame
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, z: v.z };
  },
  setUniform(target, name, value) {
    const t = target === 'terrain' ? terrain.uniforms : null;
    if (t && t[name]) { t[name].value = value; return t[name].value; }
    return null;
  },
};

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.setSize(w, h, dpr);
});
