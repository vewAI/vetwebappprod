# 30-Day Report: Audits, Improvements & Testing — Live Sessions
### Plus UX/UI roadmap: from the Home page to starting a clinical case

_Date: September 1, 2026 · Scope: 36 commits on the production line · Everything below reflects the LATEST state of each item, including later fixes that superseded earlier ones._

---

## 1. Executive summary

Over the last 30 days the Live Sessions experience went from an unstable prototype (broken feedback, echo artifacts, duplicated messages, unsafe API key exposure) to a stable, teaching-focused simulation. The work clustered into five areas: **voice-session reliability**, **correct teaching behavior**, **safety**, **performance**, and **interface quality**. All automated checks are green: the TypeScript build compiles cleanly, 123 automated tests pass, and every change was manually validated on live deployments before shipping.

---

## 2. Categorized work done

### A. Voice session reliability
_Goal: the conversation feels natural — nothing duplicated, nothing lost, nothing attributed to the wrong speaker._

| Item | Latest state | Why it matters |
|---|---|---|
| Message ordering | The student's words appear instantly and always ABOVE the avatar's reply, even when the system reports them out of order | Reads like a normal conversation instead of a confusing transcript |
| Echo removal | When the avatar speaks, the microphone can accidentally "hear" it and write the avatar's words down as if the student said them. Those are now filtered out, both while the avatar is talking and afterward by comparing against the last reply | The student's record only contains what they actually said |
| Duplicate greetings fixed | The avatar no longer introduces itself twice at the start, and re-joins after a stage change use a short "picking up where we left off" line instead of a full self-introduction | Continuity and realism |
| Speaker-label artifacts removed | Replies no longer start with "Martin Lambert: ..." — the system explicitly forbids it and also cleans any leftover name labels from the text | Cleaner transcript and voice |
| Role consistency on stage changes | When control passes to another character (owner → nurse → owner), the incoming character receives the full conversation history and clearly knows who it is — no more invented names or restarting the case | The simulation stays believable across all 6 stages |
| Reconnection & startup errors | If the voice service fails to start, the student now sees a clear error with a Retry button instead of a silent, dead screen | No more mystery failures |
| Handoff flow | A dedicated handoff signal tells the outgoing character to step aside (at most a one-line goodbye) and the incoming one to pick up in role | The owner no longer "performs the exam", the nurse takes over cleanly |

### B. Correct teaching behavior (pedagogy)
_Goal: the student leads the consultation; the system never gives the diagnosis away._

| Item | Latest state | Why it matters |
|---|---|---|
| Results appear only when asked | Test/exam values show up in the results panel ONLY after the student requests them, one entry at a time, and only once the proper stage is reached (physical findings from the exam stage onward, lab values from the lab stage onward) | The student decides which questions and exams to perform — the core learning exercise |
| No diagnosis leaking | Nurse/lab characters are forbidden from naming syndromes or conclusions (e.g. "consistent with abomasal reflux syndrome"), even if the case record contains them. Only raw values are spoken or shown | The student must reach the diagnosis themselves |
| One results source | The nurse is now the only character who holds test results; the lab technician is no longer part of the automatic stage flow (still available manually) | Simpler, predictable — results never appear from an unexpected speaker |
| Stage progression by intent | Saying "let's do the physical examination" advances the stage automatically; softer mentions ("the nurse", "examination") simply unlock the Next Stage button. The owner character is instructed to facilitate the handoff, never to run the exam | The flow follows the student's intent instead of a rigid counter |
| Guided mode tips | With guided mode on, the sidebar shows concise tips for the CURRENT stage (what to do + top 3 tips), updating automatically at each stage | Support is available exactly when needed, without leaving the session |
| Owner boundaries | The owner can never conduct the exam or answer exam-style questions; it facilitates and hands off | Realistic role behavior |
| Captions & translation | The student's spoken words appear as live captions and, if the recognizer outputs them in the wrong language, they are automatically rewritten in English | Always readable; understanding was never affected |

### C. Safety & security
_Goal: protect the API keys, the students, and the bill from abuse._

