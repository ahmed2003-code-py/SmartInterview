import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { fetchWithRateLimitRetry } from "./http.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Calls an OpenAI-compatible chat API in JSON mode and returns the parsed object. */
export async function chatJSON(messages: ChatMessage[], maxTokens: number, effort: "low" | "medium" = "low"): Promise<unknown> {
  const isReasoningModel = config.llm.model.includes("gpt-oss");
  let res: Response;
  const t0 = Date.now();
  try {
    res = await fetchWithRateLimitRetry(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.llm.apiKey}` },
      body: JSON.stringify({
        model: config.llm.model,
        messages,
        temperature: 0.7,
        // Reasoning tokens count toward the limit, so leave room for them.
        max_completion_tokens: isReasoningModel ? maxTokens + (effort === "medium" ? 3000 : 1500) : maxTokens,
        response_format: { type: "json_object" },
        ...(isReasoningModel ? { reasoning_effort: effort } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("LLM network error", err);
    throw new HttpError(502, "AI_FAILED", "Could not reach the AI service");
  }
  if (!res.ok) {
    console.error("LLM error", res.status, (await res.text()).slice(0, 500));
    throw new HttpError(502, "AI_FAILED", "The AI service returned an error");
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  if (config.stt.debug) console.log(`[llm] effort=${effort} prompt=${data.usage?.prompt_tokens} completion=${data.usage?.completion_tokens} ms=${Date.now() - t0}`);
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    // Some models wrap JSON in prose or code fences.
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new HttpError(502, "AI_FAILED", "The AI returned an unreadable response");
  }
}
