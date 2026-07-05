// Electron shell — full-screen, chromeless, kiosk-style. VULCAN owns the whole
// display (Mac mini at login/wake). The renderer is the Vite dev server during
// build so it hot-reloads as slices land; production will load the built bundle.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.VULCAN_DEV_URL || 'http://localhost:5273';

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    backgroundColor: '#050607', // token: void — no white flash on boot (doctrine 11)
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(DEV_URL);

  // Esc to exit full-screen review
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'Escape') app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
