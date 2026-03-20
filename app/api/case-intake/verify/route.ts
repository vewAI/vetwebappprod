import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an expert veterinary clinical educator and case designer. You are reviewing a veterinary teaching case for an AI-powered clinical simulation platform where veterinary students will interact with AI personas (owner, nurse, lab technician) to practice clinical reasoning.

Your task: Perform a COMPREHENSIVE AUDIT of the case data for COMPLETENESS across ALL domains.

The case data includes:
- Case metadata: title, learner-facing summary, species, patient demographics
- Clinical data: history/details, physical exam findings, diagnostic results, imaging
- Educational data: differential diagnoses, educational prompts, feedback instructions
- Conversation prompts: owner background, diagnosis conversation, follow-up conversation

The student will be able to:
- Take a history from the owner persona
- Perform physical examination maneuvers (the nurse persona reports findings)
- Order laboratory tests (CBC, biochemistry, urinalysis, specific tests)
- Request imaging (radiography, ultrasound, endoscopy, etc.)
- Discuss treatment plans with the owner
- Receive formative feedback

### A. CASE METADATA & SUMMARY
- Is there a compelling case title? (descriptive, learner-friendly)
- Is there a clear, brief learner-facing summary? (one-paragraph overview that sets the scene)
- Are species/breed, patient name, age, sex all specified?

### B. CLINICAL HISTORY & PRESENTATION COMPLETENESS
For the given SPECIES, CONDITION, and CLINICAL CONTEXT:
- Is the onset documented? (acute, insidious, recurrent)
- Is the duration specified? (hours, days, weeks, months)
- Is progression described? (stable, worsening, intermittent)
- Are relevant dietary/management factors mentioned?
- Is prior medical history included? (vaccinations, deworming, previous illness, medications)
- Are environmental/exposure factors documented? (housing, other animals, travel)
- Are all cardinal clinical signs described in sufficient detail?

### C. PHYSICAL EXAMINATION COMPLETENESS
For each body system relevant to this pathology in this species:
- Is temperature documented with units (°C or °F)?
- Is heart rate documented with units (bpm)?
- Is respiratory rate documented with units (breaths/min)?
- Are mucous membranes and capillary refill time documented? (color, CRT seconds)
- Is body condition score documented? (scale used)
- Is hydration status assessed? (skin turgor, etc.)
- Are system-specific findings documented? (auscultation, palpation, percussion, neurological, ophthalmic, lameness, etc.)

For EACH documented finding, assess:
- Is it PRESENT in the data?
- Is it MISSING but MANDATORY (always checked for this presentation)?
- Is it MISSING but RECOMMENDED (frequently checked, high diagnostic value)?
- Is it OPTIONAL (useful but not essential)?
- Is it UNNECESSARY (low value)?

### D. DIAGNOSTIC & LABORATORY COMPLETENESS
For this pathology in this species, which tests are expected:
- CBC/Haematology: hemoglobin, hematocrit, WBC, differential, platelets
- Serum Chemistry: electrolytes, kidney values (BUN/creatinine), liver enzymes, glucose, albumin, globulins
- Urinalysis: specific gravity, pH, protein, glucose, ketones, crystals, casts, cells, bacteria
- Coagulation: PT, PTT, fibrinogen
- Blood Gas: pH, pCO2, pO2, HCO3, lactate
- Serology/Immunology: antibody tests, antigen tests
- Microbiology: culture, sensitivity, PCR tests
- Hormonal: thyroid (T3, T4, TSH), cortisol, specific hormone panels
- Special tests: SAA, fecal tests, biopsy results, specific disease markers

For EACH test category:
- Are mandatory tests documented with results, units, and reference ranges?
- Are recommended tests considered? (documented if performed, or explicitly noted as not performed)
- Are results clinically consistent with the diagnosis?

### E. IMAGING COMPLETENESS
- Are radiography findings documented? (which views, positive/negative findings)
- Are ultrasound findings documented? (which organs examined, findings)
- Are other imaging (CT, MRI, endoscopy, etc.) relevant and documented if performed?

### F. DIFFERENTIAL DIAGNOSES
- Is there a prioritized differential diagnosis list?
- For each differential: what findings support or refute it?
- Are there any "zebra" diagnoses considered?

### G. TREATMENT & MANAGEMENT
- Are treatment options documented? (medications, dosages, routes, frequencies)
- Is a treatment plan specified?
- Are biosecurity measures documented if applicable?
- Is prognosis information included?
- Are follow-up/monitoring plans described?

