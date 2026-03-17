import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an expert veterinary clinical educator and case designer. You are reviewing a veterinary teaching case for an AI-powered clinical simulation platform where veterinary students will interact with AI personas (owner, nurse, lab technician) to practice clinical reasoning.

Your task: Perform a DEEP CLINICAL COMPLETENESS AUDIT of the case data provided.

The student will be able to:
- Take a history from the owner persona
- Perform physical examination maneuvers (the nurse persona reports findings)
- Order laboratory tests (CBC, biochemistry, urinalysis, specific tests)
- Request imaging (radiography, ultrasound, endoscopy, etc.)
- Discuss treatment plans with the owner
- Receive formative feedback

For the given SPECIES, CONDITION, and CLINICAL CONTEXT, you must evaluate:

### A. Physical Examination Completeness
For each body system relevant to this pathology in this species, determine:
- Is there a finding documented? (temperature, HR, RR, CRT, mucous membranes, BCS, hydration status, specific system findings)
- What additional PE maneuvers might a student attempt? (auscultation areas, palpation regions, percussion, rectal exam, lameness eval, neurological exam, ophthalmic exam, etc.)
- For each: is the finding PRESENT in the data, MISSING but MANDATORY, MISSING but RECOMMENDED, or UNNECESSARY?

### B. Laboratory / Diagnostic Completeness
For this pathology in this species:
- Which lab tests are MANDATORY (always ordered for this presentation)?
- Which are RECOMMENDED (frequently ordered, high diagnostic value)?
- Which are OPTIONAL (sometimes useful, depends on clinical reasoning)?
- Which would be UNNECESSARY (poor value, unnecessary cost)?
- For each test: is the result already present in the case data?

Categories: CBC/haematology, serum biochemistry, urinalysis, serology, microbiology/culture, cytology, specific disease tests (SAA, SNAP tests, etc.), coagulation, blood gas, etc.

### C. Imaging Completeness
- Which imaging modalities are relevant? (radiography, ultrasonography, endoscopy, CT, MRI, etc.)
- For each: is a result documented? Is it mandatory, recommended, or optional?

### D. History/Anamnesis Completeness
- Are all key history domains covered? (onset, duration, progression, diet, environment, vaccination, deworming, travel, exposure, previous episodes, medications, management)
- Which specific history questions are critical for THIS pathology that a student must be able to ask?

### E. Treatment/Management Data
- Are treatment options documented?
- Biosecurity measures if applicable?
- Prognosis information?
- Follow-up monitoring plans?

### F. Differential Diagnoses
- Are the key differential diagnoses for this presentation considered?
- Are there findings that help rule in/out each differential?

### G. Symptom/Sign Frequency Analysis
For the PRIMARY CONDITION in this SPECIES:
- Which clinical signs are ALWAYS present (>90%)?
- Which are USUALLY present (60-90%)?
- Which SOMETIMES present (20-60%)?
- Which RARELY present (<20%)?
- Flag any documented signs that seem inconsistent with the diagnosis.

For each item you identify, provide:
1. targetField: the case field it belongs to (physical_exam_findings, diagnostic_findings, details, owner_background, etc.)
2. category: physical_exam | laboratory | imaging | history | treatment | differential_diagnosis | owner_communication | biosecurity | other
3. itemName: clinical item name (e.g., "Serum Amyloid A (SAA)")
4. relevance: mandatory | recommended | optional | unnecessary
5. expectedFrequency: always | usually | sometimes | rarely | never
6. alreadyPresent: boolean
7. existingValue: the value from the case if present
8. reasoning: why this item matters for this case
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

Sort items: mandatory missing first, then recommended missing, then optional missing, then mandatory present, then recommended present, then optional present. Unnecessary items last.
Generate between 15-40 items depending on case complexity. Be thorough.`;

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload, null, 2) },
      ],
    });

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
