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
        await ears.listenForWake();                    // WAKE
        if (!running) break;
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
        // an ear that can't open the mic drops us to offline, keys still live
        online = false; offlineReason = 'MIC UNAVAILABLE'; running = false; break;
      }
    }
  }

  // called every render frame: feed the REAL playback amplitude to the ring
  function tick() {
    if (mouth) orb.setAmplitude(mouth.playing ? mouth.getAmplitude() : 0);
  }

  return {
    boot, tick,
    // test harness: fire the wake word on demand (test-mode ears)
    triggerWake() { if (ears && ears.triggerWake) ears.triggerWake(); },
    stop() { running = false; if (ears) ears.stop(); },
    status() { return { online, mode, state: orb.stateName, offlineReason }; },
  };
}

async function safeConfig(bridge) {
  try {
    if (bridge && bridge.config) return await bridge.config();
  } catch (_) { /* ignore */ }
  return { hasKey: false, hasWhisper: false, testMode: false };
}
