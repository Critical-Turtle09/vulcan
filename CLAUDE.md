# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VULCAN — Silicon Forge Intelligence. A Jarvis-style GPU/semiconductor supply-chain terminal. It runs
full-screen on a Mac mini, summoned at login or by wake word. Sibling project to Hermes.

**Current state: Phase 2 (BUILD) → v1.4 COMMAND CENTER PIVOT.** The design spec is LOCKED
(v1.3 "FORGE AMENDMENT" + v1.4 "COMMAND CENTER PIVOT" — see below). Built so far: terrain
material test (Slice 0), the orb (Slice 1), the voice organ (ORGAN 1), the map rework
(Slice 2R), the Forge amendment (molten palette, wave-orb, V.A.U.L.T HUD, mode/profile
system), and RL-5 v2 stabilization (system-safety escapes, mic coexistence, packaged 60fps).
**v1.4 sharpens the mission: RETRIEVAL + PRESENTATION, not generation** — the conductor (v2)
routes spoken intent to tools and presents results in **blueprint panels**, now the primary
answer surface (`panels.present(content)`). The summonable **scene library (map/device/graph/
timeline) is deferred to v3** — dormant in-tree, keys are dev-only and off the HUD legend. The
interface is **orb-home**: VULCAN is the centered orb by default. The engine is
**domain-blind** — every organ reads the ACTIVE PROFILE (`profiles/*.json`); `semiconductor`
is the launch default, `bonsai` a scaffolded starter. Every visual value ships from
`tokens.json`; nothing is hardcoded in a component.

## Phases

1. **DESIGN** — lock spec from operator references (palette, type, motion physics).
   STATUS: LOCKED (v1.1). Red-lines RL-1 and RL-2 resolved (see §8).
2. **BUILD** — Electron + WebGL front end, built against the spec, slice by slice.
3. **ORGANS** — live quotes, RSS→Claude wire pipeline, whisper.cpp ears, ElevenLabs voice,
   cron autonomy.

## Working rules (non-negotiable)

- **Never one-shot the interface.** Build in slices: core orb → rings → panels. Get operator
  sign-off on each slice before moving to the next.
- **Screenshot your own work.** After any UI change: run the dev server, screenshot the
  rendering via Playwright, critique it against the spec, iterate. This machine takes its own
  screenshots — never ask the operator for one.
- **Check current APIs before coding.** Use context7 for up-to-date Three.js / GSAP / Electron
  APIs before writing against them; training data may be stale.
- **Real data or labeled SIM.** Never silently fake numbers. Anything not live is marked SIM.
- **Tokens, never hardcode.** All visual properties (colors, glows, type, spacing, motion
  curves) live in a single design-token layer — themes swappable via config, never hardcoded
  in components. The interface must support restyling from operator-provided references
  without structural rewrites.
- **Commit early and often.**

## Design bar / operator taste

The bar is Territory Studio / FUI grade. Everything moves, but with **shader weight, not DOM
animation**. Motion comes from the GPU (WebGL/shaders), not CSS tweens.

Explicitly rejected (from v0, "2002 video game"):
- CSS-tween feel
- stock sci-fi fonts
- dashed circles

## Design spec

> **DESIGN SPEC v1.3 "FORGE AMENDMENT" — LOCKED.** (v1.2 deleted the ambient globe; v1.3
> amends the accent to MOLTEN ORANGE, revises the orb form to audio-reactive WAVES, extends
> the HUD to the V.A.U.L.T side columns, sets the wake phrase to "Fire and Forge", and makes
> the engine domain-blind via a profile/mode system — see the FORGE AMENDMENT block below and
> §3/§6/§8.) Canonical copy: `VULCAN-DESIGN-SPEC-v1.md`. Every visual decision derives from
> the operator's reference corpus (REF-01…14). Nothing here is a default; if a choice must
> deviate during build, flag it — never silently substitute.

### COMMAND CENTER PIVOT (v1.4) — foundation decision, amends the mission

> **SPEC v1.4 "COMMAND CENTER PIVOT" — LOCKED.** A foundation decision about what VULCAN
> *is for*. The visual identity is untouched; the mission is sharpened.

