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
  const wakeWord = V.wakeWord.toLowerCase();
  // dismiss phrases ("bank the fire" / "stand down") — the listener accepts these
  // while resolved and returns intent 'dismiss' instead of 'wake' (FINDING 4).
  const dismissPhrases = (V.dismissPhrases || [V.dismissPhrase]).filter(Boolean).map((s) => s.toLowerCase());
  const matchDismiss = (t) => dismissPhrases.some((p) => t.includes(p));

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
  let ctx = null, stream = null, proc = null, source = null;
  let srcRate = 48000;
  let ready = false, offline = false;
  let level = 0;   // running mic RMS — feeds the LISTENING waves (real amplitude)

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

  async function transcribe(frames) {
    const flat = flatten(frames);
    const ds = downsampleTo16k(flat, srcRate);
    const wav = encodeWavBase64(ds, 16000);
    try { const r = await bridge.transcribe(wav); return (r && r.ok) ? (r.text || '') : ''; }
    catch (_) { return ''; }
  }
  function flatten(frames) {
    let n = 0; for (const f of frames) n += f.length;
    const out = new Float32Array(n); let o = 0;
    for (const f of frames) { out.set(f, o); o += f.length; }
    return out;
  }

  let abortWake = null;      // set while a wake-listen is pending; cancel()/suspend() call it
  let abortCapture = null;   // set while an utterance capture is pending; cancel()/suspend() call it

  return {
    mode: 'live',
    get offline() { return offline; },
    // running mic amplitude (0..1-ish RMS) — the LISTENING waves stir to this
    getLevel() { return ready ? level : 0; },
    async available() { return init(); },
    // resolve when a spoken segment transcribes to something containing the wake word
    async listenForWake() {
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
                const txt = (await transcribe(frames)).toLowerCase();
                if (matchDismiss(txt)) { if (proc) proc.onaudioprocess = null; abortWake = null; resolve('dismiss'); }
                else if (txt.includes(wakeWord)) { if (proc) proc.onaudioprocess = null; abortWake = null; resolve('wake'); }
              }
            }
          }
        });
      });
    },
    // record until sustained silence, then transcribe the utterance
    async capture() {
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
      if (reacquire) closeGraph();
      else if (proc) proc.onaudioprocess = null;
    },
    // Abort a pending listen/capture without mute semantics (external bank / wake /
    // idle-timeout). Also drops the graph so the next listen re-acquires clean.
    cancel() {
      if (abortWake) abortWake();
      if (abortCapture) abortCapture();
      if (reacquire) closeGraph();
    },
    // MUTED: fully suspend the ear — abort any pending wake/capture, drop the audio
    // graph, release the mic (OS indicator off). The next listen re-acquires it, so
    // unmuting resumes seamlessly with no re-prompt (permission persists).
    suspend() {
      if (abortWake) abortWake();
      if (abortCapture) abortCapture();
      closeGraph();
    },
    stop() {
      if (abortWake) { try { abortWake(); } catch (_) {} }
      if (abortCapture) { try { abortCapture(); } catch (_) {} }
      closeGraph();
    },
  };
}
