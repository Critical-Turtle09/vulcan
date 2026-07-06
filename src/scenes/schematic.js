// PART 4 (DRAFT) — DEVICE/SCHEMATIC scene v0. A parametric GPU board built from
// primitives (board · GPU die · HBM stacks · VRMs · vapor shroud) in the house
// material: a dust dot-field that CONDENSES from scatter on summon, plus hairline
// blueprint edges. An EXPLODE command separates the components along axes, each
// labeled with legend context. Procedural only — no external 3D. scene.* tokens.
import * as THREE from 'three';
import { color } from '../tokens.js';
import rawTokens from '../../tokens.json';

const S = rawTokens.scene.schematic;

// components: assembled box (center, size), explode offset (along an axis), label,
// tone (0 board .. 1 die-warm) and dust density weight.
function layout() {
  const comps = [];
  comps.push({ id: 'board', center: [0, 0, 0], size: S.board, off: [0, -2.4, 0], label: 'SUBSTRATE · PCB', tone: 0.15, dens: 1.0 });
  comps.push({ id: 'die', center: [0, S.die[1] / 2 + 0.25, 0], size: S.die, off: [0, 3.2, 0], label: 'GPU DIE · N3', tone: 1.0, dens: 1.4 });
  const hbmN = S['hbm.count'];
  for (let i = 0; i < hbmN; i++) {
    const side = i < hbmN / 2 ? -1 : 1;
    const row = i % (hbmN / 2);
    const z = (row - (hbmN / 2 - 1) / 2) * (S.hbm[2] + 0.35);
    const x = side * (S.die[0] / 2 + S.hbm[0] / 2 + 0.5);
    comps.push({ id: `hbm${i}`, center: [x, S.hbm[1] / 2 + 0.25, z], size: S.hbm, off: [side * S['explode.spread'], 0.6, 0], label: i === 0 ? 'HBM3E · STACK ×' + hbmN : '', tone: 0.55, dens: 1.0 });
  }
  const vrmN = S['vrm.count'];
  for (let i = 0; i < vrmN; i++) {
    const x = (i - (vrmN - 1) / 2) * (S.vrm[0] + 0.5);
    comps.push({ id: `vrm${i}`, center: [x, S.vrm[1] / 2 + 0.25, S.board[2] / 2 - 0.9], size: S.vrm, off: [0, 0, S['explode.spread'] * 0.9], label: i === 0 ? 'VRM · POWER ×' + vrmN : '', tone: 0.35, dens: 0.8 });
  }
  return comps;
}

export function createSchematic() {
  const comps = layout();
  let rr = 20260706; const rnd = () => { rr = (rr * 1103515245 + 12345) & 0x7fffffff; return rr / 0x7fffffff; };

  // one dust points system for all component volumes; per-point component offset
  const pts = [];
  const density = S.dotDensity;
  for (const c of comps) {
    const [sx, sy, sz] = c.size;
    const vol = sx * sy * sz;
    const n = Math.max(40, Math.floor(vol * 26 * density * c.dens));
    for (let k = 0; k < n; k++) {
      // bias to the surface (shell) so boxes read as objects, not fog
      const shell = rnd() < 0.7;
      let px = (rnd() - 0.5), py = (rnd() - 0.5), pz = (rnd() - 0.5);
      if (shell) { const f = Math.floor(rnd() * 3); if (f === 0) px = rnd() < 0.5 ? -0.5 : 0.5; else if (f === 1) py = rnd() < 0.5 ? -0.5 : 0.5; else pz = rnd() < 0.5 ? -0.5 : 0.5; }
      pts.push({ x: c.center[0] + px * sx, y: c.center[1] + py * sy, z: c.center[2] + pz * sz, off: c.off, tone: c.tone, seed: rnd() });
    }
  }
  const N = pts.length;
  const pos = new Float32Array(N * 3), off = new Float32Array(N * 3), scat = new Float32Array(N * 3), seed = new Float32Array(N), tone = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    off[i * 3] = p.off[0]; off[i * 3 + 1] = p.off[1]; off[i * 3 + 2] = p.off[2];
    const a = rnd() * Math.PI * 2, b = rnd() * Math.PI - Math.PI / 2, d = 10 * (0.4 + rnd());
    scat[i * 3] = Math.cos(a) * Math.cos(b) * d; scat[i * 3 + 1] = Math.sin(b) * d + 5; scat[i * 3 + 2] = Math.sin(a) * Math.cos(b) * d;
    seed[i] = p.seed; tone[i] = p.tone;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOff', new THREE.BufferAttribute(off, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scat, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));

  const uni = {
    uReveal: { value: 0 }, uExplode: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: 1 },
    uHaze: { value: color('haze') }, uBone: { value: color('data.bone') }, uMolten: { value: color('signal.molten') },
  };
  const dust = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aOff, aScatter; attribute float aSeed, aTone;
      uniform float uReveal, uExplode, uTime, uPixelRatio;
      varying float vTone, vA;
      void main(){
        vec3 assembled = position + aOff * uExplode;
        float local = clamp((uReveal - aSeed*0.5)/0.5, 0.0, 1.0); local = local*local*(3.0-2.0*local);
        vec3 world = mix(position + aScatter, assembled, local);
        world.y += sin(uTime*0.6 + aSeed*6.28)*0.015;
        vTone = aTone; vA = local * (0.5 + 0.5*aTone);
        vec4 mv = modelViewMatrix * vec4(world,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.6 + aTone*1.2) * uPixelRatio * (300.0/-mv.z), 1.0, 5.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uHaze, uBone, uMolten; varying float vTone, vA;
      void main(){
        vec2 c = gl_PointCoord-0.5; float d=length(c); float a=smoothstep(0.5,0.1,d);
        if(a*vA<=0.002) discard;
        vec3 col = mix(uHaze, uBone, vTone);
        col = mix(col, uMolten, smoothstep(0.85,1.0,vTone)*0.5);  // die runs a touch hot
        gl_FragColor = vec4(col*(0.8+vTone*0.8), a*vA);
      }`,
  }));
  dust.frustumCulled = false;

  const group = new THREE.Group();
  group.add(dust);

  return {
    object: group,
    update(dt, t, reveal, explode, pixelRatio) {
      uni.uReveal.value = reveal; uni.uExplode.value = explode; uni.uTime.value = t; uni.uPixelRatio.value = pixelRatio;
    },
    // labelled parts (assembled + explode-offset world centroids) for tethering
    partScreens(explode) {
      return comps.filter((c) => c.label).map((c) => ({
        site: { name: c.label },
        world: new THREE.Vector3(c.center[0] + c.off[0] * explode, c.center[1] + c.off[1] * explode, c.center[2] + c.off[2] * explode),
      }));
    },
  };
}
