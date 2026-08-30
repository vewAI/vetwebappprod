# Evaluación: UX, Seguridad y Escalabilidad — Sesiones Live

> Fecha: 2026-08-29 · Rama: `merge/live-integration` (live + feature/live-persistence FASE 0-4)

## 1. UX de sesiones Live

### Flujo end-to-end
- **Entrada**: `/live` — grilla de casos con badge "LIVE", filtro por disciplina (`app/live/page.tsx:16,134-143`).
- **Pre-carga**: `/live/[id]` carga caso + etapas y crea/reanuda attempt vía `POST /api/live/session` (`app/live/[id]/page.tsx:46-128`).
- **Sesión**: pantalla completa fija, sidebar de progreso, `PersonaHeader`, `AudioWaveform`, transcript, `LiveControls` (avatares/mic/Next Stage/colgar), `Notepad` overlay (`live-session.tsx:524-704`).
- **Cierre**: `handleEndSession` guarda progreso, marca `completed` y abre diálogo de feedback (`live-session.tsx:414-446`).

### Progresión de etapas
- Mínimos de turnos por tipo: history 6, physical 8, resto 5 (`useLiveProgress.ts:7-15`).
- "Next Stage" deshabilitado hasta `canAdvance`; hint una vez por etapa; avance **manual con confirmación** ("Did you finish with the {rol}?").
- Volver atrás permitido solo a etapas ≤ actual; al avanzar se resetean turnos y override de persona.

### Personas / roles
- Mapeo etapa→persona (history→owner, physical→nurse, diagnostic→owner, laboratory→lab, treatment→nurse, communication→owner) (`features/live/types.ts:68-75`).
- Avatares OWNER/NURSE/LAB alrededor del mic; switch a mitad de sesión sin cortar audio si la voz no cambia (`useGeminiLive.ts:277-304`); banner "X is joining…" 2,5 s.
- Transcript etiquetado por rol con retrato (`mergeAssistantFragment.ts:39-52`).

### Voz / audio
- AudioWorklet 16 kHz PCM16 con fallback ScriptProcessor; echo cancellation + noise suppression.
- Modo texto con Enter/Shift+Enter, maxLength 2000.
- Timer por segundo; indicador "Still connected…" tras 30 s de inactividad.

### Transcript / persistencia
- Autosave con debounce 2 s; export .md/.txt/portapapeles; Notepad solo localStorage.

### Feedback
- Solo global (no por etapa), generado por OpenAI, markdown→HTML con marked+DOMPurify server-side, export PDF.

### Debilidades UX detectadas
| # | Problema | Referencia |
|---|----------|-----------|
| U1 | **BUG: feedback live roto** — la ruta espera `transcript` pero el cliente envía `messages` → siempre cae al fallback y nunca se genera feedback real | `app/api/live/feedback/route.ts:49-59` vs `app/live/[id]/page.tsx:140-147` |
| U2 | Mute no silencia turnos futuros (`player.stop()` y el siguiente `enqueue` reactiva el audio) | `live-session.tsx:448-453`, `useAudioPlayer.ts:90` |
| U3 | Resume degrada: se pierden `personaRoleKey`/`portraitUrl` (sin retratos tras reanudar), el modelo no recibe replay del contexto, timer reinicia a 0 | `app/api/live/session/route.ts:44-52`, `live-session.tsx:334` |
| U4 | Al reanudar, `turnCount` infla con mensajes históricos → "Next Stage" se desbloquea de inmediato | `live-session.tsx:353-361` |
| U5 | Móvil: zoom bloqueado, sidebar sin colapso, auto-connect+mic sin gesto del usuario (riesgo iOS/Safari) | `app/live/[id]/layout.tsx:12`, `live-session.tsx:183-242` |
| U6 | Sin captions de STT interino (el usuario no ve lo que dice hasta confirmar) ni botón de barge-in/interrupt | `useGeminiLive.ts:45-46,140-158` |
| U7 | Accesibilidad: banners sin `aria-live`, waveform decorativa sin alternativa textual, textos de 10px | `live-controls.tsx:142` |
| U8 | "End session" sin confirmación; sin IntroDialog/briefing previo (el chat clásico sí lo tiene) | `live-session.tsx:414-446` |
| U9 | Waveform decorativa (senos, no amplitud real); props muertas en `PersonaHeader` | `audio-waveform.tsx:44-105`, `persona-header.tsx:12` |

---

## 2. Seguridad

### Autenticación (sólida)
- Supabase Auth + Passkeys WebAuthn opcionales; `requireUser` valida Bearer server-side contra `supabase.auth.getUser` y resuelve rol desde `profiles` con service-role, **sin confiar en `user_metadata`** (`app/api/_lib/auth.ts:81-197`).
- `requireAdmin` para endpoints billables admin (`auth.ts:199-232`).
- Sin `middleware.ts`: cada handler se autoprotege (verificado: solo 5 rutas sin helper, todas justificadas o gated por env).

### Flujo del token Live — **P0 CRÍTICO**
- `app/api/live/token/route.ts:158` devuelve `process.env.GEMINI_API_KEY` **en crudo** al navegador: sin expiración, sin binding a sesión, reutilizable hasta rotación. El comentario del propio archivo lo reconoce como fix parcial pendiente de proxy WS.
- Mitigaciones actuales: `requireUser`, allowlist de Origin strict-deny en producción, rate limit 3/60s, validación de caso (con soft-fail ante error de BD, `:152-154`).

### Autorización
- `authorizeAttemptAccess` (owner/admin, profesor read-only si es tutor del estudiante) — bien aplicado en view/feedback/session PATCH (`app/api/_lib/authorization.ts:21-73`).
- **Gap**: `live/feedback` no verifica ownership del caso ni limita tamaño del transcript; es endpoint billable (OpenAI) (`app/api/live/feedback/route.ts:49-59`). `overall-feedback` igual (solo rate limit). `chat` no tiene rate limit.

