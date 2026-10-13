import { Router } from "express";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { dashboard } from "../services/interviews.js";

export const metaRouter = Router();

metaRouter.get("/config", (_req, res) => {
  res.json({ mockAI: config.mockAI, maxAnswerSeconds: config.limits.maxAnswerSeconds, maxJobDescriptionChars: config.limits.maxJobDescriptionChars });
});

metaRouter.get("/roles", async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, nameEn: true, nameAr: true, descriptionEn: true, descriptionAr: true } });
  res.json({ roles });
});

metaRouter.get("/dashboard", requireAuth, async (req, res) => {
  res.json(await dashboard(req.userId!));
});
