// SPEC v1.6 THE STAGE — the v2.1 shell, assembled: near-black stage, adaptive-scale zone
// scaffolding (Z1–Z8, bounded), the always-lit corners, the LIVE TR clock + Z6 status
// strip (G1); the Z1 vitals/directives/documents + Z2 command deck/audio flanks (G2); the
// a5 TWIN HELIX orb (G3); the dispatch lifecycle — chips, states, overlay, vault (G4); and
// the typed intent line into the router (G5). Every zone owns its bounds so nothing can
// collide (§0 adaptive scale law). G6 adds summon-from-hidden plumbing + the polish pass.
//
// The identity organs are UNCHANGED and kept intact: the voice loop (+ wire status) boots
// and runs through this shell, so summon/respond and every IPC path stay live. The real
// a5 orb drives the CORE state read.
import { injectStageVars, stage } from './tokens.js';
import { createBackground } from './background.js';
import { createOrb } from './orb.js';
import { createManual } from './manual.js';   // P2.1 THE MANUAL — spotlight walkthrough
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
// organ's online boolean (real, already in the codebase). HANDS ← real dispatch activity
// (G4): ACTIVE while any command runs or is queued. Each subsystem's dot turns ember when
// it is active. ----
const CORE_LABEL = { idle: 'IDLE', listening: 'LISTENING', thinking: 'WORKING', speaking: 'SPEAKING' };
function setSub(name, text, active) {
  const s = el(`ss-${name}`);
  if (!s) return;
  s.querySelector('.ss-val').textContent = text;
  s.classList.toggle('active', !!active);
}
function paintStatus() {
  const core = orb.stateName;
  // G6.3 · the transcribe read only holds while the orb is still 'thinking' (the ears
  // hand-off); the moment it resolves to speak/listen/idle, clear it so the label moves on
  // and the wave strip settles back to its static dash-block (unless a TTS bar owns it).
  if (capturePhase === 'transcribing' && core !== 'thinking') {
    capturePhase = 'idle';
    const wave = el('aio-wave');
    if (wave && !waveLive) { wave.classList.remove('live', 'capturing'); paintWaveStatic(); }
  }
  setSub('core', CORE_LABEL[core] || 'IDLE', core !== 'idle');
  const ws = wire.status();
  setSub('wire', ws.online ? `LIVE · ${ws.sources} FEED${ws.sources === 1 ? '' : 'S'}` : 'STANDBY', ws.online);
  // HANDS ← real dispatch activity (G4): ACTIVE while any command is running or queued.
  const hands = dispatch.busy();
  setSub('hands', hands ? 'ACTIVE' : 'STANDBY', hands);
  // Z2 AUDIO I/O labels track the REAL audio state. G6.3 · 4 — UNMISSABLE MIC FEEDBACK:
  // capture (Space held, mic open) and its transcribe hand-off outrank speaking, because
  // they're what the operator is doing RIGHT NOW. Otherwise the §4 microcopy is exact:
  // TTS.STANDBY|LIVE and VOICE LINK · STANDBY|SPEAKING.
  const speaking = core === 'speaking';
  const capturing = voice.capturing || capturePhase === 'capturing';
  const transcribing = capturePhase === 'transcribing';
  const aioState = el('aio-state'), aioLink = el('aio-link');
  let sTxt = 'TTS.STANDBY', lTxt = 'STANDBY';
  if (capturing)         { sTxt = 'MIC.CAPTURING'; lTxt = 'CAPTURING'; }
  else if (speaking)     { sTxt = 'TTS.LIVE';      lTxt = 'SPEAKING'; }
  else if (transcribing) { sTxt = 'STT.WORKING';   lTxt = 'TRANSCRIBING'; }
  if (aioState) aioState.textContent = sTxt;
  if (aioLink) aioLink.textContent = lTxt;
  // near-orb listening cue + audio-strip capture styling (doctrine 11 — visible <100ms).
  const shell = document.getElementById('shell');
  if (shell) { shell.classList.toggle('capturing', capturing); shell.classList.toggle('transcribing', transcribing); }
  const cue = el('orb-cue'); if (cue) cue.textContent = capturing ? 'CAPTURING' : (transcribing ? 'TRANSCRIBING' : '');
}

// ---- voice loop + wire (kept intact; the audio path must stay unbroken) ----
const params = new URLSearchParams(location.search);
const forceTest = params.get('voice') === 'test';
const bridge = window.vulcan || {
  async config() { return { hasKey: false, hasWhisper: false, hasEars: false, testMode: forceTest }; },
  async tts() { return { ok: false }; },
  async transcribe() { return { ok: false }; },
  // Browser-only SIM: no Electron main = no vault, no real hands. The dispatch
  // lifecycle still renders end-to-end (chip → filename → overlay) so the shell can
  // be screenshot-audited, but the result is CLEARLY LABELLED SIM and files NOTHING
  // (artifact: null). In the packaged app the real window.vulcan.dispatch runs.
  async dispatch(cmd) {
    return {
      ok: true, cmd, title: `${cmd} · SIM`,
      lines: ['SIM · NO ELECTRON MAIN IN BROWSER', 'REAL HANDS + VAULT RUN IN THE APP'],
      body: `**${cmd}** — SIM dispatch (browser preview).\n\n- No vault artifact is filed in the browser.\n- In the packaged app this runs the real hand and files to \`VULCAN/BONSAI/outputs/\`.`,
      markdown: `# ${cmd} · SIM\n\n> ${cmd} · SIM · [BROWSER PREVIEW]\n\n**No artifact filed** — the real hand + vault run in the app.\n\n## Detail\n\n- SIM · NO ELECTRON MAIN IN BROWSER\n- REAL HANDS + VAULT RUN IN THE APP\n`,
      speak: `Simulated ${cmd}. Real hands and the vault run in the app.`,
      artifact: null, cost_usd: 0, day_total_usd: 0, sim: true,
    };
  },
  openExternal() {},
  // P2 THE CONSOLE — browser-SIM of the workspace hands (no Electron main). Honest,
  // clearly-labelled placeholders so the console can be screenshot/CDP-audited; the
  // real ledger/commits/token/vault run in the packaged app.
  async consoleLedger() { return { ok: true, sim: true, total_usd: 0, cap_usd: 2, calls: [] }; },
  async consoleCommitsList() { return { ok: true, sim: true, list: [] }; },
  async consoleSetVercelToken() { return { ok: false, sim: true, reason: 'NO ELECTRON MAIN (BROWSER)' }; },
  async consoleObjectivesRead() { return { ok: true, sim: true }; },
  async consoleObjectivesWrite(s) { return { ok: true, sim: true, ...(s || {}) }; },
  async consoleDocRead() { return { ok: false, sim: true, text: '' }; },
  // G5 THE INTENT LINE — browser SIM of the conductor path so the typed router runs
  // end-to-end without an Electron main (clearly labelled, executes nothing).
  async conduct(text) {
    return { text: `Simulated route of "${text}". The real router runs in the app.`, route: 'REFLEX', reason: 'NO_BRIDGE', needsConfirm: false, cost_usd: 0, day_total_usd: 0 };
  },
  async confirm() { return { text: 'Simulated — nothing left the machine.', route: 'SKILL', aborted: true, cost_usd: 0 }; },
};
const intentInput = el('intent-input');   // G5 — the > prompt (focus gates PTT vs typing)

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
    case 'bank': bankHide(); return null;
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
  onDismiss: () => bankHide(),
  onCommand: (intent) => runCommand(intent),
  // G5 — the transcript reads BOTH channels: a spoken exchange echoes as YOU · <heard>
  // then V · <answer>, the same log the typed channel writes to. (Dispatch answers echo
  // from speakResult.)
  onAnswer: (answer, transcript) => {
    if (transcript) pushLine('you', transcript);
    if (answer && answer.text) pushLine('v', answer.text, answer.aborted ? 'fail' : '');
  },
  onSession: () => paintStatus(),
});

// P2.1 THE MANUAL — the spotlight tour. Narration speaks each step through the same
// voice. Opened by `?` (input blurred) or by typing/saying "tour"; first-launch offer
// on boot (once, persisted). Declared here so the keyboard controller can reach it.
const manual = createManual({ speak: (t) => voice.say(t, { kind: 'answer' }) });
// P2.2 MANUAL PERMANENCE — the always-visible ? glyph opens the tour (LAW, spec §9).
{ const g = el('manual-glyph'); if (g) g.addEventListener('click', (e) => { e.preventDefault(); manual.open(0); }); }

