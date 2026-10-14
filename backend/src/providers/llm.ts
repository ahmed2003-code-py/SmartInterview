import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { fetchWithRateLimitRetry } from "./http.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** One request to one model. Returns the response, or null when it is worth trying another model. */
async function request(model: string, messages: ChatMessage[], maxTokens: number, effort: "low" | "medium"): Promise<Response | null> {
  const isReasoningModel = model.includes("gpt-oss");
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      // Reasoning tokens count toward the limit, so leave room for them.
      max_completion_tokens: isReasoningModel ? maxTokens + (effort === "medium" ? 3000 : 1500) : maxTokens,
      response_format: { type: "json_object" },
      ...(isReasoningModel ? { reasoning_effort: effort } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  };
  let res: Response;
  try {
    res = await fetch(`${config.llm.baseUrl}/chat/completions`, init);
    // Short per-minute limits are worth one wait; a daily limit is not.
    if (res.status === 429) {
      const body = await res.clone().text();
      if (/per day|TPD|RPD/i.test(body)) {
        console.warn(`LLM ${model} daily limit reached`);
        return null;
      }
      res = await fetchWithRateLimitRetry(`${config.llm.baseUrl}/chat/completions`, init);
    }
  } catch (err) {
    console.error("LLM network error", model, err instanceof Error ? err.message : err);
    return null;
  }
  if (!res.ok) {
    console.error("LLM error", model, res.status, (await res.text()).slice(0, 300));
    return res.status === 429 || res.status >= 500 ? null : res;
  }
  return res;
}

/**
 * Calls an OpenAI-compatible chat API in JSON mode and returns the parsed object.
 * If the main model is rate-limited (e.g. Groq's free daily token budget) or failing, the fallback
 * models (separate budgets on Groq) answer instead, so the interview keeps going.
 */
export async function chatJSON(messages: ChatMessage[], maxTokens: number, effort: "low" | "medium" = "low"): Promise<unknown> {
  const t0 = Date.now();
  // Main model, then fallbacks with separate quotas (Groq limits are per model).
  const models = [...new Set([config.llm.model, config.llm.fallbackModel, config.llm.lastResortModel].filter(Boolean))];
  let usedModel = models[0];
  let res: Response | null = null;
  for (const model of models) {
    usedModel = model;
    res = await request(model, messages, maxTokens, effort);
    if (res) break;
  }
  if (!res || !res.ok) throw new HttpError(502, "AI_FAILED", "The AI service returned an error");
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  if (config.stt.debug) console.log(`[llm] model=${usedModel} effort=${effort} prompt=${data.usage?.prompt_tokens} completion=${data.usage?.completion_tokens} ms=${Date.now() - t0}`);
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
