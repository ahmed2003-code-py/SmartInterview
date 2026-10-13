/**
 * Developer-only STT benchmark: the SAME audio bytes go to Groq Whisper and to Gemini model(s),
 * through the app's own provider code. Not part of the app.
 *
 *   GROQ_API_KEY=... GEMINI_API_KEY=... npx tsx scripts/stt-benchmark.ts manifest.json [--gemini m1,m2] [--out results.json]
 *
 * Manifest: [{ name, category, ref, file }]. Prints per-sample transcripts and a summary table.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { geminiProvider, groqWhisper, type Lang, type STTProvider } from "../src/providers/stt.js";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const geminiModels = (flag("gemini") ?? "gemini-3.5-transcribe").split(",");
const outFile = flag("out");
const only = flag("only");
const manifestPath = args[0];
type Item = { name: string; category: string; ref: string; file: string };
let items = JSON.parse(readFileSync(manifestPath, "utf8")) as Item[];
if (only) items = items.filter((i) => new RegExp(only).test(i.name));

const providers: STTProvider[] = [groqWhisper, ...geminiModels.map((m) => geminiProvider(m))];

// Reference cleanup (corpus markup) + Arabic-aware normalisation for fair comparison.
function norm(t: string) {
  return t
    .replace(/\[[A-Z_]+\]/g, " ") // [LAUGHTER], [HES]
    .replace(/\+/g, "") // ArzEn "ال+usual" = "الusual"
    .replace(/\*/g, " ")
    .replace(/الـ\s*/g, "ال")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim();
}
function edit<T>(a: T[], b: T[]) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const cer = (r: string, h: string) => {
  const a = [...norm(r).replace(/ /g, "")];
  return a.length ? edit(a, [...norm(h).replace(/ /g, "")]) / a.length : 0;
};
const wer = (r: string, h: string) => {
  // Arabic prefix "ال" attached to English words is split so "الusual" vs "ال usual" isn't penalised.
  const split = (t: string) => norm(t).replace(/ال([a-z])/g, "ال $1").split(" ").filter(Boolean);
  const a = split(r);
  return a.length ? edit(a, split(h)) / a.length : 0;
};
const englishWords = (t: string) => (t.replace(/\[[A-Z_]+\]/g, "").match(/[A-Za-z][A-Za-z'-]+/g) ?? []).map((w) => w.toLowerCase());
const englishKept = (r: string, h: string) => {
  const words = englishWords(r);
  const hyp = h.toLowerCase();
  return [words.filter((w) => hyp.includes(w)).length, words.length];
};
const langOf = (cat: string): Lang => (/^english/.test(cat) ? "en" : "ar");

type Result = { name: string; category: string; provider: string; text: string; ms: number; ok: boolean; cer: number | null; wer: number | null; enKept: number; enTotal: number };
const results: Result[] = [];

for (const item of items) {
  const file = path.isAbsolute(item.file) ? item.file : path.resolve(path.dirname(manifestPath), item.file);
  const audio = readFileSync(file); // read ONCE; the same bytes go to every provider
  console.log(`\n■ ${item.name}  [${item.category}]`);
  if (item.ref) console.log(`  reference          : ${item.ref}`);
  for (const p of providers) {
    let text = "";
    let ok = false;
    let ms = 0;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      const t0 = Date.now();
      try {
        text = await p.transcribe(audio, "audio/webm", langOf(item.category), { roleSlug: "math-teacher" });
        ok = true;
      } catch {
        await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1))); // free-tier rate limits
      }
      ms = Date.now() - t0;
    }
    const scored = ok && item.ref;
    const [k, n] = item.ref ? englishKept(item.ref, text) : [0, 0];
    results.push({ name: item.name, category: item.category, provider: p.name, text, ms, ok, cer: scored ? cer(item.ref, text) : null, wer: scored ? wer(item.ref, text) : null, enKept: k, enTotal: n });
    const r = results.at(-1)!;
    console.log(`  ${p.name.padEnd(19)}: ${ok ? text || "∅ (no speech)" : "FAILED"}   [${r.cer != null ? `CER ${(r.cer * 100).toFixed(0)}% WER ${(r.wer! * 100).toFixed(0)}%` : ""}${n ? ` EN ${k}/${n}` : ""} ${ms}ms]`);
  }
}

// ---- summary ----
const buckets: [string, RegExp][] = [
  ["Egyptian Arabic (real)", /^egyptian arabic/],
  ["Mixed AR/EN (real)", /^mixed \(real/],
  ["Mixed AR/EN (synthetic, your sentences)", /^mixed \(synthetic|switching/],
  ["Math / education vocab (synthetic)", /vocab/],
  ["English (+ Arabic words)", /^english/],
  ["Long real answers (38s, 64s)", /^long/],
];
const pct = (xs: number[]) => (xs.length ? `${((xs.reduce((a, b) => a + b, 0) / xs.length) * 100).toFixed(1)}%` : "-");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
console.log("\n\nSUMMARY (CER / WER, lower is better; EN = English terms kept verbatim)");
for (const [label, re] of buckets) {
  const line = providers.map((p) => {
    const rs = results.filter((r) => r.provider === p.name && re.test(r.category) && r.cer != null);
    const k = rs.reduce((a, r) => a + r.enKept, 0);
    const n = rs.reduce((a, r) => a + r.enTotal, 0);
    return `${p.name}: CER ${pct(rs.map((r) => r.cer!))} WER ${pct(rs.map((r) => r.wer!))}${n ? ` EN ${k}/${n}` : ""}`;
  });
  console.log(`  ${label.padEnd(42)} | ${line.join(" | ")}`);
}
for (const p of providers) {
  const rs = results.filter((r) => r.provider === p.name);
  const ms = rs.filter((r) => r.ok).map((r) => r.ms);
  const hallu = rs.filter((r) => /non-speech/.test(r.category) && r.ok && r.text).length;
  const nonspeech = rs.filter((r) => /non-speech/.test(r.category)).length;
  const scored = rs.filter((r) => r.cer != null);
  console.log(
    `  ${p.name.padEnd(28)} overall CER ${pct(scored.map((r) => r.cer!))} WER ${pct(scored.map((r) => r.wer!))} | latency avg ${Math.round(ms.reduce((a, b) => a + b, 0) / (ms.length || 1))}ms median ${median(ms)}ms worst ${Math.max(0, ...ms)}ms | failures ${rs.filter((r) => !r.ok).length}/${rs.length} | hallucinated on non-speech ${hallu}/${nonspeech}`,
  );
}
if (outFile) writeFileSync(outFile, JSON.stringify(results, null, 1));
