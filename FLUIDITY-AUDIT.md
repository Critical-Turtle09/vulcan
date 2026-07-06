# VULCAN — FULL-SYSTEM FLUIDITY AUDIT (STAGE E)

Mission step 7. Fresh launch → Playwright-driven measurement of **every** state
change in the v1+FORGE build, checking doctrine 11 (§2.11 / §7): *no hard cuts,
no pop-in text, nothing that "just appears."*

## Method

Each transition is triggered headless (`window.__vulcanHome.*`) and its governing
continuous value is **sampled across frames** while it runs. Two numbers decide it:

- **range** — how far the value travelled (confirms the transition actually happened).
- **maxStep** — the largest single-frame delta, normalised 0–1.

A **cut / pop-in** shows `maxStep ≈ range ≈ 1.0` (the whole change lands in one
frame). A **fluid** transition spreads the change across many frames, so
`maxStep` is small. **Pass threshold: `maxStep < 0.50`** (no single frame moves
more than half the range) — in practice every fluid transition here is well under
0.25.

Sampling cadence ≈ 40–60 ms/frame; values read from the live render loop.

## Results (measured)

| # | Transition | Driver (0→1) | maxStep | range | Verdict |
|---|---|---|---|---|---|
| 1 | Ignition **summon** (sparks → command center) | `presence` | **0.046** | 1.00 | ✅ FLUID |
| 2 | Ignition **bank** (reverse → hidden) | `presence` | **0.089** | 1.00 | ✅ FLUID |
| 3 | Orb → **listening** | `agitation` | 0.006 | 0.043 | ✅ FLUID (lerp) |
| 4 | Orb → **thinking** | `agitation` | 0.084 | 0.561 | ✅ FLUID (lerp) |
| 5 | Orb → **speaking** | `agitation` | 0.058 | 0.371 | ✅ FLUID (lerp) |
| 6 | Orb → **idle** | `agitation` | 0.040 | 0.205 | ✅ FLUID (lerp) |
| 7 | **Wave reactivity** (sim audio) | `ampS` | peak **0.728**, vary 0.163 | — | ✅ REACTIVE |
| 8 | **Mute** (M) | `voice.muted` | flag toggled | — | ✅ OK (orb parks, no snap) |
| 9 | **Summon** Taiwan (orb → theater) | `summonP` | **0.100** | 1.00 | ✅ FLUID |
| 10 | **Wire event** ignite (mid-theater) | `heatIndex` | 0.200 | peak 0.651 | ✅ OK (intended flash → fluid decay) |
| 11 | **Quotes** on terrain | `quote-chip` opacity | online, 1 chip visible | — | ✅ OK (rides theater fade) |
| 12 | **Panel open** (per-glyph resolve) | glyph opacity avg | **0.130** | 1.00 | ✅ FLUID |
| 13 | **Panel close** (dissolve) | glyph opacity avg | **0.247** | 1.00 | ✅ FLUID |
| 14 | **Return home** (theater → orb) | `summonP` | **0.103** | 1.00 | ✅ FLUID |
| 15 | **Profile switch** semi ↔ bonsai | HUD re-form | semi→bonsai→semi | — | ✅ OK (crossflow) |

### Panel resolve trajectory (measured, #12)

`0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 · .01 · .04 · .07 · .10 · .21 · .25 · .38 · .42 · .54 · .59 · .67 · .75 · .83 · .87 · .95 · .98 · 1 · 1`

The frame **draws on first** (glyphs hold at 0 for the opening ~270 ms — the
`panel.text.delayMs` window — while the hairline stroke and registration marks
draw in), **then** the text resolves per-glyph, evenly staggered to 1.0. Text
resolves last; nothing pops. (Frame stroke separately measured: dashoffset
619 px → 73 px → 0 across the reveal.)

### Panel dissolve trajectory (measured, #13)

`1 · 1 · 1 · .98 · .93 · .85 · .73 · .66 · .58 · .34 · .34 · .15 · .07 · .04 · 0`

