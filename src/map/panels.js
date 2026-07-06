// STAGE A — SLICE 3 · THE PANELS (spec §6-D, Palantir + Maverick blueprint).
// Selecting a site on the summoned terrain resolves a tethered engineering-drawing
// panel: hairline chrome, corner registration marks, quiet mono-caps, near-black.
// Content is the site's dossier from the ACTIVE PROFILE (engine is domain-blind).
//
// Doctrine 11: the panel RESOLVES into being — the frame draws on like a blueprint,
// then the text resolves per-glyph (granular). Nothing pops. Esc / click-away
// dissolves. One panel at a time; a new selection crossflows over the old.
import rawTokens from '../../tokens.json';

const P = rawTokens.panel;

// wrap each character in a resolvable glyph span (spaces preserved, not animated)
function glyphize(str) {
  let html = '';
  for (const ch of String(str)) {
    if (ch === ' ') html += ' ';
    else html += `<span class="g">${ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch}</span>`;
  }
  return html;
}

// deterministic per-glyph stagger (noise-ish, not linear) so text resolves as
// granular matter. The whole block is spread evenly across a span that is CAPPED
// (spanCap) — critically, long blocks COMPRESS the per-glyph step to fit the cap
// instead of piling every glyph at the cap (which would read as a pop-in). The
// measured fluidity audit caught the pile-up; this is the fix.
function stagger(glyphs, baseDelayMs, spanCap) {
  const n = glyphs.length || 1;
  const span = Math.min(n * P['glyph.stagger.ms'], spanCap);
  const per = span / n;                    // shrinks for long blocks -> no pile-up
  let seed = 1337;
  glyphs.forEach((g, i) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const jitter = (seed / 0x7fffffff) * per * 0.6;   // < per, keeps it granular but monotonic-ish
    g.style.transitionDelay = `${(baseDelayMs + i * per + jitter).toFixed(0)}ms`;
  });
}

