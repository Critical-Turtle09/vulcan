// PART 2 — REAL GEOGRAPHY build step. Rasterizes public-domain Natural Earth land
// polygons + coastlines (data/topo/{land,coastline}.geojson, PUBLIC DOMAIN) into a
// per-region land/sea + relief grid the theater samples, so the summoned scene is
// REAL geography (real Taiwan, real strait, real coastlines) rendered in the house
// dot-field — not procedural noise. Output: data/topo/<region>.json (cached).
//
// Relief note: heights are DERIVED (coast = low, interior rises via a land-fraction
// proxy) — the OUTLINE is real DEM-quality (coastline/land mask); fine elevation is
// approximate, not a sampled DEM. Documented in OVERNIGHT-REPORT.md.
//
// Raw sources (gitignored, re-fetchable from the public-domain Natural Earth vector
// mirror — https://github.com/nvkelso/natural-earth-vector/tree/master/geojson):
//   data/topo/land.geojson            ne_50m_land
//   data/topo/coastline.geojson       ne_50m_coastline
//   data/topo/boundary_lines.geojson  ne_50m_admin_0_boundary_lines_land   (PART 5)
//   data/topo/admin0_labels.json      committed extract of ne_50m_admin_0_countries
//                                     (NAME + LABEL_X/Y + LABELRANK)         (PART 5)
//
//   run: node scripts/build-topo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPO = path.join(ROOT, 'data', 'topo');
const land = JSON.parse(fs.readFileSync(path.join(TOPO, 'land.geojson'), 'utf8'));
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles', 'semiconductor.json'), 'utf8'));
const regions = profile.map.regions;

// PART 5 — POLITICAL LAYER (public domain Natural Earth 50m):
//   boundary_lines.geojson  — admin-0 land borders (drawn as terrain-riding hairlines)
//   admin0_labels.json      — country NAME + LABEL_X/Y (extracted centroids)
// Borders are clipped to each region bbox; labels are the countries whose label
// point sits IN the bbox, plus a curated EXTRA per region for countries clearly in
// view whose centroid is off-bbox (edge-clamped, honest off-view indicators).
const boundary = JSON.parse(fs.readFileSync(path.join(TOPO, 'boundary_lines.geojson'), 'utf8'));
const admin0 = JSON.parse(fs.readFileSync(path.join(TOPO, 'admin0_labels.json'), 'utf8'));
const EXTRA_LABELS = {
  taiwan:   ['China'],
  korea:    ['North Korea'],
  namerica: ['United States of America', 'Mexico'],
};

const GX = 200, GZ = 140;              // cache grid (theater bilinear-samples it)

