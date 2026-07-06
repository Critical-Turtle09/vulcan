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
import { createPanels } from '../map/panels.js';
import { createWire } from '../wire.js';
import { createQuotes } from '../quotes.js';
import { createIgnition } from '../ignition.js';
import { createSchematic } from '../scenes/schematic.js';
import {
  activeProfile, activeProfileId, regions, regionByKey, mapEnabled,
  setActive, nextProfile,
} from '../profile.js';

injectCSSVars();
const O = rawTokens.orb;
const M = rawTokens.map;
const PROF = rawTokens.profile;
const IG = rawTokens.ignition;
const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setClearColor(color('void'), 1);
// §1a — the canvas LIGHTEN-composites over #backdrop (desktop capture) and
// #void-over (opacity = presence). During the ceremony the real screen shows
// beneath the sparks; when resolved the void floor is opaque and the look is
// unchanged (lighten(void, void) = void). No canvas-alpha / compositor gamble.
const backdrop = document.getElementById('backdrop');
const voidOver = document.getElementById('void-over');
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
orb.setResolution(w0 * dpr, h0 * dpr);
const HOME_POS = new THREE.Vector3(...M['orb.homePos']);
const DOCK_POS = new THREE.Vector3(...M['orb.dockPos']);
const HOME_SCALE = M['orb.homeScale'] * O.scale;   // v1.3 — reduced home scale
const DOCK_SCALE = M['orb.dockScale'];

// THE IGNITION — molten sparks (camera-parented, edge->orb screen space)
const ignition = createIgnition({ homePos: HOME_POS, homeScale: HOME_SCALE, orbRadius: O.radius, fov: M['camera.fov'], aspect: w0 / h0 });
camera.add(ignition.object);

// theater — summoned terrain (world space)
const theater = createTheater();
scene.add(theater.object);

// PART 4 — device/schematic scene (procedural GPU board), placed on the table
const schematic = createSchematic();
schematic.object.position.set(0, 0, -3);
scene.add(schematic.object);

// STAGE A — tethered blueprint panels (site dossiers from the active profile)
const panels = createPanels();

const post = createPost(renderer, scene, camera, { w: w0, h: h0 }, { bloom: M['post.bloom'], grain: M['post.grain'] });

// ---- voice loop ----
const params = new URLSearchParams(location.search);
const forceTest = params.get('voice') === 'test';
const bridge = window.vulcan || {
  async config() { return { hasKey: false, hasWhisper: false, testMode: forceTest }; },
  async tts() { return { ok: false }; },
  async transcribe() { return { ok: false }; },
};
// wake-from-hidden: "Fire and Forge" routes through the SAME summon path as the
// Alt+Space hotkey — show the overlay over the active Space and play the full
// ignition (FINDING 1). "Bank the fire" / "stand down" reverse it (FINDING 4).
const voice = createVoice({
  orb, bridge, forceTest,
  onWake: () => {
    if (bridge.requestSummon) bridge.requestSummon();   // main: overlay active Space + ui:ignite
    if (presence < 0.5) ignite();                        // local kindle (browser + belt-and-suspenders)
  },
  onDismiss: () => { if (presence > 0.5 || ignMode === 'kindling') bank(); },
  // PART 6 — LOCAL REFLEX intents -> actions (returns optional spoken confirmation)
  onCommand: (intent) => runCommand(intent),
});

