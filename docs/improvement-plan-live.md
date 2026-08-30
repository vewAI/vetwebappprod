# Plan de Mejora — Sesiones Live (UX, Seguridad, Escalabilidad)

> Fecha: 2026-08-29 · Base: `merge/live-integration` · Informe de referencia: `docs/evaluation-live-ux-security-scalability.md`

## Estado

| Fase | Estado |
|------|--------|
| Quick wins (F1) | ✅ **IMPLEMENTADO** (ver detalle abajo) |
| Fase 2: Resume & consistencia (UX) | ⏳ Pendiente |
| Fase 3: Seguridad estructural | ⏳ Pendiente |
| Fase 4: Escalabilidad | ⏳ Pendiente |
| Fase 5: Pulido UX | ⏳ Pendiente |

---

## F1 — Quick wins ✅ (implementado en esta rama)

| # | Fix | Archivos | Verificación |
|---|-----|----------|--------------|
| F1.1 | **Feedback live roto**: la ruta esperaba `transcript` y el cliente enviaba `messages` → nunca se generaba feedback. Ahora la ruta normaliza ambos shapes (`role/content` de Message y `speaker/text` legacy), exige `attemptId`, verifica ownership con `authorizeAttemptAccess` + match attempt↔case, y aplica caps (400 entradas / 8000 chars por entrada) | `app/api/live/feedback/route.ts`, `app/live/[id]/page.tsx:146` | tsc ✓ |
| F1.2 | **Stored XSS en overall-feedback**: reemplazada la cadena regex sin sanitizar por `marked` + `DOMPurify` server-side (allowlist idéntica a feedback/live-feedback) | `app/api/overall-feedback/route.ts` | tsc ✓ |
| F1.3 | **Mute defectuoso**: `enqueue()` reactivaba el audio tras `stop()`. Nuevo `mutedRef` + `setMuted()` en el player: los chunks entrantes se descartan mientras esté muteado | `features/live/hooks/useAudioPlayer.ts`, `live-session.tsx:448-452` | tsc ✓ |
| F1.4 | **Índices hot-path**: `attempts(user_id, case_id, completion_status, created_at DESC)` y `attempt_messages(attempt_id, timestamp)` | `db/add_live_hot_path_indexes.sql` (nuevo) | ⚠️ **ejecutar contra la BD** |
| F1.5 | **Resume con retratos**: `persona_role_key` ahora se persiste en `attempt_messages` y se devuelve en el resume (`personaRoleKey`) | `app/api/attempts/progress/route.ts`, `app/api/live/session/route.ts`, migración en `db/add_live_hot_path_indexes.sql` | ⚠️ depende de F1.4 |

**Pendiente de ejecución manual**: correr `db/add_live_hot_path_indexes.sql` en Supabase (agrega columnas + índices; es idempotente).

**Verificación global**: tsc limpio · 120/120 tests · lint 0 errores en archivos tocados.

---

## F2 — Resume & consistencia (UX crítica) — ~1-2 días

1. **Replay de contexto al modelo en resume**: al reconectar, inyectar los mensajes persistidos vía `sendConversationContext()` (existe en `geminiLiveService.ts:187-201` pero no se llama en `live-session.tsx:334`).
2. **turnCount correcto en resume**: contar solo mensajes `user` con `stageIndex === currentStageIndex` (hoy infla con históricos y desbloquea Next Stage de inmediato — `live-session.tsx:353-361`).
3. **Restaurar timer**: usar `timeSpentSeconds` que ya devuelve `POST /api/live/session` (hoy se ignora en `app/live/[id]/page.tsx:112-118`).
4. **Fix barge-in**: `interrupted` debe vaciar también la cola local de audio (hoy `audioChunksDiscard` es no-op — `useGeminiLive.ts:191-197`).

## F3 — Seguridad estructural — ~3-5 días

1. **P0 — Proxy WS server-side para Gemini**: eliminar la entrega de `GEMINI_API_KEY` cruda (`app/api/live/token/route.ts:158`). Opciones: token efímero de Google (Ephemeral Auth Tokens API) o relay WS por el server. Plan ya bocetado en `docs/live-chat-improvement-plan.md`.
2. **Rate limiting a Redis**: migrar `app/api/_lib/rateLimit.ts` y el Map de `token/route.ts` a Redis (ya está en dependencias; patrón listo en `tts/store.ts`). Añadir rate limit a `app/api/chat/route.ts`.
3. **CSP enforcing**: quitar Report-Only y `unsafe-inline/eval` de `next.config.ts:44-47` (requiere auditoría de scripts inline).
4. **Anti prompt-injection**: delimitar transcripts en prompts de feedback; caps ya cubiertos en F1.1.
5. **Escrituras de feedback server-side**: mover `completeAttempt`/`updateProfessorFeedback` fuera de `attemptMutationService.ts:68-87,288-302` (hoy el cliente escribe feedback con el cliente anon).
6. **RLS**: endurecer `case_personas`/`global_personas` (hoy `USING (true)`) y restringir columnas del UPDATE de profesores en attempts.

## F4 — Escalabilidad — ~2-4 días

1. **Autosave incremental**: reemplazar DELETE+reINSERT completo (O(n²)) por upsert por mensaje con id estable del cliente; envolver en RPC transaccional (`progress/route.ts:132-151`).
2. **Atómico select-then-insert en `POST /api/live/session`** (race multi-pestaña): RPC con `INSERT ... ON CONFLICT` o `FOR UPDATE SKIP LOCKED`.
3. **Paginación**: transcripts (`attempt_messages`), `GET /api/cases`, join anidado de `app/attempts/[id]/page.tsx:74`.
4. **Streaming en proxies**: TTS bufferizado (`tts/route.ts:122-128`) y chat/feedback con `create` completo → `stream: true` + `maxDuration` explícito.
5. **Job queue**: claim atómico con `FOR UPDATE SKIP LOCKED` (`scripts/process_jobs.js:31`) y cron configurado.
6. **Background jobs fiables**: retratos fire-and-forget (`cases/route.ts:239-240`) → encolar en `job_queue` en vez de promesas huérfanas.

## F5 — Pulido UX — ~2-3 días

1. Confirmación antes de "End session" + IntroDialog/briefing pre-sesión (paridad con chat clásico).
2. Captions de STT interino en vivo (hoy invisible — `useGeminiLive.ts:140-158`) + botón de interrupt.
3. Waveform con amplitud real; conectar `waveformMode` de `PersonaHeader` (props muertas).
4. Móvil: sidebar colapsable, permitir gesto del usuario antes de `getUserMedia` (riesgo iOS/Safari), revisar zoom bloqueado.
5. Accesibilidad: `aria-live` en banners, alternativa textual al waveform, tamaño mínimo de texto.
6. "Guided mode" real en Live (hoy solo persiste la flag; chat sí la consume).

## Orden de ejecución sugerido

```
F1 (hecho) → F2.1/F2.2 (resume roto afecta a cada usuario recurrente)
→ F3.1 (P0 seguridad) → F3.2 → F4.1/F4.2 (integridad de datos)
→ F3.3-F3.6 → F4.3-F4.6 → F5
```
