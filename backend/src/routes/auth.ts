import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/errors.js";
import { clearAuthCookie, requireAuth, setAuthCookie } from "../middleware/auth.js";
import { publicUser, userSelect } from "../services/users.js";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "RATE_LIMITED", message: "Too many attempts, try again later" } });

const email = z.string().trim().toLowerCase().email("Invalid email").max(200);
const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
const LoginSchema = z.object({ email, password: z.string().min(1).max(200) });


authRouter.post("/register", limiter, async (req, res) => {
  const body = RegisterSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");
  const user = await prisma.user.create({ data: { name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 10) }, select: userSelect });
  setAuthCookie(res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const body = LoginSchema.parse(req.body);
  const found = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true, passwordHash: true } });
  if (!found || !(await bcrypt.compare(body.password, found.passwordHash))) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  setAuthCookie(res, found.id);
  res.json({ user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: found.id }, select: userSelect })) });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: userSelect });
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please log in");
  res.json({ user: publicUser(user) });
});
