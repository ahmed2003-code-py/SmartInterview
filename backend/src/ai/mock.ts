// Demo-mode fallback (MOCK_AI=true): predefined questions, simulated transcripts and
// rule-based scoring so the full flow can be presented without internet or API keys.
import type { Lang } from "../providers/stt.js";
import type { Criteria, InterviewContext, PlanResult, ReportText, TurnInput, TurnResult } from "./types.js";

const QUESTIONS: Record<Lang, { topic: string; text: string }[]> = {
  en: [
    { topic: "Motivation", text: "Tell me a little about yourself and why you want this {role} position." },
    { topic: "Classroom management", text: "How would you handle a student who keeps disrupting your lesson?" },
    { topic: "Lesson planning", text: "Walk me through how you would plan a lesson for a topic your students find difficult." },
    { topic: "Differentiation", text: "Your class has students at very different levels. How do you make sure everyone learns?" },
    { topic: "Assessment", text: "How do you know whether your students have actually understood a lesson?" },
    { topic: "Parent communication", text: "A parent is upset about their child's low grade. How would you handle that conversation?" },
    { topic: "Technology", text: "How would you use technology to make your lessons more engaging?" },
    { topic: "Professional growth", text: "What is one area of your teaching you want to improve, and how are you working on it?" },
    { topic: "Motivation of students", text: "How would you motivate a student who has lost interest in your subject?" },
    { topic: "Collaboration", text: "Describe how you would work with other teachers or specialists to support a student." },
  ],
  ar: [
    { topic: "الدافع", text: "حدثني قليلاً عن نفسك، ولماذا تريد العمل في وظيفة {role}؟" },
    { topic: "إدارة الفصل", text: "كيف تتعامل مع طالب يقاطع الدرس باستمرار؟" },
    { topic: "تخطيط الدروس", text: "اشرح لي كيف تخطط لدرس في موضوع يجده الطلاب صعباً." },
    { topic: "الفروق الفردية", text: "في فصلك طلاب بمستويات مختلفة جداً. كيف تتأكد أن الجميع يتعلم؟" },
    { topic: "التقييم", text: "كيف تعرف أن طلابك فهموا الدرس فعلاً؟" },
    { topic: "التواصل مع أولياء الأمور", text: "ولي أمر غاضب بسبب درجة ابنه المنخفضة. كيف تدير هذا الحوار؟" },
    { topic: "التكنولوجيا", text: "كيف تستخدم التكنولوجيا لتجعل دروسك أكثر تفاعلاً؟" },
    { topic: "التطور المهني", text: "ما الجانب الذي تريد تطويره في تدريسك، وكيف تعمل على ذلك؟" },
    { topic: "تحفيز الطلاب", text: "كيف تحفّز طالباً فقد اهتمامه بمادتك؟" },
    { topic: "التعاون", text: "كيف تتعاون مع المعلمين أو الأخصائيين الآخرين لدعم طالب يحتاج مساعدة؟" },
  ],
};

// Short spoken reactions so demo mode doesn't sound like a fixed list.
const REACTIONS: Record<Lang, string[]> = {
  en: ["Thanks, that's helpful.", "Okay, I follow.", "Right.", "That makes sense.", "Good, let's build on that."],
  ar: ["تمام، واضح.", "شكراً، كلامك مفهوم.", "حلو.", "طيب.", "جميل، خلينا نكمل."],
};
const reaction = (lang: Lang, n: number) => REACTIONS[lang][n % REACTIONS[lang].length];

const FOLLOW_UPS: Record<Lang, string[]> = {
  en: [
    "Can you give a concrete example of a strategy you would use in that situation?",
    "What would you do if that approach didn't work the first time?",
    "How would you measure whether it was successful?",
  ],
  ar: [
    "هل يمكنك أن تعطيني مثالاً عملياً على استراتيجية ستستخدمها في هذا الموقف؟",
    "وماذا ستفعل لو لم ينجح هذا الأسلوب من المرة الأولى؟",
    "كيف ستقيس إن كان هذا الأسلوب ناجحاً؟",
  ],
};