// ---- IPC (resident overlay control) — kept in lockstep with the voice session ----
if (bridge.onIgnite) bridge.onIgnite(() => { resolveIn(); voice.wake(); });
// Esc / tray Bank / hotkey-toggle bank. If a modal artifact overlay is open, Esc resolves
// THAT first (never a jarring whole-stage bank over an open document). Otherwise bank the
// fire: quench the session, play the resolve-OUT transition, then hide (G6 scope A · 4).
if (bridge.onBank) bridge.onBank(() => {
  const ov = el('overlay');
  if (ov && !ov.hidden) { closeOverlay(); return; }
  voice.goDormant(); bankHide();
});
if (bridge.onMute) bridge.onMute(() => { voice.toggleMute(); paintStatus(); });
if (bridge.onForceHide) bridge.onForceHide(() => { voice.goDormant(); });
if (bridge.onSpeak) bridge.onSpeak((text) => voice.say(text, { kind: 'announce' }));
// §1a backdrop snapshot (ceremony material, exercised fully in G6) — kept intact.
const backdrop = el('backdrop');
if (bridge.onBackdrop) bridge.onBackdrop((url) => { if (backdrop) backdrop.style.backgroundImage = url ? `url(${url})` : 'none'; });

// ---- PUSH-TO-TALK (v1.5.1) + G6.3 TYPE-ANYWHERE ------------------------------------
// The mic opens ONLY while the trigger (Space) is held and the VULCAN window is focused;
// fn is never bound; a blur while held ends the clip cleanly. G6.3 adds the Spotlight
// pattern: with the stage up and the intent line NOT actively being typed into, any
// printable key auto-focuses the intent line and inserts that character. Space stays PTT
// whenever the input is BLURRED or EMPTY; only a NON-EMPTY input turns Space into a typed
// space (spec 3). The controller runs in CAPTURE phase so it is authoritative over the
// input's own keydown (which now only manages Enter/Esc) — no stopPropagation tug-of-war.
const PTT_MODE = rawTokens.voice.capture_mode !== 'open';
const PTT_KEY = rawTokens.voice.ptt_key || 'Space';
const isPttKey = (e) => (PTT_KEY === 'Space' ? e.code === 'Space' : e.key.toLowerCase() === PTT_KEY.toLowerCase());
const DEV_KEYS = params.get('dev') === '1';
let pttHeld = false;

const intentFocused = () => document.activeElement === intentInput;
// Space types a literal space ONLY when the input is focused AND already has content;
// focused-but-empty (or blurred) keeps Space as push-to-talk (spec 3).
const spaceTypes = () => intentFocused() && intentInput.value.length > 0;
// a lone printable character (no command modifiers) — the type-anywhere trigger.
const isPrintable = (e) => e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
const isDevDigit = (e) => e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3';

// ---- capture visual phase (spec 4): CAPTURING → TRANSCRIBING, each visible <100ms ----
let capturePhase = 'idle';   // 'idle' | 'capturing' | 'transcribing'
function setCapturePhase(p) {
  capturePhase = p;
  const wave = el('aio-wave');
  if (wave) {
    wave.classList.toggle('live', p === 'capturing' || waveLive);   // bars come alive with the mic
    wave.classList.toggle('capturing', p === 'capturing');
    if (p === 'idle' && !waveLive) paintWaveStatic();
  }
  paintStatus();             // flip the labels + near-orb cue immediately (never awaits the mic)
}
function beginPtt() {
  if (pttHeld) return;
  pttHeld = true;
  setCapturePhase('capturing');   // UNMISSABLE cue FIRST (doctrine 11), then open the mic
  voice.pttDown();
}
function pttRelease() {
  if (!pttHeld) return;
  pttHeld = false;
  voice.pttUp();
  setCapturePhase('transcribing');
}
// TYPE-ANYWHERE — focus the intent line and land the character at the caret (Spotlight).
function focusIntentAndType(e) {
  e.preventDefault();
  intentInput.focus();
  const start = intentInput.selectionStart ?? intentInput.value.length;
  const end = intentInput.selectionEnd ?? intentInput.value.length;
  intentInput.value = intentInput.value.slice(0, start) + e.key + intentInput.value.slice(end);
  const caret = start + 1;
  try { intentInput.setSelectionRange(caret, caret); } catch (_) {}
}

// master keyboard controller (CAPTURE phase = authoritative). Order: Space→PTT/type,
// then let a focused input own the rest, then type-anywhere, then the stage shortcuts.
window.addEventListener('keydown', (e) => {
  if (PTT_MODE && isPttKey(e)) {
    if (spaceTypes()) return;                 // a typed space inside a non-empty command
    e.preventDefault();                        // never let Space scroll or insert while it's PTT
    if (!e.repeat) beginPtt();
    return;
  }
  if (intentFocused()) return;                 // the input owns every other key while focused
  if (e.key === 'Escape') return;              // Esc is the global bank (do-not-touch)
  // P2.1 — `?` (with the intent line blurred) opens THE MANUAL. Checked before
  // type-anywhere so it never lands a literal '?' in the input.
  if (e.key === '?') { e.preventDefault(); if (manual.isOpen()) manual.close(); else manual.open(); return; }
  // DEV/DEBUG override (?dev=1 only) — 1/2/3 cycle the three a5 orb states. Checked before
  // type-anywhere so the debug digits still drive the orb in dev; off in normal operation.
  if (DEV_KEYS && isDevDigit(e)) {
    if (e.code === 'Digit1') orb._devVisual('idle');
    else if (e.code === 'Digit2') orb._devVisual('working');
    else if (e.code === 'Digit3') orb._devVisual('speaking');
    return;
  }
  if (isPrintable(e)) { focusIntentAndType(e); return; }   // TYPE-ANYWHERE (Spotlight)
}, true);
// release ALWAYS ends a held clip on Space-up (even if a letter made the input non-empty
// mid-hold), so the mic can never wedge open; a pure typed space (no hold) is a no-op.
window.addEventListener('keyup', (e) => {
  if (PTT_MODE && isPttKey(e) && pttHeld) { e.preventDefault(); pttRelease(); }
}, true);
window.addEventListener('blur', pttRelease);

// ---- G6.3 · 2 CLICK ACTIVATES — a click anywhere on the stage that isn't itself an
// interactive control focuses the intent line: with the window already key from summon,
// this hands the keyboard to VULCAN and shows an unmistakable <100ms cue (the caret +
// the prompt's focus glow, Spotlight-style). Interactive controls (deck / chips / overlay
// / objectives / the input) keep their own click behaviour and never steal this. Focusing
// the empty input is safe: Space stays PTT until the operator actually types something.
const INTERACTIVE_SEL = '.deck-cell, .chip, .chip-x, button, a, input, textarea, .ov-doc, [data-close], .obj, .doc.open';
window.addEventListener('mousedown', (e) => {
  const t = e.target;
  if (t && t.closest && t.closest(INTERACTIVE_SEL)) return;
  if (!intentFocused()) intentInput.focus();
});

// ═══ G4 THE LIFECYCLE ═════════════════════════════════════════════════════════
// The dispatch engine: a deck click drives the full §5 lifecycle — QUEUED → task chip
// (◆ + live timer, L-leader to the orb) → CORE·WORKING → CORE·SPEAKING (real voice +
// live audio bars) → the timer becomes the artifact filename (ember-edged, dismissible)
// → idle restore. Concurrency: at most `maxActive` run at once; the rest queue. Every
// dispatch ends in speech or an explicit spoken failure (never-silent), and files a
// real artifact through the Obsidian containment (main-side). Orb state is the
// aggregate read: any speaking → SPEAKING, else any working → WORKING, else the
// session's resting read. Speech is serialized (one mouth) via a promise chain.
const DISP = rawTokens.stage.dispatch || {};
const MAX_ACTIVE = DISP.maxActive || 3;
const OVERLAY_MS = DISP['overlay.ms'] || 420;
document.documentElement.style.setProperty('--st-dispatch-overlay-ms', `${OVERLAY_MS}ms`);

const MAX_DONE = 6;       // soft cap on persistent resolved chips (oldest retires)
const active = [];        // dispatch entries currently running (working|speaking)
const pending = [];       // dispatch entries waiting for a slot (queued)
let seq = 0;
let speechChain = Promise.resolve();   // serialize TTS across concurrent dispatches

