// VULCAN v2 CONDUCTOR — SLICE B0: CLI harness.
//   npm run brain -- "query"      → route, model, tokens, cost, day total, answer
//   npm run brain -- --status     → ledger summary + mode
//   npm run brain -- --away        → switch to AWAY (report-only) mode
//   npm run brain -- --present     → switch to PRESENT mode
//   npm run brain -- --test-write  → fire the mock WRITE action
import { conduct } from './conductor.js';
import { status as ledgerStatus } from './governor.js';
import { getMode, setMode, execute } from './constitution.js';

const usd = (n) => `$${Number(n).toFixed(4)}`;

async function main() {
  const args = process.argv.slice(2);
  const flag = args.find((a) => a.startsWith('--'));

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
    process.exit(1);
  }

  const r = await conduct(query);
  console.log(`route:  ${r.route}${r.reason ? ` (${r.reason})` : ''}`);
  console.log(`model:  ${r.model}`);
  if (r.route === 'CLAUDE') {
    console.log(`tokens: in ${r.input_tokens} · out ${r.output_tokens}`);
    console.log(`cost:   ${usd(r.cost_usd)}`);
  }
  console.log(`day:    ${usd(r.day_total_usd)}`);
  console.log('');
  console.log(r.text);
}

main().catch((e) => { console.error('brain error:', e.message); process.exit(1); });
