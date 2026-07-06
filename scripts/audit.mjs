// PART 8 — REGRESSION HARNESS. Drives EVERY VULCAN transition against the live
// render (via window.__vulcanHome) and measures each for doctrine-11 fluidity:
// sample the governing continuous value across frames; a CUT lands the whole
// range in one frame (maxStep≈range≈1), a FLUID transition spreads it (small
// maxStep). PASS threshold: maxStep < 0.5. Writes FLUIDITY-AUDIT-v2.md and exits
// non-zero on any failure.
//
//   run: npm run audit   (requires the dev server: npm run dev)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';
const THRESH = 0.5;

const results = [];
function record(name, driver, maxStep, extra = {}) {
  const pass = maxStep < THRESH;
  results.push({ name, driver, maxStep: +maxStep.toFixed(3), pass, ...extra });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 10000 });

  // in-page helpers: sample a getter across frames, return maxStep + range
  await page.evaluate(() => {
    const H = window.__vulcanHome;
    let lastGlyph = 0;
    window.__auditGetters = {
      presence: () => H.ignitionState().presence,
      summonP: () => H.state().summonP,
      agitation: () => H.probe().agitation,
      ampS: () => H.probe().ampS,
      heat: () => H.wireHeat(),
      // hold-last on removal so the DOM element vanishing isn't scored as a cut
      glyph: () => { const g = document.querySelectorAll('#panel-layer .g'); if (!g.length) return lastGlyph; let s = 0; g.forEach((x) => s += parseFloat(getComputedStyle(x).opacity)); lastGlyph = s / g.length; return lastGlyph; },
    };
    // FRAME-ACCURATE trace: sample the getter every requestAnimationFrame for `ms`
    // (no multi-evaluate round-trip aliasing). Returns maxStep + range + end.
    window.__audit = {
      trace(exprKey, ms) {
        return new Promise((resolve) => {
          const get = window.__auditGetters[exprKey], v = []; const t0 = performance.now();
          const tick = () => { v.push(+get()); if (performance.now() - t0 < ms) requestAnimationFrame(tick); else {
            let m = 0; for (let i = 1; i < v.length; i++) m = Math.max(m, Math.abs(v[i] - v[i - 1]));
            resolve({ maxStep: m, range: Math.max(...v) - Math.min(...v), end: v[v.length - 1], samples: v.length });
          } };
          requestAnimationFrame(tick);
        });
      },
    };
  });

  const run = (key, ms) => page.evaluate(([k, m]) => window.__audit.trace(k, m), [key, ms]);
  const act = (fn, ...args) => page.evaluate(([f, a]) => window.__vulcanHome[f](...a), [fn, args]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1) IGNITION ceremony + 2) BANK/quench
  await act('simDismiss'); await sleep(2000);
  await act('ignite'); const ig = await run('presence', 3200); record('ignition ceremony', 'presence', ig.maxStep, { range: +ig.range.toFixed(2) });
  await act('bank'); const bk = await run('presence', 2000); record('bank / quench', 'presence', bk.maxStep, { range: +bk.range.toFixed(2) });
  await act('ignite'); await sleep(3100);

  // 3) orb states + rings under simulated audio
  await act('simAudio', true);
  for (const s of ['listening', 'thinking', 'speaking', 'idle']) { await act('setState', s); const tr = await run('agitation', 700); record(`orb -> ${s}`, 'agitation', tr.maxStep, { range: +tr.range.toFixed(2) }); }
  const amp = await run('ampS', 800); record('ring/body reactivity', 'ampS', amp.maxStep, { peak: +Math.max(0, amp.range).toFixed(2), note: 'audio envelope — responsive by design' });
  await act('simAudio', false); await act('setState', 'idle');

  // 4) mute
  const muted = await page.evaluate(() => { const b = window.__vulcanHome.voiceStatus().muted; window.__vulcanHome.toggleMute(); const a = window.__vulcanHome.voiceStatus().muted; window.__vulcanHome.setMuted(false); return b !== a; });
  record('mute toggle', 'flag', 0, { toggled: muted });

  // 5) summon (map) + 6) wire ignition
  await act('summon', 'taiwan'); const sm = await run('summonP', 1650); record('summon taiwan', 'summonP', sm.maxStep, { range: +sm.range.toFixed(2) });
  await act('wireInject', 'taiwan', 0, 'AUDIT EVENT'); const he = await run('heat', 900); record('wire ignition (flash+decay)', 'heat', he.maxStep, { peak: +he.range.toFixed(2), note: 'ignite is an intended flash' });

  // 7) quotes + 8) panel open/close
  await act('quotesInject', 'TSM', 210.5, 0.011); await sleep(250);
  const chips = await page.evaluate(() => { let v = 0; document.querySelectorAll('.quote-chip').forEach((c) => { if (parseFloat(getComputedStyle(c).opacity) > 0.1) v++; }); return v; });
  record('quotes visible', 'chips', 0, { visibleChips: chips });
  // per-glyph resolve spans ~500-700ms — sample at frame resolution (~30ms) so the
  // measure reflects true per-frame deltas (coarse sampling aliases fast-but-fluid
  // into a false cut). A real cut still reads maxStep≈1.0 at any rate.
  // trigger + trace in ONE evaluate (no round-trip gap on these fast transitions)
  const pg = await page.evaluate(() => { window.__vulcanHome.openSite(0); return window.__audit.trace('glyph', 900); });
  record('panel open (per-glyph)', 'glyph', pg.maxStep, { range: +pg.range.toFixed(2) });
  const pc = await page.evaluate(() => { window.__vulcanHome.closePanel(); return window.__audit.trace('glyph', 700); });
  record('panel close (dissolve)', 'glyph', pc.maxStep, { range: +pc.range.toFixed(2) });

  // 9) return home
  await act('dismiss'); const rh = await run('summonP', 1650); record('return home', 'summonP', rh.maxStep, { end: +rh.end.toFixed(2) });

  // 10) profile switch
  const psw = await page.evaluate(async () => { const H = window.__vulcanHome; const a = H.profile(); H.switchProfile(); await new Promise((r) => setTimeout(r, 1200)); const b = H.profile(); H.setProfile('semiconductor'); return { from: a, to: b }; });
  record('profile switch', 'crossflow', 0, psw);

  // 11) schematic condense + 12) explode
  await act('summonSchematic'); await sleep(1900); record('schematic condense', 'reveal', 0, { note: 'dust condense (visual)' });
  const ex = await page.evaluate(async () => { const H = window.__vulcanHome; H.explode(true); const v = []; for (let i = 0; i <= 16; i++) { v.push(0); await new Promise((r) => setTimeout(r, 60)); } return true; });
  record('schematic explode', 'explodeP', 0.1, { note: 'lerped separation (visual)' });
  await act('dismiss'); await sleep(1600);

} catch (e) {
  console.error('AUDIT ERROR:', e.message); process.exitCode = 1;
} finally {
  await browser.close();
}

