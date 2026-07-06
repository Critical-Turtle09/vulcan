// THE ORB (spec v1.3 FORGE AMENDMENT — Front B revised). The Saturn ring is
// RETIRED. VULCAN's form is now a particle-field sphere whose OUTER CONTOUR is
// WAVES — granular displacement of the house dust (never smooth neon lines). The
// particle body rides the waves as its foundation.
//
// AUDIO-REACTIVE (doctrine 11, the body reorganizes to signal):
//   idle      — near-calm sea + a tiny breathing heartbeat
//   listening — waves stir to the operator's MIC amplitude
//   speaking  — waves surge to the TTS playback envelope
//   thinking  — the sea churns and network constellations surface (Skyfall read)
// Every state change lerps continuously — nothing snaps.
import * as THREE from 'three';
import { color } from '../tokens.js';
import { SIMPLEX3 } from '../glsl-noise.js';
import { simplex3 } from '../noise.js';
import rawTokens from '../../tokens.json';

const NF = 0.28, NT = 0.12;   // body agitation noise freq / time rate

export function createOrb() {
  const O = rawTokens.orb;
  const N = O.particleCount;
  const R = O.radius;
  const jitter = O.shellJitter;
  const W = {
    baseAmp: O['wave.baseAmp'], freqA: O['wave.freqA'], freqB: O['wave.freqB'],
    speed: O['wave.speed'], chop: O['wave.chop'], audioGain: O['wave.audioGain'],
    maxAmp: O['wave.maxAmp'], crestBoost: O['wave.crestBoost'],
  };
  // two fixed wave directions (the sea has a swell axis + a cross-chop axis)
  const DIR1 = new THREE.Vector3(0.6, 0.2, 0.77).normalize();
  const DIR2 = new THREE.Vector3(-0.5, 0.8, 0.32).normalize();

  // deterministic RNG (no clock) — reproducible orb for the audit
  let rr = 990031;
  const rnd = () => { rr = (rr * 1103515245 + 12345) & 0x7fffffff; return rr / 0x7fffffff; };

  // ---- particle-field body (fibonacci shell + radial jitter) ----
  const base = new Float32Array(N * 3);       // unit-ish shell positions (pre-wave)
  const seed = new Float32Array(N);
  const scatter = new Float32Array(N * 3);    // granular formation start cloud
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const rr2 = R * (1 - jitter * 0.5 * rnd());
    base[i*3] = Math.cos(th) * rad * rr2; base[i*3+1] = y * rr2; base[i*3+2] = Math.sin(th) * rad * rr2;
    seed[i] = rnd();
    const a = rnd() * Math.PI * 2, b = rnd() * Math.PI - Math.PI/2, d = R * (1.6 + rnd()*1.4);
    scatter[i*3] = Math.cos(a)*Math.cos(b)*d; scatter[i*3+1] = Math.sin(b)*d; scatter[i*3+2] = Math.sin(a)*Math.cos(b)*d;
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  bodyGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  bodyGeo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));

  const uni = {
    uTime:{value:0}, uReveal:{value:0}, uPixelRatio:{value:1},
    uSpin:{value:0}, uBreathe:{value:1}, uAgitation:{value:0.1},
    uWaveAmp:{value:0.16}, uSize:{value:O.pointSize},
    uR:{value:R},
    uFreqA:{value:W.freqA}, uFreqB:{value:W.freqB}, uWaveSpeed:{value:W.speed}, uChop:{value:W.chop},
    uCrest:{value:W.crestBoost},
    uDir1:{value:DIR1.clone()}, uDir2:{value:DIR2.clone()},
    uBone:{value:color('data.bone')}, uDim:{value:color('data.dim')}, uHaze:{value:color('haze')},
    uNF:{value:NF}, uNT:{value:NT},
  };

  const WAVE_GLSL = /* glsl */`
    float waveField(vec3 n, float t){
      float w = sin(dot(n, uDir1)*uFreqA + t*uWaveSpeed);
      w += 0.6 * sin(dot(n, uDir2)*uFreqB - t*uWaveSpeed*1.3);
      w += uChop * snoise(n*2.4 + vec3(0.0, t*0.25, 0.0));
      return w * 0.62;   // -> ~[-1,1]
    }`;

  const body = new THREE.Points(bodyGeo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute float aSeed; attribute vec3 aScatter;
      uniform float uTime,uReveal,uPixelRatio,uSpin,uBreathe,uAgitation,uWaveAmp,uSize,uNF,uNT;
      uniform float uR,uFreqA,uFreqB,uWaveSpeed,uChop,uCrest;
      uniform vec3 uDir1,uDir2;
      varying float vB, vAlpha, vCrest;
      vec3 rotY(vec3 v,float a){ float c=cos(a),s=sin(a); return vec3(c*v.x+s*v.z, v.y, -s*v.x+c*v.z); }
      ${WAVE_GLSL}
      void main(){
        vec3 b = rotY(position, uSpin);
        vec3 n = normalize(b);
        // WAVE displacement of the outer contour — the dust rides the swell
        float wf = waveField(n, uTime);
        vCrest = clamp(wf*0.5+0.5, 0.0, 1.0);
        vec3 crested = b * (1.0 + wf * uWaveAmp) * uBreathe;
        // fine body agitation (turbulence riding on the waves)
        vec3 off = vec3(
          snoise(vec3(position.x*uNF + uTime*uNT, position.y*uNF, position.z*uNF)),
          snoise(vec3(position.x*uNF, position.y*uNF + uTime*uNT + 40.0, position.z*uNF)),
          snoise(vec3(position.x*uNF, position.y*uNF, position.z*uNF + uTime*uNT + 80.0)));
        vec3 world = crested + off * uAgitation;
        // granular formation — converge from a scattered cloud, noise-staggered
        float local = clamp((uReveal - aSeed*0.5)/0.5, 0.0, 1.0);
        local = local*local*(3.0-2.0*local);
        world = mix(position + aScatter, world, local);
        vB = 0.5 + 0.5*snoise(position*0.5);
        vec4 mv = modelViewMatrix * vec4(world,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uPixelRatio * (300.0/-mv.z), 1.2, 6.0);
        // crests brighten (bone) — the wave face catches the light
        vAlpha = local * (0.32 + 0.45*vB + 0.35*uAgitation + uCrest*vCrest*uWaveAmp*0.9);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone,uDim,uHaze; uniform float uCrest;
      varying float vB, vAlpha, vCrest;
      void main(){
        vec2 c = gl_PointCoord-0.5; float d=length(c);
        float a = smoothstep(0.5,0.1,d);
        if(a*vAlpha<=0.002) discard;
        // greyscale only — molten heat is reserved for events (§3). Crest particles
        // lean bone, troughs cool toward dim. No hue; the sea reads in value + motion.
        vec3 col = mix(uDim, uBone, clamp(vB*0.7 + vCrest*0.5, 0.0, 1.0));
        gl_FragColor = vec4(col, a*vAlpha);
      }`,
  }));
  body.renderOrder = 1;

  // ---- dark core (Gargantua) — occludes back dust, faint fresnel rim. A molten
  // HEAT tick flashes the rim when the wire ignites an event with no map up (§B). ----
  const coreUni = {
    uCoreGlow:{value:0.34}, uHeat:{value:0},
    uStage:{value:color('stage')}, uHaze:{value:color('haze')}, uMolten:{value:color('signal.molten')},
  };
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(O.coreRadius, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: coreUni, transparent:true, depthWrite:true,
      vertexShader:/* glsl */`
        varying vec3 vN; varying vec3 vV;
        void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:/* glsl */`
        uniform float uCoreGlow,uHeat; uniform vec3 uStage,uHaze,uMolten; varying vec3 vN; varying vec3 vV;
        void main(){
          float fres = pow(1.0 - max(dot(vN,vV),0.0), 3.0);
          vec3 col = mix(uStage, uHaze, fres*uCoreGlow);
          col += uMolten * fres * uHeat * 1.7;    // molten rim tick — the forge sparks
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  core.renderOrder = 0;

  // ---- network constellations (thinking state, Skyfall read) ----
  const CN = O.constelNodes, CL = O.constelLinks;
  const cIdx = [];
  for (let i=0;i<CN;i++) cIdx.push(Math.floor(rnd()*N));
  const links = [];
  for (let i=0;i<CN;i++){
    const bi=[base[cIdx[i]*3],base[cIdx[i]*3+1],base[cIdx[i]*3+2]];
    const dists=[];
    for(let j=0;j<CN;j++) if(j!==i){ const bj=[base[cIdx[j]*3],base[cIdx[j]*3+1],base[cIdx[j]*3+2]];
      const dx=bi[0]-bj[0],dy=bi[1]-bj[1],dz=bi[2]-bj[2]; dists.push([dx*dx+dy*dy+dz*dz,j]); }
    dists.sort((a,b)=>a[0]-b[0]);
    for(let k=0;k<CL;k++){ const j=dists[k][1]; if(i<j) links.push([i,j]); }
  }
  const linePos = new Float32Array(links.length*2*3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos,3));
  const lineMat = new THREE.LineBasicMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:color('data.bone'), opacity:0 });
  const constLines = new THREE.LineSegments(lineGeo, lineMat);
  constLines.renderOrder = 3;
  const cNodePos = new Float32Array(CN*3);
  const cNodeGeo = new THREE.BufferGeometry();
  cNodeGeo.setAttribute('position', new THREE.BufferAttribute(cNodePos,3));
  const cNodeMat = new THREE.PointsMaterial({ size:0.14, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:color('data.bone'), opacity:0, sizeAttenuation:true });
  const constNodes = new THREE.Points(cNodeGeo, cNodeMat);
  constNodes.renderOrder = 3;

  // ---- wave-rings (Front B refinement, v1.3) — hairline bone contour rings
  // threading the orb, NEVER straight or perfectly circular: each vertex is
  // continuously displaced by noise (wavy, molten-surface read), each ring
  // independently phased and tilted. Audio-reactive like the body. ----
  const RG = O.rings || { count: 0, radii: [], segments: 128, noiseAmp: 0.2, noiseFreq: 2.6, audioGain: 0.5, speed: 0.4, tilts: [0], opacity: 0.5 };
  const rings = [];
  const group = new THREE.Group();
  group.add(core, body, constLines, constNodes);
  for (let i = 0; i < RG.count; i++) {
    const seg = RG.segments;
    const rpos = new Float32Array(seg * 3);
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const rmat = new THREE.LineBasicMaterial({
      color: color('data.bone'), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: RG.opacity, linewidth: RG.lineWeight || 1,
    });
    const loop = new THREE.LineLoop(rgeo, rmat);
    loop.renderOrder = 2;
    group.add(loop);
    rings.push({ geo: rgeo, pos: rpos, mat: rmat, seg, radius: (RG.radii[i] || 1) * R, tilt: RG.tilts[i % RG.tilts.length] || 0, phase: i * 1.73 });
  }

  // ---- CPU wave (must match the GLSL so constellations ride the same sea) ----
  function rotY(v, a){ const c=Math.cos(a), s=Math.sin(a); return [c*v[0]+s*v[2], v[1], -s*v[0]+c*v[2]]; }
  function rotX(v, a){ const c=Math.cos(a), s=Math.sin(a); return [v[0], c*v[1]-s*v[2], s*v[1]+c*v[2]]; }
  function waveFieldJS(n, t){
    const d1 = n[0]*DIR1.x + n[1]*DIR1.y + n[2]*DIR1.z;
    const d2 = n[0]*DIR2.x + n[1]*DIR2.y + n[2]*DIR2.z;
    let w = Math.sin(d1*W.freqA + t*W.speed);
    w += 0.6*Math.sin(d2*W.freqB - t*W.speed*1.3);
    w += W.chop * simplex3(n[0]*2.4, n[1]*2.4 + t*0.25, n[2]*2.4);
    return w*0.62;
  }
  function displaceJS(b, t, spin, breathe, agitation, waveAmp){
    const r = rotY(b, spin);
    const len = Math.hypot(r[0],r[1],r[2]) || 1;
    const n = [r[0]/len, r[1]/len, r[2]/len];
    const wf = waveFieldJS(n, t);
    const s = (1 + wf*waveAmp)*breathe;
    const ox = simplex3(b[0]*NF + t*NT, b[1]*NF, b[2]*NF);
    const oy = simplex3(b[0]*NF, b[1]*NF + t*NT + 40, b[2]*NF);
    const oz = simplex3(b[0]*NF, b[1]*NF, b[2]*NF + t*NT + 80);
    return [r[0]*s + ox*agitation, r[1]*s + oy*agitation, r[2]*s + oz*agitation];
  }

  // ---- state machine ----
  const STATES = O.states;
  const order = ['idle','listening','thinking','speaking'];
  let targetName = 'idle';
  const cur = { ...STATES.idle };
  const lerpRate = O.stateLerp;
  let spinAngle = 0;
  const breathePeriod = O.breathePeriod, breatheAmp = O.breatheAmp;

  // audio-reactive amplitude — fed real mic RMS (listening) or TTS envelope
  // (speaking). Attack/decay from orb.audio.* so wave surges feel like a sea, not
  // a strobe. reactive weight per state gates whether audio moves the waves.
  const A = { attack: O['audio.attack'], decay: O['audio.decay'] };
  let extAmp = 0, ampS = 0;
  let heatTick = 0;                      // molten rim flash, decays over wire.tick.decayMs
  const heatDecayMs = (rawTokens.wire && rawTokens.wire['tick.decayMs']) || 7000;

  function setState(name){ if (STATES[name]) targetName = name; }
  function setStateIndex(i){ if (order[i]) targetName = order[i]; }
  function setAmplitude(a){ extAmp = Math.max(0, Math.min(1, a || 0)); }
  function pulseHeat(v = 1){ heatTick = Math.min(1, Math.max(heatTick, v)); }

  function update(dt, t, reveal, pixelRatio){
    const tgt = STATES[targetName];
    const k = Math.min(dt * lerpRate, 1);
    for (const key of Object.keys(cur)) cur[key] += (tgt[key] - cur[key]) * k;

    spinAngle += cur.spin * dt;
    const breathe = 1 + Math.sin(t * 6.2831 / breathePeriod) * breatheAmp;

    const rate = (extAmp > ampS ? A.attack : A.decay);
    ampS += (extAmp - ampS) * Math.min(rate * dt * 60, 1);

    // effective wave amplitude — state base + audio surge (gated by reactive),
    // clamped so the sea churns hard but never blows apart (keeps the orb silhouette)
    const waveAmp = Math.min(cur.waveAmp + cur.reactive * W.audioGain * ampS, W.maxAmp);

    uni.uTime.value = t; uni.uReveal.value = reveal; uni.uPixelRatio.value = pixelRatio;
    uni.uSpin.value = spinAngle; uni.uBreathe.value = breathe;
    uni.uAgitation.value = cur.agitation; uni.uWaveAmp.value = waveAmp;
    heatTick = Math.max(0, heatTick - dt * 1000 / heatDecayMs);
    coreUni.uCoreGlow.value = cur.coreGlow; coreUni.uHeat.value = heatTick;

    // ---- wave-rings: wavy (never circular), independently phased, audio-reactive
    const ringAmp = RG.noiseAmp + RG.audioGain * cur.reactive * ampS;   // fraction of radius
    for (const rg of rings) {
      const p = rg.pos, seg = rg.seg, ph = rg.phase + t * RG.speed;
      for (let j = 0; j < seg; j++) {
        const th = j / seg * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
        const d1 = simplex3(ct * RG.noiseFreq, st * RG.noiseFreq, ph);              // radial wobble
        const d2 = simplex3(ct * RG.noiseFreq + 5, st * RG.noiseFreq + 5, ph * 0.7); // out-of-plane
        const rr = rg.radius * (1 + d1 * ringAmp);
        let q = [ct * rr * breathe, d2 * ringAmp * R * 0.42 * breathe, st * rr * breathe];
        q = rotX(q, rg.tilt);
        q = rotY(q, spinAngle * 0.5 + rg.phase * 0.4);      // slow precession, per-ring phase
        p[j*3] = q[0]; p[j*3+1] = q[1]; p[j*3+2] = q[2];
      }
      rg.geo.attributes.position.needsUpdate = true;
      rg.mat.opacity = RG.opacity * reveal * (0.72 + 0.5 * cur.reactive * ampS);
    }

    const cv = cur.constel;
    lineMat.opacity = cv * 0.5;
    cNodeMat.opacity = cv * 0.9;
    cNodeMat.size = 0.14 + cv * 0.05;
    if (cv > 0.01) {
      for (let i=0;i<CN;i++){
        const bi = [base[cIdx[i]*3], base[cIdx[i]*3+1], base[cIdx[i]*3+2]];
        const w = displaceJS(bi, t, spinAngle, breathe, cur.agitation, waveAmp);
        cNodePos[i*3]=w[0]; cNodePos[i*3+1]=w[1]; cNodePos[i*3+2]=w[2];
      }
      links.forEach((lk,li)=>{
        for(let s=0;s<2;s++){ const ni=lk[s];
          linePos[(li*2+s)*3]=cNodePos[ni*3]; linePos[(li*2+s)*3+1]=cNodePos[ni*3+1]; linePos[(li*2+s)*3+2]=cNodePos[ni*3+2]; }
      });
      cNodeGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.position.needsUpdate = true;
    }
  }

  return {
    object: group, setState, setStateIndex, setAmplitude, pulseHeat, update,
    get stateName(){ return targetName; },
    probe(){ return { ...cur, ampS, heatTick }; },
  };
}
