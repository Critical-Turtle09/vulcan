// RL-6 — headless probe of the EXACT sendBackdrop capture logic (main.js) in an
// Electron context, to prove: ONE source for the active display, captured at native
// resolution (scaleFactor), encoded as a single JPEG whose aspect matches the screen.
// Run: node_modules/.bin/electron scripts/backdrop-probe.cjs
const { app, screen, desktopCapturer } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const scale = disp.scaleFactor || 1;
    const want = { width: Math.round(disp.size.width * scale), height: Math.round(disp.size.height * scale) };
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: want });
    const forThisDisplay = sources.filter((s) => String(s.display_id) === String(disp.id));
    const src = forThisDisplay[0] || sources[0];
    const out = { screenSources: sources.length, matchingActiveDisplay: forThisDisplay.length, requested: want,
      display: { id: disp.id, size: disp.size, scaleFactor: scale }, aspectScreen: +(disp.size.width / disp.size.height).toFixed(4) };
    if (src && src.thumbnail && !src.thumbnail.isEmpty()) {
      const size = src.thumbnail.getSize();
      const jpeg = src.thumbnail.toJPEG(85);
      out.thumb = { w: size.width, h: size.height, aspect: +(size.width / size.height).toFixed(4), jpegBytes: jpeg ? jpeg.length : 0 };
      out.nativeResolution = Math.abs(size.width - want.width) <= 2;
      out.aspectMatchesScreen = Math.abs(out.thumb.aspect - out.aspectScreen) < 0.02;
      out.singleCapture = true;
      out.verdict = (out.nativeResolution && out.aspectMatchesScreen && out.thumb.jpegBytes > 0)
        ? 'PASS: one native-resolution JPEG of the active display, aspect matches screen' : 'FAIL';
    } else {
      out.verdict = 'NO-PERMISSION: thumbnail empty (grant this Electron binary Screen Recording)';
    }
    console.log('PROBE ' + JSON.stringify(out));
  } catch (e) { console.log('PROBE ERROR ' + (e && e.message)); }
  app.quit();
});
