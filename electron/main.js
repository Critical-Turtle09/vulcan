// Electron shell — RESIDENT OVERLAY (STAGE D + final-pass FINDING 3). VULCAN is a
// borderless, always-on-top overlay that JOINS the currently active Space and
// monitor — it is NEVER a native macOS fullscreen window (that would open a
// separate Space and yank the user away). Summon it with the global ⌥⌘V chord (or the
// tray) from Chrome/Mail and the command center resolves OVER that screen; banking hides
// it and reveals the same apps untouched — no Space animation, no app switch.
//
// It launches at login, hides to a menu-bar (tray) item instead of quitting, and
// keeps the wake listener + audio alive while hidden (backgroundThrottling off).
// Esc banks the fire ALWAYS while resolved (a global shortcut registered only
// while the overlay is up, so it never swallows Esc from other apps when hidden).
import { app, BrowserWindow, Tray, Menu, screen, session, systemPreferences, globalShortcut, ipcMain, nativeImage, desktopCapturer, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { loadEnv, loadEnvOverride, registerVoiceIpc } from './voice-main.js';
import { registerWireIpc } from './wire-main.js';
import { registerQuotesIpc } from './quotes-main.js';
import { registerBrainIpc } from './brain-main.js';   // B1 SYNAPSE — voice→brain→panel
import { registerVitalsIpc } from './vitals-main.js';   // G2 FLANKS — Z1 system vitals reads

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
loadEnv(ROOT);   // bundle/repo .env (dev + packaged fallback)

// P1.1 — the durable, writable env location: per-user userData in the packaged app
// (survives reinstall, never baked into the distributable), the repo .env in dev.
// This is where the packaged overlay reads from and where SET TOKEN writes to.
function envWritePath() {
  try { return app.isPackaged ? path.join(app.getPath('userData'), '.env') : path.join(ROOT, '.env'); }
  catch (_) { return path.join(ROOT, '.env'); }
}
const DEV_URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';
// ignition.hotkey token (read via fs — main-process, no bundler) with a safe default.
// G6 SUMMON FROM HIDDEN — the documented global summon chord is ⌥⌘V (Alt+Command+V):
// a sane, unclaimed chord that raises the stage from ANY Space/app (globalShortcut is
// system-wide). Space stays reserved for push-to-talk, so the two never collide.
let HOTKEY = 'Alt+Command+V';
try { HOTKEY = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8')).ignition.hotkey || HOTKEY; } catch (_) {}

let win = null, tray = null, isQuitting = false;
const OVERLAY_LEVEL = 'screen-saver';
// FX3R — EYES-ON DRILL. A drill-only windowed mode: a modest, framed, movable window
// (NOT the fullscreen always-on-top overlay) so the Terminal stays visible beside VULCAN
// for the whole run. Ceremony + normal operation are unaffected — this flag is drills only.
const DRILL_WINDOWED = process.env.VULCAN_DRILL_WINDOWED === '1';
const DRILL_SIZE = { width: 1100, height: 700 };
function drillBounds() {
  const b = activeBounds();
  return {
    width: DRILL_SIZE.width, height: DRILL_SIZE.height,
    // sit toward the right of the active display, vertically centered, so a Terminal on
    // the left stays fully visible.
    x: Math.round(b.x + b.width - DRILL_SIZE.width - 60),
    y: Math.round(b.y + (b.height - DRILL_SIZE.height) / 2),
  };
}

// ---- RL-5 v2 · PART 1 — SYSTEM SAFETY. The overlay is a full-screen, always-on-top
// screen-saver-level panel; if the renderer ever hangs while it is up, nothing is
// reachable and the Mac reads as FROZEN. Three independent escape hatches, all of
// which bypass the renderer so a hung renderer can never trap the operator:
//   1. emergency global hotkey (Cmd+Shift+Esc) -> forceHide(), always registered
//   2. a heartbeat WATCHDOG: main pings, the renderer pongs on its main thread; if
//      no pong lands within WATCHDOG_HANG_MS the overlay is force-hidden
//   3. forceHide() drops always-on-top + hides straight from main (no IPC round-trip)
const WATCHDOG_PING_MS = 500;    // heartbeat cadence while the overlay is visible
const WATCHDOG_HANG_MS = 2000;   // renderer silent longer than this => auto force-hide
const EMERGENCY_HOTKEY = 'CommandOrControl+Shift+Escape';
let lastPong = 0, watchdogTimer = null;

// ---- NIGHT II · PART 1 — Space-switch DIAGNOSTIC (this bug failed twice; measure,
// don't guess). Logs window state + macOS frontmost app around every summon/bank
// into ignition-diagnostic.log. `VULCAN_DIAG=1` runs a scripted self-test on boot.
const DIAG = process.env.VULCAN_DIAG === '1';
const DIAG_FILE = path.join(ROOT, 'ignition-diagnostic.log');
function frontmostApp() {
  return new Promise((resolve) => {
    try {
      const p = spawn('osascript', ['-e', 'tell application "System Events" to get name of first application process whose frontmost is true']);
      let out = '', err = '';
      p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
      p.on('close', () => resolve(out.trim() || `ERR(${err.trim().slice(0, 40)})`));
      p.on('error', () => resolve('ERR(no-osascript)'));
    } catch (_) { resolve('ERR'); }
  });
}
async function diagLog(label) {
  if (!DIAG) return;
  const front = await frontmostApp();
  const w = win ? { visible: win.isVisible(), focused: win.isFocused(), onTop: win.isAlwaysOnTop(), bounds: win.getBounds() } : null;
  const line = `${new Date().toISOString()} | ${label.padEnd(16)} | frontmost=${front} | level=${OVERLAY_LEVEL} | ${JSON.stringify(w)}\n`;
  try { fs.appendFileSync(DIAG_FILE, line); } catch (_) {}
  console.log('DIAG', line.trim());
}

// the display the operator is actually on right now (cursor's screen)
function activeBounds() {
  try { return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds; }
  catch (_) { return screen.getPrimaryDisplay().bounds; }
}

function createWindow() {
  const b = activeBounds();
  // FX3R — a drill window is modest + framed + movable so the Terminal stays visible
  // beside it; the resident overlay is the borderless, fullscreen, always-on-top panel.
  const wb = DRILL_WINDOWED
    ? { ...drillBounds(), type: undefined, frame: true, resizable: true, movable: true, hasShadow: true, roundedCorners: true, skipTaskbar: false, title: 'VULCAN — DRILL' }
    : { x: b.x, y: b.y, width: b.width, height: b.height, type: 'panel', frame: false, resizable: false, movable: false, hasShadow: false, roundedCorners: false, skipTaskbar: true };
  win = new BrowserWindow({
    ...wb,
    // NON-ACTIVATING PANEL (NIGHT II · PART 1): an NSPanel floats on the CURRENT
    // Space without activating the app — so summoning never switches Spaces or
    // steals frontmost. The prior regular window called .show()+focus, which
    // activated VULCAN and dragged the operator to its Space. Root cause fixed.
    transparent: false,
    backgroundColor: '#050607',   // token: void — no white flash on boot (doctrine 11)
    show: false,
    focusable: true,              // panel may become key without activating the app
    acceptFirstMouse: true,       // clicks work without activating first
    minimizable: DRILL_WINDOWED,
    maximizable: false,
    fullscreenable: false,        // NEVER native macOS fullscreen (no separate Space)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,   // keep the wake listener + audio alive while hidden
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // float above everything, on the active Space (and over other apps' fullscreen).
  // In drill mode the window is a normal framed window (no overlay levels) so the
  // Terminal stays visible next to it.
  if (!DRILL_WINDOWED) {
    win.setAlwaysOnTop(true, OVERLAY_LEVEL);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  }
  // launched as a hidden login item -> boot resident to the tray + wake listener,
  // no overlay flash (the operator summons with the wake word / hotkey when ready)
  win.once('ready-to-show', () => {
    const openedHidden = app.isPackaged && app.getLoginItemSettings().wasOpenedAsHidden;
    if (!DIAG && !openedHidden) showOverlay();
  });

  // resident: closing hides to the tray, it does not quit (only the tray Quit does)
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); hideOverlay(); } });

  // echo renderer [voice] status to the terminal (no devtools needed)
  win.webContents.on('console-message', (...args) => {
    const parts = args.map((a) => (a && typeof a === 'object' && 'message' in a) ? a.message : a);
    const msg = parts.filter((x) => typeof x === 'string').join(' ');
    if (msg.includes('[voice]')) console.log('RENDERER', msg);
  });

  // PART 6 — dev loads the vite server (hot reload + byte-identical audit); the
  // PACKAGED .app has no dev server, so it loads the built renderer over file://
  // (vite base:'./' → relative assets). asar:false keeps tokens.json/profiles/.env
  // as plain files the main process can still fs-read at runtime.
  if (app.isPackaged) win.loadFile(path.join(ROOT, 'dist', 'index.html'));
  else win.loadURL(DEV_URL);
}