const chipsHost = () => el('chips');
const leadersSVG = () => el('leaders');

// deck header + HANDS read follow the live counts. CORE follows the orb (paintStatus).
function refreshDeckHeader() {
  const sub = el('deck-sub'); if (!sub) return;
  const n = active.length, q = pending.length;
  sub.textContent = (n || q) ? `ENGAGED · ${n}/${MAX_ACTIVE} ACTIVE · ${q} QUEUED` : `IDLE · 0/${MAX_ACTIVE} ACTIVE · 0 QUEUED`;
}

// aggregate orb state: dispatch owns the orb while any command is live; otherwise it
// hands back to the voice session's resting read (attentive→listening, else idle).
function refreshOrb() {
  if (active.some((d) => d.phase === 'speaking')) return;   // a speak() owns the orb
  if (active.some((d) => d.phase === 'working')) { orb.setState('thinking'); return; }
  orb.setState(voice.session === 'attentive' ? 'listening' : 'idle');
}

// ---- task chips (Z7) --------------------------------------------------------
function spawnChip(d) {
  const host = chipsHost(); if (!host) return;
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.dataset.id = String(d.id);
  chip.innerHTML = `<span class="chip-mark">◆</span><span class="chip-name">${d.cmd}</span>`
    + `<span class="chip-meta">${d.phase === 'queued' ? 'QUEUED' : '0.0s'}</span>`
    + `<button class="chip-x" title="Dismiss" aria-label="Dismiss">✕</button>`;
  host.appendChild(chip);
  d.chip = chip;
  chip.querySelector('.chip-x').addEventListener('click', (ev) => { ev.stopPropagation(); dismissChip(d); });
  chip.addEventListener('click', () => { if (d.artifact || d.done) openArtifact(d); });
  requestAnimationFrame(() => requestAnimationFrame(() => chip.classList.add('up')));
  drawLeaders();
}
function chipMeta(d, text) { const m = d.chip && d.chip.querySelector('.chip-meta'); if (m) m.textContent = text; }
function tickTimer(d) { if (d.phase === 'working' || d.phase === 'speaking') chipMeta(d, `${((performance.now() - d.t0) / 1000).toFixed(1)}s`); }
function dismissChip(d) {
  if (d.chip) { d.chip.classList.remove('up'); const c = d.chip; setTimeout(() => c.remove(), 260); d.chip = null; }
  const i = done.indexOf(d); if (i >= 0) done.splice(i, 1);
  setTimeout(drawLeaders, 40);
}
const done = [];   // resolved dispatches whose chips persist (filename shown, dismissible)

// L-leader tethers (§5): from each chip's right edge, a short horizontal hop to the
// orb's vertical centreline, then a vertical drop into the rim — an L reaching toward
// the orb (Palantir/Maverick grammar). Chips hug the rim, so every tether is a brief,
// legible hook rather than a long span across the field.
function drawLeaders() {
  const svg = leadersSVG(), field = el('field'); if (!svg || !field) return;
  const fr = field.getBoundingClientRect();
  svg.setAttribute('width', fr.width); svg.setAttribute('height', fr.height);
  svg.setAttribute('viewBox', `0 0 ${fr.width} ${fr.height}`);
  const ox = fr.width / 2, oy = fr.height / 2;                 // orb center (orb-slot is centered)
  const slot = el('orb-slot'); const orbR = slot ? slot.getBoundingClientRect().width / 2 : 120;
  const tx = ox - orbR * 0.9;                                  // vertical run sits just off the rim
  const chips = [...active, ...done].map((d) => d.chip).filter(Boolean);
  let paths = '';
  for (const chip of chips) {
    const cr = chip.getBoundingClientRect();
    const ax = cr.right - fr.left, ay = cr.top + cr.height / 2 - fr.top;   // chip right-center (anchor)
    // L: horizontal from the chip to the rim column, then vertical to the orb centre.
    paths += `<path d="M ${ax.toFixed(1)} ${ay.toFixed(1)} H ${tx.toFixed(1)} V ${oy.toFixed(1)}"/>`;
    paths += `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2"/>`;
  }
  svg.innerHTML = paths;
}

// ---- the lifecycle ----------------------------------------------------------
function dispatchCommand(cmd, cell) {
  if (!cmd) return;
  const d = { id: ++seq, cmd, cell, phase: 'queued', t0: 0, chip: null, artifact: null, done: false, result: null };
  if (cell) { cell.classList.add('busy'); }
  spawnChip(d);
  if (active.length < MAX_ACTIVE) startDispatch(d);
  else { pending.push(d); setCellSub(cell, 'QUEUED', 'queued'); refreshDeckHeader(); paintStatus(); }
}

function setCellSub(cell, text, cls) {
  if (!cell) return;
  cell.classList.remove('queued', 'running');
  if (cls) cell.classList.add(cls);
  const sub = cell.querySelector('.deck-sub'); if (sub) sub.textContent = text;
}

async function startDispatch(d) {
  d.phase = 'working'; d.t0 = performance.now();
  active.push(d);
  setCellSub(d.cell, 'RUNNING', 'running');
  chipMeta(d, '0.0s');
  refreshDeckHeader(); refreshOrb(); paintStatus();

  // run the command main-side (real hand or honest stub); it files the artifact.
  let res;
  try {
    res = bridge.dispatch ? await bridge.dispatch(d.cmd) : null;
  } catch (_) { res = null; }
  if (!res) res = { ok: false, failed: true, title: `${d.cmd} · FAILED`, lines: ['DISPATCH UNAVAILABLE'], speak: `${d.cmd} could not run. Nothing left the machine.`, artifact: null };
  d.result = res; d.artifact = res.artifact || null;

  // speak the result (serialized — one mouth). The dispatch STAYS in 'working' until
  // it is actually its turn at the mouth, so the orb reads WORKING continuously while
  // speech is pending rather than flickering to idle between serialized exchanges.
  speechChain = speechChain.then(() => speakResult(d, res)).catch(() => {});
  await speechChain;

  // resolve: the timer becomes the artifact filename (ember-edged, dismissible).
  finishDispatch(d, res);
}

// CORE·SPEAKING for the duration of the real voice line + live audio bars.
async function speakResult(d, res) {
  d.phase = 'speaking'; refreshOrb();
  audioLive(true);
  pushLine('v', res.speak || 'Done.', res.failed ? 'fail' : '');   // G5 — the result reads in the transcript
  try { await voice.say(res.speak, { kind: 'answer' }); }
  finally { audioLive(false); }
}

function finishDispatch(d, res) {
  const i = active.indexOf(d); if (i >= 0) active.splice(i, 1);
  d.phase = 'idle'; d.done = true;
  if (d.chip) {
    d.chip.classList.add('done');
    if (res.failed) d.chip.classList.add('failed');
    chipMeta(d, res.artifact ? res.artifact.filename : (res.failed ? 'FAILED' : (res.sim ? 'SIM' : 'NO FILE')));
  }
  done.push(d);
  // persistent + dismissible, but soft-capped so the stack never overflows the field:
  // retire the OLDEST done chip beyond the cap (the artifact still lives in the vault +
  // the DOCUMENTS trail — only its transient chip is cleared).
  while (done.length > MAX_DONE) dismissChip(done[0]);
  if (d.cell) { d.cell.classList.remove('busy', 'queued', 'running'); setCellSub(d.cell, '', null); }
  // promote the next queued dispatch into the freed slot.
  if (pending.length && active.length < MAX_ACTIVE) { const nx = pending.shift(); startDispatch(nx); }
  refreshDeckHeader(); refreshOrb(); paintStatus(); drawLeaders();
  if (res.artifact) refreshDocs();   // H1 — the new artifact + daily trace resolve into Z1 DOCUMENTS
}

