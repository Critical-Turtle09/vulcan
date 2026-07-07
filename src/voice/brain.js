// THE BRAIN (renderer side) — B1 SYNAPSE. A thin client onto the main-process
// conductor: respond(transcript) -> Promise<result>, where result is the shape
// the conductor returns: { text, route, model, cost_usd, day_total_usd, reason }.
// The renderer never sees the key or the ledger — only the rendered result.
// Fail-soft: without the bridge (e.g. the vite dev server, no Electron) it
// returns a canned REFLEX result so the loop still completes visibly.
export function createBrain({ bridge } = {}) {
  const CANNED = { text: 'Online. Supply chain nominal.', route: 'REFLEX', reason: 'NO_BRIDGE', model: 'stub', cost_usd: 0 };
  return {
    async respond(transcript) {
      if (bridge && bridge.conduct) {
        try {
          const r = await bridge.conduct(transcript);
          if (r && typeof r.text === 'string') return r;
        } catch (_) { /* fall through to canned */ }
      }
      return CANNED;
    },
    // B2 HANDS — resolve a pending WRITE_CONFIRM with the operator's spoken
    // decision ('confirm' | 'cancel'). Returns the final skill result.
    async confirm(answer, decision) {
      if (bridge && bridge.confirm && answer) {
        try {
          const r = await bridge.confirm({ skill: answer.skill, action: answer.action, detail: answer.detail, decision });
          if (r && typeof r.text === 'string') return r;
        } catch (_) { /* fall through */ }
      }
      return { text: 'Cancelled.', route: 'SKILL', aborted: true, panel: { title: 'REPO · TAG', lines: ['CANCELLED'] } };
    },
  };
}
