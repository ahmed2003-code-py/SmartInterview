import { describe, expect, it } from "vitest";
import { aggregateScores, answerScore, reportLanguageFor } from "../src/services/interviews.js";
import { CvExtractSchema, backgroundText, proposeMerge, type ProfileFields } from "../src/services/profileCv.js";
import { PreferencesSchema, ProfileSchema } from "../src/services/users.js";
import { combineProviders, type STTProvider, type STTAttempt } from "../src/providers/stt.js";
import { detectLanguageRequest } from "../src/ai/language.js";

const crit = (n: number) => ({ relevance: n, clarity: n, communication: n, subjectKnowledge: n, educationalReasoning: n });

describe("scores", () => {
  it("maps 1-10 criteria to 0-100", () => {
    expect(answerScore(crit(7))).toBe(70);
    expect(answerScore({ ...crit(10), clarity: 5 })).toBe(90);
  });
  it("never leaves 0-100 or produces NaN", () => {
    expect(answerScore(crit(42))).toBe(100);
    expect(answerScore(crit(-3))).toBe(0);
    expect(answerScore({ ...crit(5), clarity: Number.NaN })).toBe(40);
    const { overall, categoryScores } = aggregateScores([{ ...crit(8), score: 250 }, { ...crit(Number.NaN), score: Number.NaN }]);
    expect(overall).toBeGreaterThanOrEqual(0);
    expect(overall).toBeLessThanOrEqual(100);
    for (const v of Object.values(categoryScores)) expect(Number.isFinite(v) && v >= 0 && v <= 100).toBe(true);
  });
  it("averages answers", () => {
    expect(aggregateScores([{ ...crit(6), score: 60 }, { ...crit(8), score: 80 }])).toEqual({ overall: 70, categoryScores: crit(70) });
  });
});

describe("report language", () => {
  it("fixed interviews keep their language", () => {
    expect(reportLanguageFor("fixed", "ar", ["I answered in English"])).toBe("ar");
    expect(reportLanguageFor("fixed", "en", ["أجبت بالعربي"])).toBe("en");
  });
  it("smart follows the dominant language of the answers", () => {
    expect(reportLanguageFor("smart", "en", ["أنا اشتغلت teaching assistant وكان عندي خبرة كبيرة في الفصل"])).toBe("ar");
    expect(reportLanguageFor("smart", "ar", ["I worked as a teaching assistant for two years", "شكرا"])).toBe("en");
  });
});

describe("explicit language requests", () => {
  it("detects Arabic and English switch requests", () => {
    expect(detectLanguageRequest("ممكن السؤال الجاي بالإنجليزي؟")).toBe("en");
    expect(detectLanguageRequest("خلينا نكمل بالعربي")).toBe("ar");
    expect(detectLanguageRequest("Can we continue in English please")).toBe("en");
    expect(detectLanguageRequest("أنا بحب أدرّس")).toBeNull();
  });
});

describe("CV extraction schema", () => {
  it("drops junk, empty items and over-long lists; never throws on bad shapes", () => {
    const parsed = CvExtractSchema.parse({
      fullName: "  Ahmed   ElSayed ",
      experienceLevel: "wizard",
      skills: ["Python", "", 42, "  RAG  ", ...Array(40).fill("x")],
      education: [{ degree: "BSc Computer Science", institution: "Benha University" }, { foo: 1 }, "nope"],
      projects: "not a list",
      certifications: null,
    });
    expect(parsed.fullName).toBe("Ahmed ElSayed");
    expect(parsed.experienceLevel).toBeUndefined();
    expect(parsed.skills.slice(0, 2)).toEqual(["Python", "RAG"]);
    expect(parsed.skills.length).toBeLessThanOrEqual(30);
    expect(parsed.education).toHaveLength(1);
    expect(parsed.projects).toEqual([]);
    expect(parsed.certifications).toEqual([]);
  });
  it("background text contains facts only, bounded", () => {
    const t = backgroundText({ currentRole: "TA", skills: ["Python"], experience: [{ title: "Teaching Assistant", organization: "Benha University" }] })!;
    expect(t).toContain("Current role: TA");
    expect(t).toContain("Teaching Assistant, Benha University");
    expect(backgroundText({})).toBeNull();
  });
});

