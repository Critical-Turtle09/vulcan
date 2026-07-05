// The network laid on the terrain: nodes (heartbeat) + edges (the graph an event
// propagates along) + traveling ignition heads. Every mark encodes a datum
// (doctrine 2): nodes are sites, edges are supply links, ember heat is event
// recency. Nothing decorative.
import * as THREE from 'three';
import { color, scene, motion } from './tokens.js';

// Authored graph — a small corridor fragment. xz on the terrain patch; the event
// seeds at node 0 and propagates two hops outward.
const NODE_XZ = [
  [-9.5,  2.0],   // 0 seed
  [-3.0, -3.5],   // 1  (hop 1)
  [-4.5,  6.0],   // 2  (hop 1)
  [ 4.0, -6.0],   // 3  (hop 2)
  [ 3.5,  7.5],   // 4  (hop 2)
  [11.0, -1.0],   // 5
  [ 9.5,  4.5],   // 6
];
const EDGES = [
  [0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[1,2],[3,4],
];

export function createNetwork(terrain) {
  const n = NODE_XZ.length;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const heat = new Float32Array(n);          // 0 idle .. 1 just-ignited ember
  const dominant = new Float32Array(n);      // 1 for the event seed — the dominant ember
  dominant[0] = 1;
  let rr = 77003;
  const rnd = () => { rr = (rr * 1103515245 + 12345) & 0x7fffffff; return rr / 0x7fffffff; };

  const worldY = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = NODE_XZ[i];
    const y = terrain.heightAt(x, z, 0, 0) + 0.55; // ride just above the ground
    worldY[i] = y;
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    seed[i] = rnd();
  }

  // ---- nodes ----
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  nGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  nGeo.setAttribute('aHeat', new THREE.BufferAttribute(heat, 1));
  nGeo.setAttribute('aDominant', new THREE.BufferAttribute(dominant, 1));

  const nUniforms = {
    uTime:       { value: 0 },
    uReveal:     { value: 0 },
    uPixelRatio: { value: 1 },
    uSize:       { value: scene('node.size') },
    uIgniteBoost:{ value: scene('node.igniteBoost') },
    uDominantBoost:{ value: scene('node.dominantBoost') },
    uDim:        { value: color('data.dim') },
    uBone:       { value: color('data.bone') },
    uEmber:      { value: color('signal.ember') },
    uCooled:     { value: color('signal.cooled') },
    uFaint:      { value: color('data.faint') },
    uPulseLo:    { value: motion('idle.node.pulse')[0] },
  };

  const nodes = new THREE.Points(nGeo, new THREE.ShaderMaterial({
    uniforms: nUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed, aHeat, aDominant;
      uniform float uTime, uReveal, uPixelRatio, uSize, uIgniteBoost, uDominantBoost, uPulseLo;
      varying float vHeat;
      varying float vPulse;
      varying float vDom;
      void main(){
        vHeat = aHeat;
        vDom = aDominant;
        // heartbeat: desynced opacity pulse (idle.node.pulse), period per node
        float period = 4.0 + aSeed*3.0;
        float beat = mix(uPulseLo, 1.0, 0.5+0.5*sin(uTime*6.2831/period + aSeed*10.0));
        vPulse = beat;
        // granular arrival, staggered per node
        float local = clamp((uReveal - aSeed*0.5)/0.5, 0.0, 1.0);
        local = local*local*(3.0-2.0*local);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        // ignited nodes grow modestly; the dominant seed grows a touch more so
        // one event reads as THE event (§3 rationed colour, red-line: one dominant).
        float sz = uSize * (1.0 + aHeat*(uIgniteBoost + aDominant*uDominantBoost)) * local;
        gl_PointSize = sz * uPixelRatio * (300.0/-mv.z);
        vPulse *= local;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uDim, uBone, uEmber, uCooled, uFaint;
      varying float vHeat, vPulse, vDom;
      void main(){
        vec2 c = gl_PointCoord-0.5;
        float d = length(c);
        // sharp disc + a hair of halo — surgical signal, not a soft orb (red-line)
        float core = smoothstep(0.44, 0.14, d);
        float halo = smoothstep(0.5, 0.34, d);
        // heat -> color: idle bone/dim, ignite ember, cool through cooled -> faint
        vec3 idle = mix(uDim, uBone, 0.4);
        vec3 hot  = mix(uCooled, uEmber, smoothstep(0.55,1.0,vHeat));
        vec3 warm = mix(uFaint, uCooled, smoothstep(0.0,0.55,vHeat));
        vec3 heatCol = mix(warm, hot, step(0.55,vHeat));
        vec3 col = mix(idle, heatCol, smoothstep(0.02,0.2,vHeat));
        // HDR push so a SMALL sharp core crosses the bloom threshold; the dominant
        // seed pushes much harder so it out-blooms the two downstream embers, which
        // stay as sharp near-un-bloomed points (surgical signals, red-line §3).
        col *= 1.0 + vHeat*(2.6 + vDom*2.2);
        float a = (core + halo*0.22) * vPulse;
        if (a<=0.001) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
  }));
  nodes.frustumCulled = false;

  // ---- edges (the graph — faint standing links) ----
  const ePos = new Float32Array(EDGES.length * 2 * 3);
  const eSeed = new Float32Array(EDGES.length * 2);
  EDGES.forEach((e, k) => {
    for (let s = 0; s < 2; s++) {
      const idx = e[s];
      ePos[(k*2+s)*3]   = pos[idx*3];
      ePos[(k*2+s)*3+1] = pos[idx*3+1];
      ePos[(k*2+s)*3+2] = pos[idx*3+2];
      eSeed[k*2+s] = k / EDGES.length;
    }
  });
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('aSeed', new THREE.BufferAttribute(eSeed, 1));
  const eUniforms = {
    uReveal: { value: 0 },
    uFaint:  { value: color('data.faint') },
  };
  const edges = new THREE.LineSegments(eGeo, new THREE.ShaderMaterial({
    uniforms: eUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uReveal;
      varying float vA;
      void main(){
        float local = clamp((uReveal - aSeed*0.5)/0.5,0.0,1.0);
        vA = local*0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uFaint;
      varying float vA;
      void main(){ gl_FragColor = vec4(uFaint, vA*0.6); }
    `,
  }));
  edges.frustumCulled = false;

  // ---- traveling ignition heads (Apes propagation) ----
  const MAX_HEADS = 8;
  const hPos = new Float32Array(MAX_HEADS * 3);
  const hLife = new Float32Array(MAX_HEADS);   // 0..1 brightness, 0 = inactive
  const hGeo = new THREE.BufferGeometry();
  hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  hGeo.setAttribute('aLife', new THREE.BufferAttribute(hLife, 1));
  const hUniforms = {
    uPixelRatio: { value: 1 },
    uEmber: { value: color('signal.ember') },
  };
  const heads = new THREE.Points(hGeo, new THREE.ShaderMaterial({
    uniforms: hUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aLife;
      uniform float uPixelRatio;
      varying float vLife;
      void main(){
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (aLife>0.001 ? 1.0:0.0) * (3.0+5.0*aLife) * uPixelRatio * (300.0/-mv.z);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uEmber;
      varying float vLife;
      void main(){
        vec2 c=gl_PointCoord-0.5; float d=length(c);
        float a=smoothstep(0.5,0.0,d);
        if(a<=0.001||vLife<=0.001) discard;
        gl_FragColor=vec4(uEmber*(1.0+vLife*2.5), a*vLife);
      }
    `,
  }));
  heads.frustumCulled = false;

  const group = new THREE.Group();
  group.add(edges, nodes, heads);

  // ------- event / propagation controller -------
  const activeHeads = []; // {edge:[a,b], t, dur, onArrive}
  const igniteMs = motion('propagate.ignite.ms');
  const hopMs = motion('propagate.hop.ms');
  const headSpeed = motion('arc.head.speed');
  const coolMs = scene('event.coolMs');

  function nodePos(i){ return new THREE.Vector3(pos[i*3], pos[i*3+1], pos[i*3+2]); }

  // ignite a node: ease heat 0->1 over ignite.ms (never instant), then let cool
  const igniting = []; // {i, t, dir:+1 ignite / decay handled separately}
  function ignite(i){ igniting.push({ i, t: 0 }); }

  function launchHead(a, b, delayMs, onArrive){
    const pa = nodePos(a), pb = nodePos(b);
    const len = pa.distanceTo(pb);
    // a hop traverses its edge in propagate.hop.ms (Apes law — fast, staggered),
    // lightly scaled by edge length. NOT arc.head.speed (that governs ambient
    // supply arcs, not event propagation).
    const dur = Math.min(Math.max(hopMs[0]/1000 + len * 0.006, hopMs[0]/1000), hopMs[1]/1000);
    activeHeads.push({ a, b, pa, pb, len, dur, t: -delayMs/1000, fired:false, onArrive });
  }

  // fire a SINGLE-CHAIN 2-hop event from the seed (red-line §3: one dominant event,
  // 2-3 embers max). seed -> one hop-1 -> one hop-2 = 3 embers, propagating along
  // one real edge path (Apes law), not fanning out across the graph.
  const neighbors = (node, seen) => EDGES
    .filter(e => e[0] === node || e[1] === node)
    .map(e => (e[0] === node ? e[1] : e[0]))
    .filter(t => !seen.has(t));

  function triggerEvent(seed = 0){
    for (let i=0;i<n;i++){ heat[i]=0; }
    igniting.length = 0;
    activeHeads.length = 0;
    ignite(seed);

    const seen = new Set([seed]);
    const t1 = neighbors(seed, seen)[0];
    if (t1 !== undefined){
      seen.add(t1);
      launchHead(seed, t1, 0, () => ignite(t1));
      const t2 = neighbors(t1, seen)[0];
      if (t2 !== undefined){
        seen.add(t2);
        launchHead(t1, t2, hopMs[1] + 220, () => ignite(t2));
      }
    }
    return nodePos(seed);
  }

  function update(dt, t, reveal, pixelRatio){
    nUniforms.uTime.value = t;
    nUniforms.uReveal.value = reveal;
    nUniforms.uPixelRatio.value = pixelRatio;
    hUniforms.uPixelRatio.value = pixelRatio;
    eUniforms.uReveal.value = reveal;

    // ease igniting nodes up over ignite.ms
    for (let k = igniting.length-1; k>=0; k--){
      const g = igniting[k];
      g.t += dt*1000;
      const u = Math.min(g.t/igniteMs, 1);
      heat[g.i] = Math.max(heat[g.i], u);
      if (u>=1) igniting.splice(k,1);
    }
    // cool all heated nodes toward 0 (heat = recency, cools over event.coolMs)
    for (let i=0;i<n;i++){
      if (heat[i]>0 && !igniting.find(g=>g.i===i)){
        heat[i] = Math.max(0, heat[i] - dt*1000/coolMs);
      }
    }
    nGeo.attributes.aHeat.array.set(heat);
    nGeo.attributes.aHeat.needsUpdate = true;

    // advance heads
    let hi = 0;
    for (let k=activeHeads.length-1;k>=0;k--){
      const h = activeHeads[k];
      h.t += dt;
      if (h.t < 0) continue;
      const u = h.t / h.dur;
      if (!h.fired && u >= 1){ h.fired = true; h.onArrive && h.onArrive(); }
      if (u >= 1.05){ activeHeads.splice(k,1); continue; }
      const uu = Math.min(u,1);
      if (hi < MAX_HEADS){
        const p = h.pa.clone().lerp(h.pb, uu);
        hPos[hi*3]=p.x; hPos[hi*3+1]=p.y; hPos[hi*3+2]=p.z;
        hLife[hi] = Math.sin(Math.min(u,1)*Math.PI) * (1.0 - Math.max(0,u-1)*4.0);
        hi++;
      }
    }
    for (; hi<MAX_HEADS; hi++){ hLife[hi]=0; }
    hGeo.attributes.position.array.set(hPos);
    hGeo.attributes.position.needsUpdate = true;
    hGeo.attributes.aLife.array.set(hLife);
    hGeo.attributes.aLife.needsUpdate = true;
  }

  return { object: group, update, triggerEvent, seedWorld: () => nodePos(0), nodePos };
}
