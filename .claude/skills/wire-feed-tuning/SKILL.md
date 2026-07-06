---
name: wire-feed-tuning
description: How the VULCAN wire organ turns RSS into molten heat, and how to tune feeds/keywords/discipline. Covers scoring, ignition + Apes propagation, decay, the heat budget, and wire.* tokens. Use when the wire feels noisy/quiet, mis-ignites, or a new profile needs feeds.
---

# Tuning the wire organ

The wire is ORGAN: THE WIRE (`src/wire.js` + `electron/wire-main.js`). The main process
polls the active profile's **keyless** RSS feeds (CORS); the renderer keyword-scores each
item, ignites **molten heat** at the matched site, propagates it along routes, and decays it.

## Pipeline

1. **Poll** — `wirePoll(feeds)` fetches each feed main-side (fail-soft per feed). Cadence:
   `wire.pollMs`. On boot it polls immediately; browser (no bridge) → `WIRE OFFLINE`.
2. **Score** — for each item title, count `profile.wire.keywords[region]` hits; the region
   with the most hits (≥ `wire.scoreThreshold`) wins. The site is the one whose id/name token
   appears in the title, else the region seed (index 0). Headlines are de-duped (`seen`).
3. **Ignite** — set the site's heat to 1 (forge-hot flash), record an ignition.
4. **Propagate** — Apes grammar: heat hops along the region's routes to neighbours after
   `wire.propagate.hop.ms`, `wire.propagate.hops` deep, each hop at 0.6× level.
5. **Decay** — every frame heat cools over `wire.cool.ms` to nothing.
6. **Discipline** — at most `wire.heat.max` concurrent hot sites (drops the weakest).
7. **No map up** — the orb shows a molten rim heat-tick + a bone HUD wire line.

## Tuning levers (`wire.*` tokens)

| Symptom | Lever |
|---|---|
| too noisy / everything ignites | raise `scoreThreshold`; tighten `keywords` to specific terms |
| heat lingers too long | lower `cool.ms` |
| too many hot marks at once | lower `heat.max` |
| propagation too far/fast | lower `propagate.hops` / raise `propagate.hop.ms` |
| feed too chatty | narrow the Google News query; drop a feed |

## Discipline (do not break)

Molten is the **only** heat. Resting scenes stay restrained (`ink.site.rest` / `ink.route.rest`);
a heat event distinguishes by **intensity + motion** (forge-hot, size, pulse, propagation),
not by being the only orange. Keep ambient orb-home ≤2% heat pixels.

## Test without live feeds

`window.__vulcanHome.wireInject(regionId, siteIdx, title)` ignites a synthetic labelled event
(drives the full ignite→propagate→decay pipeline). Used by the regression audit.