- **MISSION — RETRIEVAL + PRESENTATION, not generation.** VULCAN's core job is to fetch what
  the operator asks for and *present* it beautifully — not to write prose or invent content.
  The **conductor** (v2) routes spoken intent to tools — **Obsidian, GitHub, Vercel, Claude
  Code, Hermes** — and renders the results in **BLUEPRINT PANELS** (the existing Front-D
  surface): dossiers, statuses, lists, note contents, deploy states.
- **PANELS ARE THE PRIMARY ANSWER SURFACE.** A panel can render **arbitrary retrieved
  content** — `{ eyebrow?, title, rows?: [[k,v,cls?]], list?: [str], body? }` — summoned
  **programmatically**, untethered to any 3D scene, on the same blueprint chrome + per-glyph
  granular resolve (doctrine 11). This is the conductor's mouth-to-screen path:
  `panels.present(content)` / `window.__vulcanHome.present(content)`. Verified by a static
  fixture (`data/present-fixture.json`, `presentTest()`).
- **SCENE LIBRARY DEFERRED TO v3.** The summonable scenes (map, device/schematic, graph,
  timeline) are **dormant**: code stays in-tree, but there is **no further investment** until
  the conductor era is proven. Their keyboard shortcuts (t/v/n/k summon · x device · e explode ·
  0 home · 1-4 orb state) are **DEV/DEBUG overrides only** — undocumented, **removed from the
  HUD legend**. Scenes are summoned by spoken intent, not keys. (This supersedes the earlier
  scene-key note; the map rebuild — old RL-5 PART 4 — is **cancelled**.)
- **IDENTITY LAYER — UNCHANGED AND PROTECTED.** The orb (wave form + rings + states), the
  ignition/quench ceremony, the wire heat ticks, the V.A.U.L.T columns, and the voice loop are
  the locked identity and must not regress. The pivot changes *what fills the panels*, never
  the house material or the ceremony.

### FORGE AMENDMENT (v1.3) — deltas over v1.2

- **PALETTE — molten, not ember.** The single rationed accent is now **MOLTEN ORANGE**
  (lava / sunset / molten-iron heat): `signal.molten #EA6A1E`, ignite flash `signal.forge
  #FF8A3D`, decay `signal.cooled #7E3A1B`. Ember red is retired everywhere. Discipline is
  unchanged: greyscale world, bone-white data, ONE dominant heat signal (2–3 max on screen),
  **≤2% heat pixels** in ambient state. Heat = meaning (events / alerts only), never decoration,
  never price.
- **ORB (Front B revised) — WAVES, not a ring.** The Saturn ring is RETIRED. VULCAN's form is
  a particle-field sphere whose OUTER CONTOUR is **waves** — granular displacement of the house
  dust (never smooth neon lines); the particle body rides the waves as its foundation.
  **Audio-reactive:** waves stir to the operator's MIC amplitude while *listening*, surge to the
  TTS envelope while *speaking*, and settle to a near-calm sea + tiny breathing heartbeat at
  *idle*; *thinking* churns the sea and surfaces the network constellations (Skyfall read). Home
  scale is reduced (~60%, `orb.scale`). Network constellations survive as the thinking state.
  **Wave-rings (refinement):** 2–4 HAIRLINE bone contour rings thread the orb at offset radii —
  **lines**, but NEVER straight or perfectly circular: each is continuously noise-displaced
  (wavy, molten-surface read) and independently phased, and is audio-reactive like the body
  (calm undulation at idle → surge with mic/TTS). `orb.rings.*` tokens.
- **VOICE = SUMMON + DISMISS.** The wake phrase routes through the SAME summon path as the
  Alt+Space hotkey: from hidden, "Fire and Forge" plays the FULL ignition (sparks → surge →
  condense → cool) with the voice reply riding the summon. While resolved, the listener also
  accepts a **dismiss phrase** — "Bank the fire" (default) or "Stand down" (`voice.dismissPhrase`
  / `voice.dismissPhrases`) → reverse ignition → hidden, underlying apps untouched. `Esc` banks
  as a fallback (a global shortcut registered ONLY while resolved, so it never eats Esc elsewhere).
- **OVERLAY, not a Space.** The command center is a borderless, always-on-top overlay that JOINS
  the currently active Space + monitor — **never** native macOS fullscreen (which would open a
  separate Space and yank the operator away). Say the phrase in any app and VULCAN resolves OVER
  that screen; banking reveals the same apps, no Space animation, no app switch, focus restored
  to the app that was frontmost. The cursor stays visible (instrument reticle) and an `ESC · BANK`
  affordance is always shown while resolved. During the ceremony the **real screen shows beneath
  the sparks** (the canvas lighten-composites over an active-display snapshot; the void floor
  fades in as it resolves) — the opaque-void deviation is rejected.
