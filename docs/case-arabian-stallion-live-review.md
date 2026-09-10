# Live UI Review — case-arabian-stallion-empf (16-stage case)
_Analysis only. No code changes made. Verdict: the case WORKS end-to-end in the current Live UI with three things worth knowing._

---

## 1. The stage sequence and who speaks

| # | Stage | Type | Speaks | Findings panel |
|---|-------|------|--------|----------------|
| 1 | History Taking | history | Owner | never reveals |
| 2 | Physical Examination | physical | Nurse | on request, per finding |
| 3 | Diagnostic Planning | diagnostic | Owner | never reveals |
| 4 | Laboratory & Tests | laboratory | Nurse | lab rows on request |
| 5 | Initial in-hospital Treatment Plan | treatment | Nurse | no new reveals |
| 6 | In hospital reassessment | communication | Owner | no new reveals |
| 7 | Pending results | laboratory | Nurse | lab rows on request |
| 8 | Advanced Diagnostic Planning | diagnostic | Owner | no new reveals |
| 9 | Laboratory & Tests (2nd) | laboratory | Nurse | lab rows on request |
| 10 | Treatment Plan (2nd) | treatment | Nurse | no new reveals |
| 11 | Diagnosis and treatment discussion | communication | Owner | no new reveals |
| 12 | In hospital progression | treatment | Nurse | no new reveals |
| 13 | Discharge planning | communication | Owner | no new reveals |
| 14 | Home follow-up | communication | Owner | no new reveals |
| 15 | Respiratory relapse | communication | Owner | no new reveals |
| 16 | End-of-life discussion | communication | Owner | no new reveals |

Persona sequence: Owner → Nurse → Owner → Nurse → Nurse → Owner → Nurse → Owner → Nurse → Nurse → Owner → Nurse → Owner → Owner → Owner → Owner.

- Every voice change (owner↔nurse) triggers a clean reconnect with transcript replay — continuity is handled.
- Nurse→nurse transitions (5→6? no — 9→10 and 11→12) happen WITHOUT reconnect: same voice, inline persona switch, audio uninterrupted.
- The handoff line per stage is stage-specific: the nurse asks for the treatment plan at treatment stages; the owner facilitates handoffs out of her stages.

## 2. Advancing through 16 stages

Three mechanisms stack up, all working:
1. **Intent phrases** — "let's move to the lab", "let's discuss the plan with the owner", "what's the treatment plan"... all 15 transitions are covered by the per-type patterns.
2. **"next stage"** — the generic phrase advances one stage from anywhere.
3. **90-second countdown** — at zero, auto-advance (except while paused; the countdown freezes with everything else).

The Next Stage button is always clickable, and the hint flashes after 30s in a stage and every 2 exchanges.

⚠️ **Pacing flag**: 16 stages × 90s = 24 minutes minimum, realistic 40–60 min with conversation. If the auto-advance at zero feels too aggressive for a case this long (it will cut emotional moments like the end-of-life discussion mid-sentence), options: (a) longer countdown for long cases, (b) no auto-advance in communication stages, or (c) a per-case countdown setting in the Stage Manager. Decision needed — not a blocker.

## 3. Findings and results across the two lab stages

- Stage 4 and Stage 9 both read from the SAME case-level `diagnostic_findings` record. The results panel accumulates: entries revealed in stage 4 persist into stage 9 (by design).
- If the case's diagnostic record contains INITIAL values only, stage 9 has nothing new to reveal — the stage's own "Interaction script" (dropdown in Stage Manager) is what makes the nurse narrate the PROGRESSION verbally. **Verify each stage has its script set** (screenshot shows Laboratory & Tests → "Lab and diagnostic results script" ✓ for the first one; check the second).
- When the student asks again for already-revealed results, the panel correctly does nothing new (deduplicated).

## 4. Small notes

- Two stages share the exact title "Laboratory & Tests" — the handoff announcement ("moved to the Laboratory & Tests stage") will read the same both times. Cosmetic; renaming the second to "Laboratory & Tests (follow-up)" would help.
- "In hospital reassessment" is typed communication → the OWNER speaks. Make sure that matches your teaching intent (the vet reassesses with the owner present).
- "Pending results" as a laboratory stage: if nothing is revealed on request, the panel stays empty and the nurse acknowledges — that's correct (the results are pending!).

## 5. Verdict

**The case runs coherently in the current Live UI as-is**: correct speakers per stage, working transitions (intent + generic + countdown), per-stage findings gating, and handoffs with stage-specific asks. The three follow-ups above are refinements, not blockers.
