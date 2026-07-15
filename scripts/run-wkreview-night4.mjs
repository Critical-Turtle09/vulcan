// I7 — run the REAL weekly-review + vault-clean skills over the campaign week and file
// their artifacts to the vault (headless, no app). WK REVIEW rolls up the last 7 days of
// commit history + the vault trail; VAULT CLEAN re-indexes VULCAN/BONSAI/index.md. Both
// go through the same dispatch path the app uses (constitution + ledger in the loop),
// so nothing is faked and nothing leaves the machine. Prints the filed artifact paths.
import { dispatch } from '../brain/dispatch.js';

const out = {};
for (const cmd of ['WK REVIEW', 'VAULT CLEAN']) {
  const r = await dispatch(cmd);
  out[cmd] = {
    ok: r.ok, route: r.route, title: r.title,
    speak: r.speak, artifact: r.artifact ? r.artifact.rel : null,
    lines: r.lines,
  };
}
console.log(JSON.stringify(out, null, 2));
process.exit(0);
