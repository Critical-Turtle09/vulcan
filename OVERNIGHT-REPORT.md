# VULCAN — NIGHT SHIFT REPORT

Unattended overnight run. Status per part: **DONE** / **DRAFT** (needs operator
taste review) / **PARTIAL** / **SKIPPED/BLOCKED** (with reason). Commits pushed
after every part.

Legend: 🟢 done · 🟡 draft/partial · 🔴 blocked/skipped

---

## Summary table

| Part | Title | Status | Notes |
|---|---|---|---|
| 1 | RL-4 signing pass (summon/bank/rings/ceremony) | 🟢 DONE (1a/1b need Electron visual confirm) | ceremony both dirs, rings×6, transparency via lighten+snapshot |
| 2 | Real geography | 🟡 DRAFT | real Natural Earth land/sea wired + rendering; relief derived (not DEM), legibility a morning tune |
| 3 | Molten ink + legends | 🟢 DONE | molten working-ink on scenes, ink.* tokens, per-scene legend, role labels |
| 4 | Scene library groundwork (schematic DRAFT) | … | |
| 5 | Local voice fallback | … | |
| 6 | Local reflexes (Ollama) | … | |
| 7 | Profile drafts | … | |
| 8 | Regression harness | … | |
| 9 | Docs pass | … | |
| 10 | Media capture | … | |
| 11 | Website draft | … | |
| 12 | Skill scaffold | … | |
| 13 | Close-out | … | |

---

## Part log

### PART 1 — RL-4 signing pass 🟢
- **1a summon-on-current-Space + transparency:** overlay is borderless,
  `fullscreenable:false`, always-on-top `screen-saver`, `visibleOnAllWorkspaces`,
  sized to the active display each summon → joins current Space, no native
  fullscreen. Real screen shows beneath the sparks via a CSS `mix-blend-mode:
  lighten` canvas over an active-display `desktopCapturer` snapshot on `#backdrop`;
  `#void-over` opacity = presence fades the void floor in. **Transparency verified
  in-browser** (desktop-sim gradient shows beneath sparks, `p1-lighten.jpeg`).
  Needs **operator visual confirm in Electron** (desktopCapturer + active-Space
  can't be headless-tested; screen-recording permission required, fail-soft to
  void if denied).
- **1b bank restores app:** `hideOverlay()` calls `app.hide()` on darwin → macOS
  returns focus to the previously frontmost app (not the desktop). Dismiss accepts
  mishears: "bank the fire/forge", "stand down", "bake the fire", "bank fire".
  (Focus-restore not headless-verifiable — operator confirm.)
- **1c rings:** count 3→6, radii tightened toward the body (0.70–1.15, tighter
  spacing), displacement lowered (noiseAmp 0.12→0.085), opacity 0.5→0.42.
  `f5-idle2`/`p1-*` — calm undulation idle, surge under audio.
- **1d ceremony (spec amended):** IGNITION ~3.35s measured (kindle → molten
  hammer-on-anvil **shockwave ring** `p1-shock.jpeg` → condense/cool → **VULCAN
  title beat** `p1-title.jpeg` → orb+HUD). BANK ~1.8s quench (steam-grey drain).
  Fluidity: ignition maxStep 0.039, bank 0.056 — both fluid, no cuts.

### PART 2 — Real geography 🟡 DRAFT
- Fetched **Natural Earth 50m** land + coastline (**PUBLIC DOMAIN**; source/license
  in `data/topo/README.md`), cached in `data/topo/` (raw geojson gitignored,
  re-fetchable; processed per-region grids committed).
- `scripts/build-topo.mjs` rasterizes each region bbox (added to
  `profiles/…regions[*].topo`) → `data/topo/<region>.json` (land/sea mask, derived
  relief, coastline flags). Taiwan land=7084 coast=3048 cells, etc.
- `src/topo.js` + `theater.js` sample the real grid (bilinear height, bright
  coastline dots) instead of procedural noise; `main.js` passes the region id.
  `p2-taiwan-real`/`p2-korea-real`: real relief renders (raised peninsulas, sea).
- **DRAFT / morning tune:** the OUTLINE is real (Natural Earth mask); fine elevation
  is DERIVED (coast-low/interior-high proxy), not a sampled DEM. Map-shape
  legibility from the fixed low-oblique camera is subtle — a real DEM (ETOPO/SRTM)
  subset + a camera/contrast pass are the upgrades. World-strip not yet added.

### PART 3 — Molten ink + legends 🟢
- Site dots, route lines, and the traversal marker on summoned scenes are now
  **molten working-ink**; a wire HEAT event distinguishes by intensity (forge-hot),
  size, and pulse/propagation — not by being the only orange.
- `ink.*` tokens (`site.rest/heat`, `route.rest/heat/alpha`) expose resting
  restraint for the morning retune (`site.rest` 0.55→0.32). `p3-molten-ink`/`p3-ink2`.
- Per-scene **LEGEND** (bone mono-caps, theater only) + role-context labels
  ("TSMC · HSINCHU · FAB"). HUD swept — no orphan strings.
- CLAUDE.md §3 ink-doctrine amendment recorded. Equity quotes stay greyscale.

