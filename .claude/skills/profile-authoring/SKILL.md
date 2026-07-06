---
name: profile-authoring
description: How to author or edit a VULCAN profile (profiles/*.json) — the domain-blind data that drives every organ (entities, map regions/sites/dossiers, wire feeds+keywords, quote symbols, HUD metrics, topo bboxes). Use when adding a new domain or editing an existing profile.
---

# Authoring a VULCAN profile

VULCAN's engine is **domain-blind**: every organ reads the ACTIVE profile. A profile is a
single JSON in `profiles/`. `semiconductor.json` is the launch default and the reference
example; `bonsai.json` (map off) and `political.json` (map on) are drafts.

## Schema

```jsonc
{
  "id": "semiconductor",                 // matches the filename
  "name": "SILICON FORGE",
  "eyebrow": "SEMICONDUCTOR SUPPLY CHAIN",
  "draft": true,                          // optional — marks a scaffold
  "hud": { "profile": "…", "directives": ["…"], "metrics": [{ "label": "…", "value": "… (SIM)" }] },
  "map": {
    "enabled": true,                      // false -> geography is unsummonable (orb-only domain)
    "regions": {
      "taiwan": {
        "key": "t", "name": "TAIWAN", "seed": 3.4,
        "topo": { "lonMin": …, "lonMax": …, "latMin": …, "latMax": … },   // optional real geography
        "sites": [
          { "id": "hsinchu", "name": "TSMC · HSINCHU", "x": -3.5, "z": -8.0, "alert": 0,
            "dossier": { "role": "LEADING-EDGE FAB", "node": "N3 / N5", "org": "TSMC",
                         "products": "…", "throughput": "~130K WSPM (SIM)", "status": "NOMINAL", "note": "…" } }
        ],
        "routes": [[0, 1], [1, 2]],       // index pairs into sites
        "lanes":  [{ "name": "TAIWAN STRAIT", "ax": -13, "az": -9, "bx": -11, "bz": 9 }]
      }
    }
  },
  "wire":   { "feeds": [{ "label": "TSMC", "url": "https://news.google.com/rss/search?q=TSMC…" }],
              "keywords": { "taiwan": ["tsmc", "hsinchu", "strait"] } },   // region -> terms
  "quotes": { "symbols": [{ "sym": "NVDA", "site": ["namerica", 0], "label": "NVDA" }] }
}
```

## Rules

- **Sites** are placed in LOCAL theater coords (`x` right, `z` toward camera), not lat/lon;
  they sit on the terrain height at their position. `role`/`org`/place feed the dossier panel
  and the role-context label ("TSMC · HSINCHU · FAB").
- **`alert`** is the molten heat hook (0 = resting); the wire organ drives it live.
- **Real geography (optional):** add a `topo` bbox and run `npm run topo` to build
  `data/topo/<region>.json`; the theater samples it (see the scene-authoring skill / PART 2).
- **Keyless feeds only.** Google News RSS query URLs work without keys. Keywords map an item
  to a region (and the site whose id/name appears in the title) for ignition + propagation.
- **Quotes** tether to `[regionId, siteIdx]` and render greyscale — never heat, never green/red.
- **Never fake numbers.** Mark synthetic dossier metrics `(SIM)`.

## Register it

Import + add to `ORDER` in `src/profile.js`. **Do not change the launch default** unless asked.
`P` cycles profiles with a granular crossflow that re-targets every organ.
