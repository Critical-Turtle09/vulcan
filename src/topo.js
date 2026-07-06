// PART 2 — REAL GEOGRAPHY loader. Serves the per-region land/sea + relief grids
// built from public-domain Natural Earth data (see scripts/build-topo.mjs) so the
// summoned theater renders real coastlines/topography in the house dot-field.
// Regions without a cached grid fall back to procedural terrain.
import taiwan from '../data/topo/taiwan.json';
import eu from '../data/topo/eu.json';
import namerica from '../data/topo/namerica.json';
import korea from '../data/topo/korea.json';

const TOPO = { taiwan, eu, namerica, korea };

export function getTopo(id) { return TOPO[id] || null; }

// bilinear sample of a grid array at normalized u,v in [0,1] (u=lon east, v=lat south)
function sample(arr, gx, gz, u, v) {
  const fx = Math.min(Math.max(u, 0), 1) * (gx - 1), fz = Math.min(Math.max(v, 0), 1) * (gz - 1);
  const x0 = Math.floor(fx), z0 = Math.floor(fz), x1 = Math.min(x0 + 1, gx - 1), z1 = Math.min(z0 + 1, gz - 1);
  const tx = fx - x0, tz = fz - z0;
  const a = arr[z0 * gx + x0], b = arr[z0 * gx + x1], c = arr[z1 * gx + x0], d = arr[z1 * gx + x1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

export function sampleHeight(topo, u, v) { return sample(topo.height, topo.gx, topo.gz, u, v); }
// nearest coast flag (0/1) — bilinear would blur the boolean, so nearest-neighbour
export function coastAt(topo, u, v) {
  const x = Math.round(Math.min(Math.max(u, 0), 1) * (topo.gx - 1));
  const z = Math.round(Math.min(Math.max(v, 0), 1) * (topo.gz - 1));
  return topo.coast[z * topo.gx + x] || 0;
}
