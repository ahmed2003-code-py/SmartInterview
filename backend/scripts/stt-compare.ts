/**
 * Developer-only: send the SAME audio to whisper-large-v3-turbo and whisper-large-v3 and compare.
 * Not used by the app.
 *
 *   GROQ_API_KEY=... npx tsx scripts/stt-compare.ts <manifest.json | audio files...> [--lang ar] [--role arabic-teacher]
 *
 * A manifest is a JSON array of { name, file, ref? }; with `ref` (a reference transcript) a character
 * error rate is printed for each model.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanTranscription, whisperPrompt, type Lang } from "../src/providers/stt.js";

const MODELS = (process.env.MODELS ?? "whisper-large-v3-turbo,whisper-large-v3").split(",");
// PROMPT=app (default, the app's prompt) | none | <literal text>
const PROMPT = process.env.PROMPT ?? "app";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const lang = (flag("lang") ?? "ar") as Lang;
// --detect auto  => do not send the language parameter (Whisper auto-detects)
const detect = flag("detect") ?? "fixed";
const role = flag("role");
if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");

type Item = { name: string; file: string; ref?: string };
const items: Item[] =
  args.length === 1 && args[0].endsWith(".json")
    ? (JSON.parse(readFileSync(args[0], "utf8")) as Item[]).map((i) => ({ ...i, file: path.resolve(path.dirname(args[0]), i.file) }))
    : args.map((f) => ({ name: path.basename(f), file: f }));

// Arabic-aware normalisation for a fair character comparison.
function norm(t: string) {
  return t
    .replace(/[ً-ْـ]/g, "") // diacritics, tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function cer(ref: string, hyp: string) {
  const a = [...norm(ref).replace(/ /g, "")];
  const b = [...norm(hyp).replace(/ /g, "")];
  if (!a.length) return b.length ? 1 : 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / a.length;
}

async function transcribe(model: string, file: string) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(file)], { type: "audio/webm" }), path.basename(file));
  form.append("model", model);
  if (detect !== "auto") form.append("language", lang);
  form.append("temperature", "0");
  form.append("response_format", "verbose_json");
  const prompt = PROMPT === "app" ? whisperPrompt(lang, role) : PROMPT === "none" ? "" : PROMPT;
  if (prompt) form.append("prompt", prompt);
  const t0 = Date.now();
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });
    if (res.status !== 429 || attempt >= 6) break;
    const wait = Math.min(60, Number(res.headers.get("retry-after")) || 10);
    console.log(`  (rate limited, waiting ${wait}s)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  if (!res.ok) return { text: `ERROR ${res.status}`, ms: Date.now() - t0 };
  const json = await res.json();
  if (detect === "auto") console.log(`    detected=${json.language}`);
  return { text: cleanTranscription(json, prompt) || "∅ (rejected as no speech)", ms: Date.now() - t0 };
}

const totals: Record<string, number[]> = Object.fromEntries(MODELS.map((m) => [m, []]));
const kept: Record<string, [number, number]> = Object.fromEntries(MODELS.map((m) => [m, [0, 0]]));
// English terms in the reference that come back verbatim (Latin script) in the transcript.
function englishKept(ref: string, hyp: string): [number, number] {
  const words = ref.match(/[A-Za-z]+/g) ?? [];
  const h = hyp.toLowerCase();
  return [words.filter((w) => h.includes(w.toLowerCase())).length, words.length];
}
for (const item of items) {
  console.log(`\n■ ${item.name}`);
  if (item.ref) console.log(`  reference : ${item.ref}`);
  for (const model of MODELS) {
    const r = await transcribe(model, item.file);
    const score = item.ref && !item.ref.startsWith("[") ? cer(item.ref, r.text.startsWith("∅") ? "" : r.text) : null;
    if (score != null) totals[model].push(score);
    const [k, n] = item.ref ? englishKept(item.ref, r.text) : [0, 0];
    kept[model][0] += k;
    kept[model][1] += n;
    const label = model.replace("whisper-", "").padEnd(16);
    console.log(`  ${label}: ${r.text}${score != null ? `   [CER ${(score * 100).toFixed(0)}%, ${r.ms}ms]` : `   [${r.ms}ms]`}`);
  }
}
const avg = (xs: number[]) => (xs.length ? ((xs.reduce((a, b) => a + b, 0) / xs.length) * 100).toFixed(1) + "%" : "n/a");
console.log(`\nAverage CER (lower is better) over ${totals[MODELS[0]].length} clips with references (prompt: ${PROMPT.slice(0, 40)}):`);
for (const m of MODELS) console.log(`  ${m.padEnd(24)} ${avg(totals[m])}${kept[m][1] ? `   English terms kept verbatim: ${kept[m][0]}/${kept[m][1]}` : ""}`);
