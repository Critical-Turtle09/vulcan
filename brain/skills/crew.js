// VULCAN v2 CONDUCTOR — FRONT I: THE CREW (skill-side hands).
// The crew (.claude/agents/{hermes,framer,warden,smith}.md) are Claude Code
// subagents used at the development layer. This skill is their RUNTIME hand inside
// the brain: the deterministic, $0-local actions VULCAN itself can run for a crew
// intent, each producing a REAL artifact filed to the vault (VULCAN/BONSAI/outputs/,
// via dispatch's ONE Obsidian hand). It never sends, pushes, deploys, or invents.
//
// CONSTITUTION (absolute): every action here is a READ or a contained DRAFT/WRITE.
// Nothing leaves the machine. A draft filed to the local vault is not "sending" —
// anything that WOULD leave (send an email, push, deploy) stops at the write gate
// and is HELD for the operator. Banned words never appear in drafts:
// AI-powered, revolutionary, seamlessly, leverage.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

// ---- HERMES · outreach.draft --------------------------------------------------
// Three school-pilot email templates, composed LOCALLY ($0, no SYNTH, deterministic).
// DRAFTS ONLY: no recipient addresses, no sending. The operator fills [brackets] and
// sends from their own client — that is their key, their call, their write gate.
const HELD_BANNER = '> **HELD — DRAFTS, NOT SENT.** HERMES drafts; the operator sends. '
  + 'No addresses are filled and nothing has left the machine.';

function outreachDrafts() {
  const body = [
    '# HERMES — School-Pilot Outreach Drafts',
    '',
    HELD_BANNER,
    '',
    'Three cold-email templates for the Bonsai Instant Citation school pilot. Each is'
      + ' under ~150 words, with a subject line and a `[recipient — fill in]` placeholder.'
      + ' Personalize the `[brackets]`, then send from your own client.',
    '',
    '---',
    '',
    '## 1 · School librarian',
    '',
    '**Subject:** A citation tool for [School] students — nothing to FERPA-review',
    '',
    'Hi [Name],',
    '',
    "I built Bonsai, a browser citation tool for students — MLA, APA, Chicago, and IEEE"
      + " in a couple of clicks, right while they're reading a source.",
    '',
    'The part I think you\'ll care about: no student accounts, no network requests. Every'
      + ' citation is built on the student\'s own device, so there\'s no data collected and'
      + ' nothing to put through a privacy review.',
    '',
    'It force-installs through Google Admin in an afternoon. I\'d love to set up a free'
      + ' 60-day pilot for [School] — one call with your IT, then it\'s live for your students.',
    '',
    'Worth a 20-minute look?',
    '',
    'Thanks, [Your name]',
    '',
    '---',
    '',
    '## 2 · English / writing department head',
    '',
    '**Subject:** Fewer mangled Works Cited pages in [School] papers',
    '',
    'Hi [Name],',
    '',
    "Quick one from a student who got tired of clunky citation sites. Bonsai gives"
      + ' students a correct MLA / APA / Chicago / IEEE citation in a couple of clicks, with'
      + ' the in-text version right beside it.',
    '',
    'It lives in the browser, so students cite the page they\'re actually reading instead'
      + ' of retyping details into a form. No accounts, no ads, nothing collected.',
    '',
    'I can turn it on for every student at [School] through your IT in one afternoon, free'
      + ' for 60 days. A citation video course for your team lands this fall.',
    '',
    'Could I show you what a student sees? 15 minutes.',
    '',
    'Best, [Your name]',
    '',
    '---',
    '',
    '## 3 · Charter-network academic director',
    '',
    '**Subject:** One citation tool across all [Network] campuses',
    '',
    'Hi [Name],',
    '',
    'Bonsai is a browser citation tool for students (MLA, APA, Chicago, IEEE). For a'
      + ' network with central IT it\'s a strong fit: one Google Admin force-install push'
      + ' covers every campus at once.',
    '',
    'Pricing is public and flat by enrollment — no per-seat math, no quote-request maze.'
      + ' It collects zero student data (no accounts, no network requests), so it clears'
      + ' privacy review fast across all your schools at once.',
    '',
    'I\'d like to run a free 60-day pilot on one or two campuses, then show you the usage'
      + ' before you commit network-wide. Open to a short call?',
    '',
    'Thanks, [Your name]',
    '',
    '---',
    '',
    '### To actually send',
    'These are drafts. Fill each `[bracket]`, confirm the recipient yourself, and send'
      + ' from your own email. VULCAN does not send, and holds anything that would leave'
      + ' the machine until you say go.',
    '',
    '*Drafted by HERMES · Front I · THE CREW.*',
  ].join('\n');

  return {
    title: 'HERMES · OUTREACH DRAFTS',
    lines: [
      'CREW · HERMES',
      'DRAFTS · 3 (LIBRARIAN · ENGLISH HEAD · CHARTER DIRECTOR)',
      'HELD — NOT SENT · NO ADDRESSES · UNDER ~150 WORDS EACH',
    ],
    body,
    speak: 'Hermes drafted three school-pilot emails — librarian, English head, and charter'
      + ' director. They are held as drafts in the vault; nothing was sent.',
    cost_usd: 0,
    route: 'DRAFT',
  };
}

// ---- skill definition ---------------------------------------------------------
export default {
  id: 'crew',
  actions: {
    'crew.outreach': { klass: 'READ', run: outreachDrafts },
  },
  // Deterministic router — crew intents. Disjoint from mission's "outreach board" /
  // "pitch desk" (those read the pipeline; these DRAFT). The OUTREACH deck command
  // dispatches the phrase "outreach draft" (see dispatch.js), which lands here.
  route(text) {
    const t = ` ${String(text).toLowerCase().trim()} `;
    if (/\b(outreach draft|draft outreach|draft (the )?outreach|pilot email|pilot emails|draft (the )?pilot|write (the )?outreach|outreach email)\b/.test(t)) {
      return { action: 'crew.outreach', detail: {} };
    }
    return null;
  },
};
