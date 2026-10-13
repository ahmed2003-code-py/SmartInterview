/**
 * Deterministic smoke test (run against a local stack with MOCK_AI=true; no real AI or voice providers):
 * register → dashboard → settings → new interview → typed answers → report → history → logout.
 *
 *   BASE=http://localhost:5173 CHROME=/usr/bin/google-chrome npm run test:e2e
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:5173";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
await page.addInitScript(() => localStorage.setItem("lang", "en"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let failed = 0;
const check = (cond, msg) => {
  console.log(cond ? "✓" : "✗", msg);
  if (!cond) failed++;
};

try {
  await page.goto(BASE + "/register");
  await page.locator("#name").fill("Smoke Test");
  await page.locator("#email").fill(`smoke-${Date.now()}@example.com`);
  await page.locator("#password").fill("password123");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/dashboard/);
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15000 });
  check(true, "register → dashboard");

  await page.goto(BASE + "/settings");
  await page.getByRole("radiogroup", { name: "Difficulty" }).getByRole("radio", { name: "Intermediate" }).click();
  await page.waitForTimeout(800);
  await page.goto(BASE + "/interviews/new");
  await page.getByRole("combobox").fill("Machine Learning Engineer");
  await page.keyboard.press("Enter");
  check((await page.getByRole("radio", { name: "Intermediate" }).getAttribute("aria-checked")) === "true", "settings default pre-fills setup");
  await page.getByRole("button", { name: "Start interview" }).first().click();
  await page.waitForURL((u) => /\/interviews\/[a-z0-9]+$/.test(u.pathname), { timeout: 30000 });
  check(true, "custom-role interview created");

  for (let i = 0; i < 6; i++) {
    // First turn: switch to typing; afterwards the room stays in typing mode.
    const typeBtn = page.getByRole("button", { name: "Type your answer instead" });
    const box = page.getByPlaceholder("Type your answer here…");
    const r = await Promise.race([
      typeBtn.waitFor({ timeout: 30000 }).then(() => "button"),
      box.waitFor({ timeout: 30000 }).then(() => "box"),
      page.getByRole("link", { name: "View report" }).waitFor({ timeout: 30000 }).then(() => "done"),
    ]);
    if (r === "done") break;
    if (r === "button") await typeBtn.click();
    await box.fill("I would explain my reasoning step by step and give a concrete example from a project I built.");
    const answered = await page.locator("[data-question]").count();
    await page.getByRole("button", { name: "Send answer" }).click();
    // Wait for the next question (or the end) before typing again.
    await page.waitForFunction((n) => document.querySelectorAll("[data-question]").length > n || !!document.querySelector('a[href$="/report"]'), answered, { timeout: 30000 });
    await page.waitForTimeout(400);
  }
  await page.getByRole("link", { name: "View report" }).click();
  await page.waitForURL(/report$/);
  check((await page.locator("h1").first().innerText()).includes("Machine Learning Engineer"), "report shows the custom role");

  await page.goto(BASE + "/history");
  check(await page.getByText("Machine Learning Engineer").first().waitFor({ timeout: 15000 }).then(() => true, () => false), "history lists the interview");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL((u) => !/dashboard|history/.test(u.pathname), { timeout: 10000 });
  check(true, "logout");
} catch (err) {
  failed++;
  console.log("✗", err.message.split("\n")[0]);
}
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
process.exit(failed ? 1 : 0);
