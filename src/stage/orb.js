// SPEC v1.6 THE STAGE — G3 THE ORB (a5 TWIN HELIX). VULCAN's presence at the center of
// the stage (Z4), rendered GPU-side in Three.js. §2 is exact and is honoured to the letter:
//
//   FORM      · a particle-matter sphere (~1050 points) with DIFFERENTIAL rotation — every
//               particle carries its own angular velocity, the equator sweeping faster than
//               the poles (a solar-rotation read). Threaded through it: two counter-tilted
//               twin-line ribbon PAIRS (tiltX≈1.25, tiltZ≈±0.85) that STREAM IN OPPOSITE
//               directions, plus one thin polar ring.
//   MOTION    · SPEECH IS CIRCULATION, NOT VIBRATION. There is NO positional jitter and NO
//               random noise anywhere in the loop — the only "randomness" is a fixed per-
//               particle seed set ONCE at build. Ribbons flow along their own arc-length,
//               their planes precess, and the body breathes. Every state parameter eases
//               (exp smoothing, tau ≈ state.tau) so a state change never snaps (Doctrine 11).
//   STATES    · IDLE     — all motions slow; ONE ember segment (~15% arc) drifts the ribbons.
//               WORKING  — orbits ×2, ribbon flow ×5, ember spread ~55% (constant, no voice).
//               SPEAKING — orbits ×3.2, flow full, both pairs ember with brightness riding the
//                          real TTS envelope (pairs offset ~0.9 phase); body swells ~6%.
//
// Colours come ONLY from the stage palette (greyscale body/ribbons + the single ember accent);
// every geometry/motion number is a token (`stage.orb.*`). Nothing is hardcoded here.
//
// SURFACE — identical to the G1/G2 orb stub so the voice loop drives it unchanged:
//   .stateName (raw voice state, for the Z6 CORE read) · setState(n) · setAmplitude(v)
//   getAmplitude() · pulseHeat() · render(dt) · resize()
// The voice state names (idle/listening/thinking/speaking) map onto the three a5 visual
// states: idle+listening → IDLE, thinking → WORKING, speaking → SPEAKING.
import * as THREE from 'three';
import raw from '../../tokens.json';

const O = raw.stage.orb;
const P = raw.stage;

// voice-state  ->  a5 visual state (§2 defines exactly three)
const VISUAL = { idle: 'idle', listening: 'idle', thinking: 'working', speaking: 'speaking' };

const toLin = (hex) => { const c = new THREE.Color(hex).convertSRGBToLinear(); return new THREE.Vector3(c.r, c.g, c.b); };

// ── particle sphere ─────────────────────────────────────────────────────────────────────
// Differential rotation done in the vertex shader: a single accumulated orbit phase is scaled
// per-particle by its latitude band (equator = 1, poles = poleFactor) — so the equator sweeps
// faster with zero per-frame CPU and, by construction, zero jitter.
const PARTICLE_VERT = /* glsl */`
  attribute float aTheta;    // polar angle [0,PI]
  attribute float aPhi0;     // base azimuth
  attribute float aLat;      // sin(theta): 1 at equator, 0 at pole -> differential speed
  attribute float aSeed;     // fixed per-particle seed (brightness variance + condense stagger)
  uniform float uOrbit;      // accumulated orbit phase (CPU-integrated, multiplier-safe)
  uniform float uPole;       // pole angular-velocity factor (< 1)
  uniform float uCondense;   // 0 scattered -> 1 on-sphere (boot)
  uniform float uRadius;
  uniform float uPointSize;
  uniform float uPR;         // device pixel ratio
  uniform float uRef;        // reference distance (camera dist) so screen size is ~constant
  varying float vBright;
  varying float vFade;
  void main() {
    float phi = aPhi0 + uOrbit * (uPole + (1.0 - uPole) * aLat);
    float st = sin(aTheta), ct = cos(aTheta);
    vec3 dir = vec3(st * cos(phi), ct, st * sin(phi));
    // boot: each particle condenses inward from a scattered shell, staggered by its own seed
    float cond = clamp((uCondense - aSeed * 0.28) / 0.72, 0.0, 1.0);
    cond = cond * cond * (3.0 - 2.0 * cond);
    vec3 pos = dir * uRadius * mix(1.65, 1.0, cond);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // ~constant screen-space splat with a mild near/far depth attenuation
    gl_PointSize = max(1.0, uPointSize * uPR * (uRef / max(-mv.z, 0.001)));
    // depth cue: front-facing points read brighter than those on the far side (a lit body)
    float depth = clamp((dir.z * 0.5 + 0.5), 0.0, 1.0);
    vBright = mix(0.42, 1.0, depth) * mix(0.82, 1.0, aSeed);
    vFade = cond;
  }
`;
const PARTICLE_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  varying float vBright;
  varying float vFade;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d) * 4.0;                 // 0 center -> 1 edge
    float mask = smoothstep(1.0, 0.15, r);     // soft round splat
    if (mask <= 0.002) discard;
    gl_FragColor = vec4(uColor * vBright, mask * vFade);
  }
