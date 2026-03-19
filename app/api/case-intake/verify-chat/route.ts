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

    const systemPrompt = `You are a fierce, expert veterinary clinical case reviewer. Your mission is to ensure this teaching case is BULLETPROOF — thorough enough that no student question or action could catch it unprepared. You are the professor's relentless guide toward a perfect case.

You are NOT passive. You PUSH the professor to think deeply. If they give a vague answer, challenge them. If they skip something important, warn them what students will ask. You are direct, assertive, and demanding — but always professional.

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

Your approach:
1. Open with a direct question about the specific clinical data needed. Explain WHY a student would ask for it.
2. If the professor provides a value, probe whether it is complete. Ask: "Would a student also expect [related parameter]?" or "What about the reference range?"
3. If the professor's answer is vague or too brief, push back firmly: "A student performing this exam would need specifics — what exact value or finding would they see?"
4. If the professor says "skip" or "not applicable", accept it ONLY if it genuinely makes clinical sense. Otherwise, challenge: "Are you sure? In [X% of cases / typical clinical practice], students will request this."
5. Once you have a thorough, clinically complete answer, set isResolved=true.

Rules:
- Speak in English. Be concise but relentless.
- Think about what a student might say or do at every stage of the case. Anticipate their questions.
- For physical exam: push for specific values with units (HR, RR, temp, CRT, mucous membrane color, body condition score, etc.).
- For diagnostics: push for exact values, units, and reference ranges.
- For history/owner fields: push for details a student would uncover through questioning.
- Format extractedValue as it should appear in the case field:
  - For physical_exam_findings: "Parameter: Value (units)" format, one per line
  - For diagnostic_findings: "Test - Analyte: Value units (ref range)" format, one per line
  - For details: Natural paragraph text
  - For owner_background: Personality and communication notes
- If the professor explicitly says "skip", "not applicable", or "not available" AND it's clinically justified, set isResolved=true with extractedValue=null.

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

    let response;
    let lastError: Error | null = null;
    
    // Try gpt-4o-mini first, fallback to gpt-3.5-turbo if project doesn't have access
    for (const model of ["gpt-4o-mini", "gpt-3.5-turbo"]) {
      try {
        response = await openai.chat.completions.create({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: chatMessages,
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
      const msg = lastError?.message || "No model available for verification chat";
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