export function createPanels() {
  // full-screen leader overlay (tether line + site registration diamond)
  const leader = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leader.id = 'panel-leader';
  const leaderLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const leaderDot = document.createElementNS('http://www.w3.org/2000/svg', 'path'); // diamond
  const stroke = getComputedStyle(document.documentElement).getPropertyValue('--panel-stroke').trim() || '#3A3E44';
  for (const el of [leaderLine, leaderDot]) { el.setAttribute('stroke', stroke); el.setAttribute('fill', 'none'); el.setAttribute('stroke-width', '1'); }
  leader.append(leaderLine, leaderDot);
  document.body.appendChild(leader);

  let panelEl = null, frameSvg = null, current = null, openId = null;
  let closing = false, pending = null, pendingFree = null;

  // v1.4 COMMAND CENTER PIVOT — the panel is promoted to VULCAN's PRIMARY answer
  // surface: the conductor retrieves content (Obsidian notes, GitHub/Vercel statuses,
  // lists, dossiers) and PRESENTS it here, untethered to any 3D scene. Same blueprint
  // chrome + per-glyph granular resolve (doctrine 11) as the site panels. Content
  // schema: { id?, eyebrow?, title, rows?: [[k,v,cls?]], list?: [str], body? }.
  function buildContentPanel(c) {
    const el = document.createElement('div');
    el.className = 'panel panel-free';
    const parts = [];
    if (c.eyebrow) parts.push(`<div class="panel-eyebrow">${glyphize(c.eyebrow)}</div>`);
    parts.push(`<div class="panel-title">${glyphize(c.title || '')}</div>`);
    for (const r of (c.rows || [])) {
      const [k, v, cls = ''] = r; if (v == null || v === '') continue;
      parts.push(`<div class="panel-row"><span class="pk">${glyphize(k)}</span><span class="pv ${cls}">${glyphize(v)}</span></div>`);
    }
    for (const item of (c.list || [])) {
      if (item == null || item === '') continue;
      parts.push(`<div class="panel-li"><span class="pb">◦</span><span class="pv">${glyphize(item)}</span></div>`);
    }
    if (c.body) parts.push(`<div class="panel-note">${glyphize(c.body)}</div>`);
    el.innerHTML = `<svg class="panel-frame"></svg><div class="panel-inner">${parts.join('')}</div>`;
    document.getElementById('panel-layer').appendChild(el);
    frameSvg = el.querySelector('.panel-frame');
    return el;
  }

  // untethered panels sit beside the hero (left of center), vertically centered —
  // never docked to an edge as a bar (§6-D). Recomputed on open + resize.
  function positionFree(el) {
    const w = window.innerWidth, h = window.innerHeight;
    const px = Math.round(w * 0.09);
    const py = Math.round(Math.max(rawTokens.hud['margin.y'], (h - el.offsetHeight) / 2));
    el.style.left = `${px}px`; el.style.top = `${py}px`;
  }

  function reallyPresent(c) {
    current = { id: c.id || '__present', free: true };
    openId = current.id; closing = false;
    panelEl = buildContentPanel(c);
    drawFrame(panelEl);
    positionFree(panelEl);
    const glyphs = Array.from(panelEl.querySelectorAll('.g'));
    stagger(glyphs, P['text.delayMs'], rawTokens.motion['reveal.text.blockCap.ms']);
    requestAnimationFrame(() => requestAnimationFrame(() => panelEl.classList.add('resolve')));
    leader.style.opacity = '0';   // free panels carry no site tether
  }

  // present arbitrary retrieved content programmatically (the conductor's path)
  function present(c) {
    if (!c) return;
    const id = c.id || '__present';
    if (openId === id) { close(); return; }               // toggle same content
    if (panelEl) { close(); pendingFree = c; pending = null; return; }   // crossflow over the old
    reallyPresent(c);
  }

  function buildPanel(site) {
    const d = site.dossier || {};
    const el = document.createElement('div');
    el.className = 'panel';
    const rows = [
      ['ROLE', d.role, 'bone'],
      ['NODE', d.node, ''],
      ['OPERATOR', d.org, ''],
      ['PRODUCTS', d.products, ''],
      ['THROUGHPUT', d.throughput, ''],
      ['STATUS', d.status, d.status && /ALERT|DOWN|HALT/.test(d.status) ? 'heat' : 'bone'],
    ].filter((r) => r[1]);
    el.innerHTML =
      `<svg class="panel-frame"></svg>` +
      `<div class="panel-inner">` +
        `<div class="panel-title">${glyphize(site.name)}</div>` +
        rows.map(([k, v, cls]) =>
          `<div class="panel-row"><span class="pk">${glyphize(k)}</span><span class="pv ${cls}">${glyphize(v)}</span></div>`).join('') +
        (d.note ? `<div class="panel-note">${glyphize(d.note)}</div>` : '') +
      `</div>`;
    document.getElementById('panel-layer').appendChild(el);
    frameSvg = el.querySelector('.panel-frame');
    return el;
  }

  // draw the hairline frame + corner registration marks into the sized SVG, then
  // animate the perimeter stroke on (blueprint draw-in). §6-D chrome.
  function drawFrame(el) {
    const w = el.offsetWidth, h = el.offsetHeight, r = P['reg.size'], st = getComputedStyle(document.documentElement).getPropertyValue('--panel-stroke').trim();
    frameSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0.5'); rect.setAttribute('y', '0.5');
    rect.setAttribute('width', w - 1); rect.setAttribute('height', h - 1);
    rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', st); rect.setAttribute('stroke-width', P['stroke.px']);
    const per = 2 * (w + h);
    rect.style.strokeDasharray = per; rect.style.strokeDashoffset = per;
    rect.style.transition = `stroke-dashoffset ${P['reveal.ms']}ms cubic-bezier(0.2,0.7,0.2,1)`;
    frameSvg.appendChild(rect);
    // corner registration ticks (blueprint marks)
    const corners = [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${cx} ${cy + sy * r} L ${cx} ${cy} L ${cx + sx * r} ${cy}`);
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', st); path.setAttribute('stroke-width', 1);
      path.style.opacity = '0'; path.style.transition = `opacity ${P['reveal.ms'] * 0.6}ms ease ${P['reveal.ms'] * 0.3}ms`;
      frameSvg.appendChild(path);
      requestAnimationFrame(() => { path.style.opacity = '0.8'; });
    }
    requestAnimationFrame(() => { rect.style.strokeDashoffset = '0'; });
  }

  function reallyOpen(site) {
    current = site; openId = site.id; closing = false;
    panelEl = buildPanel(site);
    drawFrame(panelEl);
    // text resolves LAST — stagger every glyph across the block cap after the
    // frame begins drawing (spread evenly, never piled -> no pop-in)
    const glyphs = Array.from(panelEl.querySelectorAll('.g'));
    stagger(glyphs, P['text.delayMs'], rawTokens.motion['reveal.text.blockCap.ms']);
    requestAnimationFrame(() => requestAnimationFrame(() => panelEl.classList.add('resolve')));
    leader.style.opacity = '1';
  }

  function open(site) {
    if (!site) return;
    if (openId === site.id) { close(); return; }         // toggle same site
    if (panelEl) { close(); pending = site; return; }    // crossflow over the old
    reallyOpen(site);
  }

  function close() {
    if (!panelEl || closing) return;
    closing = true; openId = null; current = null;
    const el = panelEl; panelEl = null;
    // re-stagger the glyphs to a SHORT dissolve span so they melt out granularly
    // (not all at once) — and keep the element alive until that dissolve finishes.
    const glyphs = Array.from(el.querySelectorAll('.g'));
    const span = P['dissolve.ms'] * 0.55;
    stagger(glyphs, 0, span);
    el.classList.remove('resolve');                       // glyphs dissolve back, staggered
    const rect = el.querySelector('rect');
    if (rect) { const per = 2 * (el.offsetWidth + el.offsetHeight); rect.style.strokeDashoffset = per; }
    leader.style.opacity = '0';
    const life = Math.max(P['dissolve.ms'], span + P.glyphMs + 40);   // never cut a glyph mid-fade
    setTimeout(() => {
      el.remove(); closing = false;
      if (pending) { const s = pending; pending = null; reallyOpen(s); }
      else if (pendingFree) { const c = pendingFree; pendingFree = null; reallyPresent(c); }
    }, life);
  }

  // reproject the tethered site each frame; keep the panel beside it and the
  // leader line drawn from the site diamond to the panel's near edge.
  function update(camera, w, h) {
    if (!current || !panelEl) return;
    if (current.free) { positionFree(panelEl); leader.style.opacity = '0'; return; }   // untethered answer panel
    const proj = current.world.clone().project(camera);
    if (proj.z > 1) { leader.style.opacity = '0'; return; }
    const sx = (proj.x * 0.5 + 0.5) * w, sy = (-proj.y * 0.5 + 0.5) * h;
    const pw = panelEl.offsetWidth, ph = panelEl.offsetHeight, off = P['offset.x'];
    const right = sx < w * 0.5;                            // site left of center -> panel to its right
    let px = right ? sx + off : sx - off - pw;
    let py = Math.max(rawTokens.hud['margin.y'], Math.min(sy - 24, h - ph - 24));
    px = Math.max(16, Math.min(px, w - pw - 16));
    panelEl.style.left = `${px}px`; panelEl.style.top = `${py}px`;
    // leader: site -> panel near-corner
    const nearX = right ? px : px + pw, nearY = py + 18;
    leaderLine.setAttribute('x1', sx); leaderLine.setAttribute('y1', sy);
    leaderLine.setAttribute('x2', nearX); leaderLine.setAttribute('y2', nearY);
    const r = 4;
    leaderDot.setAttribute('d', `M ${sx} ${sy - r} L ${sx + r} ${sy} L ${sx} ${sy + r} L ${sx - r} ${sy} Z`);
  }

  return {
    open, present, close, update,
    get openId() { return openId; },
    get isOpen() { return !!panelEl; },
    get isFree() { return !!(current && current.free); },   // v1.4 — untethered answer panel
  };
}