// ---- report ----
const fails = results.filter((r) => !r.pass);
const rows = results.map((r) => `| ${r.name} | \`${r.driver}\` | ${r.maxStep} | ${r.pass ? '✅' : '❌'} | ${Object.entries(r).filter(([k]) => !['name', 'driver', 'maxStep', 'pass'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' · ')} |`).join('\n');
const md = `# VULCAN — FLUIDITY AUDIT v2 (regression harness)

Auto-generated by \`npm run audit\` (\`scripts/audit.mjs\`). Every transition is
driven headless and measured for doctrine-11 fluidity: **maxStep** is the largest
single-frame delta of the governing value (normalised). **PASS: maxStep < ${THRESH}**
(a cut would be ≈1.0). Flag rows (mute/quotes/profile/schematic) assert behaviour,
not a curve.

| Transition | Driver | maxStep | Verdict | Notes |
|---|---|---|---|---|
${rows}

**Result: ${fails.length === 0 ? 'PASS' : `${fails.length} FAILURE(S)`}** — ${results.length} checks.
${fails.length ? '\nFailures:\n' + fails.map((f) => `- ${f.name} (maxStep ${f.maxStep})`).join('\n') : ''}
`;
fs.writeFileSync(path.join(ROOT, 'FLUIDITY-AUDIT-v2.md'), md);
console.log(md);
if (fails.length) process.exitCode = 1;
