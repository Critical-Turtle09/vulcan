// VULCAN v2 CONDUCTOR — SLICE B4: HANDS III — THE WIRE, SPOKEN. VULCAN's third hand.
// "Brief me" turns the live feeds into a composed intelligence briefing: the SAME
// shared fetcher the renderer's heat organ uses (brain/wire-fetch.js — no forked
// fetcher), synthesized ONCE through the brain, presented as blueprint panels,
// spoken in VULCAN 1.
//
//   READ — wire.brief      recency-ranked, deduped, prefers items UNSEEN since the
//          last brief (~/.vulcan/wire-seen.json). ONE governor-metered SYNTH call
//          composes the spoken briefing; per-story rows are built locally. If every
//          current item was already briefed → one-line recap, zero Claude.
//   READ — wire.headlines  zero-Claude variant — titles only, locally composed, $0.
//
// FAIL-SOFT: banked / no-key / offline / over-cap → wire.brief silently DEGRADES to
// locally-composed headlines, tagged [REFLEX], zero charge, ledger untouched. A
// feed that is down is dropped and named in the panel chrome; the brief composes
// from whatever remains. Nothing crashes; nothing is faked.
//
// Every action returns { title, lines[], body?, speak, reflex?, degraded?, cost_usd? }
// — structured for a [SKILL·WIRE] blueprint panel (briefing body + per-story rows)
// plus the spoken briefing text.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../env.js';
import { loadTokens } from '../tokens.js';
import { pollFeeds } from '../wire-fetch.js';
import { ask, hasKey, MODEL_POLICY } from '../client.js';
import { allow, charge, status as ledgerStatus, VULCAN_DIR } from '../governor.js';

// ---- behaviour caps (module consts, mirroring the obsidian skill's convention) --
const STORIES = 5;              // top stories carried into a briefing / panel
const HEADLINES = 6;            // rows in a zero-Claude headlines panel
const WORDS_MIN = 120;          // spoken-briefing target band (terse command voice)
const WORDS_MAX = 180;
const SEEN_CAP = 240;           // titles retained in the seen ledger (oldest dropped)
const SEEN_FILE = path.join(VULCAN_DIR, 'wire-seen.json');

