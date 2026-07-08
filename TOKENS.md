# VULCAN — TOKENS

> **Auto-generated** from `tokens.json` by `npm run tokens` (`scripts/gen-tokens.mjs`).
> Do not edit by hand. Every color, duration, easing, and size in VULCAN resolves
> through these tokens (doctrine 10 — tokens, never hardcode). Restyling from an
> operator reference is a token edit, not a code change.

## `perf`

| Token | Value |
|---|---|
| `perf._note` | `RL-5 v2 PART 3 — PACKAGED-APP PERF. Full-screen bloom+grade post at dpr=2 on a Retina/4K display pinned every state to ~23ms (~42fps). maxPixelRatio caps the render resolution; the adaptive governor scales it between min/max to hold the frame budget, degrading gracefully instead of dropping frames.` |
| `perf.maxPixelRatio` | `1.5` |
| `perf.minRenderScale` | `0.66` |
| `perf.governor` | `true` |
| `perf.budgetMs` | `19` |
| `perf.recoverMs` | `14.5` |
| `perf.hudHz` | `6` |

## `palette`

The rationed palette. Greyscale world · bone data · molten heat. Never pure #000/#FFF.

| Token | Value |
|---|---|
| `void` | `#050607` |
| `stage` | `#0A0B0D` |
| `terrain.deep` | `#16181B` |
| `terrain.mid` | `#24272B` |
| `terrain.high` | `#383C42` |
| `haze` | `#5A5F66` |
| `data.bone` | `#E6E4DE` |
| `data.dim` | `#9A9DA2` |
| `data.faint` | `#55585E` |
| `signal.molten` | `#EA6A1E` |
| `signal.forge` | `#FF8A3D` |
| `signal.cooled` | `#7E3A1B` |
| `signal.ember` | `#EA6A1E` |
| `panel.stroke` | `#3A3E44` |

## `motion`

Motion-physics tokens (§5): idle drift, granular transitions, propagation, post grade, reveal band.

| Token | Value |
|---|---|
| `motion.idle.camera.driftAmp` | `0.003` |
| `motion.idle.camera.driftPeriod` | `[20, 40]` |
| `motion.idle.node.pulse` | `[0.85, 1]` |
| `motion.idle.node.pulsePeriod` | `[4, 7]` |
| `motion.transition.granular.ms` | `[400, 700]` |
| `motion.transition.granular.stagger` | `noise` |
| `motion.arc.head.speed` | `0.2` |
| `motion.arc.trail.decay` | `[1.5, 3]` |
| `motion.propagate.hop.ms` | `[80, 200]` |
| `motion.propagate.ignite.ms` | `150` |
| `motion.dive.spring.mass` | `1` |
| `motion.dive.spring.tension` | `120` |
| `motion.dive.spring.friction` | `26` |
| `motion.dive.duration.s` | `[1.2, 1.8]` |
| `motion.post.bloom.threshold` | `0.5` |
| `motion.post.bloom.strength` | `0.7` |
| `motion.post.bloom.radius` | `0.3` |
| `motion.post.grain` | `0.015` |
| `motion.post.chromAb.px` | `1` |
| `motion.post.vignette` | `0.34` |
| `motion.feedback.first.ms` | `100` |
| `motion.reveal.ms` | `[240, 700]` |
| `motion.reveal.text.perGlyph.ms` | `[12, 24]` |
| `motion.reveal.text.blockCap.ms` | `400` |
| `motion.state.crossflow` | `true` |

## `type`

Type tokens — Martian Mono (data) · Archivo (UI). No stock sci-fi faces.

| Token | Value |
|---|---|
| `type.mono` | `'Martian Mono', ui-monospace, monospace` |
| `type.ui` | `'Archivo', system-ui, sans-serif` |
| `type.label.px` | `12` |
| `type.label.trackEm` | `0.08` |

## `scene`

Slice-0 material-test scene + the device/schematic scene (`scene.schematic.*`).

| Token | Value |
|---|---|
| `scene.schematic.board` | `[13, 0.4, 9.5]` |
| `scene.schematic.die` | `[3.4, 0.7, 3.4]` |
| `scene.schematic.hbm.count` | `6` |
| `scene.schematic.hbm` | `[0.85, 1.15, 2.3]` |
| `scene.schematic.vrm.count` | `8` |
| `scene.schematic.vrm` | `[0.6, 0.45, 0.6]` |
| `scene.schematic.dotDensity` | `0.9` |
| `scene.schematic.formMs` | `1500` |
| `scene.schematic.explode.ms` | `900` |
| `scene.schematic.explode.spread` | `5.5` |

