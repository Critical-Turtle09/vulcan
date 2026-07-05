// Post chain — the house grade. RenderPass -> UnrealBloom (ember only, threshold
// keeps the dark world out of it) -> a single composite pass doing film grain +
// edge chromatic aberration + faint vignette -> OutputPass (sRGB/tone). Every
// value from §5 post.* tokens. This is what makes a frame read as a briefing-room
// insert rather than a WebGL demo.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { motion } from './tokens.js';

const GradePass = {
  uniforms: {
    tDiffuse:  { value: null },
    uTime:     { value: 0 },
    uGrain:    { value: motion('post.grain') },
    uChromAb:  { value: motion('post.chromAb.px') },
    uVignette: { value: motion('post.vignette') },
    uRes:      { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uChromAb, uVignette;
    uniform vec2 uRes;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      // chromatic aberration on edges only — scaled by distance from center
      vec2 dir = uv - 0.5;
      float edge = dot(dir,dir); // 0 center .. ~0.5 corner
      vec2 off = dir * (uChromAb / uRes) * edge * 4.0;
      float r = texture2D(tDiffuse, uv + off).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - off).b;
      vec3 col = vec3(r,g,b);

      // faint vignette — atmosphere, never a hard frame
      float v = smoothstep(0.9, 0.28, length(dir));
      col *= mix(1.0, v, uVignette);

      // film grain — always on, animated, luminance-aware so it lives in shadow
      float n = hash(uv * uRes + fract(uTime)*vec2(37.0,17.0)) - 0.5;
      float lum = dot(col, vec3(0.299,0.587,0.114));
      col += n * uGrain * (0.6 + (1.0-lum)*0.8);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// opts (optional): { bloom:{threshold,strength,radius}, grain } — lets a slice
// grade with its own tokens (e.g. map.post.*) instead of the constitutional
// motion.post.* defaults. Chromatic aberration + vignette stay house-wide.
export function createPost(renderer, scene, camera, size, opts = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const b = opts.bloom || motion('post.bloom');
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.w, size.h),
    b.strength, b.radius, b.threshold
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradePass);
  grade.uniforms.uRes.value.set(size.w, size.h);
  if (opts.grain !== undefined) grade.uniforms.uGrain.value = opts.grain;
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  return {
    composer,
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      grade.uniforms.uRes.value.set(w * dpr, h * dpr);
    },
    setTime(t) { grade.uniforms.uTime.value = t; },
  };
}
