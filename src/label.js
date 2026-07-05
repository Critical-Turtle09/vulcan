// The one asset label — mono-caps, tethered beside the event (REF-02 instrument
// grammar). DOM per §0 (text is the only thing allowed out of shader space).
// It never pops: each glyph RESOLVES in granularly, staggered by noise, and later
// DISSOLVES the same way (doctrine 11 / §5 reveal.text.perGlyph.ms). Screen
// position is projected from the 3D seed each frame so the label stays tethered.
import * as THREE from 'three';
import { TOKENS, motion } from './tokens.js';

export function createLabel(container) {
  const el = document.createElement('div');
  el.className = 'vulcan-label';
  container.appendChild(el);

  const tick = document.createElement('div'); // registration tick + leader
  tick.className = 'vulcan-label-tick';
  container.appendChild(tick);

  let glyphs = [];
  let state = 'idle';      // idle | resolving | hold | dissolving
  let text = '';
  const perGlyph = motion('reveal.text.perGlyph.ms');
  const blockCap = motion('reveal.text.blockCap.ms');

  // deterministic per-glyph stagger (noise, not linear)
  function staggerFor(i, count) {
    const base = (i / Math.max(count - 1, 1)) * blockCap;
    const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    return base * 0.65 + Math.abs(jitter) * blockCap * 0.35;
  }

  function setText(str) {
    text = str;
    el.innerHTML = '';
    glyphs = [];
    [...str].forEach((ch, i) => {
      const g = document.createElement('span');
      g.className = 'vulcan-glyph';
      g.textContent = ch === ' ' ? ' ' : ch;
      g.style.setProperty('--delay', `${staggerFor(i, str.length)}ms`);
      g.style.setProperty('--dur', `${perGlyph[0] + (perGlyph[1]-perGlyph[0]) * ((i*7)%5)/4}ms`);
      el.appendChild(g);
      glyphs.push(g);
    });
  }

  function resolve(str) {
    setText(str);
    state = 'resolving';
    // force reflow then flip to resolved so per-glyph transitions run
    void el.offsetWidth;
    el.classList.remove('dissolving');
    el.classList.add('resolving');
  }

  function dissolve() {
    if (state === 'idle') return;
    state = 'dissolving';
    el.classList.remove('resolving');
    el.classList.add('dissolving');
  }

  // project seed world-pos to screen; keep label tethered with a small offset
  const _v = new THREE.Vector3();
  function update(seedWorld, camera, w, h, reveal) {
    _v.copy(seedWorld).project(camera);
    const x = (_v.x * 0.5 + 0.5) * w;
    const y = (-_v.y * 0.5 + 0.5) * h;
    const ox = 26, oy = -30;
    el.style.transform = `translate(${x + ox}px, ${y + oy}px)`;
    tick.style.transform = `translate(${x}px, ${y}px)`;
    const vis = reveal > 0.6 && state !== 'idle';
    tick.style.opacity = vis ? '1' : '0';
  }

  return { resolve, dissolve, update, get state(){ return state; }, get text(){ return text; } };
}
