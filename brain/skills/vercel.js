// VULCAN v2 CONDUCTOR — SLICE B5R: THE DEPLOY EYE — a READ-ONLY Vercel hand.
// Reports the launch's deployment health. NO write ops — deploys stay human.
//
//   READ — vercel.status   latest prod deployment (state · age · url) via `npx vercel`
//          + a direct HTTP health-check of the prod URL. No token/project →
//          { connected:false } + a one-line fix hint; NEVER crashes the brief.
//
// The token (VULCAN_VERCEL_TOKEN) is read from .env, passed to the CLI as the
// VERCEL_TOKEN env var (so it never lands in argv / a process listing), and is
// NEVER logged, echoed, or committed. Everything is fail-soft: any error → a
// not-connected/degraded result, not an exception.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadEnv } from '../env.js';
import { loadTokens } from '../tokens.js';

const run = promisify(execFile);

function ago(ts) {
  if (!ts) return 'RECENT';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'JUST NOW';
  const m = s / 60; if (m < 60) return `${Math.round(m)}M AGO`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}H AGO`;
  return `${Math.round(h / 24)}D AGO`;
}
const short = (u) => String(u || '').replace(/^https?:\/\//, '');

// Direct HTTP health-check of a prod URL. Returns { code, ok } fail-soft.
async function health(url) {
  if (!url) return { code: 0, ok: false };
  const u = /^https?:\/\//.test(url) ? url : `https://${url}`;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'VULCAN/1.0 (+forge)' }, signal: ctrl.signal });
    clearTimeout(to);
    return { code: res.status, ok: res.ok, url: u };
  } catch (_) { return { code: 0, ok: false, url: u }; }
}

// The READ. connected=false when there's no token or no project — with a one-line
// fix hint. When connected, best-effort `vercel ls` for the latest deployment plus a
// health-check; any CLI failure degrades to the health-check alone (still useful).
export async function status() {
  loadEnv();
  const tk = loadTokens();
  const mission = tk.mission || {};
  const project = String(mission.vercel_project || '').trim();
  const token = String(process.env.VULCAN_VERCEL_TOKEN || '').trim();

  if (!token || !project) {
    const need = (!token && !project) ? 'VULCAN_VERCEL_TOKEN (.env) + mission.vercel_project'
      : !token ? 'VULCAN_VERCEL_TOKEN in .env' : 'mission.vercel_project in tokens.local.json';
    return {
      connected: false,
      title: 'DEPLOY · VERCEL',
      lines: ['NOT CONNECTED', `SET · ${need}`],
      speak: 'Deploy: not connected.',
      hint: `Set ${need}.`,
      cost_usd: 0,
    };
  }

  // Connected — best-effort, fail-soft. Token rides in via env, never argv.
  const env = { ...process.env, VERCEL_TOKEN: token };
  let latest = null;
  try {
    const { stdout } = await run('npx', ['--yes', 'vercel', 'ls', project, '--yes'], { timeout: 25000, env });
    // grab the first deployment URL from the listing; state/age are best-effort.
    const urlMatch = stdout.match(/https?:\/\/[^\s]+\.vercel\.app/);
    const stateMatch = stdout.match(/\b(Ready|Error|Building|Queued|Canceled)\b/i);
    if (urlMatch) latest = { url: urlMatch[0], state: (stateMatch ? stateMatch[1] : 'UNKNOWN').toUpperCase() };
  } catch (_) { /* CLI unavailable / auth failure — degrade to the health check */ }

  const prodUrl = (latest && latest.url) || `https://${project}.vercel.app`;
  const h = await health(prodUrl);
  const lines = [];
  if (latest) lines.push(`STATE · ${latest.state}`, `URL · ${short(latest.url)}`);
  else lines.push('CLI · UNAVAILABLE (health-check only)', `URL · ${short(prodUrl)}`);
  lines.push(`HEALTH · ${h.code ? `HTTP ${h.code}${h.ok ? '' : ' · DOWN'}` : 'UNREACHABLE'}`);

  const stateWord = latest ? latest.state.toLowerCase() : (h.ok ? 'reachable' : 'unreachable');
  return {
    connected: true,
    title: 'DEPLOY · VERCEL',
    lines,
    speak: `Deploy ${stateWord}${h.code ? `, prod HTTP ${h.code}` : ''}.`,
    health: h,
    latest,
    cost_usd: 0,
  };
}

// ---- skill definition (routable directly: "deploy status" / "vercel status") ----
export default {
  id: 'vercel',
  actions: {
    'vercel.status': { klass: 'READ', run: status },
  },
  route(text) {
    const t = ` ${String(text).toLowerCase().trim()} `;
    const has = (re) => re.test(t);
    if (has(/\b(deploy|deployment|vercel|prod|production|is it (up|live|deployed))\b/)
        && has(/\b(status|state|health|up|live|deployed|ok|working|standing)\b/)) {
      return { action: 'vercel.status', detail: {} };
    }
    if (has(/\bvercel\b/) || has(/\bdeploy status\b/) || has(/\bdeployment status\b/)) return { action: 'vercel.status', detail: {} };
    return null;
  },
};