## `orb`

The orb: particle-field body, audio-reactive waves, hairline wave-rings, per-state machine.

| Token | Value |
|---|---|
| `orb.particleCount` | `16000` |
| `orb.radius` | `6.6` |
| `orb.coreRadius` | `4.55` |
| `orb.pointSize` | `2.15` |
| `orb.shellJitter` | `0.5` |
| `orb.breatheAmp` | `0.03` |
| `orb.breathePeriod` | `5.2` |
| `orb.formMs` | `1500` |
| `orb.scale` | `0.62` |
| `orb.constelNodes` | `54` |
| `orb.constelLinks` | `3` |
| `orb.wave.baseAmp` | `0.42` |
| `orb.wave.freqA` | `3.1` |
| `orb.wave.freqB` | `5.7` |
| `orb.wave.speed` | `0.55` |
| `orb.wave.chop` | `0.35` |
| `orb.wave.audioGain` | `0.62` |
| `orb.wave.maxAmp` | `0.82` |
| `orb.wave.crestBoost` | `0.9` |
| `orb.audio.attack` | `0.55` |
| `orb.audio.decay` | `0.06` |
| `orb.camera.pos` | `[0, 1.4, 26]` |
| `orb.camera.fov` | `36` |
| `orb.stateLerp` | `2.6` |
| `orb.rings.count` | `6` |
| `orb.rings.offsets` | `[0.9, 0.96, 1.01, 1.05, 1.09, 1.14]` |
| `orb.rings.tilts` | `[0.28, -0.46, 0.86, -1.02, 0.5, -0.22]` |
| `orb.rings.segments` | `140` |
| `orb.rings.lineWeight` | `2.4` |
| `orb.rings.opacity` | `0.46` |
| `orb.rings.dotsPerRing` | `24` |
| `orb.rings.dotSize` | `2.1` |
| `orb.rings.spinFollow` | `0.4` |
| `orb.rings.molten.offset` | `1.03` |
| `orb.rings.molten.tilt` | `0.12` |
| `orb.rings.molten.lineWeight` | `3.2` |
| `orb.rings.molten.opacity` | `0.6` |
| `orb.rings.molten.breatheAmp` | `0.16` |
| `orb.rings.molten.breatheHz` | `0.14` |
| `orb.states.idle.agitation` | `0.1` |
| `orb.states.idle.waveAmp` | `0.15` |
| `orb.states.idle.reactive` | `0` |
| `orb.states.idle.constel` | `0` |
| `orb.states.idle.spin` | `0.045` |
| `orb.states.idle.coreGlow` | `0.34` |
| `orb.states.listening.agitation` | `0.15` |
| `orb.states.listening.waveAmp` | `0.24` |
| `orb.states.listening.reactive` | `1` |
| `orb.states.listening.constel` | `0` |
| `orb.states.listening.spin` | `0.035` |
| `orb.states.listening.coreGlow` | `0.52` |
| `orb.states.thinking.agitation` | `0.8` |
| `orb.states.thinking.waveAmp` | `0.46` |
| `orb.states.thinking.reactive` | `0` |
| `orb.states.thinking.constel` | `1` |
| `orb.states.thinking.spin` | `0.15` |
| `orb.states.thinking.coreGlow` | `0.6` |
| `orb.states.speaking.agitation` | `0.28` |
| `orb.states.speaking.waveAmp` | `0.32` |
| `orb.states.speaking.reactive` | `1` |
| `orb.states.speaking.constel` | `0` |
| `orb.states.speaking.spin` | `0.06` |
| `orb.states.speaking.coreGlow` | `0.72` |

## `hud`

V.A.U.L.T HUD geometry (side columns, blueprint chrome).

| Token | Value |
|---|---|
| `hud.margin.x` | `46` |
| `hud.margin.y` | `40` |
| `hud.col.width` | `236` |
| `hud.row.gap` | `12` |
| `hud.block.gap` | `22` |
| `hud.eyebrow.px` | `9.5` |
| `hud.label.px` | `10.5` |
| `hud.value.px` | `12` |
| `hud.feed.px` | `10.5` |
| `hud.reg.size` | `6` |
| `hud.reveal.stagger.ms` | `45` |
| `hud.reveal.ms` | `520` |

