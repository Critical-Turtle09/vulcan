---
name: scene-authoring
description: How to add a new summonable VULCAN scene type (the vocabulary the brain routes into — map, device/schematic, graph, timeline). Covers the condense-from-dust pattern, the summon state machine, tokens, labels/legend, and real-topo. Use when building or extending a scene.
---

# Authoring a VULCAN scene

Scenes are the summonable theaters. The registry is `src/scenes/index.js`:
**map** (live, `map/theater.js`), **device/schematic** (draft, `scenes/schematic.js`),
**graph/network** and **timeline** (planned). Every scene condenses from — and dissolves
back to — house-material dust.

## The house pattern (every scene)

1. **Geometry from primitives / data.** No external 3D. A scene is a `THREE.Points`
   dust-field (+ hairline `LineSegments`/`LineLoop` for definition). Sample points on the
   surfaces of your primitives so boxes read as objects, not fog.
2. **Condense from scatter.** Each point carries `aScatter` (a start cloud) and a target;
   the vertex shader mixes `scatter → target` by a noise-staggered `local = f(uReveal, aSeed)`.
   This is the summon crossflow — the orb dissolves as the scene forms from the same dust.
3. **House material.** Additive `THREE.Points`, greyscale (`haze → bone`), molten only for
   heat/hot elements. Dark tokens are near-black in linear light — brightness comes from
   lighting/albedo, never from lightening the tokens (see the dark-token memory).
4. **Tokens.** Every size/count/duration in `scene.*` (or a scene-specific sub-tree). Run
   `npm run tokens` after adding tokens.

## Wire it into the summon machine (`src/orb/main.js`)

- Add a `sceneKind` value and a `summonX()` that sets it + `summonMode = 'summoning'`.
- Reuse the shared orb→scene crossflow: gate your scene's `reveal` by
  `initReveal * smooth(0.3,0.95,summonP) * (sceneKind === 'x' ? 1 : 0)`; keep fog map-only.
- **Labels + legend (PART 3):** expose `partScreens()`/`siteScreens()` (world centroids) so
  `paintLabels` tethers mono-caps labels with role context; give the scene a one-line bone
  **legend** (what it is + what the marks mean). No unexplained text.
- **Commands:** add a key + a `runCommand` intent (see the reflex layer) so voice can summon it.

## Real geography (map scenes)

Add a `topo` bbox to the profile region and run `npm run topo` (rasterizes public-domain
Natural Earth land/sea → `data/topo/<region>.json`). `theater.js` samples it (bilinear height,
bright coastline dots). Fine elevation is currently derived, not a sampled DEM — a real DEM
subset is a known upgrade.

## Verify

Screenshot assembled + any interaction (e.g. explode) states. Add the scene's transitions to
`scripts/audit.mjs` and confirm doctrine-11 fluidity (`npm run audit`, maxStep < 0.5).