// ---- active-profile feeds (domain-blind — the engine never hardcodes a domain) --
// Read the merged token tree for profile.default, then that profile's wire block.
// tokens.local.json may override the active profile without touching the tree.
function activeWire() {
  const tk = loadTokens();
  const id = (tk.profile && tk.profile.default) || 'semiconductor';
  let prof = {};
  try { prof = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles', `${id}.json`), 'utf8')); } catch (_) { /* no profile → empty */ }
  const wire = prof.wire || {};
  return { id, feeds: wire.feeds || [] };
}

// ---- helpers -------------------------------------------------------------------
const clip = (s, n) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
// strip Google-News' trailing " - Publisher" suffix so a title reads clean
const cleanTitle = (t) => String(t).replace(/\s+-\s+[^-]{2,40}$/, '').trim();

function ago(ts) {
  if (!ts) return 'RECENT';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'JUST NOW';
  const m = s / 60; if (m < 60) return `${Math.round(m)}M AGO`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}H AGO`;
  return `${Math.round(h / 24)}D AGO`;
}

// dedupe by clean title, rank by recency (ts desc; unknown ts sinks to the end)
function rank(items) {
  const byTitle = new Map();
  for (const it of items) {
    const key = cleanTitle(it.title).toLowerCase();
    if (!key) continue;
    const prev = byTitle.get(key);
    if (!prev || (it.ts || 0) > (prev.ts || 0)) byTitle.set(key, it);
  }
  return [...byTitle.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

const storyRow = (it) => `${String(it.feed).toUpperCase()} · ${ago(it.ts)} · ${clip(cleanTitle(it.title), 52)}`;

// ---- the seen ledger (~/.vulcan/wire-seen.json) --------------------------------
// { titles: { "<clean lower title>": <iso> }, lastBriefAt, lastRecap }. Titles briefed
// so a repeat brief prefers what's new (or reports there's nothing new).
function readSeen() {
  try { const j = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); if (j && typeof j === 'object') return { titles: j.titles || {}, lastBriefAt: j.lastBriefAt || null, lastRecap: j.lastRecap || '' }; }
  catch (_) { /* fresh */ }
  return { titles: {}, lastBriefAt: null, lastRecap: '' };
}
function writeSeen(state) {
  try {
    fs.mkdirSync(VULCAN_DIR, { recursive: true });
    // bound the ledger — keep the most recent SEEN_CAP titles by timestamp
    const entries = Object.entries(state.titles || {}).sort((a, b) => String(b[1]).localeCompare(String(a[1]))).slice(0, SEEN_CAP);
    fs.writeFileSync(SEEN_FILE, JSON.stringify({ titles: Object.fromEntries(entries), lastBriefAt: state.lastBriefAt, lastRecap: state.lastRecap }, null, 2));
  } catch (_) { /* best-effort — a brief still succeeds if the ledger can't be written */ }
}
const seenKey = (it) => cleanTitle(it.title).toLowerCase();
function markSeen(state, items) {
  const iso = new Date().toISOString();
  for (const it of items) state.titles[seenKey(it)] = iso;
  state.lastBriefAt = iso;
}

// ---- the SYNTH briefing --------------------------------------------------------
// B5R MISSION PURITY — mission-neutral command voice (the semiconductor persona is
// struck). The mission name rides in from tokens so the wire brief speaks for the
// active launch, not a hardcoded domain.
function missionName() {
  try { const tk = loadTokens(); return (tk.mission && tk.mission.name) || ''; } catch (_) { return ''; }
}
function briefSystem() {
  const m = missionName();
  const forWhom = m ? `for the ${m} launch` : 'for the operator';
  return `You are VULCAN, the command-center intelligence ${forWhom}, delivering a spoken `
    + `wire briefing. SYNTHESIZE the supplied stories into ONE terse briefing of ${WORDS_MIN}-${WORDS_MAX} `
    + 'words in a flat command-center voice. Lead with what matters most to the launch. Connect '
    + 'related stories; do not just list headlines. Plain spoken prose only — no markdown, no '
    + 'bullet points, no headings, no preamble ("here is"), no sign-off. State only what the '
    + 'stories support; never invent facts, numbers, or sources.';
}

// Trim spoken prose to a hard upper word band WITHOUT a second model call — keep whole
// sentences up to the cap, fall back to a hard word cut. Shared shape with mission.js.
export function clampWords(text, max) {
  const t = String(text || '').trim();
  const words = t.split(/\s+/);
  if (words.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  let out = '', n = 0;
  for (const s of sentences) {
    const w = s.trim().split(/\s+/).length;
    if (n && n + w > max) break;
    out += (out ? ' ' : '') + s.trim(); n += w;
    if (n >= max) break;
  }
  return out || `${words.slice(0, max).join(' ')}…`;
}

function briefPrompt(items) {
  const lines = items.map((it, i) => `${i + 1}. [${it.feed}${it.ts ? ` · ${ago(it.ts).toLowerCase()}` : ''}] ${cleanTitle(it.title)}`);
  return `Wire stories to brief (most recent first):\n${lines.join('\n')}\n\nCompose the spoken briefing now.`;
}

// first sentence of the briefing, clipped — the one-line recap a repeat brief speaks
function firstSentence(text) {
  const m = String(text).trim().match(/^.*?[.!?](\s|$)/);
  return clip(m ? m[0] : String(text), 140);
}

// ---- READ actions --------------------------------------------------------------
// Locally-composed headlines — titles only, zero Claude, always $0. Reused as the
// degrade target for wire.brief and reachable directly ("headlines").
async function headlines(detail = {}) {
  const { feeds } = activeWire();
  if (!feeds.length) return { title: 'WIRE · HEADLINES', lines: ['NO FEEDS CONFIGURED'], speak: 'No wire feeds are configured for this profile.', reflex: !!detail.reflex };
  const res = await pollFeeds(feeds);
  if (!res.ok) return { title: 'WIRE · HEADLINES', lines: ['WIRE OFFLINE', ...(res.down || []).slice(0, 4).map((d) => `DOWN · ${String(d).toUpperCase()}`)], speak: 'The wire is offline — no feeds reachable right now.', reflex: !!detail.reflex, degraded: true };
  const top = rank(res.items).slice(0, HEADLINES);
  const degraded = (res.down || []).length > 0;
  const lines = top.map(storyRow);
  if (degraded) lines.push(`FEEDS DOWN · ${res.down.map((d) => String(d).toUpperCase()).join(', ')}`);
  const spoken = `Wire headlines. ${top.slice(0, 4).map((it) => cleanTitle(it.title)).join('. ')}.`;
  return { title: 'WIRE · HEADLINES', lines, body: undefined, speak: spoken, reflex: !!detail.reflex, degraded, cost_usd: 0 };
}

// The spoken intelligence briefing — ONE metered SYNTH call over the freshest unseen
// stories. Degrades to headlines [REFLEX] whenever the brain can't or shouldn't run.
async function brief() {
  const { feeds } = activeWire();
  if (!feeds.length) return { title: 'WIRE · BRIEFING', lines: ['NO FEEDS CONFIGURED'], speak: 'No wire feeds are configured for this profile.' };

  const res = await pollFeeds(feeds);
  if (!res.ok) return headlines({ reflex: true });   // wire offline → local headlines, tagged

  const ranked = rank(res.items);
  const seen = readSeen();
  const unseen = ranked.filter((it) => !seen.titles[seenKey(it)]);

  // Nothing new since the last brief → one-line recap, ZERO Claude, ledger untouched.
  if (!unseen.length) {
    const when = seen.lastBriefAt ? ago(Date.parse(seen.lastBriefAt)).toLowerCase() : 'earlier';
    const recap = seen.lastRecap ? ` Last brief: ${seen.lastRecap}` : '';
    const top = ranked.slice(0, HEADLINES).map(storyRow);
    return {
      title: 'WIRE · BRIEFING',
      lines: ['NOTHING NEW SINCE LAST BRIEF', ...top],
      body: `Nothing new on the wire since your last brief (${when}).${recap}`,
      speak: `Nothing new on the wire since your last brief, ${when}.${recap}`,
      cost_usd: 0,
    };
  }

  const stories = unseen.slice(0, STORIES);
  const model = MODEL_POLICY.SYNTH;

  // brain banked (no key / over the $ cap) → local headlines, tagged [REFLEX], $0.
  if (!hasKey() || !allow(model)) return headlines({ reflex: true });

  const r = await ask({ model, system: briefSystem(), prompt: briefPrompt(stories), maxTokens: 360 });
  if (r.banked || !r.text) return headlines({ reflex: true });   // API failure → degrade, no charge

  const { usd } = charge(r.model, r.input_tokens, r.output_tokens);
  const briefing = clampWords(r.text.trim(), WORDS_MAX);   // rider: hold the 120-180 band

  // record what we briefed so the next brief prefers what's new
  markSeen(seen, stories);
  seen.lastRecap = firstSentence(briefing);
  writeSeen(seen);

  const degraded = (res.down || []).length > 0;
  const lines = stories.map(storyRow);
  if (degraded) lines.push(`FEEDS DOWN · ${res.down.map((d) => String(d).toUpperCase()).join(', ')}`);

  return {
    title: 'WIRE · BRIEFING',
    lines,                 // per-story hairline rows (source · age · title)
    body: briefing,        // the composed briefing (panel body)
    speak: briefing,       // spoken in VULCAN 1 — dynamic, so metered, never cached-hit
    degraded,
    cost_usd: usd,
  };
}

// ---- skill definition ----------------------------------------------------------
export default {
  id: 'wire',
  actions: {
    'wire.brief': { klass: 'READ', run: brief },
    'wire.headlines': { klass: 'READ', run: headlines },
  },
  // Deterministic router — briefing prefixes first; "headlines" maps straight to the
  // zero-Claude variant. All READs — nothing to confirm. Lexicon is disjoint from
  // repo (git/tag) and vault (note/capture), so first-hit match is unambiguous.
  route(text) {
    const t = ` ${String(text).toLowerCase().trim()} `;
    const has = (re) => re.test(t);
    if (has(/\bheadlines?\b/)) return { action: 'wire.headlines', detail: {} };
    if (has(/\bbrief me\b/) || has(/\bbriefing\b/) || has(/\bmorning brief\b/)
        || has(/\bwhat'?s on the wire\b/) || has(/\bon the wire\b/)
        || (has(/\bbrief\b/) && has(/\b(me|wire|forge|news|intel)\b/))
        || has(/\bthe news\b/) || has(/\bany news\b/) || has(/\bnews\b/)) {
      return { action: 'wire.brief', detail: {} };
    }
    return null;
  },
};
