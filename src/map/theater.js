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

  // ---- terrain geometry: base grid + CPU height/normal attributes ----
  const pos = new Float32Array(count * 3);
  const aHeight = new Float32Array(count);
  const aNormal = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aScatter = new Float32Array(count * 3);
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
      attribute float aHeight, aSeed; attribute vec3 aNormal, aScatter;
      uniform float uReveal, uTime, uPixelRatio, uPointSize, uAmb, uKey;
      uniform vec3 uKeyDir;
      varying float vH, vAlpha, vLight;
      void main(){
        vec3 p = position; p.y = aHeight;
        vH = clamp(aHeight / 8.0 + 0.5, 0.0, 1.0);
        vLight = uAmb + uKey * clamp(dot(normalize(aNormal), uKeyDir), 0.0, 1.0);
        float local = clamp((uReveal - aSeed*0.6)/0.4, 0.0, 1.0); local = local*local*(3.0-2.0*local);
        p.y += sin(uTime*0.5 + aSeed*6.28) * 0.03;
        vec3 world = mix(position + aScatter, p, local);
        vec4 mv = modelViewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPointSize * uPixelRatio * (300.0 / -mv.z), 1.5, 7.0);
        vAlpha = mix(0.8, 1.0, vH) * local;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uMid, uHigh, uHaze; uniform float uAlbedo;
      varying float vH, vAlpha, vLight;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = smoothstep(0.5, 0.32, d); if (a*vAlpha <= 0.002) discard;
        vec3 col = mix(uMid, uHigh, smoothstep(0.0, 0.7, vH));
        col = mix(col, uHaze, smoothstep(0.7, 1.0, vH) * 0.5);
        col = mix(uDeep, col, smoothstep(0.0, 0.15, vH));
        col *= uAlbedo * vLight;
        gl_FragColor = vec4(col, a * vAlpha);
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
  const sUni = {
    uTime: { value: 0 }, uReveal: { value: 0 }, uPixelRatio: { value: 1 },
    uSize: { value: M['site.size'] }, uBone: { value: color('data.bone') }, uMolten: { value: color('signal.molten') },
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
        gl_PointSize = uSize*(1.0+aAlert*1.5)*fl*uPixelRatio*(300.0/-mv.z);
        vPulse *= fl;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone, uMolten; varying float vAlert, vPulse;
      void main(){
        vec2 c = gl_PointCoord-0.5; float d = length(c);
        float core = smoothstep(0.42,0.12,d), halo = smoothstep(0.5,0.3,d);
        if((core+halo)*vPulse <= 0.002) discard;
        vec3 col = mix(uBone, uMolten, step(0.01, vAlert));   // molten heat hook (STAGE B drives aAlert)
        col *= 1.0 + vAlert*2.5;
        gl_FragColor = vec4(col, (core+halo*0.22)*vPulse);
      }`,
  }));
  siteMarks.renderOrder = 3;

  // ---- routes (per region): thin arcs + traveling glow, and the standing lanes ----
  const routeGroup = new THREE.Group();
  const laneMat = new THREE.LineBasicMaterial({ color: color('data.faint'), transparent: true, opacity: 0, depthWrite: false });
  const laneGroup = new THREE.Group();

  // marker (the Maverick plane) — one bright point on the active route head
  const mPos = new Float32Array(3);
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const mUni = { uSize: { value: M['route.markerSize'] }, uPixelRatio: { value: 1 }, uOn: { value: 0 }, uBone: { value: color('data.bone') } };
  const marker = new THREE.Points(mGeo, new THREE.ShaderMaterial({
    uniforms: mUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uSize, uPixelRatio, uOn; varying float vOn;
      void main(){ vOn = uOn; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uSize*uOn*uPixelRatio*(300.0/-mv.z); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone; varying float vOn;
      void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); float core=smoothstep(0.5,0.08,d); if(core*vOn<=0.002) discard; gl_FragColor=vec4(uBone*1.5, core*vOn); }`,
  }));
  marker.renderOrder = 4;

  const group = new THREE.Group();
  group.add(terrain, laneGroup, routeGroup, siteMarks, marker);

  // ---- per-region state ----
  let region = null, sites = [], routeCurves = [], routeMeshes = [];
  let active = 0, headU = 0, holdT = 0, phase = 'run';   // run | hold

  function routeMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uHead: { value: 1 }, uTrail: { value: M['route.trailDecay'] }, uGlow: { value: 0 }, uReveal: { value: 0 },
        uBase: { value: M['route.baseAlpha'] }, uBone: { value: color('data.bone') },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aParam; varying float vP;
        void main(){ vP = aParam; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uHead,uTrail,uGlow,uReveal,uBase; uniform vec3 uBone; varying float vP;
        void main(){
          float glow = smoothstep(uHead-uTrail, uHead, vP) * step(vP, uHead) * uGlow;
          float a = (uBase + glow) * uReveal;
          if(a <= 0.002) discard;
          gl_FragColor = vec4(uBone*(1.0+glow*1.7), a);
        }`,
    });
  }

  function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); if (c.material.dispose) c.material.dispose(); } }

  // takes the region data object directly (from the active profile — the engine
  // is domain-blind, spec v1.3). Returns the resolved sites so callers can tether
  // heat / quotes to real ground positions.
  function setRegion(regionObj) {
    region = regionObj;
    const seed = region.seed;

    // recompute terrain heights + normals for this region
    const e = spanX / (gx - 1);
    let k = 0;
    for (let z = 0; z < gz; z++) for (let x = 0; x < gx; x++) {
      const wx = pos[k * 3], wz = pos[k * 3 + 2];
      const h = heightAt(wx, wz, seed);
      aHeight[k] = h;
      const hx = heightAt(wx + e, wz, seed), hz = heightAt(wx, wz + e, seed);
      const nx = h - hx, ny = e, nz = h - hz;
      const inv = 1 / Math.hypot(nx, ny, nz);
      aNormal[k * 3] = nx * inv; aNormal[k * 3 + 1] = ny * inv; aNormal[k * 3 + 2] = nz * inv;
      k++;
    }
    geo.attributes.aHeight.needsUpdate = true;
    geo.attributes.aNormal.needsUpdate = true;

    // sites on the ground
    sites = region.sites.map((s) => {
      const y = heightAt(s.x, s.z, seed) + M['site.lift'];
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
      const ay = heightAt(ln.ax, ln.az, seed) + M['site.lift'];
      const by = heightAt(ln.bx, ln.bz, seed) + M['site.lift'];
      const a = new THREE.Vector3(ln.ax, ay, ln.az), b = new THREE.Vector3(ln.bx, by, ln.bz);
      const pts = [];
      for (let s = 0; s <= 40; s++) { const t = s / 40; const p = new THREE.Vector3().lerpVectors(a, b, t); p.y += Math.sin(t * Math.PI) * 0.8; pts.push(p); }
      laneGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), laneMat));
    }

    active = 0; headU = 0; holdT = 0; phase = 'run';
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

    // route reveal on all routes
    for (const mat of routeMeshes) mat.uniforms.uReveal.value = reveal;

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

  return {
    object: group, setRegion, update, siteScreens,
    get region() { return region; }, get sites() { return sites; }, siteById,
    get active() { return active; }, get headU() { return headU; },
  };
}
