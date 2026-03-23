# Plan: Case Verification Chatbot — Deep Clinical Completeness Check

## Overview

After a professor/admin uploads case data and it passes the initial field-extraction step (existing `/api/case-intake/analyze`), a **second-pass LLM verification** runs to evaluate clinical thoroughness. This produces a structured list of "verification items" — potential gaps a student might encounter during simulation. A **chatbot interface** then walks the professor through each item conversationally, collecting their answers and writing them into the corresponding case fields before final save.

---

## Architecture Summary

```
[Existing Flow]                          [New Flow]
Paste/Upload → Analyze → Field Wizard → ┐
                                         ├→ Verification API (new) → Chatbot UI (new) → Save
                                         │
                                    Form filled
```

**New pieces:**
1. **API Route** — `POST /api/case-intake/verify` (LLM deep clinical analysis)
2. **TypeScript Models** — `CaseVerificationItem`, `CaseVerificationResult`
3. **Service** — `features/case-intake/services/caseVerificationService.ts` (client-side)
4. **Chat API Route** — `POST /api/case-intake/verify-chat` (per-turn follow-up with professor)
5. **UI Component** — `features/case-intake/components/VerificationChatbot.tsx`
6. **Integration** — Wire into `app/case-entry/page.tsx` between wizard completion and final save

---

## Phase 1: Data Models

### File: `features/case-intake/models/caseVerification.ts`

```typescript
/**
 * One item the LLM flagged during deep verification.
 */
export interface CaseVerificationItem {
  /** Unique id for this item (uuid or sequential) */
  id: string;
  /** Which case field this relates to (e.g. "physical_exam_findings", "diagnostic_findings") */
  targetField: string;
  /** Human-readable category */
  category:
    | "physical_exam"
    | "laboratory"
    | "imaging"
    | "history"
    | "treatment"
    | "differential_diagnosis"
    | "owner_communication"
    | "biosecurity"
    | "other";
  /** Clinical item name, e.g. "Complete Blood Count (CBC)" */
  itemName: string;
  /** Clinical relevance classification */
  relevance: "mandatory" | "recommended" | "optional" | "unnecessary";
  /** Why the LLM thinks this is relevant or missing */
  reasoning: string;
  /** How often this finding/test is expected for this pathology+species+region */
  expectedFrequency: "always" | "usually" | "sometimes" | "rarely" | "never";
  /** Whether the item was already present in the uploaded case data */
  alreadyPresent: boolean;
  /** The value already in the case (if any) */
  existingValue: string;
  /** LLM's suggested value or prompt to get the value from the professor */
  suggestedPrompt: string;
  /** Professor's answer (filled during chatbot phase) */
  professorAnswer: string;
  /** Whether this item has been resolved */
  status: "pending" | "accepted" | "skipped" | "answered";
}

/**
 * Full verification result returned by the API.
 */
export interface CaseVerificationResult {
  /** Species detected */
  species: string;
  /** Condition / pathology detected */
  condition: string;
  /** Region/context if detectable */
  region: string;
  /** Summary of what was found present vs missing */
  overallAssessment: string;
  /** Completeness score 0-100 */
  completenessScore: number;
  /** All verification items, sorted by relevance then category */
  items: CaseVerificationItem[];
  /** Counts by relevance */
  counts: {
    mandatory: number;
    recommended: number;
    optional: number;
    unnecessary: number;
    alreadyPresent: number;
    missing: number;
  };
}

/**
 * A single message in the verification chatbot conversation.
 */
export interface VerificationChatMessage {
  id: string;
  role: "system" | "assistant" | "user";
  content: string;
  /** If the message is about a specific verification item */
  verificationItemId?: string;
  /** Timestamp */
  timestamp: string;
}
```

---

## Phase 2: Backend — Verification API

### File: `app/api/case-intake/verify/route.ts`

**Purpose:** Receives the filled case form data, runs a deep clinical analysis via LLM, returns structured verification items.

**Auth:** `admin` or `professor` only (use `requireUser` from `@/app/api/_lib/auth`).

**Input (JSON body):**
```typescript
{
  caseData: Record<string, string>; // The full form state (all 43 fields)
}
```

**Output:**
```typescript
CaseVerificationResult
```

**Implementation steps:**

1. Extract `caseData` from request body.
2. Pull out key fields: `species`, `condition`, `category`, `physical_exam_findings`, `diagnostic_findings`, `details`, `owner_background`, `history_feedback`.
3. Call OpenAI `gpt-4o` (use the better model for clinical reasoning, not mini) with `response_format: { type: "json_object" }`.
4. System prompt (see below).
5. Parse response into `CaseVerificationResult`.
6. Return JSON.

**System prompt for the verification LLM call:**

