/**
 * Developer-only: compare Whisper prompt styles on the SAME audio (Groq whisper-large-v3).
 *   GROQ_API_KEY=... npx tsx scripts/whisper-prompt-sweep.ts manifest.json
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanTranscription } from "../src/providers/stt.js";

const PROMPTS: Record<string, string> = {
  current: "ده رد طالب في مقابلة شغل لوظيفة مدرس، بيتكلم بالعامية المصرية وساعات بيقول كلمات إنجليزي زي teaching assistant, lesson plan, classroom management, assessment, group work, primary, secondary.",
  none: "",
  // Whisper treats the prompt as preceding transcript: show the code-switched style itself.
  example:
    "أنا اشتغلت teaching assistant وكان عندي experience في classroom management، وكنت بعمل lesson plans للـ primary والـ secondary، وبستخدم assessment و differentiation.",
};
const manifestPath = process.argv[2];
const items = (JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string; category: string; ref: string; file: string }[]).filter(
  (i) => i.ref && !/^english|^long|non-speech/.test(i.category),
);
const norm = (t: string) =>
  t.replace(/\[[A-Z_]+\]/g, " ").replace(/\+/g, "").replace(/\*/g, " ").replace(/الـ\s*/g, "ال").replace(/[ً-ْـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}]+/gu, " ").toLowerCase().trim();
function edit(a: string[], b: string[]) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const cer = (r: string, h: string) => edit([...norm(r).replace(/ /g, "")], [...norm(h).replace(/ /g, "")]) / Math.max(1, [...norm(r).replace(/ /g, "")].length);
const en = (r: string, h: string) => {
  const w = (r.replace(/\[[A-Z_]+\]/g, "").match(/[A-Za-z][A-Za-z'-]+/g) ?? []).map((x) => x.toLowerCase());
  return [w.filter((x) => h.toLowerCase().includes(x)).length, w.length];
};
const stats: Record<string, { real: number[]; syn: number[]; k: number; n: number; leaks: number }> = {};
for (const p of Object.keys(PROMPTS)) stats[p] = { real: [], syn: [], k: 0, n: 0, leaks: 0 };
for (const item of items) {
  const audio = readFileSync(path.resolve(path.dirname(manifestPath), item.file));
  console.log(`\n■ ${item.name}\n  ref     : ${item.ref}`);
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    let json: unknown = {};
    for (let a = 0; a < 5; a++) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/webm" }), "a.webm");
      form.append("model", "whisper-large-v3");
      form.append("temperature", "0");
      form.append("response_format", "verbose_json");
      if (prompt) form.append("prompt", prompt);
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form });
      if (r.status === 429) {
        await new Promise((x) => setTimeout(x, 8000));
        continue;
      }
      json = await r.json();
      break;
    }
    const text = cleanTranscription(json as never, prompt);
    const c = cer(item.ref, text);
    const [k, n] = en(item.ref, text);
    const s = stats[name];
    (/real/.test(item.category) ? s.real : s.syn).push(c);
    s.k += k;
    s.n += n;
    // Leak = prompt-only words (descriptive phrases) appearing in the transcript.
    if (/بيقول كلمات|كلمات إنجليزي|مقابلة شغل/.test(text)) s.leaks++;
    console.log(`  ${name.padEnd(8)}: ${text}   [CER ${(c * 100).toFixed(0)}%${n ? ` EN ${k}/${n}` : ""}]`);
  }
}
const avg = (x: number[]) => (x.length ? ((x.reduce((a, b) => a + b, 0) / x.length) * 100).toFixed(1) + "%" : "-");
console.log("\nSUMMARY (same audio, Groq whisper-large-v3)");
for (const [p, s] of Object.entries(stats)) console.log(`  ${p.padEnd(8)} real-speech CER ${avg(s.real)} | synthetic mixed CER ${avg(s.syn)} | English kept ${s.k}/${s.n} | prompt leaks ${s.leaks}`);