// Simulated answers, aligned with QUESTIONS by index (follow-ups use FOLLOW_UP_ANSWERS).
const TRANSCRIPTS: Record<Lang, string[]> = {
  en: [
    "I'm a final-year student at the Faculty of Education. During my practicum I taught grade seven for a full term and I really enjoyed seeing students understand something new, so teaching feels like the right career for me.",
    "I would first try to understand why the student is behaving this way. Maybe they are bored or the work is too hard. I would talk to them privately after class, set clear expectations, and give them a role in the lesson so they feel involved.",
    "I usually start with the learning objective, then I plan a short warm-up activity, a clear explanation with examples, group practice, and finally a quick exit ticket to check understanding.",
    "I would use different activities for different levels, for example extra support worksheets for weaker students and extension tasks for advanced students, and I would group them carefully.",
    "I use short quizzes, questioning during the lesson and exit tickets. If many students make the same mistake, I re-teach that part in a different way the next day.",
    "I think I would listen to the parent first, stay calm, show them the student's work, and agree together on a plan to help the student improve.",
  ],
  ar: [
    "أنا طالب في سنة رابعة بكلية التربية، وفي التربية العملية درّست لتالتة إعدادي ترم كامل، وحبيت جداً إني أشوف الطلاب بيفهموا حاجة جديدة، عشان كده حاسس إن التدريس هو المجال المناسب ليا.",
    "أولاً هحاول أفهم سبب سلوك الطالب ده، ممكن يكون زهقان أو الدرس صعب عليه. هتكلم معاه بعد الحصة لوحده، وأحدد قواعد واضحة، وأديله دور في الدرس عشان يحس إنه مشارك.",
    "ببدأ بتحديد هدف الدرس، وبعدين نشاط تمهيدي قصير، وشرح واضح بأمثلة، وبعدين تدريب في مجموعات، وفي الآخر سؤال سريع عشان أتأكد إنهم فهموا.",
    "هستخدم أنشطة مختلفة حسب كل مستوى، مثلاً أوراق عمل فيها دعم إضافي للطلاب الضعاف ومهام إثرائية للمتفوقين، وأقسمهم في مجموعات بشكل مدروس.",
    "بستخدم اختبارات قصيرة وأسئلة أثناء الحصة، ولو لقيت طلاب كتير بيغلطوا نفس الغلطة بعيد شرح الجزء ده بطريقة مختلفة في الحصة اللي بعدها.",
    "هسمع ولي الأمر الأول وأفضل هادي، وأوريه شغل الطالب، ونتفق سوا على خطة تساعد الطالب يتحسن.",
  ],
};

const FOLLOW_UP_ANSWERS: Record<Lang, string> = {
  en: "For example, in my practicum one student kept talking during the lesson. I gave him the job of handing out materials and checked in with him privately. After a week he was much more focused, and I tracked this with a simple behaviour chart.",
  ar: "مثلاً في التربية العملية كان فيه طالب بيتكلم طول الحصة، فاديته مسؤولية توزيع الأوراق واتكلمت معاه لوحده، وبعد أسبوع بقى مركز أكتر، وكنت متابعة ده بجدول سلوك بسيط.",
};

