# SmartInterview · AI Interview Simulator

A voice-based interview simulator for Faculty of Education students. The AI interviewer asks a question out loud, the student answers with the microphone, and the interviewer follows up based on what was actually said. At the end the student gets a scored report. Everything works in **Arabic (RTL) and English**.

Graduation project. Live at **https://smartinterview-production.up.railway.app**

## Features

- Register / log in
- Interview setup: role, language, difficulty, length, optional job description
- Interview room: the interviewer's voice (browser TTS), microphone recording, a transcript the student can edit, contextual follow-ups
- Report: overall score, five criteria, strengths, areas to improve, recommended practice, and per-question feedback with a stronger sample answer
- Dashboard and history
- Light / dark / system theme
- **Demo mode** (`MOCK_AI=true`): the full flow works without internet or API keys

## Stack

| Part | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Radix primitives |
| Backend | Node.js 22, Express 5, TypeScript, Zod |
| Database | PostgreSQL + Prisma |
| Speech-to-text | Groq `whisper-large-v3` (explicit language, Egyptian-Arabic context prompt) |
| LLM | Groq `openai/gpt-oss-120b` (JSON output, validated server-side) |
| Text-to-speech | Browser `speechSynthesis` (free) |
| Hosting | Railway: one app service + Railway PostgreSQL |

## Architecture

```
Browser ──► Railway service "smartinterview" (one Node process)
              ├─ serves the built React app (SPA fallback to index.html)
              └─ /api/*  ── Groq (Whisper + LLM)
                         └─ PostgreSQL (Railway)
```

How one answer is handled:

1. The browser records the answer. It measures how long the student actually spoke and doesn't upload silent clips.
2. The backend sends the audio to Groq Whisper `whisper-large-v3` with the interview language set explicitly, `temperature: 0`, `verbose_json`, and a short vocabulary prompt written in Egyptian Arabic, because a formal-Arabic prompt made Whisper rewrite dialect into formal Arabic. The audio stays in memory and is discarded afterwards. `backend/scripts/stt-compare.ts` is a developer-only tool that compares models on the same recordings.
3. Silence hallucinations are rejected as "no speech": known phrases, subtitle credits, echoes of the prompt, empty punctuation and very low-confidence segments. Nothing is paraphrased or "corrected" by an LLM.
4. The answer appears in the conversation as the student's message. They can fix a misheard word inline (Edit), then send it with one click.
5. **One LLM call** scores the answer on five criteria (1–10), writes feedback and a stronger sample answer, decides `FOLLOW_UP` / `NEXT_TOPIC` / `FINISH`, and writes the next question.
6. The server validates the JSON (one retry if it is malformed), clamps scores, enforces the question limit and a minimum of 75% of questions before finishing, and never allows two follow-ups in a row.
7. At the end the server computes every score itself. The LLM only writes the report text, so the numbers stay consistent.

The job description is treated as untrusted data: it is wrapped in tags, and the model is told never to follow instructions inside it.

## Local setup

Requirements: Node.js 22 and Docker (used only for local PostgreSQL).

```bash
npm run setup   # installs deps, creates backend/.env, starts Postgres, migrates, seeds roles + demo account
npm run dev     # API on :4000, web app on http://localhost:5173
```

Demo account: `demo@smartinterview.app` / `demo1234`.

### Real AI locally

Get a key at <https://console.groq.com>, then in `backend/.env`:

```env
MOCK_AI=false
GROQ_API_KEY=gsk_...
```

`backend/.env` is gitignored. The key is only ever used by the backend and is never sent to the browser.

## Environment variables (backend)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Long random string |
| `GROQ_API_KEY` | when `MOCK_AI=false` | Secret, backend only |
| `MOCK_AI` | | `false` = real Groq, `true` = demo mode |
| `NODE_ENV` | | `production` on Railway (secure cookies) |
| `PORT` | | Set automatically by Railway |
| `SEED_DEMO_ACCOUNT` | | `true` creates the demo account on startup if missing |
| `GROQ_STT_MODEL` / `LLM_MODEL` | | Defaults: `whisper-large-v3` / `openai/gpt-oss-120b` |
| `STT_DEBUG` | | `true` logs safe STT metadata (size, duration, language, model) in production |

## Railway deployment

Project `smartinterview` has two resources:

- **`smartinterview`**: the application service (frontend + backend)
- **`Postgres`**: Railway PostgreSQL

Service variables: `NODE_ENV=production`, `MOCK_AI=false`, `GROQ_API_KEY` (secret), `JWT_SECRET` (generated), `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SEED_DEMO_ACCOUNT=true`.

Railway uses the root scripts with no extra config:

```
npm ci         → postinstall installs backend + frontend
npm run build  → builds the React app and compiles the API
npm start      → prisma migrate deploy, then node backend/dist/server.js
```

`prisma migrate deploy` only applies new migrations and never resets data. Roles are upserted on every start, and the demo account is only created if it does not exist.

Deploy from the repo root (already linked):

```bash
railway up --service smartinterview
```

Health check: `GET /api/health` → `{"status":"ok"}`.

## Presentation fallback (no internet / Groq problem)

Switch production to demo mode:

```bash
railway variables --service smartinterview --set "MOCK_AI=true"
```

Changing a variable triggers a redeploy, which takes about 1–2 minutes. In the interview room a **Demo mode** badge confirms it is active. Switch back with `MOCK_AI=false`.

If there is no internet at all, run it locally: `npm run dev` with `MOCK_AI=true` in `backend/.env`.

## Cost control

- Audio goes only to Whisper (large-v3, about $0.11 per hour of audio) and is never stored. Silent clips are not uploaded.
- One LLM call per answer, with capped output. Earlier answers are trimmed in the context.
- Answers are capped at 2 minutes and 4,000 characters, and the job description at 2,500 characters.
- Rate limit: 20 AI requests per minute per user. TTS runs in the browser for free.

## Project structure

```
backend/
  prisma/            schema, migrations, seed script
  src/
    ai/              interviewer logic, prompts, demo-mode mock, types
    providers/       stt.ts (Groq Whisper / mock), llm.ts (Groq chat, JSON mode)
    routes/          auth, interviews, meta (config, roles, dashboard, health)
    services/        interview flow + persistence
    db/              Prisma client, idempotent seed data (roles, demo account)
    data/roles.ts    interview roles (add one here; it is upserted on next start)
frontend/
  src/
    pages/           Landing, Auth, Dashboard, Setup, InterviewRoom, Report, History
    features/        interview room parts, dashboard chart/list, report bars, landing preview
    hooks/           useRecorder (mic + voice activity), useSpeech (TTS), useFetch
    components/      UI kit and layout
    i18n/            en.ts / ar.ts
```

## Presentation checklist

1. Open the live URL in Chrome or Edge (best Arabic voices). Allow the microphone when asked.
2. Log in with the demo account to show the dashboard, history and a finished report.
3. Start a Quick interview. Show the voice question, recording, transcript editing, a follow-up and the report.
4. Toggle Arabic / English and light / dark from the header.
5. Keep the fallback command above ready.
