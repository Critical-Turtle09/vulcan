// SPEC v1.6 — P2.1 THE MANUAL. A spotlight walkthrough of every zone, in plain
// tired-person English. `?` (when the intent line is blurred) or typing `tour` opens
// it. Next / Back / Esc drive it; a narration toggle speaks each step aloud. A
// one-time first-launch offer appears once (persisted seen-flag) and never nags again.
//
// The spotlight is one dim layer with a moving cutout (a box + a huge outset shadow),
// plus a caption card. No non-ember hues; the cutout frame is ember hairline. Under
// reduced-motion the draw eases are dropped but the walkthrough still works.
const SEEN_KEY = 'vulcan.manual.seen.v1';

// the zones, in reading order. sel → the element to spotlight; text → plain English.
const STEPS = [
  { sel: '#orb-slot', title: 'THIS IS VULCAN', text: 'The orb in the middle is VULCAN. It is calm when idle, faster when working, and brightest when it is speaking to you.' },
  { sel: '#status-strip', title: 'IS IT BUSY?', text: 'The top line tells you what is happening: CORE is VULCAN itself, WIRE is the news feed, HANDS is whether a job is running. A dot glows orange when that part is active.' },
  { sel: '#flank-left .fsec:first-child', title: 'THE NUMBERS', text: 'These four cards are the launch at a glance: waitlist, commits this week, deploy state, and how much Claude spend you have used today. Click any card to open it and do something with it.' },
  { sel: '#dirs', title: 'YOUR DIRECTIVES', text: 'Your short to-do list. Click it to edit — add, tick off, or remove items. Your edits are saved to the vault and survive a restart.' },
  { sel: '#docs', title: 'THE PAPER TRAIL', text: 'Everything VULCAN files lands here, newest first. Click a row to open it in the vault, hear a quick summary, or draft a follow-up.' },
  { sel: '#deck', title: 'THE COMMAND DECK', text: 'Ten one-click jobs. Click one and VULCAN runs it, speaks the result, and files it. You can also just type or say the same commands.' },
  { sel: '#flank-right .fsec:nth-child(2)', title: 'VOICE', text: 'Hold the Space bar anywhere to talk; let go when you are done. Press Esc to stop. Click this panel to test the voice.' },
  { sel: '#objs', title: 'THE BIG OBJECTIVES', text: 'The three things this launch is really about. Editable and saved, just like your directives.' },
  { sel: '#intent-form', title: 'TYPE ANYTHING', text: 'The command line. Type a command or a plain question and press Enter. Anything that would leave the machine — sending, deploying — VULCAN announces and waits for you to confirm.' },
];

export function createManual({ speak } = {}) {
  let root = null, i = 0, narrate = false, hideTimer = null;

  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'manual';
    root.hidden = true;
    root.innerHTML =
      '<div class="manual-cut"></div>'
      + '<div class="manual-card">'
      + '  <div class="manual-eyebrow"><span class="manual-step">1</span><span class="manual-of"> / ' + STEPS.length + '</span> · GUIDE</div>'
      + '  <div class="manual-title"></div>'
      + '  <div class="manual-text"></div>'
      + '  <div class="manual-actions">'
      + '    <button class="manual-btn" data-act="back">BACK</button>'
      + '    <button class="manual-btn primary" data-act="next">NEXT</button>'
      + '    <button class="manual-btn manual-narrate" data-act="narrate" aria-pressed="false">🔊 NARRATE</button>'
      + '    <button class="manual-btn manual-done" data-act="done">DONE ✕</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(root);
    root.querySelector('[data-act="next"]').addEventListener('click', () => step(i + 1));
    root.querySelector('[data-act="back"]').addEventListener('click', () => step(i - 1));
    root.querySelector('[data-act="done"]').addEventListener('click', close);
    root.querySelector('[data-act="narrate"]').addEventListener('click', (e) => {
      narrate = !narrate; e.currentTarget.setAttribute('aria-pressed', String(narrate));
      e.currentTarget.classList.toggle('on', narrate);
      if (narrate) sayStep();
    });
    window.addEventListener('resize', () => { if (!root.hidden) place(); });
  }

  function place() {
    const s = STEPS[i];
    const target = document.querySelector(s.sel);
    const cut = root.querySelector('.manual-cut');
    const card = root.querySelector('.manual-card');
    const r = target ? target.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, bottom: innerHeight / 2, right: innerWidth / 2 };
    const pad = 8;
    cut.style.left = `${Math.max(0, r.left - pad)}px`;
    cut.style.top = `${Math.max(0, r.top - pad)}px`;
    cut.style.width = `${r.width + pad * 2}px`;
    cut.style.height = `${r.height + pad * 2}px`;
    // caption: prefer the side with the most room (right, else left, else below).
    const cw = 340, gap = 18;
    let x = r.right + gap, y = r.top;
    if (x + cw > innerWidth - 12) x = r.left - gap - cw;      // no room right → left
    if (x < 12) { x = Math.min(Math.max(12, r.left), innerWidth - cw - 12); y = r.bottom + gap; } // → below
    y = Math.min(Math.max(12, y), innerHeight - 220);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  function sayStep() { if (narrate && speak) try { speak(STEPS[i].text); } catch (_) {} }

  function paint() {
    const s = STEPS[i];
    root.querySelector('.manual-step').textContent = String(i + 1);
    root.querySelector('.manual-title').textContent = s.title;
    root.querySelector('.manual-text').textContent = s.text;
    root.querySelector('[data-act="back"]').disabled = i === 0;
    root.querySelector('[data-act="next"]').textContent = i === STEPS.length - 1 ? 'FINISH' : 'NEXT';
    place();
    sayStep();
  }

  function step(n) {
    if (n < 0) return;
    if (n >= STEPS.length) { close(); return; }
    i = n; paint();
  }

  function onKey(e) {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); step(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(i - 1); }
  }

  function open(start = 0) {
    ensureDom();
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
    dismissOffer();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }   // cancel a pending close → reopen never clobbers
    i = start; root.hidden = false;
    requestAnimationFrame(() => { root.classList.add('up'); paint(); });
    window.addEventListener('keydown', onKey, true);
  }

  function close() {
    if (!root || root.hidden) return;
    narrate = false;
    root.classList.remove('up');
    window.removeEventListener('keydown', onKey, true);
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (root) root.hidden = true; hideTimer = null; }, 240);
  }

  // one-time first-launch offer: a small, dismissible prompt (never a modal wall).
  let offer = null;
  function dismissOffer() { if (offer) { offer.remove(); offer = null; } }
  function maybeOfferFirstLaunch() {
    let seen = false; try { seen = !!localStorage.getItem(SEEN_KEY); } catch (_) {}
    if (seen) return;
    offer = document.createElement('div');
    offer.className = 'manual-offer';
    offer.innerHTML = '<span>First time? Take the 90-second tour.</span>'
      + '<button class="manual-btn primary" data-act="take">TAKE TOUR</button>'
      + '<button class="manual-btn" data-act="skip">NOT NOW</button>';
    document.body.appendChild(offer);
    offer.querySelector('[data-act="take"]').addEventListener('click', () => open(0));
    offer.querySelector('[data-act="skip"]').addEventListener('click', () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {} dismissOffer(); });
    requestAnimationFrame(() => offer && offer.classList.add('up'));
  }

  return { open, close, maybeOfferFirstLaunch, isOpen: () => !!root && !root.hidden };
}
