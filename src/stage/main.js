// SPEC v1.6 THE STAGE — G1 THE SHELL. The v2.1 shell: near-black stage, adaptive-scale
// zone scaffolding (Z1–Z8, bounded), the always-lit corners, and the only LIVE parts of
// this slice — the TR clock and the Z6 status strip. Content for the flanks (G2), the orb
// (G3), dispatch (G4), and the intent line (G5) lands in later slices; their zones own
// their bounds now so nothing can ever collide (§0 adaptive scale law).
//
// The identity organs are UNCHANGED and kept intact: the voice loop (+ wire status) still
// boots and runs through this shell, so summon/respond and every IPC path stay live even
// though the orb view is not mounted until G3. A minimal stub stands in for the orb so the
// voice session drives the CORE state read without the G3 engine.
import { injectStageVars, stage } from './tokens.js';
import { createBackground } from './background.js';
import { createOrb } from './orb.js';
import { createVoice } from '../voice/voice.js';
import { createWire } from '../wire.js';
import { activeProfile } from '../profile.js';
import rawTokens from '../../tokens.json';

injectStageVars();

// ---- perpetual background (doctrine 5 + 11) ----
const bg = createBackground(document.getElementById('bg'));

// ---- LIVE: TR clock — seconds in ember, date beneath. Resolves in, never snaps. ----
const el = (id) => document.getElementById(id);
const clockHM = el('clock-hm'), clockSec = el('clock-sec'), clockDate = el('clock-date');
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const p2 = (n) => String(n).padStart(2, '0');
let lastClockKey = '';
function paintClock() {
  const d = new Date();
  const key = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
  if (key === lastClockKey) return;
  lastClockKey = key;
  clockHM.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  clockSec.textContent = p2(d.getSeconds());
  clockDate.textContent = `${DOW[d.getDay()]} ${p2(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

// ---- LIVE: Z6 status strip. CORE ← the voice/orb session state (real). WIRE ← the wire
// organ's online boolean (real, already in the codebase). HANDS ← placeholder until the
// crew/dispatch lands. Each subsystem's dot turns ember when it is active. ----
const CORE_LABEL = { idle: 'IDLE', listening: 'LISTENING', thinking: 'WORKING', speaking: 'SPEAKING' };
function setSub(name, text, active) {
  const s = el(`ss-${name}`);
  if (!s) return;
  s.querySelector('.ss-val').textContent = text;
  s.classList.toggle('active', !!active);
}
function paintStatus() {
  const core = orb.stateName;
  setSub('core', CORE_LABEL[core] || 'IDLE', core !== 'idle');
  const ws = wire.status();
  setSub('wire', ws.online ? `LIVE · ${ws.sources} FEED${ws.sources === 1 ? '' : 'S'}` : 'STANDBY', ws.online);
  setSub('hands', 'STANDBY', false);   // TODO(G4): wire to the crew/dispatch runner state
  // Z2 AUDIO I/O labels track the REAL TTS state (the speaking envelope is G4). The
  // §4 microcopy is exact: TTS.STANDBY|LIVE and VOICE LINK · STANDBY|SPEAKING.
  const speaking = core === 'speaking';
  const aioState = el('aio-state'), aioLink = el('aio-link');
  if (aioState) aioState.textContent = speaking ? 'TTS.LIVE' : 'TTS.STANDBY';
  if (aioLink) aioLink.textContent = speaking ? 'SPEAKING' : 'STANDBY';
}

// ---- voice loop + wire (kept intact; the audio path must stay unbroken) ----
const params = new URLSearchParams(location.search);
const forceTest = params.get('voice') === 'test';
const bridge = window.vulcan || {
  async config() { return { hasKey: false, hasWhisper: false, hasEars: false, testMode: forceTest }; },
  async tts() { return { ok: false }; },
  async transcribe() { return { ok: false }; },
};

const orb = createOrb(el('orb-slot'), paintStatus);   // G3 — the a5 TWIN HELIX (Z4)
const wire = createWire({ bridge, getProfile: activeProfile });

// PART 6 local reflexes reaching the shell: only the session/audio controls exist here.
function statusLine() {
  const s = voice.status(), ws = wire.status();
  return `Status. Voice ${s.online ? (s.local ? 'local' : 'online') : 'offline'}, wire ${ws.online ? 'live' : 'offline'}.`;
}
function runCommand(intent) {
  switch (intent && intent.type) {
    case 'mute': voice.setMuted(true); paintStatus(); return 'Muted.';
    case 'unmute': voice.setMuted(false); paintStatus(); return 'Listening.';
    case 'bank': if (bridge.requestHide) bridge.requestHide(); return null;
    case 'status': return statusLine();
    default: return null;
  }
}

const voice = createVoice({
  orb, bridge, forceTest,
  // wake-from-hidden routes through the same summon path (main is idempotent when
  // already visible); banking hides the overlay. The answer panel surface is G4, so
  // onAnswer is a no-op here — the loop still SPEAKS every answer (audio path intact).
  onWake: () => { if (bridge.requestSummon) bridge.requestSummon(); },
  onDismiss: () => { if (bridge.requestHide) bridge.requestHide(); },
  onCommand: (intent) => runCommand(intent),
  onAnswer: () => {},                 // TODO(G4): resolve answers onto the Z3 transform field
  onSession: () => paintStatus(),
});

// ---- IPC (resident overlay control) — kept in lockstep with the voice session ----
if (bridge.onIgnite) bridge.onIgnite(() => { resolveIn(); voice.wake(); });
if (bridge.onBank) bridge.onBank(() => { voice.goDormant(); if (bridge.requestHide) bridge.requestHide(); });
if (bridge.onMute) bridge.onMute(() => { voice.toggleMute(); paintStatus(); });
if (bridge.onForceHide) bridge.onForceHide(() => { voice.goDormant(); });
if (bridge.onSpeak) bridge.onSpeak((text) => voice.say(text, { kind: 'announce' }));
// §1a backdrop snapshot (ceremony material, exercised fully in G6) — kept intact.
const backdrop = el('backdrop');
if (bridge.onBackdrop) bridge.onBackdrop((url) => { if (backdrop) backdrop.style.backgroundImage = url ? `url(${url})` : 'none'; });

// ---- PUSH-TO-TALK (v1.5.1 THE TRIGGER) — kept so the ears can capture through the shell.
// The mic opens ONLY while the trigger (Space) is held and the window is focused; fn is
// never bound. A blur while held ends the clip cleanly. ----
const PTT_MODE = rawTokens.voice.capture_mode !== 'open';
const PTT_KEY = rawTokens.voice.ptt_key || 'Space';
const isPttKey = (e) => (PTT_KEY === 'Space' ? e.code === 'Space' : e.key.toLowerCase() === PTT_KEY.toLowerCase());
let pttHeld = false;
function pttRelease() { if (pttHeld) { pttHeld = false; voice.pttUp(); paintStatus(); } }
window.addEventListener('keyup', (e) => { if (PTT_MODE && isPttKey(e)) { e.preventDefault(); pttRelease(); } });
window.addEventListener('blur', pttRelease);
window.addEventListener('keydown', (e) => {
  if (PTT_MODE && isPttKey(e)) {
    e.preventDefault();
    if (!e.repeat && !pttHeld) { pttHeld = true; voice.pttDown(); paintStatus(); }
    return;
  }
  if (e.key.toLowerCase() === rawTokens.voice.muteKey) { voice.toggleMute(); paintStatus(); }
  // DEV/DEBUG override (v1.4 convention, undocumented): 1/2/3 cycle the three a5 orb states
  // so all are demonstrable without the live loop. The REAL wiring is unchanged — IDLE←session,
  // WORKING←thinking/dispatch, SPEAKING←TTS all still drive orb.setState. // TODO(G4: dispatch drives WORKING)
  if (e.code === 'Digit1') orb._devVisual('idle');
  else if (e.code === 'Digit2') orb._devVisual('working');
  else if (e.code === 'Digit3') orb._devVisual('speaking');
});

// ═══ G2 THE FLANKS ═══════════════════════════════════════════════════════════
// Z1 SYSTEM VITALS (real wires: Claude spend·B0, Vercel·B5R, GH commits·B2 + one
// TODO'd placeholder), and Z2 COMMAND DECK + AUDIO I/O. All content resolves in
// staggered on mount (doctrine 11). Dispatch (chips/queue/states) is G4 — the deck
// click is a logged stub here.

// sparkline: values[] -> a tiny inline SVG polyline. Greyscale only — a sparkline
// encodes a TREND, never a heat event, so it never spends the ember accent. Fewer
// than two points -> a single hairline base (honest "no series", not a fake trend).
function sparkSVG(values) {
  const w = 100, h = 30, pad = 3;
  const wrap = (inner) => `<svg class="vspark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
  const vals = (values || []).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return wrap(`<line class="base" x1="0" y1="${h - pad}" x2="${w}" y2="${h - pad}"/>`);
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1, n = vals.length;
  const pts = vals.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`);
  const [lx, ly] = pts[pts.length - 1].split(',');
  return wrap(`<polyline points="${pts.join(' ')}"/><circle class="cap" cx="${lx}" cy="${ly}" r="1.6"/>`);
}

// vitals model. `waitlist` is a placeholder (no live source yet); the other three are
// overwritten in place by the real reads as they resolve.
const VITALS = {
  waitlist: { label: 'WAITLIST', num: '312', unit: '', delta: '18 / WK', mk: '▲', spark: [280, 291, 288, 299, 305, 309, 312] }, // TODO(data-source)
  commits:  { label: 'GH COMMITS /WK', num: '—', unit: '', delta: 'LAST 7 DAYS', mk: '', spark: [] },
  vercel:   { label: 'VERCEL', num: '—', unit: '', delta: '', mk: '', spark: [] },
  spend:    { label: 'CLAUDE SPEND', num: '—', unit: '', delta: 'OF $2 CAP', mk: '', spark: [] },
};
const VITALS_ORDER = ['waitlist', 'commits', 'vercel', 'spend'];

function cardInner(c) {
  const unit = c.unit ? `<span class="unit">${c.unit}</span>` : '';
  const delta = c.delta
    ? `<div class="vdelta${c.mk ? '' : ' off'}">${c.mk ? `<span class="mk">${c.mk}</span> ` : ''}${c.delta}</div>`
    : `<div class="vdelta off">—</div>`;
  return `<div class="vlabel">${c.label}</div><div class="vnum">${c.num}${unit}</div>${sparkSVG(c.spark)}${delta}`;
}
function updateCard(k) { const node = el(`vc-${k}`); if (node) node.innerHTML = cardInner(VITALS[k]); }
function buildVitals() {
  const host = el('vitals'); if (!host) return;
  host.innerHTML = VITALS_ORDER.map((k) => `<div class="vcard rz" id="vc-${k}"></div>`).join('');
  VITALS_ORDER.forEach(updateCard);
}

// live reads — fail-soft; a missing bridge method (dev-in-browser) just leaves the
// placeholder dash. The card is updated IN PLACE so a refresh never re-pops it.
async function refreshSpend() {
  if (!bridge.vitalsSpend) return;
  try {
    const s = await bridge.vitalsSpend(); if (!s) return;
    VITALS.spend.num = String(s.pct); VITALS.spend.unit = '%';
    VITALS.spend.delta = `$${(s.spentUsd || 0).toFixed(2)} / $${(s.capUsd || 2).toFixed(0)} CAP`;
    VITALS.spend.mk = s.pct >= 80 ? '▲' : '';
    VITALS.spend.spark = (s.spark && s.spark.length > 1) ? s.spark : [];
    updateCard('spend');
  } catch (_) { /* keep placeholder */ }
}
async function refreshCommits() {
  if (!bridge.vitalsCommits) return;
  try {
    const c = await bridge.vitalsCommits(); if (!c) return;
    VITALS.commits.num = String(c.total); VITALS.commits.spark = c.spark || [];
    updateCard('commits');
  } catch (_) { /* keep placeholder */ }
}
async function refreshVercel() {
  if (!bridge.vitalsVercel) return;
  try {
    const v = await bridge.vitalsVercel(); if (!v) return;
    VITALS.vercel.num = v.primary || 'N/C';
    VITALS.vercel.delta = v.sub || (v.connected ? '' : 'NOT CONNECTED');
    VITALS.vercel.spark = [];   // a deploy STATE has no trend series (honest empty)
    updateCard('vercel');
  } catch (_) { /* keep placeholder */ }
}

// COMMAND DECK — ten commands, row-major over the 2-col grid (§3, exact order).
const DECK = [
  'MISSION BRIEF', 'DEPLOY CHECK',
  'METRICS PULL', 'OUTREACH',
  'WIRE SCAN', 'COMPLIANCE',
  'PITCH DESK', 'VAULT CLEAN',
  'PLAN TODAY', 'WK REVIEW',
];
function buildDeck() {
  const host = el('deck'); if (!host) return;
  host.innerHTML = DECK.map((name) =>
    `<div class="deck-cell rz" data-cmd="${name}"><span class="deck-dot"></span><span class="deck-label">${name}</span><span class="deck-arrow">→</span></div>`).join('');
  // click = stub only — chips/queue/states are G4. No Space/Enter key binding: Space
  // is the PTT trigger and must never be shadowed by a focused deck cell.
  host.querySelectorAll('.deck-cell').forEach((cell) =>
    cell.addEventListener('click', () => console.log(`[deck] intent: ${cell.dataset.cmd}`)));  // TODO(G4: dispatch lifecycle)
}

// AUDIO I/O — a STATIC mixed dash-block waveform (short bars = dashes, tall = blocks).
// The live amplitude animation is TODO(G4). Fixed pattern (no RNG) so it reads stable.
function buildWave() {
  const host = el('aio-wave'); if (!host) return;
  const pat = [3, 7, 3, 14, 3, 5, 11, 3, 3, 18, 3, 7, 3, 3, 12, 3, 6, 3, 16, 3, 3, 9, 3, 13, 3, 5, 3, 10];
  host.innerHTML = pat.map((hh) => `<i style="height:${hh}px"></i>`).join('');
}

// doctrine 11: the flank content forms from dust, granular + staggered — never a pop.
function resolveFlanks() {
  const items = [...document.querySelectorAll('#flank-left .rz, #flank-right .rz')];
  items.forEach((elm, i) => { elm.style.transitionDelay = `${Math.min(i * 45, 320)}ms`; });
  requestAnimationFrame(() => requestAnimationFrame(() => items.forEach((elm) => elm.classList.add('up'))));
}

function bootFlanks() {
  buildVitals();
  buildDeck();
  buildWave();
  resolveFlanks();
  refreshSpend(); refreshCommits(); refreshVercel();
  setInterval(() => { refreshSpend(); refreshCommits(); }, 20000);   // ledger + git velocity
  setInterval(refreshVercel, 60000);                                  // deploy eye (heavier read)
}

// ---- doctrine 11: the stage RESOLVES in on launch (never a pop) ----
function resolveIn() { document.getElementById('shell').classList.add('up'); document.getElementById('bg').classList.add('up'); }

// ---- boot ----
paintClock();
paintStatus();
bootFlanks();                               // G2 — Z1 vitals + Z2 deck/audio (resolves in)
voice.boot().then(paintStatus);
wire.boot();
requestAnimationFrame(() => resolveIn());   // trigger the resolve transition after first paint

// ---- render + tick loop ----
let last = performance.now(), t = 0, statusAccum = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  bg.render(t);
  orb.render(dt);
  voice.tick();
  paintClock();
  statusAccum += dt;
  if (statusAccum >= 0.5) { statusAccum = 0; paintStatus(); }   // catch wire-poll / session drift
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// minimal shell harness (self-check / operator screenshot aid)
window.__vulcanStage = {
  core: () => orb.stateName,
  wire: () => wire.status(),
  voice: () => voice.status(),
  ignite: () => { resolveIn(); voice.wake(); },
  bank: () => { voice.goDormant(); if (bridge.requestHide) bridge.requestHide(); },
  vitals: () => JSON.parse(JSON.stringify(VITALS)),   // G2 self-check: current card model
  refreshVitals: () => Promise.all([refreshSpend(), refreshCommits(), refreshVercel()]),
  orb: () => orb._debug,                              // G3 self-check: live orb state model
  orbState: (v) => orb._devVisual(v),                 // G3 self-check: dev-drive a visual state
  orbAmp: (v) => orb.setAmplitude(v),                 // G3 self-check: feed a speaking envelope
};
