// v1.4 — verify the programmatic answer panel renders arbitrary content from a
// static fixture (the conductor's mouth-to-screen path). Asserts DOM + screenshots.
import { chromium } from 'playwright';
const URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 10000 });

// present the static fixture programmatically
await page.evaluate(() => window.__vulcanHome.presentTest());
await page.waitForTimeout(1200);   // let the frame draw + glyphs resolve

const info = await page.evaluate(() => {
  const el = document.querySelector('#panel-layer .panel.panel-free');
  if (!el) return { ok: false };
  const glyphs = el.querySelectorAll('.g');
  let resolved = 0; glyphs.forEach((g) => { if (parseFloat(getComputedStyle(g).opacity) > 0.9) resolved++; });
  return {
    ok: true,
    free: window.__vulcanHome.panelFree(),
    title: el.querySelector('.panel-title')?.textContent,
    eyebrow: el.querySelector('.panel-eyebrow')?.textContent,
    rows: el.querySelectorAll('.panel-row').length,
    listItems: el.querySelectorAll('.panel-li').length,
    hasBody: !!el.querySelector('.panel-note'),
    glyphTotal: glyphs.length, glyphResolved: resolved,
  };
});
console.log('present panel:', JSON.stringify(info, null, 2));
await page.screenshot({ path: 'v14-present-panel.jpeg', quality: 82, type: 'jpeg' });

// verify it survives at home (not auto-closed) and toggles closed
await page.waitForTimeout(400);
const stillOpen = await page.evaluate(() => window.__vulcanHome.panelOpen());
await page.evaluate(() => window.__vulcanHome.presentTest());   // toggle same id -> close
await page.waitForTimeout(900);
const closed = await page.evaluate(() => !window.__vulcanHome.panelOpen());

const pass = info.ok && info.free && info.rows >= 4 && info.listItems >= 3 && info.hasBody
  && info.glyphResolved > info.glyphTotal * 0.8 && stillOpen && closed;
console.log(`stillOpenAtHome=${stillOpen} toggledClosed=${closed}`);
console.log(pass ? 'PASS: programmatic answer panel renders arbitrary content + resolves + toggles' : 'FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