### H. EDUCATIONAL PROMPTS & CONVERSATIONS
- Is the "owner_background" populated with the owner's personality, concerns, communication style?
- Is the "owner_diagnosis" prompt defined (what the owner will discuss after diagnosis)?
- Is the "owner_follow_up_feedback" defined (feedback criteria)?
- Is the "get_history_feedback_prompt" populated (for evaluating student's history-taking)?
- Is the "description" (learner-facing summary) compelling and learner-friendly?

### I. CONSISTENCY & CLINICAL INTEGRITY
- Are all findings clinically coherent? (no contradictions)
- Do documented signs match the frequency profile of the suspected diagnosis?
- Is the severity progression realistic?

For each missing or incomplete item you identify:
1. targetField: the case field it belongs to (physical_exam_findings, diagnostic_findings, details, description, owner_background, get_owner_prompt, owner_follow_up_feedback, get_history_feedback_prompt, get_owner_follow_up_feedback_prompt, owner_diagnosis, owner_follow_up, history_feedback, etc.)
2. category: physical_exam | laboratory | imaging | history | treatment | differential_diagnosis | owner_communication | biosecurity | educational_prompt | other
3. itemName: specific item name (e.g., "Serum Amylase", "Heart Rate", "Owner Personality Background")
4. relevance: mandatory | recommended | optional | unnecessary
5. expectedFrequency: always | usually | sometimes | rarely | never
6. alreadyPresent: boolean
7. existingValue: the value from the case if present (first 200 chars if long)
8. reasoning: why this item matters for this specific case
9. suggestedPrompt: a conversational question to ask the professor (IN ENGLISH) to get this data

Return JSON:
{
  "species": "string",
  "condition": "string",
  "region": "string or empty",
  "overallAssessment": "2-3 sentence summary IN ENGLISH",
  "completenessScore": number 0-100,
  "items": [...],
  "counts": { "mandatory": N, "recommended": N, "optional": N, "unnecessary": N, "alreadyPresent": N, "missing": N }
}

IMPORTANT:
- Be thorough. Generate 20-50 items depending on case complexity.
- Sort items: mandatory missing first, then recommended missing, then optional missing, then mandatory present, then recommended present, then optional present, then unnecessary items.
- Flag any items that have missing data even if they seem less important (e.g., description, educational prompts).
- For educational prompts and conversation data, be specific about what's missing (e.g., "Owner's attitude toward surgery" if it's not documented).`;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin" && auth.role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const caseData = body.caseData;

    if (!caseData || typeof caseData !== "object") {
      return NextResponse.json(
        { error: "caseData is required" },
        { status: 400 }
      );
    }

    const species = String(caseData.species ?? "").trim();
    const condition = String(caseData.condition ?? "").trim();

    if (!species || !condition) {
      return NextResponse.json(
        { error: "Species and condition are required for verification." },
        { status: 400 }
      );
    }

    const userPayload = {
      species: caseData.species ?? "",
      condition: caseData.condition ?? "",
      category: caseData.category ?? "",
      details: caseData.details ?? "",
      physical_exam_findings: caseData.physical_exam_findings ?? "",
      diagnostic_findings: caseData.diagnostic_findings ?? "",
      owner_background: caseData.owner_background ?? "",
      history_feedback: caseData.history_feedback ?? "",
      tags: caseData.tags ?? "",
      patient_name: caseData.patient_name ?? "",
      patient_age: caseData.patient_age ?? "",
      patient_sex: caseData.patient_sex ?? "",
      title: caseData.title ?? "",
    };

    let response;
    let lastError: Error | null = null;
    
    // Try gpt-4o-mini first, fallback to gpt-3.5-turbo if project doesn't have access
    for (const model of ["gpt-4o-mini", "gpt-3.5-turbo"]) {
      try {
        response = await openai.chat.completions.create({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(userPayload, null, 2) },
          ],
        });
        break; // Success, exit loop
      } catch (err) {
        lastError = err as Error;
        const errorMsg = lastError.message || String(lastError);
        if (errorMsg.includes("404") || errorMsg.includes("does not have access")) {
          // Model not available, try next one
          continue;
        } else {
          // Other error, don't retry
          throw err;
        }
      }
    }

    if (!response) {
      const msg = lastError?.message || "No model available for verification";
      return NextResponse.json(
        { error: msg },
        { status: 502 }
      );
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "LLM returned no content" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(content);

    // Validate and normalize the response
    const result = {
      species: String(parsed.species ?? species),
      condition: String(parsed.condition ?? condition),
      region: String(parsed.region ?? ""),
      overallAssessment: String(parsed.overallAssessment ?? ""),
      completenessScore: Math.max(
        0,
        Math.min(100, Number(parsed.completenessScore) || 0)
      ),
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id ?? `item-${idx + 1}`),
            targetField: String(item.targetField ?? "details"),
            category: String(item.category ?? "other"),
            itemName: String(item.itemName ?? ""),
            relevance: String(item.relevance ?? "optional"),
            reasoning: String(item.reasoning ?? ""),
            expectedFrequency: String(item.expectedFrequency ?? "sometimes"),
            alreadyPresent: Boolean(item.alreadyPresent),
            existingValue: String(item.existingValue ?? ""),
            suggestedPrompt: String(item.suggestedPrompt ?? ""),
            professorAnswer: "",
            status: "pending",
          }))
        : [],
      counts: parsed.counts ?? {
        mandatory: 0,
        recommended: 0,
        optional: 0,
        unnecessary: 0,
        alreadyPresent: 0,
        missing: 0,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
