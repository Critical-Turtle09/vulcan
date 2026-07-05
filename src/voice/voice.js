// THE VOICE LOOP — one continuous organ. WAKE -> CAPTURE -> THINK -> SPEAK -> IDLE,
// forever. Every stage change is an orb.setState() into the orb's own lerp, so the
// whole loop is a single continuous material reorganization (doctrine 11) — nothing
// snaps, including on wake detection and playback end.
//
// Fail-soft: without a working ear (whisper) AND mouth (ElevenLabs key), the loop
// stays down and reports VOICE OFFLINE; keys 1-4 keep driving the orb regardless.
import rawTokens from '../../tokens.json';
import { createEars } from './ears.js';
import { createBrain } from './brain.js';
import { createMouth } from './mouth.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createVoice({ orb, bridge, forceTest = false }) {
  let running = false, cfg = null, ears = null, mouth = null, brain = createBrain();
  let mode = 'idle', online = false, offlineReason = '';
  let muted = !!rawTokens.voice.startMuted;   // chosen state, not a fault
  let unmuteResolve = null;
  let waking = false;                          // true only while listening for wake

  async function boot() {
    cfg = await safeConfig(bridge);
    const testMode = forceTest || cfg.testMode;

    if (testMode) {
      mode = 'test'; online = true; offlineReason = '';
    } else if (cfg.hasWhisper && cfg.hasKey) {
      mode = 'live'; online = true; offlineReason = '';
    } else {
      mode = 'offline'; online = false;
      offlineReason = !cfg.hasKey ? 'NO ELEVENLABS KEY' : 'NO WHISPER';
    }

    ears = createEars({ bridge, mode: mode === 'test' ? 'test' : 'live' });
    mouth = createMouth({ bridge });
    if (online) startLoop();
    return { online, mode, offlineReason };
  }

  async function startLoop() {
    if (running) return;
    running = true;
    const synthetic = (mode === 'test') || !cfg.hasKey;
    while (running) {
      try {
        orb.setState('idle');                          // ← rest
        // MUTED: park here with the ear fully suspended — no mic, no audio
        // processing, no whisper — until unmuted. Orb holds idle (no snap).
        if (muted) { ears.suspend(); await untilUnmuted(); if (!running) break; }
        waking = true;
        await ears.listenForWake();                    // WAKE
        waking = false;
        if (!running || muted) continue;                // muted mid-wait -> re-park
        orb.setState('listening');                     // idle -> listening (lerp)
        const { transcript } = await ears.capture();   // CAPTURE (ends on silence)
        if (!running) break;
        orb.setState('thinking');                      // listening -> thinking
        // hold the thinking beat: the stub brain is instant, so dwell a minimum so
        // the LISTENING->THINKING reorganization is actually seen. A real brain's
        // latency replaces this floor.
        const V = rawTokens.voice;
        const thinkDwell = mode === 'test' ? V.test.thinkMs : V.thinkMinMs;
        const [text] = await Promise.all([brain.respond(transcript), sleep(thinkDwell)]);
        orb.setState('speaking');                      // thinking -> speaking
        await mouth.speak(text, { synthetic });        // SPEAK — real amplitude via analyser
        orb.setAmplitude(0);                           // -> speaking -> idle (lerp back)
      } catch (e) {
        waking = false;
        // muting aborts a pending wake-listen — not a fault, just re-loop and park
        if (e && e.message === 'aborted') continue;
        // an ear that can't open the mic drops us to offline, keys still live
        online = false; offlineReason = 'MIC UNAVAILABLE'; running = false; break;
      }
    }
  }

  function untilUnmuted() { return new Promise((r) => { unmuteResolve = r; }); }

  function setMuted(v) {
    if (v === muted) return;
    muted = v;
    if (muted) {
      // abort now only if we're actively listening for wake; a mid-exchange mute
      // lets the current response finish, then the loop parks muted at idle.
      if (ears && waking) ears.suspend();
    } else {
      if (unmuteResolve) { const r = unmuteResolve; unmuteResolve = null; r(); }
    }
  }

  // called every render frame: feed the REAL playback amplitude to the ring
  function tick() {
    if (mouth) orb.setAmplitude(mouth.playing ? mouth.getAmplitude() : 0);
  }

  return {
    boot, tick,
    setMuted, toggleMute() { setMuted(!muted); }, get muted() { return muted; },
    // test harness: fire the wake word on demand (test-mode ears)
    triggerWake() { if (ears && ears.triggerWake) ears.triggerWake(); },
    stop() { running = false; if (ears) ears.stop(); },
    status() { return { online, mode, state: orb.stateName, offlineReason, muted }; },
  };
}

async function safeConfig(bridge) {
  try {
    if (bridge && bridge.config) return await bridge.config();
  } catch (_) { /* ignore */ }
  return { hasKey: false, hasWhisper: false, testMode: false };
}