## `voice`

Voice organ: wake/dismiss phrases, provider chain, VAD, envelope, test timings.

| Token | Value |
|---|---|
| `voice._note` | `SLICE V — THE VOICE. The mouth is ElevenLabs voice 'VULCAN 1' with a fail-soft chain (elevenlabs -> kokoro bm_george -> macOS say). id is the saved VULCAN 1 voice_id and is INERT without ELEVENLABS_API_KEY; empty falls back to env ELEVENLABS_VOICE_ID. daily_char_cap meters cloud TTS against the ~/.vulcan ledger; over budget drops to the local chain, but announce + confirm ALWAYS speak on the local voice regardless of budget. Fixed announcements pre-warm into ~/.vulcan/voice-cache and replay at zero character cost.` |
| `voice.wakeWord` | `fire and forge` |
| `voice.capture_mode` | `ptt` |
| `voice.ptt_key` | `Space` |
| `voice.ears._note` | `S2 THE TRIGGER — the ears chain. Primary STT is the Wispr Flow REST API (VULCAN_WISPR_KEY, main-side only, never logged/committed); no key / offline / API error drops SEAMLESSLY to the local whisper.cpp path. A drop is logged and tagged [EARS·LOCAL] in panel chrome, never thrown. wispr.* are the REST call params; the provider chain is fixed wispr -> local.` |
| `voice.ears.wispr.endpoint` | `https://platform-api.wisprflow.ai/api/v1/dash/api` |
| `voice.ears.wispr.language` | `[en]` |
| `voice.ears.wispr.timeoutMs` | `8000` |
| `voice.provider` | `auto` |
| `voice.providerChain` | `[elevenlabs, kokoro, say]` |
| `voice.id` | `B1tWAfxW4rR9RmxcXI9m` |
| `voice.daily_char_cap` | `8000` |
| `voice.elevenlabs.model_id` | `eleven_turbo_v2` |
| `voice.elevenlabs.stability` | `0.4` |
| `voice.elevenlabs.similarity_boost` | `0.7` |
| `voice.elevenlabs.style` | `0` |
| `voice.elevenlabs.use_speaker_boost` | `true` |
| `voice.cache.enabled` | `true` |
| `voice.prewarm` | `[Capturing to the vault.]` |
| `voice.dismissPhrase` | `bank the fire` |
| `voice.dismissPhrases` | `[bank the fire, stand down, bake the fire, bank the forge, bank fire, stand-down]` |
| `voice.muteKey` | `m` |
| `voice.startMuted` | `false` |
| `voice.silenceTimeoutMs` | `1200` |
| `voice.captureMaxMs` | `8000` |
| `voice.vad.threshold` | `0.02` |
| `voice.capture._note` | `RL-5 v2 PART 2 — MIC COEXISTENCE. echoCancellation/noiseSuppression/autoGainControl are FALSE on purpose: on macOS those constraints engage Apple's Voice-Processing I/O unit, which reconfigures the shared input device and breaks other apps' capture (operator's Wispr Flow dictation). Raw shared HAL capture coexists; VAD+whisper don't need the processing.` |
| `voice.capture.channelCount` | `1` |
| `voice.capture.echoCancellation` | `false` |
| `voice.capture.noiseSuppression` | `false` |
| `voice.capture.autoGainControl` | `false` |
| `voice.envelope.attack` | `0.5` |
| `voice.envelope.decay` | `0.12` |
| `voice.envelope.smoothing` | `0.8` |
| `voice.envelope.gateWatchdogGraceMs` | `2000` |
| `voice.ring.minResponse` | `0.35` |
| `voice.ring.maxResponse` | `1.35` |
| `voice.thinkMinMs` | `800` |
| `voice.session._note` | `v1.5 THE ATTENDANT — the hot session. DORMANT: wake phrase only. ATTENTIVE: every utterance is a command, no re-wake between exchanges. idle_to_dormant_min minutes of silence in ATTENTIVE auto-banks to DORMANT, announced first with autoDormantLine. reacquireEars re-acquires a fresh capture graph each listen (the v1.4 real-ears re-summon fix). v1.5.1 THE TRIGGER: with capture_mode 'ptt' the mic opens only while the trigger is held, so the self-hear feedback loop is structurally gone (the SELF-HEAR DEFENCE below is active for 'open' mode only). redirectLine is spoken when a held clip from DORMANT is neither the wake phrase nor a dismiss — never silence. SELF-HEAR DEFENCE (open mode): echoCancellation is OFF for mic coexistence, so after VULCAN speaks the reopened mic can catch the room echo of its own line -> a spurious command; speakGateSettleMs lets the echo decay below the VAD before the ear reopens; selfEchoGuard discards a capture that matches a line VULCAN just spoke.` |
| `voice.session.idle_to_dormant_min` | `5` |
| `voice.session.autoDormantLine` | `Banking the fire. Say Fire and Forge when you need me.` |
| `voice.session.fallbackLine` | `I didn't catch a command. Say it again, or ask for the mission brief.` |
| `voice.session.redirectLine` | `Hold the trigger and say Fire and Forge to wake me.` |
| `voice.session.reacquireEars` | `true` |
| `voice.session.speakGateSettleMs` | `650` |
| `voice.session.selfEchoGuard` | `true` |
| `voice.session.test.idleToDormantMs` | `4000` |
| `voice.session.test.speakGateSettleMs` | `150` |
| `voice.test.wakeDelayMs` | `900` |
| `voice.test.captureMs` | `1500` |
| `voice.test.thinkMs` | `850` |
| `voice.test.speakMs` | `3200` |

