// SLICE 2 entry — THE MAP. Ambient dot-globe that dives to oblique terrain, with
// VULCAN's orb docked as the entity while the world is the stage (§composition).
// Camera flies globe<->oblique in one continuous move; keys 1-4 still drive orb.
import * as THREE from 'three';
import { color, injectCSSVars } from '../tokens.js';
import rawTokens from '../../tokens.json';
import { simplex3 } from '../noise.js';
import { createPost } from '../post.js';
import { createMap } from './globe.js';
import { createOrb } from '../orb/orb.js';
import { SITES } from './sites.js';

injectCSSVars();
const M = rawTokens.map;
const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
const hudState = document.getElementById('hud-state');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setClearColor(color('void'), 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
const w0 = window.innerWidth, h0 = window.innerHeight;
renderer.setSize(w0, h0);

const scene = new THREE.Scene();
scene.background = color('void');
scene.fog = new THREE.FogExp2(color('haze').getHex(), 0.0);   // enabled during dive

const camera = new THREE.PerspectiveCamera(M['camera.ambientFov'], w0 / h0, 0.1, 400);
const AMB = new THREE.Vector3(...M['camera.ambientPos']);
const DIVE = new THREE.Vector3(...M['camera.divePos']);
const DIVE_LOOK = new THREE.Vector3(...M['camera.diveLook']);
camera.position.copy(AMB);
camera.lookAt(0, 0, 0);
scene.add(camera);                     // so docked orb (camera child) renders

const map = createMap();
scene.add(map.object);

// ---- docked orb — VULCAN's presence, parented to the camera (screen-fixed) ----
const orb = createOrb();
const dock = new THREE.Group();
dock.add(orb.object);
dock.scale.setScalar(M['orb.dockScale']);
dock.position.set(...M['orb.dockPos']);
camera.add(dock);

const post = createPost(renderer, scene, camera, { w: w0, h: h0 }, { bloom: M['post.bloom'], grain: M['post.grain'] });

// ---- DOM site labels (tethered, near-hemisphere only, fade on dive) ----
const labels = SITES.map((s) => {
  const el = document.createElement('div');
  el.className = 'site-label';
  el.textContent = s.name;
  labelLayer.appendChild(el);
  return { s, el };
});

const KEYSITE = { t: 'tsmc-hsinchu', v: 'asml', n: 'nvidia', k: 'samsung', m: 'micron', b: 'micron' };
window.addEventListener('keydown', (e) => {
  const orbMap = { '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' };
  if (orbMap[e.key]) { orb.setState(orbMap[e.key]); return; }        // orb overrides, always
  if (e.key === '0' || e.key === 'Escape') { map.surface(); return; }
  const id = KEYSITE[e.key.toLowerCase()];
  if (id && map.mode === 'globe') map.dive(id);
});

// click a visible site to dive
canvas.addEventListener('click', (ev) => {
  if (map.mode !== 'globe') return;
  const screens = map.siteScreens(camera);
  let best = null, bestD = 46 * 46;   // px threshold^2
  for (const it of screens) {
    if (it.facing <= 0.08) continue;
    const p = it.world.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth, y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    const dx = x - ev.clientX, dy = y - ev.clientY, d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = it.site; }
  }
  if (best) map.dive(best.id);
});

// ---- reveal + loop ----
const formMs = M['globe.formMs'];
let t = 0, reveal = 0, lastMs = performance.now();

function updateCamera() {
  const p = map.diveP;
  camera.position.lerpVectors(AMB, DIVE, p);
  if (!reduce && p < 0.001) {
    const mag = AMB.length();
    camera.position.x += simplex3(t / 26, 0, 0) * 0.003 * mag;
    camera.position.y += simplex3(0, t / 30, 11) * 0.003 * mag;
  }
  const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), DIVE_LOOK, p);
  camera.lookAt(look);
  scene.fog.density = M['terrain.fogDensity'] * p;   // horizon haze fades in on dive
}

function paintLabels() {
  const p = map.diveP;
  const screens = map.siteScreens(camera);
  const labelFade = 1 - THREE.MathUtils.smoothstep(p, 0.0, 0.4);
  for (let i = 0; i < labels.length; i++) {
    const { el } = labels[i];
    const it = screens[i];
    const proj = it.world.clone().project(camera);
    const vis = it.facing > 0.12 && proj.z < 1 && reveal > 0.6 && labelFade > 0.02;
    el.style.opacity = vis ? (0.85 * labelFade).toFixed(2) : '0';
    if (vis) {
      const x = (proj.x * 0.5 + 0.5) * window.innerWidth, y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
      el.style.transform = `translate(${x + 12}px, ${y - 8}px)`;
    }
  }
  // dived-region label
  if (p > 0.5 && map.target) { hudState.textContent = `THEATER · ${map.target.name}`; }
  else { hudState.textContent = 'AMBIENT · SILICON CORRIDOR'; }
}

function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastMs) / 1000, 0.05); lastMs = now; t += dt;
  if (reveal < 1) reveal = Math.min(reveal + dt * 1000 / formMs, 1);

  map.update(dt, t, dpr, reveal);
  orb.update(dt, t, 1, dpr);       // docked orb always fully revealed
  updateCamera();
  paintLabels();
  post.setTime(t);
  post.composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__vulcanMap = {
  dive: (id) => map.dive(id),
  surface: () => map.surface(),
  setOrb: (n) => orb.setState(n),
  state: () => ({ mode: map.mode, diveP: +map.diveP.toFixed(4), diveRaw: +map.diveRaw.toFixed(4), target: map.target && map.target.id, reveal: +reveal.toFixed(3), orb: orb.stateName }),
  sites: () => SITES.map((s) => s.id),
};

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); post.setSize(w, h, dpr);
});
