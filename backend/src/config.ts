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
  stt: {
    provider: (env.STT_PROVIDER ?? "groq") as "groq" | "cohere" | "mock",
    groqApiKey: env.GROQ_API_KEY ?? "",
    groqModel: env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
    cohereUrl: env.COHERE_STT_URL ?? "",
    cohereModel: env.COHERE_STT_MODEL ?? "CohereLabs/cohere-transcribe-arabic-07-2026",
    cohereApiKey: env.COHERE_STT_API_KEY ?? "",
  },
  llm: {
    baseUrl: env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
    // Falls back to the Groq key so one key is enough for STT + LLM.
    apiKey: env.LLM_API_KEY || env.GROQ_API_KEY || "",
    model: env.LLM_MODEL ?? "openai/gpt-oss-120b",
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
