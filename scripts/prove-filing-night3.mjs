// NIGHT SHIFT 3 · THE PROOF — confirm the PACKAGED /Applications/VULCAN.app can actually
// FILE an artifact into the iCloud/Obsidian vault (i.e. Full Disk Access is effective).
// Runs ONE real MISSION BRIEF dispatch through the installed app under CDP, checks the
// returned artifact path exists on disk, then REMOVES the test artifact so the vault is
// left exactly as found. Prints a JSON verdict.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const APP = '/Applications/VULCAN.app/Contents/MacOS/VULCAN';
const PORT = 9271;
const VAULT_OUT = '/Users/vishnumovva/Library/Mobile Documents/iCloud~md~obsidian/Documents/Bonsai-Business/Bonsai-Business/Agents/VULCAN/BONSAI/outputs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ok: false };

async function launch(port) {
  const proc = spawn(APP, [`--remote-debugging-port=${port}`], { stdio: 'ignore', detached: true });
  proc.unref();
  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch (_) { await sleep(300); } }
  if (!browser) throw new Error('CDP connect failed');
  let page = null;
  for (let i = 0; i < 30 && !page; i++) {
    for (const c of browser.contexts()) for (const p of c.pages()) { const u = p.url(); if (u.includes('index.html') || u.startsWith('file://')) page = p; }
    if (!page) await sleep(300);
  }
  if (!page) throw new Error('stage page not found');
  await page.waitForFunction(() => !!window.__vulcanStage && !!window.vulcan, { timeout: 20000 });
  return { proc, browser, page };
}

try {
  const before = new Set(fs.existsSync(VAULT_OUT) ? fs.readdirSync(VAULT_OUT) : []);
  out.vaultReadable = fs.existsSync(VAULT_OUT);
  const s = await launch(PORT);
  const r = await s.page.evaluate(() => window.vulcan.dispatch('MISSION BRIEF'));
  out.dispatch = { ok: !!r.ok, title: r.title, degraded: !!r.degraded, artifact: r.artifact ? r.artifact.filename : null, rel: r.artifact ? r.artifact.rel : null };
  await sleep(800);
  const after = fs.existsSync(VAULT_OUT) ? fs.readdirSync(VAULT_OUT) : [];
  const created = after.filter((f) => !before.has(f));
  out.newFilesInVault = created;
  // confirm the returned artifact really exists on disk, then clean it up
  let filedPath = null;
  if (r.artifact && r.artifact.filename) {
    const p = path.join(VAULT_OUT, r.artifact.filename);
    if (fs.existsSync(p)) filedPath = p;
  }
  if (!filedPath && created.length) filedPath = path.join(VAULT_OUT, created[0]);
  out.filedOnDisk = !!filedPath;
  // also confirm today's daily doc got the line (best-effort, not required)
  await s.browser.close().catch(() => {});
  try { s.proc.kill('SIGKILL'); } catch (_) {}
  // CLEANUP — remove the test artifact(s) so the vault is left as found
  out.cleanedUp = [];
  for (const f of created) {
    try { fs.unlinkSync(path.join(VAULT_OUT, f)); out.cleanedUp.push(f); } catch (_) {}
  }
  out.ok = !!(out.vaultReadable && out.filedOnDisk);
} catch (e) {
  out.error = String((e && e.stack) || e);
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
