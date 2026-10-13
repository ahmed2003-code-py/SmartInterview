import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { PreferencesSchema, ProfileSchema, publicUser, userSelect } from "../services/users.js";
import { CV_MAX_BYTES, readCvText } from "../services/cv.js";
import { backgroundText, extractCv, proposeMerge, type CvExtract, type ProfileFields } from "../services/profileCv.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const AVATAR_MAX_BYTES = 300 * 1024; // the browser resizes to 256px first; this is a hard ceiling
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } });
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30, keyGenerator: (req) => req.userId ?? "anon", standardHeaders: true, legacyHeaders: false });

/** Image type from the file's own bytes (the browser-declared type is not trusted). */
function imageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const me = async (userId: string) => publicUser(await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect }));

profileRouter.get("/", async (req, res) => {
  res.json({ user: await me(req.userId!) });
});

profileRouter.patch("/", writeLimiter, async (req, res) => {
  const data = ProfileSchema.parse(req.body);
  await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: await me(req.userId!) });
});

/** Merges the given preference keys into the stored ones. */
profileRouter.patch("/preferences", writeLimiter, async (req, res) => {
  const patch = PreferencesSchema.parse(req.body);
  const current = await prisma.user.findUniqueOrThrow({ where: { id: req.userId }, select: { preferences: true } });
  const merged = { ...(PreferencesSchema.safeParse(current.preferences ?? {}).data ?? {}), ...patch };
  await prisma.user.update({ where: { id: req.userId }, data: { preferences: merged } });
  res.json({ user: await me(req.userId!) });
});

profileRouter.post("/avatar", writeLimiter, avatarUpload.single("avatar"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "NO_FILE", "No image received");
  const type = imageType(req.file.buffer);
  if (!type) throw new HttpError(400, "AVATAR_UNSUPPORTED", "Use a JPG, PNG or WebP image");
  await prisma.user.update({ where: { id: req.userId }, data: { avatar: new Uint8Array(req.file.buffer), avatarType: type, avatarUpdatedAt: new Date() } });
  res.json({ user: await me(req.userId!) });
});

profileRouter.delete("/avatar", writeLimiter, async (req, res) => {
  await prisma.user.update({ where: { id: req.userId }, data: { avatar: null, avatarType: null, avatarUpdatedAt: null } });
  res.json({ user: await me(req.userId!) });
});

/** The signed-in user's own photo only. */
profileRouter.get("/avatar", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { avatar: true, avatarType: true } });
  if (!u?.avatar || !u.avatarType) throw new HttpError(404, "NOT_FOUND", "No photo");
  res.set({ "Content-Type": u.avatarType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
  res.send(Buffer.from(u.avatar));
});

const PasswordSchema = z.object({ current: z.string().min(1).max(200), next: z.string().min(8, "Password must be at least 8 characters").max(200) });
const passwordLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, keyGenerator: (req) => req.userId ?? "anon", standardHeaders: true, legacyHeaders: false });

profileRouter.post("/password", passwordLimiter, async (req, res) => {
  const body = PasswordSchema.parse(req.body);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(body.current, u.passwordHash))) throw new HttpError(400, "WRONG_PASSWORD", "Current password is incorrect");
  await prisma.user.update({ where: { id: req.userId }, data: { passwordHash: await bcrypt.hash(body.next, 10) } });
  res.json({ ok: true });
});

// ---------------- Primary CV ----------------
const cvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CV_MAX_BYTES, files: 1 } });
const cvLimiter = rateLimit({ windowMs: 60_000, limit: 6, keyGenerator: (req) => req.userId ?? "anon", standardHeaders: true, legacyHeaders: false, message: { error: "RATE_LIMITED", message: "Too many uploads, try again in a minute" } });

async function reviewFor(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, headline: true, currentRole: true, targetRole: true, specialization: true, experienceLevel: true, education: true, experience: true, projects: true, skills: true, certifications: true, languages: true, cvExtract: true },
  });
  if (!u.cvExtract) return null;
  const extract = u.cvExtract as unknown as CvExtract;
  const current: ProfileFields = { ...u, education: (u.education as unknown[]) ?? [], experience: (u.experience as unknown[]) ?? [], projects: (u.projects as unknown[]) ?? [] };
  return { proposal: proposeMerge(current, extract) };
}

/** Text → structured extraction → stored. On AI failure the text is kept (only then) so Retry needs no re-upload. */
async function extractAndStore(userId: string, text: string) {
  try {
    const extract = await extractCv(text);
    await prisma.user.update({ where: { id: userId }, data: { cvExtract: extract as object, cvProfile: backgroundText(extract), cvStatus: "ready", cvText: null } });
    return true;
  } catch {
    await prisma.user.update({ where: { id: userId }, data: { cvStatus: "failed", cvText: text } });
    return false;
  }
}

profileRouter.post("/cv", cvLimiter, cvUpload.single("cv"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "NO_FILE", "No file received");
  const text = await readCvText(req.file.buffer, req.file.originalname); // validates type by bytes, size by multer
  const fileName = req.file.originalname.replace(/[^\p{L}\p{N}._ ()-]/gu, "").slice(0, 120) || "CV";
  // Replacing a CV clears the previous extraction; confirmed profile fields are untouched.
  await prisma.user.update({ where: { id: req.userId }, data: { cvFileName: fileName, cvUpdatedAt: new Date(), cvExtract: Prisma.DbNull, cvProfile: null, cvText: null, cvStatus: null } });
  const ok = await extractAndStore(req.userId!, text);
  res.json({ user: await me(req.userId!), review: ok ? await reviewFor(req.userId!) : null });
});

profileRouter.post("/cv/retry", cvLimiter, async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.userId }, select: { cvText: true } });
  if (!u.cvText) throw new HttpError(409, "NOTHING_TO_RETRY", "Upload your CV again");
  const ok = await extractAndStore(req.userId!, u.cvText);
  if (!ok) throw new HttpError(502, "CV_FAILED", "Couldn't process this CV right now");
  res.json({ user: await me(req.userId!), review: await reviewFor(req.userId!) });
});

profileRouter.get("/cv/review", async (req, res) => {
  res.json({ review: await reviewFor(req.userId!) });
});

/** Removes the CV and everything derived from it. Profile fields the user applied stay. */
profileRouter.delete("/cv", writeLimiter, async (req, res) => {
  await prisma.user.update({ where: { id: req.userId }, data: { cvFileName: null, cvUpdatedAt: null, cvStatus: null, cvText: null, cvExtract: Prisma.DbNull, cvProfile: null } });
  res.json({ user: await me(req.userId!) });
});
