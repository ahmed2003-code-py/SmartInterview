// One-time local setup: env file, database container, migrations, seed data.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const run = (cmd, cwd = ".") => execSync(cmd, { stdio: "inherit", cwd });

if (!existsSync("backend/.env")) {
  copyFileSync("backend/.env.example", "backend/.env");
  const env = readFileSync("backend/.env", "utf8").replace("change-me-to-a-long-random-string", randomBytes(32).toString("hex"));
  writeFileSync("backend/.env", env);
  console.log("Created backend/.env (MOCK_AI=true). Add GROQ_API_KEY and set MOCK_AI=false for real AI.");
}

console.log("Starting PostgreSQL (docker compose)...");
run("docker compose up -d db");
// Wait for the database to accept connections.
for (let i = 0; i < 30; i++) {
  try {
    execSync("docker exec interview-sim-db pg_isready -U interview", { stdio: "ignore" });
    break;
  } catch {
    execSync("sleep 1");
  }
}
run("npx prisma migrate deploy", "backend");
run("npx tsx prisma/seed.ts --demo", "backend");
console.log("\nDone. Run `npm run dev` and open http://localhost:5173");
