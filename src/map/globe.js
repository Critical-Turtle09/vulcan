// SLICE 2 — THE MAP. Hybrid canvas (RL-1): an ambient particle dot-globe that
// dives to oblique terrain. Greyscale world + white data marks; ember is wired
// but dark (no events this slice). The dive is a granular CROSSFLOW — the globe
// dissolves as the terrain forms, camera flying from orbit to oblique — one
// continuous reorganization, never a cut (doctrine 11).
import * as THREE from 'three';
import { color } from '../tokens.js';
import rawTokens from '../../tokens.json';
import { SIMPLEX3 } from '../glsl-noise.js';
import { llToVec3, landAt } from './geo.js';
import { SITES, ROUTES, LANES, siteById } from './sites.js';

const M = rawTokens.map;
const easeInOut = (x) => x * x * (3 - 2 * x);

export function createMap() {
  const R = M['globe.radius'];
  let rr = 424242;
  const rnd = () => { rr = (rr * 1103515245 + 12345) & 0x7fffffff; return rr / 0x7fffffff; };

  const group = new THREE.Group();          // everything
  const globeGroup = new THREE.Group();     // globe + sites + routes (orients on dive)
  group.add(globeGroup);

  // ---- dark occluder so only the near hemisphere of dots reads ----
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.992, 64, 40),
    new THREE.MeshBasicMaterial({ color: color('void'), transparent: true, opacity: 1 }),
  );
  occluder.renderOrder = 0;
  globeGroup.add(occluder);

  // ---- globe dot-field (land bright, ocean faint) ----
  const N = M['globe.points'];
  const gp = [], gs = [], gl = [], gsc = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
    const dir = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad);
    const lat = Math.asin(dir.y) * 180 / Math.PI;
    const lon = Math.atan2(dir.x, dir.z) * 180 / Math.PI;
    const land = landAt(lat, lon);
    const keep = land > 0.4 ? M['globe.landKeep'] : M['globe.oceanKeep'];
    if (rnd() > keep) continue;
    gp.push(dir.x * R, dir.y * R, dir.z * R);
    gs.push(rnd());
    gl.push(land);
    const a = rnd() * Math.PI * 2, b = rnd() * Math.PI - Math.PI / 2, d = M['globe.scatter'] * (0.5 + rnd());
    gsc.push(Math.cos(a) * Math.cos(b) * d, Math.sin(b) * d, Math.sin(a) * Math.cos(b) * d);
  }
  const globeGeo = new THREE.BufferGeometry();
  globeGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  globeGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(gs, 1));
  globeGeo.setAttribute('aLand', new THREE.Float32BufferAttribute(gl, 1));
  globeGeo.setAttribute('aScatter', new THREE.Float32BufferAttribute(gsc, 3));

  const gUni = {
    uTime: { value: 0 }, uReveal: { value: 0 }, uDive: { value: 0 }, uPixelRatio: { value: 1 },
    uSize: { value: M['globe.pointSize'] },
    uBone: { value: color('data.bone') }, uDim: { value: color('data.dim') }, uFaint: { value: color('data.faint') },
    uLandA: { value: M['globe.landAlpha'] }, uOceanA: { value: M['globe.oceanAlpha'] },
  };
  const globe = new THREE.Points(globeGeo, new THREE.ShaderMaterial({
    // NormalBlending (not additive): a quiet dot-field on a dark stage, so the limb
    // doesn't accumulate into a blown halo. Greyscale world must stay below the
    // bloom threshold — bloom is reserved for ember (§3).
    uniforms: gUni, transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute float aSeed, aLand; attribute vec3 aScatter;
      uniform float uTime,uReveal,uDive,uPixelRatio,uSize;
      varying float vLand, vAlpha;
      void main(){
        vLand = aLand;
        vec3 p = position;
        // tiny field jitter — the medium is never fully static (§2.5)
        p += normalize(p) * snoise(vec3(position.xy*0.4, uTime*0.15 + aSeed*6.0)) * 0.05;
        // initial granular formation
        float fl = clamp((uReveal - aSeed*0.5)/0.5, 0.0, 1.0); fl = fl*fl*(3.0-2.0*fl);
        p = mix(position + aScatter, p, fl);
        // dive dissolve — scatter outward + fade, staggered (crossflow with terrain)
        float dl = clamp((uDive - aSeed*0.45)/0.55, 0.0, 1.0);
        p += normalize(p) * dl * 6.0;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uPixelRatio * (300.0/-mv.z), 1.0, 5.0);
        vAlpha = fl * (1.0 - dl);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone,uDim,uFaint; uniform float uLandA,uOceanA;
      varying float vLand, vAlpha;
      void main(){
        vec2 c = gl_PointCoord-0.5; float d=length(c);
        float a = smoothstep(0.5,0.15,d);
        if(a*vAlpha<=0.002) discard;
        vec3 col = mix(uFaint, mix(uDim,uBone,vLand), smoothstep(0.35,0.6,vLand));
        float alpha = mix(uOceanA, uLandA, smoothstep(0.4,0.6,vLand));
        gl_FragColor = vec4(col, a*vAlpha*alpha);
      }`,
  }));
  globe.renderOrder = 1;
  globeGroup.add(globe);

  // ---- site marks (white) + ember hook (dark) ----
  const sp = [], ss = [], sa = [];
  const siteLocal = [];
  for (const s of SITES) {
    const v = llToVec3(s.lat, s.lon, R * 1.008);
    sp.push(v.x, v.y, v.z); ss.push(rnd()); sa.push(s.alert);
    siteLocal.push(v);
  }
  const siteGeo = new THREE.BufferGeometry();
  siteGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  siteGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 1));
  siteGeo.setAttribute('aAlert', new THREE.Float32BufferAttribute(sa, 1));
  const sUni = {
    uTime: { value: 0 }, uReveal: { value: 0 }, uDive: { value: 0 }, uPixelRatio: { value: 1 },
    uSize: { value: M['site.size'] }, uBone: { value: color('data.bone') }, uEmber: { value: color('signal.ember') },
    uPulseLo: { value: M['site.pulse'][0] },
  };
  const siteMarks = new THREE.Points(siteGeo, new THREE.ShaderMaterial({
    uniforms: sUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed, aAlert;
      uniform float uTime,uReveal,uDive,uPixelRatio,uSize,uPulseLo;
      varying float vAlert, vPulse;
      void main(){
        vAlert = aAlert;
        float period = 4.0 + aSeed*3.0;
        vPulse = mix(uPulseLo,1.0,0.5+0.5*sin(uTime*6.2831/period+aSeed*10.0));
        float fl = clamp((uReveal - aSeed*0.4)/0.6,0.0,1.0); fl=fl*fl*(3.0-2.0*fl);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize*(1.0+aAlert*1.5)*fl*uPixelRatio*(300.0/-mv.z);
        vPulse *= fl * (1.0 - clamp(uDive*1.4,0.0,1.0));
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone,uEmber; varying float vAlert, vPulse;
      void main(){
        vec2 c=gl_PointCoord-0.5; float d=length(c);
        float core=smoothstep(0.45,0.12,d), halo=smoothstep(0.5,0.3,d);
        if((core+halo)*vPulse<=0.002) discard;
        // ember ONLY when alert>0 (dark this slice); otherwise bone-white data mark
        vec3 col = mix(uBone, uEmber, step(0.01,vAlert));
        col *= 1.0 + vAlert*2.5;
        gl_FragColor = vec4(col, (core+halo*0.22)*vPulse);
      }`,
  }));
  siteMarks.renderOrder = 3;
  globeGroup.add(siteMarks);

  // ---- routes: faint great-circle arcs raised above the surface ----
  const routeMat = new THREE.LineBasicMaterial({ color: color('data.dim'), transparent: true, opacity: M['route.alpha'], blending: THREE.NormalBlending, depthWrite: false });
  const routeGroup = new THREE.Group();
  const SEG = M['route.segments'];
  const arcs = [...ROUTES.map((r) => [siteById(r.from), siteById(r.to)]),
    ...LANES.map((l) => [l.a, l.b])];
  for (const [a, b] of arcs) {
    const va = llToVec3(a.lat, a.lon, R).normalize();
    const vb = llToVec3(b.lat, b.lon, R).normalize();
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const v = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
      const lift = 1 + Math.sin(t * Math.PI) * M['route.arcHeight'];
      pts.push(v.multiplyScalar(R * lift));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    routeGroup.add(new THREE.Line(g, routeMat));
  }
  routeGroup.renderOrder = 2;
  globeGroup.add(routeGroup);

  // ---- dived terrain (map-owned, greyscale relief) — forms as globe dissolves ----
  const terrain = createDivedTerrain();
  terrain.object.visible = false;
  group.add(terrain.object);

  // ---------- dive controller ----------
  let mode = 'globe';        // globe | diving | terrain | surfacing
  let diveP = 0;             // 0 globe .. 1 terrain (eased target driven below)
  let diveRaw = 0;           // raw 0..1
  let target = null;         // site being dived into
  const durS = M['dive.durationMs'] / 1000;
  const targetQuat = new THREE.Quaternion();
  const idleQuat = new THREE.Quaternion();

  function orientQuatFor(site) {
    // rotate so the site faces +Z (toward the ambient camera)
    const from = llToVec3(site.lat, site.lon, 1).normalize();
    const to = new THREE.Vector3(0, 0, 1);
    return new THREE.Quaternion().setFromUnitVectors(from, to);
  }

  function dive(siteId) {
    const s = siteById(siteId); if (!s) return;
    target = s;
    // feedback <100ms: the dive transition begins on the next frame — the
    // transition IS the response (§2.11), no separate confirm needed.
    targetQuat.copy(orientQuatFor(s));
    idleQuat.copy(globeGroup.quaternion);
    terrain.setRegion(s);
    terrain.object.visible = true;
    mode = 'diving';
  }
  function surface() { if (mode === 'globe') return; mode = 'surfacing'; }

  function update(dt, t, pixelRatio, reveal) {
    // advance dive progress
    if (mode === 'diving') { diveRaw = Math.min(diveRaw + dt / durS, 1); if (diveRaw >= 1) mode = 'terrain'; }
    else if (mode === 'surfacing') { diveRaw = Math.max(diveRaw - dt / durS, 0); if (diveRaw <= 0) { mode = 'globe'; terrain.object.visible = false; target = null; } }
    diveP = easeInOut(diveRaw);

    // globe idle spin (ambient) + slerp to face target during dive
    if (mode === 'globe') {
      globeGroup.rotateY(M['globe.driftRate'] * dt);
    } else {
      // orient toward target through the first half of the dive
      const k = Math.min(diveRaw / 0.6, 1);
      globeGroup.quaternion.slerpQuaternions(idleQuat, targetQuat, easeInOut(k));
    }

    gUni.uTime.value = t; gUni.uReveal.value = reveal; gUni.uDive.value = diveP; gUni.uPixelRatio.value = pixelRatio;
    sUni.uTime.value = t; sUni.uReveal.value = reveal; sUni.uDive.value = diveP; sUni.uPixelRatio.value = pixelRatio;
    routeMat.opacity = M['route.alpha'] * (1 - Math.min(diveP * 1.4, 1)) * reveal;
    // shrink the depth-writing occluder to nothing as we dive, so it stops
    // punching a hole in the forming terrain (it only occludes the globe far side)
    const occ = 1 - THREE.MathUtils.smoothstep(diveP, 0.15, 0.7);
    occluder.scale.setScalar(Math.max(0.0001, occ));
    occluder.visible = occ > 0.002;
    occluder.material.opacity = occ;

    // terrain forms as the globe dissolves (crossflow)
    terrain.update(dt, t, diveP, pixelRatio);
  }

  // world positions of sites for DOM label projection (near-hemisphere only)
  function siteScreens(camera) {
    globeGroup.updateWorldMatrix(true, false);
    const out = [];
    for (let i = 0; i < SITES.length; i++) {
      const wp = siteLocal[i].clone().applyMatrix4(globeGroup.matrixWorld);
      const normal = wp.clone().normalize();
      const toCam = camera.position.clone().sub(wp).normalize();
      const facing = normal.dot(toCam);           // >0 => near hemisphere
      out.push({ site: SITES[i], world: wp, facing });
    }
    return out;
  }

  return {
    object: group, update, dive, surface, siteScreens,
    get mode() { return mode; },
    get diveP() { return diveP; },
    get diveRaw() { return diveRaw; },
    get target() { return target; },
    terrain,
  };
}

