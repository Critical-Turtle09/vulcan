// Electron shell — RESIDENT OVERLAY (STAGE D + final-pass FINDING 3). VULCAN is a
// borderless, always-on-top overlay that JOINS the currently active Space and
// monitor — it is NEVER a native macOS fullscreen window (that would open a
// separate Space and yank the user away). Say "Fire and Forge" (or Alt+Space) in
// Chrome/Mail and the command center resolves OVER that screen; banking hides it
// and reveals the same apps untouched — no Space animation, no app switch.
//
// It launches at login, hides to a menu-bar (tray) item instead of quitting, and
// keeps the wake listener + audio alive while hidden (backgroundThrottling off).
// Esc banks the fire ALWAYS while resolved (a global shortcut registered only
// while the overlay is up, so it never swallows Esc from other apps when hidden).
import { app, BrowserWindow, Tray, Menu, screen, session, systemPreferences, globalShortcut, ipcMain, nativeImage, desktopCapturer } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { loadEnv, registerVoiceIpc } from './voice-main.js';
import { registerWireIpc } from './wire-main.js';
import { registerQuotesIpc } from './quotes-main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
loadEnv(ROOT);
const DEV_URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';
// ignition.hotkey token (read via fs — main-process, no bundler) with a safe default
let HOTKEY = 'Alt+Space';
try { HOTKEY = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8')).ignition.hotkey || HOTKEY; } catch (_) {}

let win = null, tray = null, isQuitting = false;
const OVERLAY_LEVEL = 'screen-saver';

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
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    // NON-ACTIVATING PANEL (NIGHT II · PART 1): an NSPanel floats on the CURRENT
    // Space without activating the app — so summoning never switches Spaces or
    // steals frontmost. The prior regular window called .show()+focus, which
    // activated VULCAN and dragged the operator to its Space. Root cause fixed.
    type: 'panel',
    frame: false,
    transparent: false,
    backgroundColor: '#050607',   // token: void — no white flash on boot (doctrine 11)
    show: false,
    focusable: true,              // panel may become key without activating the app
    acceptFirstMouse: true,       // clicks work without activating first
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,        // NEVER native macOS fullscreen (no separate Space)
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,   // keep the wake listener + audio alive while hidden
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // float above everything, on the active Space (and over other apps' fullscreen)
  win.setAlwaysOnTop(true, OVERLAY_LEVEL);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  win.once('ready-to-show', () => { if (!DIAG) showOverlay(); });

  // resident: closing hides to the tray, it does not quit (only the tray Quit does)
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); hideOverlay(); } });

  // echo renderer [voice] status to the terminal (no devtools needed)
  win.webContents.on('console-message', (...args) => {
    const parts = args.map((a) => (a && typeof a === 'object' && 'message' in a) ? a.message : a);
    const msg = parts.filter((x) => typeof x === 'string').join(' ');
    if (msg.includes('[voice]')) console.log('RENDERER', msg);
  });

  win.loadURL(DEV_URL);
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
async function sendBackdrop() {
  if (!win) return;
  try {
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(disp.size.width / 2), height: Math.round(disp.size.height / 2) },
    });
    const src = sources.find((s) => String(s.display_id) === String(disp.id)) || sources[0];
    win.webContents.send('ui:backdrop', (src && src.thumbnail && !src.thumbnail.isEmpty()) ? src.thumbnail.toDataURL() : null);
  } catch (_) { win.webContents.send('ui:backdrop', null); }
}

function showOverlay() {
  if (!win) return;
  win.setBounds(activeBounds());               // resolve over whatever screen the operator is on
  win.setAlwaysOnTop(true, OVERLAY_LEVEL);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  win.showInactive();                          // NON-ACTIVATING — never .show()+focus (Part 1)
  registerBankEsc();
}
// hide the panel. Because summon never ACTIVATED VULCAN, the app that was frontmost
// stayed frontmost — hiding the panel simply reveals it, focus intact (no app.hide,
// which would itself churn activation).
function hideOverlay() {
  unregisterBankEsc();
  if (win) win.hide();
  diagLog('bank/hide');
}

function summon() { const wasHidden = !win.isVisible(); sendBackdrop(); showOverlay(); if (wasHidden) win.webContents.send('ui:ignite'); diagLog('summon'); }
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
      { label: 'Fire and Forge (Summon)', accelerator: HOTKEY, click: () => summon() },
      { label: 'Bank the Fire', click: () => { if (win.isVisible()) win.webContents.send('ui:bank'); } },
      { type: 'separator' },
      { label: 'Mute Mic (M)', click: () => win.webContents.send('ui:mute') },
      { type: 'separator' },
      { label: 'Quit VULCAN', click: () => { isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => summon());
  } catch (e) { console.log('[ignition] tray unavailable:', e && e.message); }
}

app.whenReady().then(() => {
  registerVoiceIpc();
  registerWireIpc();
  registerQuotesIpc();

  // grant the renderer's getUserMedia(audio) request; the OS TCC prompt fires on
  // first capture. Declining -> renderer shows VOICE OFFLINE, hotkey still summons.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media' || permission === 'audioCapture');
  });

  createWindow();
  buildTray();

  // resident overlay control from the renderer
  ipcMain.on('ui:request-summon', () => summon());       // wake-from-hidden (FINDING 1)
  ipcMain.on('ui:request-show', () => summon());         // legacy alias
  ipcMain.on('ui:request-hide', () => hideOverlay());    // bank complete (FINDING 4)

  // global summon hotkey — fail-soft: if registration is refused (e.g. accessibility
  // denied), the tray item + wake word still summon; nothing hard-fails.
  const ok = globalShortcut.register(HOTKEY, () => toggleOverlay());
  if (!ok) console.log(`[ignition] hotkey ${HOTKEY} unavailable — use the tray or wake word`);

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