```text
You are an expert veterinary clinical educator and case designer. You are reviewing a veterinary teaching case for an AI-powered clinical simulation platform where veterinary students will interact with AI personas (owner, nurse, lab technician) to practice clinical reasoning.

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
- Is there a finding documented? (temperature, HR, RR, CRT, mucous membranes, BCS, hydration, specific system findings)
- What additional PE maneuvers might a student attempt? (auscultation areas, palpation, percussion, rectal exam, lameness evaluation, neurological exam, etc.)
- For each: is the finding PRESENT in the data, MISSING but MANDATORY, MISSING but RECOMMENDED, or UNNECESSARY?

### B. Laboratory / Diagnostic Completeness
For this pathology in this species:
- Which lab tests are MANDATORY (always ordered for this presentation)?
- Which are RECOMMENDED (frequently ordered, high diagnostic value)?
- Which are OPTIONAL (sometimes useful, depends on clinical reasoning)?
- Which would be UNNECESSARY (poor value, unnecessary cost)?
- For each test: is the result already present in the case data?

Categories to check: CBC/haematology, serum biochemistry, urinalysis, serology, microbiology/culture, cytology, specific disease tests (e.g., SAA for equine, SNAP tests for canine), coagulation, blood gas, etc.

### C. Imaging Completeness
- Which imaging modalities are relevant? (radiography, ultrasonography, endoscopy, CT, MRI, etc.)
- For each: is a result documented? Is it mandatory, recommended, or optional for this case?

### D. History/Anamnesis Completeness
- Are all key history domains covered? (onset, duration, progression, diet, environment, vaccination, deworming, travel, exposure, previous episodes, medications, management)
- Which specific history questions are critical for THIS pathology that a student must be able to ask?

### E. Treatment/Management Data
- Are treatment options documented for the AI to discuss?
- Biosecurity measures if applicable?
- Prognosis information?
- Follow-up monitoring plans?

### F. Differential Diagnoses
- Are the key differential diagnoses for this presentation considered?
- Are there findings that help rule in/out each differential?

### G. Symptom/Sign Frequency Analysis
For the PRIMARY CONDITION in this SPECIES:
- Which clinical signs are ALWAYS present (>90% of cases)?
- Which are USUALLY present (60-90%)?
- Which SOMETIMES present (20-60%)?
- Which RARELY present (<20%)?
- Flag any documented signs that seem inconsistent with the diagnosis.

For each item you identify, classify it and provide:
1. The target case field it belongs to (physical_exam_findings, diagnostic_findings, details, owner_background, etc.)
2. A category (physical_exam, laboratory, imaging, history, treatment, differential_diagnosis, owner_communication, biosecurity)
3. The item name (e.g., "Serum Amyloid A (SAA)")
4. Relevance: mandatory / recommended / optional / unnecessary
5. Expected frequency for this pathology: always / usually / sometimes / rarely / never
6. Whether it's already present in the case data
7. The existing value if present
8. A conversational prompt to ask the professor for this information (in Spanish, since professors work in Spanish)

Return JSON matching this schema exactly:
{
  "species": "string",
  "condition": "string",
  "region": "string or empty",
  "overallAssessment": "2-3 sentence summary in Spanish",
  "completenessScore": number_0_to_100,
  "items": [
    {
      "id": "item-1",
      "targetField": "physical_exam_findings",
      "category": "physical_exam",
      "itemName": "Rectal Temperature",
      "relevance": "mandatory",
      "reasoning": "...",
      "expectedFrequency": "always",
      "alreadyPresent": true,
      "existingValue": "38.9°C (102°F)",
      "suggestedPrompt": "Rectal temperature is already documented as 38.9°C. Is this value correct for this case?",
      "professorAnswer": "",
      "status": "pending"
    }
  ],
  "counts": {
    "mandatory": 12,
    "recommended": 8,
    "optional": 5,
    "unnecessary": 3,
    "alreadyPresent": 15,
    "missing": 13
  }
}

Sort items: mandatory first, then recommended, then optional. Within each group, sort by category. Unnecessary items go last.
Put alreadyPresent items AFTER missing items within each relevance group — the professor should focus on what's missing first.
```

**User message content:**
```json
{
  "species": "<from caseData>",
  "condition": "<from caseData>",
  "category": "<from caseData>",
  "details": "<from caseData>",
  "physical_exam_findings": "<from caseData>",
  "diagnostic_findings": "<from caseData>",
  "owner_background": "<from caseData>",
  "history_feedback": "<from caseData>",
  "tags": "<from caseData>"
}
```

**Full route implementation:**

```typescript
// app/api/case-intake/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const SYSTEM_PROMPT = `You are an expert veterinary clinical educator and case designer...`; // (full prompt from above)

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
```

---

## Phase 3: Backend — Verification Chat API

### File: `app/api/case-intake/verify-chat/route.ts`

