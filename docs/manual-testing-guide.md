# Manual Testing Guide — Live Sessions QA
_Use this checklist on every new deployment. It covers every issue reported during the first classroom session plus all recent fixes. ~20-25 minutes for the full pass._

---

## 0. Before you start
- Open the app in a **fresh browser tab**, log in as a **student** account.
- Have your **microphone allowed** for the site (padlock icon → Microphone → Allow).
- Ideally test on a second device/account with a different person (as in the Nottingham test).

## 1. Language discipline
**Reported:** voice drifted into Spanish or an unidentified language.
- [ ] Start any case and speak **in English** for 2-3 minutes.
- [ ] Deliberately answer once in Spanish (or another language) — the avatar must **keep replying in English**.
- [ ] Check the transcript: all avatar lines in English; your own non-English words should be auto-rewritten in English within a few seconds.

## 2. Feedback at the end
**Reported:** some students got no feedback.
- [ ] Complete at least 2 stages, then hang up (red phone icon).
- [ ] The "Examination Complete!" dialog must show AI-generated feedback within ~30 seconds (with a "Learning Objectives Coverage" section **if the case has objectives defined**).
- [ ] If it fails, the dialog must state the exact reason in brackets — report that text.

## 3. Results are only revealed when asked
**Reported:** results appeared before students asked.
- [ ] During **History Taking**: the results panel (clipboard icon, top-right of controls) must stay EMPTY even after chatting for a while.
- [ ] During **Physical Examination**: ask for ONE value ("what's her heart rate?") → ONLY that value appears in the panel.
- [ ] Without asking, no other values may appear — values may appear if the nurse verbally reports them after you asked.
- [ ] During **Laboratory & Tests**: ask "run the CBC" → lab values appear, but **without any diagnosis or syndrome names** (no "consistent with...").

## 4. Resume vs Restart
**Reported:** sessions continued from previous runs and it was confusing; restart was hard to find.
- [ ] Get into a case, complete part of stage 1, then close the tab.
- [ ] Reopen the same case → a blue banner says "Continued from your previous session — use Restart case…" and your transcript + timer are restored.
- [ ] Click **"Restart case"** (sidebar, under Back to Cases) → the page reloads with an EMPTY transcript and stage 1 again.
- [ ] Verify the old session no longer resumes (restart completes the old attempt).

## 5. Off-case content
**Reported:** a rhabdomyolysis case randomly mentioned bandages and an incision.
- [ ] In any case, ask the owner/nurse about topics NOT in the case (e.g. "has she had surgery?", "is there a bandage on her leg?").
- [ ] The character must not invent procedures, bandages, incisions or treatments that don't belong to the case.

## 6. No Spanish banners
**Reported:** a random red banner in Spanish.
- [ ] Any red/amber error banner must be in **English**. (If one appears in Spanish, screenshot it immediately.)

## 7. Restart is obvious
- [ ] The **"Restart case"** button is visible in the sidebar at all times, with a spinner while restarting.

## 8. Pause
- [ ] Press the **pause button** (left of the mute icon): the mic turns off and the avatar is silenced.
- [ ] Press **play/resume**: the mic reactivates and the conversation continues normally.

## 9. Returning to a case
- [ ] Leave a live session mid-way (Back to Cases).
- [ ] Re-enter the case → the session resumes (banner confirms it). No re-setup needed.

## 10. Stage advancement
- [ ] Say "let's do the physical examination" → stage advances by itself, the nurse takes over with a short handoff line (never a full self-introduction).
- [ ] Say something softer ("maybe the nurse should take a look") → the Next Stage button becomes CLICKABLE (amber highlight) even before the minimum turns.
- [ ] When the conversation is ready AND criteria are met, the "Did you finish the [stage]?" banner should open by itself — one click to advance.
- [ ] The owner must NEVER conduct the exam: if you ask the owner exam questions, they should deflect and offer to bring the nurse.

## 11. Learning objectives (new)
- [ ] If the case has objectives defined (case editor → "Learning Objectives"), the final feedback MUST include a "Learning Objectives Coverage" section with one line per objective: Covered / Partially covered / Not observed + evidence.
- [ ] If the case has NO objectives, the feedback simply has no such section (no error).

## 12. Regression sweep
- [ ] No duplicate greetings at session start.
- [ ] Your messages appear ABOVE the avatar's replies.
- [ ] Mute button silences future replies; interrupt (hand) cuts the avatar mid-sentence.
- [ ] No speaker-name prefixes ("Martin Lambert: ...") in avatar replies.
- [ ] Sidebar never wider than ⅓ of the window; on narrow windows it becomes a drawer.
- [ ] "Origin not allowed" does NOT appear (test on the same link you normally use; press Retry once if it does).

---

## Reporting a bug
For any failure: screenshot + (1) which step above failed, (2) the exact error text in red banners or browser console (F12 → Console), (3) case name and time.