// ---- audio I/O live bars (§4) ----------------------------------------------
// STANDBY renders the static dash-block; SPEAKING rides the REAL TTS envelope
// (orb.getAmplitude, the same analyser that drives the orb). The tallest crest is
// the single ember accent (heat = the live signal).
const WAVE_PAT = [3, 7, 3, 14, 3, 5, 11, 3, 3, 18, 3, 7, 3, 3, 12, 3, 6, 3, 16, 3, 3, 9, 3, 13, 3, 5, 3, 10];
let waveLive = false;
function audioLive(on) { waveLive = on; const host = el('aio-wave'); if (host) host.classList.toggle('live', on); if (!on) paintWaveStatic(); }
function paintWaveStatic() {
  const host = el('aio-wave'); if (!host) return;
  const bars = host.querySelectorAll('i'); if (!bars.length) return;
  bars.forEach((b, i) => { b.style.height = `${WAVE_PAT[i % WAVE_PAT.length]}px`; b.classList.remove('hot'); });
}
function paintWaveLive(amp) {
  const host = el('aio-wave'); if (!host) return;
  const bars = host.querySelectorAll('i'); if (!bars.length) return;
  const t = performance.now() / 1000;
  bars.forEach((b, i) => {
    // a standing shape modulated by the live envelope — circulation, not RNG jitter.
    const base = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.7 + t * 6.0));
    const h = 3 + base * amp * 22;
    b.style.height = `${h.toFixed(1)}px`;
    b.classList.toggle('hot', h > 16);
  });
}
function tickWave() {
  // SPEAKING rides the TTS envelope; CAPTURING rides the live MIC level (both surface as
  // orb.getAmplitude — the ears feed it while listening, the mouth while speaking).
  if (waveLive || capturePhase === 'capturing') paintWaveLive(Math.max(orb.getAmplitude ? orb.getAmplitude() : 0, 0));
}

// ---- §5.6 document overlay --------------------------------------------------
let overlayDispatch = null;
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = String(md || '').split('\n');
  let html = '', inList = false, inCode = false, code = '';
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (inCode) { html += `<pre><code>${esc(code)}</code></pre>`; code = ''; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { code += `${raw}\n`; continue; }
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    if (line.startsWith('# ')) { closeList(); html += `<h1>${inline(line.slice(2))}</h1>`; }
    else if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (line.startsWith('> ')) { closeList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>`; }
    else if (line.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.slice(2))}</li>`; }
    else if (line.startsWith('---')) { closeList(); html += '<hr>'; }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  if (inCode) html += `<pre><code>${esc(code)}</code></pre>`;
  return html;
}
function openArtifact(d) {
  const ov = el('overlay'); if (!ov || !d.result) return;
  overlayDispatch = d;
  el('ov-eyebrow').textContent = d.result.stub ? 'ARTIFACT · STANDBY' : (d.result.failed ? 'ARTIFACT · FAILED' : 'ARTIFACT');
  el('ov-title').textContent = d.result.title || d.cmd;
  el('ov-body').innerHTML = mdToHtml(d.result.markdown || `# ${d.cmd}\n\n${(d.result.lines || []).map((l) => `- ${l}`).join('\n')}`);
  const file = d.artifact ? d.artifact.rel : 'ARTIFACT NOT FILED';
  el('ov-file').textContent = file;
  const open = el('ov-open');
  if (d.artifact && d.artifact.obsidianUri) { open.style.display = ''; open.dataset.uri = d.artifact.obsidianUri; }
  else { open.style.display = 'none'; }
  ov.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('up')));
}
function closeOverlay() {
  const ov = el('overlay'); if (!ov || ov.hidden) return;
  ov.classList.remove('up');
  overlayDispatch = null;
  setTimeout(() => { ov.hidden = true; }, OVERLAY_MS);
}
(function wireOverlay() {
  const ov = el('overlay'); if (!ov) return;
  ov.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', closeOverlay));
  const open = el('ov-open');
  if (open) open.addEventListener('click', (ev) => {
    ev.preventDefault();
    const uri = open.dataset.uri; if (uri && bridge.openExternal) bridge.openExternal(uri);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.hidden) { e.stopPropagation(); closeOverlay(); } }, true);
})();

// the object paintStatus / the frame loop read for the HANDS + audio reads.
const dispatch = {
  busy: () => active.length > 0 || pending.length > 0,
  counts: () => ({ active: active.length, queued: pending.length }),
  tickFrame: () => { active.forEach(tickTimer); tickWave(); },
};
window.addEventListener('resize', drawLeaders);

// ═══ G5 THE INTENT LINE (Z8) ═══════════════════════════════════════════════════
// A typed channel into the SAME intent router as voice. ONE router, two channels:
// a DETERMINISTIC prefix match first (free, local — maps free text to an existing
// deck command / skill), then the conductor's Haiku classifier (B1 SYNAPSE) for
// anything it doesn't catch. Recognized commands run the FULL G4 lifecycle (chip near
// the orb, states, real speech, artifact, overlay-capable file chip). Inference maps to
// EXISTING skills only and NEVER lowers the write gate: a machine-leaving verb
// (deploy/push/delete/tag/release/send) is ANNOUNCED and HELD until a typed `confirm`
// proceeds through the constitution's existing WRITE_CONFIRM gate. Every path speaks
// (never-silent). Transcript lines resolve in granularly (doctrine 11).
const INTENT = stage.intent || {};
const TRANSCRIPT_MAX = INTENT['transcript.max'] || 7;

// transcript log — newest at the bottom; each line forms from dust, then is capped.
function pushLine(who, text, cls = '') {
  const host = el('transcript'); if (!host || !text) return;
  const line = document.createElement('div');
  line.className = `tline ${who}${cls ? ` ${cls}` : ''}`;
  const label = who === 'you' ? 'YOU' : 'V';
  line.innerHTML = `<span class="who">${label}</span><span class="msg"></span>`;
  line.querySelector('.msg').textContent = text;
  host.appendChild(line);
  while (host.children.length > TRANSCRIPT_MAX) host.removeChild(host.firstChild);
  requestAnimationFrame(() => requestAnimationFrame(() => line.classList.add('up')));
}

