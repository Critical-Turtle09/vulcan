// SLICE 1 — THE ORB (spec §6-B, RL-2 LOCKED: particle-field body).
// A dark-core sphere wearing a luminous particle ring (Gargantua form, never a
// plain circle). Four states — idle / listening / thinking / speaking — selected
// on keys 1-4. Every state change is a MATERIAL reorganization: agitation, ring
// glow/tilt, spin and the surfacing network constellations all lerp continuously
// toward the target (doctrine 11 — the body reorganizes, nothing snaps).
import * as THREE from 'three';
import { color } from '../tokens.js';
import { SIMPLEX3 } from '../glsl-noise.js';
import { simplex3 } from '../noise.js';
import rawTokens from '../../tokens.json';   // orb.* sub-tree (scene() only reaches scene.*)

const NF = 0.28;       // noise frequency for body agitation
const NT = 0.12;       // noise time rate

// shared displacement — MUST match the GLSL below so the CPU constellation rides
// the same body. rotate base around Y by spin, breathe, add curl-ish noise*agitation.
function rotY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
}
function displace(base, t, spinAngle, breathe, agitation) {
  const r = rotY(base, spinAngle);
  const ox = simplex3(base[0] * NF + t * NT, base[1] * NF, base[2] * NF);
  const oy = simplex3(base[0] * NF, base[1] * NF + t * NT + 40, base[2] * NF);
  const oz = simplex3(base[0] * NF, base[1] * NF, base[2] * NF + t * NT + 80);
  return [
    r[0] * breathe + ox * agitation,
    r[1] * breathe + oy * agitation,
    r[2] * breathe + oz * agitation,
  ];
}

