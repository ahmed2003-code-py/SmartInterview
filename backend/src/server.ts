import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { interviewsRouter } from "./routes/interviews.js";
import { profileRouter } from "./routes/profile.js";
import { metaRouter } from "./routes/meta.js";
import { ensureDemoAccount, ensureRoles } from "./db/seed-data.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.use("/api/interviews", interviewsRouter);
app.use("/api/profile", profileRouter);
app.use("/api", metaRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Not found" });
});

// In production the backend also serves the built frontend.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use(errorHandler);

await ensureRoles();
if (config.seedDemoAccount && (await ensureDemoAccount())) console.log("Demo account created");

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API on http://localhost:${config.port}  (MOCK_AI=${config.mockAI})`);
  if (!config.mockAI && !config.llm.apiKey) console.warn("Warning: MOCK_AI=false but no GROQ_API_KEY / LLM_API_KEY is set. AI requests will fail.");
});