// ---------------- dived terrain (map.terrain.* tokens) ----------------
function createDivedTerrain() {
  const T = M;
  const [gx, gz] = T['terrain.grid'];
  const spanX = T['terrain.spanX'], spanZ = T['terrain.spanZ'];
  const count = gx * gz;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), scat = new Float32Array(count * 3);
  let r = 9182734; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  let i = 0;
  for (let z = 0; z < gz; z++) for (let x = 0; x < gx; x++) {
    pos[i * 3] = (x / (gx - 1) - 0.5) * spanX; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (z / (gz - 1) - 0.5) * spanZ;
    seed[i] = rnd();
    const a = rnd() * Math.PI * 2, b = rnd() * Math.PI - Math.PI / 2, d = 9 * (0.4 + rnd());
    scat[i * 3] = Math.cos(a) * Math.cos(b) * d; scat[i * 3 + 1] = Math.sin(b) * d + 4; scat[i * 3 + 2] = Math.sin(a) * Math.cos(b) * d;
    i++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scat, 3));
  const uni = {
    uTime: { value: 0 }, uReveal: { value: 0 }, uRegion: { value: 0 }, uPixelRatio: { value: 1 },
    uHeightAmp: { value: T['terrain.heightAmp'] }, uNoiseScale: { value: T['terrain.noiseScale'] },
    uPointSize: { value: T['terrain.pointSize'] }, uAlbedo: { value: T['terrain.albedoBoost'] },
    uKeyDir: { value: new THREE.Vector3(...T['terrain.lightDir']).normalize() },
    uAmb: { value: T['terrain.lightAmb'] }, uKey: { value: T['terrain.lightKey'] },
    uDeep: { value: color('terrain.deep') }, uMid: { value: color('terrain.mid') },
    uHigh: { value: color('terrain.high') }, uHaze: { value: color('haze') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute float aSeed; attribute vec3 aScatter;
      uniform float uTime,uReveal,uRegion,uPixelRatio,uHeightAmp,uNoiseScale,uPointSize,uAlbedo,uAmb,uKey;
      uniform vec3 uKeyDir;
      varying float vH, vAlpha, vLight;
      float height(vec2 xz){ return fbm(vec3(xz.x*uNoiseScale + uRegion, xz.y*uNoiseScale - uRegion*0.5, 0.0)); }
      void main(){
        vec3 p = position;
        float h = height(p.xz); p.y = h*uHeightAmp; vH = clamp(h*0.5+0.5,0.0,1.0);
        float e=0.65; float hx=height(p.xz+vec2(e,0.0)); float hz=height(p.xz+vec2(0.0,e));
        vec3 nrm = normalize(vec3((h-hx)*uHeightAmp, e, (h-hz)*uHeightAmp));
        vLight = uAmb + uKey*clamp(dot(nrm,uKeyDir),0.0,1.0);
        float local = clamp((uReveal - aSeed*0.6)/0.4,0.0,1.0); local=local*local*(3.0-2.0*local);
        p.y += sin(uTime*0.5+aSeed*6.28)*0.03;
        vec3 world = mix(position + aScatter, p, local);
        vec4 mv = modelViewMatrix*vec4(world,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(uPointSize*uPixelRatio*(300.0/-mv.z),1.5,7.0);
        vAlpha = mix(0.8,1.0,vH)*local;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep,uMid,uHigh,uHaze; uniform float uAlbedo;
      varying float vH,vAlpha,vLight;
      void main(){
        vec2 c=gl_PointCoord-0.5; float d=length(c);
        float a=smoothstep(0.5,0.32,d); if(a*vAlpha<=0.002) discard;
        vec3 col = mix(uMid,uHigh,smoothstep(0.0,0.7,vH));
        col = mix(col,uHaze,smoothstep(0.7,1.0,vH)*0.5);
        col = mix(uDeep,col,smoothstep(0.0,0.15,vH));
        col *= uAlbedo*vLight;
        gl_FragColor = vec4(col, a*vAlpha);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let regionSeed = 0;
  return {
    object: points, uniforms: uni,
    setRegion(site) { regionSeed = (Math.abs(site.lat) * 3.1 + Math.abs(site.lon) * 1.7) % 20; uni.uRegion.value = regionSeed; },
    update(dt, t, diveP, pixelRatio) {
      uni.uTime.value = t; uni.uPixelRatio.value = pixelRatio;
      // terrain forms in the back half of the dive (crossflow tail)
      uni.uReveal.value = THREE.MathUtils.smoothstep(diveP, 0.25, 1.0);
    },
  };
}