describe("CV merge rules", () => {
  const empty: ProfileFields = { name: "Ahmed", headline: null, currentRole: null, targetRole: null, specialization: null, experienceLevel: null, education: [], experience: [], projects: [], skills: [], certifications: [], languages: [] };
  const cv = CvExtractSchema.parse({ fullName: "Ahmed El Sayed", headline: "AI Engineer", specialization: "NLP", skills: ["Python", "RAG"], education: [{ degree: "BSc", institution: "Benha" }] });
  it("fills empty fields from the CV", () => {
    const p = proposeMerge(empty, cv);
    expect(p.headline).toMatchObject({ use: "cv", fromCv: "AI Engineer" });
    expect(p.skills).toMatchObject({ use: "cv" });
  });
  it("keeps what the user entered by default", () => {
    const p = proposeMerge({ ...empty, specialization: "Backend / Java", skills: ["Java"] }, cv);
    expect(p.specialization).toMatchObject({ use: "current", current: "Backend / Java", fromCv: "NLP" });
    expect(p.skills).toMatchObject({ use: "current", current: ["Java"] });
    // An existing name is never proposed for replacement by default.
    expect(p.name).toMatchObject({ use: "current" });
  });
  it("omits fields the CV doesn't mention or that already match", () => {
    const p = proposeMerge({ ...empty, headline: "AI Engineer" }, cv);
    expect(p.headline).toBeUndefined();
    expect(p.currentRole).toBeUndefined();
  });
});

describe("profile + preference validation", () => {
  it("rejects unknown fields and bad enums", () => {
    expect(ProfileSchema.safeParse({ isAdmin: true }).success).toBe(false);
    expect(ProfileSchema.safeParse({ experienceLevel: "guru" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ skills: Array(31).fill("x") }).success).toBe(false);
    expect(PreferencesSchema.safeParse({ theme: "neon" }).success).toBe(false);
    expect(PreferencesSchema.safeParse({ length: "full", cvPromptDismissed: true }).success).toBe(true);
  });
  it("normalizes whitespace and empty strings", () => {
    expect(ProfileSchema.parse({ headline: "  a   b  ", targetRole: "   " })).toEqual({ headline: "a b", targetRole: null });
  });
});

describe("STT fallback + timeouts", () => {
  const audio = Buffer.alloc(8_000);
  const provider = (name: string, ms: number, result: string | Error): STTProvider => ({
    name,
    transcribe: (_a, _m, _l, ctx) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => (result instanceof Error ? reject(result) : resolve(result)), ms);
        ctx?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      }),
  });
  it("uses the primary when it answers", async () => {
    expect(await combineProviders(provider("p", 5, "primary"), provider("f", 5, "fallback")).transcribe(audio, "audio/webm", "ar")).toBe("primary");
  });
  it("falls back immediately when the primary errors", async () => {
    const t0 = Date.now();
    expect(await combineProviders(provider("p", 5, new Error("429")), provider("f", 10, "fallback")).transcribe(audio, "audio/webm", "ar")).toBe("fallback");
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("starts the fallback in parallel when the primary is slow (hedge) and cancels the loser", async () => {
    const t0 = Date.now();
    expect(await combineProviders(provider("p", 5_000, "slow"), provider("f", 20, "fast"), 100).transcribe(audio, "audio/webm", "ar")).toBe("fast");
    expect(Date.now() - t0).toBeLessThan(1_000);
  });
  it("rejects (bounded) when both fail", async () => {
    await expect(combineProviders(provider("p", 5, new Error("a")), provider("f", 5, new Error("b"))).transcribe(audio, "audio/webm", "ar")).rejects.toThrow();
  });
  it("accepts an empty transcript (no speech) without retrying elsewhere", async () => {
    let fallbackCalls = 0;
    const f: STTProvider = { name: "f", transcribe: async () => (fallbackCalls++, "x") };
    expect(await combineProviders(provider("p", 5, ""), f).transcribe(audio, "audio/webm", "ar")).toBe("");
    expect(fallbackCalls).toBe(0);
  });
  it("records attempts without content", async () => {
    const trace: STTAttempt[] = [];
    await combineProviders(provider("p", 5, "ok"), null).transcribe(audio, "audio/webm", "ar", { trace });
    expect(JSON.stringify(trace)).not.toContain("ok\"");
  });
});
