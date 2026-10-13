import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { getSTT, type Lang } from "../providers/stt.js";
import { streamQuestionAudio, ttsConfigured } from "../providers/tts.js";
import { buildCvProfile, CV_MAX_BYTES } from "../services/cv.js";
import * as interviews from "../services/interviews.js";

export const interviewsRouter = Router();
interviewsRouter.use(requireAuth);

// Caps AI spend per user: plenty for a real interview, blocks runaway loops.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.userId ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many requests, slow down a little" },
});

const upload = multer({
  storage: multer.memoryStorage(), // audio is never written to disk
  limits: { fileSize: config.limits.maxAudioBytes, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("audio/") || file.mimetype === "video/webm"),
});

/** Checks the container signature so arbitrary files can't be sent to the STT provider. */
function looksLikeAudio(buf: Buffer) {
  if (buf.length < 12) return false;
  const hex = buf.subarray(0, 4).toString("hex");
  const ascii4 = buf.subarray(0, 4).toString("latin1");
  return (
    hex === "1a45dfa3" || // webm / matroska
    ascii4 === "OggS" ||
    ascii4 === "RIFF" || // wav
    buf.subarray(0, 3).toString("latin1") === "ID3" || buf[0] === 0xff || // mp3
    buf.subarray(4, 8).toString("latin1") === "ftyp" // mp4 / m4a
  );
}

const CreateSchema = z.object({
  roleId: z.string().min(1),
  language: z.enum(["en", "ar"]),
  languageMode: z.enum(["fixed", "smart"]).default("fixed"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  length: z.enum(["quick", "standard", "full"]),
  jobDescription: z.string().max(10_000).optional().nullable(),
  cvProfile: z.string().max(2_000).optional().nullable(),
});

const AnswerSchema = z.object({
  questionId: z.string().min(1),
  transcript: z.string().trim().min(1, "Answer is empty").max(config.limits.maxAnswerChars),
  durationSec: z.coerce.number().int().min(0).max(config.limits.maxAnswerSeconds + 10).optional(),
});

const ListSchema = z.object({
  roleId: z.string().optional(),
  language: z.enum(["en", "ar"]).optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
});

interviewsRouter.get("/", async (req, res) => {
  res.json({ interviews: await interviews.listInterviews(req.userId!, ListSchema.parse(req.query)) });
});

interviewsRouter.post("/", aiLimiter, async (req, res) => {
  res.status(201).json({ interview: await interviews.createInterview(req.userId!, CreateSchema.parse(req.body)) });
});

interviewsRouter.get("/:id", async (req, res) => {
  res.json({ interview: await interviews.getInterview(req.userId!, req.params.id) });
});

interviewsRouter.post("/:id/transcribe", aiLimiter, upload.single("audio"), async (req, res) => {
  const interview = await interviews.assertActive(req.userId!, req.params.id as string);
  if (!req.file) throw new HttpError(400, "NO_AUDIO", "No audio received");
  if (!looksLikeAudio(req.file.buffer)) throw new HttpError(400, "INVALID_AUDIO", "Unsupported audio format");
  // The browser measures how long the student actually spoke; skip paid STT for silent clips.
  const voicedSec = Number(req.body?.voicedSec);
  if (Number.isFinite(voicedSec) && voicedSec < 0.3) throw new HttpError(422, "NO_SPEECH", "We couldn't hear any speech");
  const durationSec = Number(req.body?.durationSec);
  const t0 = Date.now();
  const stt = getSTT();
  const text = await stt.transcribe(req.file.buffer, req.file.mimetype, interview.language as Lang, {
    roleSlug: interview.role.slug,
    question: interview.questions[0]?.text,
    durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
  });
  // Development timing (standard header; not shown to students).
  res.set("Server-Timing", `stt;dur=${Date.now() - t0};desc="${stt.name}"`);
  if (!text) throw new HttpError(422, "NO_SPEECH", "We couldn't hear any speech");
  res.json({ transcript: text.slice(0, config.limits.maxAnswerChars) });
});

interviewsRouter.post("/:id/answers", aiLimiter, async (req, res) => {
  const t0 = Date.now();
  const result = await interviews.submitAnswer(req.userId!, req.params.id as string, AnswerSchema.parse(req.body));
  res.set("Server-Timing", `ai;dur=${Date.now() - t0}`);
  res.json(result);
});

interviewsRouter.post("/:id/finish", aiLimiter, async (req, res) => {
  res.json({ interview: await interviews.finishInterview(req.userId!, req.params.id as string) });
});

// Interviewer voice for Arabic questions. Only stored questions of the student's own interview can
// be voiced, so this can't be used to synthesize arbitrary text.
const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.userId ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many requests" },
});

interviewsRouter.get("/:id/questions/:questionId/audio", ttsLimiter, async (req, res) => {
  const question = await interviews.findOwnedQuestion(req.userId!, req.params.id as string, req.params.questionId as string);
  // The voice follows the language each question was actually asked in (smart mode can switch).
  if ((question.language ?? question.interview.language) === "en") throw new HttpError(400, "TTS_NOT_USED", "Browser voice is used for English");
  if (!ttsConfigured()) throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not configured");
  let started = false;
  const t0 = Date.now();
  await streamQuestionAudio(question.id, question.text, {
    write(chunk) {
      if (!started) {
        started = true;
        res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "Server-Timing": `tts-first-byte;dur=${Date.now() - t0}` });
      }
      res.write(chunk);
    },
    end() {
      if (started) res.end();
      else res.status(503).json({ error: "TTS_UNAVAILABLE", message: "Voice is not available right now" });
    },
  });
});

// CV upload (optional personalization). Processed in memory; returns only a short profile.
const cvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CV_MAX_BYTES, files: 1 } });

interviewsRouter.post("/cv", aiLimiter, cvUpload.single("cv"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "NO_FILE", "No file received");
  const profile = await buildCvProfile(req.file.buffer, req.file.originalname);
  res.json({ fileName: req.file.originalname.slice(0, 120), profile });
});