`;

// ── ribbons + polar ring ────────────────────────────────────────────────────────────────
// A ribbon is a tilted circle drawn as a Line; a PAIR is two such lines offset along the plane
// normal (the twin). Flow is an ember WINDOW travelling along the arc (uEmberPhase), never the
// geometry moving. Bone hairline base; the ember window mixes toward the accent.
const RIBBON_VERT = /* glsl */`
  attribute float aArc;      // [0,1) around the loop
  varying float vArc;
  void main() { vArc = aArc; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RIBBON_FRAG = /* glsl */`
  precision highp float;
  uniform vec3  uBone;
  uniform vec3  uEmber;
  uniform float uEmberPhase;   // window centre (flows)
  uniform float uEmberSpread;  // window width fraction of the loop
  uniform float uEmberBright;
  uniform float uBoneBright;
  uniform float uOpacity;      // boot fade
  varying float vArc;
  void main() {
    float hw = max(uEmberSpread, 0.0001) * 0.5;                // window half-width
    float dist = abs(fract(vArc - uEmberPhase + 0.5) - 0.5);   // arc distance to window centre
    float win = 1.0 - smoothstep(hw * 0.55, hw, dist);          // 1 inside the ember window
    float ember = win * uEmberBright;
    vec3 col = mix(uBone * uBoneBright, uEmber, ember);
    float a = uOpacity * (0.62 + 0.38 * ember);                 // ember region reads hotter
    gl_FragColor = vec4(col, a);
  }
`;

export function createOrb(slot, onState) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);                 // transparent — the stage bg shows through
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  canvas.style.display = 'block'; canvas.style.pointerEvents = 'none';
  slot.appendChild(canvas);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(O['camera.fov'], 1, 0.1, 100);
  // a slight elevation so the rings read as ellipses (structure), never edge-on flat lines
  cam.position.set(0, O['camera.elev'] || 0, O['camera.dist']);
  cam.lookAt(0, 0, 0);

  const group = new THREE.Group();      // breathing/swell scales the whole body
  scene.add(group);

  const BONE = toLin(P.text);
  const EMBER = toLin(P.ember);

  // ---- particles: fibonacci sphere (deterministic — the ONLY per-particle "randomness",
  // fixed at build; there is no runtime RNG anywhere) ----
  const N = O.particleCount;
  const aTheta = new Float32Array(N), aPhi0 = new Float32Array(N);
  const aLat = new Float32Array(N), aSeed = new Float32Array(N);
  const GOLD = Math.PI * (3.0 - Math.sqrt(5.0));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;                 // 1 .. -1
    const theta = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
    aTheta[i] = theta;
    aPhi0[i] = (i * GOLD) % (Math.PI * 2);
    aLat[i] = Math.sin(theta);                        // equator 1, poles 0
    // deterministic hash seed (fixed, not Math.random) for brightness + condense stagger
    const h = Math.sin((i + 1) * 12.9898) * 43758.5453;
    aSeed[i] = h - Math.floor(h);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); // unused (shader builds pos)
  pg.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
  pg.setAttribute('aPhi0', new THREE.BufferAttribute(aPhi0, 1));
  pg.setAttribute('aLat', new THREE.BufferAttribute(aLat, 1));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  const pUniforms = {
    uOrbit: { value: 0 }, uPole: { value: 1 - O.differential }, uCondense: { value: reduce ? 1 : 0 },
    uRadius: { value: O.radius }, uPointSize: { value: O.pointSize },
    uPR: { value: renderer.getPixelRatio() }, uRef: { value: O['camera.dist'] },
    uColor: { value: BONE },
  };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUniforms, vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(pg, pMat);
  points.frustumCulled = false;   // positions are shader-built (attr is zeroed) — never auto-cull
  group.add(points);

  // ---- ribbons: two counter-tilted twin-line pairs + one polar ring ----
  const ribbons = [];   // { mesh, uniforms, flowDir, phaseOffset }
  function makeRing(radius, segments) {
    const pos = new Float32Array((segments + 1) * 3);
    const arc = new Float32Array(segments + 1);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * radius; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(a) * radius;
      arc[i] = i / segments;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aArc', new THREE.BufferAttribute(arc, 1));
    return g;
  }
  function addRibbon({ radius, segments, tiltX, tiltZ, normalOffset, flowDir, phaseOffset, opacity, boneBright, precess }) {
    const g = makeRing(radius, segments);
    const u = {
      uBone: { value: BONE }, uEmber: { value: EMBER },
      uEmberPhase: { value: phaseOffset || 0 }, uEmberSpread: { value: O.states.idle.emberSpread },
      uEmberBright: { value: 0 }, uBoneBright: { value: boneBright }, uOpacity: { value: reduce ? opacity : 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
      transparent: true, depthWrite: false, depthTest: false,
    });
    const line = new THREE.Line(g, mat);
    // orient the loop plane (tiltX/tiltZ) and offset the twin along the plane normal
    line.rotation.set(tiltX, 0, tiltZ);
    if (normalOffset) {
      const n = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(tiltX, 0, tiltZ));
      line.position.copy(n.multiplyScalar(normalOffset));
    }
    line.userData = { tiltX, tiltZ, precess: precess || 0, base: line.rotation.y };
    group.add(line);
    ribbons.push({ line, u, flowDir, targetOpacity: opacity });
    return line;
  }

  const RB = O.ribbon;
  // PAIR A — flows +, PAIR B — flows − (streaming in OPPOSITE directions), counter-tilted in Z
  for (const [tiltZ, flowDir, phaseOffset] of [[RB.tiltZ, 1, 0], [-RB.tiltZ, -1, RB.pairBphase]]) {
    for (const s of [1, -1]) {   // the twin: two lines offset ± along the plane normal
      addRibbon({
        radius: RB.radius, segments: RB.segments, tiltX: RB.tiltX, tiltZ,
        normalOffset: s * RB.twinGap * 0.5, flowDir, phaseOffset,
        opacity: RB.opacity, boneBright: RB.boneBright, precess: RB.precess * flowDir,
      });
    }
  }
  // POLAR RING — one thin structural ring whose axis is the pole (horizontal), greyscale only
  const PR = O.polar;
  addRibbon({
    radius: PR.radius, segments: PR.segments, tiltX: 0, tiltZ: 0,
    normalOffset: 0, flowDir: 1, phaseOffset: 0,
    opacity: PR.opacity, boneBright: PR.boneBright, precess: PR.precess,
  });
  const polar = ribbons[ribbons.length - 1];
  polar.isPolar = true;   // never spends ember

  // ── state model ──────────────────────────────────────────────────────────────────────
  const S = O.states;
  const cur = { orbitMul: S.idle.orbitMul, flowMul: S.idle.flowMul, emberSpread: S.idle.emberSpread,
                emberBright: S.idle.emberBright, swell: S.idle.swell, breatheAmp: S.idle.breatheAmp };
  let voiceState = 'idle', visual = 'idle';
  let ampSmooth = 0, ampTarget = 0;
  let orbitPhase = 0, precessPhase = 0, breathePhase = 0, boot = reduce ? 1 : 0;
  const ribbonPhase = ribbons.map((r) => r.u.uEmberPhase.value);

  function resize() {
    const w = slot.clientWidth || 1, h = slot.clientHeight || 1;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    pUniforms.uPR.value = renderer.getPixelRatio();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(slot);
  window.addEventListener('resize', resize);

  const lerp = (a, b, k) => a + (b - a) * k;

  function render(dt) {
    dt = Math.min(dt || 0, 0.05);
    // boot condense (Doctrine 11 — resolves in, never a pop). Skipped under reduced-motion.
    if (boot < 1) { boot = Math.min(1, boot + dt * 1000 / O['boot.ms']); pUniforms.uCondense.value = boot; }

    // ease every state parameter toward its target (no snap)
    const tgt = S[visual];
    const k = reduce ? 1 : (1 - Math.exp(-dt / O['state.tau']));
    cur.orbitMul = lerp(cur.orbitMul, tgt.orbitMul, k);
    cur.flowMul = lerp(cur.flowMul, tgt.flowMul, k);
    cur.emberSpread = lerp(cur.emberSpread, tgt.emberSpread, k);
    cur.emberBright = lerp(cur.emberBright, tgt.emberBright, k);
    cur.swell = lerp(cur.swell, tgt.swell, k);
    cur.breatheAmp = lerp(cur.breatheAmp, tgt.breatheAmp, k);

    // smoothed amplitude (attack/decay) — circulation, not vibration: it modulates brightness
    // and swell smoothly, it is NEVER added to any position.
    ampSmooth = lerp(ampSmooth, ampTarget, reduce ? 1 : (1 - Math.exp(-dt / O['amp.tau'])));
    const speaking = visual === 'speaking';
    const emberEnvelope = speaking ? (0.5 + 0.5 * ampSmooth) : 1.0;

    if (!reduce) {
      orbitPhase += dt * O['orbit.base'] * cur.orbitMul;
      precessPhase += dt * RB.precess;
      breathePhase += dt * O['breathe.hz'] * Math.PI * 2;
    }
    pUniforms.uOrbit.value = orbitPhase;

    // ribbons: flow the ember window, precess the planes, fade in on boot
    const flowSpeed = dt * RB['flow.base'] * cur.flowMul;
    ribbons.forEach((r, i) => {
      ribbonPhase[i] += (reduce ? 0 : flowSpeed * r.flowDir);
      r.u.uEmberPhase.value = ribbonPhase[i];
      r.u.uEmberSpread.value = cur.emberSpread;
      // polar ring is structure only — it never carries ember
      r.u.uEmberBright.value = r.isPolar ? 0 : cur.emberBright * emberEnvelope;
      r.u.uOpacity.value = reduce ? r.targetOpacity : lerp(r.u.uOpacity.value, r.targetOpacity, k);
      const ud = r.line.userData;
      r.line.rotation.y = ud.base + precessPhase * (ud.precess >= 0 ? 1 : -1) * (r.isPolar ? 0.6 : 1);
    });

    // body breathes + swells (speaking only) — a scale on the whole group, no positional noise
    const breathe = reduce ? 0 : Math.sin(breathePhase) * cur.breatheAmp;
    const s = 1 + breathe + cur.swell * ampSmooth;
    group.scale.setScalar(s);

    renderer.render(scene, cam);
  }

  return {
    get stateName() { return voiceState; },
    setState(n) {
      if (!n || n === voiceState) return;
      voiceState = n;
      visual = VISUAL[n] || 'idle';
      onState && onState(n);
    },
    setAmplitude(v) { ampTarget = THREE.MathUtils.clamp(v || 0, 0, 1); },
    getAmplitude() { return ampSmooth; },
    pulseHeat() {},               // surface parity (heat pulses are a G4 dispatch concern)
    render,
    resize,
    // dev-only override so all three a5 states are demonstrable without the live loop.
    // Maps a visual state directly; the real wiring (idle←session, working←thinking/dispatch,
    // speaking←TTS) still drives setState normally.  // TODO(G4: dispatch drives WORKING)
    _devVisual(v) { if (S[v]) { visual = v; onState && onState(v === 'working' ? 'thinking' : v); } },
    get _debug() { return { voiceState, visual, boot, ampSmooth: +ampSmooth.toFixed(3), orbitMul: +cur.orbitMul.toFixed(2), flowMul: +cur.flowMul.toFixed(2), emberSpread: +cur.emberSpread.toFixed(2) }; },
  };
}
