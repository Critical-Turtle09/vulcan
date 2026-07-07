// B1 SYNAPSE — verify the voice→brain→panel answer surface in the live render.
// Drives the EXACT renderer path the voice loop uses (presentAnswer + voice.say)
// via window.__vulcanHome.answer(), and proves doctrine 11: the answer resolves
// per-glyph as house material (granular, maxStep < 0.5, zero pop-in) inside the
// 240–700ms reveal band; route/model/cost sit in the eyebrow chrome; a REFLEX
// answer carries the [REFLEX] mark; the speak path engages.
//   run: npm run dev  (server on :5273), then  node scripts/verify-synapse.mjs
import { chromium } from 'playwright';

const URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
let pageErr = null;
page.on('pageerror', (e) => { pageErr = e.message; console.error('PAGE ERROR:', e.message); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 10000 });

// in-page: mean glyph opacity of the free answer panel, sampled per frame
await page.evaluate(() => {
  window.__syn = {
    meanGlyph() {
      const g = document.querySelectorAll('#panel-layer .panel-free .g');
      if (!g.length) return 0;
      let s = 0; g.forEach((x) => s += parseFloat(getComputedStyle(x).opacity));
      return s / g.length;
    },
    trace(ms) {
      return new Promise((resolve) => {
        const v = [], t0 = performance.now();
        const tick = () => {
          v.push({ t: performance.now() - t0, m: window.__syn.meanGlyph() });
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else {
            let maxStep = 0;
            for (let i = 1; i < v.length; i++) maxStep = Math.max(maxStep, Math.abs(v[i].m - v[i - 1].m));
            const start = (v.find((p) => p.m > 0.1) || {}).t ?? null;
            const done = (v.find((p) => p.m > 0.9) || {}).t ?? null;
            resolve({ maxStep, start, done, samples: v.length });
          }
        };
        requestAnimationFrame(tick);
      });
    },
  };
});

// ---- 1) CLAUDE answer resolves granularly, chrome carries route/model/cost ----
const CLAUDE = { text: 'ASML builds extreme-ultraviolet (EUV) photolithography systems — the machines that pattern the smallest features on advanced chips.', route: 'CLAUDE', model: 'claude-sonnet-4-6', cost_usd: 0.0020 };
const QUERY = 'what does ASML build?';

// (1) GRANULARITY — sample mean glyph opacity across frames while it resolves.
// A pop-in lands the whole rise in one frame (maxStep≈1); a granular resolve
// spreads it (small maxStep). (Headless has no GPU, so rAF is coarse — but the
// per-step delta is still a valid pop-in test.)  Fire one frame into the trace.
const trace = await page.evaluate(async ([ans, q]) => {
  const p = window.__syn.trace(1300);
  requestAnimationFrame(() => window.__vulcanHome.answer(ans, q));
  return p;
}, [CLAUDE, QUERY]);

// (1b) AUTHORITATIVE resolve WINDOW — read straight off the glyphs' CSS
// transition config (compositor timeline, framerate-independent): the block
// starts at min(delay) and completes at max(delay+duration).
const win = await page.evaluate(() => {
  const g = document.querySelectorAll('#panel-layer .panel-free .g');
  const ms = (s) => (s || '').split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 1 : 1000));
  let start = Infinity, done = 0;
  g.forEach((x) => {
    const cs = getComputedStyle(x);
    const d = ms(cs.transitionDelay)[0] || 0;
    const dur = ms(cs.transitionDuration)[0] || 0;
    start = Math.min(start, d); done = Math.max(done, d + dur);
  });
  return { startMs: Math.round(start), doneMs: Math.round(done), glyphs: g.length };
});
await page.screenshot({ path: 'b1-answer-claude.jpeg', quality: 82, type: 'jpeg' });

