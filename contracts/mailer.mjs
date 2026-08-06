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
import net from 'node:net';
import tls from 'node:tls';
import { LOGS_DIR, ensureLogsDir, appendLog } from './lib.mjs';

// ── the immovable recipient. Change requires editing this line in code, on purpose. ──
export const HARD_TO = 'vishnumovva@icloud.com';

const STATE_FILE = path.join(LOGS_DIR, '.watchman-mail-state.json');
const SMTP_HOST = process.env.VULCAN_SMTP_HOST || 'smtp.mail.me.com';
// iCloud's implicit-TLS :465 was unreachable from here (times out); :587 STARTTLS is open
// and is Apple's recommended submission port. Default to 587/STARTTLS; :465 → implicit TLS.
const SMTP_PORT = Number(process.env.VULCAN_SMTP_PORT) || 587;
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

// minimal SMTP submission (AUTH LOGIN). Enough for iCloud; not a general client. Uses
// STARTTLS on 587 by default (iCloud's implicit-TLS :465 was unreachable here); on :465
// it opens implicit TLS instead. A request/reply reader that handles multi-line replies
// ("NNN-…" continuations then a terminal "NNN "), and re-checks the buffer whenever a new
// expectation is set so a reply already in the buffer isn't missed.
function smtpSend({ user, pass, to, subject, body, iso }) {
  const implicit = SMTP_PORT === 465;
  return new Promise((resolve, reject) => {
    let socket = implicit
      ? tls.connect(SMTP_PORT, SMTP_HOST, { servername: SMTP_HOST })
      : net.connect(SMTP_PORT, SMTP_HOST);
    let buf = '', pending = null, done = false;
    const fail = (e) => { if (done) return; done = true; try { socket.destroy(); } catch { /* */ } reject(e instanceof Error ? e : new Error(String(e))); };
    const tryDeliver = () => {
      if (!pending) return;
      let code = null;
      for (const ln of buf.split(/\r?\n/)) { const m = ln.match(/^(\d{3})([ -])/); if (m && m[2] === ' ') code = parseInt(m[1], 10); }
      if (code === null) return;                              // reply not complete yet
      const text = buf.trim(); buf = '';
      const p = pending; pending = null;
      if (code !== p.expect) return fail(new Error(`SMTP ${p.label} → ${text}`));
      p.resolve(code);
    };
    const onData = (chunk) => { buf += chunk; tryDeliver(); };
    const attach = (s) => { s.setEncoding('utf8'); s.on('data', onData); s.on('error', fail); s.setTimeout(20000, () => fail(new Error('smtp timeout'))); };
    const expect = (code, label) => new Promise((res) => { pending = { expect: code, resolve: res, label }; tryDeliver(); });
    const write = (s) => socket.write(s);
    attach(socket);
    (async () => {
      try {
        await expect(220, 'greet');
        write('EHLO vulcan.local\r\n'); await expect(250, 'EHLO');
        if (!implicit) {                                      // STARTTLS upgrade on 587
          write('STARTTLS\r\n'); await expect(220, 'STARTTLS');
          socket.removeListener('data', onData);
          const secure = tls.connect({ socket, servername: SMTP_HOST });
          socket = secure; attach(secure);
          await new Promise((r, j) => { secure.once('secureConnect', r); secure.once('error', j); });
          write('EHLO vulcan.local\r\n'); await expect(250, 'EHLO(tls)');
        }
        write('AUTH LOGIN\r\n'); await expect(334, 'AUTH LOGIN');
        write(`${Buffer.from(user).toString('base64')}\r\n`); await expect(334, 'auth-user');
        write(`${Buffer.from(pass).toString('base64')}\r\n`); await expect(235, 'auth-pass');
        write(`MAIL FROM:<${user}>\r\n`); await expect(250, 'MAIL FROM');
        write(`RCPT TO:<${to}>\r\n`); await expect(250, 'RCPT TO');
        write('DATA\r\n'); await expect(354, 'DATA');
        write(message({ user, to, subject, body, iso })); await expect(250, 'message');
        try { write('QUIT\r\n'); socket.end(); } catch { /* delivered; QUIT is courtesy */ }
        if (!done) { done = true; resolve(); }
      } catch (e) { fail(e); }
    })();
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
