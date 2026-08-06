// P5 THE VOICE PASS — the SPEECH SANITIZER. One pure function: turn any string that
// might carry markup, symbols, paths, or machine punctuation into something the mouth
// can say cleanly. VULCAN must never voice a backtick, a slash-path, a markdown star,
// or read "slash" and "dot m d" aloud. Filenames become plain phrases (the EXACT name
// still shows on screen — the transcript/chip render the original, only the spoken copy
// is cleaned). Numbers are humanized ($ → dollars, % → percent, thousands-commas dropped
// so the TTS doesn't spell digits). Prosody punctuation (. , ? ! ' " ; : ( ) -) is kept.
//
// Conservative by design: it strips the KNOWN unspeakable classes and leaves letters and
// sentence punctuation alone, so running it over already-clean prose is a near no-op.

// a path/filename token: has a slash, OR ends in a known doc/code extension.
const EXTS = 'md|json|js|mjs|cjs|txt|html|css|png|jpe?g|pdf|csv|log|sh|yml|yaml|ts|tsx';
const FILE_RE = new RegExp(`(?:[\\w./~-]*/)?[\\w.-]+\\.(?:${EXTS})\\b`, 'gi');
const BARE_PATH_RE = /(?:[A-Za-z0-9_~.-]+\/){2,}[A-Za-z0-9_~.-]+/g;   // a/b/c… (≥3 segments)
const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;

// a filename → a plain phrase: drop the directory + extension, split camel/kebab/snake.
function fileToPhrase(token) {
  let base = String(token).split('/').pop() || token;
  base = base.replace(new RegExp(`\\.(?:${EXTS})$`, 'i'), '');    // drop extension
  base = base.replace(/[._-]+/g, ' ');                            // separators → spaces
  base = base.replace(/([a-z])([A-Z])/g, '$1 $2');               // camelCase → words
  return base.trim().toLowerCase();
}

// a URL → "host dot tld", path dropped (never spell a query string).
function urlToPhrase(u) {
  const m = String(u).match(/^https?:\/\/([^/\s]+)/i);
  const host = (m ? m[1] : u).replace(/^www\./i, '');
  return host.replace(/\./g, ' dot ');
}

// $12.50 → "12 dollars 50 cents" (or "12 dollars"); $2 → "2 dollars". Bare, safe.
function moneyToWords(_m, sign, whole, cents) {
  const w = whole.replace(/,/g, '');
  if (cents && Number(cents) > 0) return `${sign || ''}${w} dollars ${Number(cents)} cents`;
  return `${sign || ''}${w} dollars`;
}

export function sanitizeForSpeech(input) {
  let s = String(input == null ? '' : input);

  // 1) fenced code blocks → drop entirely (never read code aloud).
  s = s.replace(/```[\s\S]*?```/g, ' ');
  // 2) markdown links / images: [text](url) → text ; ![alt](url) → alt.
  s = s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 3) URLs → spoken host.
  s = s.replace(URL_RE, (u) => urlToPhrase(u));
  // 4) paths + filenames → plain phrases (files first — they carry the extension).
  s = s.replace(FILE_RE, (t) => fileToPhrase(t));
  s = s.replace(BARE_PATH_RE, (t) => t.split('/').filter(Boolean).join(' '));
  // 5) inline code + emphasis markers: keep the words, drop the markers.
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/(\*\*|__)(.+?)\1/g, '$2');
  s = s.replace(/(\*|_)(?=\S)(.+?)(?<=\S)\1/g, '$2');
  // 6) leading block markers at line starts: #, >, -, *, digits) / bullets.
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  s = s.replace(/^\s{0,3}>\s?/gm, '');
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, '');
  // 7) humanize money + percent BEFORE stripping the symbols.
  s = s.replace(/(\$)?\$(\d[\d,]*)(?:\.(\d{2}))?/g, moneyToWords);   // $ (with optional stray leading $)
  s = s.replace(/(\d(?:[\d,]*\d)?)\s?%/g, (_m, n) => `${n.replace(/,/g, '')} percent`);
  // 8) thousands separators inside plain numbers → dropped (TTS reads them whole).
  s = s.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (n) => n.replace(/,/g, ''));
  // 9) strip the remaining unspeakable symbol classes; keep . , ? ! ' " ; : ( ) - and &.
  s = s.replace(/[*_`#>|<^{}[\]\\/=+~]/g, ' ');
  s = s.replace(/&/g, ' and ');
  // 10) collapse whitespace + tidy spaced-out punctuation.
  s = s.replace(/\s+([.,?!;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return s;
}

export default sanitizeForSpeech;
