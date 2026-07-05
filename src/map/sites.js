// The supply chain drawn ON the world. Real facility geographies (public
// locations) — labeled real, not SIM. Each site is divable. Routes are the key
// links/lanes as faint great-circle arcs. `alert` is the ember-signal hook — 0
// (dark) in this slice; the RSS organ lights it later.
export const SITES = [
  { id: 'tsmc-hsinchu',  name: 'TSMC · HSINCHU',     lat: 24.77, lon: 120.99, alert: 0 },
  { id: 'tsmc-taichung', name: 'TSMC · TAICHUNG',    lat: 24.19, lon: 120.62, alert: 0 },
  { id: 'tsmc-tainan',   name: 'TSMC · TAINAN F18',  lat: 23.10, lon: 120.28, alert: 0 },
  { id: 'asml',          name: 'ASML · VELDHOVEN',   lat: 51.42, lon:   5.40, alert: 0 },
  { id: 'nvidia',        name: 'NVIDIA · SANTA CLARA',lat: 37.37, lon: -121.97, alert: 0 },
  { id: 'samsung',       name: 'SAMSUNG · HWASEONG', lat: 37.20, lon: 127.05, alert: 0 },
  { id: 'skhynix',       name: 'SK HYNIX · ICHEON',  lat: 37.28, lon: 127.44, alert: 0 },
  { id: 'micron',        name: 'MICRON · BOISE',     lat: 43.61, lon: -116.20, alert: 0 },
];

export const siteById = (id) => SITES.find((s) => s.id === id);

// key links + the Taiwan Strait / Pacific lanes. dashed => "flow/route" (encodes
// projected movement, the one legitimate dashed use per doctrine 2).
export const ROUTES = [
  { from: 'asml',         to: 'tsmc-hsinchu', kind: 'tool'  },   // EUV scanners NL -> TW
  { from: 'tsmc-hsinchu', to: 'nvidia',       kind: 'wafer' },   // TW -> US
  { from: 'tsmc-tainan',  to: 'nvidia',       kind: 'wafer' },
  { from: 'samsung',      to: 'nvidia',       kind: 'mem'   },   // KR -> US
  { from: 'micron',       to: 'tsmc-hsinchu', kind: 'mem'   },   // US -> TW
  { from: 'skhynix',      to: 'tsmc-taichung',kind: 'mem'   },
];

// standing lane pressure — the Taiwan Strait, drawn as a short faint lane arc
export const LANES = [
  { a: { lat: 25.2, lon: 119.6 }, b: { lat: 23.2, lon: 119.0 }, name: 'TAIWAN STRAIT' },
];