### Rate limiting
- Sliding window en **Map en memoria por proceso** (`app/api/_lib/rateLimit.ts:1-29`) — no autoritativo en serverless; el comentario admite migrar a Redis. Redis solo se usa en TTS store.

### Validación / sanitización
- Zod solo en `admin/users`; resto manual.
- **Correcto**: live/feedback y feedback sanea markdown con marked+DOMPurify server-side (allowlist estricta) antes de persistir.
- **Gap stored XSS**: `overall-feedback` aún usa regex-chain **sin DOMPurify** (`app/api/overall-feedback/route.ts:144-161`) y `attemptMutationService.ts:68-87,288-302` escribe `overall_feedback`/`professor_feedback` **desde el cliente** → renderizado con `dangerouslySetInnerHTML` en 4 componentes.
- Prompt injection: transcripts interpolados sin delimitadores; el cliente controla por completo la system instruction del Live (`geminiLiveService.ts:170-185`).

### RLS / DB
- `db/security_hardening_p0.sql` sólido: `current_profile_role()` SECURITY DEFINER, trigger anti-escalada de rol, políticas own-or-admin, REVOKE INSERT.
- **Permisivo**: `case_personas`/`global_personas` con `FOR ALL USING (true)` (`db/fix_rls_policies.sql`); profesores con UPDATE sin restricción de columnas en attempts.

### Headers
- nosniff, DENY, Referrer-Policy, HSTS en prod ✓ — **CSP solo Report-Only con unsafe-inline/eval** (`next.config.ts:44-47`) → no mitiga XSS hoy.

### Prioridades de seguridad
1. **P0**: proxy WS server-side para Gemini + rotación de la API key expuesta.
2. **P0/P1**: DOMPurify en `overall-feedback` + mover escrituras de feedback a server-side.
3. **P1**: CSP en enforcing; rate limits a Redis; añadir rate limit a `chat`.
4. **P2**: caps de tamaño en `live/feedback`; ownership check; delimitadores anti prompt-injection.
5. **P3**: `.env.example` incompleto (faltan `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `TTS_STREAM_SIGNING_SECRET`, `REDIS_URL`, etc.).

---

## 3. Escalabilidad

### Arquitectura (punto fuerte)
- Despliegue serverless (Vercel) inferido; el diseño de Live **descarga el audio bidireccional al navegador** (WSS directo a Gemini desde el cliente) — el server solo orquesta auth, token, persistencia y feedback. Escala bien por diseño.

### Datos
- Supabase/Postgres; Redis solo para TTS store (TTL 2 min). Cliente Supabase + query de rol creados **por request** (`app/api/_lib/auth.ts:92-147`).

### Tiempo real
- Sin Supabase Realtime ni WS propio; el estado canónico vive en el cliente. Autosave envía la **transcripción completa** con DELETE+reINSERT de todos los mensajes, **sin transacción** (`app/api/attempts/progress/route.ts:132-151`).

### Concurrencia — riesgos
- Avance de etapas es estado local sin locking.
- Race real: dos pestañas reanudan el mismo attempt (select-then-insert no atómico, `session/route.ts:22-69`) y ambos autosavean → último write gana, DELETE/INSERT pueden intercalarse.

### Cuellos de botella priorizados
| # | Problema | Referencia |
|---|----------|-----------|
| E1 | Autosave O(n²): reenvía y reescribe toda la transcripción cada 2 s de debounce | `live-session.tsx:141-152`, `progress/route.ts:132-151` |
| E2 | Rate limits en memoria en serverless (inefectivos entre instancias) | `rateLimit.ts:1-17`, `token/route.ts:75-79` |
| E3 | Sin índices para consultas hot: `attempts(user_id, case_id, completion_status)`, `attempt_messages(attempt_id)`; DDL de esas tablas fuera del repo | `session/route.ts:22-30` |
| E4 | Sin paginación: transcripts y `GET /api/cases` completos (`select(*)` sin límite) | `cases/route.ts:121`, `app/attempts/[id]/page.tsx:74` |
| E5 | Proxies no streaming (TTS bufferizado, chat/feedback con `create` completo) sujetos a `maxDuration` default sin configurar | `tts/route.ts:122-128`, `chat/route.ts:970` |
| E6 | Job queue sin claim atómico (`FOR UPDATE SKIP LOCKED`) + worker manual fuera del deploy | `scripts/process_jobs.js:31,71-74` |
| E7 | Background fire-and-forget en serverless (retratos) puede no completarse | `cases/route.ts:239-240` |

---

## 4. Plan de acción sugerido (por ROI)

### Quick wins (horas)
1. **Fix feedback live**: enviar `transcript` (o aceptar `messages`) + ownership check + caps de tamaño (arregla U1 y gap de seguridad a la vez).
2. DOMPurify en `overall-feedback` (1 línea de igualación con live/feedback).
3. Fix mute: flag `mutedRef` en `enqueue` o stop a nivel de hook.
4. Índices SQL: `attempts(user_id, case_id, completion_status)`, `attempt_messages(attempt_id)`.
5. Persistir `persona_role_key` en `attempt_messages` (resume con retratos).

### Estructurales (días)
6. Proxy WS server-side para Gemini (elimina P0 de seguridad y habilita rate limiting real).
7. Rate limiting a Redis (ya está en dependencias).
8. Autosave incremental (upsert por mensaje con `id` del cliente) en vez de reescritura completa.
9. Replay de contexto al modelo en resume + turnCount desde `last_stage_index`.
10. CSP en enforcing + middleware.ts de refuerzo.
