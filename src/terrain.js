// Particle-terrain patch (REF-03 Anduril matter, REF-01 sand-table staging).
// A grid of points displaced into a height field by GLSL fbm, drifting on idle
// physics. Forms granularly on reveal (doctrine 11: nothing pops in) — points
// converge from a scattered cloud into the terrain, staggered by per-point noise.
import * as THREE from 'three';
import { color, scene } from './tokens.js';
import { SIMPLEX3 } from './glsl-noise.js';

export function createTerrain() {
  const [gx, gz] = scene('terrain.grid');
  const spanX = scene('terrain.spanX');
  const spanZ = scene('terrain.spanZ');
  const count = gx * gz;

  const base = new Float32Array(count * 3);   // grid position (y filled by shader)
  const seed = new Float32Array(count);        // per-point stagger + scatter dir seed
  const scatter = new Float32Array(count * 3); // random offset for granular formation

  let i = 0;
  // deterministic pseudo-random (no clock) for scatter directions
  let r = 20260704;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };

  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const px = (x / (gx - 1) - 0.5) * spanX;
      const pz = (z / (gz - 1) - 0.5) * spanZ;
      base[i * 3] = px; base[i * 3 + 1] = 0; base[i * 3 + 2] = pz;
      seed[i] = rnd();
      const a = rnd() * Math.PI * 2, b = rnd() * Math.PI - Math.PI / 2;
      const d = scene('terrain.scatter') * (0.4 + rnd());
      scatter[i * 3]     = Math.cos(a) * Math.cos(b) * d;
      scatter[i * 3 + 1] = Math.sin(b) * d + 4.0;
      scatter[i * 3 + 2] = Math.sin(a) * Math.cos(b) * d;
      i++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));

  const uniforms = {
    uTime:        { value: 0 },
    uReveal:      { value: 0 },          // 0..1 global formation progress
    uDrift:       { value: 0 },
    uPixelRatio:  { value: 1 },
    uHeightAmp:   { value: scene('terrain.heightAmp') },
    uNoiseScale:  { value: scene('terrain.noiseScale') },
    uPointSize:   { value: scene('terrain.pointSize') },
    uAlbedoBoost: { value: scene('terrain.albedoBoost') },
    uKeyDir:      { value: new THREE.Vector3(...scene('terrain.keyLightDir')).normalize() },
    uLightAmb:    { value: scene('terrain.lightAmbient') },
    uLightKey:    { value: scene('terrain.lightKey') },
    uDeep:        { value: color('terrain.deep') },
    uMid:         { value: color('terrain.mid') },
    uHigh:        { value: color('terrain.high') },
    uHaze:        { value: color('haze') },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute float aSeed;
      attribute vec3 aScatter;
      uniform float uTime, uReveal, uDrift, uPixelRatio;
      uniform float uHeightAmp, uNoiseScale, uPointSize;
      uniform vec3 uKeyDir;
      uniform float uLightAmb, uLightKey;
      varying float vH;      // normalized height for color
      varying float vAlpha;
      varying float vLight;  // directional relief (key + ambient)

      float height(vec2 xz){
        return fbm(vec3(xz.x*uNoiseScale + uDrift, xz.y*uNoiseScale - uDrift*0.6, uTime*0.03));
      }

      void main(){
        vec3 pos = position;
        // height field: fbm over xz, slowly drifting (idle physics)
        float h = height(pos.xz);
        pos.y = h * uHeightAmp;
        vH = clamp(h*0.5 + 0.5, 0.0, 1.0);

        // finite-difference normal -> key light from upper-left rakes the ridges,
        // valleys fall to shadow. This is what turns dim dust into staged terrain
        // (§6 STAGE: lit bodies). Recomputed with drift, so relief lives.
        float e = 0.65;
        float hx = height(pos.xz + vec2(e, 0.0));
        float hz = height(pos.xz + vec2(0.0, e));
        vec3 nrm = normalize(vec3((h-hx)*uHeightAmp, e, (h-hz)*uHeightAmp));
        float key = clamp(dot(nrm, uKeyDir), 0.0, 1.0);
        // strong key so the dark-greyscale ground still reads across a room — the
        // brightness lever that respects the locked palette is light, not color.
        vLight = uLightAmb + uLightKey*key;

        // granular formation: stagger each point's arrival by its seed (noise stagger,
        // never linear) so the patch coalesces rather than switching on.
        float local = clamp((uReveal - aSeed*0.6) / 0.4, 0.0, 1.0);
        local = local*local*(3.0-2.0*local); // smoothstep
        vec3 formed = pos;
        vec3 fromCloud = pos + aScatter;
        vec3 world = mix(fromCloud, formed, local);

        // breathing micro-motion so idle is never static (sub-1%)
        world.y += sin(uTime*0.5 + aSeed*6.28) * 0.03;

        vec4 mv = modelViewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mv;
        // distance-attenuated, but floored so far ground never vanishes
        gl_PointSize = clamp(uPointSize * uPixelRatio * (300.0 / -mv.z), 1.5, 6.5);

        // higher ground reads brighter; ridgelines carry the data ink. Kept legible
        // (quiet, but readable across a room — §2.4/§6 STAGE), not a black void.
        float baseAlpha = mix(0.8, 1.0, vH);
        vAlpha = baseAlpha * local;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uMid, uHigh, uHaze;
      uniform float uAlbedoBoost;
      varying float vH;
      varying float vAlpha;
      varying float vLight;
      void main(){
        // soft round point (no hard square — granular, not pixelated)
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        // firmer disc — opaque core out to ~0.32, soft only at the rim, so the
        // dense grid reads as a coherent particulate surface (REF-03), not a
        // sprinkle of faint dots.
        float a = smoothstep(0.5, 0.32, d);
        if (a <= 0.001) discard;
        // deep valleys -> mid slopes -> high ridges (terrain.* tokens). Ridge haze
        // adds a touch of atmospheric lift so contour reads without going bright.
        vec3 col = mix(uMid, uHigh, smoothstep(0.0, 0.7, vH));
        col = mix(col, uHaze, smoothstep(0.7, 1.0, vH) * 0.5);
        col = mix(uDeep, col, smoothstep(0.0, 0.15, vH)); // only the deepest valleys sink to deep
        // albedo lift: the palette greys are near-black in linear light; a fixed
        // boost brings the graphite terrain up to a readable-but-quiet level while
        // preserving the token hue relationships. Relief from vLight rides on top.
        col *= uAlbedoBoost * vLight;
        gl_FragColor = vec4(col, a * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;

  return {
    object: points,
    uniforms,
    // sample the same height field on the CPU so nodes sit ON the terrain
    heightAt(px, pz, drift, time) {
      return sampleFbm(
        px * uniforms.uNoiseScale.value + drift,
        pz * uniforms.uNoiseScale.value - drift * 0.6,
        time * 0.03
      ) * uniforms.uHeightAmp.value;
    },
  };
}

// CPU mirror of the GLSL fbm/snoise (same constants) so node placement matches
// the shader height field. Imported lazily to keep this file self-contained.
import { simplex3 } from './noise.js';
function sampleFbm(x, y, z) {
  let f = 0, a = 0.5, px = x, py = y, pz = z;
  for (let i = 0; i < 4; i++) { f += a * simplex3(px, py, pz); px *= 2.03; py *= 2.03; pz *= 2.03; a *= 0.5; }
  return f;
}
