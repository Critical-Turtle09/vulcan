// VULCAN v2 CONDUCTOR — SLICE B0: CLI harness.
//   npm run brain -- "query"      → route, model, tokens, cost, day total, answer
//   npm run brain -- --status     → ledger summary + mode
//   npm run brain -- --away        → switch to AWAY (report-only) mode
//   npm run brain -- --present     → switch to PRESENT mode
//   npm run brain -- --test-write  → fire the mock WRITE action
//   npm run brain -- "repo cmd"    → skill panel (B2). Add --confirm / --cancel
//                                    to decide a WRITE_CONFIRM; --tag=NAME to name
//                                    the tag explicitly.
import { conduct } from './conductor.js';
import { status as ledgerStatus } from './governor.js';
import { getMode, setMode, execute } from './constitution.js';

const usd = (n) => `$${Number(n).toFixed(4)}`;

async function main() {
  const args = process.argv.slice(2);
  const flag = args.find((a) => a.startsWith('--') && a !== '--confirm' && a !== '--cancel' && !a.startsWith('--tag') && !a.startsWith('--file'));
  // B2 — WRITE_CONFIRM decision + explicit tag name for the skill path
  const confirm = args.includes('--confirm') ? 'confirm' : args.includes('--cancel') ? 'cancel' : null;
  const tagArg = args.find((a) => a.startsWith('--tag='));
  const tag = tagArg ? tagArg.slice('--tag='.length) : null;
  // B3 — explicit capture target (drives the vault containment drill)
  const fileArg = args.find((a) => a.startsWith('--file='));
  const file = fileArg ? fileArg.slice('--file='.length) : null;

  if (flag === '--status') {
    const s = ledgerStatus();
    console.log('VULCAN BRAINSTEM — STATUS');
    console.log(`  mode:       ${getMode()}`);
    console.log(`  date:       ${s.date}`);
    console.log(`  calls:      ${s.calls}`);
    console.log(`  spent:      ${usd(s.total_usd)} / ${usd(s.cap_usd)}`);
    console.log(`  remaining:  ${usd(s.remaining_usd)}`);
    return;
  }

  if (flag === '--away' || flag === '--present') {
    const mode = setMode(flag === '--away' ? 'AWAY' : 'PRESENT');
    console.log(`mode → ${mode}`);
    return;
  }

  if (flag === '--test-write') {
    const detail = { note: 'B0 away-queue drill', at: new Date().toISOString() };
    const out = await execute('test.write', detail);
    if (out.queued) console.log(`[AWAY] test.write queued (not executed) → ${out.report}`);
    else if (out.ran) console.log('[PRESENT] test.write executed:', JSON.stringify(out.result));
    return;
  }

  const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!query) {
    console.log('usage: npm run brain -- "your query"');
    console.log('       npm run brain -- --status | --away | --present | --test-write');
    console.log('       npm run brain -- "repo status" | "what changed" | "tag the forge" [--confirm|--cancel] [--tag=NAME]');
    process.exit(1);
  }

  const r = await conduct(query, { confirm, tag, file });
  const mark = r.reason ? ` (${r.reason})` : r.needsConfirm ? ' (CONFIRM?)' : r.queued ? ' (QUEUED)' : r.confirmed ? ' (CONFIRMED)' : r.aborted ? ' (ABORTED)' : '';
  console.log(`route:  ${r.route}${mark}`);
  console.log(`model:  ${r.model || (r.skill ? `skill:${r.skill}` : '—')}`);
  if (r.route === 'CLAUDE') {
    console.log(`tokens: in ${r.input_tokens} · out ${r.output_tokens}`);
    console.log(`cost:   ${usd(r.cost_usd)}`);
  }
  console.log(`day:    ${usd(r.day_total_usd)}`);
  console.log('');
  if (r.panel && (r.panel.title || (r.panel.lines || []).length)) {
    if (r.panel.title) console.log(r.panel.title);
    for (const line of (r.panel.lines || [])) console.log(`  ${line}`);
    console.log('');
  }
  console.log(r.text);
}

main().catch((e) => { console.error('brain error:', e.message); process.exit(1); });
