import type { Stage } from "@/features/stages/types";
import { STAGE_TYPE_TO_PERSONA } from "../types";

const OWNER_HINTS = ["history", "owner", "client", "communication", "diagnostic"];
const LAB_HINTS = ["lab", "laboratory"];
const NURSE_HINTS = ["nurse", "physical", "treatment", "exam", "technician", "test"];

/** Resolve the default persona for a Live stage. */
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

  return stage.personaRoleKey ?? "veterinary-nurse";
}
