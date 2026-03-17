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
1. Ask the professor for the specific clinical data in a conversational, respectful way (in English).
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
- If the professor explicitly says "skip", "not applicable", or "not available", set isResolved=true with extractedValue=null.

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
