// The EARS — wake-word listen + utterance capture (v1.5 THE ATTENDANT).
//   live: getUserMedia -> VAD -> whisper.cpp (via the main bridge) detects the
//         wake word, then records until a silence timeout and transcribes.
//   test: a synthetic driver that fires wake + end-of-capture on token timings
//         (and can be triggered on demand) so Playwright drives the loop with no
//         mic and no network.
// Interface is identical in both modes: listenForWake() then capture().
//
// v1.5 RE-ARM FIX (see EARS-ROOT-CAUSE-v1.5.md). The v1.4 defect: ONE capture
// graph was built once (`init()` short-circuits on `ready`) and never rebuilt; the
// first TTS playback reconfigured the shared macOS HAL device and silently stalled
// that graph, so the wake listener went permanently deaf after one exchange. The
// fix, all here:
//   • closeForSpeech()  — the HARD SPEAK-GATE: fully tear the capture graph down
//     BEFORE VULCAN speaks (no self-hear, and the device reconfiguration now happens
//     while the ear is intentionally closed, not mid-capture).
//   • acquire()         — every listen/capture re-acquires a live graph when none is
//     open, so a stalled/closed graph is always replaced. No trust in one long-lived
//     stream (voice.session.reacquireEars).
//   • cancel()          — abort a pending listen/capture cleanly (external bank/wake,
//     idle-timeout) without the mute teardown semantics of suspend().
import rawTokens from '../../tokens.json';
import { encodeWavBase64, downsampleTo16k } from './wav.js';

