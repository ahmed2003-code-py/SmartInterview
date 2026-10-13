# SmartInterview: final product status

Production: https://smartinterview-production.up.railway.app
One Railway service (Express API + built React app) and one Railway PostgreSQL database.

Status key: **COMPLETE** = built and tested end to end · **PARTIAL** = works with a stated limit · **OUT OF SCOPE** = intentionally not built.

## 1. Product overview — COMPLETE
SmartInterview is a voice interview practice product. A student picks any role (or types their own), optionally adds a specialization, CV and job description, then answers an AI interviewer out loud in Arabic, English or both. The interviewer follows up on what was actually said. Each interview ends with a scored report, and the dashboard tracks progress over time. The user has an account with a profile, settings and history.

## 2. Current architecture — COMPLETE
- **Frontend:** React 19, Vite, TypeScript, Tailwind v4, Radix primitives, Motion (animation engine lazy-loaded), sonner toasts.
- **Backend:** Express 5, TypeScript, Zod validation, Prisma 6, PostgreSQL. JWT in an httpOnly cookie.
- **AI:**
  - Interviewer and reports: Groq `openai/gpt-oss-120b`, falling back to `gpt-oss-20b`.
  - Speech-to-text: Gemini `gemini-2.5-flash` (primary) and Groq `whisper-large-v3` (fallback).
  - Voices: ElevenLabs for Arabic questions, the browser voice for English questions.
- **Deployment:** a single Railway service serves `/api` and the built frontend.

## 3. Main user journey — COMPLETE (tested on production)
Register → edit profile → settings → dashboard → new interview (custom role, specialization, CV PDF, job description, Smart language) → voice answers → automatic transcription and submission → follow-up questions → report → history → reopen report → Practice again (pre-filled) → log out → log in (profile and preferences restored).

## 4. Authentication — COMPLETE
- Email and password (bcrypt, cost 10), JWT in an httpOnly cookie, rate-limited login and register.
- Password change requires the current password.
- Protected routes redirect to login.
- Password reset by email is **OUT OF SCOPE**: there is no email service.

## 5. Profile — COMPLETE
`/profile`:
- Photo: upload, change, remove. The browser resizes it to 256 px. The server checks the image type from its own bytes (JPG/PNG/WebP) and caps size at 300 KB. It is stored in Postgres, so no extra storage service.
- Name, headline, short bio, target role (same searchable role picker), specialization, experience level.
- Validated server-side with a strict schema.
- The target role and specialization pre-fill New interview.

## 6. Settings / preferences — COMPLETE
`/settings`, stored on the account (`User.preferences`) so they follow the user to any device:
- Theme (light/dark/system) and app language (Arabic/English).
- Interview defaults: language (Arabic/English/Smart), difficulty, length.
- Read questions aloud, live captions, reduce motion.
- Privacy notes (audio and CV handling), email (read-only), change password, log out.
- The header language switch stays as a shortcut and syncs to the account.

## 7. Dashboard — COMPLETE
- Time-of-day greeting.
- Four count-up metrics from real data only: interviews, average, best, practice time.
- Score trend chart: animated line, tooltip with date, role and score. Shown only with 2 or more interviews.
- Average skill bars.
- One deterministic next step: the lowest skill, shown only when there is a real gap of 5 or more points.
- Profile nudge when no target role is set.
- Recent interviews with a change versus the previous interview for the same role.
- Empty state for new users, with no fake numbers.

## 8. Interview setup — COMPLETE
- Three steps: role and specialization, then personalize (CV and job description), then preferences.
- Live summary beside the form on desktop, sticky bar on mobile.
- Defaults come, in priority order, from a Practice again link, then the profile, then the settings.

## 9. CV / job description personalization — COMPLETE
- CV (PDF/DOCX/TXT, up to 5 MB, type checked from file bytes) is read in memory and condensed to a profile of up to 1,500 characters with no contact details. Only that profile is stored; the file and raw text are never stored or logged.
- The job description is optional, up to 2,500 characters.
- Both are untrusted data wrapped in tags in prompts; instructions inside them are ignored.

## 10. Dynamic roles — COMPLETE
- 14 suggested roles: 8 education, 6 general. Any typed role in Arabic or English also works and is stored exactly as typed (`Interview.roleTitle`).
- The interviewer persona follows the role's field (education, general, or custom).
- Tested on production with "AI Solutions Architect" + "RAG and AI Agents", and locally with the real AI for "أخصائي تسويق رقمي" + "إعلانات فيسبوك".