// PART 6 — LOGIN ITEM. VULCAN is summoned at login on the Mac mini: register as an
// open-at-login item, launched HIDDEN (openAsHidden) so it boots resident to the
// tray + wake listener without flashing the overlay. Only in the packaged .app —
// never register the dev binary (electron) as a login item. Operator-toggleable
// from the tray; the checkbox reflects the live OS setting.
function loginItemEnabled() {
  try { return app.getLoginItemSettings().openAtLogin; } catch (_) { return false; }
}
function setLoginItem(enabled) {
  try { app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true }); } catch (_) {}
}

// Esc banks ALWAYS while resolved — registered globally only while the overlay is
// visible (so it never eats Esc from other apps when VULCAN is hidden).
function registerBankEsc() {
  try { globalShortcut.register('Escape', () => { if (win && win.isVisible()) win.webContents.send('ui:bank'); }); } catch (_) {}
}
function unregisterBankEsc() { try { globalShortcut.unregister('Escape'); } catch (_) {} }

// §1a — snapshot the ACTIVE display and hand it to the renderer as the ceremony
// backdrop, so the operator sees their real screen beneath the kindling sparks
// (the canvas lighten-composites over it; void fades in as it resolves). Fail-soft:
// no screen-recording permission -> null -> renderer falls back to the void floor.
// RL-6 — ONE fresh, native-resolution snapshot of the ACTIVE display, captured
// BEFORE the overlay covers the screen (summon awaits this), so the snapshot is the
// real screen only — never VULCAN's own window, never a mid-fade frame. Full physical
// resolution (scaleFactor) = 1:1 alignment with the live screen, no scale mismatch;
// JPEG keeps the payload small over IPC. The renderer paints it no-repeat at
// 100%x100%, so it reads as a single seamless screen (no ghosting/tiling).
async function sendBackdrop() {
  if (!win) return;
  try {
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const scale = disp.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(disp.size.width * scale), height: Math.round(disp.size.height * scale) },
    });
    const src = sources.find((s) => String(s.display_id) === String(disp.id)) || sources[0];
    let url = null;
    if (src && src.thumbnail && !src.thumbnail.isEmpty()) {
      const jpeg = src.thumbnail.toJPEG(85);
      if (jpeg && jpeg.length) url = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    }
    win.webContents.send('ui:backdrop', url);
  } catch (_) { win.webContents.send('ui:backdrop', null); }
}

