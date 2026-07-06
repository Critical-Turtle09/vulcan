// PART 4 — SCENE TYPE REGISTRY (the summonable vocabulary the future brain routes
// into). map/routes is live; device/schematic is a DRAFT v0; graph/network and
// timeline are scaffolded placeholders. Kept declarative so the brain (and the
// V.A.U.L.T) can enumerate what VULCAN can summon.
export const SCENE_TYPES = {
  map:       { key: null, label: 'MAP / ROUTES',      status: 'live'    },
  schematic: { key: 'x',  label: 'DEVICE / SCHEMATIC', status: 'draft'   },
  graph:     { key: null, label: 'GRAPH / NETWORK',   status: 'planned' },
  timeline:  { key: null, label: 'TIMELINE',          status: 'planned' },
};
export function sceneList() { return Object.entries(SCENE_TYPES).map(([id, v]) => ({ id, ...v })); }
