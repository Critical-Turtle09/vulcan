// THE VOICE — the session organ (v1.5 THE ATTENDANT). One-utterance-per-wake is
// STRUCK. VULCAN now holds a HOT SESSION:
//
//   DORMANT   — resident; the ears listen for the WAKE PHRASE ONLY. Orb rests idle.
//   ATTENTIVE — a hot session: the mic is open and EVERY utterance is a
//               question/command. capture -> conduct -> present + speak -> BACK TO
//               LISTENING, repeatedly, with NO re-wake between exchanges.
//
// "Fire and Forge" -> ATTENTIVE. "Bank the fire" / "Stand down" (or Esc/tray) ->
// DORMANT. After voice.session.idle_to_dormant_min minutes of silence in ATTENTIVE,
// VULCAN speaks one line and auto-banks to DORMANT.
//
// Every stage change is an orb.setState() into the orb's own lerp — the whole loop
// is one continuous material reorganization (doctrine 11). The SPEAK-GATE hard-closes
// the ears while VULCAN speaks (self-hear forbidden) and the ears re-acquire a clean
// capture graph each listen — the v1.4 real-ears re-summon defect is fixed at the
// source (see EARS-ROOT-CAUSE-v1.5.md).
//
// Fail-soft: without a working ear (whisper) AND mouth (ElevenLabs key), the loop
// stays down and reports VOICE OFFLINE; keys 1-4 keep driving the orb regardless.
import rawTokens from '../../tokens.json';
import { createEars } from './ears.js';
import { createBrain } from './brain.js';
import { createMouth } from './mouth.js';
import { classify } from '../reflex.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// B2 HANDS — the spoken-confirmation classifier for WRITE_CONFIRM. Only an
// explicit affirmative proceeds; ANYTHING else (including silence/garble) aborts.
export function classifyConfirm(t) {
  // FX2 — normalize (strip a polished transcript's punctuation) before the affirmative test.
  const s = String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(confirm|confirmed|yes|yeah|yep|do it|proceed|affirmative|go ahead|approve|approved)\b/.test(s)) return 'confirm';
  return 'cancel';
}