function statusLine() {
  const s = voice.status(), ws = wire.status(), qs = quotes.status();
  return `Status. Voice ${s.online ? (s.local ? 'local' : 'online') : 'offline'}, `
    + `wire ${ws.online ? 'live' : 'offline'}, quotes ${qs.online ? 'live' : 'offline'}, `
    + `heat index ${heatIndex.toFixed(2)}.`;
}
function runCommand(intent) {
  switch (intent && intent.type) {
    case 'mute': voice.setMuted(true); paintHud(); return 'Muted.';
    case 'unmute': voice.setMuted(false); paintHud(); return 'Listening.';
    case 'bank': bank(); return null;
    case 'summon':
      if (intent.arg === 'schematic') { summonSchematic(); return 'Summoning the device schematic.'; }
      if (intent.arg && regions()[intent.arg]) { summon(intent.arg); return `Summoning ${regions()[intent.arg].name}.`; }
      return 'Which region — Taiwan, Europe, North America, or Korea?';
    case 'explode': if (sceneKind === 'schematic') { explodeTarget = 1; return 'Exploded view.'; } return null;
    case 'assemble': explodeTarget = 0; return 'Reassembled.';
    case 'profile': switchProfile(); return `Profile ${activeProfileId()}.`;
    case 'status': return statusLine();
    default: return null;
  }
}

// ---- THE IGNITION state machine (system-wide summon / bank) ----
let presence = 1;            // command-center presence: 1 resolved (default) .. 0 hidden
let ignMode = 'resolved';    // resolved | kindling | banking | hidden
const ignTotalS = IG['ceremony.ms'] / 1000;   // ignition ceremony (~3s, own token)
const ignBankS = IG['bank.ms'] / 1000;         // the quench (~1.8s)
function ignite() { if (ignMode === 'kindling') return; presence = 0; ignMode = 'kindling'; }   // kindle from the edges
function bank() { if (ignMode === 'banking' || ignMode === 'hidden') return; ignMode = 'banking'; }  // reverse -> hide
function onBanked() { if (bridge.requestHide) bridge.requestHide(); }

// ORGAN: THE WIRE — polls the active profile's feeds, ignites molten heat
const wire = createWire({ bridge, getProfile: activeProfile });
// ORGAN: QUOTES — polls the active profile's symbols, greyscale marks on terrain
const quotes = createQuotes({ bridge, getProfile: activeProfile });

// ---- summon state machine ----
let summonMode = 'home';       // home | summoning | theater | dismissing
let summonRaw = 0, summonP = 0;
let currentRegion = null;
let sceneKind = 'map';         // map | schematic (PART 4)
let explodeP = 0, explodeTarget = 0;   // schematic exploded-view (0 assembled .. 1)
const summonDurS = M['summon.durationMs'] / 1000;

function summon(regionId) {
  const regs = regions();
  if (!regs[regionId] || !mapEnabled()) return;
  if (summonMode !== 'home') return;
  sceneKind = 'map'; currentRegion = regionId;
  theater.setRegion(regs[regionId], regionId);
  summonMode = 'summoning';           // feedback <100ms: transition begins next frame
}
function summonSchematic() {
  if (summonMode !== 'home') return;
  sceneKind = 'schematic'; currentRegion = null; explodeP = 0; explodeTarget = 0;
  summonMode = 'summoning';
}
function dismiss() { if (summonMode === 'theater' || summonMode === 'summoning') summonMode = 'dismissing'; }
// in a summoned scene (map region OR schematic)
const inSceneNow = () => summonP > 0.5 && (currentRegion || sceneKind === 'schematic');
const inTheaterNow = () => summonP > 0.5 && currentRegion;   // map-only (site picking)