// ---- the router: deterministic prefix match → the ten existing deck commands -------
// All ten dispatch runners are READ or DRAFT (dispatch.js), so a match here flows
// freely. Deck match is checked BEFORE the write gate: a safe read that merely mentions
// a verb ("send me the metrics") resolves to its command, never a false HOLD.
const DEPLOY_READ = /\b(status|state|health|up|live|deployed|ok|working|standing|check|reachable|how'?s|is it)\b/;
function matchDeckCommand(text) {
  const t = ` ${String(text).toLowerCase().trim()} `;
  const has = (re) => re.test(t);
  if (has(/\b(deploy|deployment|vercel|prod|production)\b/) && has(DEPLOY_READ)) return 'DEPLOY CHECK';
  if (has(/\bmission brief\b/) || has(/\b(morning|bonsai|daily) brief\b/) || (has(/\bmission\b/) && has(/\bbrief/)) || has(/\bbriefing\b/)) return 'MISSION BRIEF';
  if (has(/\b(wire|headlines?|news|feeds?)\b/)) return 'WIRE SCAN';
  if (has(/\b(metrics?|spend|velocity|numbers|stats|budget|ledger|burn|cap)\b/)) return 'METRICS PULL';
  if (has(/\b(outreach|pilots?|districts?|prospects?)\b/) || (has(/\bemails?\b/) && !has(/\bread\b/))) return 'OUTREACH';
  if (has(/\b(compliance|coppa|ferpa|privacy|posture)\b/)) return 'COMPLIANCE';
  if (has(/\b(pitch|investors?|fundrais|the deck)\b/)) return 'PITCH DESK';
  if (has(/\bvault\b/) && has(/\b(clean|tidy|cleanup|clean up|organi[sz]e|sort)\b/)) return 'VAULT CLEAN';
  if (has(/\b(week|weekly|wk)\b/) && has(/\breview\b/)) return 'WK REVIEW';
  if (has(/\bplan\b/) && has(/\b(today|day|for today)\b/)) return 'PLAN TODAY';
  if (has(/\bmission\b/)) return 'MISSION BRIEF';    // a bare "mission" → the brief
  return null;
}

// a machine-leaving verb NOT already answered by a safe deck read → the write gate.
const GATE_VERB = /\b(deploy|deployment|publish|ship|push|delete|remove|drop|tag|release|send)\b/;
function gatedVerb(text) {
  const t = ` ${String(text).toLowerCase().trim()} `;
  if (DEPLOY_READ.test(t)) return null;              // a status/check read, not an action
  const m = t.match(GATE_VERB);
  return m ? m[1] : null;
}

const deckCellFor = (cmd) => document.querySelector(`.deck-cell[data-cmd="${cmd}"]`);

// speech from the typed channel rides the SAME serialized mouth as dispatch (no overlap).
function queueSpeak(text, kind = 'answer') {
  speechChain = speechChain.then(() => voice.say(text, { kind })).catch(() => {});
  return speechChain;
}

// ---- the write gate: announce + HOLD until a typed confirm -------------------------
let pendingGate = null;   // { text, verb } — a machine-leaving intent awaiting confirm/cancel
const TYPED_CONFIRM = /^\s*(confirm|confirmed|yes|yeah|yep|do it|proceed|go ahead|approve|approved|y)\s*$/i;

function beginGate(text, verb) {
  pendingGate = { text, verb };
  const form = el('intent-form'); if (form) form.classList.add('holding');
  const line = `${verb.toUpperCase()} — ${INTENT.holdLine || 'That leaves the machine. Type confirm to proceed, or cancel.'}`;
  pushLine('v', line, 'hold');
  queueSpeak(line, 'confirm');                       // announce-class — always speaks
}

// resolve a pending HOLD from the operator's TYPED decision. Only an explicit affirmative
// proceeds; anything else cancels (the gate never lowers). A confirm routes THROUGH THE
// EXISTING conductor gate — no new execution path, no lowered gate.
async function resolveGate(text) {
  const g = pendingGate; pendingGate = null;
  const form = el('intent-form'); if (form) form.classList.remove('holding');
  if (!TYPED_CONFIRM.test(text)) {
    const line = INTENT.cancelLine || 'Cancelled — nothing left the machine.';
    pushLine('v', line, 'fail');
    queueSpeak(line, 'confirm');
    return;
  }
  let r = null;
  try { r = await bridge.conduct(g.text); } catch (_) { r = null; }
  if (r && r.needsConfirm && bridge.confirm) {
    let fr = null;
    try { fr = await bridge.confirm({ skill: r.skill, action: r.action, detail: r.detail, decision: 'confirm' }); } catch (_) { fr = null; }
    const spoken = (fr && fr.text) || 'Done.';
    pushLine('v', spoken, fr && fr.aborted ? 'fail' : '');
    queueSpeak(spoken, 'confirm');
  } else {
    // no concrete WRITE hand exists for this verb yet — honest, nothing executed.
    const line = INTENT.noHandLine || 'There is no hand wired for that yet — nothing left the machine.';
    pushLine('v', line, 'fail');
    queueSpeak(line, 'confirm');
  }
}

// ---- existing router behavior: the conductor (Haiku + deterministic skill) speaks ----
async function conductAndSpeak(text) {
  let r = null;
  try { r = await bridge.conduct(text); } catch (_) { r = null; }
  if (r && r.needsConfirm) {                          // a WRITE_CONFIRM slipped the verb guard → HOLD
    pendingGate = { text, verb: String(r.action || 'write') };
    const form = el('intent-form'); if (form) form.classList.add('holding');
    const line = r.text || (INTENT.holdLine || 'That leaves the machine. Type confirm to proceed, or cancel.');
    pushLine('v', line, 'hold');
    queueSpeak(line, 'confirm');
    return;
  }
  const spoken = (r && r.text) || (INTENT.clarifyLine || "I didn't catch a command.");
  pushLine('v', spoken, r ? '' : 'fail');
  queueSpeak(spoken, 'answer');
}

// ---- submit: the one entry point for typed intent ---------------------------------
function submitIntent(raw) {
  const text = String(raw || '').trim();
  if (!text) return;
  pushLine('you', text);
  if (/^(tour|help|manual|guide)$/i.test(text)) { pushLine('v', 'Opening the tour.'); manual.open(); return; }   // P2.1 THE MANUAL
  if (pendingGate) { resolveGate(text); return; }    // a HOLD is open → this is the decision
  const cmd = matchDeckCommand(text);
  if (cmd) {                                          // recognized command → FULL G4 lifecycle
    pushLine('v', `INFERRED ${cmd} → DISPATCHING`);
    dispatchCommand(cmd, deckCellFor(cmd));
    return;
  }
  const verb = gatedVerb(text);
  if (verb) { beginGate(text, verb); return; }        // machine-leaving, no safe hand → HOLD
  conductAndSpeak(text);                               // existing router behavior (Haiku + skill)
}

// ---- input wiring: Enter submits · Esc blurs · Space types (never PTT while focused) ----
(function wireIntent() {
  const form = el('intent-form'); if (!form || !intentInput) return;
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = intentInput.value; intentInput.value = ''; submitIntent(v); });
  // The master window controller (capture phase) already decides Space (PTT vs typed) and
  // routes every other key to the focused input; here the input only needs Esc → blur.
  // Enter is the form submit. No stopPropagation — the controller ran first and yielded.
  intentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); intentInput.blur(); }
  });
})();

// ═══ G2 THE FLANKS ═══════════════════════════════════════════════════════════
// Z1 SYSTEM VITALS (real wires: Claude spend·B0, Vercel·B5R, GH commits·B2 + one
// TODO'd placeholder), and Z2 COMMAND DECK + AUDIO I/O. All content resolves in
// staggered on mount (doctrine 11). A deck click dispatches through the full G4
// lifecycle (chips/queue/states/overlay).

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
  // WAITLIST is HAND-ENTERED (no live signup feed yet). Default is an honest dash — VULCAN
  // never shows an unsourced number as real. The operator sets it in the WAITLIST workspace;
  // once set it reads the figure + `MANUAL · <date>` (refreshWaitlist, P3).
  waitlist: { label: 'WAITLIST', num: '—', unit: '', delta: 'NO SOURCE', mk: '', spark: [] },
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
// doctrine 11: a card is painted on mount (placeholder), then its LIVE value resolves in
// place on the first real read + any later change — never a snap from a dash to a number.
function updateCard(k) {
  const node = el(`vc-${k}`); if (!node) return;
  const html = cardInner(VITALS[k]);
  if (node.innerHTML === html) return;                 // nothing changed → no reflow
  const first = !node.dataset.filled;
  node.innerHTML = html; node.dataset.filled = '1';
  if (!first) {                                        // a live refresh resolves in (granular)
    node.classList.remove('reflow'); void node.offsetWidth; node.classList.add('reflow');
  }
}
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
// P3 — the hand-entered waitlist figure. If set, the card reads the number + `MANUAL · <date>`
// so it is never mistaken for a live read; if unset, the honest `— / NO SOURCE` default holds.
async function refreshWaitlist() {
  if (!bridge.consoleWaitlistRead) return;
  try {
    const w = await bridge.consoleWaitlistRead(); if (!w) return;
    if (w.value !== null && w.value !== undefined && w.value !== '') {
      VITALS.waitlist.num = String(w.value);
      VITALS.waitlist.delta = w.at ? `MANUAL · ${w.at}` : 'MANUAL';
      VITALS.waitlist.mk = '';
      VITALS.waitlist.spark = [];
    } else {
      VITALS.waitlist.num = '—';
      VITALS.waitlist.delta = 'NO SOURCE';
      VITALS.waitlist.spark = [];
    }
    updateCard('waitlist');
  } catch (_) { /* keep the honest default */ }
}