export function createVoice({ orb, bridge, forceTest = false, onWake = null, onDismiss = null, onCommand = null, onAnswer = null, onSession = null }) {
  let running = false, cfg = null, ears = null, mouth = null, brain = createBrain({ bridge });
  let mode = 'idle', online = false, offlineReason = '';
  let muted = !!rawTokens.voice.startMuted;   // chosen state, not a fault
  let unmuteResolve = null;
  let waking = false;                          // true only while listening for wake

  // v1.5 session state
  let session = 'dormant';                     // dormant | attentive
  let forceWake = false;                        // set by wake() (hotkey summon)
  let leaveAttentive = false;                   // set by goDormant() (external bank)
  const V = rawTokens.voice;
  const SESS = V.session || {};
  // v1.5.1 THE TRIGGER — capture mode. 'ptt': the mic opens only while the trigger is
  // held (pttDown/pttUp); 'open': the S1 VAD behaviour. The loop is identical either way
  // — only WHERE listenForWake/capture resolve changes (held clip vs VAD).
  const captureMode = V.capture_mode === 'open' ? 'open' : 'ptt';
  let capturing = false;   // PTT: a clip is being held right now (the CAPTURING cue)

  const safe = (fn, ...a) => { try { return fn && fn(...a); } catch (_) { return null; } };
  function setSession(s) { if (s === session) return; session = s; safe(onSession, s); }
  // FX2 — normalize so a polished spoken "Bank the fire." (or "Bank, the fire.") still banks.
  const normPhrase = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const dismissPhrases = (V.dismissPhrases || [V.dismissPhrase]).filter(Boolean).map(normPhrase);
  const isDismissText = (t) => { const s = normPhrase(t); return !!s && dismissPhrases.some((p) => s.includes(p)); };

  // SELF-HEAR DEFENCE (S1 re-drill). With echoCancellation OFF (mic coexistence), the
  // reopened mic can catch the room echo of VULCAN's own line and route it as a command
  // — a feedback loop that spams cached answers and can trip a spurious mute. We remember
  // the last few lines VULCAN spoke; a capture transcript that matches one is discarded.
  const spokenRing = [];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function rememberSpoken(text) { const n = norm(text); if (!n) return; spokenRing.push(n); while (spokenRing.length > 4) spokenRing.shift(); }
  function isSelfEcho(transcript) {
    const t = norm(transcript); if (t.length < 4) return false;
    const tw = new Set(t.split(' '));
    for (const s of spokenRing) {
      if (!s) continue;
      if (s.includes(t) || t.includes(s)) return true;                 // clean echo (sub/superstring)
      const sw = s.split(' ');
      const common = sw.filter((w) => tw.has(w)).length;               // token overlap of the spoken line
      if (sw.length && common >= 3 && common / sw.length >= 0.6) return true;
    }
    return false;
  }

  async function boot() {
    cfg = await safeConfig(bridge);
    const testMode = forceTest || cfg.testMode;

    // S2 THE TRIGGER — an ear exists if EITHER Wispr OR local whisper is present
    // (cfg.hasEars, main-side); older config only reported hasWhisper.
    const hasEars = cfg.hasEars !== undefined ? cfg.hasEars : cfg.hasWhisper;
    if (testMode) {
      mode = 'test'; online = true; offlineReason = '';
    } else if (hasEars && cfg.hasKey) {
      mode = 'live'; online = true; offlineReason = '';
    } else {
      mode = 'offline'; online = false;
      offlineReason = !cfg.hasKey ? 'NO ELEVENLABS KEY' : 'NO EARS';
    }

    ears = createEars({ bridge, mode: mode === 'test' ? 'test' : 'live' });
    mouth = createMouth({ bridge });
    if (online) startLoop();
    return { online, mode, offlineReason };
  }

  const isTest = () => mode === 'test';
  const synthetic = () => isTest() || !(cfg && cfg.hasKey);
  const idleToDormantMs = () => (isTest() ? (SESS.test && SESS.test.idleToDormantMs) || 4000 : (SESS.idle_to_dormant_min ?? 5) * 60000);

  // ---- the DORMANT loop: listen for the wake phrase, forever ----
  async function startLoop() {
    if (running) return;
    running = true;
    while (running) {
      try {
        setSession('dormant');
        orb.setState('idle');
        // MUTED: park with the ear fully suspended (no mic/audio/whisper) until unmuted.
        if (muted) { ears.suspend(); await untilUnmuted(); if (!running) break; continue; }
        waking = true;
        let intent;
        try {
          intent = await ears.listenForWake();          // WAKE ("Fire and Forge") / DISMISS
        } catch (e) {
          waking = false;
          if (e && e.message === 'aborted') {
            if (forceWake) { forceWake = false; intent = 'wake'; }   // hotkey summon forced a wake
            else continue;                                           // mute/cancel -> re-park
          } else { throw e; }                                        // mic unavailable -> offline
        }
        waking = false;
        if (!running || muted) continue;
        if (intent === 'dismiss') { safe(onDismiss); continue; }     // bank phrase while dormant -> stay dormant/hidden
        // v1.5.1 THE TRIGGER — a held DORMANT clip that isn't the wake phrase: never
        // silent. Speak one redirect line, stay dormant, keep listening for the trigger.
        if (intent === 'other') { await speakGated(SESS.redirectLine || NEVER_SILENT, 'announce'); continue; }
        // intent === 'wake' -> ENTER THE HOT SESSION
        safe(onWake);                                                 // summon overlay + ignition
        await runAttentive();
      } catch (e) {
        waking = false;
        if (e && e.message === 'aborted') continue;
        online = false; offlineReason = 'MIC UNAVAILABLE'; running = false; break;
      }
    }
  }

  // ---- the ATTENTIVE session: hot mic, every utterance a command, no re-wake ----
  async function runAttentive() {
    setSession('attentive');
    leaveAttentive = false;
    const idleMs = idleToDormantMs();
    while (running && !muted && !leaveAttentive) {
      orb.setState('listening');                                    // -> LISTENING (lerp)
      const cap = await captureWithIdleTimeout(idleMs);             // CAPTURE (silence-ended) vs idle timer
      if (!running || muted || leaveAttentive) break;
      if (cap.timedOut) {                                           // AUTO-DORMANT: announce, then bank
        await speakGated(SESS.autoDormantLine || 'Banking the fire.', 'announce');
        safe(onDismiss);                                            // hide the overlay (quench)
        break;
      }
      const transcript = (cap.transcript || '').trim();
      if (!transcript) continue;                                    // silence/garble -> stay attentive, re-listen
      // SELF-HEAR DEFENCE: a capture that echoes what VULCAN just said is its own voice
      // off the room, not a command — ignore it (live only; test drives synthetic text).
      if (!isTest() && (SESS.selfEchoGuard !== false) && isSelfEcho(transcript)) continue;
      if (isDismissText(transcript)) { safe(onDismiss); break; }    // spoken bank -> DORMANT
      const end = await handleUtterance(transcript, idleMs);
      if (end) break;                                               // an in-session bank command
    }
    setSession('dormant');
    orb.setState('idle');
  }

  // race a real capture against the idle-to-dormant timer; whichever wins settles.
  function captureWithIdleTimeout(ms) {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (done) return; done = true; if (ears.cancel) ears.cancel(); resolve({ timedOut: true }); }, ms);
      ears.capture().then((r) => { if (done) return; done = true; clearTimeout(timer); resolve(r || { transcript: '' }); })
        .catch(() => { if (done) return; done = true; clearTimeout(timer); resolve({ transcript: '' }); });
    });
  }

  // NEVER SILENT (constitutional, FX). Silence in ATTENTIVE is a build-failing bug: any
  // unroutable / dead-end / unfinished path speaks ONE line and returns to listening.
  const NEVER_SILENT = SESS.fallbackLine || "I didn't catch a command. Say it again, or ask for the mission brief.";

  // one exchange: reflex or brain -> present + speak -> back to listening. Returns
  // true only when the utterance is an in-session BANK (leave the hot session).
  async function handleUtterance(transcript, idleMs) {
    // PART 6 — LOCAL REFLEX: only the four local controls (mute/unmute/bank/status)
    // reach here; every skill utterance defers to the conductor (v1.5 MISSION PURITY).
    let cmdIntent = onCommand ? await classify(transcript, bridge) : null;
    // FX4 — DEFENCE IN DEPTH for the never-silent hole: a session/audio-MUTATING control
    // (bank/mute/unmute) is honored ONLY when DETERMINISTIC (a regex keyword match). A
    // non-deterministic (fuzzy) mutating guess must NEVER silently drop or mute the hot
    // session — it is dropped here and deferred to the conductor, which always speaks.
    // (classify already restricts the fuzzy layer to `status`; this is the belt-and-braces.)
    if (cmdIntent && cmdIntent.via !== 'regex' && (cmdIntent.type === 'bank' || cmdIntent.type === 'mute' || cmdIntent.type === 'unmute')) {
      cmdIntent = null;                                              // fall through to the conductor (speaks)
    }
    if (cmdIntent) {
      if (cmdIntent.type === 'bank') { safe(onCommand, cmdIntent); return true; }   // bank -> hide + leave
      orb.setState('thinking');
      const spoken = safe(onCommand, cmdIntent);
      await speakGated(spoken || NEVER_SILENT, 'answer');           // NEVER SILENT
      return false;
    }
    orb.setState('thinking');                                        // -> THINKING
    // hold the thinking beat so the LISTENING->THINKING reorganization is seen; a
    // real brain's latency replaces this floor.
    const thinkDwell = isTest() ? V.test.thinkMs : V.thinkMinMs;
    let answer;
    try {
      [answer] = await Promise.all([brain.respond(transcript), sleep(thinkDwell)]);
    } catch (_) { answer = null; }                                   // brain must never dead-end silently
    answer = answer || { text: NEVER_SILENT, route: 'REFLEX', reason: 'BRAIN_ERROR' };
    safe(onAnswer, answer, transcript);                              // resolve onto the panel (mouth-to-screen)
    // a confirm PROMPT is announce-class (always speaks); tag it so the engine treats
    // it as always-permitted local-if-over-budget.
    await speakGated(answer.text || NEVER_SILENT, answer.needsConfirm ? 'confirm' : 'answer');
    // B2 HANDS — a WRITE_CONFIRM answer needs a SPOKEN confirmation, captured through
    // the SAME hot session. Anything but an explicit confirm aborts.
    if (answer && answer.needsConfirm) {
      orb.setState('listening');
      const cap = await captureWithIdleTimeout(idleMs);
      const decision = classifyConfirm(cap && cap.transcript);
      orb.setState('thinking');
      let final;
      try { final = await brain.confirm(answer, decision); } catch (_) { final = null; }
      final = final || { text: 'Cancelled — nothing left the machine.', route: 'SKILL', aborted: true };
      safe(onAnswer, final, transcript);
      await speakGated(final.text || NEVER_SILENT, 'confirm');
    }
    return false;
  }

  // SPEAK, gated. Hard-close the ears BEFORE any sound (self-hear forbidden + dodge
  // the macOS HAL reconfiguration race), speak on the real analyser envelope, then a
  // short settle before the next capture re-acquires a fresh graph.
  async function speakGated(text, kind = 'answer') {
    rememberSpoken(text);                                            // for the self-echo guard
    orb.setState('speaking');                                        // -> SPEAKING
    if (ears && ears.closeForSpeech) ears.closeForSpeech();
    await mouth.speak(text, { synthetic: synthetic(), kind });
    orb.setAmplitude(0);
    // let the room echo of VULCAN's own line decay below the VAD before the ear reopens
    // (echoCancellation is off for mic coexistence). Test uses ~0 to stay fast.
    const settle = (isTest() ? (SESS.test && SESS.test.speakGateSettleMs) : SESS.speakGateSettleMs) || 0;
    if (settle) await sleep(settle);
  }

  function untilUnmuted() { return new Promise((r) => { unmuteResolve = r; }); }

  // ---- external session controls (hotkey / tray / Esc parity with the voice path) ----
  // hotkey summon: if dormant, force a wake into the hot session; if attentive, no-op.
  function wake() {
    if (!running) return;
    if (session === 'dormant') { forceWake = true; if (ears && ears.cancel) ears.cancel(); }
  }
  // external bank (Esc / tray / hotkey toggle): leave the hot session cleanly.
  function goDormant() {
    if (session === 'attentive') { leaveAttentive = true; if (ears && ears.cancel) ears.cancel(); }
  }

  // v1.5.1 THE TRIGGER — push-to-talk. The renderer calls pttDown() on trigger-key hold
  // and pttUp() on release (focused window only). Down opens the mic + shows the
  // CAPTURING cue (orb stirs to the live mic); up closes the mic and hands the held clip
  // to the ears chain, which resolves the loop's parked listenForWake/capture.
  async function pttDown() {
    if (captureMode !== 'ptt') return;
    if (!running || !online || muted || mode === 'offline') return;
    if (capturing) return;
    capturing = true;
    orb.setState('listening');          // waves stir to the mic; CAPTURING reads on the HUD
    if (ears && ears.pttDown) await ears.pttDown();
  }
  // FX2 — AWAIT the ears end-to-end. The release must not resolve until the held clip is
  // transcribed AND routed to its ONE consumer; the fire-and-forget of S2 let the harness
  // (and a fast operator) start the next clip before this one landed, merging utterances.
  async function pttUp() {
    if (!capturing) return;
    capturing = false;
    // bridge the CAPTURING -> processing handoff so the release is legible (doctrine 11);
    // the loop takes over the orb state the instant the clip resolves.
    orb.setState('thinking');
    if (ears && ears.pttUp) await ears.pttUp();
  }

  function setMuted(v) {
    if (v === muted) return;
    muted = v;
    if (muted) {
      // mute FULLY RELEASES the mic immediately, in any state: suspend() aborts a
      // pending wake OR capture and closes the graph (OS indicator off). A mid-session
      // mute also drops us out of ATTENTIVE. TTS already in flight still finishes.
      leaveAttentive = true;
      if (ears) ears.suspend();
    } else {
      if (unmuteResolve) { const r = unmuteResolve; unmuteResolve = null; r(); }
    }
  }

  // called every render frame: feed the REAL amplitude driving the orb's waves.
  function tick() {
    if (mouth && mouth.playing) { orb.setAmplitude(mouth.getAmplitude()); return; }
    if (orb.stateName === 'listening' && ears && ears.getLevel) {
      orb.setAmplitude(Math.min((ears.getLevel() || 0) * 5, 1)); return;
    }
    orb.setAmplitude(0);
  }

  // B1 SYNAPSE — speak arbitrary text through the SAME v1 mouth (the constitution
  // announce hook uses this so WRITE announcements are spoken aloud). Gated like any
  // other utterance; drives the speaking state so the orb rides the envelope.
  async function say(text, { kind = 'answer' } = {}) {
    if (!mouth || !text) return;
    rememberSpoken(text);                                            // for the self-echo guard
    orb.setState('speaking');
    if (ears && ears.closeForSpeech) ears.closeForSpeech();
    await mouth.speak(text, { synthetic: synthetic(), kind });
    orb.setAmplitude(0);
    // return the orb to the session's resting read (attentive keeps listening).
    orb.setState(session === 'attentive' ? 'listening' : 'idle');
  }

  return {
    boot, tick, say, wake, goDormant, pttDown, pttUp,
    setMuted, toggleMute() { setMuted(!muted); }, get muted() { return muted; },
    get session() { return session; },
    get capturing() { return capturing; },
    get captureMode() { return captureMode; },
    earsInfo() { return (ears && ears.earsInfo) ? ears.earsInfo() : { source: null, fellBack: false, captureMode }; },
    // test harness: fire the wake / dismiss phrase on demand (test-mode ears)
    triggerWake() { if (ears && ears.triggerWake) ears.triggerWake(); },
    triggerDismiss() { if (ears && ears.triggerDismiss) ears.triggerDismiss(); },
    triggerWakeOther() { if (ears && ears.triggerWakeOther) ears.triggerWakeOther(); },
    // test harness: script the ATTENTIVE captures + the auto-dormant path
    queueUtterance(t) { if (ears && ears.queueUtterance) ears.queueUtterance(t); },
    triggerUtterance(t) { if (ears && ears.triggerUtterance) ears.triggerUtterance(t); },
    triggerCaptureSilence() { if (ears && ears.triggerCaptureSilence) ears.triggerCaptureSilence(); },
    setAutoCapture(on) { if (ears && ears.setAutoCapture) ears.setAutoCapture(on); },
    setAutoWake(on) { if (ears && ears.setAutoWake) ears.setAutoWake(on); },
    clearUtterances() { if (ears && ears.clearUtterances) ears.clearUtterances(); },
    stop() { running = false; if (ears) ears.stop(); },
    status() {
      const provider = mouth ? mouth.getProvider() : null;
      const local = provider === 'say' || provider === 'kokoro';
      const ei = (ears && ears.earsInfo) ? ears.earsInfo() : { source: null, fellBack: false };
      return { online, mode, session, state: orb.stateName, offlineReason, muted, provider, local,
        captureMode, capturing, earsSource: ei.source, earsFellBack: !!ei.fellBack };
    },
  };
}

async function safeConfig(bridge) {
  try {
    if (bridge && bridge.config) return await bridge.config();
  } catch (_) { /* ignore */ }
  return { hasKey: false, hasWhisper: false, testMode: false };
}
