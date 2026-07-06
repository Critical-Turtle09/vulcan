# VULCAN — Silicon Forge Intelligence

A Jarvis-grade situational terminal. VULCAN runs resident on a Mac, summoned by
voice ("**Fire and Forge**") or a global hotkey. It answers as a centered,
audio-reactive **orb**, and *summons* geography, device schematics, and live data
into an oblique briefing theater on demand. Everything moves with **shader weight,
not DOM tweens**; every visual value ships from a single [`tokens.json`](tokens.json)
layer, so the whole interface restyles from an operator reference without code
changes.

The design bar is Territory-Studio / FUI grade — see [`CLAUDE.md`](CLAUDE.md) for the
locked **DESIGN SPEC v1.3 "FORGE AMENDMENT"** and its doctrines.

---

## The ceremony

VULCAN is resident: it launches at login and hides to a menu-bar (tray) item
instead of quitting; the wake listener stays live while hidden.

- **Summon** — say **"Fire and Forge"** (or press the hotkey) from *any* app.
  Molten sparks kindle over your real screen → an abstract **hammer-on-anvil
  strike** throws the surge → the sparks condense and cool → a **"VULCAN" title
  beat** → the orb + command center resolve. The overlay joins your *current*
  Space/monitor — never a native-fullscreen Space switch.
- **Bank** — say **"Bank the fire"** / **"Stand down"**, or press `Esc`. **The
  quench**: heat drains outward, steel cools to grey, your real screen returns
  with focus restored to the app you were in.

## The orb (home)

A dark-core particle sphere whose contour is **waves** of the house dust, threaded
by hairline **wave-rings**. Both are **audio-reactive**: waves + rings stir to your
mic while *listening*, surge to the reply while *speaking*, and settle to a
near-calm sea + heartbeat at *idle*; *thinking* churns the sea and surfaces the
network constellations.

## The theaters (summoned)

- **Map / routes** — an oblique sculptural terrain of a region (real coastlines
  from public-domain Natural Earth data), with molten supply routes, site dossiers,
  live **wire** events (molten heat that ignites at a site and propagates along the
  network), and greyscale **equity** marks.
- **Device / schematic** *(draft)* — a parametric GPU board that condenses from
  dust and **explodes** into labeled components.

The engine is **domain-blind**: every organ reads the active **profile**
(`profiles/*.json`). `semiconductor` is the launch default; `bonsai` and
`political` are drafts.

---

## Key map

| Key | Action |
|---|---|
| **Fire and Forge** / hotkey (`Alt+Space`) | summon the overlay |
| **Bank the fire** / **Stand down** / `Esc` | bank (hide, restore your app) |
| `T` `V` `N` `K` | summon Taiwan / Veldhoven-EU / N. America / Korea |
| `X` | summon device schematic · `E` explode / reassemble |
| click a site (or its number) | open its dossier panel |
| `1`–`4` | orb state (idle / listening / thinking / speaking) |
| `M` | mute mic · `P` switch profile · `0` orb home |

Voice also drives **local reflexes** — short commands ("pull up Korea", "mute",
"explode it", "status", "switch profile") resolve locally and instantly (regex,
then a small local Ollama model), skipping the cloud brain.

---

## Setup

```bash
npm install
npm start          # vite dev server + Electron (resident overlay)
# or, headless renderer only:
npm run dev        # then open http://localhost:5273
```

### Environment (`.env`) — field names only

Copy `.env.example` to `.env` and fill in. **Never commit real values.**

| Field | Purpose | Absent → |
|---|---|---|
| `ELEVENLABS_API_KEY` | cloud TTS (the mouth) | fails over to local `say` |
| `ELEVENLABS_VOICE_ID` | optional voice selection | stock voice |
| `WHISPER_BIN`, `WHISPER_MODEL` | local wake-word + transcription (the ears) | live wake disabled |
| `VULCAN_VOICE_TEST` | synthetic voice loop (no mic/network) | off |
| `VULCAN_TTS_PROVIDER` | force a TTS provider (`elevenlabs`\|`kokoro`\|`say`) | auto-failover chain |
| `KOKORO_BIN` | optional local Kokoro TTS CLI | skipped in the chain |
| `VULCAN_DEV_URL` | override the renderer URL | `http://localhost:5273/` |

Optional local intelligence: install **Ollama** (`brew install ollama`,
`ollama pull llama3.2:1b`, `brew services start ollama`) for the reflex layer —
fully fail-soft if absent.

---

## Commands

| Command | What |
|---|---|
| `npm start` | resident Electron overlay + dev server |
| `npm run dev` | renderer only (browser) |
| `npm run audit` | regression harness — measures every transition for fluidity → `FLUIDITY-AUDIT-v2.md` |
| `npm run tokens` | regenerate [`TOKENS.md`](TOKENS.md) from `tokens.json` |
| `npm run topo` | rebuild region topography from Natural Earth data |

## Docs

- [`CLAUDE.md`](CLAUDE.md) — the locked design spec + doctrines (the constitution).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — engine / organs / profiles / scenes.
- [`TOKENS.md`](TOKENS.md) — every design token (generated).
- [`FLUIDITY-AUDIT-v2.md`](FLUIDITY-AUDIT-v2.md) — measured fluidity of every transition.