**Purpose:** Handles multi-turn conversation between the professor and the LLM about specific verification items. The professor's answers are interpreted and structured by the LLM so they can be mapped back to case fields.

**Auth:** `admin` or `professor` only.

**Input (JSON body):**
```typescript
{
  /** Full conversation history */
  messages: Array<{ role: "system" | "assistant" | "user"; content: string }>;
  /** The current verification item being discussed */
  currentItem: CaseVerificationItem;
  /** Case context for the LLM */
  caseContext: {
    species: string;
    condition: string;
    patientName: string;
    category: string;
  };
}
```

**Output:**
```typescript
{
  /** The assistant's next reply */
  reply: string;
  /** If the professor's answer is complete enough, this contains the structured value to write into the case field */
  extractedValue: string | null;
  /** Whether the LLM considers this item resolved */
  isResolved: boolean;
  /** Which case field to write to */
  targetField: string;
  /** Whether to append to the existing field value or replace */
  writeMode: "append" | "replace";
}
```

**System prompt for this endpoint:**

```text
You are a veterinary case verification assistant helping a professor complete a clinical teaching case. You are having a conversation about a specific missing or incomplete data point in the case.

Context:
- Species: {species}
- Condition: {condition}
- Patient: {patientName}
- Category: {category}

Current item being discussed:
- Item: {currentItem.itemName}
- Category: {currentItem.category}
- Why it's needed: {currentItem.reasoning}
- Target field: {currentItem.targetField}
- Existing value: {currentItem.existingValue}

Your job:
1. Ask the professor for the specific clinical data in a conversational, respectful way (in Spanish).
2. If the professor provides a value, acknowledge it and ask if there's anything to add.
3. If the professor says the test is not applicable or not available, accept that and mark resolved.
4. If the professor's answer is vague, ask a targeted follow-up question.
5. Once you have a complete answer, set isResolved=true and provide the extractedValue formatted for the target field.

Rules:
- Speak in Spanish (the professors work in Spanish).
- Be concise but thorough. Don't repeat what's already known.
- Format extractedValue as it should appear in the case field:
  - For physical_exam_findings: "Parameter: Value (units)" per line
  - For diagnostic_findings: "Test - Analyte: Value units (reference range)" per line
  - For details/history: Natural paragraph text
  - For owner_background: Personality/communication notes
- If the professor explicitly says "skip" or "no aplica", set isResolved=true with extractedValue=null.

Return JSON:
{
  "reply": "string — your conversational response to the professor",
  "extractedValue": "string or null — structured value for the case field",
  "isResolved": true/false,
  "targetField": "string — the case field key",
  "writeMode": "append" or "replace"
}
```

**Full route implementation:**

```typescript
// app/api/case-intake/verify-chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin" && auth.role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { messages, currentItem, caseContext } = body;

    if (!currentItem || !caseContext) {
      return NextResponse.json(
        { error: "currentItem and caseContext are required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a veterinary case verification assistant helping a professor complete a clinical teaching case. You are having a conversation about a specific missing or incomplete data point in the case.

Context:
- Species: ${caseContext.species}
- Condition: ${caseContext.condition}
- Patient: ${caseContext.patientName}
- Category: ${caseContext.category}

Current item being discussed:
- Item: ${currentItem.itemName}
- Category: ${currentItem.category}
- Why it's needed: ${currentItem.reasoning}
- Target field: ${currentItem.targetField}
- Relevance: ${currentItem.relevance}
- Expected frequency: ${currentItem.expectedFrequency}
- Existing value in case: ${currentItem.existingValue || "(none)"}

Your job:
1. Ask the professor for the specific clinical data in a conversational, respectful way (in Spanish).
2. If the professor provides a value, acknowledge it and ask if there's anything to add.
3. If the professor says the test is not applicable or not available, accept that and mark resolved.
4. If the professor's answer is vague, ask a targeted follow-up question.
5. Once you have a complete answer, set isResolved=true and provide the extractedValue formatted correctly for the target field.

Rules:
- Speak in English.
- Be concise but thorough.
- Format extractedValue as it should appear in the case field:
  - For physical_exam_findings: "Parameter: Value (units)" format, one per line
  - For diagnostic_findings: "Test - Analyte: Value units (ref range)" format, one per line
  - For details: Natural paragraph text
  - For owner_background: Personality and communication notes
- If the professor explicitly says "skip", "no aplica", or "no disponible", set isResolved=true with extractedValue=null.

Return ONLY JSON (no markdown, no commentary):
{
  "reply": "string",
  "extractedValue": "string or null",
  "isResolved": boolean,
  "targetField": "string",
  "writeMode": "append" or "replace"
}`;

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...(Array.isArray(messages)
        ? messages.map((m: { role: string; content: string }) => ({
            role: m.role as "system" | "user" | "assistant",
            content: String(m.content),
          }))
        : []),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: chatMessages,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "LLM returned no content" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      reply: String(parsed.reply ?? ""),
      extractedValue:
        parsed.extractedValue !== null && parsed.extractedValue !== undefined
          ? String(parsed.extractedValue)
          : null,
      isResolved: Boolean(parsed.isResolved),
      targetField: String(
        parsed.targetField ?? currentItem.targetField ?? "details"
      ),
      writeMode: parsed.writeMode === "replace" ? "replace" : "append",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