- **THE CEREMONY (own duration tokens, EXEMPT from the reveal band).** Summon and bank are
  signature moments, not ordinary reveals. **IGNITION (~3s, `ignition.ceremony.ms`):** sparks
  kindle over the visible screen → an abstract **hammer-on-anvil STRIKE** (one molten hairline
  shockwave ring thrown from the impact — particle/hairline read, never clipart) throws the surge
  → sparks condense and cool → a **"VULCAN" mono-caps title beat** resolves in and dissolves into
  the orb + V.A.U.L.T. **BANK (~1.8s, `ignition.bank.ms`) — THE QUENCH:** heat drains outward,
  steam-spark pull upward, steel cooling to grey as the real screen is revealed. One continuous
  material both directions; no cuts. `ignition.*` tokens (`strike.*`, `title.*`, `bank.ms`).
- **HUD "V.A.U.L.T" (Front D extended) — side columns only.** LEFT column = **system vitals**
  (voice / wire / quotes status, mode, uptime, heat index). RIGHT column = **command deck**
  (active profile, directives, live wire-feed lines, recent events). Hairline Palantir blueprint
  chrome, mono-caps, registration marks. Columns populate from real live state — no fake data.
  **No bottom telemetry bar** (standing dislike-law, §7).
- **WAKE PHRASE — "Fire and Forge"** (`voice.wakeWord`). "Vulcan" is retired as a wake word.
- **MODE SYSTEM — profiles, domain-blind engine.** `profiles/*.json` describe a domain
  (entities, wire feeds + keywords, quote symbols, panel dossiers, map on/off, HUD metrics). The
  engine reads the ACTIVE profile and never hardcodes a domain. `semiconductor.json` is the v1
  launch default; `bonsai.json` is a scaffolded starter (placeholder entities, map disabled).
  Switch via key `P` (or command) with a granular crossflow. `profile.*` tokens.

### 0 · HOW TO READ THIS (Claude Code)

- All values ship as **design tokens** (`tokens.json` → CSS vars + Three.js uniforms). Never hardcode a color, duration, easing, or size in a component.
- Scene objects (world, orb, arcs, particles) live in **shader space** (Three.js). DOM is only for panel text. **No CSS/DOM tweens on anything that reads as part of the world.**
- When in doubt, consult §2 doctrines and §7 kill list. The bar: *every frame should pass as an insert shot in a modern briefing-room scene.*

### 1 · DESIGN DNA — the corpus and what each reference donated

| REF | Source | Donated axis |
|---|---|---|
| 01 | Dune: Part Two — Harkonnen war table (Territory) | World-as-interface; sand-table staging; ember-on-carbon palette seed |
| 02 | Top Gun: Maverick briefing (BLIND) | Instrument grammar; solid=actual vs projected paths; tethered callouts; mono-caps asset labels |
| 03 | Anduril Lattice site | Particle-matter world; fully-greyscale discipline; fluid field drift; browser-native proof |
| 04 | Dawn of the Planet of the Apes titles | EVENT BEHAVIOR: seed → branch → propagate along network routes (surface discarded) |
| 05 | Avatar ops table | ANGLE only: high-oblique 3D map view |
| 06 | Skyfall database orb (BLIND) | Orb as network-sphere (nodes + edges), monochrome |
| 07 | Age of Ultron orbs | CONCEPT only: AI presence as a conversing orb (glow discarded) |
| 08–10 | Spectre / Bond screens | Scanline-halftone globe; extruded-dot city; source→event line grammar; **dislike law: no bottom telemetry bars** |
| 11 | Spectre watch schematic | ORGAN SEED (post-design): exploded technical teardown mode (GPU/chip anatomy) |
| 12 | Dune: Prophecy crystal holograms (Territory) | TRANSITION MATERIAL: granular particle formation/dissolution — "grainy yet advanced, fluid" |
| 13 | Interstellar Gargantua | ORB FORM: dark core + luminous orbital ring/disk — never a plain circle |
| 14 | Palantir homepage | PANEL LANGUAGE: blueprint-wireframe schematics, hairline strokes, registration marks; quiet grotesk; 4th ringed-orb vote |

