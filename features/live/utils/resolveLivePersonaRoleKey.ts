import type { Stage } from "@/features/stages/types";
import { STAGE_TYPE_TO_PERSONA } from "../types";

const OWNER_HINTS = ["history", "owner", "client", "communication", "diagnostic"];
const LAB_HINTS = ["lab", "laboratory"];
const NURSE_HINTS = ["nurse", "physical", "treatment", "exam", "technician", "test"];

/**
 * Resolve which persona answers for a given stage in the live session.
 *
 * Resolution order:
 * 1. `settings.stage_type` → `STAGE_TYPE_TO_PERSONA` (authoritative when known)
 * 2. DB `personaRoleKey` (explicit per-stage intent)
 * 3. Title/role keyword inference (e.g. "History Taking" → owner). This is the
 *    fallback that keeps the first stage talking to the OWNER when the DB rows
 *    or config don't carry stage_type/personaRoleKey (the case-config stages
 *    don't, so without this every stage used to resolve to the nurse).
 */
export function resolveLivePersonaRoleKey(stage: Stage | undefined | null): string {
  if (!stage) return "veterinary-nurse";

  const settings = stage.settings as Record<string, unknown> | undefined;
  const stageType = typeof settings?.stage_type === "string" ? settings.stage_type : "";
  if (stageType) {
    const mapped = STAGE_TYPE_TO_PERSONA[stageType];
    if (mapped) return mapped;
  }

  if (stage.personaRoleKey) return stage.personaRoleKey;

  const text = `${stage.title ?? ""} ${stage.role ?? ""}`.toLowerCase();
  if (OWNER_HINTS.some((hint) => text.includes(hint))) return "owner";
  if (LAB_HINTS.some((hint) => text.includes(hint))) return "lab-technician";
  if (NURSE_HINTS.some((hint) => text.includes(hint))) return "veterinary-nurse";
  return "veterinary-nurse";
}