// ---- Z1 DOCUMENTS · VAULT TRAIL (H1 THE LEDGER) — the real newest BONSAI/outputs/
// artifacts + today's daily file, with TRUE ages. Rows resolve in (doctrine 11) and open
// in the vault on click (the same obsidian:// handoff as the overlay). Fail-soft: no
// bridge (browser SIM) or no vault → an honest empty read, never fake rows. ----
function docAge(ms) {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return 'JUST NOW';
  const m = s / 60; if (m < 60) return `${Math.round(m)}M AGO`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}H AGO`;
  return `${Math.round(h / 24)}D AGO`;
}
function renderDocs(docs) {
  const host = el('docs'); if (!host) return;
  if (!docs.length) {
    host.innerHTML = `<div class="doc empty rin"><span class="doc-name">NO ARTIFACTS YET</span></div>`;
    return;
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  host.innerHTML = docs.map((d) => {
    const openable = !!d.obsidianUri;
    return `<div class="doc${openable ? ' open' : ''}"${openable ? ` data-uri="${esc(d.obsidianUri)}"` : ''} title="${esc(d.name)}">`
      + `<span class="doc-name">${d.daily ? '▪ ' : ''}${esc(String(d.name).toUpperCase())}</span>`
      + `<span class="doc-age">${docAge(d.ageMs)}</span></div>`;
  }).join('');
  const rows = [...host.querySelectorAll('.doc')];
  rows.forEach((n, i) => { n.style.animationDelay = `${i * 40}ms`; n.classList.add('rin'); });   // staggered resolve-in
  rows.forEach((n) => { if (n.dataset.uri) n.addEventListener('click', () => { if (bridge.openExternal) bridge.openExternal(n.dataset.uri); }); });
}
async function refreshDocs() {
  if (!bridge.vitalsDocuments) return;
  try {
    const r = await bridge.vitalsDocuments(); if (!r) return;
    renderDocs(r.docs || []);
  } catch (_) { /* keep last trail */ }
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
    `<div class="deck-cell rz" data-cmd="${name}"><span class="deck-dot"></span><span class="deck-label">${name}</span><span class="deck-sub"></span><span class="deck-arrow">→</span></div>`).join('');
  // G4 — click dispatches the command through the full lifecycle (§5). No Space/Enter
  // key binding: Space is the PTT trigger and must never be shadowed by a focused cell.
  host.querySelectorAll('.deck-cell').forEach((cell) =>
    cell.addEventListener('click', () => dispatchCommand(cell.dataset.cmd, cell)));
}

// AUDIO I/O — a STATIC mixed dash-block waveform (short bars = dashes, tall = blocks) at
// rest; while speaking the bars ride the real TTS envelope (paintWaveLive, G4). Fixed
// pattern (no RNG) so the resting read is stable.
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
  refreshSpend(); refreshCommits(); refreshVercel(); refreshDocs(); refreshWaitlist();
  setInterval(() => { refreshSpend(); refreshCommits(); refreshDocs(); }, 20000);   // ledger + git velocity + vault trail
  setInterval(refreshVercel, 60000);                                  // deploy eye (heavier read)
}

// ---- doctrine 11: the stage RESOLVES in on launch (never a pop) ----
function resolveIn() { document.getElementById('shell').classList.add('up'); document.getElementById('bg').classList.add('up'); }
// bank resolve-OUT — the shell dissolves (opacity + blur, the reverse of resolveIn) over the
// resolve band, THEN the window hides. No hard cut on bank (doctrine 11 + G6 scope A · 4).
function resolveOut(done) {
  document.getElementById('shell').classList.remove('up');
  document.getElementById('bg').classList.remove('up');
  setTimeout(() => { if (done) done(); }, stage['resolve.ms'] || 560);
}
function bankHide() { resolveOut(() => { if (bridge.requestHide) bridge.requestHide(); }); }

// ---- G6: the BL hint documents the global summon chord, rendered from the ignition.hotkey
// token (doctrine 10 — never hardcode the chord). "Alt+Command+V" -> "⌥⌘V". ----
function hotkeyGlyphs(spec) {
  const G = { command: '⌘', cmd: '⌘', commandorcontrol: '⌘', meta: '⌘', super: '⌘',
              control: '⌃', ctrl: '⌃', alt: '⌥', option: '⌥', shift: '⇧' };
  return String(spec || '').split('+').map((k) => {
    const key = k.trim().toLowerCase();
    return G[key] || (key === 'space' ? 'SPACE' : k.trim().toUpperCase());
  }).join('');
}
{ const h = el('hint-summon'); if (h) h.textContent = hotkeyGlyphs(rawTokens.ignition.hotkey); }

// ═══ P2 THE CONSOLE ═══════════════════════════════════════════════════════════
// Nothing on the stage stays inert. Every vitals card, directive, objective, document
// row, and the audio panel opens a CENTER-STAGE WORKSPACE in the existing overlay
// chrome (Doctrine 11, Esc closes), each with REAL wired actions. All actions are
// READ or CONTAINED/LOCAL — nothing pushes, deploys, or leaves the machine without the
// write gate. The workspace reuses #overlay: eyebrow + title + a custom body (content
// + an actions row); the artifact foot (file/open-in-vault) is hidden for workspaces.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// open a workspace. cfg: { eyebrow, title, html, actions:[{label,cls,run}], onOpen }.
function openWorkspace(cfg) {
  const ov = el('overlay'); if (!ov) return;
  overlayDispatch = null;                          // a workspace is not an artifact
  el('ov-eyebrow').textContent = cfg.eyebrow || 'WORKSPACE';
  el('ov-title').textContent = cfg.title || '';
  const actions = (cfg.actions || []).filter(Boolean);
  const actionsHTML = actions.length
    ? `<div class="ws-actions">${actions.map((a, i) => `<button class="ws-btn${a.cls ? ` ${a.cls}` : ''}" data-ws-act="${i}">${esc(a.label)}</button>`).join('')}</div>`
    : '';
  el('ov-body').innerHTML = `<div class="ws">${cfg.html || ''}${actionsHTML}</div>`;
  // the artifact foot is meaningless for a workspace — blank the file, hide open-in-vault.
  el('ov-file').textContent = cfg.foot || '';
  const open = el('ov-open'); if (open) open.style.display = 'none';
  // wire action buttons
  el('ov-body').querySelectorAll('[data-ws-act]').forEach((btn) => {
    const a = actions[+btn.dataset.wsAct];
    btn.addEventListener('click', async (e) => { e.preventDefault(); try { await a.run({ btn, ws: el('ov-body') }); } catch (_) {} });
  });
  ov.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('up')));
  if (cfg.onOpen) { try { cfg.onOpen(el('ov-body')); } catch (_) {} }
}

// small helpers for workspace bodies
const kv = (k, v) => `<div class="ws-row"><span class="ws-k">${esc(k)}</span><span class="ws-v">${esc(v)}</span></div>`;
const note = (t) => `<p class="ws-note">${esc(t)}</p>`;
function speakWs(text) { queueSpeak(text, 'answer'); pushLine('v', text); }

// ---- SPEND workspace: per-dispatch ledger + cap -------------------------------
async function wsSpend() {
  openWorkspace({ eyebrow: 'VITALS · WORKSPACE', title: 'CLAUDE SPEND', html: note('Reading the governor ledger…') });
  const r = bridge.consoleLedger ? await bridge.consoleLedger() : null;
  const body = el('ov-body'); if (!body) return;
  if (!r || !r.ok) { body.querySelector('.ws').innerHTML = note('Ledger unavailable.'); return; }
  const rows = r.calls.length
    ? `<div class="ws-table">${r.calls.map((c) => `<div class="ws-trow"><span>${esc(c.model)}</span><span>${c.in}/${c.out} tok</span><span class="ws-usd">$${(c.usd || 0).toFixed(4)}</span></div>`).join('')}</div>`
    : note(r.sim ? 'SIM — the real per-dispatch ledger runs in the app.' : 'No metered calls yet today.');
  const pct = Math.min(100, Math.round((r.total_usd / (r.cap_usd || 2)) * 100));
  body.querySelector('.ws').innerHTML =
    kv('SPENT TODAY', `$${r.total_usd.toFixed(4)}`) + kv('DAILY CAP', `$${(r.cap_usd || 2).toFixed(2)}`) + kv('USED', `${pct}%`)
    + `<div class="ws-bar"><i style="width:${pct}%"></i></div>`
    + `<div class="ws-sub">METERED CALLS · ${r.calls.length}</div>` + rows;
}

// ---- COMMITS workspace: recent commits + commit-digest dispatch ---------------
async function wsCommits() {
  openWorkspace({
    eyebrow: 'VITALS · WORKSPACE', title: 'GH COMMITS', html: note('Reading git…'),
    actions: [{ label: 'FILE COMMIT DIGEST', cls: 'primary', run: async ({ btn }) => {
      btn.disabled = true; btn.textContent = 'FILING…';
      let r = null; try { r = await bridge.conduct('commit digest'); } catch (_) {}
      speakWs((r && r.text) || 'Commit digest filed.'); refreshDocs();
      btn.textContent = 'DIGEST FILED ✓';
    } }],
  });
  const r = bridge.consoleCommitsList ? await bridge.consoleCommitsList() : null;
  const ws = el('ov-body') && el('ov-body').querySelector('.ws'); if (!ws) return;
  const list = (r && r.list && r.list.length)
    ? `<div class="ws-table">${r.list.map((c) => `<div class="ws-trow"><span class="ws-hash">${esc(c.hash)}</span><span class="ws-date">${esc(c.date)}</span><span class="ws-subj">${esc(c.subject)}</span></div>`).join('')}</div>`
    : note(r && r.sim ? 'SIM — recent commits + the digest run in the app.' : 'No recent commits.');
  ws.insertAdjacentHTML('afterbegin', list + `<div class="ws-sub">RECENT COMMITS</div>`);
}

// ---- VERCEL workspace: SET TOKEN (writes .env locally, announce+confirm) + status + deploy-check ----
async function wsVercel() {
  const v = bridge.vitalsVercel ? await bridge.vitalsVercel().catch(() => null) : null;
  const statusHtml = v
    ? kv('STATE', v.primary || 'N/C') + kv('DETAIL', v.sub || '') + (v.url ? kv('URL', v.url) : '')
    : note('Deploy status unavailable.');
  openWorkspace({
    eyebrow: 'VITALS · WORKSPACE', title: 'VERCEL DEPLOY',
    html: statusHtml
      + `<div class="ws-sub">SET TOKEN</div>`
      + note('Paste a Vercel token to connect the deploy eye. It is written to your local .env only — it never leaves the machine.')
      + `<div class="ws-field"><input class="ws-input" id="ws-vercel-token" type="password" placeholder="VERCEL TOKEN" spellcheck="false" autocomplete="off" /></div>`,
    actions: [
      { label: 'SAVE TOKEN', cls: 'primary', run: async ({ btn, ws }) => {
        const inp = ws.querySelector('#ws-vercel-token'); const tok = inp && inp.value.trim();
        if (!tok) { btn.textContent = 'ENTER A TOKEN'; return; }
        btn.disabled = true; btn.textContent = 'SAVING…';
        let r = null; try { r = await bridge.consoleSetVercelToken(tok); } catch (_) {}
        if (r && r.ok) { if (inp) inp.value = ''; btn.textContent = 'SAVED ✓'; refreshVercel(); speakWs('Vercel token set and saved locally. Nothing left the machine.'); }
        else { btn.disabled = false; btn.textContent = r && r.sim ? 'APP-ONLY (SIM)' : 'SAVE FAILED'; }
      } },
      { label: 'DEPLOY CHECK', run: async () => { closeOverlay(); dispatchCommand('DEPLOY CHECK', deckCellFor('DEPLOY CHECK')); } },
    ],
  });
}

// ---- WAITLIST workspace: HONEST manual entry (no live source yet) -------------
// There is no live signup feed. Rather than show an unsourced number, the operator
// enters the real figure by hand; it is persisted to the vault and always stamped
// MANUAL + today's date so it can never be mistaken for a live read. CLEAR returns the
// card to the honest `— / NO SOURCE` default.
async function wsWaitlist() {
  const w = bridge.consoleWaitlistRead ? await bridge.consoleWaitlistRead().catch(() => null) : null;
  const hasVal = w && w.value !== null && w.value !== undefined && w.value !== '';
  const cur = hasVal ? String(w.value) : '—';
  const curNote = (w && w.note) || '';
  const stamp = hasVal ? `MANUAL · ${w.at || ''}`.trim() : 'NOT SET';
  openWorkspace({
    eyebrow: 'VITALS · WORKSPACE', title: 'WAITLIST',
    html: kv('CURRENT', cur) + kv('SOURCE', stamp)
      + note('No live signup feed is wired yet. Enter the real figure by hand — it is labelled MANUAL with today’s date so it is never mistaken for a live read. Saved to the vault; survives restarts.')
      + `<div class="ws-sub">SET MANUAL FIGURE</div>`
      + `<div class="ws-field"><input class="ws-input" id="ws-wl-num" inputmode="numeric" placeholder="WAITLIST COUNT" spellcheck="false" autocomplete="off" value="${hasVal ? esc(cur) : ''}" /></div>`
      + `<div class="ws-field"><input class="ws-input" id="ws-wl-note" placeholder="NOTE (OPTIONAL)" spellcheck="false" autocomplete="off" value="${esc(curNote)}" /></div>`,
    actions: [
      { label: 'SAVE FIGURE', cls: 'primary', run: async ({ btn, ws }) => {
        const numInp = ws.querySelector('#ws-wl-num');
        const noteInp = ws.querySelector('#ws-wl-note');
        const raw = numInp && numInp.value.trim();
        const n = raw ? parseInt(raw.replace(/[,\s]/g, ''), 10) : NaN;
        if (!Number.isFinite(n) || n < 0) { btn.textContent = 'ENTER A NUMBER'; return; }
        btn.disabled = true; btn.textContent = 'SAVING…';
        // stamp with the operator's own local date (the same clock the corner shows).
        const now = new Date();
        const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let r = null; try { r = await bridge.consoleWaitlistWrite({ value: n, note: (noteInp && noteInp.value.trim()) || '', at }); } catch (_) {}
        if (r && r.ok) { btn.textContent = 'SAVED ✓'; refreshWaitlist(); speakWs(`Waitlist set to ${n}, marked manual.`); }
        else { btn.disabled = false; btn.textContent = 'SAVE FAILED'; }
      } },
      { label: 'CLEAR', run: async ({ btn }) => {
        btn.disabled = true; btn.textContent = 'CLEARING…';
        try { await bridge.consoleWaitlistWrite({ value: null, note: '' }); } catch (_) {}
        refreshWaitlist(); closeOverlay(); speakWs('Waitlist figure cleared.');
      } },
    ],
  });
}

// ---- AUDIO I/O workspace: status + test-voice --------------------------------
function wsAudio() {
  const s = voice.status();
  openWorkspace({
    eyebrow: 'AUDIO · WORKSPACE', title: 'AUDIO I/O',
    html: kv('VOICE', s.online ? (s.local ? 'LOCAL' : 'ONLINE') : 'OFFLINE')
      + kv('EARS', s.ears ? 'READY' : 'NONE')
      + kv('MUTED', s.muted ? 'YES' : 'NO')
      + note('Hold Space anywhere to talk; Esc stops. Test the voice below.'),
    actions: [{ label: 'TEST VOICE', cls: 'primary', run: () => { voice.say('VULCAN online. Voice link nominal.', { kind: 'answer' }); } }],
  });
}

// ---- DOCUMENTS workspace: open in vault · summarize-aloud · draft follow-up ----
function summarize(md, name) {
  const lines = String(md || '').split('\n').map((l) => l.trim());
  const h1 = (lines.find((l) => l.startsWith('# ')) || `# ${name}`).replace(/^#\s+/, '');
  const quote = lines.find((l) => l.startsWith('> '));
  const para = lines.find((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('-') && !l.startsWith('*') && !l.startsWith('```'));
  const bullets = lines.filter((l) => l.startsWith('- ')).length;
  const parts = [`${h1}.`];
  if (quote) parts.push(quote.replace(/^>\s+/, '').replace(/\*\*/g, ''));
  else if (para) parts.push(para.replace(/\*\*/g, ''));
  if (bullets) parts.push(`${bullets} point${bullets === 1 ? '' : 's'}.`);
  return parts.join(' ');
}
function wsDocument(docName, uri) {
  openWorkspace({
    eyebrow: 'DOCUMENT · WORKSPACE', title: String(docName).toUpperCase(),
    html: kv('ARTIFACT', docName) + note('Open it in the vault, hear a summary, or draft a follow-up (drafts only — nothing is sent).'),
    actions: [
      uri ? { label: 'OPEN IN VAULT ↗', cls: 'primary', run: () => { if (bridge.openExternal) bridge.openExternal(uri); } } : null,
      { label: 'SUMMARIZE ALOUD', run: async ({ btn }) => {
        btn.disabled = true; btn.textContent = 'READING…';
        let r = null; try { r = bridge.consoleDocRead ? await bridge.consoleDocRead(docName) : null; } catch (_) {}
        if (r && r.ok && r.text) { speakWs(summarize(r.text, docName)); btn.textContent = 'SUMMARIZED ✓'; }
        else { btn.textContent = r && r.sim ? 'APP-ONLY (SIM)' : 'UNREADABLE'; }
      } },
      { label: 'DRAFT FOLLOW-UP', run: async ({ btn }) => {
        btn.disabled = true; btn.textContent = 'DRAFTING…';
        let r = null; try { r = await bridge.conduct(`follow up re: ${docName}`); } catch (_) {}
        speakWs((r && r.text) || 'Follow-up drafted and held in the vault.'); refreshDocs();
        btn.textContent = 'DRAFTED ✓';
      } },
    ],
  });
}

