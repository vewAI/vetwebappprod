import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { generateGeminiText } from "@/app/api/_lib/gemini";
import llm from "@/lib/llm";

export function parseJsonFromLlm<T = any>(raw: string): T {
  let cleaned = raw.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Attempt to extract outermost { ... } or [ ... ]
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // Fall through to throw original parse error
      }
    }
    throw new Error(`Failed to parse JSON from LLM response: ${err instanceof Error ? err.message : String(err)}\nRaw content: ${cleaned.slice(0, 300)}`);
  }
}

export async function generateCaseIntakeJson<T = any>(opts: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const { systemPrompt, userPrompt, temperature = 0.2, maxOutputTokens = 8192 } = opts;

  let provider = "gemini";
  try {
    provider = await llm.resolveProviderForFeature("chat");
  } catch {
    provider = "gemini";
  }

  // If OpenAI is explicitly selected, try it first
  if (provider === "openai") {
    try {
      const openai = await createOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        return parseJsonFromLlm<T>(content);
      }
    } catch (openaiErr) {
      console.warn(
        "[case-intake/llm] OpenAI execution failed, falling back to Gemini:",
        openaiErr instanceof Error ? openaiErr.message : openaiErr
      );
      // Fall through to Gemini
    }
  }

  // Default / Gemini execution
  const prompt = `${systemPrompt}\n\nUser Request / Payload:\n${userPrompt}`;
  const geminiText = await generateGeminiText({
    prompt,
    temperature,
    maxOutputTokens,
    responseMimeType: "application/json",
  });

  return parseJsonFromLlm<T>(geminiText);
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateCaseIntakeChatJson<T = any>(opts: {
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const { systemPrompt, messages, temperature = 0.3, maxOutputTokens = 2048 } = opts;

  let provider = "gemini";
  try {
    provider = await llm.resolveProviderForFeature("chat");
  } catch {
    provider = "gemini";
  }

  if (provider === "openai") {
    try {
      const openai = await createOpenAIClient();
      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
      ];

      for (const model of ["gpt-4o-mini", "gpt-3.5-turbo"]) {
        try {
          const response = await openai.chat.completions.create({
            model,
            temperature,
            response_format: { type: "json_object" },
            messages: chatMessages,
          });

          const content = response.choices?.[0]?.message?.content;
          if (content) {
            return parseJsonFromLlm<T>(content);
          }
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          if (errorMsg.includes("404") || errorMsg.includes("does not have access")) {
            continue;
          }
          throw err;
        }
      }
    } catch (openaiErr) {
      console.warn(
        "[case-intake/llm] OpenAI chat failed, falling back to Gemini:",
        openaiErr instanceof Error ? openaiErr.message : openaiErr
      );
      // Fall through to Gemini
    }
  }

  // Format conversational prompt for Gemini
  const promptParts: string[] = [systemPrompt, "\nConversation History:"];
  for (const m of messages) {
    promptParts.push(`${m.role.toUpperCase()}: ${m.content}`);
  }
  promptParts.push("ASSISTANT (Return ONLY valid JSON matching the schema, with no markdown fences):");
  const prompt = promptParts.join("\n\n");

  const geminiText = await generateGeminiText({
    prompt,
    temperature,
    maxOutputTokens,
    responseMimeType: "application/json",
  });

  return parseJsonFromLlm<T>(geminiText);
}