**Corpus synthesis:** *Apes propagation logic, rendered in Anduril material, staged like Dune's war table, annotated with Maverick's instrument grammar, paneled like Palantir blueprints, fronted by a Gargantua-form orb.*

### 2 · DOCTRINES (laws — every slice is audited against these)

1. **World-as-interface.** Data is drawn ON the world (terrain, globe, orb), not boxed beside it.
2. **No ink without meaning.** Every mark binds to data. Decorative marks are forbidden — the dashed line is legitimate only when dashes encode "projected, not actual."
3. **Instrument, not spectacle.** Plausible hardware someone operates. Restraint over drama.
4. **Silence-to-signal ratio.** Most of every frame is quiet, textured ground; data is a whisper on top.
5. **Tiny heartbeat idle.** At rest, screens "just sit, tick over" — perpetual sub-1% motion, never static, never busy.
6. **The medium reorganizes.** Nothing slides or fades as a rectangle; things form and dissolve as granular matter (REF-12).
7. **Hero dominant.** One hero object per state. No bottom telemetry strips, no cockpit dashboard chrome (REF-08/10 dislike law).
8. **Rationed color.** Greyscale world · bone-white data · one scarce ember signal. Color = meaning, never decoration.
9. **Type is engineered, not costumed.** No stock "sci-fi" faces. Character comes from setting (caps, tracking, tabular figures), not letterform theatrics.
10. **Tokens, never hardcode.** (Constitution law, restated because it gates every other law.)
11. **Nothing arrives instantly.** *(v0 autopsy, finding #2 — operator law.)* Every click, query, dive, or data reveal answers with a fluid transition in the house material. Text and evidence *resolve* into being — granular, per-glyph — they never pop in. Outgoing and incoming states cross-flow; there is no frame where the screen simply cuts. A hard cut anywhere is a build-failing bug, not a style choice. Fluidity comes from **material continuity, never slowness** — the terminal must still feel instant: the transition *is* the response.

### 3 · PALETTE TOKENS

```json
{
  "void":          "#050607",   // deep stage black, not pure #000
  "stage":         "#0A0B0D",   // panel/scene floor black
  "terrain.deep":  "#16181B",
  "terrain.mid":   "#24272B",
  "terrain.high":  "#383C42",
  "haze":          "#5A5F66",   // atmosphere, DOF fog, rim light base
  "data.bone":     "#E6E4DE",   // primary data ink — never pure white
  "data.dim":      "#9A9DA2",   // secondary data, cooled labels
  "data.faint":    "#55585E",   // grid ghosts, contour lines, panel hairlines
  "signal.molten": "#EA6A1E",   // THE accent (v1.3). Events, alerts. Molten-iron heat. Bloom-boosted.
  "signal.forge":  "#FF8A3D",   // ignite flash — the hottest crest of an event
  "signal.cooled": "#7E3A1B",   // molten decay state (event aging toward archive)
  "panel.stroke":  "#3A3E44"    // blueprint hairlines, registration marks
}
```

- **Ink-doctrine amendment (PART 3).** On **summoned scenes** (theater/schematic/etc.) molten is
  the **working data ink** — routes, site dots, and data marks are a restrained molten; a HEAT
  EVENT distinguishes itself by **intensity + motion** (forge-hot, pulse, propagation, bloom), not
  by being the only orange. Equity **quotes stay greyscale** (price is never heat). The **ambient
  orb-home** state keeps the strict discipline below. Resting intensities live in `ink.*` for retune.
  Every summoned scene carries a one-line bone mono-caps **LEGEND** (what it is + what marks mean);
  labels carry role context ("TSMC · HSINCHU · FAB"). No unexplained text.
- Molten heat appears on **<2% of any frame's pixels** in ambient state. If heat is common, heat is meaningless.
- Event recency is encoded as **heat**: ignite at `signal.forge` → settle to `signal.molten` + bloom flash → cool toward `signal.cooled` → archive at `data.faint`.
- No other hues. No blues, no greens, no gradients-as-decoration. Molten is never used for price (quotes stay greyscale value + delta mark). Friend/foe, if ever needed, is bone vs molten.

### 4 · TYPE TOKENS

| Role | Face | Setting |
|---|---|---|
| Data / numerics / micro-labels | **Martian Mono** | 10–13px · ALL CAPS for labels · tracking +6–10% · tabular figures always |
| UI / headers / panel titles | **Archivo** (use width axis; Expanded for rare display moments) | Sentence case for prose, caps for eyebrows · weights 400/500/600 only |
| Fallback stack | `ui-monospace / system-ui` | degrade gracefully, never substitute a themed font |

- Asset labels ride their objects (REF-02): small mono caps, tethered, colored by state (`data.bone` / `signal.ember`).
- **Banned:** Orbitron, Audiowide, Michroma, Eurostile-alikes, any "techno" display face. (Paid upgrades if ever wanted: Söhne Mono / Neue Haas Grotesk — same personality, deeper cut. Not required.)

### 5 · MOTION PHYSICS TOKENS

```json
{
  "idle.camera.driftAmp":    0.003,      // ±0.3% position, Perlin-driven
  "idle.camera.driftPeriod": [20, 40],   // seconds, randomized
  "idle.node.pulse":         [0.85, 1.0],// opacity heartbeat
  "idle.node.pulsePeriod":   [4, 7],     // s, desynced per node
  "transition.granular.ms":  [400, 700], // form/dissolve duration
  "transition.granular.stagger": "noise",// per-particle, never linear
  "arc.head.speed":          0.2,        // normalized length/s, bright head
  "arc.trail.decay":         [1.5, 3.0], // s, luminance falloff behind head
  "propagate.hop.ms":        [80, 200],  // per-edge stagger (Apes law)
  "propagate.ignite.ms":     150,        // bloom flash on seed/impact
  "dive.spring":             { "mass": 1, "tension": 120, "friction": 26 }, // critically damped, zero bounce
  "dive.duration.s":         [1.2, 1.8],
  "post.bloom":              { "threshold": 0.7, "intensity": "low" },
  "post.grain":              0.04,       // 3–5% film grain, always on
  "post.chromAb.px":         1.0,        // edges only, subtle
  "post.vignette":           "faint",
  "post.dof":                "dive & focus states only",
  "feedback.first.ms":       100,        // clicked/queried object reacts (brighten/ignite) within this
  "reveal.ms":               [240, 700], // ALL interaction reveals complete in this window — fluid ≠ slow
  "reveal.text.perGlyph.ms": [12, 24],   // text resolves in, capped ~400ms per block
  "state.crossflow":         true        // outgoing dissolves WHILE incoming forms — zero-gap, zero-cut
}
```

- **Arrival:** granular resolve (§2.6). **Departure:** granular dissolve. **Never** opacity-fade or slide alone.
- **Interaction law (§2.11):** the transition IS the response. Feedback begins <100ms on the touched object; the reveal completes fluidly within `reveal.ms`. No click, voice command, or data pull may ever answer with a cut.
- **Events:** seed ignites → propagates hop-by-hop along real network edges → branches → cools over hours (heat = recency).
- **Idle is sacred:** if all data stops, the frame still breathes (camera drift + node heartbeat + grain).
- Honor `prefers-reduced-motion`: drop camera drift + propagation animation to instant-state; keep grain static.

### 6 · COMPOSITION GRAMMAR

**STAGE (A).** The void, with atmosphere. World objects are *lit bodies* staged like Dune's table: rim light, haze, grain, shallow DOF at rest. Nothing floats in flat black; everything sits in air.

**ORB (B) — VULCAN's presence AND the home interface (v1.3 WAVE FORM).** Dark-core particle
sphere whose OUTER CONTOUR is **waves** — granular displacement of the house dust (the Saturn
ring is retired; never smooth neon lines). The particle body rides the waves as its foundation.
**The orb is the default screen — centered (~60% scale), full presence, the protagonist** (not
docked, not cornered). It only shrinks to a small docked presence while the map is summoned.
States (the sea is **audio-reactive**):
- *idle* — near-calm sea + a tiny breathing heartbeat
- *listening* — waves stir to the operator's live MIC amplitude
- *thinking* — the sea churns and network constellations surface (Skyfall read as a state, not the body)
- *speaking* — waves surge to the TTS playback envelope (real analyser, never a formula)

Threaded through the body are **2–4 hairline bone wave-rings** (`orb.rings.*`) — contour lines
at offset radii, noise-displaced so they are never straight or circular, independently phased, and
audio-reactive like the sea (calm undulation at idle → surge with mic/TTS).

**MAP (C) — SUMMONED theater (v1.2, NO GLOBE).** There is no ambient globe — no globe anywhere, ever. Geography is not persistent; it is *summoned* only when needed. On summon, the interface transforms orb → theater in one continuous granular crossflow: the orb dissolves as the region's terrain forms from the same dust, and the orb re-forms small/docked. Return reverses identically — the orb re-forms center.
- The theater is an **oblique 3D sculptural terrain of the relevant REGION** — the Top Gun: Maverick briefing-map read (REF-02): monochrome sculpted topography, thin precise white route lines and data marks, instrument realism; Avatar (REF-05/07) oblique angle. No atlas chrome.
- **Route traversal (the Maverick plane):** supply routes are thin white arcs; a small bright 3D marker travels the active route, drawing/brightening the line as it moves (Apes propagation grammar — a seed moving through the network). One dominant traversal at a time.
- Regions of the silicon corridor: Taiwan, Veldhoven/EU, N. America, Korea (keys t/v/n/k).

**PANELS (D).** Blueprint-schematic language (Palantir + Maverick): hairline `panel.stroke` outlines, registration marks, tethered leader-lines anchored to world objects. Panels exist only on interrogation — they resolve in granularly, they never dock to screen edges as bars, and the hero always outweighs them. Quotes/wire/alerts render as schematic annotations, not dashboard widgets.

**HUD "V.A.U.L.T" (D, extended v1.3).** Two hairline blueprint **side columns** frame the orb —
never a bottom bar. LEFT = system vitals (state, voice/wire/quotes status, heat index, uptime).
RIGHT = command deck (active profile, directives, live wire-feed lines, recent events). Mono-caps,
registration marks, `panel.stroke` rules. Rows resolve in staggered (never a pop-in block) and
populate ONLY from real live state — no fake numbers. The hero orb/theater always outweighs it.

### 7 · KILL LIST (instant red-line, from the v0 autopsy + corpus dislikes)

Stock sci-fi fonts · decorative dashed circles · hexagon wallpaper · lens flares · saturated neon · glitch-as-decoration · bottom telemetry strips · dashboard chrome · pure #FFF or #000 · flat vector maps · DOM tweens on world objects · any mark that encodes nothing · **instant hard cuts, pop-in text, anything that "just appears."**

**Acceptance test per slice:** (1) briefing-scene test — could this frame appear in a modern military-briefing film insert? (2) ink audit — point to any mark, name the datum it encodes. (3) tokens audit — zero hardcoded visual values. (4) **fluidity audit — trigger every state change in the slice; any element that appears or vanishes without a material transition fails the slice.**

### 8 · RED-LINE DECISIONS — **LOCKED** (operator adopted both recommendations)

**RL-1 · Map canvas (C1). → ~~HYBRID~~ SUMMONED THEATER. LOCKED (amended v1.2).** The v1.1 hybrid
globe is **struck** — no globe anywhere. Home is the orb (§6-B); geography is summoned only on
demand, transforming orb → oblique sculptural terrain theater of the region via one continuous
granular crossflow (orb dissolves as terrain forms from the same dust; orb docks small). The
Maverick briefing-map read replaces the war-table globe. The summon/return crossflow is VULCAN's
signature move; route traversal (the Maverick plane) is the theater's live grammar.

**RL-2 · Orb body material (B). → PARTICLE-FIELD. LOCKED.** Particle-field body with dark core +
luminous ring (Gargantua form in Anduril matter — "the living entity"), with **network
constellations surfacing only in thinking state** (the Skyfall read appears when VULCAN is
actually traversing its graph). Both references survive, each as a state.

### 9 · SLICE 0 — MATERIAL TEST (first build; the true preview)

One full-screen scene, no UI, no data feeds: `void` + grain + atmosphere → a particle-terrain patch drifting (idle physics) → one node heartbeat → one ember event ignites, propagates two hops, begins cooling → one mono-caps label resolves in per-glyph beside the event, holds, dissolves (fluidity-law test). Camera drifts on Perlin. All values from tokens.
**Review protocol:** Claude Code renders → screenshots itself via Playwright → operator judges against §7 acceptance tests. Pass = proceed to Slice 1 (orb). Fail = tune tokens, not doctrine.