// ---- DIRECTIVES + LAUNCH OBJECTIVES: editable, vault-persisted ----------------
let consoleState = null;   // { directives:[{text,done}], objectives:[{text,done}] }
function renderList(hostId, key, rowCls) {
  const host = el(hostId); if (!host || !consoleState) return;
  const items = consoleState[key] || [];
  host.innerHTML = items.map((d, i) =>
    `<div class="${rowCls}${d.done ? ' done' : ''}" data-k="${key}" data-i="${i}"><span class="dir-box${d.done ? ' done' : ''}"></span><span class="dir-text">${esc(d.text)}</span></div>`).join('');
}
function renderObjectives() { renderList('dirs', 'directives', 'dir'); renderList('objs', 'objectives', 'obj'); }
async function persistObjectives() {
  if (!bridge.consoleObjectivesWrite) return;
  try { await bridge.consoleObjectivesWrite(consoleState); } catch (_) {}
}
async function loadObjectives() {
  let s = null;
  try { s = bridge.consoleObjectivesRead ? await bridge.consoleObjectivesRead() : null; } catch (_) {}
  if (!s || (!s.directives && !s.objectives)) {
    // browser SIM / first run → seed from the DOM's static rows so the console isn't blank.
    const grab = (id, cls) => [...(el(id) ? el(id).querySelectorAll('.' + cls) : [])].map((n) => ({ text: n.querySelector('.dir-text').textContent, done: n.classList.contains('done') }));
    s = { directives: grab('dirs', 'dir'), objectives: grab('objs', 'obj') };
  }
  consoleState = { directives: s.directives || [], objectives: s.objectives || [] };
  renderObjectives();
}
// the editor workspace for a list (directives | objectives)
function wsEditList(key, title) {
  const items = (consoleState && consoleState[key]) || [];
  const rows = items.map((d, i) =>
    `<div class="ws-edit" data-i="${i}"><button class="ws-tick${d.done ? ' on' : ''}" data-act="toggle" title="Toggle">${d.done ? '✓' : ''}</button>`
    + `<input class="ws-input ws-edit-in" data-act="text" value="${esc(d.text)}" spellcheck="false" />`
    + `<button class="ws-del" data-act="del" title="Remove">✕</button></div>`).join('');
  openWorkspace({
    eyebrow: 'CONSOLE · EDIT', title,
    html: `<div class="ws-editlist">${rows || note('Empty — add one below.')}</div>`
      + `<div class="ws-field"><input class="ws-input" id="ws-add" placeholder="ADD ${title}…" spellcheck="false" /></div>`
      + note('Edits persist to the vault and survive restarts. Toggle the tick to mark done.'),
    actions: [
      { label: 'ADD', run: async ({ ws }) => { const inp = ws.querySelector('#ws-add'); const v = inp && inp.value.trim(); if (!v) return; consoleState[key].push({ text: v, done: false }); await persistObjectives(); renderObjectives(); wsEditList(key, title); } },
      { label: 'SAVE & CLOSE', cls: 'primary', run: async ({ ws }) => { syncEdits(ws, key); await persistObjectives(); renderObjectives(); closeOverlay(); speakWs(`${title} saved.`); } },
    ],
    onOpen: (body) => {
      body.querySelectorAll('.ws-edit').forEach((row) => {
        const i = +row.dataset.i;
        row.querySelector('[data-act="toggle"]').addEventListener('click', (e) => { e.preventDefault(); consoleState[key][i].done = !consoleState[key][i].done; const b = e.currentTarget; b.classList.toggle('on', consoleState[key][i].done); b.textContent = consoleState[key][i].done ? '✓' : ''; });
        row.querySelector('[data-act="del"]').addEventListener('click', async (e) => { e.preventDefault(); syncEdits(body, key); consoleState[key].splice(i, 1); await persistObjectives(); renderObjectives(); wsEditList(key, title); });
      });
    },
  });
}
function syncEdits(body, key) {
  body.querySelectorAll('.ws-edit').forEach((row) => { const i = +row.dataset.i; const inp = row.querySelector('[data-act="text"]'); if (consoleState[key][i] && inp) consoleState[key][i].text = inp.value.trim(); });
}