export function mockTranscript(lang: Lang, question?: string): string {
  const index = QUESTIONS[lang].findIndex((q) => question && q.text.split("{role}")[0] && question.includes(q.text.split("{role}")[0]));
  if (index === -1) return FOLLOW_UP_ANSWERS[lang];
  return TRANSCRIPTS[lang][index] ?? TRANSCRIPTS[lang][1];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockPlan(ctx: InterviewContext): Promise<PlanResult> {
  await delay(600);
  const bank = QUESTIONS[ctx.language];
  const first = bank[0];
  return {
    topics: bank.slice(0, Math.min(ctx.maxQuestions, bank.length)).map((q) => q.topic),
    firstQuestion: { topic: first.topic, text: `${ctx.language === "ar" ? "أهلاً بيك، وشكراً لحضورك." : "Hi, thanks for coming in."} ${first.text.replace("{role}", ctx.roleName)}` },
  };
}

const KEYWORDS = /\b(example|student|plan|assess|objective|group|feedback|parent|strategy|because|first|then)\b|مثال|طالب|طلاب|خطة|هدف|تقييم|مجموعات|أولياء|ولي|استراتيجية|عشان|لأن|أولا|الأول/gi;

function scoreAnswer(answer: string): Criteria {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const hits = new Set(answer.match(KEYWORDS)?.map((k) => k.toLowerCase()) ?? []).size;
  const base = words < 8 ? 3 : words < 25 ? 5 : words < 60 ? 7 : 8;
  const bonus = Math.min(2, Math.floor(hits / 2));
  const clamp = (n: number) => Math.max(1, Math.min(10, n));
  return {
    relevance: clamp(base + bonus),
    clarity: clamp(base + (words > 120 ? -1 : 0)),
    communication: clamp(base),
    subjectKnowledge: clamp(base - 1 + bonus),
    educationalReasoning: clamp(base - 1 + bonus),
  };
}

const FEEDBACK: Record<Lang, { good: string; short: string; better: string }> = {
  en: {
    good: "A clear, practical answer that shows you put students first. Adding a short real example would make it even stronger.",
    short: "The answer is too brief to show your thinking. Explain the steps you would take and why.",
    better: "Start by naming the principle you follow, describe two or three concrete steps, give a short example from your practicum, and end with how you would check that it worked.",
  },
  ar: {
    good: "إجابة واضحة وعملية تُظهر اهتمامك بالطلاب. إضافة مثال واقعي قصير ستجعلها أقوى.",
    short: "الإجابة مختصرة جداً ولا توضح طريقة تفكيرك. اشرح الخطوات التي ستتبعها وسبب اختيارها.",
    better: "ابدأ بذكر المبدأ الذي تتبعه، ثم صف خطوتين أو ثلاثاً عملية، وأعطِ مثالاً قصيراً من التربية العملية، واختم بكيف ستتأكد من نجاح ما فعلته.",
  },
};

export async function mockTurn(input: TurnInput): Promise<Omit<TurnResult, "responseLanguage">> {
  await delay(900);
  const { ctx, history, answer, questionNumber } = input;
  const lang = ctx.language;
  const scores = scoreAnswer(answer);
  const words = answer.split(/\s+/).filter(Boolean).length;
  const isLast = questionNumber >= ctx.maxQuestions;
  const lastWasFollowUp = history.at(-1)?.kind === "FOLLOW_UP" || input.currentKind === "FOLLOW_UP";

  const feedback = words < 25 ? FEEDBACK[lang].short : FEEDBACK[lang].good;
  if (isLast) {
    return { scores, feedback, suggestedAnswer: FEEDBACK[lang].better, decision: "FINISH", topic: null, nextQuestion: null };
  }
  // Follow up on short answers (or every third question) but never twice in a row.
  if (!lastWasFollowUp && (words < 25 || questionNumber % 3 === 2)) {
    const text = `${reaction(lang, questionNumber)} ${FOLLOW_UPS[lang][questionNumber % FOLLOW_UPS[lang].length]}`;
    return { scores, feedback, suggestedAnswer: FEEDBACK[lang].better, decision: "FOLLOW_UP", topic: input.currentTopic, nextQuestion: text };
  }
  const asked = [...history.map((h) => h.question), input.question].join("\n");
  const next = QUESTIONS[lang].slice(1).find((q) => !asked.includes(q.text)) ?? QUESTIONS[lang][1];
  return { scores, feedback, suggestedAnswer: FEEDBACK[lang].better, decision: "NEXT_TOPIC", topic: next.topic, nextQuestion: `${reaction(lang, questionNumber + 2)} ${next.text}` };
}

const CATEGORY_TEXT: Record<Lang, Record<keyof Criteria, { strength: string; improve: string; practice: string }>> = {
  en: {
    relevance: { strength: "You stayed focused on what each question asked.", improve: "Some answers drifted away from the question; answer it directly first.", practice: "Answering the exact question in the first sentence" },
    clarity: { strength: "Your answers were well structured and easy to follow.", improve: "Organise answers into clear steps (first, then, finally).", practice: "Structuring answers with the STAR method" },
    communication: { strength: "You communicated in a confident, professional tone.", improve: "Use more complete sentences and avoid trailing off.", practice: "Speaking practice with timed 90-second answers" },
    subjectKnowledge: { strength: "You showed solid knowledge of the subject and its teaching.", improve: "Mention specific teaching methods or concepts by name.", practice: "Reviewing key teaching methods for your subject" },
    educationalReasoning: { strength: "You explained the educational reasoning behind your choices.", improve: "Explain *why* a strategy helps students learn, not only what you would do.", practice: "Linking classroom actions to learning theory" },
  },
  ar: {
    relevance: { strength: "التزمت بما يطلبه كل سؤال.", improve: "بعض الإجابات ابتعدت عن السؤال؛ أجب عنه مباشرة أولاً.", practice: "الإجابة عن السؤال نفسه في الجملة الأولى" },
    clarity: { strength: "إجاباتك منظمة وسهلة المتابعة.", improve: "رتّب إجابتك في خطوات واضحة (أولاً، ثم، وأخيراً).", practice: "تنظيم الإجابات بطريقة STAR" },
    communication: { strength: "تحدثت بنبرة واثقة ومهنية.", improve: "استخدم جملاً مكتملة وتجنب التوقف في منتصف الفكرة.", practice: "التدرب على إجابات مدتها 90 ثانية" },
    subjectKnowledge: { strength: "أظهرت معرفة جيدة بالمادة وطرق تدريسها.", improve: "اذكر طرق التدريس والمفاهيم بأسمائها.", practice: "مراجعة طرق التدريس الأساسية في تخصصك" },
    educationalReasoning: { strength: "شرحت الأساس التربوي وراء اختياراتك.", improve: "وضّح لماذا تساعد الاستراتيجية الطلاب على التعلم، لا ماذا ستفعل فقط.", practice: "ربط ممارسات الفصل بنظريات التعلم" },
  },
};

export async function mockReport(ctx: InterviewContext, categoryScores: Record<keyof Criteria, number>, overall: number): Promise<ReportText> {
  await delay(900);
  const lang = ctx.language;
  const ranked = (Object.keys(categoryScores) as (keyof Criteria)[]).sort((a, b) => categoryScores[b] - categoryScores[a]);
  const text = CATEGORY_TEXT[lang];
  const general =
    lang === "ar"
      ? `أداؤك العام ${overall >= 75 ? "قوي" : overall >= 55 ? "جيد مع مساحة للتحسين" : "يحتاج إلى مزيد من التدريب"} في مقابلة ${ctx.roleName}. ركّز على إعطاء أمثلة عملية من التربية العملية، وشرح سبب اختيارك لكل استراتيجية.`
      : `Your overall performance for the ${ctx.roleName} interview was ${overall >= 75 ? "strong" : overall >= 55 ? "solid, with room to improve" : "a good start that needs more practice"}. Focus on giving concrete examples from your practicum and explaining why each strategy works.`;
  return {
    strengths: ranked.slice(0, 2).map((k) => text[k].strength),
    improvements: ranked.slice(-2).reverse().map((k) => text[k].improve),
    practiceAreas: ranked.slice(-3).reverse().map((k) => text[k].practice),
    generalFeedback: general,
  };
}
