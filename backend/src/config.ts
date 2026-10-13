import "dotenv/config";

const env = process.env;

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(env.PORT ?? 4000),
  isProd: env.NODE_ENV === "production",
  jwtSecret: required("JWT_SECRET"),
  mockAI: env.MOCK_AI === "true",
  seedDemoAccount: env.SEED_DEMO_ACCOUNT === "true",
  stt: {
    groqApiKey: env.GROQ_API_KEY ?? "",
    // Full large-v3: noticeably more accurate than turbo on Egyptian Arabic.
    groqModel: env.GROQ_STT_MODEL || "whisper-large-v3",
    debug: env.STT_DEBUG === "true" || env.NODE_ENV !== "production",
  },
  llm: {
    // Groq's OpenAI-compatible endpoint; overridable for local testing only.
    baseUrl: env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    apiKey: env.GROQ_API_KEY ?? "",
    model: env.LLM_MODEL || "openai/gpt-oss-120b",
  },
  limits: {
    maxAudioBytes: 8 * 1024 * 1024,
    maxAnswerSeconds: 120,
    maxAnswerChars: 4000,
    maxJobDescriptionChars: 2500,
  },
};

export const QUESTION_COUNTS = { quick: 4, standard: 6, full: 10 } as const;
export type InterviewLength = keyof typeof QUESTION_COUNTS;