// ---- click wiring (event delegation — survives innerHTML rebuilds) ------------
function wireConsole() {
  const vitals = el('vitals');
  if (vitals) vitals.addEventListener('click', (e) => {
    const card = e.target.closest('.vcard'); if (!card) return;
    const id = card.id.replace('vc-', '');
    ({ spend: wsSpend, commits: wsCommits, vercel: wsVercel, waitlist: wsWaitlist })[id]?.();
  });
  el('dirs') && el('dirs').addEventListener('click', () => wsEditList('directives', 'DIRECTIVES'));
  el('objs') && el('objs').addEventListener('click', () => wsEditList('objectives', 'LAUNCH OBJECTIVES'));
  // AUDIO I/O panel → workspace (the section around the wave).
  const aio = el('aio-wave'); const aioSec = aio && aio.closest('.fsec');
  if (aioSec) { aioSec.classList.add('ws-open'); aioSec.addEventListener('click', (e) => { if (e.target.closest('.deck-cell')) return; wsAudio(); }); }
  // DOCUMENTS rows now open a document workspace (was: straight open-in-vault).
  const docs = el('docs');
  if (docs) docs.addEventListener('click', (e) => {
    const row = e.target.closest('.doc'); if (!row || row.classList.contains('empty')) return;
    e.stopImmediatePropagation();
    wsDocument(row.querySelector('.doc-name').textContent.replace(/^▪\s*/, ''), row.dataset.uri || '');
  }, true);   // capture: intercept before renderDocs' own row handler
}

// ═══ boot ═══
// ---- boot ----
paintClock();
paintStatus();
bootFlanks();                               // G2 — Z1 vitals + Z2 deck/audio (resolves in)
wireConsole();                              // P2 — clickable workspaces on every surface
loadObjectives();                           // P2 — editable, vault-persisted directives/objectives
setTimeout(() => manual.maybeOfferFirstLaunch(), 1400);   // P2.1 — one-time first-launch tour offer
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
  dispatch.tickFrame();   // G4 — chip timers + live audio bars
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
  bank: () => { voice.goDormant(); bankHide(); },
  vitals: () => JSON.parse(JSON.stringify(VITALS)),   // G2 self-check: current card model
  refreshVitals: () => Promise.all([refreshSpend(), refreshCommits(), refreshVercel()]),
  orb: () => orb._debug,                              // G3 self-check: live orb state model
  orbState: (v) => orb._devVisual(v),                 // G3 self-check: dev-drive a visual state
  orbAmp: (v) => orb.setAmplitude(v),                 // G3 self-check: feed a speaking envelope
  dispatch: (cmd) => dispatchCommand(cmd, document.querySelector(`.deck-cell[data-cmd="${cmd}"]`)),  // G4 self-check
  dispatchCounts: () => dispatch.counts(),            // G4 self-check: active/queued
  openLatest: () => { const d = done[done.length - 1] || active[active.length - 1]; if (d) openArtifact(d); },  // G4 self-check: overlay
  intent: (text) => submitIntent(text),               // G5 self-check: submit a typed intent
  route: (text) => ({ cmd: matchDeckCommand(text), verb: gatedVerb(text) }),  // G5 self-check: router read
  holding: () => !!pendingGate,                       // G5 self-check: is a write gate open
  transcript: () => [...document.querySelectorAll('#transcript .tline')].map((n) => n.textContent),
  // G6.3 THE FOCUS — self-checks. hasFocus: does the renderer's window own the keyboard
  // (proxy for key-window). capture: the visible capture phase. audioLabels: the AUDIO I/O
  // read. ptt: drive the trigger the way Space does (the OS-key acceptance stays the
  // operator's hands). typeAnywhere: exercise the Spotlight insert path.
  hasFocus: () => document.hasFocus(),
  capture: () => capturePhase,
  audioLabels: () => ({ state: (el('aio-state') || {}).textContent, link: (el('aio-link') || {}).textContent }),
  intentState: () => ({ focused: intentFocused(), value: intentInput.value }),
  ptt: (down) => { if (down) beginPtt(); else pttRelease(); },
  typeAnywhere: (ch) => focusIntentAndType({ key: ch, preventDefault() {} }),
  // P2 THE CONSOLE / P2.1 THE MANUAL self-checks.
  openWorkspace: (which) => ({ spend: wsSpend, commits: wsCommits, vercel: wsVercel, waitlist: wsWaitlist, audio: wsAudio }[which] || (() => {}))(),
  objectives: () => JSON.parse(JSON.stringify(consoleState || {})),
  manual: () => manual.isOpen(),
  openManual: (i) => manual.open(i || 0),
  closeManual: () => manual.close(),
};
