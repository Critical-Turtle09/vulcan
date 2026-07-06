# VULCAN — DESIGN SPEC v1.3 "FORGE AMENDMENT"
<!-- Living copy of the deltas lives in CLAUDE.md → "## Design spec" (kept in lockstep). -->
<!-- Every visual decision below derives from the operator's reference corpus (REF-01…14). -->
<!-- Nothing here is a default. If a choice must deviate during build, flag it — never silently substitute. -->
<!-- v1.1: FLUIDITY LAW elevated to doctrine 11 (v0 autopsy finding #2 — instant hard cuts). -->
<!-- v1.2: ambient globe deleted; home is the orb, geography is summoned (Front C). -->
<!-- v1.3 FORGE AMENDMENT: accent → MOLTEN ORANGE; orb ring → audio-reactive WAVES; HUD → V.A.U.L.T
     side columns; wake phrase → "Fire and Forge"; engine domain-blind via profiles/ mode system. -->

> **v1.3 FORGE AMENDMENT (deltas over v1.1/v1.2):**
> - **Accent = MOLTEN ORANGE** (`signal.molten #EA6A1E`, flash `signal.forge #FF8A3D`, decay
>   `signal.cooled #7E3A1B`). Ember red retired. Discipline unchanged — ≤2% heat pixels, heat = meaning.
> - **Orb = WAVES** (Saturn ring retired): particle sphere whose outer contour is granular wave
>   displacement of the house dust; audio-reactive (mic while listening, TTS envelope while
>   speaking, calm heartbeat at idle, churn + constellations while thinking). Home scale ~60%.
>   **+ 2–4 hairline bone wave-rings** (`orb.rings.*`) threading the orb — noise-displaced (never
>   straight/circular), independently phased, audio-reactive like the body.
> - **Overlay + voice dismiss:** the command center is a borderless always-on-top overlay that
>   joins the ACTIVE Space/monitor (never native fullscreen). Wake routes through the same summon
>   path as the hotkey (full ignition + reply). Dismiss phrase "Bank the fire" / "Stand down"
>   (`voice.dismissPhrase(s)`) reverses to hidden; `Esc` banks (global only while resolved).
> - **HUD = V.A.U.L.T** — hairline blueprint side columns: LEFT vitals, RIGHT command deck. No
>   bottom bar. Real live state only.
> - **Wake phrase = "Fire and Forge"** (`voice.wakeWord`).
> - **Mode system** — `profiles/*.json` drive a domain-blind engine; `semiconductor` default,
>   `bonsai` scaffold. Switch key `P`, granular crossflow.

## 0 · HOW TO READ THIS (Claude Code)

- All values ship as **design tokens** (`tokens.json` → CSS vars + Three.js uniforms). Never hardcode a color, duration, easing, or size in a component.
- Scene objects (world, orb, arcs, particles) live in **shader space** (Three.js). DOM is only for panel text. **No CSS/DOM tweens on anything that reads as part of the world.**
- When in doubt, consult §2 doctrines and §7 kill list. The bar: *every frame should pass as an insert shot in a modern briefing-room scene.*

## 1 · DESIGN DNA — the corpus and what each reference donated

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

## 2 · DOCTRINES (laws — every slice is audited against these)

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

## 3 · PALETTE TOKENS

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
  "signal.forge":  "#FF8A3D",   // ignite flash — hottest crest of an event
  "signal.cooled": "#7E3A1B",   // molten decay state (event aging toward archive)
  "panel.stroke":  "#3A3E44"    // blueprint hairlines, registration marks
}
```

- Ember appears on **<2% of any frame's pixels** in ambient state. If red is common, red is meaningless.
- Event recency is encoded as **heat**: ignite at `signal.ember` + bloom flash → cool toward `signal.cooled` → archive at `data.faint`.
- No other hues. No blues, no greens, no gradients-as-decoration. (Friend/foe distinction, if ever needed, is bone vs ember — already in corpus via REF-02 abstraction.)

## 4 · TYPE TOKENS

| Role | Face | Setting |
|---|---|---|
| Data / numerics / micro-labels | **Martian Mono** | 10–13px · ALL CAPS for labels · tracking +6–10% · tabular figures always |
| UI / headers / panel titles | **Archivo** (use width axis; Expanded for rare display moments) | Sentence case for prose, caps for eyebrows · weights 400/500/600 only |
| Fallback stack | `ui-monospace / system-ui` | degrade gracefully, never substitute a themed font |

- Asset labels ride their objects (REF-02): small mono caps, tethered, colored by state (`data.bone` / `signal.ember`).
- **Banned:** Orbitron, Audiowide, Michroma, Eurostile-alikes, any "techno" display face. (Paid upgrades if ever wanted: Söhne Mono / Neue Haas Grotesk — same personality, deeper cut. Not required.)

## 5 · MOTION PHYSICS TOKENS

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

## 6 · COMPOSITION GRAMMAR

**STAGE (A).** The void, with atmosphere. World objects are *lit bodies* staged like Dune's table: rim light, haze, grain, shallow DOF at rest. Nothing floats in flat black; everything sits in air.

**ORB (B) — VULCAN's presence.** Dark-core sphere wearing luminous orbital ring(s) — Gargantua form, never a plain circle. Body material: see RED-LINE RL-2. States:
- *idle* — heartbeat pulse, ring drifts slowly off-axis
- *listening* — ring brightens, tilts toward camera
- *thinking* — particle body agitates; network constellations surface briefly (Skyfall read as a state, not the body)
- *speaking* — ring luminance tracks voice amplitude

**MAP (C) — the theater.** Two states, one signature move:
- *ambient* — the war-room object. Mostly-quiet world, node heartbeats, ember events, faint standing chokepoint pressure. Readable across a room. Canvas: see RED-LINE RL-1.
- *interrogation* — camera dives (granular transition, spring physics) to oblique terrain (Avatar angle). Routes resolve, labels appear, tethered panels attach.
- Default theater centers the silicon corridor: Veldhoven → Taiwan/Korea/Japan → US Southwest.

**PANELS (D).** Blueprint-schematic language (Palantir + Maverick): hairline `panel.stroke` outlines, registration marks, tethered leader-lines anchored to world objects. Panels exist only on interrogation — they resolve in granularly, they never dock to screen edges as bars, and the hero always outweighs them. Quotes/wire/alerts render as schematic annotations, not dashboard widgets.

## 7 · KILL LIST (instant red-line, from the v0 autopsy + corpus dislikes)

Stock sci-fi fonts · decorative dashed circles · hexagon wallpaper · lens flares · saturated neon · glitch-as-decoration · bottom telemetry strips · dashboard chrome · pure #FFF or #000 · flat vector maps · DOM tweens on world objects · any mark that encodes nothing · **instant hard cuts, pop-in text, anything that "just appears."**

**Acceptance test per slice:** (1) briefing-scene test — could this frame appear in a modern military-briefing film insert? (2) ink audit — point to any mark, name the datum it encodes. (3) tokens audit — zero hardcoded visual values. (4) **fluidity audit — trigger every state change in the slice; any element that appears or vanishes without a material transition fails the slice.**

## 8 · RED-LINE DECISIONS — operator calls these two, then spec locks

**RL-1 · Map canvas (C1).** Options: orbital globe / tilted terrain theater / hybrid.
→ **Recommendation: HYBRID.** Globe as ambient state (your Spectre scanline-globe love + planet-as-body staging), granular dive to oblique terrain on interrogation (your Dune/Maverick/Avatar votes). Both jobs, and the dive becomes VULCAN's signature move.

**RL-2 · Orb body material (B).** Options: network-sphere (nodes+edges, Skyfall) / particle-field (volumetric, Anduril–Ultron).
→ **Recommendation: PARTICLE-FIELD** body with dark core + luminous ring (Gargantua form in Anduril matter — "the living entity"), with **network constellations surfacing only in thinking state** (the Skyfall read appears when VULCAN is actually traversing its graph). Both references survive, each as a state.

## 9 · SLICE 0 — MATERIAL TEST (first build after commit; the true preview)

One full-screen scene, no UI, no data feeds: `void` + grain + atmosphere → a particle-terrain patch drifting (idle physics) → one node heartbeat → one ember event ignites, propagates two hops, begins cooling → one mono-caps label resolves in per-glyph beside the event, holds, dissolves (fluidity-law test). Camera drifts on Perlin. All values from tokens.
**Review protocol:** Claude Code renders → screenshots itself via Playwright → operator judges against §7 acceptance tests. Pass = proceed to Slice 1 (orb). Fail = tune tokens, not doctrine.