## Phase 4: Client Service

### File: `features/case-intake/services/caseVerificationService.ts`

```typescript
import { buildAuthHeaders } from "@/lib/auth-headers";
import type {
  CaseVerificationResult,
  CaseVerificationItem,
} from "../models/caseVerification";

export const caseVerificationService = {
  /**
   * Trigger deep clinical verification of the case data.
   */
  async verify(
    caseData: Record<string, string>
  ): Promise<CaseVerificationResult> {
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch("/api/case-intake/verify", {
      method: "POST",
      headers,
      body: JSON.stringify({ caseData }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Verification failed"
      );
    }
    return res.json();
  },

  /**
   * Send a chat message about a specific verification item.
   */
  async chat(params: {
    messages: Array<{ role: string; content: string }>;
    currentItem: CaseVerificationItem;
    caseContext: {
      species: string;
      condition: string;
      patientName: string;
      category: string;
    };
  }): Promise<{
    reply: string;
    extractedValue: string | null;
    isResolved: boolean;
    targetField: string;
    writeMode: "append" | "replace";
  }> {
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch("/api/case-intake/verify-chat", {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Chat request failed"
      );
    }
    return res.json();
  },
};
```

---

## Phase 5: Verification Chatbot UI Component

### File: `features/case-intake/components/VerificationChatbot.tsx`

This is the core new UI. It renders as a **dialog/modal** (using existing Radix Dialog from `components/ui/dialog.tsx`) that appears after the professor clicks "Verify Case Completeness". It contains:

1. **Header** — Shows completeness score, counts, overall assessment
2. **Item sidebar/list** — Left panel showing all verification items grouped by relevance, with status indicators
3. **Chat panel** — Right panel with conversational messages for the current item
4. **Input area** — Text input + Send button for professor replies

**Props:**
```typescript
interface VerificationChatbotProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** The verification result from the API */
  verificationResult: CaseVerificationResult;
  /** Current form state to provide context */
  caseContext: {
    species: string;
    condition: string;
    patientName: string;
    category: string;
  };
  /** Callback when a field value is resolved — parent writes it into form state */
  onFieldResolved: (
    targetField: string,
    value: string,
    writeMode: "append" | "replace"
  ) => void;
  /** Callback when all items are reviewed */
  onComplete: () => void;
}
```

**Component state:**
```typescript
const [items, setItems] = useState<CaseVerificationItem[]>(verificationResult.items);
const [activeItemIndex, setActiveItemIndex] = useState(0);
const [chatHistory, setChatHistory] = useState<Record<string, VerificationChatMessage[]>>({});
const [inputText, setInputText] = useState("");
const [isSending, setIsSending] = useState(false);
```

**Key behaviors:**

1. **Auto-greeting:** When an item becomes active and has no chat history, automatically send the first LLM message (the suggestedPrompt from the verification item) as the assistant's opening message. No API call needed — use the `suggestedPrompt` directly.

2. **Professor replies:** When the professor types and sends a message:
   - Add the user message to `chatHistory[activeItemId]`
   - Call `caseVerificationService.chat(...)` with the conversation history
   - Add the assistant reply to chat history
   - If `isResolved === true`:
     - Call `onFieldResolved(targetField, extractedValue, writeMode)` to write the value into the form
     - Update `items[activeItemIndex].status = "answered"` (or "accepted")
     - Auto-advance to the next pending item after a short delay (800ms)

3. **Skip button:** Professor can skip any item → sets `status = "skipped"`, advances to next.

4. **Confirm present items:** For items where `alreadyPresent === true`, show a quick "Confirm / Edit" choice instead of a full chat. If confirmed, mark `status = "accepted"`. If edit, open chat.

5. **Sidebar item list:**
   - Group by relevance: Mandatory (red dot), Recommended (orange dot), Optional (yellow dot), Unnecessary (gray dot)
   - Show checkmarks for resolved items
   - Clickable to jump to any item
   - Show count: "12/28 resolved"

6. **Completion:** When all non-unnecessary items are resolved (answered, accepted, or skipped), show a summary and "Finish Verification" button that calls `onComplete()`.

**Full component implementation:**