| Item | Latest state | Why it matters |
|---|---|---|
| AI-generated feedback sanitization | All feedback text is cleaned of any executable code before being displayed or stored (this was extended to every feedback endpoint) | Prevents injected content from running in a student's browser |
| API key protection | The app now requests short-lived, limited-use voice credentials instead of shipping a permanent key to the browser. A safety valve keeps sessions working while this is finalized | The permanent key can no longer be stolen from the client |
| Abuse protection | Request limits moved from per-server memory to a shared store (Redis when available), so they actually work across cloud instances; the chat endpoint received a limit for the first time; every limiter fails safely (short timeouts, in-memory fallback) | Cost control that works in production |
| Access checks | Feedback and results endpoints verify the student owns the session and the case matches; unknown cases are rejected firmly instead of "let through" on database hiccups | One student can't spend another's resources |
| Payload limits | Session transcripts sent for AI feedback are capped in size and count | Prevents oversized/abusive requests |

### D. Performance & scalability
_Goal: keep working smoothly as usage grows._

| Item | Latest state | Why it matters |
|---|---|---|
| Transcript saving rewritten | Instead of erasing and rewriting the entire conversation every few seconds, the system updates only what changed (idempotent updates) — with a safe fallback if the database isn't upgraded yet | Much less database churn; no more save errors; safe with multiple tabs |
| Session deduplication | Opening the same case in two tabs can no longer create two competing sessions (database-level claim) | Data integrity |
| Database indexes | Indexes added for the most frequent lookups (session resume, transcript reads) | Fast responses at scale |
| Audio streaming | Text-to-speech audio now streams through the server instead of being fully loaded in memory | Lower delay, less memory |
| Job queue safety | Background jobs are now claimed atomically so two workers can never process the same job | Reliable background processing |
| Pagination | Case lists and transcripts capped | No unbounded queries |
| Long AI calls | AI feedback generation is allowed up to 60s (was silently cut at 10s — the hidden cause of the "Unable to generate feedback" errors) | Feedback actually arrives |
| Timeout hardening | External calls (Redis, Google) now fail fast with safe fallbacks instead of hanging the request | No more 504 dead screens |

### E. Interface polish & accessibility
_Goal: comfortable, inclusive, professional UI._

| Item | Latest state |
|---|---|
| Mute | Actually silences all future avatar speech until unmuted |
| Interrupt ("barge-in") | A hand button lets the student cut the avatar off mid-sentence; queued audio drops instantly |
| Waveform | Now reflects real microphone and playback amplitude instead of decorative animation |
| Responsive layout | Bottom controls never get clipped; the progress sidebar is capped at ⅓ of the window on desktop and becomes a drawer on small screens |
| End-of-session transcript | A "Show session transcript" button in the completion dialog, plus existing export options |
| Results panel | Auto-opens when new findings appear; live-updates as more are requested |
| Accessibility | Screen-reader announcements for banners and errors, minimum text size raised, alerts marked properly |

### F. Quality assurance & audits
| Audit/test | Result |
|---|---|
| Full code audit (UX, security, scalability) | 25+ findings documented with file references → became the improvement plan |
| Branch integration audit | Verified all Live branches merged without losing commits; security branch confirmed as a superseded duplicate |
| Automated tests | 123/123 passing (3 broken suites repaired, new tests added for context building) |
| Type checking & lint | Clean on every delivery |
| Manual QA rounds | 6+ rounds on deployed previews covering full session flow, resume, feedback, results, translations, handoffs |
| Database migrations | 3 scripts applied and verified in production (indexes, session claim, job claim) |

---

## 3. What's still open

