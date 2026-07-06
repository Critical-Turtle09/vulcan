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
import { app, BrowserWindow, Tray, Menu, screen, session, systemPreferences, globalShortcut, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
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

// the display the operator is actually on right now (cursor's screen)
function activeBounds() {
  try { return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds; }
  catch (_) { return screen.getPrimaryDisplay().bounds; }
}

function createWindow() {
  const b = activeBounds();
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false,
    transparent: false,
    backgroundColor: '#050607',   // token: void — no white flash on boot (doctrine 11)
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,        // FINDING 3 — NEVER native macOS fullscreen (no separate Space)
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
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  win.once('ready-to-show', () => showOverlay());

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

function showOverlay() {
  if (!win) return;
  win.setBounds(activeBounds());               // resolve over whatever screen the operator is on
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  win.show();                                  // shows on the CURRENT Space (not native fullscreen)
  registerBankEsc();
}
function hideOverlay() { unregisterBankEsc(); if (win) win.hide(); }

function summon() { const wasHidden = !win.isVisible(); showOverlay(); if (wasHidden) win.webContents.send('ui:ignite'); }
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

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else showOverlay(); });
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
// resident: never quit just because the window hid/closed (only the tray Quit does)
app.on('window-all-closed', () => { /* stay resident */ });