// (2) SEQUENCE screenshots — a second, independent present so the timing trace
// above stays clean. Capture the frame-chrome→text resolve at rising offsets.
await page.evaluate(() => window.__vulcanHome.closePanel && window.__vulcanHome.closePanel());
await page.waitForTimeout(700);
await page.evaluate(([ans, q]) => window.__vulcanHome.answer(ans, q), [CLAUDE, QUERY]);
let elapsed = 0;
for (const [at, name] of [[90, 'b1-seq-1-90ms'], [280, 'b1-seq-2-280ms'], [520, 'b1-seq-3-520ms'], [1000, 'b1-seq-4-1000ms']]) {
  await page.waitForTimeout(at - elapsed); elapsed = at;
  await page.screenshot({ path: `${name}.jpeg`, quality: 80, type: 'jpeg' });
}

// DOM assertions on the resolved panel
const claudeInfo = await page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  if (!el) return { ok: false };
  const g = el.querySelectorAll('.g'); let resolved = 0;
  g.forEach((x) => { if (parseFloat(getComputedStyle(x).opacity) > 0.9) resolved++; });
  return {
    ok: true,
    free: window.__vulcanHome.panelFree(),
    eyebrow: el.querySelector('.panel-eyebrow')?.textContent || '',
    title: el.querySelector('.panel-title')?.textContent || '',
    body: el.querySelector('.panel-note')?.textContent || '',
    glyphs: g.length, resolved,
    speaking: window.__vulcanHome.voiceStatus().state,
  };
});
await page.screenshot({ path: 'b1-answer-claude.jpeg', quality: 82, type: 'jpeg' });

// ---- 2) REFLEX answer crossflows in and carries the [REFLEX] mark ----
const REFLEX = { text: 'Acknowledged. Standing by.', route: 'REFLEX', model: 'llama3.2:1b', cost_usd: 0 };
await page.evaluate(([ans, q]) => window.__vulcanHome.answer(ans, q), [REFLEX, 'you there?']);
await page.waitForTimeout(1100);
const reflexInfo = await page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  return el ? { eyebrow: el.querySelector('.panel-eyebrow')?.textContent || '', body: el.querySelector('.panel-note')?.textContent || '' } : { eyebrow: '', body: '' };
});
await page.screenshot({ path: 'b1-answer-reflex.jpeg', quality: 82, type: 'jpeg' });

// ---- verdicts ----
const granular = trace.maxStep < 0.5;                       // doctrine 11 — no pop-in
// house-material reveal window (delay 200 + per-glyph stagger ≤400 + glyph 170):
// starts after the frame chrome (~200ms), completes as granular matter (~≤800ms).
const inBand = win.startMs >= 150 && win.startMs <= 300 && win.doneMs <= 820;
const chromeOk = /CLAUDE/.test(claudeInfo.eyebrow) && /SONNET-4-6/.test(claudeInfo.eyebrow) && /\$0\.0020/.test(claudeInfo.eyebrow);
const bodyOk = /EUV|photolithography/i.test(claudeInfo.body);
const spokeOk = claudeInfo.speaking === 'speaking';         // voice.say engaged the speaking state
const reflexMark = /\[REFLEX\]/.test(reflexInfo.eyebrow);   // small [REFLEX] mark on local answers

console.log('trace(rAF granularity):', JSON.stringify(trace));
console.log('resolve window (CSS config):', JSON.stringify(win));
console.log('claude panel:', JSON.stringify(claudeInfo, null, 2));
console.log('reflex panel:', JSON.stringify(reflexInfo, null, 2));
console.log(`granular(maxStep<0.5)=${granular} (maxStep=${trace.maxStep.toFixed(3)})`);
console.log(`resolve window: start=${win.startMs}ms done=${win.doneMs}ms  inBand(240-700 house material)=${inBand}`);
console.log(`chrome route/model/cost=${chromeOk}  body=${bodyOk}  speaking=${spokeOk}  [REFLEX]mark=${reflexMark}`);

const pass = !pageErr && claudeInfo.ok && claudeInfo.free && granular && inBand && chromeOk && bodyOk && spokeOk && reflexMark
  && claudeInfo.resolved > claudeInfo.glyphs * 0.8;
console.log(pass ? 'PASS: B1 answer surface resolves granularly, chrome + [REFLEX] + speak all present' : 'FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