## `profile`

Mode system — default profile, switch key, crossflow.

| Token | Value |
|---|---|
| `profile.default` | `bonsai` |
| `profile.crossflow.ms` | `950` |
| `profile.switchKey` | `p` |

## `mission`

| Token | Value |
|---|---|
| `mission._note` | `B5R FIRST MISSION — VULCAN's job: the Bonsai Instant Citation launch. name drives the persona + wire voice. repos are git status targets (~ expands per machine). vercel_project is empty until connected (DEPLOY reads 'not connected' until then). pipeline is the outreach board, a vault-relative path INSIDE VULCAN/ containment. Machine-specific overrides (a real vercel_project, absolute repo paths) belong in tokens.local.json, never here.` |
| `mission.name` | `Bonsai Instant Citation` |
| `mission.repos` | `[~/vulcan, ~/bonsai]` |
| `mission.vercel_project` | `` |
| `mission.pipeline` | `VULCAN/Pipeline.md` |

## `map`

Summoned theater — sites, routes, terrain, summon crossflow, real-topo.

| Token | Value |
|---|---|
| `map.site.size` | `4.8` |
| `map.site.lift` | `0.55` |
| `map.site.pulse` | `[0.55, 1]` |
| `map.site.pulsePeriod` | `[4, 7]` |
| `map.site.labelPx` | `11` |
| `map.border.alpha` | `0.75` |
| `map.border.lift` | `0.14` |
| `map.border.labelPx` | `10` |
| `map.route.segments` | `90` |
| `map.route.arcHeight` | `1.7` |
| `map.route.baseAlpha` | `0.22` |
| `map.route.aheadAlpha` | `0.05` |
| `map.route.glow` | `1` |
| `map.route.speed` | `0.42` |
| `map.route.trailDecay` | `0.32` |
| `map.route.markerSize` | `5` |
| `map.route.holdMs` | `650` |
| `map.camera.pos` | `[0, 11.5, 22]` |
| `map.camera.look` | `[0, -2, -3]` |
| `map.camera.fov` | `34` |
| `map.terrain.grid` | `[300, 200]` |
| `map.terrain.spanX` | `46` |
| `map.terrain.spanZ` | `30` |
| `map.terrain.heightAmp` | `4.4` |
| `map.terrain.noiseScale` | `0.09` |
| `map.terrain.pointSize` | `1.9` |
| `map.terrain.albedoBoost` | `3.9` |
| `map.terrain.lightDir` | `[-0.55, 0.7, 0.28]` |
| `map.terrain.lightAmb` | `0.62` |
| `map.terrain.lightKey` | `3` |
| `map.terrain.fogDensity` | `0.02` |
| `map.orb.homePos` | `[0, 0.6, -23.5]` |
| `map.orb.homeScale` | `1` |
| `map.orb.dockPos` | `[6, -3.3, -13]` |
| `map.orb.dockScale` | `0.12` |
| `map.summon.durationMs` | `1500` |
| `map.post.bloom.threshold` | `0.62` |
| `map.post.bloom.strength` | `0.55` |
| `map.post.bloom.radius` | `0.32` |
| `map.post.grain` | `0.015` |

