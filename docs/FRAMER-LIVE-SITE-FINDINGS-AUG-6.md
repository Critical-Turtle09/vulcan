# FRAMER — Live-Site Findings (bonsaicitations.com) · 2026-08-06

**Read-only audit. Fetch/render only — no edits were made to the site, the repo, or anywhere.**
Method: each live page loaded headless at **1280** and **375** (`scripts/framer-live-audit.mjs`);
checked for horizontal overflow, console errors, broken in-page anchors, broken same-origin
links, meta/OG/canonical/viewport completeness, and a contrast sample of primary text.

Pages audited: `/`, `/tool.html`, `/guides.html`, `/it.html`, `/privacy.html`, `/schools.html`,
`/terms.html`.

## Verdict

The live site is in good shape: **no console errors, no broken links, no broken anchors, and
complete SEO/social meta on every page.** One real, consistent issue: **a small horizontal
overflow at 375px on every page**, caused by the decorative grove art (and the homepage
ticker) extending past the mobile viewport. It is currently *clipped* by `overflow-x: clip`
(so there is no visible horizontal scrollbar), but the elements do overrun the viewport, which
is a latent fragility and means the grove art is cropped rather than fit on phones.

## Findings

### 1 · Mobile horizontal overflow at 375px — EVERY page · LOW/MEDIUM
- Measured `scrollWidth 399 > innerWidth 375` (≈24px overrun) on all seven pages. At 1280 there
  is no overflow anywhere.
- Widest offenders: `div.tree` / `svg` (the grove scene) on every page; the homepage adds
  `div.tick-track` / `span.tick-seq` (the scrolling ticker/marquee).
- Currently masked by `html, body { overflow-x: clip }` in `site.css` — so **no visible
  horizontal scroll today**. The risk: (a) the grove art is clipped, not composed, on mobile;
  (b) if `overflow-x: clip` is ever removed or overridden, a horizontal scrollbar returns on
  every page at once.
- The homepage ticker overflow is almost certainly **intentional** (a marquee is wider than the
  viewport by design and relies on the clip) — noted so it isn't "fixed" by mistake.

**Suggested fixes (no edits made — proposals only):**
- Constrain the grove layer to the viewport on small screens: clamp the `.grove`/`.tree` SVG
  group to `max-width: 100vw` (or scale/translate the trees inward under a `@media (max-width:
  480px)` rule) so the art *fits* at 375 rather than being cropped by the clip.
- Keep `overflow-x: clip` as the safety net, but treat it as a backstop, not the primary fix —
  the elements themselves should not exceed `100vw`.
- Leave the homepage ticker as-is (intentional marquee); if you want belt-and-suspenders, wrap
  it in an explicit `overflow: hidden` container so its overrun never depends on the global clip.

### 2 · Contrast — PASS (sampled) · with a caveat
- Sampled primary text (h1, lede, first paragraph) on each page: all ≥ **7.7:1** against the
  computed background (h1 white-on-near-black measured 20:1; mint links 15:1). No failures found.
- **Caveat on method:** the sample reads each element's *computed* `background-color`, which for
  text over the grove resolves to the base page black — it does not fully model text sitting on
  the animated grove strokes. The genuine legibility risk there is the *scrim coverage* behind
  bare text, which was the subject of the recent W1 hero-scrim fix; this audit did not re-derive
  per-pixel contrast over the live grove. Recommend keeping the W1 scrim rule as the guarantor
  of text-over-grove contrast rather than relying on this coarse sample.

### 3 · Meta / OG / canonical / viewport — COMPLETE · PASS
- Every page has a non-empty `<title>`, `meta[name=description]`, `og:title`, `og:description`,
  `og:image` (`https://bonsaicitations.com/og.png`), `link[rel=canonical]`, and a responsive
  `viewport`. No gaps found. (Canonicals correctly point at the extensionless URLs, e.g.
  `/it`, `/terms`.)

### 4 · Broken anchors & links — NONE · PASS
- No in-page `#fragment` anchor points to a missing element on any page.
- Every same-origin page link returns 200 (nav, footer, and in-body links all resolve). No
  dead internal links.

### 5 · Console — CLEAN · PASS
- Zero console errors and zero page errors across all seven pages at both widths.

## Punch list (priority order — proposals only, FRAMER never edits/deploys)
1. **[MEDIUM]** Fit the grove art to `100vw` at ≤480px so mobile doesn't overrun (24px) and the
   art isn't cropped; keep `overflow-x: clip` as a backstop.
2. **[LOW]** Wrap the homepage ticker in its own `overflow: hidden` container so its intentional
   overrun doesn't depend on the global clip.
3. **[LOW/INFO]** Keep the W1 hero-scrim as the contrast guarantor for text over the grove;
   don't rely on flat-bg contrast samples.
4. **[INFO]** No meta/anchor/link/console issues to action — these are clean; re-run
   `scripts/framer-live-audit.mjs` after any deploy to keep them that way.

*FRAMER files findings only. No change was made to the Bonsai site or repo. The operator
decides what to apply.*
