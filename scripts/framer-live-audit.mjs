// FRAMER — LIVE-SITE quality audit (READ-ONLY: fetch/render only, no edits anywhere).
// Loads each live Bonsai page at 1280 and 375 and reports: horizontal overflow (mobile),
// console errors, meta/OG/canonical/viewport completeness, in-page anchor targets that don't
// exist, cross-page/nav link HTTP status, and a coarse contrast sample of primary text.
import { chromium } from 'playwright';

const BASE = 'https://bonsaicitations.com';
const PAGES = ['/', '/tool.html', '/guides.html', '/it.html', '/privacy.html', '/schools.html', '/terms.html'];
const UA = 'VULCAN-FRAMER/1.0 (read-only live-site audit)';

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const la = L(a), lb = L(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return +((hi + 0.05) / (lo + 0.05)).toFixed(2); };

const statusCache = new Map();
async function status(url) {
  if (statusCache.has(url)) return statusCache.get(url);
  let code = 0;
  try { const r = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA } }); code = r.status; } catch { code = -1; }
  statusCache.set(url, code); return code;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const p of PAGES) {
    const url = BASE + p;
    const entry = { overflow: {}, consoleErrors: [], meta: {}, deadAnchors: [], deadLinks: [], contrast: [] };
    const ctx = await browser.newContext({ userAgent: UA });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') entry.consoleErrors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => entry.consoleErrors.push('pageerror: ' + e.message.slice(0, 160)));
    try {
      // 1280 pass — meta, anchors, links, contrast
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      entry.meta = await page.evaluate(() => {
        const g = (sel, attr = 'content') => { const n = document.querySelector(sel); return n ? (n.getAttribute(attr) || n.textContent || '').trim() : null; };
        return {
          title: g('title', 'text') || (document.title || null),
          description: g('meta[name="description"]'),
          ogTitle: g('meta[property="og:title"]'),
          ogDescription: g('meta[property="og:description"]'),
          ogImage: g('meta[property="og:image"]'),
          canonical: g('link[rel="canonical"]', 'href'),
          viewport: g('meta[name="viewport"]'),
        };
      });
      // collect links + in-page anchor ids
      const { links, anchorTargets, ids } = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
        const anchorTargets = links.filter((h) => h && h.startsWith('#') && h !== '#').map((h) => h.slice(1));
        const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
        return { links, anchorTargets, ids };
      });
      // dead in-page anchors
      entry.deadAnchors = [...new Set(anchorTargets)].filter((t) => !ids.includes(t));
      // same-origin link statuses (page files only, skip assets/mailto/external)
      const seen = new Set();
      for (const h of links) {
        if (!h || /^(mailto:|tel:|javascript:|#)/i.test(h)) continue;
        let abs; try { abs = new URL(h, url).toString(); } catch { continue; }
        if (!abs.startsWith(BASE)) continue;
        const clean = abs.split('#')[0];
        if (/\.(css|js|woff2?|svg|png|jpe?g|ico|webp|gif|map)(\?|$)/i.test(clean)) continue;
        if (seen.has(clean)) continue; seen.add(clean);
        const code = await status(clean);
        if (code !== 200) entry.deadLinks.push({ href: h, resolved: clean, status: code });
      }
      // contrast: sample primary heading + first body paragraph vs their effective bg
      entry.contrast = await page.evaluate(() => {
        const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        function effBg(el) {
          let n = el;
          while (n) { const c = getComputedStyle(n).backgroundColor; const p = parse(c); if (p.length >= 3 && !(p[3] === 0)) return p.slice(0, 3); n = n.parentElement; }
          return [5, 5, 5];
        }
        const out = [];
        for (const sel of ['h1', '.lede', '.page-hero p', 'p']) {
          const el = document.querySelector(sel); if (!el) continue;
          const col = parse(getComputedStyle(el).color).slice(0, 3);
          out.push({ sel, color: col, bg: effBg(el), text: (el.textContent || '').trim().slice(0, 40) });
          if (out.length >= 3) break;
        }
        return out;
      });
      // 375 pass — horizontal overflow
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      entry.overflow['375'] = await page.evaluate(() => {
        const de = document.documentElement;
        const scrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
        const wide = [...document.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5)
          .map((n) => ({ tag: n.tagName.toLowerCase(), cls: (n.className && n.className.toString().slice(0, 40)) || '', right: Math.round(n.getBoundingClientRect().right) }));
        return { innerWidth: window.innerWidth, scrollWidth: scrollW, overflows: scrollW > window.innerWidth + 1, widestOffenders: wide };
      });
      // 1280 overflow too
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      entry.overflow['1280'] = await page.evaluate(() => {
        const de = document.documentElement; const scrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
        return { innerWidth: window.innerWidth, scrollWidth: scrollW, overflows: scrollW > window.innerWidth + 1 };
      });
    } catch (e) { entry.error = e.message.split('\n')[0]; }
    // compute contrast ratios
    entry.contrast = (entry.contrast || []).map((c) => ({ ...c, ratio: contrast(c.color, c.bg), pass: contrast(c.color, c.bg) >= 4.5 }));
    await ctx.close();
    report[p] = entry;
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error('FRAMER AUDIT FAILED:', e.message); process.exit(1); });
