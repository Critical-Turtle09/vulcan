// VULCAN v2 CONDUCTOR — SLICE B0: the $2/day governor.
// A hard daily spend cap backed by a ledger at ~/.vulcan/ledger.json (OUTSIDE
// the repo). Resets automatically when the local date rolls over.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const VULCAN_DIR = path.join(os.homedir(), '.vulcan');
export const LEDGER = path.join(VULCAN_DIR, 'ledger.json');
export const DAILY_CAP_USD = 2.0;

// USD per MILLION tokens { input, output }.
// Source: https://docs.claude.com/en/docs/about-claude/pricing — Haiku 4.5
// $1/$5, Sonnet 4.6 $3/$15, Opus 4.8 $5/$25. Cross-checked against the
// claude-api skill model table (2026-07-06). Authoritative, not estimates.
export const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5':          { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6':         { input: 3.0, output: 15.0 },
  'claude-opus-4-8':           { input: 5.0, output: 25.0 },
};

function ensureDir() {
  try { fs.mkdirSync(VULCAN_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

// Local (not UTC) calendar day — the cap is a human-facing daily budget.
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Read the ledger, transparently resetting it when the local date has changed.
export function readLedger() {
  ensureDir();
  let led = null;
  try { led = JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (_) { /* fresh */ }
  const day = today();
  if (!led || led.date !== day) led = { date: day, calls: [], total_usd: 0, tts_chars: 0 };
  if (typeof led.tts_chars !== 'number') led.tts_chars = 0;   // backfill pre-SLICE-V ledgers
  return led;
}

function writeLedger(led) {
  ensureDir();
  try { fs.writeFileSync(LEDGER, JSON.stringify(led, null, 2)); } catch (_) { /* ignore */ }
}

function priceFor(model) {
  return PRICING[model] || PRICING['claude-sonnet-4-6'];
}

export function costOf(model, inTok, outTok) {
  const p = priceFor(model);
  return (inTok / 1e6) * p.input + (outTok / 1e6) * p.output;
}

// Pre-call estimate — worst-case, treat the whole budget as output tokens
// (the pricier side) so allow() never green-lights a call that could breach.
function estCost(model, estTokens) {
  return (estTokens / 1e6) * priceFor(model).output;
}

// Would a call fit under the cap? false once the projected total ≥ $2.00.
export function allow(model, estTokens = 1500) {
  const led = readLedger();
  return led.total_usd + estCost(model, estTokens) < DAILY_CAP_USD;
}

// Record an actual spend against the ledger. Returns { usd, total_usd }.
export function charge(model, inTok, outTok) {
  const led = readLedger();
  const usd = costOf(model, inTok, outTok);
  led.calls.push({ t: new Date().toISOString(), model, in: inTok, out: outTok, usd });
  led.total_usd = Number((led.total_usd + usd).toFixed(6));
  writeLedger(led);
  return { usd, total_usd: led.total_usd };
}

export function status() {
  const led = readLedger();
  return {
    date: led.date,
    calls: led.calls.length,
    total_usd: led.total_usd,
    remaining_usd: Number((DAILY_CAP_USD - led.total_usd).toFixed(6)),
    cap_usd: DAILY_CAP_USD,
    tts_chars: led.tts_chars || 0,
  };
}

// --- SLICE V: THE VOICE — TTS character meter (same daily ledger) -------------
// Cloud TTS (ElevenLabs) is the only metered tier; local voice (kokoro/say) and
// cache replays cost nothing and are never metered. The count resets with the day
// via readLedger's rollover, exactly like the $ cap.

// Record cloud TTS characters against today's ledger. Returns the new daily total.
export function meterTts(chars) {
  const led = readLedger();
  led.tts_chars = (led.tts_chars || 0) + Math.max(0, Math.floor(chars) || 0);
  writeLedger(led);
  return led.tts_chars;
}

// Characters spoken via cloud TTS so far today.
export function ttsCharsToday() {
  return readLedger().tts_chars || 0;
}

// Test/drill helper: plant today's tts_chars (e.g. at the cap) without touching
// the $ spend. Returns the planted total.
export function setTtsChars(chars) {
  const led = readLedger();
  led.tts_chars = Math.max(0, Math.floor(chars) || 0);
  writeLedger(led);
  return led.tts_chars;
}