// PART 1 — WATCHDOG. While the overlay is up, ping the renderer; it pongs on its
// main thread (see preload). A hung main thread (GC stall, infinite loop, shader
// compile lock) cannot pong, so silence past WATCHDOG_HANG_MS means the operator is
// about to be trapped behind a frozen full-screen window -> force-hide immediately.
function startWatchdog() {
  stopWatchdog();
  lastPong = Date.now();                        // assume alive at show; miss => hang
  watchdogTimer = setInterval(() => {
    if (!win || !win.isVisible()) return;       // nothing to escape from while hidden
    try { win.webContents.send('wd:ping'); } catch (_) {}
    if (Date.now() - lastPong > WATCHDOG_HANG_MS) {
      console.log(`[safety] renderer unresponsive >${WATCHDOG_HANG_MS}ms — force-hiding overlay`);
      forceHide('watchdog');
    }
  }, WATCHDOG_PING_MS);
  if (watchdogTimer.unref) watchdogTimer.unref();
}
function stopWatchdog() { if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; } }

// PART 1 — the hard escape hatch. Runs entirely in main (no renderer IPC), so it
// works even when the renderer is wedged: drop always-on-top so a zombie window can
// never stay above the OS, hide, release Esc, stop the watchdog. Also nudges a
// still-responsive renderer to snap back to its hidden state for a clean next summon.
function forceHide(reason) {
  unregisterBankEsc();
  stopWatchdog();
  if (win) {
    try { win.setAlwaysOnTop(false); } catch (_) {}
    try { win.webContents.send('ui:force-hide'); } catch (_) {}
    try { win.hide(); } catch (_) {}
  }
  diagLog(`force-hide/${reason || 'manual'}`);
}