export function createEars({ bridge, mode }) {
  const V = rawTokens.voice;
  const SESS = V.session || {};
  const reacquire = SESS.reacquireEars !== false;   // v1.5 default ON
  // FX2 — NORMALIZE before matching. A POLISHED STT transcript is capitalized and
  // punctuated ("Fire, and Forge."); a naive lowercase+substring test misses it because
  // whisper's inserted comma splits "fire, and". Strip everything but [a-z0-9 ], collapse
  // whitespace, and match on the normalized form (the same treatment FX gave tag variants).
  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const wakeNorm = normalize(V.wakeWord);
  const wakeWord = wakeNorm;   // kept name; now the normalized form
  // dismiss phrases ("bank the fire" / "stand down") — the listener accepts these
  // while resolved and returns intent 'dismiss' instead of 'wake' (FINDING 4).
  const dismissNorm = (V.dismissPhrases || [V.dismissPhrase]).filter(Boolean).map(normalize).filter(Boolean);
  const matchDismiss = (t) => dismissNorm.some((p) => t.includes(p));

  // ---------- TEST MODE ----------
  // Scriptable so the session-machine harness can drive DORMANT->ATTENTIVE with real
  // state transitions: queueUtterance() feeds ATTENTIVE captures; setAutoCapture(false)
  // lets the voice loop's idle timer win (auto-dormant test). Defaults preserve the
  // old auto-cycling behaviour (verify-ears.mjs) — capture auto-resolves on a timer.
  if (mode === 'test') {
    let manualWake = null, wakeReject = null, wakeTimer = null, capturing = false;
    let capResolve = null, capTimer = null;
    let autoCapture = true, autoWake = true;
    const utterQueue = [];
    // settle a pending wake exactly once: clear the timer, null the resolvers, then act.
    const settleWake = (act) => { clearTimeout(wakeTimer); const res = manualWake, rej = wakeReject; manualWake = wakeReject = null; if (res || rej) act(res, rej); };
    return {
      mode: 'test',
      offline: false,
      async listenForWake() {
        return new Promise((resolve, reject) => {
          manualWake = resolve; wakeReject = reject;
          // autoWake ON (default) auto-fires the wake on a timer (old auto-cycle
          // harness). OFF -> wake only via triggerWake() (deterministic session tests).
          if (autoWake) wakeTimer = setTimeout(() => settleWake((res) => res('wake')), V.test.wakeDelayMs);
        });
      },
      triggerWake() { settleWake((res) => res('wake')); },
      triggerDismiss() { settleWake((res) => res('dismiss')); },
      // v1.5.1 THE TRIGGER — a held DORMANT clip that is neither wake nor dismiss: the
      // loop speaks the redirect line and stays dormant.
      triggerWakeOther() { settleWake((res) => res('other')); },
      async capture() {
        capturing = true;
        return new Promise((resolve) => {
          const settle = (val) => { capturing = false; clearTimeout(capTimer); capTimer = null; capResolve = null; resolve(val); };
          capResolve = settle;
          // A QUEUED utterance always resolves on the capture timer. With an empty
          // queue: autoCapture ON -> resolve the default auto-cycle line (old
          // verify-ears behaviour); autoCapture OFF -> wait (the voice loop's idle
          // timer cancel()s us -> auto-dormant test), or an explicit trigger resolves.
          if (utterQueue.length) capTimer = setTimeout(() => capResolve && settle({ transcript: utterQueue.shift() }), V.test.captureMs);
          else if (autoCapture) capTimer = setTimeout(() => capResolve && settle({ transcript: `${wakeWord} status report` }), V.test.captureMs);
        });
      },
      // harness controls -------------------------------------------------------
      queueUtterance(text) { utterQueue.push(String(text)); if (capResolve && !capTimer) capTimer = setTimeout(() => capResolve && capResolve({ transcript: utterQueue.shift() }), V.test.captureMs); },
      triggerUtterance(text) { if (capResolve) capResolve({ transcript: String(text) }); else utterQueue.push(String(text)); },
      triggerCaptureSilence() { if (capResolve) capResolve({ transcript: '' }); },
      setAutoCapture(on) { autoCapture = !!on; },
      setAutoWake(on) { autoWake = !!on; },
      clearUtterances() { utterQueue.length = 0; },
      // PTT interface parity (no real graph in test — the trigger cue is driven at the
      // voice-loop level; captures are scripted via triggerUtterance/queueUtterance).
      pttDown() {}, pttUp() {},
      micOpen() { return capturing; },
      earsInfo() { return { source: 'test', fellBack: false, captureMode: V.capture_mode === 'open' ? 'open' : 'ptt' }; },
      // gate + lifecycle (no real graph in test — no-ops that keep the interface parity)
      closeForSpeech() {},
      cancel() {
        settleWake((_res, rej) => rej(new Error('aborted')));
        if (capResolve) capResolve({ transcript: '', aborted: true });
      },
      suspend() {
        settleWake((_res, rej) => rej(new Error('aborted')));
        if (capResolve) capResolve({ transcript: '', aborted: true });
      },
      // synthetic mic envelope so LISTENING waves stir with no real mic
      getLevel() { return capturing ? (0.22 + 0.18 * Math.abs(Math.sin(performance.now() / 90))) : 0; },
      stop() { clearTimeout(wakeTimer); clearTimeout(capTimer); },
    };
  }

  // ---------- LIVE MODE ----------
  // v1.5.1 THE TRIGGER — capture mode. 'ptt' (default): the mic opens ONLY between
  // pttDown() and pttUp() (a held trigger); listenForWake/capture park a consumer that
  // the released clip resolves. 'open': the S1 VAD behaviour, preserved verbatim.
  const captureMode = V.capture_mode === 'open' ? 'open' : 'ptt';
  let ctx = null, stream = null, proc = null, source = null;
  let srcRate = 48000;
  let ready = false, offline = false;
  let level = 0;   // running mic RMS — feeds the LISTENING waves (real amplitude)
  let recording = false;                 // PTT: a clip is being held (mic must be open)
  let transcribing = false;              // PTT: a released clip is transcribing/routing (1:1 gate)
  let pttFrames = null;                  // PTT: PCM frames of the held clip
  let pendingKind = null, pendingResolve = null;   // PTT: the parked wake/capture consumer
  let lastInfo = { source: null, fellBack: false }; // last transcription's ears-chain read
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // RL-5 v2 · PART 2 — MIC COEXISTENCE. Capture constraints ship from tokens. The
  // processing flags (AEC/NS/AGC) are FALSE on purpose: enabling them on macOS routes
  // capture through Apple's Voice-Processing I/O unit, which reconfigures the shared
  // input device and breaks other apps' dictation (the operator's Wispr Flow). Raw
  // shared HAL capture coexists — the wake VAD + whisper don't need the processing.
  const C = V.capture || {};
  const audioConstraints = {
    channelCount:     C.channelCount ?? 1,
    echoCancellation: C.echoCancellation ?? false,
    noiseSuppression: C.noiseSuppression ?? false,
    autoGainControl:  C.autoGainControl ?? false,
  };

  // Build the capture graph. Idempotent: returns immediately when a live graph is
  // already open. A closed graph (closeForSpeech / cancel / suspend set ready=false)
  // is rebuilt here — this is the re-acquisition that makes re-arm reliable.
  async function init() {
    if (ready && stream && proc) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      srcRate = ctx.sampleRate;
      source = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      source.connect(proc); proc.connect(ctx.destination);
      ready = true;
      return true;
    } catch (e) {
      offline = true; // permission denied / no mic
      return false;
    }
  }
  // acquire() = the re-arm law. In v1.5 (reacquire) every listen/capture guarantees a
  // live graph; a closed one is rebuilt. (Between a wake and its first capture the
  // graph is still open and healthy, so this reuses it — no per-utterance rebuild
  // latency there; only a speak, via closeForSpeech, forces the next rebuild.)
  async function acquire() { return init(); }

  // Fully tear the capture graph down (mic released, OS indicator off, ctx closed).
  // ready=false so the next acquire() rebuilds. Used by the speak-gate, cancel, mute.
  function closeGraph() {
    if (proc) { proc.onaudioprocess = null; try { proc.disconnect(); } catch (_) {} proc = null; }
    if (source) { try { source.disconnect(); } catch (_) {} source = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (ctx) { try { ctx.close(); } catch (_) {} ctx = null; }
    ready = false; level = 0;
  }

  // collect PCM frames while `active` predicate holds; each frame reports rms
  function onFrame(handler) {
    proc.onaudioprocess = (ev) => handler(ev.inputBuffer.getChannelData(0));
  }
  const rmsOf = (b) => { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); };

  async function transcribe(frames) { return transcribeFlat(flatten(frames), srcRate); }
  // downsample -> 16k WAV -> bridge (Wispr Flow REST -> local whisper chain, main-side).
  // Records the chain's { source, fellBack } read so the renderer can tag [EARS·LOCAL].
  async function transcribeFlat(flat, rate) {
    if (!flat || !flat.length) return '';
    const wav = encodeWavBase64(downsampleTo16k(flat, rate), 16000);
    try {
      const r = await bridge.transcribe(wav);
      if (r) lastInfo = { source: r.source || (r.ok ? 'local' : null), fellBack: !!r.fellBack };
      return (r && r.ok) ? (r.text || '') : '';
    } catch (_) { return ''; }
  }
  function flatten(frames) {
    let n = 0; for (const f of frames) n += f.length;
    const out = new Float32Array(n); let o = 0;
    for (const f of frames) { out.set(f, o); o += f.length; }
    return out;
  }

  let abortWake = null;      // set while a wake-listen is pending; cancel()/suspend() call it
  let abortCapture = null;   // set while an utterance capture is pending; cancel()/suspend() call it

  // ===== PTT (v1.5.1 THE TRIGGER) =====================================================
  // listenForWake/capture park a consumer; the mic stays CLOSED. pttDown() opens the
  // graph and records; pttUp() stops, releases the mic, transcribes the held clip, and
  // resolves the parked consumer. The mic is provably open ONLY between down and up.
  function pttListen(kind) {
    return new Promise((resolve, reject) => {
      pendingKind = kind; pendingResolve = resolve;
      // cancel()/mute abort the parked consumer: wake rejects (loop re-parks or forces a
      // wake), capture resolves aborted (idle-timeout / external bank).
      const abort = () => {
        pendingKind = null; pendingResolve = null; recording = false;
        if (proc) proc.onaudioprocess = null; pttFrames = null;
        abortWake = null; abortCapture = null;
        if (kind === 'wake') reject(new Error('aborted')); else resolve({ transcript: '', aborted: true });
      };
      if (kind === 'wake') abortWake = abort; else abortCapture = abort;
    });
  }
  // resolve the parked consumer from a held clip's transcript. wake -> intent
  // ('wake' | 'dismiss' | 'other'); capture -> { transcript }. NORMALIZED (FX2).
  function finishPtt(txt = '') {
    const kind = pendingKind, resolve = pendingResolve;
    pendingKind = null; pendingResolve = null; abortWake = null; abortCapture = null;
    if (!resolve) return;
    if (kind === 'wake') {
      const t = normalize(txt);
      if (t && matchDismiss(t)) resolve('dismiss');
      else if (t && t.includes(wakeNorm)) resolve('wake');
      else resolve('other');                         // held speech, not wake/dismiss -> redirect
    } else {
      resolve({ transcript: txt });
    }
  }
  // FX2 — ALIGNMENT. Deliver a held clip's transcript to EXACTLY ONE parked consumer.
  // The loop needs a beat to re-park (wake resolves -> onWake -> runAttentive -> capture);
  // a short bounded wait closes that handoff gap WITHOUT queueing audio across holds. If
  // no consumer parks in time the transcript is dropped, never carried over.
  async function deliver(txt) {
    let waited = 0;
    while (!pendingKind && waited < 1000) { await sleep(50); waited += 50; }
    finishPtt(txt);
  }
  // pttDown opens the mic and records a FRESH clip. One clip at a time: a down while
  // recording or mid-transcribe is ignored (no merged/carried-over buffers).
  async function pttDown() {
    if (recording || transcribing) return;
    recording = true;
    pttFrames = [];                                   // fresh buffer per hold — never merged
    const okGraph = await acquire();
    if (!recording) { closeGraph(); return; }         // released during arming (fast tap)
    if (!okGraph) { offline = true; recording = false; await deliver(''); return; }  // mic denied
    onFrame((buf) => { level = rmsOf(buf); if (recording && pttFrames) pttFrames.push(buf.slice()); });
  }
  async function pttUp() {
    if (!recording) return;
    recording = false;
    transcribing = true;                              // block a new clip until this one routes
    if (proc) proc.onaudioprocess = null;
    const frames = pttFrames || []; pttFrames = null;
    const rate = srcRate;
    closeGraph();                                     // release the mic NOW — closed when not held
    const flat = frames.length ? flatten(frames) : null;
    const txt = flat ? await transcribeFlat(flat, rate) : '';
    await deliver(txt);                               // strictly 1:1 clip -> transcript -> consumer
    transcribing = false;
  }
  // ====================================================================================

  return {
    mode: 'live',
    get offline() { return offline; },
    // running mic amplitude (0..1-ish RMS) — the LISTENING/CAPTURING waves stir to this.
    // In PTT the mic is closed unless held, so level reads 0 between clips.
    getLevel() { return captureMode === 'ptt' ? (recording ? level : 0) : (ready ? level : 0); },
    // PTT: the mic is open ONLY while a clip is held (the core promise, provable in test).
    micOpen() { return captureMode === 'ptt' ? (recording && ready) : ready; },
    // PTT trigger: the renderer calls these on key hold / release.
    pttDown, pttUp,
    // the last transcription's ears-chain read: { source:'wispr'|'local', fellBack }
    earsInfo() { return { ...lastInfo, captureMode }; },
    // in PTT don't open the mic just to probe availability (open would flip the OS
    // indicator on with no clip held) — the loop gates on cfg.hasEars instead.
    async available() { return captureMode === 'ptt' ? !offline : init(); },
    // resolve when a spoken segment transcribes to something containing the wake word
    async listenForWake() {
      if (captureMode === 'ptt') return pttListen('wake');
      if (!(await acquire())) throw new Error('mic-unavailable');
      return new Promise((resolve, reject) => {
        abortWake = () => { if (proc) proc.onaudioprocess = null; abortWake = null; reject(new Error('aborted')); };
        let seg = [], speaking = false, silence = 0;
        onFrame(async (buf) => {
          const rms = rmsOf(buf); level = rms;
          if (rms > V['vad.threshold']) { speaking = true; silence = 0; seg.push(buf.slice()); }
          else if (speaking) {
            silence += buf.length / srcRate * 1000;
            seg.push(buf.slice());
            if (silence > 400) { // short segment end — test for wake / dismiss phrase
              const frames = seg; seg = []; speaking = false; silence = 0;
              if (frames.length > 4) {
                const txt = normalize(await transcribe(frames));
                if (matchDismiss(txt)) { if (proc) proc.onaudioprocess = null; abortWake = null; resolve('dismiss'); }
                else if (txt.includes(wakeNorm)) { if (proc) proc.onaudioprocess = null; abortWake = null; resolve('wake'); }
              }
            }
          }
        });
      });
    },
    // record until sustained silence, then transcribe the utterance
    async capture() {
      if (captureMode === 'ptt') return pttListen('capture');
      if (!(await acquire())) return { transcript: '', aborted: true };
      return new Promise((resolve) => {
        // cancel()/mute mid-capture releases the mic NOW (idle-timeout, external bank).
        abortCapture = () => { if (proc) proc.onaudioprocess = null; abortCapture = null; resolve({ transcript: '', aborted: true }); };
        let seg = [], silence = 0, started = false, elapsed = 0;
        onFrame(async (buf) => {
          elapsed += buf.length / srcRate * 1000;
          const rms = rmsOf(buf); level = rms;
          seg.push(buf.slice());
          if (rms > V['vad.threshold']) { started = true; silence = 0; }
          else if (started) silence += buf.length / srcRate * 1000;
          if ((started && silence > V.silenceTimeoutMs) || elapsed > V.captureMaxMs) {
            if (proc) proc.onaudioprocess = null; abortCapture = null;
            const txt = await transcribe(seg);
            resolve({ transcript: txt });
          }
        });
      });
    },
    // THE SPEAK-GATE (v1.5). Called by the voice loop BEFORE VULCAN speaks: hard-close
    // the capture graph so (a) VULCAN can never hear itself, and (b) the macOS HAL
    // reconfiguration triggered by TTS output happens while the ear is CLOSED — the
    // next capture re-acquires a fresh, live graph. With reacquire off, degrade to the
    // legacy soft gate (just stop delivering frames) — not recommended.
    closeForSpeech() {
      // PTT: the mic is already closed unless held — nothing to gate (self-hear is
      // structurally impossible). OPEN: hard-close the graph before VULCAN speaks.
      if (captureMode === 'ptt') return;
      if (reacquire) closeGraph();
      else if (proc) proc.onaudioprocess = null;
    },
    // Abort a pending listen/capture without mute semantics (external bank / wake /
    // idle-timeout). Also drops the graph so the next listen re-acquires clean.
    cancel() {
      recording = false;
      if (abortWake) abortWake();
      if (abortCapture) abortCapture();
      if (reacquire) closeGraph();
    },
    // MUTED: fully suspend the ear — abort any pending wake/capture, drop the audio
    // graph, release the mic (OS indicator off). The next listen re-acquires it, so
    // unmuting resumes seamlessly with no re-prompt (permission persists).
    suspend() {
      recording = false;
      if (abortWake) abortWake();
      if (abortCapture) abortCapture();
      closeGraph();
    },
    stop() {
      recording = false;
      if (abortWake) { try { abortWake(); } catch (_) {} }
      if (abortCapture) { try { abortCapture(); } catch (_) {} }
      closeGraph();
    },
  };
}
