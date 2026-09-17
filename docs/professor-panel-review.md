# Informe: Panel de Profesores — estado, funcionalidades y mejoras
_Análisis del código actual (rama de pruebas, build b2a3ec2+). Sin cambios de código._

---

## 1. Mapa del panel — qué existe y dónde

| Sección | Ruta | Qué hace |
|---------|------|----------|
| **Dashboard** | `/professor` | KPIs (analytics, casos asignados, estudiantes, reseñas pendientes), actividad reciente, notificaciones, accesos rápidos (crear estudiante/caso, crear curso) |
| **Cursos** | Dashboard → Courses | Crear, editar, archivar/restaurar, borrar; matricular estudiantes en lote (solo no-matriculados, con buscador); asignar casos al curso (auto-asigna a los inscriptos); dashboard por curso: KPIs, rendimiento por estudiante, completado por caso, tendencias, export CSV |
| **Estudiantes** | Dashboard → My Students | Lista de los estudiantes del profesor (relación professor_students), progreso por estudiante (`/professor/students/[id]`), crear estudiantes con contraseña |
| **Sesiones** | `/professor/sessions` | Crear sesiones (caso + ventana horaria + código de acceso + límite de intentos), gestionar, unirse/preview; detalle con tabla de intentos por estudiante, gráficos (intentos/día, estados) y **reporte grupal IA** |
| **Estudiante individual** | `/professor/students/[id]` | Historial de intentos, análisis de evolución (IA), **hilo de feedback profesor↔estudiante por caso** (mensajería 1:1) |
| **Reseñas pendientes** | Card del dashboard | Intentos completados esperando revisión, con acceso directo |
| **Casos** | `/case-viewer` (desde Admin) | Ver/editar/archivar/restaurar casos; crear casos nuevos |

---

## 2. Qué funciona ya

| Funcionalidad | Estado |
|---------------|--------|
| Crear/gestionar cursos con archivo y restore | ✅ (fix de esta semana) |
| Matricular estudiantes en lote (lista de no-matriculados, buscador) | ✅ (fix de esta semana) |
| Asignar casos a curso → auto-asignación a inscriptos | ✅ |
| Stats por curso (KPIs, por estudiante, por caso, tendencias, CSV) | ✅ |
| Crear sesiones con código de acceso, ventana horaria y límite de intentos | ✅ |
| Tabla de intentos por estudiante + gráficos en la sesión | ✅ |
| **Reporte grupal IA** (fortalezas, debilidades rankeadas, objetivos, temas para el wrap-up) con Gemini | ✅ (nuevo) |
| Hilo de feedback profesor↔estudiante por caso | ✅ |
| Reseñas pendientes con acceso directo | ✅ |
| Notificaciones y actividad reciente | ✅ |
| Análisis de evolución por estudiante (IA) | ⚠️ roto: usa OpenAI sin créditos (migrable a Gemini, mecánico) |

---

## 3. Qué está roto o a medio hacer

| # | Ítem | Detalle |
|---|------|---------|
| 1 | **Evolución de estudiantes (IA)** | Ruta `student-evolution` sigue en OpenAI → sin créditos devuelve el mensaje de no-configurado. Migración a Gemini: mecánica con el helper existente |
| 2 | **Stage types en la BD** | Ya resuelto con backfill + inferencia por título en Live. Pendiente: el Case Stage Manager detecta el tipo en la UI pero no lo persiste si el profesor no cambia el dropdown manualmente (mejora menor de UX) |
| 3 | **Objetivos de aprendizaje agregados** | El reporte grupal los cubre narrativamente; no hay vista estructurada (matriz estudiante × objetivo) — posible mejora |
| 4 | **Case-entry para profesores** | El botón "Create New Case" del dashboard apunta a `/case-entry` — verificar que profesores tengan permiso de creación (hoy es flujo de admin) |

---

## 4. La visión de Marco vs. lo implementado

| Lo que Marco pidió | Estado |
|--------------------|--------|
| "Create a session for 3 students this afternoon" | ✅ Sesiones con código de acceso + ventana horaria |
| "See how many students have done it" | ✅ Tabla de intentos + gráficos en la sesión |
| "Collate the feedback" | ✅ Panel acumulativo + transcript por intento |
| "AI recommends what to discuss in class based on what they got wrong" | ✅ Reporte grupal IA (sección "Recommended discussion topics") |
| "Feedback focussed on learning objectives" | ✅ Objetivos por caso + sección de cobertura en el feedback (F6.1/6.2) |
| "Professor chats with the AI about the feedback" | Descartado por Marco — el reporte grupal lo cubre |
| Moodle | Postergado — los objetivos se cargan por caso |

---

## 5. Recomendaciones priorizadas

1. **Migrar `student-evolution` a Gemini** (helper existente, ~30 min) — única funcionalidad del panel caída hoy
2. **Verificar permisos de creación de casos para profesores** (`/case-entry`) — probar con una cuenta professor
3. **Matriz de objetivos** (mejora): vista estructurada estudiante × objetivo en la sesión, alimentada por el feedback (hoy vive dentro del texto del reporte)
4. **Persistir el stage type detectado** en el Stage Manager al guardar (hoy solo se detecta en UI)
5. **Moodle**: dejar para cuando el volumen de casos lo justifique

---

## 6. Conclusión

El panel cubre el ciclo completo que Marco describió: **crear sesión → estudiantes la completan → profesor ve progreso y feedback → reporte grupal IA para el wrap-up** — con objetivos de aprendizaje integrados al feedback. Los pendientes son refinamientos: una migración mecánica a Gemini, la matriz estructurada de objetivos, y verificar permisos de creación de casos para profesores.
