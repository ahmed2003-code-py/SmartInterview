import { z } from "zod";
import { Prisma } from "@prisma/client";
import { EducationItem, ExperienceItem, ProjectItem } from "./profileCv.js";

/** Everything the client may see about the signed-in user (never the password hash or avatar bytes). */
export const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  headline: true,
  targetRole: true,
  specialization: true,
  experienceLevel: true,
  bio: true,
  avatarUpdatedAt: true,
  preferences: true,
  currentRole: true,
  education: true,
  experience: true,
  projects: true,
  skills: true,
  certifications: true,
  languages: true,
  cvFileName: true,
  cvUpdatedAt: true,
  cvStatus: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export const PreferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]),
    uiLanguage: z.enum(["ar", "en"]),
    interviewLanguage: z.enum(["ar", "en", "smart"]),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    length: z.enum(["quick", "standard", "full"]),
    autoPlayVoice: z.boolean(),
    captions: z.boolean(),
    reducedMotion: z.enum(["system", "reduce"]),
    /** The optional first-run "personalize with your CV" prompt was dismissed. */
    cvPromptDismissed: z.boolean(),
  })
  .partial()
  .strict();
export type Preferences = z.infer<typeof PreferencesSchema>;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/\s+/g, " ") || null)
    .nullable();

export const ProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(80),
    headline: text(120),
    targetRole: text(80),
    specialization: text(80),
    experienceLevel: z.enum(["student", "graduate", "early", "experienced"]).nullable(),
    // The bio keeps its line breaks.
    bio: z.string().trim().max(400).transform((s) => s || null).nullable(),
    currentRole: text(80),
    // Background lists: every item validated, empty entries dropped, sizes capped.
    education: z.array(EducationItem).max(8),
    experience: z.array(ExperienceItem).max(10),
    projects: z.array(ProjectItem).max(8),
    skills: z.array(z.string().trim().min(1).max(60)).max(30),
    certifications: z.array(z.string().trim().min(1).max(60)).max(15),
    languages: z.array(z.string().trim().min(1).max(60)).max(10),
  })
  .partial()
  .strict();

export function publicUser(u: UserRow) {
  const { avatarUpdatedAt, preferences, cvFileName, cvUpdatedAt, cvStatus, education, experience, projects, ...rest } = u;
  return {
    ...rest,
    education: Array.isArray(education) ? education : [],
    experience: Array.isArray(experience) ? experience : [],
    projects: Array.isArray(projects) ? projects : [],
    // The primary CV: only its name and state. The file is never stored; the text never leaves the server.
    cv: cvFileName ? { fileName: cvFileName, updatedAt: cvUpdatedAt, status: cvStatus === "failed" ? "failed" : "ready" } : null,
    // Cache-busting version for the avatar URL; null = no photo (initials are shown).
    avatarVersion: avatarUpdatedAt ? avatarUpdatedAt.getTime() : null,
    preferences: (PreferencesSchema.safeParse(preferences ?? {}).data ?? {}) as Preferences,
  };
}
