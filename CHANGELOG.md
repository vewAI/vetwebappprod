# Changelog

## [Latest] - Stage & Nurse Behavior Overhaul

### Backend & Data
- **Configurable Stage Management** — Full DB-backed CRUD for case stages: add, edit, delete, reorder, activate/deactivate, persist
  - `app/admin/case-stage-manager/page.tsx`, `app/api/cases/[caseId]/stages/*`
- **Runtime Stage Loading** — Chat route now resolves personas & settings from DB; fallback to case defaults if missing
  - `app/api/chat/route.ts`
- **Compatibility** — Old case/stage behavior preserved when DB data absent

### UI & Experience
- **Progress Sidebar** — Future stages now show "Upcoming Stage" instead of revealing names
  - `features/chat/components/progress-sidebar.tsx`
- **Lab Results View** — Clean table rendering in chat for bloodwork & diagnostics (no JSON artifacts)
  - `features/chat/components/lab-results-table.tsx`, `labResultsParser.ts`

### Nurse Persona Rules *(10 clinically-grounded rules)*
1. **Selective Reporting**: Only release findings when explicitly requested; don't volunteer unrelated values
2. **Parameter-Specific Responses**: Single param → report only that; "electrolytes" → K, Cl, HCO₃; "full panel" → complete
3. **Natural Speech**: 1–3 sentences default, use clinical terminology, avoid bullet points & raw JSON
4. **No Internal Prompts**: Remove persona-management text & owner identity from responses
5. **Physical Exam Stage**: NO diagnostic interpretation (no "consistent with", "suggestive of", etc.) — respond: "I cannot provide diagnostic interpretation in the Physical Examination stage."
6. **Missing Values**: State "no recorded value"; note typical species norms only if clearly labeled
7. **Unit Normalization**: mmol/L→millimoles per litre, mg/dL→milligrams per decilitre, etc.
8. **Abbreviation Pronunciation**: NEFA→non-esterified fatty acids, BHB→beta-hydroxybutyrate, AST→aspartate aminotransferase, etc.
9. **Multi-Parameter Delivery**: Natural sequence in single paragraph (e.g., "Potassium is 3.2 millimoles per litre, low. Chloride is 90 millimoles, low-normal...")
10. **Imaging**: Describe clearly without over-interpretation; no unsolicited conclusions

### STT/TTS Coordination
- **Deaf Mode Defaults** — exitDeafMode now defaults to 1650ms buffer to prevent TTS feedback into STT
- **Decoupled Services** — ttsService no longer manages STT suppression (caller responsibility)
- **Removed forceClearSuppression** — Use setSttSuppressed(false, true) for safer suppression clearing
  - `features/speech/services/sttService.ts`, `ttsService.ts`, `useSpeechOrchestration.ts`

### Case Intake & Admin
- **Interactive Case Intake** — AI-guided field completion wizard for professors/admins with TXT export
  - `app/case-entry/page.tsx`, `app/api/case-intake/analyze/route.ts`
- **Archive/Restore** — Cases can be archived and restored via admin interface
  - `app/admin/page.tsx`, `app/api/cases/route.ts`
- **Professor Permissions** — Professors can now create cases (not admin-only)

### Cleanup
- Removed debug UI components (DebugToggle, AdminDebugOverlay, AdminDebugPanel, /debug-auth)
- Removed Merck public test script
- Fixed logo rendering with signed Supabase URL fallback
  - `next.config.ts`, `app/page.tsx`
