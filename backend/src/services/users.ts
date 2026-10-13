import { z } from "zod";
import { Prisma } from "@prisma/client";

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
  })
  .partial()
  .strict();

export function publicUser(u: UserRow) {
  const { avatarUpdatedAt, preferences, ...rest } = u;
  return {
    ...rest,
    // Cache-busting version for the avatar URL; null = no photo (initials are shown).
    avatarVersion: avatarUpdatedAt ? avatarUpdatedAt.getTime() : null,
    preferences: (PreferencesSchema.safeParse(preferences ?? {}).data ?? {}) as Preferences,
  };
}
