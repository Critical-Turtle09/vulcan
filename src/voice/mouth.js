// The MOUTH — turns response text into sound and exposes a REAL amplitude
// envelope for the SPEAKING ring. Playback always runs through a WebAudio
// AnalyserNode; getAmplitude() reads the analyser (RMS) so the ring is driven by
// the actual waveform, never a formula. Live audio is ElevenLabs (via the main
// bridge); test/offline synthesizes speech-like audio so the SAME analyser path
// drives the ring with no mic and no network.
import rawTokens from '../../tokens.json';

export function createMouth({ bridge }) {
  const V = rawTokens.voice;
  let ctx = null;
  let analyser = null;
  let dataArr = null;
  let playing = false;
  let lastProvider = null;   // ORGAN 1.5 — which TTS provider produced the last audio
  // fallback envelope (only if the analyser yields no signal, e.g. a suspended
  // context) — still the real envelope of the real buffer, read by position.
  let fbBuffer = null, fbStart = 0;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = V.envelope.smoothing;
      dataArr = new Float32Array(analyser.fftSize);
      analyser.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // speech-like buffer: syllable bursts of band-limited noise + a low formant,
  // shaped by a per-syllable envelope. Deterministic-ish, no assets.
  function synth(durationS) {
    ensureCtx();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * durationS);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const syl = 0.18; // ~180ms syllables
    let seed = 20260705;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
    for (let i = 0; i < len; i++) {
      const tt = i / sr;
      const sIdx = Math.floor(tt / syl);
      const sPh = (tt % syl) / syl;                 // 0..1 within syllable
      // syllable amplitude envelope (attack/decay), some syllables near-silent (gaps)
      const gap = (sIdx * 2654435761 % 5) === 0 ? 0.12 : 1.0;
      const envS = Math.sin(Math.PI * sPh) * gap;
      const formant = Math.sin(2 * Math.PI * (110 + (sIdx % 4) * 30) * tt);
      const noise = rnd();
      d[i] = (0.6 * formant + 0.4 * noise) * envS * 0.5;
    }
    return buf;
  }

  // Play a decoded buffer and RESOLVE ON TRUE PLAYBACK COMPLETION. Every TTS tier
  // (elevenlabs / kokoro / say) funnels through here — the gate the voice loop
  // awaits is BufferSource.onended, tied to the actual WebAudio buffer end, never a
  // provider's process exit. GATE-WATCHDOG: if onended never fires (a suspended or
  // stalled AudioContext, a decode edge), the loop would hang deaf mid-speech
  // forever; a timer set to clip-duration + grace force-releases the gate so the
  // loop can always return to the wake listener. One-shot: whichever fires first wins.
  async function play(buffer) {
    ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(analyser);
    fbBuffer = buffer; fbStart = ctx.currentTime;
    playing = true;
    return new Promise((resolve) => {
      let settled = false;
      const graceMs = (V.envelope && V.envelope.gateWatchdogGraceMs) || 2000;
      let wd = null;
      const release = (forced) => {
        if (settled) return; settled = true;
        if (wd) { clearTimeout(wd); wd = null; }
        playing = false; fbBuffer = null;
        try { src.onended = null; src.stop(); } catch (_) { /* already stopped */ }
        if (forced) console.warn(`[GATE-WATCHDOG] speak gate force-released — no playback-end within ${buffer.duration.toFixed(2)}s + ${graceMs}ms`);
        resolve();
      };
      wd = setTimeout(() => release(true), buffer.duration * 1000 + graceMs);
      src.onended = () => release(false);
      src.start();
    });
  }

  // returns 0..1 current amplitude from the analyser (RMS), with a buffer-position
  // fallback if the analyser is flat (suspended-context environments).
  function getAmplitude() {
    if (!playing || !analyser) return 0;
    analyser.getFloatTimeDomainData(dataArr);
    let sum = 0;
    for (let i = 0; i < dataArr.length; i++) sum += dataArr[i] * dataArr[i];
    let rms = Math.sqrt(sum / dataArr.length);
    if (rms < 1e-4 && fbBuffer) {
      // analyser silent — derive envelope directly from the played buffer
      const pos = Math.floor((ctx.currentTime - fbStart) * fbBuffer.sampleRate);
      const ch = fbBuffer.getChannelData(0);
      const w = Math.floor(fbBuffer.sampleRate * 0.03);
      let s = 0, n = 0;
      for (let i = pos - w; i < pos + w; i++) { if (i >= 0 && i < ch.length) { s += ch[i] * ch[i]; n++; } }
      rms = n ? Math.sqrt(s / n) : 0;
    }
    return Math.min(rms * 3.2, 1); // normalise typical speech RMS into 0..1
  }

  // synthetic=true -> generate speech-like audio (test/offline). Otherwise request
  // ElevenLabs audio via the bridge; if the bridge is offline, fall back to synth
  // so the loop still completes visibly (caller decides whether that path is used).
  async function speak(text, { synthetic = false, kind = 'answer' } = {}) {
    const words = (text || '').trim().split(/\s+/).length || 1;
    const durS = Math.max(1.2, Math.min(words * 0.42, V.test.speakMs / 1000 * 2));
    if (synthetic) return play(synth(durS));

    try {
      const res = await bridge.tts(text, kind);
      if (res && res.ok && res.audioBase64) {
        lastProvider = res.provider || 'cloud';   // elevenlabs | kokoro | say
        const bytes = Uint8Array.from(atob(res.audioBase64), (c) => c.charCodeAt(0));
        ensureCtx();
        const audio = await ctx.decodeAudioData(bytes.buffer);
        return play(audio);   // same analyser path -> envelope drives orb + rings identically
      }
    } catch (_) { /* fall through to synthetic */ }
    lastProvider = 'synthetic';
    return play(synth(durS));
  }

  return { speak, getAmplitude, get playing() { return playing; }, getProvider() { return lastProvider; }, resume: ensureCtx };
}
