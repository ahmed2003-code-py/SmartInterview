import { app } from "./app.js";
import { config } from "./config.js";
import { ensureDemoAccount, ensureRoles } from "./db/seed-data.js";

await ensureRoles();
if (config.seedDemoAccount && (await ensureDemoAccount())) console.log("Demo account created");

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API on http://localhost:${config.port}  (MOCK_AI=${config.mockAI})`);
  if (!config.mockAI && !config.llm.apiKey) console.warn("Warning: MOCK_AI=false but no GROQ_API_KEY / LLM_API_KEY is set. AI requests will fail.");
});
