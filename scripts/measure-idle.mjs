// P6 IDLE EFFICIENCY — measurement harness. The window is BANKED (hidden) throughout; we
// toggle only the render loop and measure, in short stable rounds, the state P6 changes:
//   BANKED + loop RUNNING  = the pre-P6 behavior (backgroundThrottling off → 60fps while banked)
//   BANKED + loop PAUSED   = the P6 behavior (loop + polls stopped while banked)
// We alternate the two states across several rounds so stability is visible (no single racy
// long window). fps is the app's own frame counter; CPU/mem via Electron app.getAppMetrics.
import { _electron as electron } from 'playwright';

const WIN = 1500, ROUNDS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rm = (metrics) => {
  const tab = metrics.find((m) => m.type === 'Tab') || metrics.find((m) => m.type === 'renderer');
  const gpu = metrics.find((m) => m.type === 'GPU');
  return { cpu: tab ? tab.cpu.percentCPUUsage : null, mem: tab ? +(tab.memory.workingSetSize / 1024).toFixed(0) : null, gpu: gpu ? gpu.cpu.percentCPUUsage : null };
};

async function round(app, win, wantRunning) {
  await win.evaluate((run) => run ? window.__vulcanStage.resumeIdle() : window.__vulcanStage.pauseIdle(), wantRunning);
  await sleep(400);
  const f0 = await win.evaluate(() => window.__vulcanStage.perf().frames);
  const cpu = [], gpu = []; let mem = null;
  const t0 = Date.now();
  while (Date.now() - t0 < WIN) { await sleep(300); const m = rm(await app.evaluate(({ app }) => app.getAppMetrics())); if (m.cpu != null) cpu.push(m.cpu); if (m.gpu != null) gpu.push(m.gpu); mem = m.mem ?? mem; }
  const el = (Date.now() - t0) / 1000;
  const f1 = await win.evaluate(() => window.__vulcanStage.perf().frames);
  const st = await win.evaluate(() => window.__vulcanStage.perf());
  const avg = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null);
  return { state: wantRunning ? 'RUNNING' : 'PAUSED', paused: st.paused, polling: st.polling, fps: +((f1 - f0) / el).toFixed(1), cpuPct: avg(cpu), gpuPct: avg(gpu), memMB: mem };
}

(async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, VULCAN_VOICE_TEST: '1' } });
  const win = await app.firstWindow();
  await win.waitForFunction(() => !!window.__vulcanStage?.perf, null, { timeout: 20000 });
  await sleep(2500);   // let the boot watchdog race settle; window stays banked/hidden
  const rows = [];
  for (let i = 0; i < ROUNDS; i++) { rows.push(await round(app, win, true)); rows.push(await round(app, win, false)); }
  const summarize = (label, pred) => { const g = rows.filter(pred); const nums = (k) => g.map((r) => r[k]).filter((x) => x != null); const mean = (a) => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null; return { label, fps: mean(nums('fps')), cpuPct: mean(nums('cpuPct')), gpuPct: mean(nums('gpuPct')), memMB: mean(nums('memMB')) }; };
  console.log(JSON.stringify({
    rounds: rows,
    summary: [summarize('BANKED loop RUNNING (pre-P6)', (r) => r.state === 'RUNNING' && !r.paused), summarize('BANKED loop PAUSED (P6)', (r) => r.state === 'PAUSED' && r.paused)],
  }, null, 2));
  await app.close();
})().catch((e) => { console.error('MEASURE FAILED:', e.message); process.exit(1); });
