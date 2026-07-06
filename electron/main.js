// Electron shell — full-screen, chromeless, kiosk-style. VULCAN owns the whole
// display (Mac mini at login/wake). The renderer is the Vite dev server during
// build so it hot-reloads as slices land; production will load the built bundle.
import { app, BrowserWindow, session, systemPreferences } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, registerVoiceIpc } from './voice-main.js';
import { registerWireIpc } from './wire-main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
loadEnv(ROOT);                 // .env -> process.env before anything reads keys
// index.html IS the VULCAN home (orb-home, v1.2). Root serves it, and Vite's
// dev fallback also lands here — no stale target can resurface the Slice 0 test
// (that now lives at /dev/material-test.html). Override with VULCAN_DEV_URL.
const DEV_URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273/';

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    backgroundColor: '#050607', // token: void — no white flash on boot (doctrine 11)
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.once('ready-to-show', () => win.show());

  // echo the renderer's [voice] status lines to the terminal so we can confirm
  // what the HUD shows without a devtools window
  win.webContents.on('console-message', (...args) => {
    const parts = args.map((a) => (a && typeof a === 'object' && 'message' in a) ? a.message : a);
    const msg = parts.filter((x) => typeof x === 'string').join(' ');
    if (msg.includes('[voice]')) console.log('RENDERER', msg);
  });

  win.loadURL(DEV_URL);

  // Esc to exit full-screen review
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'Escape') app.quit();
  });
}

app.whenReady().then(() => {
  registerVoiceIpc();
  registerWireIpc();

  // grant the renderer's getUserMedia(audio) request; the OS-level TCC prompt
  // fires on first capture. Declining -> renderer shows VOICE OFFLINE, keys work.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media' || permission === 'audioCapture');
  });

  createWindow();               // create first — never block the window on a prompt

  // proactively trigger the macOS mic permission dialog, fire-and-forget
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
