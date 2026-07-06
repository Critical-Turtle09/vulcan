// THE IGNITION (STAGE D) — the system-wide summon sequence. Molten sparks kindle
// at the screen edges, surge inward like metal catching in a crucible, condense
// onto the orb shell, and COOL from molten to greyscale as the command center
// resolves (doctrine 11 — one continuous granular crossflow; nothing bland). The
// caller parents this to the camera so edge->center reads in screen space, and
// drives it with a single presence value uP (0 hidden .. 1 resolved). Bank runs
// the same field in reverse.
import * as THREE from 'three';
import { color } from './tokens.js';
import { SIMPLEX3 } from './glsl-noise.js';
import rawTokens from '../tokens.json';

export function createIgnition({ homePos, homeScale, orbRadius, fov, aspect }) {
  const IG = rawTokens.ignition;
  const N = IG['spark.count'];
  const edge = new Float32Array(N * 3);      // start (screen-edge, at orb depth)
  const target = new Float32Array(N * 3);    // end (orb shell)
  const aSeed = new Float32Array(N);

  const d = Math.abs(homePos.z);
  let halfH = Math.tan((fov * Math.PI / 180) / 2) * d;
  let halfW = halfH * aspect;
  const R = orbRadius * homeScale;

  let r = 20260705;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };

  for (let i = 0; i < N; i++) {
    let ex, ey;
    if (rnd() < IG['spark.edgeBias']) {         // kindle on the screen border
      const side = Math.floor(rnd() * 4), u = rnd() * 2 - 1;
      if (side === 0) { ex = -halfW; ey = u * halfH; }
      else if (side === 1) { ex = halfW; ey = u * halfH; }
      else if (side === 2) { ey = -halfH; ex = u * halfW; }
      else { ey = halfH; ex = u * halfW; }
      ex *= 1.12; ey *= 1.12;                    // just past the edge
    } else { ex = (rnd() * 2 - 1) * halfW; ey = (rnd() * 2 - 1) * halfH; }
    edge[i * 3] = homePos.x + ex; edge[i * 3 + 1] = homePos.y + ey; edge[i * 3 + 2] = homePos.z + (rnd() - 0.5) * 5;
    // land on the orb shell
    const a = rnd() * Math.PI * 2, b = Math.acos(rnd() * 2 - 1), rr = R * (0.82 + 0.24 * rnd());
    target[i * 3] = homePos.x + Math.sin(b) * Math.cos(a) * rr;
    target[i * 3 + 1] = homePos.y + Math.cos(b) * rr;
    target[i * 3 + 2] = homePos.z + Math.sin(b) * Math.sin(a) * rr;
    aSeed[i] = rnd();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(edge, 3));
  geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

  const uni = {
    uP: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: 1 }, uSize: { value: IG['spark.size'] },
    uHot: { value: IG['spark.hotPush'] }, uStrike: { value: 0 }, uQuench: { value: 0 },
    uSteamRise: { value: IG['quench.steamRise'] }, uEmberFall: { value: IG['quench.emberFall'] },
    uMolten: { value: color('signal.molten') }, uForge: { value: color('signal.forge') },
    uBone: { value: color('data.bone') }, uHaze: { value: color('haze') },
  };

  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute vec3 aTarget; attribute float aSeed;
      uniform float uP, uTime, uPixelRatio, uSize, uStrike, uQuench, uSteamRise, uEmberFall;
      varying float vHeat, vA;
      void main(){
        // per-spark staggered surge — edge sparks kindle first, then converge.
        // the STRIKE throws the surge: a brief global pull toward the anvil.
        float local = clamp((uP - aSeed*0.22)/0.62 + uStrike*0.18, 0.0, 1.0);
        float e = local*local*(3.0-2.0*local);
        vec3 pos = mix(position, aTarget, e);
        // turbulence on the way in — sparks curl like metal catching, not a straight line
        float turb = (1.0 - e) * 1.6;
        pos += vec3(
          snoise(vec3(aSeed*8.0, uTime*0.8, 0.0)),
          snoise(vec3(0.0, aSeed*8.0 + uTime*0.8, 5.0)),
          snoise(vec3(3.0, 0.0, aSeed*8.0 + uTime*0.8))) * turb;
        // THE QUENCH — most cooling sparks steam UPWARD, a few heavy embers FALL,
        // all drift OUTWARD as the orb dissolves and the real screen shows through.
        float steam = step(0.18, aSeed);                     // ~82% steam, ~18% embers
        float vy = steam * uSteamRise - (1.0 - steam) * uEmberFall;
        pos.y += uQuench * (1.0 - e) * vy * (2.0 + 3.0*aSeed);
        pos.x += uQuench * (1.0 - e) * (aSeed - 0.5) * 3.4;  // outward steam spread
        vHeat = (1.0 - local) * (1.0 - 0.55*uQuench) + uStrike*0.6;  // strike flares, quench cools
        // kindle in, blaze during the surge, hand off (fade) as the orb takes over
        vA = smoothstep(0.0,0.12,uP) * (1.0 - smoothstep(0.72,1.0,local)) * (0.35 + 0.65*e);
        vec4 mv = modelViewMatrix * vec4(pos,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize*(0.7+1.7*vHeat)*(1.0+uStrike*0.8)*uPixelRatio*(300.0/-mv.z), 1.2, 14.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMolten,uForge,uBone,uHaze; uniform float uHot,uQuench; varying float vHeat, vA;
      void main(){
        vec2 c = gl_PointCoord-0.5; float dd=length(c);
        float a = smoothstep(0.5,0.08,dd);
        if(a*vA<=0.002) discard;
        // molten-iron heat cooling to greyscale: forge -> molten -> bone -> haze.
        // the quench pushes the cool end toward steam-grey (haze).
        vec3 hot = mix(uMolten, uForge, smoothstep(0.5,1.0,vHeat));
        vec3 cool = mix(mix(uHaze, uBone, 0.6), uHaze, uQuench);
        vec3 col = mix(cool, hot, vHeat);
        col *= 1.0 + vHeat*uHot;                    // HDR push so hot sparks bloom molten
        gl_FragColor = vec4(col, a*vA);
      }`,
  }));
  points.frustumCulled = false;

  // ---- STRIKE SHOCKWAVE — TWO molten hairline rings thrown from the anvil (the
  // hammer-on-anvil impact, abstract: particle/hairline read, no clipart): a lead
  // ring and a lagging inner ghost, each independently wobbled so the strike reads
  // richer than a single circle. They expand and fade across the strike window. ----
  const SHOCK_MAX = IG['shock.max'], INNER_LAG = IG['shock.innerLag'];
  function makeShockRing(h1, h2, ph) {
    const SHM = 150;
    const p = new Float32Array(SHM * 3);
    for (let i = 0; i < SHM; i++) {
      const th = i / SHM * Math.PI * 2, wob = 1 + 0.06 * Math.sin(th * h1 + ph) + 0.04 * Math.sin(th * h2 + ph * 1.7);
      p[i * 3] = Math.cos(th) * wob; p[i * 3 + 1] = Math.sin(th) * wob; p[i * 3 + 2] = 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.LineBasicMaterial({ color: color('signal.forge'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const loop = new THREE.LineLoop(g, m);
    loop.position.set(homePos.x, homePos.y, homePos.z);
    loop.renderOrder = 5;
    loop.frustumCulled = false;
    return { loop, mat: m };
  }
  const shockLead = makeShockRing(7, 13, 1.3);
  const shockGhost = makeShockRing(9, 17, 4.1);

  const grp = new THREE.Group();
  grp.add(points, shockLead.loop, shockGhost.loop);

  return {
    object: grp,
    setP(p) { uni.uP.value = p; },
    setTime(t) { uni.uTime.value = t; },
    setPixelRatio(dpr) { uni.uPixelRatio.value = dpr; },
    setStrike(flash) { uni.uStrike.value = flash; },          // 0..1 spark flash bell
    setQuench(q) { uni.uQuench.value = q; },                  // 0 ignition .. 1 bank (steam)
    setShock(w) {                                             // 0..1 monotonic expand+fade
      const scL = R * (0.5 + w * SHOCK_MAX);
      shockLead.loop.scale.setScalar(scL);
      shockLead.mat.opacity = Math.max(0, 1 - w) * 0.85 * (w > 0.001 ? 1 : 0);
      // ghost ring lags behind the lead, expands faster, fades sooner
      const wg = Math.max(0, (w - INNER_LAG) / (1 - INNER_LAG));
      const scG = R * (0.35 + wg * SHOCK_MAX * 1.25);
      shockGhost.loop.scale.setScalar(scG);
      shockGhost.mat.opacity = Math.max(0, 1 - wg) * 0.5 * (wg > 0.001 ? 1 : 0);
    },
    resize(asp) { halfH = Math.tan((fov * Math.PI / 180) / 2) * d; halfW = halfH * asp; },
  };
}
