This file documents the recent fixes regarding chat reliability and STT corrections.

1. **STT Corrections:**
   - Added Post-processing rule: "room and turnover" -> "rumen turnover".
   - Confirmed existing rule: "room in turnover" -> "rumen turnover".

2. **Nurse Non-Response / Ghost Messages:**
   - **Issue:** Users reported "hearing the nurse but seeing no message".
   - **Cause:** The "Voice-First" mode created a placeholder message with empty text (`""`) while buffering audio. React rendered this as an invisible/collapsed element.
   - **Fix:** Changed placeholder text to `"..."` and status to `"pending"`. This ensures the bubble is visible while audio loads.
   - **Issue:** Nurse sometimes didn't respond at all.
   - **Cause:** Backend API occasionally returned JSON missing the `role: "assistant"` field for on-demand clarifications.
   - **Fix:** Enforced valid JSON shape in backend `route.ts`.
