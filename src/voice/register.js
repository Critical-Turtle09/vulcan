// P5 THE VOICE PASS — the E.V. REGISTER loader. Reads voice-register.json and hands
// back fixed spoken lines by key, with {var} interpolation. One source of truth for
// everything VULCAN says on its own initiative, so the register rules (short, second
// person, answer-first, one-breath) are enforced in ONE place, not scattered as string
// literals. An unknown key returns a safe empty string rather than throwing — a missing
// line must never dead-end a spoken path (the never-silent law lives above this).
import register from '../../voice-register.json' with { type: 'json' };

const LINES = (register && register.lines) || {};

// line('hold', { verb: 'Deploy' }) → "Deploy leaves the machine. Say confirm…"
export function line(key, vars) {
  let s = LINES[key];
  if (s == null) return '';
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
    }
  }
  return s;
}

export function hasLine(key) { return Object.prototype.hasOwnProperty.call(LINES, key); }

export default { line, hasLine };
