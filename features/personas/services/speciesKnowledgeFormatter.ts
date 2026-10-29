import type { NurseSpecialization } from "@/features/personas/models/nurseSpecialization";
import { formatBundledTestsForPrompt, type BundledTestsMap } from "@/features/personas/utils/bundledTests";

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

  const bundled = (specialization.metadata?.bundled_tests ?? (specialization as any).bundled_tests ?? specialization.bundledTests) as BundledTestsMap | undefined;
  if (bundled && Object.keys(bundled).length > 0) {
    sections.push(formatBundledTestsForPrompt(bundled, specialization.speciesKey));
  }

  if (specialization.commonPathologies && specialization.commonPathologies.length > 0) {
    const lines = specialization.commonPathologies.map((p) => `- ${p}`).join("\n");
    sections.push(`COMMON PATHOLOGIES (${specialization.speciesKey ?? "unknown species"}):\n${lines}`);
  }

  if (specialization.skills && specialization.skills.length > 0) {
    const names = specialization.skills.map((s) => s.name).join(", ");
    sections.push(`SPECIALIZED SKILLS: ${names}`);
  }

  // Clinical simulation rules: author specifies abnormal findings; unspecified panel analytes are simulated within nurse reference ranges
  sections.push(
    `DIAGNOSTIC & CLINICAL SIMULATION INSTRUCTIONS FOR NURSE:\n` +
    `1. Ground-Truth Pathological Findings: The patient's authored diagnostic_findings and physical_exam_findings contain the true abnormal/pathological findings for this case. Always report these authored abnormal findings faithfully.\n` +
    `2. Auto-Simulation of Unspecified Normal Values: Authors only specify the abnormal/pathological values for a case. When a student requests a laboratory profile or panel (e.g. CBC/haematology, biochemistry, blood gas, urinalysis, peritoneal/pleural/synovial fluid, tracheal wash, BAL, CSF) and certain parameters within that test were NOT explicitly specified in the case, those unspecified parameters are CLINICALLY NORMAL for this patient. You must simulate realistic numeric values that fall safely WITHIN the species LAB REFERENCE RANGES above.\n` +
    `3. Reference Ranges: When reporting laboratory or vital results to the student, state the measured value along with your reference range so the student can evaluate whether it is normal or abnormal (e.g. "Albumin: 32 g/L (ref 28-38 g/L)").`
  );

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