// STAGE A — site selection. Returns the resolved site nearest a screen point
// within a pixel radius, or null. Also drives number-key + click selection.
function siteAtScreen(px, py, radius = 64) {
  if (!inTheaterNow()) return null;
  const w = window.innerWidth, h = window.innerHeight;
  let best = null, bestD = radius * radius;
  for (const s of theater.sites) {
    const p = s.world.clone().project(camera);
    if (p.z > 1) continue;
    const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
    const d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}
function selectSiteIndex(i) {
  if (!inTheaterNow()) return false;
  const s = theater.sites[i];
  if (s) { panels.open(s); return true; }
  return false;
}

// ---- site labels (DOM, tethered; theater only) ----
const labelPool = Array.from({ length: 8 }, () => {
  const el = document.createElement('div'); el.className = 'site-label'; labelLayer.appendChild(el); return el;
});

// ---- country labels (PART 5): the region's political names, quiet ground context
// beneath the fab site marks. `edge` countries (in view but centroid off-screen)
// read dimmer with a › indicator. ----
const countryPool = Array.from({ length: 10 }, () => {
  const el = document.createElement('div'); el.className = 'country-label'; labelLayer.appendChild(el); return el;
});
function paintCountryLabels(fade) {
  const list = (fade > 0.02 && inTheaterNow()) ? theater.regionLabels() : [];
  const w = window.innerWidth, h = window.innerHeight;
  // safe band — clear of the V.A.U.L.T columns (edges) and top/bottom chrome. A
  // country whose ground point falls outside the frame is clamped to the band edge
  // with a caret pointing its way (honest off-view indicator), de-collided vertically.
  const L = 250, R = w - 250, T = 92, B = h - 116;
  const usedY = { l: [], r: [] };
  for (let i = 0; i < countryPool.length; i++) {
    const el = countryPool[i], d = list[i];
    if (!d) { el.style.opacity = '0'; continue; }
    const p = d.world.clone().project(camera);
    if (p.z >= 1) { el.style.opacity = '0'; continue; }
    let x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
    const off = d.edge || x < L || x > R || y < T || y > B;
    let text = d.name;
    if (off) {
      const side = x < w / 2 ? 'l' : 'r';
      x = side === 'l' ? L : R;
      y = Math.min(B, Math.max(T, y));
      while (usedY[side].some((yy) => Math.abs(yy - y) < 26)) y += 26;
      usedY[side].push(y);
      text = side === 'l' ? `‹ ${d.name}` : `${d.name} ›`;
    }
    el.textContent = text;
    el.style.opacity = ((off ? 0.42 : 0.62) * fade).toFixed(2);
    el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ---- quote chips (DOM, tethered near org sites; greyscale, no green/red) ----
const quoteChipPool = Array.from({ length: 8 }, () => {
  const el = document.createElement('div'); el.className = 'quote-chip'; labelLayer.appendChild(el); return el;
});
function fmtPrice(p) { return p >= 1000 ? p.toFixed(0) : p.toFixed(2); }
function paintQuotes() {
  const w = window.innerWidth, h = window.innerHeight;
  const fade = smooth(0.6, 0.96, summonP);
  const list = (inTheaterNow() && fade > 0.02) ? quotes.forRegion(currentRegion) : [];
  const perSite = {};   // stack multiple symbols on the same site
  let used = 0;
  for (let i = 0; i < list.length && used < quoteChipPool.length; i++) {
    const q = list[i]; const site = theater.sites[q.siteIdx];
    if (!site || !q.quote) continue;                       // no mark without a real value
    const el = quoteChipPool[used++];
    const proj = site.world.clone().project(camera);
    const vis = proj.z < 1;
    if (!vis) { el.style.opacity = '0'; continue; }
    const stack = (perSite[q.siteIdx] = (perSite[q.siteIdx] || 0) + 1) - 1;
    const sx = (proj.x * 0.5 + 0.5) * w, sy = (-proj.y * 0.5 + 0.5) * h;
    const up = q.quote.pct >= 0;
    const caret = up ? '▲' : '▼';               // direction encodes sign; colour stays greyscale
    const pct = `${up ? '+' : ''}${(q.quote.pct * 100).toFixed(2)}%`;
    el.innerHTML = `<span class="qs">${q.label}</span><span class="qp">${fmtPrice(q.quote.price)}</span><span class="qd">${caret} ${pct}</span>`;
    el.style.opacity = (0.92 * fade).toFixed(2);
    el.style.transform = `translate(${sx + 14}px, ${sy + 16 + stack * 16}px)`;
  }
  for (let i = used; i < quoteChipPool.length; i++) quoteChipPool[i].style.opacity = '0';
}

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
  // ORGAN 1.5 — surface local-TTS failover as a "LOCAL" tag
  const localTag = s.local ? ` · LOCAL ${(s.provider || '').toUpperCase()}` : '';
  vt.voice.textContent = s.online ? (s.muted ? 'MUTED' : `${STATE_HINTS[orb.stateName] || 'LIVE'}${localTag}`)
    : `OFFLINE · ${s.offlineReason || 'UNAVAILABLE'}`;
  vt.voice.className = 'v ' + (s.online ? (s.muted ? 'dim' : (s.local ? 'heat' : '')) : 'heat');
  const ws = wire.status();
  vt.wire.textContent = ws.online ? `LIVE · ${ws.sources} FEED${ws.sources === 1 ? '' : 'S'}` : `OFFLINE · ${ws.offlineReason || 'STANDBY'}`;
  vt.wire.className = 'v ' + (ws.online ? '' : (ws.offlineReason === 'STANDBY' ? 'dim' : 'heat'));
  const qs = quotes.status();
  vt.quotes.textContent = qs.online ? `LIVE · ${qs.count} SYM${qs.stale ? ' · STALE' : ''}` : `OFFLINE · ${qs.offlineReason || 'STANDBY'}`;
  vt.quotes.className = 'v ' + (qs.online ? (qs.stale ? 'dim' : '') : (qs.offlineReason === 'STANDBY' ? 'dim' : 'heat'));
  vt.heat.textContent = heatIndex.toFixed(2);
  vt.heat.className = 'v ' + (heatIndex > 0.01 ? 'heat' : 'dim');
  const up = Math.floor((performance.now() - bootMs) / 1000);
  vt.uptime.textContent = `${String(Math.floor(up / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}`;
  const rObj = currentRegion ? regions()[currentRegion] : null;
  vt.mode.textContent = (summonP > 0.5 && sceneKind === 'schematic') ? 'DEVICE'
    : (summonP > 0.5 && rObj) ? rObj.name : 'HOME';
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
  wireLines = []; heatIndex = 0; lastFeedStr = ''; wire.reset(); quotes.reset();   // re-target feeds/heat/symbols
  setTimeout(() => { populateProfileHud(); renderFeed(); revealHud(); }, PROF['crossflow.ms'] * 0.4);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  // digits: in the theater they select a site (open its dossier panel); at home
  // they drive the orb state (1-4). The theater docks the orb, so no collision.
  if (/^[1-9]$/.test(e.key)) {
    if (inTheaterNow()) { if (selectSiteIndex(+e.key - 1)) return; }
    const orbKeys = { '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' };
    if (orbKeys[e.key]) { orb.setState(orbKeys[e.key]); return; }
    return;
  }
  if (k === rawTokens.voice.muteKey) { voice.toggleMute(); paintHud(); return; }
  if (k === PROF.switchKey) { switchProfile(); return; }
  if (k === 'x') { summonSchematic(); return; }                       // PART 4 — device/schematic
  if (k === 'e' && inSceneNow() && sceneKind === 'schematic') { explodeTarget = explodeTarget > 0.5 ? 0 : 1; return; }
  if (e.key === '0') { dismiss(); return; }           // 0 -> back to orb home
  if (e.key === 'Escape') {
    if (panels.isOpen) { panels.close(); return; }    // 1) close the panel
    if (summonMode !== 'home') { dismiss(); return; } // 2) leave the theater
    bank(); return;                                    // 3) bank the fire (hide overlay)
  }
  const rbk = regionByKey();
  if (rbk[k]) summon(rbk[k]);
});

// click a site mark to open its dossier; click empty ground to dismiss the panel
window.addEventListener('pointerdown', (e) => {
  if (!inTheaterNow()) return;
  const s = siteAtScreen(e.clientX, e.clientY);
  if (s) panels.open(s);
  else if (panels.isOpen) panels.close();
});

// Electron drives ignite/bank/mute from the global hotkey + tray (STAGE D)
if (bridge.onIgnite) bridge.onIgnite(() => ignite());
if (bridge.onBank) bridge.onBank(() => bank());
if (bridge.onMute) bridge.onMute(() => { voice.toggleMute(); paintHud(); });
// §1a — the active-display snapshot becomes the ceremony backdrop (real screen
// beneath the sparks). null (no permission) -> stays void; fail-soft.
if (bridge.onBackdrop) bridge.onBackdrop((url) => { backdrop.style.backgroundImage = url ? `url(${url})` : 'none'; });

populateProfileHud();
renderFeed();
revealHud();
voice.boot().then(paintHud);
wire.boot();
quotes.boot();

// ---- reveal + loop ----
const formMs = O.formMs;
let t = 0, initReveal = 0, lastMs = performance.now();
let simAmp = null;   // audit hook: when set, a synthetic audio envelope drives the waves
let lastFeedStr = '';

function step(dt) {
  if (summonMode === 'summoning') { summonRaw = Math.min(summonRaw + dt / summonDurS, 1); if (summonRaw >= 1) summonMode = 'theater'; }
  else if (summonMode === 'dismissing') { summonRaw = Math.max(summonRaw - dt / summonDurS, 0); if (summonRaw <= 0) { summonMode = 'home'; currentRegion = null; } }
  summonP = smooth(0, 1, summonRaw);
  // ignition presence — kindle up / bank down ('held' = frozen for the audit)
  if (ignMode === 'kindling') { presence = Math.min(presence + dt / ignTotalS, 1); if (presence >= 1) ignMode = 'resolved'; }
  else if (ignMode === 'banking') { presence = Math.max(presence - dt / ignBankS, 0); if (presence <= 0) { ignMode = 'hidden'; onBanked(); } }
}

// command-center chrome fades in as the fire resolves (last, after the orb)
const hudEls = [document.getElementById('vault-left'), document.getElementById('vault-right'), document.getElementById('keys'), document.getElementById('bank-hint')];
const ceremonyTitle = document.getElementById('ceremony-title');
function gateChrome(p) { const o = smooth(0.64, 1.0, p).toFixed(3); for (const el of hudEls) if (el) el.style.opacity = o; }

// role context for a site label (PART 3) — "TSMC · HSINCHU" -> "… · FAB"
function roleTag(site) {
  const r = ((site.dossier && site.dossier.role) || '').toUpperCase();
  if (/PORT/.test(r)) return 'PORT';
  if (/EUV|LITHO/.test(r)) return 'EUV';
  if (/MEMORY/.test(r)) return 'MEMORY';
  if (/DESIGN|FABLESS/.test(r)) return 'DESIGN';
  if (/FAB/.test(r)) return 'FAB';
  return '';
}
// scene legend (PART 3) — what this is + what the marks mean
const legendEl = document.getElementById('legend');
function legendFor(regionId) {
  const p = activeProfile();
  const name = regions()[regionId] ? regions()[regionId].name : '';
  const hasBorders = theater.hasBorders();
  return `${name}<span class="sep">·</span>${(p.eyebrow || p.name)}`
    + `<span class="sep">|</span><span class="hl">MOLTEN</span> ROUTES + SITES`
    + `<span class="sep">·</span><span class="hl">◆</span> HEAT = LIVE WIRE EVENT`
    + `<span class="sep">·</span>GREY = EQUITY`
    + `<span class="sep">·</span>▬ COAST${hasBorders ? '<span class="sep">·</span>─ BORDER' : ''}`;
}

function legendSchematic() {
  return `GPU DEVICE<span class="sep">·</span>PARAMETRIC SCHEMATIC (DRAFT)`
    + `<span class="sep">|</span>DUST = HOUSE MATERIAL`
    + `<span class="sep">·</span><span class="hl">E</span> = EXPLODE`
    + `<span class="sep">·</span>DIE RUNS HOT`;
}
function paintLabels() {
  const inScene = summonP > 0.4 && (currentRegion || sceneKind === 'schematic');
  const fade = smooth(0.55, 0.95, summonP);
  legendEl.style.opacity = inScene ? fade.toFixed(2) : '0';
  const legendKey = sceneKind === 'schematic' ? 'schematic' : currentRegion;
  if (inScene && legendEl.dataset.region !== legendKey) { legendEl.innerHTML = sceneKind === 'schematic' ? legendSchematic() : legendFor(currentRegion); legendEl.dataset.region = legendKey; }
  const screens = !inScene ? [] : (sceneKind === 'schematic' ? schematic.partScreens(explodeP) : theater.siteScreens(camera));
  for (let i = 0; i < labelPool.length; i++) {
    const el = labelPool[i];
    if (i < screens.length) {
      const proj = screens[i].world.clone().project(camera);
      const vis = proj.z < 1 && fade > 0.02;
      const tag = roleTag(screens[i].site);
      el.textContent = tag ? `${screens[i].site.name} · ${tag}` : screens[i].site.name;
      el.style.opacity = vis ? (0.9 * fade).toFixed(2) : '0';
      if (vis) {
        const x = (proj.x * 0.5 + 0.5) * window.innerWidth, y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
        el.style.transform = `translate(${x + 12}px, ${y - 8}px)`;
      }
    } else { el.style.opacity = '0'; }
  }
  paintCountryLabels(sceneKind === 'schematic' ? 0 : fade);
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
  // ignition: the orb condenses in from the sparks as the fire resolves
  const orbGate = smooth(0.28, 0.96, presence);
  const orbReveal = initReveal * (1 - dissolveDip) * orbGate;
  ignition.setP(presence); ignition.setTime(t); ignition.setPixelRatio(dpr);
  // CEREMONY (§ignition): the anvil STRIKE throws the surge (kindling only), the
  // QUENCH cools to steam-grey (banking), and the VULCAN title beats in/out.
  const at = IG['strike.at'], hw = IG['strike.width'];
  const igniting = ignMode === 'kindling' || ignMode === 'held';   // 'held' = audit freeze
  let strikeW = 0, strikeFlash = 0;
  if (igniting) {
    strikeW = smooth((at - hw / 2), (at + hw / 2), presence);
    strikeFlash = Math.sin(strikeW * Math.PI);
  } else if (ignMode === 'resolved') { strikeW = 1; }
  ignition.setShock(strikeW);
  ignition.setStrike(strikeFlash);
  ignition.setQuench(ignMode === 'banking' ? Math.min((1 - presence) * 1.4, 1) : 0);
  // title beat (igniting only — never reappears on bank)
  let titleOp = 0;
  if (igniting) {
    titleOp = smooth(IG['title.inAt'] - 0.02, IG['title.inAt'] + 0.06, presence) * (1 - smooth(IG['title.outAt'], IG['title.outAt'] + 0.08, presence));
  }
  ceremonyTitle.style.opacity = titleOp.toFixed(3);
  ceremonyTitle.style.transform = `translate(-50%,-50%) scale(${(0.955 + 0.055 * titleOp).toFixed(3)})`;
  ceremonyTitle.style.filter = `blur(${(3.2 * (1 - titleOp)).toFixed(2)}px)`;
  // void floor opacity = presence — during the ceremony the real screen shows
  // beneath the sparks (lighten blend); when resolved it is opaque void.
  voidOver.style.opacity = presence.toFixed(3);
  gateChrome(presence);

  const mapOn = sceneKind === 'map' ? 1 : 0, schemOn = sceneKind === 'schematic' ? 1 : 0;
  const sceneReveal = initReveal * smooth(0.3, 0.95, summonP);
  const terrainReveal = sceneReveal * mapOn;
  const schemReveal = sceneReveal * schemOn;
  scene.fog.density = M['terrain.fogDensity'] * summonP * mapOn;
  explodeP += (explodeTarget - explodeP) * Math.min(dt * 3.2, 1);   // exploded-view lerp

  voice.tick();
  // audit hook: synthetic audio envelope so wave reactivity is drivable headless
  if (simAmp !== null) orb.setAmplitude(simAmp(t));

  // ---- wire heat: decay, route to theater / orb, feed the HUD ----
  wire.tick(dt * 1000);
  heatIndex = wire.heatIndex();
  const ignited = wire.drainIgnitions();
  for (const ig of ignited) {
    const shown = inTheaterNow() && ig.region === currentRegion;
    if (!shown) orb.pulseHeat(1);        // no map for this region -> minimal orb heat tick
  }
  if (currentRegion) theater.setHeat(wire.heatForRegion(currentRegion));
  const feedStr = JSON.stringify(wire.hudLines());
  if (feedStr !== lastFeedStr) { lastFeedStr = feedStr; wireLines = wire.hudLines(); renderFeed(); }

  orb.update(dt, t, orbReveal, dpr);
  theater.update(dt, t, terrainReveal, dpr);
  schematic.update(dt, t, schemReveal, explodeP, dpr);
  paintLabels();
  paintQuotes();
  if (panels.isOpen && !inTheaterNow()) panels.close();   // leaving theater dissolves the panel
  panels.update(camera, window.innerWidth, window.innerHeight);
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
  // STAGE A — panel controls / harness
  openSite: (i) => selectSiteIndex(i),
  closePanel: () => panels.close(),
  panelOpen: () => panels.isOpen,
  sites: () => theater.sites.map((s) => s.id),
  // PART 4 — scene harness
  summonSchematic: () => summonSchematic(),
  explode: (on) => { explodeTarget = on ? 1 : 0; },
  sceneKind: () => sceneKind,
  // profile controls
  profile: () => activeProfileId(),
  setProfile: (id) => { if (setActive(id)) { dismiss(); populateProfileHud(); renderFeed(); wireLines = []; heatIndex = 0; lastFeedStr = ''; wire.reset(); quotes.reset(); } },
  switchProfile: () => switchProfile(),
  // audit: drive the reactive waves with a synthetic envelope (0..1). null = off.
  simAudio: (on) => { simAmp = on ? ((tt) => 0.5 + 0.42 * Math.sin(tt * 5.0) * Math.sin(tt * 1.3)) : null; if (!on) orb.setAmplitude(0); },
  // STAGE D — ignition harness
  ignite: () => ignite(),
  bank: () => bank(),
  ignitionState: () => ({ presence: +presence.toFixed(3), mode: ignMode }),
  __holdPresence: (p) => { presence = Math.max(0, Math.min(1, p)); ignMode = 'held'; },   // audit: freeze a phase
  // STAGE B — wire harness: ignite a synthetic event (region, site index, title)
  wireInject: (region, siteIdx, title) => wire.injectTest(region, siteIdx, title),
  wireStatus: () => wire.status(),
  wireHeat: () => wire.heatIndex(),
  wireLines: () => wire.hudLines(),
  // STAGE C — quotes harness: seed a synthetic quote (sym, price, pct)
  quotesInject: (sym, price, pct) => quotes.injectTest(sym, price, pct),
  quotesStatus: () => quotes.status(),
  // voice harness (FINDING 1/4)
  triggerWake: () => voice.triggerWake(),
  triggerDismiss: () => voice.triggerDismiss(),
  // simulate the wake/dismiss OUTCOMES directly (routes exactly as the phrases do)
  simWake: () => { if (bridge.requestSummon) bridge.requestSummon(); if (presence < 0.5) ignite(); },
  simDismiss: () => { if (presence > 0.5 || ignMode === 'kindling') bank(); },
  // PART 6 — reflex harness: classify a simulated transcript + run the command
  reflexTest: async (text) => { const intent = await (await import('../reflex.js')).classify(text, bridge); return { intent, spoken: intent ? runCommand(intent) : null }; },
  voiceStatus: () => voice.status(),
  toggleMute: () => { voice.toggleMute(); paintHud(); },
  setMuted: (v) => { voice.setMuted(v); paintHud(); },
};

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); post.setSize(w, h, dpr);
  orb.setResolution(w * dpr, h * dpr);
  ignition.resize(w / h);
});
