// The BRAIN — intentionally hollow for ORGAN 1. A later organ drops a real
// model in behind this exact interface: `respond(transcript) -> Promise<string>`.
// Keeping it async now means the swap to a networked model needs no caller change.
export function createBrain() {
  const CANNED = 'Online. Supply chain nominal.';
  return {
    // transcript is ignored by the stub; a real brain will use it.
    async respond(_transcript) {
      return CANNED;
    },
  };
}
