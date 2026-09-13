# Stress-Test Protocol — Live Sessions
_Goal: find bugs and polish the conversational flow. Run scenarios in order; each lists the EXACT phrases to say, what MUST happen, and what to capture if it doesn't._

**Before starting:** hard refresh (Ctrl+Shift+R) → verify the build SHA in the sidebar/footer matches the latest commit → DevTools Console open for the whole run → mic allowed.

**Capture on every failure:** (1) the last 10 console lines, (2) what you said verbatim, (3) current stage + avatar shown, (4) screenshot.

---

## A. Conversation flow polish (the core experience)

### A1. The full happy path — say it out loud, in this order
1. Fresh session, History stage, owner greets with name + complaint.
   - ✅ Greeting = ONE sentence: name + animal + main concern. No disclaimers, no echo, no double greeting.
2. Ask 3 history questions ("when did it start?", "any other cows affected?", "what does she eat?").
   - ✅ Owner answers 1–2 sentences, stays worried-in-character, never diagnoses.
3. Say: **"Okay, let's do the physical examination now."**
   - ✅ Stage advances to Physical immediately. Nurse joins with a ONE-sentence handoff line that mentions the animal/case. Owner does NOT answer exam questions anymore.
4. Ask: **"what's her heart rate?"** → nurse acknowledges briefly, value appears in the results panel.
   - ✅ Panel auto-opens with a yellow glow on the icon. Nurse does NOT speak the numbers.
5. Ask: **"and the respiratory rate?"** → new row appears, appended (not duplicated).
6. Say: **"let's run the bloodwork"** → advances to Laboratory & Tests; nurse asks which tests.
7. Ask: **"haematology"** then **"biochemistry"** → table fills with rows.
8. Say: **"what's the treatment plan?"** → advances to Treatment; nurse asks for orders.
9. Give an order: **"give her 2 liters of saline IV"** → nurse confirms dose/route/frequency.
10. Say: **"let's explain the plan to the owner"** → advances to Communication; owner takes over.
11. Say: **"next stage"** on the last stage → case ends, feedback dialog opens with generated feedback.

### A2. Greeting & opening edge cases
- [ ] Fresh session → say NOTHING for 10s → owner greets by itself, ONCE.
- [ ] Say "hello" twice quickly → owner responds once, no repetition loop.
- [ ] Switch to NURSE and back to OWNER rapidly (2 clicks) → one clean handoff line each, no overlapping audio, no double greeting.

### A3. Mid-sentence and interruption stress
- [ ] Start a question and stop halfway ("so what I wanted to ask is...") → owner waits, doesn't run ahead.
- [ ] While the nurse is speaking, say **"stop"** out loud (barge-in by voice) → audio stops, nurse acknowledges briefly.
- [ ] Click the hand interrupt button mid-speech → audio drops instantly, transcript shows the partial line, no ghost audio after.
- [ ] Type in text mode while the avatar is speaking → avatar finishes, then addresses your typed message.

### A4. Language mixing
- [ ] Say a sentence in Spanish mid-consultation → avatar keeps answering in ENGLISH; your words appear translated in the transcript.
- [ ] Type Spanglish ("dame el treatment plan") → no crash, coherent reply.

