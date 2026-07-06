# VULCAN — topography cache (PART 2, real geography)

Per-region land/sea + relief grids the summoned theater samples so scenes render
**real coastlines/topography** (real Taiwan, real strait, real Korea peninsula) in
the house dot-field — not procedural noise.

## Source + license

- **Natural Earth** 1:50m — `ne_50m_land`, `ne_50m_coastline`.
- **License: PUBLIC DOMAIN** (Natural Earth: "no permission needed… you may use the
  maps in any manner"). https://www.naturalearthdata.com/about/terms-of-use/
- Fetched from the `nvkelso/natural-earth-vector` GeoJSON mirror.

## Files

- `land.geojson`, `coastline.geojson` — raw sources (gitignored; re-fetchable).
- `<region>.json` — **committed** processed grids the app imports
  (`taiwan/eu/namerica/korea`): `{ gx, gz, bbox, height[], coast[] }`.

## Rebuild

```
# re-fetch the public-domain sources
curl -sL -o data/topo/land.geojson      https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
curl -sL -o data/topo/coastline.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson
# rasterize per-region grids (bboxes come from profiles/semiconductor.json → regions[*].topo)
node scripts/build-topo.mjs
```

## Note on relief (DRAFT)

The **outline is real** (coastline/land mask from Natural Earth). Fine **elevation is
derived** (coast = low, interior rises via a land-fraction proxy), not a sampled DEM —
a real DEM (ETOPO/SRTM) subset is the morning upgrade. Legibility of the map-shape from
the fixed low-oblique "Maverick table" camera is also a morning tune (angle/contrast).
