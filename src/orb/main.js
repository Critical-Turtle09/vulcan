// VULCAN HOME (v1.2). The orb is the default interface — centered, full presence,
// the protagonist. Geography is SUMMONED: keys t/v/n/k transform orb -> oblique
// terrain theater in one continuous granular crossflow (orb dissolves as the
// region's terrain forms from the same dust; the orb re-forms small, docked).
// Esc/0 reverses identically. Voice loop + keys 1-4 + mute (M) unchanged.
import * as THREE from 'three';
import { color, injectCSSVars } from '../tokens.js';
import rawTokens from '../../tokens.json';
import { simplex3 } from '../noise.js';
import { createPost } from '../post.js';
import { createOrb } from './orb.js';
import { createVoice } from '../voice/voice.js';
import { createTheater } from '../map/theater.js';
import { REGIONS, REGION_BY_KEY } from '../map/regions.js';

injectCSSVars();
const ORB = rawTokens.orb;
const M = rawTokens.map;
const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
const stateEls = { name: document.getElementById('state-name'), hint: document.getElementById('state-hint') };
const hudRegion = document.getElementById('hud-region');
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
scene.fog = new THREE.FogExp2(color('haze').getHex(), 0.0);

// camera fixed at the oblique theater angle; the orb is camera-parented so it
// stays screen-fixed (center at home -> corner while summoned) regardless.
const camera = new THREE.PerspectiveCamera(M['camera.fov'], w0 / h0, 0.1, 400);
const camPos = new THREE.Vector3(...M['camera.pos']);
camera.position.copy(camPos);
camera.lookAt(...M['camera.look']);
scene.add(camera);

// orb — VULCAN's presence, parented to the camera
const orb = createOrb();
const dock = new THREE.Group();
dock.add(orb.object);
camera.add(dock);
const HOME_POS = new THREE.Vector3(...M['orb.homePos']);
const DOCK_POS = new THREE.Vector3(...M['orb.dockPos']);

// theater — summoned terrain (world space)
const theater = createTheater();
scene.add(theater.object);

const post = createPost(renderer, scene, camera, { w: w0, h: h0 }, { bloom: M['post.bloom'], grain: M['post.grain'] });

// ---- ORGAN 1 — voice loop (unchanged) ----
const params = new URLSearchParams(location.search);
const forceTest = params.get('voice') === 'test';
const bridge = window.vulcan || {
  async config() { return { hasKey: false, hasWhisper: false, testMode: forceTest }; },
  async tts() { return { ok: false }; },
  async transcribe() { return { ok: false }; },
};
const voice = createVoice({ orb, bridge, forceTest });

// ---- summon state machine ----
let summonMode = 'home';       // home | summoning | theater | dismissing
let summonRaw = 0;             // 0 home .. 1 theater
let summonP = 0;               // eased
let currentRegion = null;
const summonDurS = M['summon.durationMs'] / 1000;

function summon(regionId) {
  if (!REGIONS[regionId]) return;
  if (summonMode !== 'home') return;
  currentRegion = regionId;
  theater.setRegion(regionId);
  summonMode = 'summoning';           // feedback <100ms: transition begins next frame
}
function dismiss() { if (summonMode === 'theater' || summonMode === 'summoning') summonMode = 'dismissing'; }

// ---- site labels (DOM, tethered; appear only in theater) ----
const labelPool = Array.from({ length: 8 }, () => {
  const el = document.createElement('div'); el.className = 'site-label'; labelLayer.appendChild(el); return el;
});

// ---- HUD ----
const STATE_HINTS = { idle: 'AWAITING', listening: 'LISTENING', thinking: 'TRAVERSING GRAPH', speaking: 'RESPONDING' };
const offlineEl = document.getElementById('voice-offline');
const mutedEl = document.getElementById('voice-muted');
let lastStatusStr = '';
function paintHud() {
  stateEls.name.textContent = orb.stateName.toUpperCase();
  stateEls.hint.textContent = STATE_HINTS[orb.stateName] || '';
  const s = voice.status();
  offlineEl.textContent = s.online ? '' : `VOICE OFFLINE · ${s.offlineReason || 'UNAVAILABLE'}`;
  if (mutedEl) mutedEl.style.opacity = s.muted ? '1' : '0';
  if (hudRegion) hudRegion.textContent = (summonP > 0.5 && currentRegion) ? `THEATER · ${REGIONS[currentRegion].name}` : 'VULCAN · HOME';
  const str = JSON.stringify(s);
  if (str !== lastStatusStr) { lastStatusStr = str; console.log('[voice] status', str); }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const orbKeys = { '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' };
  if (orbKeys[e.key]) { orb.setState(orbKeys[e.key]); return; }   // orb overrides, always live
  if (k === rawTokens.voice.muteKey) { voice.toggleMute(); paintHud(); return; }
  if (e.key === '0' || e.key === 'Escape') { dismiss(); return; }
  if (REGION_BY_KEY[k]) summon(REGION_BY_KEY[k]);
});