Glyphs melt out granularly; the element is held alive until the dissolve
completes (no mid-fade removal).

## Violations found → fixed

The first pass caught **two** violations; both are fixed and re-measured above.

1. **Panel open pop-in** — `maxStep 0.701`. The per-glyph stagger capped each
   glyph's delay at `blockCap`, which **piled ~80 % of glyphs at the cap** so the
   bulk of the text resolved in a single frame. **Fix:** the stagger now spreads
   the whole block *evenly* across a capped span (`per = min(n·step, cap) / n`),
   compressing the step for long blocks instead of piling. → `maxStep 0.130`.
2. **Panel close cut** — `maxStep 0.993`. The panel element was removed at
   `dissolve.ms` (360 ms) while the piled glyph transitions were still mid-fade,
   so the text vanished in one frame. **Fix:** on close the glyphs are re-staggered
   into a short dissolve span and the element is kept alive for
   `max(dissolve.ms, span + glyphMs + 40)`. → `maxStep 0.247`.

## Notes

- **Wire ignite (#10)** is intentionally a *flash*, not a gradual ramp — an event
  striking the network reacts within `feedback.first.ms` (100 ms) and blooms per
  `propagate.ignite.ms` (150 ms). The molten heat then **decays fluidly** over
  `wire.cool.ms`. The `maxStep 0.20` is the strike; the long tail is the fluid part.
- **Mute (#8)** is a boolean intent, not a visual transition — the orb simply
  parks at idle (its own lerp), so there is no snap to measure.
- All easing runs on the GPU render loop (shader weight, not DOM tweens on world
  objects); the only DOM tweens are on panel/HUD *text*, which is legitimate
  panel language (§0).

## Verdict

**PASS.** After the two panel fixes, every state change in the build is a fluid,
material transition — no hard cuts, no pop-in text. Re-run clean.

_Measured headless via Playwright against the Vite render (byte-identical to the
Electron full-screen render). Values are from the live render loop, not simulated._

---

## FINAL v1 PASS — re-audit after the 5 walkthrough fixes

| Transition | Driver | maxStep | range | Verdict |
|---|---|---|---|---|
| **Wake → ignition** (FINDING 1, voice "Fire and Forge" from hidden) | `presence` | **0.044** | 1.00 | ✅ FLUID |
| **Dismiss → bank** (FINDING 4, voice "Bank the fire" / "Stand down") | `presence` | **0.086** | 1.00 | ✅ FLUID |
| **Wave-ring reactivity** (FINDING 5, sim audio while speaking) | `ampS` | 0.311 | peak 0.608 | ✅ RESPONSIVE (audio envelope: fast attack / slow decay, by design — same smoothed envelope that drives the body waves) |

- **FINDING 1** — the wake phrase now routes through the *same* summon path as
  Alt+Space (`requestSummon` → overlay + `ui:ignite`), so it plays the full
  ignition with the voice reply riding it. Measured: wake from hidden →
  presence 0 → 1 fluidly.
- **FINDING 2** — cursor is `crosshair` (visible instrument reticle); a persistent
  `ESC · BANK` affordance is shown while resolved (gated with the HUD chrome).
- **FINDING 3** — the overlay is borderless, `fullscreenable:false`,
  always-on-top `screen-saver`, `visibleOnAllWorkspaces`, sized to the active
  display — it joins the current Space instead of opening a native-fullscreen
  Space. (Electron main-process; verified by construction + syntax, not
  browser-measurable.)
- **FINDING 4** — the listener accepts the dismiss phrase while resolved and
  reverses the ignition to hidden. Measured fluid above; `Esc` remains the
  fallback (global shortcut registered only while resolved).
- **FINDING 5** — 2–4 hairline wave-rings thread the orb, noise-displaced (never
  circular), audio-reactive like the body: near-calm undulation at idle, surge
  with the envelope while speaking (screenshots `f5-idle2` / `f5-speaking`).

**FINAL VERDICT: PASS.** All five fixes land fluid; no regressions in the
prior 15 transitions.