function showOverlay() {
  if (!win) return;
  if (DRILL_WINDOWED) {
    // FX3R — a modest framed window beside the Terminal; NOT the fullscreen overlay.
    win.setBounds(drillBounds());
    win.showInactive();                        // keep the Terminal key so Ctrl-C stays live
    registerBankEsc();                         // real behaviour; the drill warns against Esc
    startWatchdog();
    return;
  }
  win.setBounds(activeBounds());               // resolve over whatever screen the operator is on
  win.setAlwaysOnTop(true, OVERLAY_LEVEL);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  // G6.3 THE FOCUS — OWNERSHIP ON SUMMON. The overlay must OWN the keyboard the instant it
  // resolves: the app behind loses focus, VULCAN's window becomes key, so typing / hold-Space
  // land on the stage (not the app underneath). This DELIBERATELY reverses the NIGHT II
  // non-activating panel (showInactive) — the operator asked for immediate keyboard ownership.
  // The panel + visibleOnAllWorkspaces still keeps VULCAN on the CURRENT Space (no Space
  // switch): app.focus activates VULCAN over whatever the operator is looking at right now.
  app.focus({ steal: true });                  // pull VULCAN frontmost, steal from the app behind
  win.show();                                  // ACTIVATING show (not showInactive)
  win.moveTop();
  win.focus();                                 // take key focus — the keyboard now belongs to VULCAN
  registerBankEsc();
  startWatchdog();                             // arm the hang detector while visible
}
// hide the panel. Because summon never ACTIVATED VULCAN, the app that was frontmost
// stayed frontmost — hiding the panel simply reveals it, focus intact (no app.hide,
// which would itself churn activation).
function hideOverlay() {
  unregisterBankEsc();
  stopWatchdog();
  if (win) win.hide();
  diagLog('bank/hide');
}

// RL-6 — capture the CLEAN live screen BEFORE showing the overlay, so the backdrop is
// a single coherent snapshot of the real screen (no VULCAN in it, no stale frame).
// Only when coming from hidden (a re-summon while visible carries no ceremony).
async function summon() {
  const wasHidden = !win.isVisible();
  // FX3R — in the modest drill window the fullscreen backdrop snapshot would squash to
  // the window rect; skip it so the ceremony resolves over the clean void floor instead.
  if (wasHidden && !DRILL_WINDOWED) await sendBackdrop();
  showOverlay();
  if (wasHidden) win.webContents.send('ui:ignite');
  diagLog('summon');
}
function toggleOverlay() {
  if (win.isVisible()) win.webContents.send('ui:bank');   // renderer runs the bank, then requestHide
  else summon();
}