export function createOrb() {
  const rawOrb = rawTokens.orb;
  const N = rawOrb.particleCount;
  const R = rawOrb.radius;
  const jitter = rawOrb.shellJitter;

  // deterministic RNG (no clock) — reproducible orb for the audit
  let rr = 990031;
  const rnd = () => { rr = (rr * 1103515245 + 12345) & 0x7fffffff; return rr / 0x7fffffff; };

  // ---- particle-field body (fibonacci shell + radial jitter) ----
  const base = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  const scatter = new Float32Array(N * 3); // granular formation start cloud
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const rr2 = R * (1 - jitter * 0.5 * rnd());
    const bx = Math.cos(th) * rad * rr2, by = y * rr2, bz = Math.sin(th) * rad * rr2;
    base[i*3] = bx; base[i*3+1] = by; base[i*3+2] = bz;
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
    uSpin:{value:0}, uBreathe:{value:1}, uAgitation:{value:0.16},
    uSize:{value:rawOrb.pointSize},
    uBone:{value:color('data.bone')}, uDim:{value:color('data.dim')}, uHaze:{value:color('haze')},
    uEmber:{value:color('signal.ember')},
    uNF:{value:NF}, uNT:{value:NT},
  };

  const body = new THREE.Points(bodyGeo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      ${SIMPLEX3}
      attribute float aSeed; attribute vec3 aScatter;
      uniform float uTime,uReveal,uPixelRatio,uSpin,uBreathe,uAgitation,uSize,uNF,uNT;
      varying float vB; varying float vAlpha;
      vec3 rotY(vec3 v,float a){ float c=cos(a),s=sin(a); return vec3(c*v.x+s*v.z, v.y, -s*v.x+c*v.z); }
      void main(){
        vec3 b = position;
        vec3 r = rotY(b, uSpin) * uBreathe;
        vec3 off = vec3(
          snoise(vec3(b.x*uNF + uTime*uNT, b.y*uNF, b.z*uNF)),
          snoise(vec3(b.x*uNF, b.y*uNF + uTime*uNT + 40.0, b.z*uNF)),
          snoise(vec3(b.x*uNF, b.y*uNF, b.z*uNF + uTime*uNT + 80.0)));
        vec3 world = r + off * uAgitation;
        // granular formation — converge from a scattered cloud, noise-staggered
        float local = clamp((uReveal - aSeed*0.5)/0.5, 0.0, 1.0);
        local = local*local*(3.0-2.0*local);
        world = mix(position + aScatter, world, local);
        vB = 0.5 + 0.5*snoise(b*0.5);      // per-particle brightness variance
        vec4 mv = modelViewMatrix * vec4(world,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uPixelRatio * (300.0/-mv.z), 1.2, 6.0);
        vAlpha = local * (0.35 + 0.5*vB + 0.4*uAgitation);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBone,uDim,uHaze,uEmber; uniform float uAgitation;
      varying float vB; varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord-0.5; float d=length(c);
        float a = smoothstep(0.5,0.1,d);
        if(a*vAlpha<=0.002) discard;
        // greyscale only — ember is reserved for events (§3 rationed colour); the
        // orb has no events, so its presence stays bone/dim. Agitation reads through
        // motion + spread, not hue.
        vec3 col = mix(uDim, uBone, vB);
        gl_FragColor = vec4(col, a*vAlpha);
      }`,
  }));
  body.renderOrder = 1;

  // ---- dark core (Gargantua) — occludes back dust, faint fresnel rim ----
  const coreUni = {
    uCoreGlow:{value:0.35}, uStage:{value:color('stage')}, uHaze:{value:color('haze')},
  };
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(rawOrb.coreRadius, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: coreUni, transparent:true, depthWrite:true,
      vertexShader:/* glsl */`
        varying vec3 vN; varying vec3 vV;
        void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:/* glsl */`
        uniform float uCoreGlow; uniform vec3 uStage,uHaze; varying vec3 vN; varying vec3 vV;
        void main(){
          float fres = pow(1.0 - max(dot(vN,vV),0.0), 3.0);
          vec3 col = mix(uStage, uHaze, fres*uCoreGlow);
          gl_FragColor = vec4(col, 1.0);   // opaque dark body, luminous rim only
        }`,
    })
  );
  core.renderOrder = 0;

  // ---- luminous particle ring (accretion form) ----
  const RC = rawOrb['ring.count'], RI = rawOrb['ring.inner'], RO = rawOrb['ring.outer'];
  const rpos = new Float32Array(RC*3), rseed = new Float32Array(RC), rrad = new Float32Array(RC);
  for (let i=0;i<RC;i++){
    const ang = rnd()*Math.PI*2;
    const rr3 = RI + (RO-RI)*Math.pow(rnd(),0.7);
    rpos[i*3]=Math.cos(ang)*rr3; rpos[i*3+1]=(rnd()-0.5)*0.5; rpos[i*3+2]=Math.sin(ang)*rr3;
    rseed[i]=rnd(); rrad[i]=(rr3-RI)/(RO-RI);
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(rpos,3));
  ringGeo.setAttribute('aSeed', new THREE.BufferAttribute(rseed,1));
  ringGeo.setAttribute('aRad', new THREE.BufferAttribute(rrad,1));
  const ringUni = {
    uTime:{value:0}, uReveal:{value:0}, uPixelRatio:{value:1},
    uGlow:{value:0.55}, uTilt:{value:0.0}, uDrift:{value:0}, uSize:{value:rawOrb['ring.pointSize']},
    uBone:{value:color('data.bone')}, uHaze:{value:color('haze')}, uEmber:{value:color('signal.ember')},
  };
  const ring = new THREE.Points(ringGeo, new THREE.ShaderMaterial({
    uniforms: ringUni, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:/* glsl */`
      ${SIMPLEX3}
      attribute float aSeed, aRad;
      uniform float uTime,uReveal,uPixelRatio,uGlow,uTilt,uDrift,uSize;
      varying float vRad, vAlpha, vSeed;
      vec3 rotY(vec3 v,float a){ float c=cos(a),s=sin(a); return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z); }
      vec3 rotX(vec3 v,float a){ float c=cos(a),s=sin(a); return vec3(v.x, c*v.y-s*v.z, s*v.y+c*v.z); }
      void main(){
        vec3 p = position;
        p = rotY(p, uDrift);              // precession / drift off-axis
        p = rotX(p, uTilt);               // base tilt + state tilt toward camera (from tokens)
        // subtle shimmer along the ring
        p += normalize(vec3(p.x,0.0,p.z)) * snoise(vec3(aSeed*10.0, uTime*0.3, 0.0)) * 0.18;
        float local = clamp((uReveal - aSeed*0.4)/0.6, 0.0, 1.0);
        local = local*local*(3.0-2.0*local);
        p = mix(p * 2.2, p, local);       // form inward from a wider ghost ring
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * uPixelRatio * (300.0/-mv.z), 1.0, 5.0);
        vRad = aRad; vSeed = aSeed;
        vAlpha = local * uGlow * (0.4 + 0.6*(1.0-aRad));  // inner edge brighter
      }`,
    fragmentShader:/* glsl */`
      uniform vec3 uBone,uHaze,uEmber; uniform float uGlow;
      varying float vRad, vAlpha, vSeed;
      void main(){
        vec2 c=gl_PointCoord-0.5; float d=length(c);
        float a=smoothstep(0.5,0.12,d);
        if(a*vAlpha<=0.002) discard;
        vec3 col = mix(uBone, uHaze, vRad);              // bone inner edge -> haze outer
        col *= 1.0 + uGlow*0.8;                          // HDR for bloom on bright glow
        gl_FragColor = vec4(col, a*vAlpha);
      }`,
  }));
  ring.renderOrder = 2;

  // ---- network constellations (thinking state, Skyfall read) ----
  const CN = rawOrb.constelNodes, CL = rawOrb.constelLinks;
  const cIdx = [];
  for (let i=0;i<CN;i++) cIdx.push(Math.floor(rnd()*N));
  // precompute nearest links among constellation nodes (by base position)
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
  const cNodeMat = new THREE.PointsMaterial({ size:0.001, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:color('data.bone'), opacity:0, sizeAttenuation:true });
  const constNodes = new THREE.Points(cNodeGeo, cNodeMat);
  constNodes.renderOrder = 3;

  const group = new THREE.Group();
  group.add(core, body, ring, constLines, constNodes);

  // ---- state machine ----
  const STATES = rawOrb.states;
  const order = ['idle','listening','thinking','speaking'];
  let targetName = 'idle';
  const cur = { ...STATES.idle };      // continuously lerped values
  const lerpRate = rawOrb.stateLerp;
  let spinAngle = 0, driftAngle = 0;
  const breathePeriod = rawOrb.breathePeriod, breatheAmp = rawOrb.breatheAmp;
  const speakPeriod = rawOrb['speak.period'];

  function setState(name){ if (STATES[name]) targetName = name; }
  function setStateIndex(i){ if (order[i]) targetName = order[i]; }

  function update(dt, t, reveal, pixelRatio){
    const tgt = STATES[targetName];
    const k = Math.min(dt * lerpRate, 1);
    for (const key of Object.keys(cur)) cur[key] += (tgt[key] - cur[key]) * k;

    spinAngle += cur.spin * dt;
    driftAngle += (rawOrb['ring.driftAmp']) * dt;
    const breathe = 1 + Math.sin(t * 6.2831 / breathePeriod) * breatheAmp;

    // speaking amplitude — synthetic voice envelope (SIM, no audio in Slice 1)
    const amp = 0.5 + 0.5 * Math.abs(Math.sin(t/speakPeriod) * Math.sin(t*0.37));
    const speaking = targetName === 'speaking' ? 1 : 0;

    // body uniforms
    uni.uTime.value = t; uni.uReveal.value = reveal; uni.uPixelRatio.value = pixelRatio;
    uni.uSpin.value = spinAngle; uni.uBreathe.value = breathe; uni.uAgitation.value = cur.agitation;
    // core
    coreUni.uCoreGlow.value = cur.coreGlow;
    // ring — glow tracks voice amplitude when speaking
    ringUni.uTime.value = t; ringUni.uReveal.value = reveal; ringUni.uPixelRatio.value = pixelRatio;
    ringUni.uGlow.value = cur.ringGlow * (1 + speaking * (amp - 0.5) * 0.9);
    ringUni.uTilt.value = rawOrb['ring.baseTilt'] + cur.ringTilt;
    ringUni.uDrift.value = driftAngle;

    // constellations — surface with `constel`, positions ride the same body math
    const cv = cur.constel;
    lineMat.opacity = cv * 0.5;
    cNodeMat.opacity = cv * 0.9;
    cNodeMat.size = 0.14 + cv * 0.05;
    if (cv > 0.01) {
      for (let i=0;i<CN;i++){
        const bi = [base[cIdx[i]*3], base[cIdx[i]*3+1], base[cIdx[i]*3+2]];
        const w = displace(bi, t, spinAngle, breathe, cur.agitation);
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

  return { object: group, setState, setStateIndex, update, get stateName(){ return targetName; }, probe(){ return { ...cur }; } };
}
