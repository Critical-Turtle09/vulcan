// C1 THE NIGHT WATCHMAN — the mailer. This is the ONLY egress in the whole Watchman, and
// it is fenced on every side:
//   • HARD-SCOPED RECIPIENT.  The To: address is the compile-time constant below. It is
//     NOT read from the contract, NOT from env, NOT from an argument. A caller asking to
//     mail anyone else is refused. The Watchman can wake exactly one person.
//   • MAX 1 SEND / 24h.  A state file records the last real send; inside 24h a send is
//     suppressed (logged, not sent). A failure storm can never become a mail storm.
//   • EVERY ATTEMPT IS LOGGED.  Sent, suppressed, refused, or errored — a line lands in
//     logs/night-watchman.log, always, before anything leaves.
//   • LOG-ONLY BY DEFAULT.  Until an app-specific password exists in the env AND the
//     contract mode is armed, send() never opens a socket — it logs "SUPPRESSED (log-only)".
//
// When armed (mode !== 'log-only' AND VULCAN_SMTP_PASS set) it speaks minimal SMTP over
// implicit TLS to Apple iCloud (smtp.mail.me.com:465, AUTH LOGIN). No third-party deps.
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { LOGS_DIR, ensureLogsDir, appendLog } from './lib.mjs';

// ── the immovable recipient. Change requires editing this line in code, on purpose. ──
export const HARD_TO = 'vishnumovva@icloud.com';

const STATE_FILE = path.join(LOGS_DIR, '.watchman-mail-state.json');
const SMTP_HOST = 'smtp.mail.me.com';
const SMTP_PORT = 465;                       // implicit TLS
const DAY_MS = 24 * 60 * 60 * 1000;

function readState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function writeState(s) { ensureLogsDir(); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// send(...) — the guarded entry point. Returns { status, reason }. status is one of
// 'sent' | 'suppressed' | 'refused' | 'error'. `nowMs`/`iso` are injected so behaviour is
// testable with a fake clock; `force` bypasses ONLY the 24h cap (the morning live-fire).
export async function send({ to = HARD_TO, subject, body, mode = 'log-only', nowMs = Date.now(), iso = new Date().toISOString(), force = false } = {}) {
  // 1) recipient fence — non-negotiable.
  if (to !== HARD_TO) {
    appendLog(iso, `[MAIL] REFUSED — recipient "${to}" is not the hard-scoped address`);
    return { status: 'refused', reason: 'recipient not allowed' };
  }
  // 2) rate limit (unless a forced live-fire test).
  const state = readState();
  if (!force && state.lastSentMs && (nowMs - state.lastSentMs) < DAY_MS) {
    const hrs = ((DAY_MS - (nowMs - state.lastSentMs)) / 3600000).toFixed(1);
    appendLog(iso, `[MAIL] SUPPRESSED (1/24h cap) — subject="${subject}" — next send in ~${hrs}h`);
    return { status: 'suppressed', reason: 'within 24h cap' };
  }
  // 3) log-only / no credential → never open a socket.
  const pass = process.env.VULCAN_SMTP_PASS;
  const user = process.env.VULCAN_SMTP_USER || HARD_TO;
  if (mode === 'log-only' || !pass) {
    const why = mode === 'log-only' ? 'log-only mode' : 'no VULCAN_SMTP_PASS';
    appendLog(iso, `[MAIL] SUPPRESSED (${why}) — would send to ${to}: "${subject}"`);
    return { status: 'suppressed', reason: why };
  }
  // 4) armed — actually send.
  try {
    await smtpSend({ user, pass, to, subject, body, iso });
    writeState({ ...state, lastSentMs: nowMs, lastSentIso: iso, lastSubject: subject });
    appendLog(iso, `[MAIL] SENT to ${to}: "${subject}"`);
    return { status: 'sent', reason: 'delivered to smtp' };
  } catch (e) {
    appendLog(iso, `[MAIL] ERROR sending to ${to}: ${e.message}`);
    return { status: 'error', reason: e.message };
  }
}

// minimal SMTP-over-implicit-TLS (AUTH LOGIN). Enough for iCloud; not a general client.
function smtpSend({ user, pass, to, subject, body, iso }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(SMTP_PORT, SMTP_HOST, { servername: SMTP_HOST }, () => {});
    socket.setEncoding('utf8');
    socket.setTimeout(20000, () => { socket.destroy(); reject(new Error('smtp timeout')); });
    let buf = '';
    const steps = [
      { expect: 220, cmd: `EHLO vulcan.local\r\n` },
      { expect: 250, cmd: `AUTH LOGIN\r\n` },
      { expect: 334, cmd: `${Buffer.from(user).toString('base64')}\r\n` },
      { expect: 334, cmd: `${Buffer.from(pass).toString('base64')}\r\n` },
      { expect: 235, cmd: `MAIL FROM:<${user}>\r\n` },
      { expect: 250, cmd: `RCPT TO:<${to}>\r\n` },
      { expect: 250, cmd: `DATA\r\n` },
      { expect: 354, cmd: message({ user, to, subject, body, iso }) },
      { expect: 250, cmd: `QUIT\r\n` },
    ];
    let i = 0;
    socket.on('data', (chunk) => {
      buf += chunk;
      // an SMTP reply may be multi-line: "NNN-..." continuation lines then a terminal
      // "NNN " (space after the code). Only act once the terminal line has arrived.
      let code = null;
      for (const ln of buf.split(/\r?\n/)) {
        const m = ln.match(/^(\d{3})([ -])/);
        if (m && m[2] === ' ') code = parseInt(m[1], 10);    // terminal line → this is the reply code
      }
      if (code === null) return;                             // reply not complete yet
      const step = steps[i];
      if (code !== step.expect) { socket.destroy(); return reject(new Error(`SMTP ${step.cmd.split('\r')[0]} → ${buf.trim()}`)); }
      buf = '';
      i++;
      if (i < steps.length) socket.write(steps[i - 1].cmd); // send the command paired with the reply we just accepted
      if (i === steps.length) { socket.end(); resolve(); }
    });
    socket.on('error', reject);
  });
}

function message({ user, to, subject, body, iso }) {
  const dot = String(body || '').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');   // dot-stuffing
  return [
    `From: VULCAN Night Watchman <${user}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date(iso).toUTCString()}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    dot,
    `.`,
    ``,
  ].join('\r\n');
}
