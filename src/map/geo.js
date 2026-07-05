// Geography helpers for the map. No atlas assets: the landmask is analytic
// (continents as unions of soft lat/lon blobs + coastline noise), so the dot-globe
// reads as Earth with recognizable continents and no network dependency.
import * as THREE from 'three';
import { simplex3 } from '../noise.js';

const D2R = Math.PI / 180;

// lat/lon (degrees) -> point on a sphere of radius r. lon 0 faces +Z.
export function llToVec3(latDeg, lonDeg, r) {
  const lat = latDeg * D2R, lon = lonDeg * D2R;
  const cl = Math.cos(lat);
  return new THREE.Vector3(
    r * cl * Math.sin(lon),
    r * Math.sin(lat),
    r * cl * Math.cos(lon),
  );
}

// signed shortest lon difference in degrees
function lonDiff(a, b) { let d = ((a - b + 540) % 360) - 180; return d; }

// continent blobs: [lat, lon, latR, lonR] in degrees. Rough but placed so the
// key silicon-corridor geographies (Taiwan, Korea, Japan, NL, US SW) are land.
const BLOBS = [
  [50, -100, 30, 34], [30, -88, 14, 16], [62, -150, 10, 22], [15, -90, 8, 6],   // N. America
  [-15, -60, 25, 17], [2, -66, 11, 13],                                          // S. America
  [72, -42, 11, 18],                                                             // Greenland
  [3, 20, 30, 20], [26, 15, 12, 26],                                             // Africa
  [52, 22, 12, 26],                                                              // Europe
  [52, 92, 27, 52], [22, 78, 15, 12], [11, 104, 12, 12],                         // Asia / India / SE Asia
  [37, 138, 8, 6], [23.7, 121, 2.4, 1.8], [37, 127.5, 4, 3],                     // Japan / Taiwan / Korea
  [-25, 134, 13, 20],                                                            // Australia
];

// 0 (deep ocean) .. 1 (solid land)
export function landAt(latDeg, lonDeg) {
  let land = 0;
  for (const [blat, blon, latR, lonR] of BLOBS) {
    const dl = (latDeg - blat) / latR;
    const dn = lonDiff(lonDeg, blon) / lonR;
    const d = dl * dl + dn * dn;
    land = Math.max(land, 1 - THREE.MathUtils.smoothstep(d, 0.45, 1.25));
  }
  if (latDeg < -66) land = Math.max(land, 0.9);                // Antarctica
  // ragged coastlines
  const n = simplex3(latDeg * 0.08, lonDeg * 0.08, 0) * 0.5 + 0.5;
  land = THREE.MathUtils.clamp(land * (0.6 + 0.7 * n) + (land > 0.35 ? 0.12 : 0), 0, 1);
  return land;
}

// fbm over 2D for terrain relief (matches the GLSL fbm feel), CPU side
export function fbm2(x, y, z = 0) {
  let f = 0, a = 0.5, px = x, py = y, pz = z;
  for (let i = 0; i < 4; i++) { f += a * simplex3(px, py, pz); px *= 2.03; py *= 2.03; pz *= 2.03; a *= 0.5; }
  return f;
}
