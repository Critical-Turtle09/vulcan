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
    uHot: { value: IG['spark.hotPush'] },
    uMolten: { value: color('signal.molten') }, uForge: { value: color('signal.forge') },
    uBone: { value: color('data.bone') }, uHaze: { value: color('haze') },
  };

  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute vec3 aTarget; attribute float aSeed;
      uniform float uP, uTime, uPixelRatio, uSize;
      varying float vHeat, vA;
      void main(){
        // per-spark staggered surge — edge sparks kindle first, then converge
        float local = clamp((uP - aSeed*0.22)/0.62, 0.0, 1.0);
        float e = local*local*(3.0-2.0*local);
        vec3 pos = mix(position, aTarget, e);
        // turbulence on the way in — sparks curl like metal catching, not a straight line
        float turb = (1.0 - e) * 1.6;
        pos += vec3(
          snoise(vec3(aSeed*8.0, uTime*0.8, 0.0)),
          snoise(vec3(0.0, aSeed*8.0 + uTime*0.8, 5.0)),
          snoise(vec3(3.0, 0.0, aSeed*8.0 + uTime*0.8))) * turb;
        vHeat = 1.0 - local;                       // hot at the edge, cooled on arrival
        // kindle in, blaze during the surge, hand off (fade) as the orb takes over
        vA = smoothstep(0.0,0.12,uP) * (1.0 - smoothstep(0.72,1.0,local)) * (0.35 + 0.65*e);
        vec4 mv = modelViewMatrix * vec4(pos,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize*(0.7+1.7*vHeat)*uPixelRatio*(300.0/-mv.z), 1.2, 12.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMolten,uForge,uBone,uHaze; uniform float uHot; varying float vHeat, vA;
      void main(){
        vec2 c = gl_PointCoord-0.5; float dd=length(c);
        float a = smoothstep(0.5,0.08,dd);
        if(a*vA<=0.002) discard;
        // molten-iron heat cooling to greyscale: forge -> molten -> bone -> haze
        vec3 hot = mix(uMolten, uForge, smoothstep(0.5,1.0,vHeat));
        vec3 cool = mix(uHaze, uBone, 0.6);
        vec3 col = mix(cool, hot, vHeat);
        col *= 1.0 + vHeat*uHot;                    // HDR push so hot sparks bloom molten
        gl_FragColor = vec4(col, a*vA);
      }`,
  }));
  points.frustumCulled = false;

  return {
    object: points,
    setP(p) { uni.uP.value = p; },
    setTime(t) { uni.uTime.value = t; },
    setPixelRatio(dpr) { uni.uPixelRatio.value = dpr; },
    resize(asp) { halfH = Math.tan((fov * Math.PI / 180) / 2) * d; halfW = halfH * asp; },
  };
}