## 11. Voice / STT / TTS flow — COMPLETE
Flow: record (Opus 64 kbps) → upload once → transcript shown → sent automatically. Exactly one STT request and one answer per recording (verified).

Bounded latency:
- Gemini is skipped while its free quota (20 requests per day) is used up.
- The fallback starts at once on error, or in parallel after a delay of about 4 s plus 50 ms per audio second.
- Provider timeouts are 12–30 s.
- The browser shows "Taking a little longer than usual…" after 8 s and offers Retry with the same recording after 45 s.
- Every answer writes one safe log line: trace id, size, timings, attempts and outcome, never content.

Measured on production, Done → visible transcript:

| Answer | Time |
|---|---|
| 7.8 s mixed | 2.2 s |
| 7.5 s Egyptian | 1.2 s |
| 10.6 s English | 1.1 s |
| 38 s mixed | 2.7 s |

Whisper always uses the Egyptian code-switching prompt. Measured on the same audio, an English prompt translated or dropped Arabic answers.

Voices: ElevenLabs for Arabic, the browser voice for English. "Read questions aloud" can be turned off; Replay still plays the question.

## 12. Smart / bilingual behaviour — COMPLETE
- The interviewer follows the language of each answer, and an explicit request to switch language wins.
- Each question records its own language (it drives the voice).
- The report language follows the dominant language of the answers.

## 13. Interview engine — COMPLETE
- Each turn: anchor on the answer, react to it, then decide follow-up, next topic or finish (at most 2 follow-ups in a row).
- A repeated or stuck question is regenerated.
- Five criteria are scored per answer.
- If the main model is out of quota, the fallback model is used.

## 14. Reports — COMPLETE
- Animated score ring, performance label, and change versus the previous interview for the same role (only when it exists).
- Skill bars, summary, 2–3 strengths, improvements and next steps.
- Question breakdown collapsed by default.
- Report language is fixed by a deterministic rule. Any per-question note in another language is rewritten.
- Tested: Arabic, English, Smart-Arabic and Smart-English.

## 15. History — COMPLETE
- Role (custom included), specialization, date, language, difficulty, duration and score.
- Filters by role, language and status. Open report, and Practice again pre-filled.

## 16. Data model — COMPLETE
- `User`: profile fields, avatar bytes, preferences JSON.
- `Role`: suggestions with a domain.
- `Interview`: either `roleId` or a custom `roleTitle`, plus specialization, language mode, CV profile and job description.
- `Question` (with its language), `Answer` (five criteria and feedback), `Report` (with its language).
- All migrations are additive. The production data was never reset.

## 17. Security / privacy decisions — COMPLETE
- API keys are backend-only; the frontend bundle was scanned and contains none.
- Every interview, report, answer and audio route is scoped to its owner (other users get 404, verified).
- Strict Zod schemas reject unknown fields.
- CV, job description, custom role and specialization are treated as untrusted prompt data.
- Audio is never stored. No CV, transcript or audio content goes into logs.
- Uploads (CV, audio, avatar) are checked by file signature and size.

## 18. Error / failure handling — COMPLETE
- Network, STT failure or timeout, AI failure (Retry reuses the transcript), microphone denied (typing fallback), voice unavailable (text), report failure, CV errors, and profile or settings save errors (toast and rollback).
- 16 automated robustness checks pass.

## 19. Responsive / RTL support — COMPLETE
- 390, 768 and 1440 px, Arabic RTL and English LTR, light and dark.
- No horizontal overflow on any checked page.
- Tested with long names, long custom roles, a 10-question interview, and long Arabic and mixed transcripts.

## 20. Production deployment — COMPLETE
- The existing Railway project, service and Postgres.
- `MOCK_AI=false`, health check `/api/health` returns ok.
- Migrations run on start with `prisma migrate deploy`.

## 21. Test coverage — PARTIAL
- **Automated browser checks** (Playwright scripts used during development): the robustness suite, room E2E in Arabic and English, the production journey, visual and overflow sweeps, and API tests for the profile, preferences and access boundaries.
- **Not in the repository:** there is no unit-test suite and no CI. The scripts live outside the repository.
- **Real microphone:** recordings were injected into the browser from real speech files, so a final check with a real microphone on a phone is still recommended.

## 22. Known limitations
See `docs/REMAINING-GAPS.md`.
