// Regions of the silicon corridor, summoned as terrain theaters (v1.2 — no globe).
// Sites are placed in LOCAL terrain coordinates (x right, z toward camera) on the
// theater patch, not lat/lon — the theater is a sculptural region, not an atlas.
// Real facilities, labeled real. `alert` is the ember hook (0 = dark this slice).
// routes: index pairs into sites. lanes: standing strait/lane arcs.
export const REGIONS = {
  taiwan: {
    key: 't', name: 'TAIWAN', seed: 3.4,
    sites: [
      { id: 'hsinchu',  name: 'TSMC · HSINCHU',   x: -3.5, z: -8.0, alert: 0 },
      { id: 'taichung', name: 'TSMC · TAICHUNG',  x: -0.5, z: -1.0, alert: 0 },
      { id: 'tainan',   name: 'TSMC · TAINAN F18', x:  2.0, z:  5.5, alert: 0 },
      { id: 'kaohsiung',name: 'KAOHSIUNG · PORT',  x:  4.0, z:  9.5, alert: 0 },
    ],
    routes: [[0, 1], [1, 2], [2, 3]],
    lanes: [{ name: 'TAIWAN STRAIT', ax: -13, az: -9, bx: -11, bz: 9 }],
  },
  eu: {
    key: 'v', name: 'VELDHOVEN / EU', seed: 11.7,
    sites: [
      { id: 'asml',      name: 'ASML · VELDHOVEN', x:  0.0, z:  0.5, alert: 0 },
      { id: 'rotterdam', name: 'ROTTERDAM · PORT', x: -9.0, z:  4.5, alert: 0 },
      { id: 'dresden',   name: 'DRESDEN · FAB',    x:  9.5, z: -3.5, alert: 0 },
    ],
    routes: [[0, 1], [0, 2]],
    lanes: [],
  },
  namerica: {
    key: 'n', name: 'N. AMERICA', seed: 6.9,
    sites: [
      { id: 'nvidia',  name: 'NVIDIA · SANTA CLARA', x: -8.0, z:  3.0, alert: 0 },
      { id: 'micron',  name: 'MICRON · BOISE',       x:  3.0, z: -6.0, alert: 0 },
      { id: 'arizona', name: 'FAB · ARIZONA',        x:  8.5, z:  2.5, alert: 0 },
    ],
    routes: [[0, 2], [1, 2]],
    lanes: [],
  },
  korea: {
    key: 'k', name: 'KOREA', seed: 15.2,
    sites: [
      { id: 'samsung', name: 'SAMSUNG · HWASEONG', x: -5.0, z: -2.0, alert: 0 },
      { id: 'skhynix', name: 'SK HYNIX · ICHEON',  x:  3.5, z: -4.5, alert: 0 },
      { id: 'busan',   name: 'BUSAN · PORT',       x:  7.0, z:  8.0, alert: 0 },
    ],
    routes: [[0, 1], [1, 2]],
    lanes: [],
  },
};

export const REGION_BY_KEY = Object.fromEntries(
  Object.entries(REGIONS).map(([id, r]) => [r.key, id]),
);
