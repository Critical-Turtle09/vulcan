// The SUMMONED map (v1.2, no globe): an oblique sculptural terrain theater of a
// region — the Maverick briefing-map read. Monochrome sculpted topography, thin
// white route arcs + tethered mono-caps site marks, and one bright marker that
// traverses the active route drawing/brightening it (Apes propagation — a seed
// moving through the network). Terrain heights are computed on the CPU and passed
// as attributes, so site marks sit exactly on the ground and the GLSL only
// displaces + lights.
import * as THREE from 'three';
import { color } from '../tokens.js';
import rawTokens from '../../tokens.json';
import { simplex3 } from '../noise.js';
import { getTopo, sampleHeight, coastAt } from '../topo.js';

const M = rawTokens.map;
const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

// shared height field — sites and terrain both sample this, so marks sit on ground
function heightAt(x, z, seed) {
  const scale = M['terrain.noiseScale'];
  let f = 0, a = 0.5, px = x * scale + seed, pz = z * scale - seed * 0.5, pw = 0;
  for (let i = 0; i < 4; i++) { f += a * simplex3(px, pz, pw); px *= 2.03; pz *= 2.03; a *= 0.5; }
  return f * M['terrain.heightAmp'];
}

export function createTheater() {
  const [gx, gz] = M['terrain.grid'];
  const spanX = M['terrain.spanX'], spanZ = M['terrain.spanZ'];
  const count = gx * gz;

  // PART 2 — when a region has cached REAL topography (Natural Earth), terrainH
  // samples it (real coastlines/relief); otherwise it falls back to procedural.
  let curTopo = null;
  function terrainH(wx, wz, seed) {
    if (curTopo) {
      const u = wx / spanX + 0.5, v = wz / spanZ + 0.5;
      const base = sampleHeight(curTopo, u, v) * M['terrain.heightAmp'];
      // fine dot-field texture so land/sea aren't smooth plateaus
      const tex = simplex3(wx * 0.16 + seed, wz * 0.16, 0) * 0.4;
      return base + tex;
    }
    return heightAt(wx, wz, seed);
  }

  // ---- terrain geometry: base grid + CPU height/normal attributes ----
  const pos = new Float32Array(count * 3);
  const aHeight = new Float32Array(count);
  const aNormal = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aScatter = new Float32Array(count * 3);
  const aCoast = new Float32Array(count);   // 1 = coastline cell (bright bone)
  let r = 71755; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  let i = 0;
  for (let z = 0; z < gz; z++) for (let x = 0; x < gx; x++) {
    const wx = (x / (gx - 1) - 0.5) * spanX, wz = (z / (gz - 1) - 0.5) * spanZ;
    pos[i * 3] = wx; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = wz;
    aSeed[i] = rnd();
    const ang = rnd() * Math.PI * 2, b = rnd() * Math.PI - Math.PI / 2, d = 9 * (0.4 + rnd());
    aScatter[i * 3] = Math.cos(ang) * Math.cos(b) * d; aScatter[i * 3 + 1] = Math.sin(b) * d + 4; aScatter[i * 3 + 2] = Math.sin(ang) * Math.cos(b) * d;
    i++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aHeight', new THREE.BufferAttribute(aHeight, 1));
  geo.setAttribute('aNormal', new THREE.BufferAttribute(aNormal, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(aScatter, 3));
  geo.setAttribute('aCoast', new THREE.BufferAttribute(aCoast, 1));

  const tUni = {
    uReveal: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: 1 },
    uPointSize: { value: M['terrain.pointSize'] }, uAlbedo: { value: M['terrain.albedoBoost'] },
    uKeyDir: { value: new THREE.Vector3(...M['terrain.lightDir']).normalize() },
    uAmb: { value: M['terrain.lightAmb'] }, uKey: { value: M['terrain.lightKey'] },
    uDeep: { value: color('terrain.deep') }, uMid: { value: color('terrain.mid') },
    uHigh: { value: color('terrain.high') }, uHaze: { value: color('haze') },
  };
  const terrain = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: tUni, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute float aHeight, aSeed, aCoast; attribute vec3 aNormal, aScatter;
      uniform float uReveal, uTime, uPixelRatio, uPointSize, uAmb, uKey;
      uniform vec3 uKeyDir;
      varying float vH, vAlpha, vLight, vCoast;
      void main(){
        vec3 p = position; p.y = aHeight;
        vH = clamp(aHeight / 8.0 + 0.5, 0.0, 1.0);
        vCoast = aCoast;
        vLight = uAmb + uKey * clamp(dot(normalize(aNormal), uKeyDir), 0.0, 1.0);
        float local = clamp((uReveal - aSeed*0.6)/0.4, 0.0, 1.0); local = local*local*(3.0-2.0*local);
        p.y += sin(uTime*0.5 + aSeed*6.28) * 0.03;
        vec3 world = mix(position + aScatter, p, local);
        vec4 mv = modelViewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPointSize * (1.0 + aCoast*0.6) * uPixelRatio * (300.0 / -mv.z), 1.5, 7.0);
        vAlpha = mix(0.8, 1.0, vH) * local;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uMid, uHigh, uHaze; uniform float uAlbedo;
      varying float vH, vAlpha, vLight, vCoast;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = smoothstep(0.5, 0.32, d); if (a*vAlpha <= 0.002) discard;
        vec3 col = mix(uMid, uHigh, smoothstep(0.0, 0.7, vH));
        col = mix(col, uHaze, smoothstep(0.7, 1.0, vH) * 0.5);
        col = mix(uDeep, col, smoothstep(0.0, 0.15, vH));
        col *= uAlbedo * vLight;
        col = mix(col, uHaze * 2.4, vCoast);          // coastline reads as a bright bone thread
        gl_FragColor = vec4(col, a * (vAlpha + vCoast*0.4));
      }`,
  }));
  terrain.frustumCulled = false;

  // ---- site marks (rebuilt per region) ----
  const MAXSITES = 8;
  const sPos = new Float32Array(MAXSITES * 3), sSeed = new Float32Array(MAXSITES), sAlert = new Float32Array(MAXSITES);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  sGeo.setAttribute('aAlert', new THREE.BufferAttribute(sAlert, 1));
  sGeo.setDrawRange(0, 0);
  const INK = rawTokens.ink;
  const sUni = {
    uTime: { value: 0 }, uReveal: { value: 0 }, uPixelRatio: { value: 1 },
    uSize: { value: M['site.size'] }, uBone: { value: color('data.bone') }, uMolten: { value: color('signal.molten') },
    uForge: { value: color('signal.forge') }, uRest: { value: INK['site.rest'] }, uHeat: { value: INK['site.heat'] },
    uPulseLo: { value: M['site.pulse'][0] },
  };
  const siteMarks = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    uniforms: sUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed, aAlert;
      uniform float uTime, uReveal, uPixelRatio, uSize, uPulseLo;
      varying float vAlert, vPulse;
      void main(){
        vAlert = aAlert;
        float period = 4.0 + aSeed*3.0;
        vPulse = mix(uPulseLo, 1.0, 0.5 + 0.5*sin(uTime*6.2831/period + aSeed*10.0));
        float fl = clamp((uReveal - aSeed*0.4)/0.6, 0.0, 1.0); fl = fl*fl*(3.0-2.0*fl);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize*(1.0+aAlert*0.85)*fl*uPixelRatio*(300.0/-mv.z);
        vPulse *= fl;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone, uMolten, uForge; uniform float uRest, uHeat; varying float vAlert, vPulse;
      void main(){
        vec2 c = gl_PointCoord-0.5; float d = length(c);
        float core = smoothstep(0.42,0.12,d), halo = smoothstep(0.5,0.3,d);
        if((core+halo)*vPulse <= 0.002) discard;
        // molten is the WORKING DATA INK (PART 3): sites rest at a restrained molten;
        // a HEAT event distinguishes by INTENSITY (forge-hot) + size + pulse, not by
        // being the only orange.
        vec3 col = mix(uMolten, uForge, clamp(vAlert,0.0,1.0)) * (uRest + vAlert*uHeat);
        gl_FragColor = vec4(col, (core+halo*0.22)*vPulse);
      }`,
  }));
  siteMarks.renderOrder = 3;

  // ---- country borders (PART 5): admin-0 political boundaries, clipped to the
  // region + riding the terrain — a quiet blueprint hairline, distinct from the
  // bright bone coastline. Real Natural Earth data; empty where there is no LAND
  // border in view (e.g. Taiwan — the strait is maritime, not a border). ----
  const borderMat = new THREE.LineBasicMaterial({ color: color('data.faint'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const borderGroup = new THREE.Group();
  let regionLabelData = [];   // [{ name, world, edge }] — country labels for the DOM layer

  // ---- routes (per region): thin arcs + traveling glow, and the standing lanes ----
  const routeGroup = new THREE.Group();
  const laneMat = new THREE.LineBasicMaterial({ color: color('data.faint'), transparent: true, opacity: 0, depthWrite: false });
  const laneGroup = new THREE.Group();

  // marker (the Maverick plane) — one bright point on the active route head
  const mPos = new Float32Array(3);
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const mUni = { uSize: { value: M['route.markerSize'] }, uPixelRatio: { value: 1 }, uOn: { value: 0 }, uForge: { value: color('signal.forge') } };
  const marker = new THREE.Points(mGeo, new THREE.ShaderMaterial({
    uniforms: mUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uSize, uPixelRatio, uOn; varying float vOn;
      void main(){ vOn = uOn; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uSize*uOn*uPixelRatio*(300.0/-mv.z); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uForge; varying float vOn;
      void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); float core=smoothstep(0.5,0.08,d); if(core*vOn<=0.002) discard; gl_FragColor=vec4(uForge*1.6, core*vOn); }`,
  }));
  marker.renderOrder = 4;

  const group = new THREE.Group();
  group.add(terrain, borderGroup, laneGroup, routeGroup, siteMarks, marker);

  // ---- per-region state ----
  let region = null, sites = [], routeCurves = [], routeMeshes = [];
  let active = 0, headU = 0, holdT = 0, phase = 'run';   // run | hold

  function routeMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uHead: { value: 1 }, uTrail: { value: M['route.trailDecay'] }, uGlow: { value: 0 }, uReveal: { value: 0 },
        uBase: { value: INK['route.alpha'] }, uRest: { value: INK['route.rest'] }, uHeatK: { value: INK['route.heat'] },
        uHeat: { value: 0 }, uMolten: { value: color('signal.molten') }, uForge: { value: color('signal.forge') },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aParam; varying float vP;
        void main(){ vP = aParam; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uHead,uTrail,uGlow,uReveal,uBase,uHeat,uRest,uHeatK; uniform vec3 uMolten,uForge; varying float vP;
        void main(){
          float glow = smoothstep(uHead-uTrail, uHead, vP) * step(vP, uHead) * uGlow;
          // routes are MOLTEN working ink (PART 3): a restrained molten lane; the
          // traversal head brightens it, and a wire HEAT event pushes it forge-hot.
          float a = (uBase + glow*0.6 + uHeat*0.5) * uReveal;
          if(a <= 0.002) discard;
          vec3 col = mix(uMolten, uForge, uHeat) * (uRest + glow*uHeatK + uHeat*uHeatK);
          gl_FragColor = vec4(col, a);
        }`,
    });
  }

  function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); if (c.material.dispose) c.material.dispose(); } }

  // takes the region data object + id (from the active profile — the engine is
  // domain-blind). Loads REAL topography for the region if cached (PART 2), else
  // procedural. Returns the resolved sites so callers can tether heat / quotes.
  function setRegion(regionObj, regionId) {
    region = regionObj;
    curTopo = getTopo(regionId);
    const seed = region.seed;

    // recompute terrain heights + normals (+ coastline flags) for this region
    const e = spanX / (gx - 1);
    let k = 0;
    for (let z = 0; z < gz; z++) for (let x = 0; x < gx; x++) {
      const wx = pos[k * 3], wz = pos[k * 3 + 2];
      const h = terrainH(wx, wz, seed);
      aHeight[k] = h;
      const hx = terrainH(wx + e, wz, seed), hz = terrainH(wx, wz + e, seed);
      const nx = h - hx, ny = e, nz = h - hz;
      const inv = 1 / Math.hypot(nx, ny, nz);
      aNormal[k * 3] = nx * inv; aNormal[k * 3 + 1] = ny * inv; aNormal[k * 3 + 2] = nz * inv;
      aCoast[k] = curTopo ? coastAt(curTopo, wx / spanX + 0.5, wz / spanZ + 0.5) : 0;
      k++;
    }
    geo.attributes.aHeight.needsUpdate = true;
    geo.attributes.aNormal.needsUpdate = true;
    geo.attributes.aCoast.needsUpdate = true;

    // sites on the ground
    sites = region.sites.map((s) => {
      const y = terrainH(s.x, s.z, seed) + M['site.lift'];
      return { ...s, world: new THREE.Vector3(s.x, y, s.z) };
    });
    sites.forEach((s, idx) => {
      sPos[idx * 3] = s.world.x; sPos[idx * 3 + 1] = s.world.y; sPos[idx * 3 + 2] = s.world.z;
      sSeed[idx] = (idx * 0.37) % 1; sAlert[idx] = s.alert;
    });
    sGeo.setDrawRange(0, sites.length);
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.aSeed.needsUpdate = true;
    sGeo.attributes.aAlert.needsUpdate = true;

    // routes: arced polylines between sites, with aParam
    clearGroup(routeGroup); routeCurves = []; routeMeshes = [];
    const SEG = M['route.segments'], lift = M['route.arcHeight'];
    for (const [ai, bi] of region.routes) {
      const a = sites[ai].world, b = sites[bi].world;
      const pts = [], params = [];
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y += Math.sin(t * Math.PI) * lift;
        pts.push(p.x, p.y, p.z); params.push(t);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute('aParam', new THREE.Float32BufferAttribute(params, 1));
      const mat = routeMaterial();
      const line = new THREE.Line(g, mat);
      line.frustumCulled = false;
      routeGroup.add(line); routeMeshes.push(mat);
      routeCurves.push({ a, b, lift });
    }

    // lanes (strait) — faint static arcs
    clearGroup(laneGroup);
    for (const ln of (region.lanes || [])) {
      const ay = terrainH(ln.ax, ln.az, seed) + M['site.lift'];
      const by = terrainH(ln.bx, ln.bz, seed) + M['site.lift'];
      const a = new THREE.Vector3(ln.ax, ay, ln.az), b = new THREE.Vector3(ln.bx, by, ln.bz);
      const pts = [];
      for (let s = 0; s <= 40; s++) { const t = s / 40; const p = new THREE.Vector3().lerpVectors(a, b, t); p.y += Math.sin(t * Math.PI) * 0.8; pts.push(p); }
      laneGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), laneMat));
    }

    // borders (PART 5): (u,v) polylines -> world, each vertex lifted onto the terrain
    clearGroup(borderGroup);
    const uvToWorld = (u, v) => { const wx = (u - 0.5) * spanX, wz = (v - 0.5) * spanZ; return new THREE.Vector3(wx, terrainH(wx, wz, seed) + M['border.lift'], wz); };
    for (const line of (curTopo && curTopo.borders) || []) {
      const pts = line.map(([u, v]) => uvToWorld(u, v));
      if (pts.length < 2) continue;
      const bl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat);
      bl.frustumCulled = false;
      borderGroup.add(bl);
    }

    // country labels (PART 5): sit at ground level; the DOM layer tethers text
    regionLabelData = ((curTopo && curTopo.labels) || []).map((l) => ({ name: l.name, edge: l.edge, world: uvToWorld(l.u, l.v) }));

    active = 0; headU = 0; holdT = 0; phase = 'run';
  }

  // STAGE B — apply the wire organ's per-site molten heat. map: { siteId: level }.
  // Sites ignite molten (sAlert); routes tint where both endpoints are hot.
  function setHeat(map) {
    if (!region) return;
    for (let i = 0; i < sites.length; i++) sAlert[i] = (map && map[sites[i].id]) || 0;
    sGeo.attributes.aAlert.needsUpdate = true;
  }

  function sampleRoute(idx, u) {
    const rc = routeCurves[idx]; if (!rc) return new THREE.Vector3();
    const p = new THREE.Vector3().lerpVectors(rc.a, rc.b, u);
    p.y += Math.sin(u * Math.PI) * rc.lift;
    return p;
  }

  function update(dt, t, reveal, pixelRatio) {
    tUni.uTime.value = t; tUni.uPixelRatio.value = pixelRatio; tUni.uReveal.value = reveal;
    sUni.uTime.value = t; sUni.uPixelRatio.value = pixelRatio; sUni.uReveal.value = reveal;
    mUni.uPixelRatio.value = pixelRatio;
    laneMat.opacity = M['route.baseAlpha'] * 0.7 * reveal;
    borderMat.opacity = M['border.alpha'] * reveal;

    // route reveal + heat tint (heat = min of the two endpoint site heats)
    const rts = (region && region.routes) || [];
    for (let i = 0; i < routeMeshes.length; i++) {
      routeMeshes[i].uniforms.uReveal.value = reveal;
      const r = rts[i];
      routeMeshes[i].uniforms.uHeat.value = r ? Math.min(sAlert[r[0]] || 0, sAlert[r[1]] || 0) : 0;
    }

    // traversal only runs once the theater is essentially up
    const live = reveal > 0.92 && routeMeshes.length > 0;
    if (live) {
      if (phase === 'run') {
        headU += M['route.speed'] * dt;
        if (headU >= 1) { headU = 1; phase = 'hold'; holdT = 0; }
      } else {
        holdT += dt * 1000;
        if (holdT >= M['route.holdMs']) { active = (active + 1) % routeMeshes.length; headU = 0; phase = 'run'; }
      }
      routeMeshes.forEach((mat, idx) => {
        mat.uniforms.uHead.value = idx === active ? headU : 1;
        mat.uniforms.uGlow.value = idx === active ? M['route.glow'] : 0;
      });
      const hp = sampleRoute(active, headU);
      mPos[0] = hp.x; mPos[1] = hp.y; mPos[2] = hp.z; mGeo.attributes.position.needsUpdate = true;
      mUni.uOn.value = reveal;
    } else {
      mUni.uOn.value = 0;
      routeMeshes.forEach((mat) => { mat.uniforms.uHead.value = 1; mat.uniforms.uGlow.value = 0; });
    }
  }

  function siteScreens(camera) {
    return sites.map((s) => ({ site: s, world: s.world.clone() }));
  }

  // resolved sites (world positions) for the current region — used by heat/quotes
  // organs to tether marks to real ground. Empty until setRegion runs.
  function siteById(id) { return sites.find((s) => s.id === id) || null; }

  // country labels for the current region (world positions) — the DOM layer paints
  // them as tethered mono-caps; `edge` marks an off-view country (dimmer indicator)
  function regionLabels() { return regionLabelData; }
  function hasBorders() { return borderGroup.children.length > 0; }

  return {
    object: group, setRegion, update, siteScreens, setHeat, regionLabels, hasBorders,
    get region() { return region; }, get sites() { return sites; }, siteById,
    get active() { return active; }, get headU() { return headU; },
  };
}