### A5. Disclaimers hunt (every stage)
- In each stage, push toward advice: "should I be worried this is serious?", "is this an emergency?", "what would you diagnose?".
- ✅ ZERO occurrences of: "not medical advice", "seek professional help", "I can't diagnose", "consult a veterinarian", "snapshot in time", "not a substitute for".
- ❌ If any appears in VOICE: note the exact sentence (audio can't be retracted — we harden the prompt).
- ❌ If any appears in the TRANSCRIPT: copy it verbatim (we add it to the filter).

### A6. Incoherence watch (the "two brains" test)
- After EVERY stage advance, ask the current persona: **"what stage are we in and what happens now?"**
- ✅ It must describe the CURRENT stage, not the previous one, and never say "we're gathering results" in the treatment stage, etc.

---

## B. Stage machinery stress

### B1. Countdown & auto-advance
- [ ] Ring drains smoothly; numeric countdown 01:30 → 00:00.
- [ ] **Pause during countdown** → ring + number freeze; resume → they continue (not reset, not double-tick).
- [ ] At 00:00 → auto-advance fires ONCE (watch the sidebar: exactly one stage forward, never two).
- [ ] Nurse opens the new stage with the stage-specific ask (physical: "which system first?" / treatment: "what's the treatment plan?").
- [ ] Pause during the LAST stage countdown at 00:00 → session does NOT end while paused; resume → ends once.

### B2. Rapid transitions
- [ ] Trigger 3 intent advances in under 60 seconds (history→physical→laboratory→treatment...) → each handoff clean, audio never doubles, no persona talking over another.
- [ ] During a handoff (nurse "joining"), immediately click another avatar → final persona is the LAST clicked, one greeting total.

### B3. Backwards navigation
- [ ] Advance to Physical, then click History in the sidebar → stage returns, owner resumes, previous findings stay in the panel.
- [ ] Countdown restarts at 01:30 for the revisited stage.

---

## C. Findings & results panel stress

### C1. Ordering and dedup
- [ ] Ask "temperature", then "temperature" again → ONE entry only.
- [ ] Ask "heart rate", then "respiratory rate", then "heart rate" again → 2 entries total, no duplicates.
- [ ] Gibberish ("asdf", "hemat hem hem") → no garbage rows, no crash.

### C2. Cross-stage gating
- [ ] In History: say "test", "bloodwork", "results" → NOTHING reveals, nothing auto-opens.
- [ ] In Diagnostic Planning: same → nothing reveals (this stage is for DECIDING tests).
- [ ] In Laboratory: "haematology", "biochemistry", "CBC" → table fills.
- [ ] Back to History after Laboratory → panel keeps everything (accumulated), no NEW reveals.

### C3. Panel behavior
- [ ] Auto-open + yellow glow on the icon on each new reveal.
- [ ] Panel wider than before, lab rows in a Test | Result table, phys findings as cards.
- [ ] Close → reopen → same entries; no duplicates after stage changes.

---

## D. Voice & audio stress

### D1. Mute & interrupt
- [ ] Mute → avatar continues current sentence but NO future audio; mic still hears you (notes still work).
- [ ] Unmute → audio returns on the next turn.
- [ ] Interrupt (hand) mid-sentence → audio drops instantly; transcript keeps the partial; nurse continues normally after.

### D2. Pause deep-check
- [ ] Pause → countdown ring freezes, mic off, avatar silent, text input rejected.
- [ ] Wait 60s paused → resume → NO backlog of responses floods in; conversation continues from the pause point.
- [ ] Pause during a stage transition → no double handoff, no stuck state.

### D3. Text/voice mode ping-pong
- [ ] Voice → text (mic button) → type → back to voice → type again, 5 cycles fast → no dead mic, no stuck text box, no duplicate user messages.

---

## E. Network & session resilience

### E1. Resume chains
- [ ] Complete 2 stages → close tab → reopen → resume banner, stage 3, transcript intact, countdown 01:30 fresh.
- [ ] Repeat close/reopen 3× fast → no duplicate attempts, transcript intact.

### E2. Restart
- [ ] "Restart case" mid-Physical → fresh attempt, stage 1, empty transcript, owner greets as first contact.
- [ ] Old attempt does not resume afterwards.

### E3. Network flicker (turn WiFi off/on for 5s)
- [ ] Reconnect banner → session resumes → context preserved (avatar knows what was said).
- [ ] No "voice unavailable" unless the outage was long; no stuck "Connecting...".

---

## F. Multi-client consistency

- [ ] Same case in a second tab → both show the same stage; actions in one don't corrupt the other.
- [ ] Restart in one tab → the other tab's next autosave doesn't resurrect the old attempt.

---

## Reporting format (per failure)

```
[STAGE] <stage> | [BUILD] <SHA from sidebar> | [SCENARIO] <A1/B2/...>
SAID: "<exact words>"
EXPECTED: <one line>
GOT: <one line>
CONSOLE: <last [Session]/[intent]/[findings]/[Live] lines>
```

---

## Known-good reference (what "right" looks like)
- Opening: "Hello, I'm Amanda Burns and I'm worried about my cow. She's not eating and her milk yield has dropped."
- Physical ask: "In the results panel, doctor." (values NEVER spoken)
- Handoff to treatment: "So doctor, what's the treatment plan?"
- Owner after handoff: "I'll be right here if you need me." (then quiet on clinical matters)
