// The EARS — wake-word listen + utterance capture.
//   live: getUserMedia -> VAD -> whisper.cpp (via the main bridge) detects the
//         wake word, then records until a silence timeout and transcribes.
//   test: a synthetic driver that fires wake + end-of-capture on token timings
//         (and can be triggered on demand) so Playwright drives the loop with no
//         mic and no network.
// Interface is identical in both modes: listenForWake() then capture().
import rawTokens from '../../tokens.json';
import { encodeWavBase64, downsampleTo16k } from './wav.js';

export function createEars({ bridge, mode }) {
  const V = rawTokens.voice;
  const wakeWord = V.wakeWord.toLowerCase();

  // ---------- TEST MODE ----------
  if (mode === 'test') {
    let manualWake = null, wakeReject = null, wakeTimer = null;
    return {
      mode: 'test',
      offline: false,
      async listenForWake() {
        return new Promise((resolve, reject) => {
          manualWake = resolve; wakeReject = reject;
          wakeTimer = setTimeout(() => { if (manualWake) { manualWake = null; resolve(); } }, V.test.wakeDelayMs);
        });
      },
      triggerWake() { if (manualWake) { clearTimeout(wakeTimer); const r = manualWake; manualWake = null; r(); } },
      // muted: abort a pending wake so the loop can park (no synthetic wake fires)
      suspend() { clearTimeout(wakeTimer); if (wakeReject) { const r = wakeReject; manualWake = wakeReject = null; r(new Error('aborted')); } },
      async capture() {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ transcript: `${wakeWord} status report` }), V.test.captureMs));
      },
      stop() {},
    };
  }

  // ---------- LIVE MODE ----------
  let ctx = null, stream = null, proc = null, source = null;
  let srcRate = 48000;
  let ready = false, offline = false;

  async function init() {
    if (ready) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
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

  let abortWake = null;   // set while a wake-listen is pending; suspend() calls it

  return {
    mode: 'live',
    get offline() { return offline; },
    async available() { return init(); },
    // resolve when a spoken segment transcribes to something containing the wake word
    async listenForWake() {
      if (!(await init())) throw new Error('mic-unavailable');
      return new Promise((resolve, reject) => {
        abortWake = () => { if (proc) proc.onaudioprocess = null; abortWake = null; reject(new Error('aborted')); };
        let seg = [], speaking = false, silence = 0;
        onFrame(async (buf) => {
          const rms = rmsOf(buf);
          if (rms > V['vad.threshold']) { speaking = true; silence = 0; seg.push(buf.slice()); }
          else if (speaking) {
            silence += buf.length / srcRate * 1000;
            seg.push(buf.slice());
            if (silence > 400) { // short segment end — test for wake word
              const frames = seg; seg = []; speaking = false; silence = 0;
              if (frames.length > 4) {
                const txt = (await transcribe(frames)).toLowerCase();
                if (txt.includes(wakeWord)) { proc.onaudioprocess = null; abortWake = null; resolve(); }
              }
            }
          }
        });
      });
    },
    // record until sustained silence, then transcribe the utterance
    async capture() {
      return new Promise((resolve) => {
        let seg = [], silence = 0, started = false, elapsed = 0;
        onFrame(async (buf) => {
          elapsed += buf.length / srcRate * 1000;
          const rms = rmsOf(buf);
          seg.push(buf.slice());
          if (rms > V['vad.threshold']) { started = true; silence = 0; }
          else if (started) silence += buf.length / srcRate * 1000;
          if ((started && silence > V.silenceTimeoutMs) || elapsed > V.captureMaxMs) {
            proc.onaudioprocess = null;
            const txt = await transcribe(seg);
            resolve({ transcript: txt });
          }
        });
      });
    },
    // MUTED: fully suspend the ear — abort any pending wake, drop the audio graph,
    // release the mic (OS indicator off). The next listenForWake re-acquires it,
    // so unmuting resumes seamlessly with no re-prompt (permission persists).
    suspend() {
      if (abortWake) abortWake();
      if (proc) { proc.onaudioprocess = null; proc.disconnect(); proc = null; }
      if (source) { source.disconnect(); source = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      if (ctx) { ctx.close(); ctx = null; }
      ready = false;
    },
    stop() {
      if (proc) proc.onaudioprocess = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) ctx.close();
      ready = false;
    },
  };
}
