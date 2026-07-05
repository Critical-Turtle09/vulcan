// SLICE 1 entry — full-screen orb scene. Reuses the token layer, post grade, and
// noise from Slice 0. Keys 1-4 switch state (idle/listening/thinking/speaking);
// each switch is a continuous material reorganization, never a cut (doctrine 11).
import * as THREE from 'three';
import { color, injectCSSVars } from '../tokens.js';
import rawTokens from '../../tokens.json';
import { simplex3 } from '../noise.js';
import { createPost } from '../post.js';
import { createOrb } from './orb.js';

injectCSSVars();
const ORB = rawTokens.orb;

const canvas = document.getElementById('stage');
const stateEls = {
  name: document.getElementById('state-name'),
  hint: document.getElementById('state-hint'),
};
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setClearColor(color('void'), 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
const w0 = window.innerWidth, h0 = window.innerHeight;
renderer.setSize(w0, h0);

const worldScene = new THREE.Scene();
worldScene.background = color('void');

const [cx, cy, cz] = ORB['camera.pos'];
const camera = new THREE.PerspectiveCamera(ORB['camera.fov'], w0 / h0, 0.1, 400);
const camBase = new THREE.Vector3(cx, cy, cz);
camera.position.copy(camBase);
camera.lookAt(0, 0, 0);

const orb = createOrb();
worldScene.add(orb.object);

const post = createPost(renderer, worldScene, camera, { w: w0, h: h0 });

// ---- state HUD (mono caps, resolves per doctrine but here just tracks target) ----
const STATE_HINTS = {
  idle: 'AWAITING', listening: 'LISTENING', thinking: 'TRAVERSING GRAPH', speaking: 'RESPONDING',
};
function paintHud() {
  stateEls.name.textContent = orb.stateName.toUpperCase();
  stateEls.hint.textContent = STATE_HINTS[orb.stateName] || '';
}
paintHud();

window.addEventListener('keydown', (e) => {
  const map = { '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' };
  if (map[e.key]) { orb.setState(map[e.key]); paintHud(); }
});

// ---- reveal (granular formation) ----
const formMs = ORB.formMs;
let t = 0, reveal = 0, lastMs = performance.now();
const driftAmp = 0.003, driftPeriod = 26;

function frame() {
  const nowMs = performance.now();
  const dt = Math.min((nowMs - lastMs) / 1000, 0.05);
  lastMs = nowMs; t += dt;

  if (reveal < 1) { reveal = Math.min(reveal + dt * 1000 / formMs, 1); }

  // faint idle camera drift (never static)
  if (!reduce) {
    const mag = camBase.length();
    camera.position.set(
      camBase.x + simplex3(t/driftPeriod, 0, 0) * driftAmp * mag,
      camBase.y + simplex3(0, t/driftPeriod, 11) * driftAmp * mag,
      camBase.z);
    camera.lookAt(0, 0, 0);
  }

  orb.update(dt, t, reveal, dpr);
  post.setTime(t);
  post.composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__vulcanOrb = {
  setState: (n) => { orb.setState(n); paintHud(); },
  state: () => ({ name: orb.stateName, reveal, t }),
  probe: () => orb.probe(),
};

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); post.setSize(w, h, dpr);
});
