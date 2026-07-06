// Electron shell — RESIDENT overlay (STAGE D). VULCAN launches at login, shows the
// orb-home command center, and hides to a menu-bar (tray) item instead of quitting.
// The wake listener + audio keep running while hidden (backgroundThrottling off),
// so "Fire and Forge" from anywhere summons the always-on-top overlay; the global
// hotkey (Alt+Space) is the fail-soft manual summon if the mic/permission is denied.
// Esc banks the fire (renderer runs the reverse transition, then asks to hide).
import { app, BrowserWindow, Tray, Menu, session, systemPreferences, globalShortcut, ipcMain, nativeImage } from 'electron';
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

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    backgroundColor: '#050607',   // token: void — no white flash on boot (doctrine 11)
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,   // keep the wake listener + audio alive while hidden
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenScreen: true });
  win.once('ready-to-show', () => showOverlay());

  // resident: closing hides to the tray, it does not quit (only the tray Quit does)
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win.hide(); } });

  // echo renderer [voice] status to the terminal (no devtools needed)
  win.webContents.on('console-message', (...args) => {
    const parts = args.map((a) => (a && typeof a === 'object' && 'message' in a) ? a.message : a);
    const msg = parts.filter((x) => typeof x === 'string').join(' ');
    if (msg.includes('[voice]')) console.log('RENDERER', msg);
  });

  win.loadURL(DEV_URL);
}

function showOverlay() {
  if (!win) return;
  win.show();
  if (process.platform === 'darwin') { try { app.focus({ steal: true }); } catch (_) {} }
  win.focus();
}
function summon() { const wasHidden = !win.isVisible(); showOverlay(); if (wasHidden) win.webContents.send('ui:ignite'); }
function toggleOverlay() {
  if (win.isVisible()) win.webContents.send('ui:bank');   // renderer banks, then requestHide
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

  // resident overlay control from the renderer (wake-from-hidden / bank-complete)
  ipcMain.on('ui:request-show', () => summon());
  ipcMain.on('ui:request-hide', () => { if (win) win.hide(); });

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