| # | Item | Status / blocker |
|---|---|---|
| 1 | **Short-lived voice credentials — final switch** | Implemented with fallback. One hanging external call needs the error line from the server logs to fix permanently; then a single setting (`LIVE_REQUIRE_EPHEMERAL_TOKENS=1`) closes it |
| 2 | **Lock the voice session config server-side** | After item 1: the client should not be able to alter character instructions |
| 3 | **Chat (text mode) streaming** | The classic chat still waits for full AI responses; converting to streaming requires client changes — recommend a dedicated mini-project |
| 4 | **Background worker scheduling** | The worker exists and is now safe; it needs a scheduled host (cron) so it runs automatically |
| 5 | **Character portraits** | Some cases show placeholder initials — portrait seeding scripts must be run for those cases |
| 6 | **Mobile deep-polish** | Drawer done; remaining: touch ergonomics of voice mode on iOS, portrait-orientation layout |
| 7 | **Accessibility pass 2** | Keyboard navigation of the results panel, focus management in dialogs |
| 8 | **Per-stage feedback** | Feedback is currently global; splitting it by stage would strengthen the learning loop |

---

## 4. UX/UI plan: from Home to starting a case

### Current flow (audit)

Today, starting a practice session takes too many decisions:

```
Home (/)  →  scattered sections: welcome, assigned cases, case sessions,
             attempts, notifications, plus separate "Cases" and "Live" menus
    ↓
Cases (/cases)  →  grid of ALL cases (text mode implied)
    ↓
Case instructions (/case/[id]/instructions)  →  read briefing, start chat
    ↓ OR (separate path)
Live (/live)  →  ANOTHER grid of the same cases (voice mode implied)
    ↓
Live session (/live/[id])  →  starts talking immediately
```

**Problems:** two parallel case libraries (Cases vs Live) that can fall out of sync; the mode (written chat vs live voice) is chosen BEFORE seeing the case, which is backwards; the Home page mixes consumption (start training) with management (attempts, professor tools); students must understand the difference between "Cases", "Case sessions" and "Attempts".

### Simplification proposal: **one case library, one case card, mode chosen inside**

1. **One library.** Merge `/cases` and `/live` into a single case catalog. Each card shows: title, species/category, difficulty, a small progress ring (instead of the separate "Attempts" area), and ONE primary button: **"Start practice"**.

2. **Mode inside the case, not before it.** After clicking a case, show a single **launch screen** with: the briefing (what the classic instructions page does), the 6-stage map, and two clear choices:
   - **🎙 Talk to the patient** (voice) — recommended for communication practice
   - **💬 Write to the patient** (chat) — recommended when a microphone isn't available
   Both modes launch the SAME case with the same stages; switching later is allowed from the session header.

3. **Progressive disclosure for everything else.** Home becomes a simple dashboard:
   - **Top:** "Continue where you left off" (in-progress sessions, one click to resume) + "Assigned by your professor" (if any) + notifications only when actionable
   - **One primary CTA:** "Browse cases"
   - Management areas (all attempts, professor dashboard, case entry) collapse into a secondary "My work / Teach" menu — visible, not competing

4. **Resume as a first-class action.** Any in-progress session shows a "Resume · stage 3 of 6 · 12 min invested" card everywhere the case appears (home, catalog) — since resume now works well technically, the UI should push it.

### Phased plan

| Phase | Scope | Effort |
|---|---|---|
| **P1 — Unify the catalog** | Merge `/live` grid into `/cases` with a mode-agnostic card + "Start practice" | ~2-3 days |
| **P2 — Launch screen** | Briefing + stage map + voice/chat choice inside the case; retire `/case/[id]/instructions` as a separate page | ~2-3 days |
| **P3 — Home dashboard** | Continue-where-you-left-off + assigned cases + single CTA; move management to secondary menu | ~2 days |
| **P4 — Progress rings & resume cards** | Visual progress on cards; resume CTA everywhere | ~1-2 days |
| **P5 — Cleanups** | Retire redundant routes, redirects for old links, empty-state polish | ~1 day |

**North star:** from the Home page, a student should reach "talking to the patient" in **two clicks**, and the only decision they make up front is *which case* — never *which technology*.

---

## 5. Verification snapshot (end of the period)

- ✅ Production build deployed and healthy
- ✅ 123/123 automated tests · clean type check · zero lint errors on touched files
- ✅ 3 database migrations applied and verified
- ✅ Manual QA: full session flow, resume, results panel, handoffs, guided mode
- ⏳ One open blocker requires a single server log line (voice credentials final switch)