function buildTray() {
  try {
    tray = new Tray(nativeImage.createEmpty());        // macOS: title-only menu-bar item
    tray.setTitle('◆ VULCAN');
    tray.setToolTip('VULCAN — Silicon Forge Intelligence');
    const menu = Menu.buildFromTemplate([
      { label: 'Summon VULCAN', accelerator: HOTKEY, click: () => summon() },
      { label: 'Bank the Fire', click: () => { if (win.isVisible()) win.webContents.send('ui:bank'); } },
      { type: 'separator' },
      { label: 'Mute Mic (M)', click: () => win.webContents.send('ui:mute') },
      { type: 'separator' },
      { label: 'Open at Login', type: 'checkbox', checked: loginItemEnabled(), enabled: app.isPackaged, click: (mi) => setLoginItem(mi.checked) },
      { type: 'separator' },
      { label: 'Quit VULCAN', click: () => { isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => summon());
  } catch (e) { console.log('[ignition] tray unavailable:', e && e.message); }
}

app.whenReady().then(() => {
  // P1.1 — no Dock icon: VULCAN is a menu-bar (tray) resident, so it must never show
  // in the Dock. app.dock.hide() is the correct fix for this electron-packager build
  // (no asar/plist pipeline to set LSUIElement); macOS-only, guarded elsewhere it's undefined.
  try { if (process.platform === 'darwin' && app.dock) app.dock.hide(); } catch (_) {}

  // P1.1 — packaged env resolution: overlay the writable user .env OVER the bundle's,
  // so operator keys (and SET TOKEN writes) resolve without rebuilding and survive reinstall.
  try { if (app.isPackaged) loadEnvOverride(envWritePath()); } catch (_) {}

  registerVoiceIpc();
  registerWireIpc();
  registerQuotesIpc();
  registerBrainIpc(() => win);   // B1 — brain:conduct / test-write / mode + announce→voice
  registerVitalsIpc(ROOT);       // G2 — Z1 vitals: spend (B0) · vercel (B5R) · commits (B2)

  // grant the renderer's getUserMedia(audio) request; the OS TCC prompt fires on
  // first capture. Declining -> renderer shows VOICE OFFLINE, hotkey still summons.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media' || permission === 'audioCapture');
  });

  // RL-5 v2 · PART 1 — open-at-login is OFF BY DEFAULT (a resident overlay that can
  // trap the machine must never resurrect itself at every login without an explicit
  // opt-in). We no longer auto-enable it. One-time migration: the prior build forced
  // it ON, so on first run of this build we turn it back OFF (guarded by a marker so
  // a later operator opt-in via the tray is respected and never re-forced).
  try {
    const flag = path.join(app.getPath('userData'), 'login-default-off.v2');
    if (app.isPackaged && !fs.existsSync(flag)) {
      setLoginItem(false);
      fs.writeFileSync(flag, new Date().toISOString());
    }
  } catch (_) {}

  createWindow();
  buildTray();

  // resident overlay control from the renderer
  ipcMain.on('ui:request-summon', () => summon());       // wake-from-hidden (FINDING 1)
  ipcMain.on('ui:request-show', () => summon());         // legacy alias
  ipcMain.on('ui:request-hide', () => hideOverlay());    // bank complete (FINDING 4)
  ipcMain.on('wd:pong', () => { lastPong = Date.now(); }); // PART 1 — watchdog heartbeat

  // G4 THE LIFECYCLE — the overlay's "OPEN IN VAULT ↗" handoff. Only obsidian:// and
  // file:// URIs are honoured (the renderer only ever sends a vault artifact handle) —
  // never an arbitrary http(s) target, so a rogue string can't be turned into a browser
  // pop. Fail-soft: an unopenable URI is logged, never thrown.
  ipcMain.on('ui:open-external', (_e, uri) => {
    const s = String(uri || '');
    if (!/^(obsidian:|file:)/i.test(s)) { console.log('[dispatch] refused open-external:', s.slice(0, 40)); return; }
    shell.openExternal(s).catch((err) => console.log('[dispatch] open-external failed:', err && err.message));
  });

  // global summon hotkey — fail-soft: if registration is refused (e.g. accessibility
  // denied), the tray item + wake word still summon; nothing hard-fails.
  const ok = globalShortcut.register(HOTKEY, () => toggleOverlay());
  if (!ok) console.log(`[ignition] hotkey ${HOTKEY} unavailable — use the tray or wake word`);

  // PART 1 — EMERGENCY force-hide, always registered while the app runs. Bypasses the
  // renderer entirely, so even a fully wedged renderer cannot keep the operator
  // trapped behind the overlay. Fail-soft: if the OS refuses the binding, the tray
  // Quit + watchdog remain as escapes.
  const eok = globalShortcut.register(EMERGENCY_HOTKEY, () => forceHide('hotkey'));
  if (!eok) console.log(`[safety] emergency hotkey ${EMERGENCY_HOTKEY} unavailable — watchdog + tray remain`);

  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch(() => {});
  }

  // activation churn is the smell we're hunting — log every focus/blur (Part 1)
  app.on('browser-window-focus', () => diagLog('win-focus'));
  app.on('browser-window-blur', () => diagLog('win-blur'));

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else showOverlay(); });

  if (DIAG) runDiagnostic();
});

// scripted self-test: set a known app frontmost, summon, bank — and record the
// macOS frontmost app at each step. If it never changes, there is NO app switch;
// a non-activating panel implies no Space switch. Writes ignition-diagnostic.log.
async function runDiagnostic() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.writeFileSync(DIAG_FILE, `VULCAN Space-switch diagnostic — ${new Date().toISOString()}\n`
    + `window: type=panel · level=${OVERLAY_LEVEL} · showInactive (never .show()+focus) · fullscreenable=false\n\n`);
  await sleep(1600);
  await new Promise((r) => { const p = spawn('osascript', ['-e', 'tell application "Finder" to activate']); p.on('close', r); p.on('error', r); });
  await sleep(1200);
  await diagLog('baseline');        // expect: frontmost=Finder
  summon();                          // non-activating show + ignite
  await sleep(2000);
  await diagLog('after-summon');    // expect: frontmost=Finder (VULCAN did NOT steal it)
  hideOverlay();
  await sleep(1200);
  await diagLog('after-bank');      // expect: frontmost=Finder
  fs.appendFileSync(DIAG_FILE, '\nACCEPTANCE: frontmost identical across baseline/after-summon/after-bank => NO app switch.\n'
    + 'Non-activating panel + visibleOnAllWorkspaces => shown on the current Space (no Space switch).\n');
  isQuitting = true; app.quit();
}

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
// resident: never quit just because the window hid/closed (only the tray Quit does)
app.on('window-all-closed', () => { /* stay resident */ });
