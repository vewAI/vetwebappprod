import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { requireUser } from "@/app/api/_lib/auth";

const SYSTEM_PROMPT = `You are an expert veterinary clinical educator and case designer. You are reviewing a veterinary teaching case for an AI-powered clinical simulation platform where veterinary students will interact with AI personas (owner, nurse, lab technician) to practice clinical reasoning.

Your task: Perform a COMPREHENSIVE AUDIT of the case data for COMPLETENESS across ALL domains.

CRITICAL — DATA vs EDUCATIONAL INSTRUCTIONS DISTINCTION:
Distinguish between TWO types of "missing":
1. **MISSING CLINICAL DATA** = Information that does not exist anywhere in the case (not in source text, not in structured fields). Examples: "Exact antibiotic dosages", "Owner's cost estimate", "Heart rate value". These are genuine gaps.
2. **MISSING EDUCATIONAL INSTRUCTIONS** = Information exists in the case, but lacks explicit teaching guidance. Examples: "The treatment protocol is described but lacks step-by-step student instructions", or "Owner's anxiety is stated as 'Moderate' but lacks detailed guidance on how the student should assess this". These are enhancements, NOT critical gaps.

**RULE: Only flag as "missing" if the CLINICAL DATA itself doesn't exist. If the data exists but educational instructions could be enhanced, mark as "alreadyPresent" with relevance="optional".**

DATA PRESERVATION PRINCIPLE:
Your job is to identify MISSING CLINICAL DATA, NOT to suggest removing or simplifying existing content. The professor is the clinical expert. If they included breed-specific notes, unusual observations, environmental details, management nuances, or seemingly minor clinical findings — those details are INTENTIONAL and CRITICAL to the case's educational value. The nuances that might seem like "noise" are exactly what makes clinical cases realistic and educational. When flagging items as "alreadyPresent", preserve and respect the existing content fully. Only flag items as "missing" if they are genuinely absent.

SOURCE TEXT CROSS-REFERENCE (MANDATORY):
If the case data includes a "_sourceText" field, it contains the ORIGINAL text the professor pasted. Before flagging ANY item as "missing", check the source text FIRST. If the information exists in the source text (even if it wasn't perfectly extracted into the structured field), mark the item as "alreadyPresent" and include the relevant excerpt as the existingValue. Do NOT ask the professor to re-provide data they already included in their original input.

Examples:
- Treatment protocol exists in source text describing catheter removal, LMWH, NSAIDs, antibiotics → Mark as "alreadyPresent: true", NOT missing
- Owner's anxiety level is stated as "Moderate" in source text → Mark as "alreadyPresent: true", NOT missing
- Owner's follow-up questions are listed in source text → Mark as "alreadyPresent: true", NOT missing
- Exact dosages are not mentioned anywhere → Mark as "alreadyPresent: false", IS missing (clinical data gap)

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
- Is there a compelling case title? (descriptive, learner-friendly)\n- Is there a clear, brief learner-facing summary? (one-paragraph overview that sets the scene for the student to discover the diagnosis)\n  - CRITICAL: Does the summary present observable signs, clinical context, and patient demographics WITHOUT revealing the diagnosis, confirmed pathology, or treatment plan?\n  - The summary should pose the scenario, not give away the answer.\n- Are species/breed, patient name, age, sex all specified?

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
Organize findings into THREE CLINICAL TIERS:

**ESSENTIAL** (would be present in almost any case with this pathology):
- Temperature, heart rate, respiratory rate with units
- Mucous membranes, capillary refill time, body condition score
- Hydration status assessment
- System-specific findings relevant to the differential (auscultation, palpation, percussion, etc.)

**OPTIONAL** (might be present, clinically valuable):
- Additional systemic exams (neurological, ophthalmic, lameness maneuvers, etc.)

**COUNTERPRODUCTIVE** (no diagnostic value, potential harm/cost):
- Exams unrelated to the clinical presentation
- Unnecessary invasive procedures

Verify: Are ESSENTIAL findings thoroughly documented with specific values and units? Are OPTIONAL findings appropriately included? Are COUNTERPRODUCTIVE items omitted?

### D. DIAGNOSTIC & LABORATORY COMPLETENESS
Organize findings into THREE CLINICAL TIERS:

**ESSENTIAL** (would almost certainly be performed for this presentation):
- CBC/Haematology (hemoglobin, hematocrit, WBC, differential, platelets) with exact values and reference ranges
- Serum Chemistry (electrolytes, kidney values, liver enzymes, glucose, albumin, globulins)
- Urinalysis (if indicated)
- Blood Gas (if indicated)
- Imaging (radiography, ultrasound views relevant to differential)
- Culture/sensitivity (if infection suspected)

**OPTIONAL** (valuable but less essential; depends on clinical reasoning):
- Coagulation studies, specialized serology, hormonal assays, advanced imaging, specialized markers

**COUNTERPRODUCTIVE** (no diagnostic value, harmful, or cost-prohibitive):
- Tests unrelated to the differential, contraindicated procedures, cost-prohibitive tests without clear indication

Verify: Are ESSENTIAL tests documented with exact values, units, AND reference ranges? Are values consistent with the suspected diagnosis? Are OPTIONAL tests appropriately included? Are COUNTERPRODUCTIVE tests avoided?

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

For each item you identify:
1. targetField: the case field it belongs to
2. category: physical_exam | laboratory | imaging | history | treatment | differential_diagnosis | owner_communication | biosecurity | educational_prompt | other
3. itemName: specific item name (e.g., "Serum Amylase", "Heart Rate", "Owner Personality Background")
4. relevance: 
   - "mandatory" = Critical clinical data that MUST exist (e.g., vital signs, laboratory values, diagnosis)
   - "recommended" = Important clinical context that should exist (e.g., prior history, diagnostic reasoning)
   - "optional" = Valuable but not essential (e.g., advanced imaging, specialist consultations)
5. expectedFrequency: always | usually | sometimes | rarely | never
6. alreadyPresent: TRUE if the clinical DATA exists anywhere (source text or structured fields), FALSE only if genuinely absent
7. existingValue: the value from the case/source if present (first 200 chars if long). Include quoted excerpt from sourceText if you found it there.
8. reasoning: why this item matters for this specific case
9. suggestedPrompt: a conversational question to ask the professor (IN ENGLISH) to provide ONLY IF alreadyPresent=false

CRITICAL GUIDANCE:
- If information exists in the source text or case fields, set alreadyPresent=true. Do NOT suggest asking for it again.
- If you are tempted to ask about "how the student should learn this", remember: that's an educational instruction enhancement, not a data gap.
- Only set alreadyPresent=false for items where the CLINICAL DATA itself is missing (not the teaching method).

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

IMPORTANT FINAL RULES:
- Be thorough. Generate 15-40 items depending on case complexity.
- Sort items: mandatory missing first, then recommended missing, then optional missing, then all present items (sorted by relevance).
- ONLY flag as "missing" if the CLINICAL DATA itself is absent. Do not flag as "missing" if the data exists but educational instructions could be more detailed.
- For items marked "alreadyPresent=true", keep them in the list (to show the professor what was already recognized) but do not include a suggestedPrompt or ask them to re-provide.
- If the source text contains relevant information, include a brief quoted excerpt in existingValue so the professor can verify you found it.`;

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
      return NextResponse.json({ error: "caseData is required" }, { status: 400 });
    }

    const species = String(caseData.species ?? "").trim();
    const condition = String(caseData.condition ?? "").trim();

    if (!species || !condition) {
      return NextResponse.json({ error: "Species and condition are required for verification." }, { status: 400 });
    }

    // Send ALL form fields so the LLM can see what's already populated.
    // Previously only a subset was sent, causing the LLM to flag populated fields as missing.
    const allFieldKeys = Object.keys(caseData);
    const userPayload: Record<string, string> = {};
    for (const key of allFieldKeys) {
      const val = caseData[key];
      if (typeof val === "string" && val.trim()) {
        userPayload[key] = val;
      }
    }
    // Always include core fields even if empty (the LLM needs to know they're blank)
    for (const core of [
      "species",
      "condition",
      "category",
      "title",
      "patient_name",
      "patient_age",
      "patient_sex",
      "details",
      "physical_exam_findings",
      "diagnostic_findings",
      "description",
      "difficulty",
      "estimated_time",
      "findings_release_strategy",
      "tags",
      "owner_background",
      "owner_follow_up",
      "owner_diagnosis",
      "history_feedback",
      "owner_follow_up_feedback",
      "get_owner_prompt",
      "get_history_feedback_prompt",
      "get_physical_exam_prompt",
      "get_diagnostic_prompt",
      "get_owner_follow_up_prompt",
      "get_owner_follow_up_feedback_prompt",
      "get_owner_diagnosis_prompt",
      "get_overall_feedback_prompt",
    ]) {
      if (!userPayload[core]) userPayload[core] = "";
    }

    // Include original source text so the LLM can cross-reference what the professor pasted
    const sourceText = String(body.sourceText ?? "").trim();
    if (sourceText) {
      userPayload._sourceText = sourceText;
    }

    let response;
    let lastError: Error | null = null;

    // Create validated OpenAI client for this request
    let openai: any;
    try {
      openai = await createOpenAIClient();
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
    }

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
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "LLM returned no content" }, { status: 502 });
    }

    const parsed = JSON.parse(content);

    // Validate and normalize the response
    const result = {
      species: String(parsed.species ?? species),
      condition: String(parsed.condition ?? condition),
      region: String(parsed.region ?? ""),
      overallAssessment: String(parsed.overallAssessment ?? ""),
      completenessScore: Math.max(0, Math.min(100, Number(parsed.completenessScore) || 0)),
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
