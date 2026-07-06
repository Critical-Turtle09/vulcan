// VULCAN HOME (spec v1.3 FORGE AMENDMENT). The orb is the default interface —
// centered (now ~60% scale), audio-reactive waves, protagonist. Geography is
// SUMMONED from the ACTIVE PROFILE: keys t/v/n/k transform orb -> oblique terrain
// theater in one continuous granular crossflow. Esc/0 reverses. The engine is
// domain-blind — every organ reads the active profile (P switches it). The
// V.A.U.L.T HUD (left vitals, right command deck) populates from real live state.
import * as THREE from 'three';
import { color, injectCSSVars } from '../tokens.js';
import rawTokens from '../../tokens.json';
import { simplex3 } from '../noise.js';
import { createPost } from '../post.js';
import { createOrb } from './orb.js';
import { createVoice } from '../voice/voice.js';
import { createTheater } from '../map/theater.js';
import {
  activeProfile, activeProfileId, regions, regionByKey, mapEnabled,
  setActive, nextProfile,
} from '../profile.js';

injectCSSVars();
const O = rawTokens.orb;
const M = rawTokens.map;
const PROF = rawTokens.profile;
const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
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

const camera = new THREE.PerspectiveCamera(M['camera.fov'], w0 / h0, 0.1, 400);
const camPos = new THREE.Vector3(...M['camera.pos']);
camera.position.copy(camPos);
camera.lookAt(...M['camera.look']);
scene.add(camera);

// orb — VULCAN's presence, parented to the camera (screen-fixed)
const orb = createOrb();
const dock = new THREE.Group();
dock.add(orb.object);
camera.add(dock);
const HOME_POS = new THREE.Vector3(...M['orb.homePos']);
const DOCK_POS = new THREE.Vector3(...M['orb.dockPos']);
const HOME_SCALE = M['orb.homeScale'] * O.scale;   // v1.3 — reduced home scale
const DOCK_SCALE = M['orb.dockScale'];

// theater — summoned terrain (world space)
const theater = createTheater();
scene.add(theater.object);

const post = createPost(renderer, scene, camera, { w: w0, h: h0 }, { bloom: M['post.bloom'], grain: M['post.grain'] });

// ---- voice loop ----
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
let summonRaw = 0, summonP = 0;
let currentRegion = null;
const summonDurS = M['summon.durationMs'] / 1000;

function summon(regionId) {
  const regs = regions();
  if (!regs[regionId] || !mapEnabled()) return;
  if (summonMode !== 'home') return;
  currentRegion = regionId;
  theater.setRegion(regs[regionId]);
  summonMode = 'summoning';           // feedback <100ms: transition begins next frame
}
function dismiss() { if (summonMode === 'theater' || summonMode === 'summoning') summonMode = 'dismissing'; }

// ---- site labels (DOM, tethered; theater only) ----
const labelPool = Array.from({ length: 8 }, () => {
  const el = document.createElement('div'); el.className = 'site-label'; labelLayer.appendChild(el); return el;
});

// ---- V.A.U.L.T HUD ----
const vt = {
  state: document.getElementById('vt-state'),
  voice: document.getElementById('vt-voice'),
  wire: document.getElementById('vt-wire'),
  quotes: document.getElementById('vt-quotes'),
  heat: document.getElementById('vt-heat'),
  uptime: document.getElementById('vt-uptime'),
  mode: document.getElementById('vault-mode'),
  profile: document.getElementById('vault-profile'),
  directives: document.getElementById('vt-directives'),
  feed: document.getElementById('vt-feed'),
};
const bootMs = performance.now();
const STATE_HINTS = { idle: 'AWAITING', listening: 'LISTENING', thinking: 'TRAVERSING', speaking: 'RESPONDING' };
let heatIndex = 0;             // set by the wire organ (STAGE B); real, decays to 0
let wireLines = [];            // {text, heat} — set by the wire organ

// reveal the vitals rows in a staggered fluid resolve (never a pop-in block)
function revealHud() {
  const rows = document.querySelectorAll('#vault-left .vault-row');
  rows.forEach((r, i) => setTimeout(() => { r.style.opacity = '1'; }, i * rawTokens.hud['reveal.stagger.ms']));
}
function populateProfileHud() {
  const p = activeProfile();
  vt.profile.textContent = (p.hud && p.hud.profile) || p.name;
  vt.directives.innerHTML = '';
  const dirs = (p.hud && p.hud.directives) || [];
  dirs.forEach((d, i) => {
    const el = document.createElement('div'); el.className = 'vault-directive'; el.textContent = d;
    el.style.opacity = '0'; vt.directives.appendChild(el);
    setTimeout(() => { el.style.opacity = '1'; }, 120 + i * rawTokens.hud['reveal.stagger.ms']);
  });
}
function renderFeed() {
  const lines = wireLines.length ? wireLines : [{ text: 'WIRE STANDBY', heat: false }];
  vt.feed.innerHTML = '';
  lines.slice(0, rawTokens.wire['hud.lines']).forEach((l, i) => {
    const el = document.createElement('div'); el.className = 'vault-line' + (l.heat ? ' heat' : '');
    el.innerHTML = `<span class="tick">${l.heat ? '◆' : '·'}</span>${l.text}`;
    el.style.opacity = '0'; vt.feed.appendChild(el);
    setTimeout(() => { el.style.opacity = '1'; }, i * 40);
  });
}

