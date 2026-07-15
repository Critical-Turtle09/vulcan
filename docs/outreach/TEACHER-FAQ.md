# Bonsai — Teacher FAQ

> **HELD — DRAFT, NOT SENT/PUBLISHED.** Written by HERMES for the operator to review before it
> goes anywhere (staff site, Classroom post, printed handout). Nothing here has been posted.

Plain answers to the questions a teacher would actually ask before telling their class about
this.

---

**What is Bonsai?**
A free browser extension that builds a correct citation — MLA, APA, Chicago, or IEEE — in a
couple of clicks, right from the page a student is reading. It hands back both the in-text
citation and the full Works Cited / References entry.

**Which citation styles does it support?**
MLA, APA, Chicago, and IEEE.

**Does it cost anything?**
No. It's free for the 60-day pilot. After that, pricing is flat and public, based on school
enrollment — there's no per-student or per-teacher charge, and no ads inside the tool.

**Do students need to make an account?**
No. There's no sign-in, no username, no password. A student installs the extension and it just
works on the page in front of them.

**Is any student data collected?**
No. Every citation is generated locally, on the student's own device. The extension makes no
network requests and stores nothing about a student or what they browse. There's nothing to
collect because nothing leaves the device.

**Is it COPPA/FERPA safe?**
Yes, by design rather than by policy add-on: because there's no data collection, no accounts,
and no network activity, there's nothing that triggers COPPA or FERPA obligations in the first
place. (Bonsai has not published a formal third-party compliance certification — the safety
comes from the zero-collection architecture itself, which your IT/compliance lead can verify by
inspecting the extension's permissions directly.)

**How do students install it? How do we deploy it?**
For a whole school or district, IT pushes it to every managed Chromebook/Chrome profile through
**Google Admin** as a force-install — one push, typically done in an afternoon, no student
action required. Individual teachers piloting on their own can also install it directly from
the Chrome Web Store listing.

**Does it work offline?**
Citation generation runs entirely on-device, so it doesn't depend on a live connection to build
a citation from a page already open. (Loading a *new* web page still needs the student's normal
internet access, same as any browsing.)

**What if a citation comes out wrong?**
Like any citation tool, it works from the page's metadata, so unusual or incomplete sources can
occasionally need a manual fix — worth a quick "always double-check unusual sources" reminder to
students, same as you'd give for any citation generator. A structured way to flag and report bad
citations is **planned**, not live yet.

**Is there training or support for teachers?**
A short video walkthrough for staff is **planned** for this fall. Today, the extension is meant
to be self-explanatory in under a minute — click the icon on a source page, get the citation.

**Who made it?**
Bonsai is built by a student who got tired of clunky citation-generator sites and wanted
something that just works from the page you're already reading, without collecting anything
about you to do it.

**Where can I see it?**
**bonsaicitations.vercel.app** — a two-minute look shows exactly what a student sees.

---

*Drafted by HERMES · Front I · THE CREW. This FAQ is held pending operator review — nothing has
been published or sent. Items marked "planned" are not yet built; this draft does not overstate
what exists today.*

## Detail

- CREW · HERMES
- FORMAT · 11 Q&A pairs, teacher-to-teacher voice
- HONESTY FLAGS · "planned" used for: citation-error reporting flow, staff training video —
  neither exists today, both are named as future, not current
- CLAIMS · limited to operator brief + WARDEN compliance audit (storage/activeTab/scripting
  only, no host permissions, no accounts, no remote code)
- HELD — NOT SENT / NOT PUBLISHED
