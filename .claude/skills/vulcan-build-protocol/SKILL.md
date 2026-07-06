---
name: vulcan-build-protocol
description: How to build any VULCAN slice/organ to spec — the non-negotiable working rules, the §7 acceptance tests, doctrine 11 (fluidity), tokens-never-hardcode, and the screenshot-audit + commit cadence. Use whenever adding or changing anything in the VULCAN interface.
---

# VULCAN build protocol

Read `CLAUDE.md` first (the locked DESIGN SPEC v1.3 "FORGE AMENDMENT" + doctrines).
This skill encodes the working rules that repo history establishes.

## Non-negotiable rules

1. **Never one-shot the interface.** Build in slices; screenshot-audit each before moving on.
2. **Screenshot your own work.** After any UI change: dev server → Playwright screenshot →
   critique against the spec → iterate. This machine takes its own screenshots.
3. **Tokens, never hardcode.** Every color/duration/easing/size lives in `tokens.json`
   (→ CSS vars + Three.js uniforms). Regenerate `TOKENS.md` with `npm run tokens`.
   A hardcoded literal in a component is a build-failing bug.
4. **Real data or labeled SIM.** Never silently fake numbers. Non-live values are marked SIM.
   Every organ is **fail-soft** (missing key/feed → a labeled OFFLINE/LOCAL state).
5. **Shader weight, not DOM tweens.** Motion comes from the GPU. DOM tweens are allowed
   ONLY on panel/HUD *text*, never on anything that reads as part of the world.
6. **Commit early and often**; push after every meaningful unit; keep the repo pushed.

## Doctrine 11 — nothing arrives instantly

Every click, query, summon, or reveal answers with a fluid transition in the house
material. Text *resolves* per-glyph; outgoing and incoming states cross-flow; **a hard
cut or pop-in anywhere is a build-failing bug.** Fluidity comes from material continuity,
never slowness — the terminal still feels instant.

## §7 acceptance test (run per slice)

1. **Briefing-scene** — could this frame be an insert shot in a modern briefing film?
2. **Ink audit** — point to any mark, name the datum it encodes. No decorative marks.
3. **Tokens audit** — zero hardcoded visual values.
4. **Fluidity audit** — trigger every state change; anything that appears/vanishes without
   a material transition fails. Measure with `npm run audit` (maxStep < 0.5 per transition).

## The house palette (discipline)

Greyscale world · bone-white data (`data.bone`, never pure #FFF) · one scarce **molten**
heat (`signal.molten`/`forge`). On summoned scenes molten is the working data ink; heat
events distinguish by intensity + motion. Ambient orb-home keeps ≤2% heat pixels. Equity
quotes stay greyscale (heat is never price).

## Cadence

Build → self-audit (§7, Playwright-measured) → commit + push → raw `git log`/`git status`
→ next slice. If a part fails twice, ship what passes, write it up, move on — never leave
the repo unpushed.