```tsx
// features/case-intake/components/VerificationChatbot.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { caseVerificationService } from "../services/caseVerificationService";
import type {
  CaseVerificationItem,
  CaseVerificationResult,
  VerificationChatMessage,
} from "../models/caseVerification";

/* ── Relevance → visual style mapping ── */
const RELEVANCE_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  mandatory:   { dot: "bg-red-500",    label: "Mandatory", bg: "bg-red-50 border-red-200" },
  recommended: { dot: "bg-orange-400", label: "Recommended", bg: "bg-orange-50 border-orange-200" },
  optional:    { dot: "bg-yellow-400", label: "Optional",    bg: "bg-yellow-50 border-yellow-200" },
  unnecessary: { dot: "bg-gray-300",   label: "Unnecessary", bg: "bg-gray-50 border-gray-200" },
};

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  accepted: "✓",
  answered: "✓",
  skipped: "—",
};

interface VerificationChatbotProps {
  open: boolean;
  onClose: () => void;
  verificationResult: CaseVerificationResult;
  caseContext: {
    species: string;
    condition: string;
    patientName: string;
    category: string;
  };
  onFieldResolved: (
    targetField: string,
    value: string,
    writeMode: "append" | "replace"
  ) => void;
  onComplete: () => void;
}

export function VerificationChatbot({
  open,
  onClose,
  verificationResult,
  caseContext,
  onFieldResolved,
  onComplete,
}: VerificationChatbotProps) {
  const [items, setItems] = useState<CaseVerificationItem[]>(
    verificationResult.items
  );
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [chatHistories, setChatHistories] = useState<
    Record<string, VerificationChatMessage[]>
  >({});
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeItem: CaseVerificationItem | undefined = items[activeItemIndex];
  const activeItemId = activeItem?.id ?? "";

  const currentChat = chatHistories[activeItemId] ?? [];

  // Count resolved items (only non-unnecessary)
  const actionableItems = useMemo(
    () => items.filter((i) => i.relevance !== "unnecessary"),
    [items]
  );
  const resolvedCount = useMemo(
    () =>
      actionableItems.filter(
        (i) => i.status === "accepted" || i.status === "answered" || i.status === "skipped"
      ).length,
    [actionableItems]
  );
  const allResolved = resolvedCount >= actionableItems.length && actionableItems.length > 0;

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat.length]);

  // Auto-greet when switching to a new item with no history
  useEffect(() => {
    if (!activeItem) return;
    if (chatHistories[activeItem.id]?.length) return;

    const greeting: VerificationChatMessage = {
      id: `greeting-${activeItem.id}`,
      role: "assistant",
      content: activeItem.suggestedPrompt || `¿Podría proporcionar información sobre: ${activeItem.itemName}?`,
      verificationItemId: activeItem.id,
      timestamp: new Date().toISOString(),
    };

    setChatHistories((prev) => ({
      ...prev,
      [activeItem.id]: [greeting],
    }));
  }, [activeItem, chatHistories]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !activeItem || isSending) return;
    const userText = inputText.trim();
    setInputText("");
    setIsSending(true);

    const userMsg: VerificationChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText,
      verificationItemId: activeItem.id,
      timestamp: new Date().toISOString(),
    };

    const updatedChat = [...(chatHistories[activeItem.id] ?? []), userMsg];
    setChatHistories((prev) => ({
      ...prev,
      [activeItem.id]: updatedChat,
    }));

    try {
      // Build messages for the API (exclude greeting system messages, just role+content)
      const apiMessages = updatedChat.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await caseVerificationService.chat({
        messages: apiMessages,
        currentItem: activeItem,
        caseContext,
      });

      const assistantMsg: VerificationChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        verificationItemId: activeItem.id,
        timestamp: new Date().toISOString(),
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeItem.id]: [...(prev[activeItem.id] ?? []), userMsg, assistantMsg].filter(
          // Deduplicate (userMsg might already be in the list)
          (msg, idx, arr) => arr.findIndex((m) => m.id === msg.id) === idx
        ),
      }));

      if (response.isResolved) {
        // Write value into form
        if (response.extractedValue) {
          onFieldResolved(
            response.targetField,
            response.extractedValue,
            response.writeMode
          );
        }

        // Update item status
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === activeItemIndex
              ? {
                  ...item,
                  status: response.extractedValue ? "answered" : "skipped",
                  professorAnswer: response.extractedValue ?? "",
                }
              : item
          )
        );

        // Auto-advance to next pending item after delay
        setTimeout(() => {
          const nextIdx = items.findIndex(
            (item, idx) =>
              idx > activeItemIndex &&
              item.status === "pending" &&
              item.relevance !== "unnecessary"
          );
          if (nextIdx !== -1) {
            setActiveItemIndex(nextIdx);
          }
        }, 800);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error de conexión";
      const errorAssistantMsg: VerificationChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${errMsg}. Intente de nuevo.`,
        verificationItemId: activeItem.id,
        timestamp: new Date().toISOString(),
      };
      setChatHistories((prev) => ({
        ...prev,
        [activeItem.id]: [...(prev[activeItem.id] ?? []), errorAssistantMsg],
      }));
    } finally {
      setIsSending(false);
    }
  }, [
    inputText,
    activeItem,
    activeItemIndex,
    isSending,
    chatHistories,
    caseContext,
    items,
    onFieldResolved,
  ]);

  const handleSkip = useCallback(() => {
    if (!activeItem) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "skipped" } : item
      )
    );
    // Advance to next pending
    const nextIdx = items.findIndex(
      (item, idx) =>
        idx > activeItemIndex &&
        item.status === "pending" &&
        item.relevance !== "unnecessary"
    );
    if (nextIdx !== -1) {
      setActiveItemIndex(nextIdx);
    }
  }, [activeItem, activeItemIndex, items]);

  const handleConfirmPresent = useCallback(() => {
    if (!activeItem) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "accepted" } : item
      )
    );
    const nextIdx = items.findIndex(
      (item, idx) =>
        idx > activeItemIndex &&
        item.status === "pending" &&
        item.relevance !== "unnecessary"
    );
    if (nextIdx !== -1) {
      setActiveItemIndex(nextIdx);
    }
  }, [activeItem, activeItemIndex, items]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>Case Verification</DialogTitle>
          <DialogDescription>
            {verificationResult.overallAssessment}
          </DialogDescription>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="font-medium">
              Completeness: {verificationResult.completenessScore}%
            </span>
            <span className="text-muted-foreground">
              {resolvedCount}/{actionableItems.length} items reviewed
            </span>
            {allResolved && (
              <span className="text-emerald-600 font-medium">
                ✓ Verification complete
              </span>
            )}
          </div>
        </DialogHeader>

        {/* ── Body: sidebar + chat ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar: item list ── */}
          <div className="w-72 border-r overflow-y-auto shrink-0 bg-muted/30">
            {(["mandatory", "recommended", "optional", "unnecessary"] as const).map(
              (relevance) => {
                const group = items.filter((i) => i.relevance === relevance);
                if (group.length === 0) return null;
                const style = RELEVANCE_STYLES[relevance];
                return (
                  <div key={relevance} className="py-2">
                    <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      {style.label} ({group.length})
                    </div>
                    {group.map((item) => {
                      const itemIdx = items.indexOf(item);
                      const isActive = itemIdx === activeItemIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveItemIndex(itemIdx)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors ${
                            isActive ? "bg-accent font-medium" : ""
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              item.status === "answered" || item.status === "accepted"
                                ? "text-emerald-600"
                                : item.status === "skipped"
                                ? "text-muted-foreground"
                                : "text-muted-foreground/50"
                            }`}
                          >
                            {STATUS_ICONS[item.status]}
                          </span>
                          <span className="truncate">{item.itemName}</span>
                          {item.alreadyPresent && item.status === "pending" && (
                            <span className="ml-auto text-xs text-blue-500 shrink-0">
                              ✎
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              }
            )}
          </div>

          {/* ── Chat panel ── */}
          <div className="flex-1 flex flex-col">
            {activeItem ? (
              <>
                {/* Item header */}
                <div
                  className={`p-3 border-b text-sm ${
                    RELEVANCE_STYLES[activeItem.relevance]?.bg ?? ""
                  }`}
                >
                  <div className="font-medium">{activeItem.itemName}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {activeItem.category} · {activeItem.relevance} ·{" "}
                    Frequency: {activeItem.expectedFrequency}
                    {activeItem.alreadyPresent && (
                      <span className="ml-2 text-blue-600">
                        (Already present in the case)
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1">{activeItem.reasoning}</div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {currentChat.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick actions for already-present items */}
                {activeItem.alreadyPresent && activeItem.status === "pending" && (
                  <div className="px-4 py-2 border-t bg-blue-50 flex items-center gap-2 text-sm">
                    <span>This data is already in the case.</span>
                    <Button size="sm" onClick={handleConfirmPresent}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {/* open chat */}}>
                      Edit
                    </Button>
                  </div>
                )}

                {/* Input area */}
                <div className="p-3 border-t flex items-center gap-2 shrink-0">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    disabled={
                      isSending ||
                      activeItem.status === "answered" ||
                      activeItem.status === "accepted" ||
                      activeItem.status === "skipped"
                    }
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={
                      isSending ||
                      !inputText.trim() ||
                      activeItem.status !== "pending"
                    }
                    size="sm"
                  >
                    {isSending ? "..." : "Send"}
                  </Button>
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    size="sm"
                    disabled={activeItem.status !== "pending"}
                  >
                    Skip
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Seleccione un item para verificar
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-3 border-t flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground">
            {resolvedCount}/{actionableItems.length} items reviewed
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {allResolved && (
              <Button onClick={onComplete}>
                Finish Verification
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Phase 6: Integration into `app/case-entry/page.tsx`

### Changes required:

#### 6.1 — New imports at the top of the file

```typescript
import { VerificationChatbot } from "@/features/case-intake/components/VerificationChatbot";
import { caseVerificationService } from "@/features/case-intake/services/caseVerificationService";
import type { CaseVerificationResult } from "@/features/case-intake/models/caseVerification";
```

#### 6.2 — New state variables (add after existing state declarations, around line ~53)

```typescript
const [verificationResult, setVerificationResult] = useState<CaseVerificationResult | null>(null);
const [isVerifying, setIsVerifying] = useState(false);
const [showVerificationChat, setShowVerificationChat] = useState(false);
```

#### 6.3 — New handler: `handleVerifyCase` (add after `markCurrentReviewedAndNext`)

```typescript
const handleVerifyCase = async () => {
  setIsVerifying(true);
  setError("");
  try {
    const result = await caseVerificationService.verify(form);
    setVerificationResult(result);
    setShowVerificationChat(true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg || "No se pudo verificar el caso.");
  } finally {
    setIsVerifying(false);
  }
};
```

#### 6.4 — New handler: `handleFieldResolved` (callback for chatbot)

```typescript
const handleFieldResolved = (targetField: string, value: string, writeMode: "append" | "replace") => {
  if (!isCaseFieldKey(targetField)) return;
  setForm((prev) => {
    const existing = prev[targetField] || "";
    if (writeMode === "append" && existing.trim()) {
      return { ...prev, [targetField]: existing.trim() + "\n" + value };
    }
    return { ...prev, [targetField]: value };
  });
};
```

#### 6.5 — New handler: `handleVerificationComplete`

```typescript
const handleVerificationComplete = () => {
  setShowVerificationChat(false);
  setSuccess("Verificación completada. Los datos han sido integrados al formulario.");
};
```

#### 6.6 — New UI section: "Verify Completeness" button

Add this **between** the wizard/analysis section and the form section (between the `{analysis && (...)}` block and the `<form>` tag). Find the JSX that starts with:

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  <div className="rounded-lg border border-border p-4">
    <h2 className="text-lg font-semibold mb-2">4) Final Edit and Save</h2>
```

Insert this block BEFORE it:

```tsx
{/* ── Verification Step ── */}
<div className="rounded-lg border border-border p-4 space-y-4 bg-card">
  <div>
    <h2 className="text-lg font-semibold">3.5) Verificación Clínica Profunda</h2>
    <p className="text-sm text-muted-foreground mt-1">
      Analiza con IA si el caso contiene todos los datos clínicos que un estudiante podría necesitar:
      examen físico, laboratorio, imagenología, diagnósticos diferenciales y más.
    </p>
  </div>

  <div className="flex items-center gap-3">
    <Button
      type="button"
      onClick={handleVerifyCase}
      disabled={isVerifying || !form.species?.trim() || !form.condition?.trim()}
    >
      {isVerifying ? "Analizando completitud clínica..." : "Verificar Completitud del Caso"}
    </Button>
    {verificationResult && !showVerificationChat && (
      <Button type="button" variant="outline" onClick={() => setShowVerificationChat(true)}>
        Reabrir Verificación ({verificationResult.completenessScore}%)
      </Button>
    )}
  </div>

  {verificationResult && !showVerificationChat && (
    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
      Verificación completada — Completitud: {verificationResult.completenessScore}%.{" "}
      {verificationResult.counts.missing} items pendientes de {verificationResult.items.length} analizados.
    </div>
  )}
</div>
```

#### 6.7 — Render the VerificationChatbot dialog (add before the closing `</div>` of the component, near the expanded-field modal)

```tsx
{verificationResult && (
  <VerificationChatbot
    open={showVerificationChat}
    onClose={() => setShowVerificationChat(false)}
    verificationResult={verificationResult}
    caseContext={{
      species: form.species || "",
      condition: form.condition || "",
      patientName: form.patient_name || form.title || "",
      category: form.category || "",
    }}
    onFieldResolved={handleFieldResolved}
    onComplete={handleVerificationComplete}
  />
)}
```

---

## Phase 7: File Creation Order for Implementation

Execute in this exact order:

### Step 1: Create the model file
**Create:** `features/case-intake/models/caseVerification.ts`
Content: The interfaces from Phase 1 above (CaseVerificationItem, CaseVerificationResult, VerificationChatMessage).

### Step 2: Create the verify API route
**Create:** `app/api/case-intake/verify/route.ts`  
Content: The full route from Phase 2 above. Copy the FULL system prompt into the `SYSTEM_PROMPT` constant.

### Step 3: Create the verify-chat API route
**Create:** `app/api/case-intake/verify-chat/route.ts`  
Content: The full route from Phase 3 above.

### Step 4: Create the client service
**Create:** `features/case-intake/services/caseVerificationService.ts`  
Content: The service from Phase 4 above.

### Step 5: Create the chatbot UI component
**Create:** `features/case-intake/components/VerificationChatbot.tsx`  
Content: The full component from Phase 5 above.

### Step 6: Modify the case-entry page
**Edit:** `app/case-entry/page.tsx`  
Apply changes 6.1 through 6.7 as described in Phase 6 above.

---

## Detailed Edit Instructions for `app/case-entry/page.tsx`

### Edit A — Add imports (at top of file, after existing imports)

Find:
```typescript
import type { CaseMediaItem } from "@/features/cases/models/caseMedia";
```

Add AFTER it:
```typescript
import { VerificationChatbot } from "@/features/case-intake/components/VerificationChatbot";
import { caseVerificationService } from "@/features/case-intake/services/caseVerificationService";
import type { CaseVerificationResult } from "@/features/case-intake/models/caseVerification";
```

### Edit B — Add state variables

Find:
```typescript
  const [intakeText, setIntakeText] = useState("");
```

Add BEFORE it:
```typescript
  const [verificationResult, setVerificationResult] = useState<CaseVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerificationChat, setShowVerificationChat] = useState(false);
```

### Edit C — Add handlers

Find the function `markCurrentReviewedAndNext`:
```typescript
  const markCurrentReviewedAndNext = () => {
    if (!currentMissing) return;
    setReviewed((prev) => ({ ...prev, [currentMissing.fieldKey]: true }));
    setWizardIndex((prev) => prev + 1);
  };
```

Add AFTER it:
```typescript
  const handleVerifyCase = async () => {
    setIsVerifying(true);
    setError("");
    try {
      const result = await caseVerificationService.verify(form);
      setVerificationResult(result);
      setShowVerificationChat(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "No se pudo verificar el caso.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFieldResolved = (targetField: string, value: string, writeMode: "append" | "replace") => {
    if (!isCaseFieldKey(targetField)) return;
    setForm((prev) => {
      const existing = prev[targetField] || "";
      if (writeMode === "append" && existing.trim()) {
        return { ...prev, [targetField]: existing.trim() + "\n" + value };
      }
      return { ...prev, [targetField]: value };
    });
  };

  const handleVerificationComplete = () => {
    setShowVerificationChat(false);
    setSuccess("Verificación completada. Los datos han sido integrados al formulario.");
  };
```

### Edit D — Add verification UI section in JSX

Find the `<form onSubmit={handleSubmit}` tag. Insert the verification section block (from 6.6 above) BEFORE the `<form>` tag.

### Edit E — Add the VerificationChatbot dialog render

Find the expanded-field modal near the bottom of the file (the `{expandedField && (` block). Add the `{verificationResult && (<VerificationChatbot .../>)}` block (from 6.7 above) either before or after the expanded-field modal, but inside the outermost `<div>`.

---

## Verification Prompt — Complete Text (for copy-paste into the route)

The full system prompt for `/api/case-intake/verify` should be stored as a constant string. Here it is for copy-paste:

```typescript
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
9. suggestedPrompt: a conversational question to ask the professor (IN SPANISH) to get this data

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
```

---

## Summary of Files to Create/Edit

| Action | File Path |
|--------|-----------|
| CREATE | `features/case-intake/models/caseVerification.ts` |
| CREATE | `app/api/case-intake/verify/route.ts` |
| CREATE | `app/api/case-intake/verify-chat/route.ts` |
| CREATE | `features/case-intake/services/caseVerificationService.ts` |
| CREATE | `features/case-intake/components/VerificationChatbot.tsx` |
| EDIT   | `app/case-entry/page.tsx` (5 surgical edits: imports, state, handlers, JSX section, dialog render) |

## Testing Checklist

1. ☐ Upload a case → complete the initial analysis wizard → click "Verificar Completitud del Caso"
2. ☐ Verify the dialog opens with verification items grouped by relevance
3. ☐ Click through items — check auto-greeting appears
4. ☐ Type a professor answer → verify the LLM responds conversationally
5. ☐ Verify that when `isResolved: true`, the value appears in the form field
6. ☐ Verify "append" mode adds to existing content; "replace" mode overwrites
7. ☐ Skip items → verify they show as skipped in sidebar
8. ☐ Confirm already-present items → verify quick-confirm works
9. ☐ Complete all items → verify "End Verification" appears
10. ☐ Save the case → verify all chatbot-added data is persisted