## `ink`

Molten working-ink intensities on summoned scenes (resting restraint for retune).

| Token | Value |
|---|---|
| `ink.site.rest` | `0.32` |
| `ink.site.heat` | `2.6` |
| `ink.route.rest` | `0.55` |
| `ink.route.heat` | `1.9` |
| `ink.route.alpha` | `0.28` |
| `ink.marker.rest` | `1.2` |

## `panel`

Tethered blueprint panels — geometry, granular glyph resolve/dissolve.

| Token | Value |
|---|---|
| `panel.width` | `300` |
| `panel.pad` | `20` |
| `panel.stroke.px` | `1` |
| `panel.reg.size` | `7` |
| `panel.title.px` | `12` |
| `panel.label.px` | `9.5` |
| `panel.value.px` | `11.5` |
| `panel.row.gap` | `9` |
| `panel.leader.alpha` | `0.5` |
| `panel.glyphMs` | `170` |
| `panel.glyph.stagger.ms` | `14` |
| `panel.offset.x` | `120` |
| `panel.reveal.ms` | `520` |
| `panel.text.delayMs` | `200` |
| `panel.dissolve.ms` | `360` |

## `wire`

The wire organ — poll cadence, keyword scoring, ignition/propagation/decay, heat discipline.

| Token | Value |
|---|---|
| `wire.pollMs` | `180000` |
| `wire.maxItems` | `48` |
| `wire.scoreThreshold` | `1` |
| `wire.ignite.ms` | `150` |
| `wire.propagate.hop.ms` | `[90, 220]` |
| `wire.propagate.hops` | `2` |
| `wire.cool.ms` | `95000` |
| `wire.heat.max` | `3` |
| `wire.hud.lines` | `5` |
| `wire.tick.decayMs` | `7000` |
| `wire.seed.size` | `5.4` |
| `wire.seed.igniteBoost` | `2.6` |

## `quotes`

The quotes organ — poll/cache cadence, greyscale mark geometry.

| Token | Value |
|---|---|
| `quotes.pollMs` | `60000` |
| `quotes.cacheMs` | `300000` |
| `quotes.mark.px` | `10` |
| `quotes.delta.px` | `9` |
| `quotes.lift` | `1.6` |
| `quotes.gap` | `2.2` |
| `quotes.reveal.ms` | `480` |

## `reflex`

Local reflexes — Ollama endpoint/model + enable flag.

| Token | Value |
|---|---|
| `reflex.ollama.url` | `http://localhost:11434` |
| `reflex.ollama.model` | `llama3.2:1b` |
| `reflex.ollama.timeoutMs` | `2500` |
| `reflex.enabled` | `true` |

## `obsidian`

| Token | Value |
|---|---|
| `obsidian._note` | `B3 HANDS II — VULCAN's second hand. The vault_path VALUE lives in tokens.local.json (gitignored) so no machine path lands in the committed tree; the node loader (brain/tokens.js) deep-merges it over this empty key. Delete it there to re-discover (a single registry vault is auto-recorded back into tokens.local.json), or set it to override. ALL writes are hard-confined to the VULCAN/ subtree (containment enforced in brain/skills/obsidian.js, not by this token).` |
| `obsidian.vault_path` | `` |

## `ignition`

The ignition ceremony (kindle → strike → title → resolve) + the quench, spark field, hotkey.

| Token | Value |
|---|---|
| `ignition.spark.count` | `2400` |
| `ignition.spark.edgeBias` | `0.8` |
| `ignition.ceremony.ms` | `3200` |
| `ignition.bank.ms` | `2600` |
| `ignition.strike.at` | `0.26` |
| `ignition.strike.width` | `0.14` |
| `ignition.title.text` | `VULCAN` |
| `ignition.title.inAt` | `0.5` |
| `ignition.title.outAt` | `0.86` |
| `ignition.hotkey` | `Alt+Space` |
| `ignition.spark.size` | `5.2` |
| `ignition.spark.hotPush` | `3.2` |
| `ignition.shock.max` | `5.2` |
| `ignition.shock.innerLag` | `0.34` |
| `ignition.quench.steamRise` | `1.35` |
| `ignition.quench.emberFall` | `0.55` |
| `ignition.backdrop.enabled` | `true` |

