import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";
import { ROLES } from "../data/roles.js";

/** Idempotent: safe to run on every start. Never deletes data. */
export async function ensureRoles() {
  for (const [i, role] of ROLES.entries()) {
    const data = { ...role, domain: role.domain ?? "education", sortOrder: i };
    await prisma.role.upsert({ where: { slug: role.slug }, update: data, create: data });
  }
}

// Optional demo account with a few finished interviews, so the dashboard and history
// look alive during a presentation (SEED_DEMO_ACCOUNT=true or `npm run db:seed -- --demo`).
export const DEMO_EMAIL = "demo@smartinterview.app";
export const DEMO_PASSWORD = "demo1234";

const DEMO_INTERVIEWS = [
  { slug: "english-teacher", language: "en", difficulty: "beginner", daysAgo: 12, minutes: 6, scores: [6, 5, 6, 6, 5] },
  { slug: "arabic-teacher", language: "ar", difficulty: "beginner", daysAgo: 8, minutes: 7, scores: [7, 6, 7, 6, 6] },
  { slug: "english-teacher", language: "en", difficulty: "intermediate", daysAgo: 4, minutes: 9, scores: [7, 7, 8, 7, 7] },
  { slug: "special-education-teacher", language: "ar", difficulty: "intermediate", daysAgo: 1, minutes: 8, scores: [8, 8, 8, 7, 8] },
] as const;

const QA = {
  en: [
    ["Tell me a little about yourself and why you want this position.", "I'm a final-year Faculty of Education student. In my practicum I taught grade seven for a term and loved seeing students understand new ideas."],
    ["How would you handle a student who keeps disrupting your lesson?", "I would talk to the student privately to understand the reason, set clear expectations, and give them a responsibility in the lesson."],
    ["Can you give an example of a strategy you would use to re-engage that student?", "In my practicum I asked a talkative student to lead a group activity. He became more focused and I tracked it with a simple behaviour chart."],
    ["How do you know whether your students have understood a lesson?", "I use questioning during the lesson and a short exit ticket. If many students make the same mistake I re-teach it differently next lesson."],
  ],
  ar: [
    ["حدثني قليلاً عن نفسك، ولماذا تريد هذه الوظيفة؟", "أنا طالب في سنة رابعة بكلية التربية، وفي التربية العملية درّست لتالتة إعدادي وحبيت جداً إني أشوف الطلاب بيفهموا حاجة جديدة."],
    ["كيف تتعامل مع طالب يقاطع الدرس باستمرار؟", "هتكلم معاه لوحده بعد الحصة عشان أفهم السبب، وأحدد قواعد واضحة، وأديله دور في الدرس عشان يحس إنه مشارك."],
    ["هل يمكنك أن تعطيني مثالاً عملياً على استراتيجية ستستخدمها؟", "مثلاً اديت طالب كان بيتكلم كتير مسؤولية قيادة مجموعة، وبعد أسبوع بقى مركز أكتر، وكنت متابع ده بجدول سلوك بسيط."],
    ["كيف تعرف أن طلابك فهموا الدرس فعلاً؟", "بستخدم أسئلة أثناء الحصة وتذكرة خروج قصيرة، ولو طلاب كتير غلطوا نفس الغلطة بعيد الشرح بطريقة مختلفة."],
  ],
};

const TEXT = {
  en: {
    feedback: "Clear and practical. Adding a short real example would make it stronger.",
    suggested: "Name the principle you follow, describe two or three concrete steps, give a short example from your practicum, and say how you would check it worked.",
    strengths: ["You stayed focused on what each question asked.", "You gave concrete classroom examples from your practicum."],
    improvements: ["Explain why a strategy helps students learn, not only what you would do.", "Mention teaching methods and concepts by name."],
    practice: ["Structuring answers with the STAR method", "Linking classroom actions to learning theory"],
    general: "A solid interview with practical, student-focused answers. Keep building on concrete examples and make the educational reasoning behind each choice explicit.",
  },
  ar: {
    feedback: "إجابة واضحة وعملية. إضافة مثال واقعي قصير ستجعلها أقوى.",
    suggested: "اذكر المبدأ الذي تتبعه، ثم صف خطوتين أو ثلاثاً عملية، وأعطِ مثالاً من التربية العملية، واختم بكيف ستتأكد من النجاح.",
    strengths: ["التزمت بما يطلبه كل سؤال.", "قدّمت أمثلة صفية واقعية من التربية العملية."],
    improvements: ["وضّح لماذا تساعد الاستراتيجية الطلاب على التعلم، لا ماذا ستفعل فقط.", "اذكر طرق التدريس والمفاهيم بأسمائها."],
    practice: ["تنظيم الإجابات بطريقة STAR", "ربط ممارسات الفصل بنظريات التعلم"],
    general: "مقابلة جيدة بإجابات عملية تركز على الطالب. استمر في تقديم أمثلة واقعية، ووضّح الأساس التربوي وراء كل اختيار.",
  },
};

/** Creates the demo account with finished interviews, only if it doesn't exist yet. */
export async function ensureDemoAccount() {
  if (await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })) return false;
  const user = await prisma.user.create({ data: { name: "Demo Student", email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) } });

  for (const demo of DEMO_INTERVIEWS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { slug: demo.slug } });
    const [relevance, clarity, communication, subjectKnowledge, educationalReasoning] = demo.scores;
    const criteria = { relevance, clarity, communication, subjectKnowledge, educationalReasoning };
    const score = Math.round((demo.scores.reduce((a, b) => a + b, 0) / 5) * 10);
    const startedAt = new Date(Date.now() - demo.daysAgo * 86_400_000);
    const t = TEXT[demo.language];
    await prisma.interview.create({
      data: {
        userId: user.id,
        roleId: role.id,
        language: demo.language,
        difficulty: demo.difficulty,
        length: "quick",
        maxQuestions: 4,
        topics: [],
        status: "COMPLETED",
        overallScore: score,
        startedAt,
        endedAt: new Date(startedAt.getTime() + demo.minutes * 60_000),
        durationSec: demo.minutes * 60,
        questions: {
          create: QA[demo.language].map(([text, answer], i) => ({
            order: i + 1,
            text,
            kind: i === 2 ? "FOLLOW_UP" : "MAIN",
            answer: { create: { transcript: answer, durationSec: 45 + i * 10, ...criteria, score, feedback: t.feedback, suggestedAnswer: t.suggested } },
          })),
        },
        report: {
          create: {
            overallScore: score,
            categoryScores: Object.fromEntries(Object.entries(criteria).map(([k, v]) => [k, v * 10])),
            strengths: t.strengths,
            improvements: t.improvements,
            practiceAreas: t.practice,
            generalFeedback: t.general,
          },
        },
      },
    });
  }
  return true;
}

