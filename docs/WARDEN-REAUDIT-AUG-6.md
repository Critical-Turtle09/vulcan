# WARDEN — Bonsai Extension Re-Audit · 2026-08-06

**Read-only compliance/permissions audit of `/Users/vishnumovva/bonsai` (manifest v3.0.0)**
against the public zero-collection claims at bonsaicitations.com/it and COPPA/FERPA posture for
student use. Nothing was modified, executed, or run. Filed as a WARDEN findings draft.

## 1 · Posture verdict

**CONSISTENT WITH ZERO-COLLECTION POSTURE** — the extension as built performs no network
requests, transmits no data, and holds no host permissions. One nuance (a `window.open` to
Google Docs) is a user-initiated *browser* navigation, not an extension network call, and does
not undermine the claim in substance — though the *wording* "makes zero network requests"
deserves a one-line tightening (§3–4).

## 2 · Permission-by-permission

| Permission | Usage found | Minimal? | Note |
|---|---|---|---|
| `storage` | `src/storage/storage.js` — `chrome.storage.local` get/set only | Yes | Uses `.local`, never `.sync` (correct — `.sync` would push data through the user's Google/Chrome-sync account). |
| `activeTab` | `popup.js:442-444` — `chrome.tabs.query({active,currentWindow})` then inject, wired to the "Cite This Page" click | Yes | Textbook least-privilege: click-gated, no persistent `tabs` permission, cannot enumerate/read tabs the user didn't invoke on. |
| `scripting` | `popup.js:444-447` — one-shot inject returning `outerHTML` + `location.href`; no `content_scripts` | Yes | On-demand single call scoped to the `activeTab` grant, not a standing content script. |

**Confirmed ABSENT** (all zero matches in the manifest): `host_permissions`, `tabs`, `cookies`,
`webRequest`, `history`, `externally_connectable`, `content_scripts`, and `background`/service
worker. No `<all_urls>`, no ambient page access outside a click, no cross-extension surface. The
extension cannot observe the student's browsing outside the exact moment "Cite This Page" is
pressed. Strong positive signal.

## 3 · Network surface

- **No `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon`** anywhere in `popup.js` or
  `src/` (direct grep, clean). Independently reproduces `PRE-SUBMIT-AUDIT.md` §4's zero-network check.
- All `https://` literals accounted for and benign: the Web Store URL (clipboard only, never
  fetched); `doi.org` strings are citation *output text*; an XML namespace URI in the generated
  `.doc` template (static markup); and the Google Docs `window.open` (below).
- **The Google Docs button (`popup.js:257-268`):** `window.open("https://docs.google.com/
  document/create", "_blank", "noopener")` inside a click handler. This is a user-initiated
  *browser* navigation, not a request from extension code — Bonsai sends Google nothing (no
  `host_permissions`, no fetch); the only local action is a clipboard write of the student's own
  header text before the tab opens. Functionally identical to a normal `<a target="_blank">`.

## 4 · Discrepancies / risks (most severe first)

1. **[LOW] Wording gap, not architecture gap** — "the Chrome extension makes zero network
   requests" is true of extension *code*, but one button opens an external Google service via
   `window.open`. Not a data-collection violation; a literal-reading IT/COPPA reviewer could
   still flag the gap between the absolute claim and the observed UX. `PRIVACY.md` doesn't
   mention this button.
2. **[LOW] `PRIVACY.md` feature-disclosure gap** — its permission list matches the manifest
   word-for-word (verified), but it's silent on the "Open Google Docs + copy header" flow and
   the local clipboard write (not a data risk; a disclosure gap).
3. **[INFO] No standalone COPPA/FERPA artifact** — only `PRIVACY.md` and `PRE-SUBMIT-AUDIT.md`
   exist; no document explicitly maps the architecture to COPPA "operator"/"personal
   information" or FERPA "education record" definitions. The zero-collection architecture is the
   correct technical posture; there just isn't a legal-mapping artifact. Absence noted, not papered over.
4. **[INFO] `chrome.storage.local`** is per-profile, unencrypted, uninstall-clearable — matches
   what `PRIVACY.md` promises ("remove entries / clear a format / remove the extension").

## 5 · Punch list (findings only — WARDEN never edits)

1. **(cheap)** Add one sentence to `PRIVACY.md` describing the Google Docs button: copies your
   header to the clipboard and opens a new Google Docs tab so you can paste — Bonsai sends Google
   no data; same as clicking a link. Closes §4.1.
2. **(cheap)** Optionally soften the public claim to "the extension's *code* makes zero network
   requests; one button opens Google Docs in a new tab at your request," or add the same
   disclosure on `/it` so a literal read needs no reverse-engineering.
3. **(nice to have)** A short standalone `COMPLIANCE.md` mapping the architecture to COPPA/FERPA
   by name would pre-empt district-IT legal questions. Not required by anything broken.
4. **(maintain)** Keep the `PRE-SUBMIT-AUDIT.md` zero-network grep in the release process — it's
   doing its job (this audit got the same clean result).

## Awaiting operator
- Messaging/disclosure decision on the Google Docs button wording (no code change needed to be
  compliant — the architecture is already sound).
- Whether to produce a standalone COPPA/FERPA artifact, or treat `PRIVACY.md` + this audit as
  sufficient.

*Files read: `manifest.json`, `popup.js`, `popup.html`, `PRIVACY.md`, `PRE-SUBMIT-AUDIT.md`,
`src/storage/storage.js`, and grep sweeps across `src/**`. No files were modified.*
