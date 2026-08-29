# Merge Strategy: `feature/live-persistence` → `live`

> **Objetivo:** reconciliar las dos líneas de trabajo divergidas (merge-base `603e934`, 29 mayo) en una sola rama `live` estable, sin perder seguridad, arquitectura ni fixes de UX de ningún lado.

---

## 1. Mapa de superposición funcional (hallazgos del análisis)

| Capability | `live` (hasta Ago 19) | `feature/live-persistence` (hasta Ago 9) | Ganador |
|---|---|---|---|
| Persistencia de mensajes | ✅ implementación propia | ✅ FASE 1 (nativa sobre `Message[]`) | **persistence** (arquitectura) |
| Modelo de datos | `TranscriptEntry[]` (viejo) | `Message[]` (alineado con chat) | **persistence** |
| Sanitización XSS feedback | ✅ `marked` + `DOMPurify` | ✅ `marked` + `isomorphic-dompurify` | **persistence** (funciona SSR+client; live's `dompurify` es client-only) |
| Hardening API (auth, rate limit, safeFetch) | ✅ `d2919e4` — módulos nuevos `app/api/_lib/*` (48 archivos) | ⚠️ FASE 0 parcial (origin allowlist en token) | **live** (más completo y reciente) |
| Notepad | ✅ | ✅ | Empate (misma key, trivial) |
| Sidebar progreso | `LiveProgressSidebar` propio | `ProgressSidebar` del chat (paridad) | **persistence** (objetivo del plan: 1:1 parity) |
| PersonaTabs / switching | switching propio | PersonaTabs cross-tab | **persistence** + portar fixes de live |
| AudioWorklet (FASE 4) | ❌ ScriptProcessor (deprecated) | ✅ | **persistence** (única implementación) |
| Streaming en tiempo real | ✅ `a627aec` | ❌ | **live** (única implementación) |
| Next Stage gating + disclaimers filter | ✅ `ade06c1` | ⚠️ FASE 2.6 evaluator | Reconciliar (ambos criterios) |
| Token endpoint | ✅ `6248a52` restaurado | ✅ FASE 0 (ephemeral-style) | **live** + verificar allowlist |

**52 hunks de conflicto en 12 archivos + package-lock.** Los pesados: `live-session.tsx` (16), `useGeminiLive.ts` (12), `live-controls.tsx` (9).

---

## 2. Regla general de resolución

```
API routes / seguridad        → gana LIVE   (d2919e4 es más nuevo y completo)
Modelo de datos / types       → gana PERSISTENCE  (Message[] es la arquitectura objetivo)
Hooks de audio (micro)        → gana PERSISTENCE  (AudioWorklet, único)
Componentes UI (session,      → manual: base PERSISTENCE + portar
  controls, transcript)          fixes de LIVE (streaming, Next Stage, filter)
package-lock.json             → regenerar (npm install), NUNCA merge a mano
```

---

## 3. Plan por fases

### FASE A — Preparación (sin riesgo, ~15 min)
1. Tags de respaldo:
   ```powershell
   git tag pre-merge/live origin/live
   git tag pre-merge/persistence origin/feature/live-persistence
   git push origin pre-merge/live pre-merge/persistence
   ```
2. Rama de integración:
   ```powershell
   git checkout -b merge/live-integration origin/live
   ```
3. **Unificar dependencias ANTES del merge** en la rama de integración:
   - Quitar `dompurify` (client-only), dejar `marked` + `isomorphic-dompurify`
   - `npm install` → commit → así el conflicto de lockfile desaparece

### FASE B — Merge mecánico (~1 h)
4. `git merge --no-ff origin/feature/live-persistence`
5. Resolver por categoría en este orden (de menos a más riesgo):
   | Orden | Archivos | Estrategia |
   |---|---|---|
   | 1 | `package.json`, `package-lock.json` | Debe quedar auto-resuelto por FASE A.3 |
   | 2 | `features/live/types.ts` (1 hunk) | persistence: `messages: Message[]` |
   | 3 | `app/api/live/feedback/route.ts` (1 hunk) | live (ya sanitiza) — verificar export del sanitizador |
   | 4 | `app/api/live/token/route.ts` (2) | live + portar origin-allowlist de FASE 0 si falta |
   | 5 | `app/api/live/session/route.ts` (2) | persistence (persistencia de messages) + auth check de live |
   | 6 | `app/live/[id]/page.tsx` (2) | persistence (hydrate) + props de live |
   | 7 | `live-transcript.tsx` (2), `resolveLivePersonaRoleKey.ts` (2), `transcriptExport.ts` (2) | persistence; diff add/add pequeño |
   | 8 | `usePersonaSwitcher.ts` (3) | persistence + reconnect优化 de live |
   | 9 | `live-controls.tsx` (9) | persistence (orden del plan) + botones/streaming de live |
   | 10 | `useGeminiLive.ts` (12) | persistence (`messages` model) + streaming events de live (`a627aec`) |
   | 11 | `live-session.tsx` (16) | la más fina — ver FASE C |

### FASE C — Reconciliación de `live-session.tsx` (crítica, ~2–3 h)
12. Tomar la versión de **persistence** como base (arquitectura FASE 1–3).
13. Portar desde **live** estos comportamientos (verificar uno por uno):
    - [ ] Streaming de audio en tiempo real (`a627aec`)
    - [ ] Role labeling en transcript
    - [ ] Gating de Next Stage deshabilitado hasta cumplir mínimos (`ade06c1`)
    - [ ] Filtro de disclaimers (`filterLiveResponse` de live)
    - [ ] Guard de reconexión en `handleEndSession` (de FASE 0 P0.3, ya en persistence)
    - [ ] `[SYS_TRIGGER]` al cambiar a owner en stage change
14. `npx tsc --noEmit` → 0 errores en `features/live/**`

### FASE D — Validación (~1 h)
15. `npm test` — sin regresiones
16. Smoke manual (checklist):
    - [ ] Reload a mitad de sesión → mensajes restaurados
    - [ ] History → OWNER habla primero; cambio a Physical → nurse
    - [ ] Mic funciona (AudioWorklet activo, sin warning ScriptProcessor en consola)
    - [ ] Next Stage deshabilitado hasta mínimos; habilitado después
    - [ ] Notepad persiste por case+attempt
    - [ ] DevTools Network: sin API key en requests
    - [ ] Export transcript descarga .md
17. Push de `merge/live-integration` → probar en **preview de Vercel** (no prod)
18. Si todo ok: `git checkout live && git merge --no-ff merge/live-integration && git push origin live`
19. Borrar rama de integración; `feature/live-persistence` queda congelada (solo historia)

---

## 4. Rollback

Si algo sale mal post-deploy:
```powershell
git revert -m 1 <merge-commit-sha>   # revert del merge en live
# o reset al tag:
git reset --hard pre-merge/live && git push --force-with-lease origin live
```

---

## 5. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Doble implementación de persistencia genera duplicados en `attempts.messages` | FASE C.13: dejar UN solo camino de guardado (el de persistence, debounced) |
| `Message[]` vs `TranscriptEntry` en consumidores externos (`app/live/[id]/page.tsx`) | grep de `TranscriptEntry` post-merge; debe quedar 0 referencias |
| Sanitizadores distintos (DOMPurify vs isomorphic) | Unificar en `isomorphic-dompurify`; quitar `dompurify` de deps |
| Streaming (live) asumía `TranscriptEntry` | Adaptar handlers de streaming al modelo `Message` |
| AudioWorklet asset no encontrado en build de Vercel | persistence ya tiene fallback a ScriptProcessor; verificar consola en preview |