let lastStatusStr = '';
function paintHud() {
  vt.state.textContent = orb.stateName.toUpperCase();
  const s = voice.status();
  vt.voice.textContent = s.online ? (s.muted ? 'MUTED' : STATE_HINTS[orb.stateName] || 'LIVE')
    : `OFFLINE · ${s.offlineReason || 'UNAVAILABLE'}`;
  vt.voice.className = 'v ' + (s.online ? (s.muted ? 'dim' : '') : 'heat');
  vt.heat.textContent = heatIndex.toFixed(2);
  vt.heat.className = 'v ' + (heatIndex > 0.01 ? 'heat' : 'dim');
  const up = Math.floor((performance.now() - bootMs) / 1000);
  vt.uptime.textContent = `${String(Math.floor(up / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}`;
  vt.mode.textContent = (summonP > 0.5 && currentRegion) ? regions()[currentRegion].name : 'HOME';
  const str = JSON.stringify(s);
  if (str !== lastStatusStr) { lastStatusStr = str; console.log('[voice] status', str); }
}

// ---- profile switch (P) — granular-ish crossflow: dismiss theater, swap, re-form HUD
function switchProfile() {
  const next = nextProfile();
  if (next === activeProfileId()) return;
  dismiss();                                 // any theater dissolves (granular)
  setActive(next);
  // HUD command deck re-forms: fade rows out, repopulate, fade in (fluid, no cut)
  const rows = document.querySelectorAll('#vault-left .vault-row');
  rows.forEach((r) => { r.style.opacity = '0'; });
  wireLines = []; heatIndex = 0;
  setTimeout(() => { populateProfileHud(); renderFeed(); revealHud(); }, PROF['crossflow.ms'] * 0.4);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const orbKeys = { '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' };
  if (orbKeys[e.key]) { orb.setState(orbKeys[e.key]); return; }
  if (k === rawTokens.voice.muteKey) { voice.toggleMute(); paintHud(); return; }
  if (k === PROF.switchKey) { switchProfile(); return; }
  if (e.key === '0' || e.key === 'Escape') { dismiss(); return; }
  const rbk = regionByKey();
  if (rbk[k]) summon(rbk[k]);
});

populateProfileHud();
renderFeed();
revealHud();
voice.boot().then(paintHud);

// ---- reveal + loop ----
const formMs = O.formMs;
let t = 0, initReveal = 0, lastMs = performance.now();
let simAmp = null;   // audit hook: when set, a synthetic audio envelope drives the waves

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

  if (!reduce) {
    camera.position.set(
      camPos.x + simplex3(t / 30, 0, 0) * 0.05,
      camPos.y + simplex3(0, t / 34, 11) * 0.05,
      camPos.z);
    camera.lookAt(...M['camera.look']);
  }

  // orb dock (center->corner) + dissolve/reform crossflow
  const dockL = smooth(0.15, 0.85, summonP);
  dock.position.lerpVectors(HOME_POS, DOCK_POS, dockL);
  dock.scale.setScalar(THREE.MathUtils.lerp(HOME_SCALE, DOCK_SCALE, dockL));
  const dissolveDip = Math.min(Math.sin(summonP * Math.PI) * 1.25, 1);
  const orbReveal = initReveal * (1 - dissolveDip);

  const terrainReveal = initReveal * smooth(0.3, 0.95, summonP);
  scene.fog.density = M['terrain.fogDensity'] * summonP;

  voice.tick();
  // audit hook: synthetic audio envelope so wave reactivity is drivable headless
  if (simAmp !== null) orb.setAmplitude(simAmp(t));

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
  state: () => ({ summonMode, summonRaw: +summonRaw.toFixed(4), summonP: +summonP.toFixed(4), region: currentRegion, orb: orb.stateName, initReveal: +initReveal.toFixed(3), routeActive: theater.active, routeHead: +theater.headU.toFixed(3), profile: activeProfileId() }),
  probe: () => orb.probe(),
  regions: () => Object.keys(regions()),
  // profile controls
  profile: () => activeProfileId(),
  setProfile: (id) => { if (setActive(id)) { dismiss(); populateProfileHud(); renderFeed(); wireLines = []; heatIndex = 0; } },
  switchProfile: () => switchProfile(),
  // audit: drive the reactive waves with a synthetic envelope (0..1). null = off.
  simAudio: (on) => { simAmp = on ? ((tt) => 0.5 + 0.42 * Math.sin(tt * 5.0) * Math.sin(tt * 1.3)) : null; if (!on) orb.setAmplitude(0); },
  // wire/quotes organs push here (STAGE B/C)
  __setHeat: (v) => { heatIndex = v; },
  __setWireLines: (lines) => { wireLines = lines; renderFeed(); },
  // voice harness
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
