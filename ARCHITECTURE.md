# VULCAN — Architecture

VULCAN is an **Electron shell** around a **WebGL renderer**. The renderer is the
whole interface (orb, theaters, HUD, ceremony); the main process owns the native
capabilities the renderer can't reach (mic transcription, TTS, cross-origin
fetches, the resident overlay, screen capture, local inference). A single
`tokens.json` is the source of visual truth; a single **active profile** is the
source of domain truth. The engine is **domain-blind**.

```
                         ┌────────────────────── Electron main ──────────────────────┐
                         │  electron/main.js      resident overlay · tray · hotkey ·  │
                         │                        active-Space window · desktop snap  │
                         │  voice-main.js         TTS provider chain · whisper · reflex│
                         │  wire-main.js          RSS poll (CORS)                     │
                         │  quotes-main.js        quotes poll (CORS)                  │
                         └───────────────▲───────────────── preload.cjs ─────────────┘
                                         │ contextBridge (window.vulcan)
   ┌─────────────────────────────────── Renderer (src/) ───────────────────────────────┐
   │  orb/main.js         orchestrator: scene graph, summon state machine, ignition,    │
   │                      HUD, key/pointer input, per-frame loop, audit hooks           │
   │  orb/orb.js          particle body · audio-reactive waves · wave-rings · heat tick │
   │  ignition.js         the ceremony (kindle · strike · quench) spark field           │
   │  map/theater.js      summoned terrain · sites · molten routes · heat               │
   │  map/panels.js       tethered blueprint dossier panels (granular resolve)          │
   │  scenes/schematic.js device/schematic scene (condense + explode)                   │
   │  scenes/index.js     scene-type registry (map · schematic · graph · timeline)      │
   │  wire.js  quotes.js  organs: heat model / greyscale price marks                     │
   │  reflex.js           short-intent routing (regex → Ollama)                          │
   │  voice/*             the voice loop: ears → brain → mouth, envelope → orb           │
   │  profile.js          active-profile store (domain-blind engine)                     │
   │  topo.js  tokens.js  real geography loader · token resolver                         │
   └───────────────────────────────────────────────────────────────────────────────────┘
```

## The engine (renderer)

`src/orb/main.js` is the orchestrator. It owns:

- **One Three.js scene** with a fixed oblique camera. The **orb** is parented to
  the camera (screen-fixed); the **theater** and **schematic** live in world space.
- **Summon state machine** — `home → summoning → theater → dismissing`, eased into
  `summonP` (0→1). It drives the orb dock/dissolve crossflow and gates each scene's
  reveal. `sceneKind` selects map vs schematic.
- **Ignition state machine** — `presence` (0 hidden → 1 resolved) with its own
  ceremony/quench durations (exempt from the reveal band). Drives the spark field,
  the void backdrop opacity, HUD chrome, and the title beat.
- **Per-frame loop** — advances both machines, feeds the orb/theater/schematic,
  routes wire heat, paints labels/quotes/legend/HUD, renders through the post chain.
- **`window.__vulcanHome`** — a harness surface (summon, ignite, setState,
  wireInject, reflexTest, `__holdPresence`, …) used by the regression audit.

## Organs (main-process capabilities, renderer logic)

Each organ is a renderer module backed by a main-process IPC handler, and each is
**fail-soft** (a missing key/feed/model degrades to a labeled offline state):

- **Voice** (`voice/*` + `voice-main.js`) — a continuous loop: **ears** (whisper
  wake + capture) → **reflex/brain** → **mouth** (TTS). Every stage is an
  `orb.setState`, so the loop is one material reorganization. The mouth plays every
  provider through the same analyser, so the **envelope drives the orb + rings
  identically**. Provider chain: elevenlabs → kokoro → `say`.
- **Wire** (`wire.js` + `wire-main.js`) — polls the profile's keyless RSS feeds,
  keyword-scores items to sites, ignites **molten heat** that propagates along
  routes and decays. Heat discipline is bounded.
- **Quotes** (`quotes.js` + `quotes-main.js`) — polls the profile's symbols
  (keyless), renders **greyscale** price marks (heat is never used for price).
- **Reflex** (`reflex.js` + `reflex:classify`) — short commands resolve locally
  (regex, then a small Ollama model); non-commands fall through to the brain.

## Profiles (domain truth)

`profiles/*.json` describe a domain: entities, wire feeds + keywords, quote symbols,
panel dossiers, map on/off + regions (with optional topo bboxes), HUD metrics.
`src/profile.js` holds the active-profile store; switching crossflows and re-targets
every organ. **The engine hardcodes no domain.** `semiconductor` is the launch
default; `bonsai` (map off) and `political` (map on) are drafts.

## Scenes (the summonable vocabulary)

`src/scenes/index.js` is the registry the future brain routes into: **map** (live),
**device/schematic** (draft), **graph/network** and **timeline** (planned). Each
scene condenses from and dissolves back to house-material dust.

## Data

- **Topography** — `data/topo/*.json` are per-region land/sea + relief grids built
  from public-domain **Natural Earth** by `scripts/build-topo.mjs` (see
  `data/topo/README.md`).
- **Tokens** — `tokens.json` → CSS vars (DOM) + Three.js uniforms (shader). The
  only place a color/duration/size may be defined.

## Build / verify

- `npm run audit` — Playwright harness measuring every transition for doctrine-11
  fluidity (`FLUIDITY-AUDIT-v2.md`).
- `npm run tokens` — regenerate `TOKENS.md`.
- `npm run topo` — rebuild topography from Natural Earth sources.
