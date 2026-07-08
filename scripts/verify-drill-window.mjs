// FX3R — WINDOWED DRILL MODE acceptance. Launches the REAL app with
// VULCAN_DRILL_WINDOWED=1 (test-mode voice so no mic) and asserts the window is a modest,
// framed, movable, NON-fullscreen, NON-always-on-top window — so the Terminal stays
// visible beside VULCAN during a drill. The default (flag off) stays the fullscreen
// always-on-top overlay (asserted too).
//
//   prereqs: vite dev server on :5273 (npm run dev).
//   run: node scripts/verify-drill-window.mjs
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`   ${c ? 'PASS' : 'FAIL'} · ${m}`); c ? pass++ : fail++; };

console.log('VULCAN · FX3R — windowed drill mode · verification\n');

// probe a launched app's primary window geometry + flags from the MAIN process.
async function probeWindow(env) {
  const app = await electron.launch({ cwd: ROOT, args: ['.'], env: { ...process.env, ...env } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!window.__vulcanHome, { timeout: 20000 });
  await page.waitForTimeout(1200);   // let ready-to-show run showOverlay()
  const info = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const b = w.getBounds();
    return { bounds: b, resizable: w.isResizable(), movable: w.isMovable(), alwaysOnTop: w.isAlwaysOnTop(), visible: w.isVisible() };
  });
  await app.close();
  return info;
}

// ---- (A) DRILL WINDOWED ------------------------------------------------------
console.log('(A) VULCAN_DRILL_WINDOWED=1 — modest framed window beside the Terminal');
const d = await probeWindow({ VULCAN_DRILL_WINDOWED: '1', VULCAN_VOICE_TEST: '1' });
console.log('   drill window:', JSON.stringify(d));
ok(d.bounds.width === 1100 && d.bounds.height === 700, `modest size 1100x700 (got ${d.bounds.width}x${d.bounds.height})`);
ok(d.resizable === true, 'framed window is resizable (a real window, not the locked panel)');
ok(d.movable === true, 'movable — the operator can reposition it');
ok(d.alwaysOnTop === false, 'NOT always-on-top — the Terminal stays visible beside it');
ok(d.visible === true, 'shown on launch (eyes-on from the start)');
console.log('');

// ---- (B) DEFAULT OVERLAY (flag off) -----------------------------------------
console.log('(B) default (flag off) — the resident fullscreen always-on-top overlay is unchanged');
const o = await probeWindow({ VULCAN_VOICE_TEST: '1' });
console.log('   overlay window:', JSON.stringify({ w: o.bounds.width, h: o.bounds.height, alwaysOnTop: o.alwaysOnTop, resizable: o.resizable }));
ok(o.alwaysOnTop === true, 'default overlay is always-on-top (screen-saver level)');
ok(o.resizable === false, 'default overlay is a locked panel (not resizable)');
ok(o.bounds.width > 1100 || o.bounds.height > 700, `default overlay fills the display (${o.bounds.width}x${o.bounds.height}), not the modest 1100x700`);
console.log('');

console.log(`=== ${fail === 0 ? 'ALL PASS' : 'FAILURES'} · ${pass} pass · ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
