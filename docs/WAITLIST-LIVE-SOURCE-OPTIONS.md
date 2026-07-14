# WAITLIST — LIVE SOURCE OPTIONS

> Three realistic ways to wire a live waitlist count into VULCAN's Z1 vitals card, evaluated for setup effort, cost, and COPPA/FERPA posture. VULCAN only ever reads locally — it hosts nothing that leaves the machine.

## Option 1 — Hosted form → spreadsheet export, VULCAN polls a local export

**What it is:** A Google Form (or Tally/Fillout) collects email + optional name. Responses land in a connected Google Sheet or the form service's own response table.

**How VULCAN reads it:** No live API call needed for the simplest version — export the sheet as CSV on a schedule (manual click, or Google's "publish to web as CSV" URL) and drop it in a watched local folder, or write a tiny script that hits the Sheets API (read-only, scoped to one sheet) and writes `waitlist-count.json` locally. VULCAN's existing vitals-card poll just reads that JSON — same shape as the current MANUAL entry, just machine-updated.

**Setup effort:** Low. Form takes minutes; the CSV-export path needs zero code. The Sheets-API path needs a one-time read-only service account (~30 min).

**Monthly cost:** Free tier covers this easily (Google Forms/Sheets is free; Tally free tier is generous too).

**Privacy / COPPA-FERPA posture:** Strong, if the form asks for email only. Google Forms/Sheets is a mainstream, well-understood data processor; still worth a one-line disclosure on the signup form itself ("we store your email only, no other data"). No PII beyond email touches VULCAN — it only ever sees a count.

## Option 2 — Hosted form service with webhook → local JSON, VULCAN polls

**What it is:** A form service (Tally, Fillout, or similar) fires a webhook on each new submission. A very small local listener (a tiny script running on the same Mac, or a scheduled poll of the form service's own count API if it has one) increments/writes a local `waitlist-count.json`.

**How VULCAN reads it:** Same as Option 1's end state — VULCAN polls a local JSON file. The difference is the count updates near-real-time via webhook push instead of a manual/scheduled export pull.

**Setup effort:** Medium. Needs a small always-on local receiver (or a lightweight serverless function purely to catch the webhook and write back to a location VULCAN can read, e.g. a tiny Vercel function that appends to a JSON blob VULCAN fetches read-only). More moving parts than Option 1; more brittle if the webhook receiver goes down silently.

**Monthly cost:** Likely free tier (Tally/Fillout free tiers include webhooks; a tiny serverless function is within free hosting-tier limits at this volume).

**Privacy / COPPA-FERPA posture:** Same posture as Option 1 (email-only collection) but with one more hop — the webhook payload — that should be scoped to "email + timestamp" only, nothing else, to keep the surface minimal.

## Option 3 — Minimal self-hosted signup endpoint, operator-controlled end-to-end

**What it is:** A tiny serverless function (e.g. a Vercel Edge/API route living alongside the existing Bonsai marketing site) accepts email submissions from the site's own signup form and writes them to a small store — flat file, SQLite, or a minimal KV store (Vercel KV / Upstash free tier).

**How VULCAN reads it:** VULCAN polls a read-only count endpoint the operator controls (e.g. `GET /api/waitlist-count` returning just `{ "count": N }` — no emails, no PII in the response). This keeps the constitution intact: VULCAN reads a number over a connection it already trusts (the operator's own Vercel deploy), never touches raw signup data.

**Setup effort:** High relative to the others — it's real code: an endpoint, a store, basic abuse/rate-limit handling, and keeping it maintained. Reuses infra the operator already has (Vercel), which lowers the lift somewhat.

**Monthly cost:** Likely free tier at launch volume (Vercel + a small KV/DB free tier), but this is the option most likely to grow a bill if signups scale — flagged as an estimate, not a quote.

**Privacy / COPPA-FERPA posture:** Best possible — the operator owns the entire pipeline, decides exactly what's stored (recommend: email only, no names, no IPs logged), and can delete data on request trivially. No third-party form vendor in the loop at all. Best fit for the "minimal/no student-data collection" constraint, at the cost of being the most work to build and maintain.

## Recommendation

Start with **Option 1** (Google Form/Sheet, CSV or read-only Sheets API pull) — it ships today, costs nothing, keeps the data surface to "email only," and gets VULCAN off MANUAL entry immediately; upgrade to Option 3 later only if the operator wants full data ownership and the volume justifies the build.

---
Held draft — operator decides; nothing wired yet.
