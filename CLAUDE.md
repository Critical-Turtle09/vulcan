# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VULCAN — Silicon Forge Intelligence. A Jarvis-style GPU/semiconductor supply-chain terminal. It runs
full-screen on a Mac mini, summoned at login or by wake word. Sibling project to Hermes.

**Current state: pre-code.** The repository is empty. The project is in Phase 1 (DESIGN),
awaiting operator references to lock the spec. No UI code is written until the design spec
below is filled in. There is no build/lint/test tooling yet — it arrives with Phase 2.

## Phases

1. **DESIGN** — lock spec from operator references (palette, type, motion physics).
   STATUS: awaiting references. No UI code until the spec is locked.
2. **BUILD** — Electron + WebGL front end, built against the spec, slice by slice.
3. **ORGANS** — live quotes, RSS→Claude wire pipeline, whisper.cpp ears, ElevenLabs voice,
   cron autonomy.

## Working rules (non-negotiable)

- **Never one-shot the interface.** Build in slices: core orb → rings → panels. Get operator
  sign-off on each slice before moving to the next.
- **Screenshot your own work.** After any UI change: run the dev server, screenshot the
  rendering via Playwright, critique it against the spec, iterate. This machine takes its own
  screenshots — never ask the operator for one.
- **Check current APIs before coding.** Use context7 for up-to-date Three.js / GSAP / Electron
  APIs before writing against them; training data may be stale.
- **Real data or labeled SIM.** Never silently fake numbers. Anything not live is marked SIM.
- **Tokens, never hardcode.** All visual properties (colors, glows, type, spacing, motion
  curves) live in a single design-token layer — themes swappable via config, never hardcoded
  in components. The interface must support restyling from operator-provided references
  without structural rewrites.
- **Commit early and often.**

## Design bar / operator taste

The bar is Territory Studio / FUI grade. Everything moves, but with **shader weight, not DOM
animation**. Motion comes from the GPU (WebGL/shaders), not CSS tweens.

Explicitly rejected (from v0, "2002 video game"):
- CSS-tween feel
- stock sci-fi fonts
- dashed circles

## Design spec

(placeholder — the locked spec gets pasted here. Until it exists, do not write UI code.)