voice.boot().then(paintHud);

// ---- reveal + loop ----
const formMs = ORB.formMs;
let t = 0, initReveal = 0, lastMs = performance.now();

function step(dt) {
  if (summonMode === 'summoning') { summonRaw = Math.min(summonRaw + dt / summonDurS, 1); if (summonRaw >= 1) summonMode = 'theater'; }
  else if (summonMode === 'dismissing') { summonRaw = Math.max(summonRaw - dt / summonDurS, 0); if (summonRaw <= 0) { summonMode = 'home'; currentRegion = null; } }
  summonP = smooth(0, 1, summonRaw);
}

function paintLabels() {
  const inTheater = summonP > 0.4 && currentRegion;
  const fade = smooth(0.55, 0.95, summonP);
  const screens = inTheater ? theater.siteScreens(camera) : [];
  for (let i = 0; i < labelPool.length; i++) {
    const el = labelPool[i];
    if (i < screens.length) {
      const proj = screens[i].world.clone().project(camera);
      const vis = proj.z < 1 && fade > 0.02;
      el.textContent = screens[i].site.name;
      el.style.opacity = vis ? (0.9 * fade).toFixed(2) : '0';
      if (vis) {
        const x = (proj.x * 0.5 + 0.5) * window.innerWidth, y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
        el.style.transform = `translate(${x + 12}px, ${y - 8}px)`;
      }
    } else { el.style.opacity = '0'; }
  }
}

function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastMs) / 1000, 0.05); lastMs = now; t += dt;
  if (initReveal < 1) initReveal = Math.min(initReveal + dt * 1000 / formMs, 1);

  step(dt);

  // faint camera drift (life in the theater; orb self-animates at home)
  if (!reduce) {
    camera.position.set(
      camPos.x + simplex3(t / 30, 0, 0) * 0.05,
      camPos.y + simplex3(0, t / 34, 11) * 0.05,
      camPos.z);
    camera.lookAt(...M['camera.look']);
  }

  // orb: dock (center->corner) + dissolve/reform crossflow
  const dockL = smooth(0.15, 0.85, summonP);
  dock.position.lerpVectors(HOME_POS, DOCK_POS, dockL);
  dock.scale.setScalar(THREE.MathUtils.lerp(M['orb.homeScale'], M['orb.dockScale'], dockL));
  const dissolveDip = Math.min(Math.sin(summonP * Math.PI) * 1.25, 1);
  const orbReveal = initReveal * (1 - dissolveDip);

  // terrain forms as the orb dissolves (crossflow); fog horizon fades in
  const terrainReveal = initReveal * smooth(0.3, 0.95, summonP);
  scene.fog.density = M['terrain.fogDensity'] * summonP;

  voice.tick();
  orb.update(dt, t, orbReveal, dpr);
  theater.update(dt, t, terrainReveal, dpr);
  paintLabels();
  post.setTime(t);
  post.composer.render();
  paintHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__vulcanHome = {
  summon: (id) => summon(id),
  dismiss: () => dismiss(),
  setState: (n) => { orb.setState(n); paintHud(); },
  state: () => ({ summonMode, summonRaw: +summonRaw.toFixed(4), summonP: +summonP.toFixed(4), region: currentRegion, orb: orb.stateName, initReveal: +initReveal.toFixed(3), routeActive: theater.active, routeHead: +theater.headU.toFixed(3) }),
  probe: () => orb.probe(),
  regions: () => Object.keys(REGIONS),
  // voice harness (unchanged)
  triggerWake: () => voice.triggerWake(),
  voiceStatus: () => voice.status(),
  toggleMute: () => { voice.toggleMute(); paintHud(); },
  setMuted: (v) => { voice.setMuted(v); paintHud(); },
};

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); post.setSize(w, h, dpr);
});
