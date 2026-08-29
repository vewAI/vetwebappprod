import type { Stage } from "@/features/stages/types";
import { STAGE_TYPE_TO_PERSONA } from "../types";

const OWNER_HINTS = ["history", "owner", "client", "communication", "diagnostic"];
const LAB_HINTS = ["lab", "laboratory"];
const NURSE_HINTS = ["nurse", "physical", "treatment", "exam", "technician", "test"];

/**
 * Resolve which persona answers for a given stage in the live session.
 *
 * Resolution order (most authoritative first):
 * 1. `settings.stage_type` → `STAGE_TYPE_TO_PERSONA`
 * 2. Title/role keyword inference (e.g. "History Taking" → owner). This is what
 *    makes the FIRST stage always talk to the OWNER, even when the DB row's
 *    `persona_role_key` was left as "veterinary-nurse".
 * 3. DB `personaRoleKey` — used only when the title gives no signal (custom stages).
 */
export function resolveLivePersonaRoleKey(stage: Stage | undefined | null): string {
  if (!stage) return "veterinary-nurse";

  const settings = stage.settings as Record<string, unknown> | undefined;
  const stageType = typeof settings?.stage_type === "string" ? settings.stage_type : "";
  if (stageType) {
    const mapped = STAGE_TYPE_TO_PERSONA[stageType];
    if (mapped) return mapped;
  }

  const text = `${stage.title ?? ""} ${stage.role ?? ""}`.toLowerCase();
  if (OWNER_HINTS.some((hint) => text.includes(hint))) return "owner";
  if (LAB_HINTS.some((hint) => text.includes(hint))) return "lab-technician";
  if (NURSE_HINTS.some((hint) => text.includes(hint))) return "veterinary-nurse";

  if (stage.personaRoleKey) return stage.personaRoleKey;

  return "veterinary-nurse";
}
