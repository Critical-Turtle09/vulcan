// P4 METRICS HISTORY — pure daily-snapshot history logic (no I/O, no electron).
// A snapshot is one row per LOCAL day: { date:'YYYY-MM-DD', commits, spendUsd,
// waitlist, deploy }. The store keeps at most MAX_HISTORY days, one row per date,
// sorted oldest→newest, so vitals sparklines can render a REAL multi-day trend
// instead of a fabricated series. Split out here so it's unit-testable without a
// vault or a running app.
export const MAX_HISTORY = 30;

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// Insert or replace today's (or any) row by date, keeping one row per day, sorted,
// capped to the most recent MAX_HISTORY days. The incoming row wins on a date clash.
export function upsertDay(history, row) {
  const h = (Array.isArray(history) ? history : []).filter((r) => r && r.date !== row.date);
  h.push(row);
  h.sort(byDate);
  return h.slice(-MAX_HISTORY);
}

// Add seed rows ONLY for dates not already present — a real backfill (e.g. git
// commits-per-day) never clobbers a recorded live snapshot. Sorted + capped.
export function mergeSeed(history, seedRows) {
  const have = new Set((history || []).map((r) => r && r.date));
  const merged = [...(history || [])];
  for (const s of seedRows || []) if (s && s.date && !have.has(s.date)) merged.push(s);
  merged.sort(byDate);
  return merged.slice(-MAX_HISTORY);
}

// A numeric series for a sparkline: missing/non-numeric days → 0 (an honest baseline,
// never an invented value). Used for commits + spend trends.
export function sparkFrom(history, field) {
  return (history || []).map((r) => { const v = Number(r && r[field]); return Number.isFinite(v) ? v : 0; });
}