// collect land rings as {ring:[[lon,lat]...], bbox:[minx,miny,maxx,maxy]}, with holes
function ringBBox(r) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; }
const polys = [];   // { ext:{ring,bbox}, holes:[{ring,bbox}] }
for (const f of land.features) {
  const g = f.geometry; if (!g) continue;
  const push = (rings) => { const ext = { ring: rings[0], bbox: ringBBox(rings[0]) }; const holes = rings.slice(1).map((r) => ({ ring: r, bbox: ringBBox(r) })); polys.push({ ext, holes }); };
  if (g.type === 'Polygon') push(g.coordinates);
  else if (g.type === 'MultiPolygon') for (const p of g.coordinates) push(p);
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const inBox = (x, y, b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

function isLand(lon, lat, kept) {
  for (const p of kept) {
    if (!inBox(lon, lat, p.ext.bbox)) continue;
    if (!pointInRing(lon, lat, p.ext.ring)) continue;
    let hole = false;
    for (const h of p.holes) { if (inBox(lon, lat, h.bbox) && pointInRing(lon, lat, h.ring)) { hole = true; break; } }
    if (!hole) return true;
  }
  return false;
}

for (const [id, reg] of Object.entries(regions)) {
  const t = reg.topo; if (!t) continue;
  // clip polygons to region bbox (+ margin) for speed
  const M = 0.5, bb = [t.lonMin - M, t.latMin - M, t.lonMax + M, t.latMax + M];
  const kept = polys.filter((p) => !(p.ext.bbox[2] < bb[0] || p.ext.bbox[0] > bb[2] || p.ext.bbox[3] < bb[1] || p.ext.bbox[1] > bb[3]));

  const mask = new Uint8Array(GX * GZ);
  for (let z = 0; z < GZ; z++) for (let x = 0; x < GX; x++) {
    const lon = t.lonMin + (x / (GX - 1)) * (t.lonMax - t.lonMin);
    const lat = t.latMax - (z / (GZ - 1)) * (t.latMax - t.latMin);   // z=0 -> north
    mask[z * GX + x] = isLand(lon, lat, kept) ? 1 : 0;
  }

  // relief: land rises with local land-fraction (interior high, coast low); sea dips.
  // coast flag = land cell touching sea (bright coastline dots in the theater).
  const R = 6;
  const height = new Float32Array(GX * GZ);
  const coast = new Uint8Array(GX * GZ);
  for (let z = 0; z < GZ; z++) for (let x = 0; x < GX; x++) {
    const i = z * GX + x, isL = mask[i];
    let land0 = 0, tot = 0, touchSea = false, touchLand = false;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= GX || nz >= GZ) continue;
      const m = mask[nz * GX + nx]; land0 += m; tot++;
      if (m) touchLand = true; else touchSea = true;
    }
    const frac = tot ? land0 / tot : 0;
    height[i] = isL ? (0.28 + 0.72 * frac) : (-0.32 - 0.15 * (1 - frac));
    coast[i] = (isL && touchSea) ? 1 : 0;
  }

  // --- borders: clip admin-0 boundary lines to the bbox, emit normalized (u,v) ---
  // (u = lon east in [0,1], v = lat south in [0,1] — same frame as the height grid)
  const toUV = (lon, lat) => [(lon - t.lonMin) / (t.lonMax - t.lonMin), (t.latMax - lat) / (t.latMax - t.latMin)];
  const inUnit = (p) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1;
  const cross = (pIn, pOut) => { let a = pIn.slice(), b = pOut.slice(); for (let k = 0; k < 14; k++) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (inUnit(m)) a = m; else b = m; } return a; };
  const rnd4 = (p) => [+p[0].toFixed(4), +p[1].toFixed(4)];
  const borders = [];
  for (const f of boundary.features) {
    const g = f.geometry; if (!g) continue;
    const segs = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    for (const seg of segs) {
      let cur = [];
      for (let idx = 0; idx < seg.length; idx++) {
        const uv = toUV(seg[idx][0], seg[idx][1]);
        if (inUnit(uv)) {
          if (cur.length === 0 && idx > 0) cur.push(rnd4(cross(uv, toUV(seg[idx - 1][0], seg[idx - 1][1]))));
          cur.push(rnd4(uv));
        } else if (cur.length) {
          cur.push(rnd4(cross(toUV(seg[idx - 1][0], seg[idx - 1][1]), uv)));
          if (cur.length > 1) borders.push(cur); cur = [];
        }
      }
      if (cur.length > 1) borders.push(cur);
    }
  }

  // --- labels: in-bbox major countries + curated edge-clamped off-view extras ---
  const extra = EXTRA_LABELS[id] || [];
  const labels = []; const seenL = new Set();
  for (const L of admin0) {
    const uv = toUV(L.lon, L.lat);
    const isIn = inUnit(uv), isExtra = extra.includes(L.name);
    if (!isExtra && !(isIn && L.rank <= 5)) continue;
    if (seenL.has(L.name)) continue; seenL.add(L.name);
    const cu = Math.min(0.94, Math.max(0.06, uv[0])), cv = Math.min(0.94, Math.max(0.06, uv[1]));
    labels.push({ name: L.name.toUpperCase(), u: +cu.toFixed(4), v: +cv.toFixed(4), edge: isIn ? 0 : 1 });
  }

  const out = {
    source: 'Natural Earth 50m (land / coastline / admin-0 boundaries) — PUBLIC DOMAIN',
    region: id, gx: GX, gz: GZ, bbox: t,
    height: Array.from(height, (v) => +v.toFixed(3)),
    coast: Array.from(coast),
    borders, labels,
  };
  fs.writeFileSync(path.join(TOPO, `${id}.json`), JSON.stringify(out));
  const landCells = mask.reduce((a, b) => a + b, 0), coastCells = coast.reduce((a, b) => a + b, 0);
  const bverts = borders.reduce((a, b) => a + b.length, 0);
  console.log(`${id}: ${GX}x${GZ}  land=${landCells}  coast=${coastCells}  borders=${borders.length}/${bverts}v  labels=${labels.map((l) => l.name + (l.edge ? '·' : '')).join(',')}`);
}
console.log('topo build complete');
