// C1 THE NIGHT WATCHMAN — the checks. Every check is STRICTLY READ-ONLY: HTTP GETs and
// headless page LOADS, never a POST, never a form submit that mutates, never a write of
// any kind to the site. The Watchman watches; it does not touch. Four checks:
//   http200      — each configured path returns 200
//   consoleClean — / and /tool.html load in a headless browser with ZERO console errors,
//                  page errors, or failed sub-requests
//   linkCrawl    — every same-origin link reachable from the start page returns 200
//   engineSmoke  — the citation tool's engine mounts: its required controls render and
//                  the page loads clean (no console errors)
// Each returns { name, ok, detail, failures[] } and NEVER throws — a check that can't run
// (e.g. the network is down) reports ok:false with a reason, so the runner can alert.
import { chromium } from 'playwright';

const UA = 'VULCAN-NightWatchman/1.0 (+read-only uptime sentinel)';
const abs = (base, p) => new URL(p, base.endsWith('/') ? base : base + '/').toString();

// ---- http200 ----------------------------------------------------------------
export async function http200(baseUrl, paths, { timeoutMs = 15000 } = {}) {
  const failures = [];
  for (const p of paths) {
    const url = abs(baseUrl, p.replace(/^\//, ''));
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status !== 200) failures.push({ url, status: res.status });
    } catch (e) {
      failures.push({ url, error: e.name === 'AbortError' ? 'timeout' : e.message });
    }
  }
  return { name: 'http200', ok: failures.length === 0, detail: `${paths.length} paths, ${failures.length} bad`, failures };
}

// ---- headless load helper: load a URL, collect console/page/request errors ---
async function loadClean(browser, url, { timeoutMs = 20000 } = {}) {
  const errors = [];
  const page = await browser.newPage({ userAgent: UA });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    // favicons / analytics beacons that fail are noise; a failed SCRIPT/CSS/DOC is real.
    const type = r.resourceType();
    if (['script', 'stylesheet', 'document', 'fetch', 'xhr'].includes(type)) {
      errors.push(`requestfailed(${type}): ${r.url()} — ${r.failure()?.errorText || 'failed'}`);
    }
  });
  let loadError = null;
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
    if (res && res.status() !== 200) loadError = `status ${res.status()}`;
    await page.waitForTimeout(800);   // let deferred module scripts run + settle
  } catch (e) {
    loadError = e.message.split('\n')[0];
  }
  return { page, errors, loadError };
}

// ---- consoleClean -----------------------------------------------------------
export async function consoleClean(baseUrl, paths, opts = {}) {
  const browser = await chromium.launch();
  const failures = [];
  try {
    for (const p of paths) {
      const url = abs(baseUrl, p.replace(/^\//, ''));
      const { page, errors, loadError } = await loadClean(browser, url, opts);
      await page.close();
      if (loadError) failures.push({ url, loadError });
      if (errors.length) failures.push({ url, errors });
    }
  } finally { await browser.close(); }
  return { name: 'consoleClean', ok: failures.length === 0, detail: `${paths.length} pages loaded headless`, failures };
}

// ---- linkCrawl: same-origin BFS from start, verify each page is 200 ----------
export async function linkCrawl(baseUrl, { start = '/', maxPages = 15, timeoutMs = 15000 } = {}) {
  const origin = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').origin;
  const startUrl = abs(baseUrl, start.replace(/^\//, ''));
  const seen = new Set([startUrl]);
  const queue = [startUrl];
  const failures = [];
  let visited = 0;
  const get = async (url, method) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try { return await fetch(url, { method, redirect: 'manual', headers: { 'user-agent': UA }, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  };
  while (queue.length && visited < maxPages) {
    const url = queue.shift();
    visited++;
    let res, html = '';
    try {
      res = await get(url, 'GET');
      if (res.status !== 200) { failures.push({ url, status: res.status }); continue; }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) html = await res.text();
    } catch (e) { failures.push({ url, error: e.name === 'AbortError' ? 'timeout' : e.message }); continue; }
    // extract same-origin hrefs; enqueue unseen HTML-ish links up to the cap.
    for (const m of html.matchAll(/href="([^"]+)"/gi)) {
      const raw = m[1];
      if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) continue;
      let link; try { link = new URL(raw, url).toString(); } catch { continue; }
      if (new URL(link).origin !== origin) continue;             // same-origin only
      const clean = link.split('#')[0];
      if (/\.(css|js|woff2?|svg|png|jpe?g|ico|json|xml|txt|webp|gif|map)(\?|$)/i.test(clean)) continue;  // assets are not pages
      if (!seen.has(clean) && seen.size < maxPages * 3) { seen.add(clean); queue.push(clean); }
    }
  }
  return { name: 'linkCrawl', ok: failures.length === 0, detail: `crawled ${visited} pages from ${start}`, failures };
}

// ---- engineSmoke: the citation tool's engine actually mounts -----------------
export async function engineSmoke(baseUrl, { page: pagePath = '/tool.html', requireIds = [], timeoutMs = 20000 } = {}) {
  const url = abs(baseUrl, pagePath.replace(/^\//, ''));
  const browser = await chromium.launch();
  const failures = [];
  try {
    const { page, errors, loadError } = await loadClean(browser, url, { timeoutMs });
    if (loadError) failures.push({ url, loadError });
    if (errors.length) failures.push({ url, consoleErrors: errors });
    // every required control must be present in the DOM — proof the engine mounted.
    const missing = [];
    for (const id of requireIds) {
      const found = await page.$(`#${id}`);
      if (!found) missing.push(id);
    }
    if (missing.length) failures.push({ url, missingElements: missing });
    await page.close();
  } catch (e) {
    failures.push({ url, error: e.message.split('\n')[0] });
  } finally { await browser.close(); }
  return { name: 'engineSmoke', ok: failures.length === 0, detail: `engine controls on ${pagePath}`, failures };
}

// run all checks named in a contract; returns an ordered array of results.
export async function runChecks(contract) {
  const base = contract.baseUrl;
  const c = contract.checks || {};
  const results = [];
  if (c.http200) results.push(await http200(base, c.http200));
  if (c.consoleClean) results.push(await consoleClean(base, c.consoleClean));
  if (c.linkCrawl) results.push(await linkCrawl(base, c.linkCrawl));
  if (c.engineSmoke) results.push(await engineSmoke(base, c.engineSmoke));
  return results;
}
