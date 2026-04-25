import type { NurseSpecialization } from "@/features/personas/models/nurseSpecialization";

/**
 * Formats species-specific clinical knowledge from a nurse specialization
 * into a prompt section suitable for injection into AI system instructions.
 */
export function formatSpeciesKnowledgePrompt(specialization: Partial<NurseSpecialization>): string {
  const sections: string[] = [];

  if (specialization.vitalReferenceRanges && Object.keys(specialization.vitalReferenceRanges).length > 0) {
    const lines = Object.entries(specialization.vitalReferenceRanges)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    sections.push(`SPECIES NORMAL VITALS (${specialization.speciesKey ?? "unknown species"}):\n${lines}`);
  }

  if (specialization.labReferenceRanges && Object.keys(specialization.labReferenceRanges).length > 0) {
    const lines = Object.entries(specialization.labReferenceRanges)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    sections.push(`LAB REFERENCE RANGES (${specialization.speciesKey ?? "unknown species"}):\n${lines}`);
  }

  if (specialization.commonPathologies && specialization.commonPathologies.length > 0) {
    const lines = specialization.commonPathologies.map((p) => `- ${p}`).join("\n");
    sections.push(`COMMON PATHOLOGIES (${specialization.speciesKey ?? "unknown species"}):\n${lines}`);
  }

  if (specialization.skills && specialization.skills.length > 0) {
    const names = specialization.skills.map((s) => s.name).join(", ");
    sections.push(`SPECIALIZED SKILLS: ${names}`);
  }

  if (sections.length === 0) return "";

  return sections.join("\n\n");
}

/**
 * Extracts nurse specialization data from persona metadata.
 * The metadata may contain { nurseSpecialization: { ... } } stored
 * by applySpecializedNurse().
 */
export function extractSpecializationFromMetadata(metadata: Record<string, unknown> | null | undefined): Partial<NurseSpecialization> | null {
  if (!metadata || typeof metadata !== "object") return null;

  const spec = metadata["nurseSpecialization"];
  if (!spec || typeof spec !== "object") return null;

  return spec as Partial<NurseSpecialization>;
}
