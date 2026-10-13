// Suggested interview roles (quick options in setup). Students can also type any custom role.
// To add a suggestion: append an entry here; it is upserted on the next start.
export interface RoleSeed {
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  focusAreas: string[];
  /** Defaults to "education". Other domains get a hiring-manager interviewer instead of a school principal. */
  domain?: "education" | "general";
}

export const ROLES: RoleSeed[] = [
  {
    slug: "english-teacher",
    nameEn: "English Teacher",
    nameAr: "معلم لغة إنجليزية",
    descriptionEn: "Language instruction, skills integration and communicative teaching.",
    descriptionAr: "تدريس اللغة، ودمج المهارات، والتدريس التواصلي.",
    focusAreas: ["Lesson planning", "Teaching the four language skills", "Classroom management", "Assessment", "Differentiation for mixed levels"],
  },
  {
    slug: "arabic-teacher",
    nameEn: "Arabic Teacher",
    nameAr: "معلم لغة عربية",
    descriptionEn: "Reading, grammar, expression and love of the Arabic language.",
    descriptionAr: "القراءة، والنحو، والتعبير، وتنمية حب اللغة العربية.",
    focusAreas: ["Teaching grammar meaningfully", "Reading comprehension", "Writing and expression", "Classroom management", "Assessment"],
  },
  {
    slug: "math-teacher",
    nameEn: "Mathematics Teacher",
    nameAr: "معلم رياضيات",
    descriptionEn: "Conceptual understanding, problem solving and math anxiety.",
    descriptionAr: "الفهم المفاهيمي، وحل المشكلات، والتعامل مع قلق الرياضيات.",
    focusAreas: ["Conceptual understanding vs. procedures", "Problem solving", "Addressing misconceptions", "Assessment", "Supporting struggling learners"],
  },
  {
    slug: "science-teacher",
    nameEn: "Science Teacher",
    nameAr: "معلم علوم",
    descriptionEn: "Inquiry-based learning, lab safety and scientific thinking.",
    descriptionAr: "التعلم بالاستقصاء، والأمان في المعمل، والتفكير العلمي.",
    focusAreas: ["Inquiry-based learning", "Lab safety", "Explaining abstract concepts", "Assessment", "Linking science to daily life"],
  },
  {
    slug: "kindergarten-teacher",
    nameEn: "Kindergarten Teacher",
    nameAr: "معلمة رياض أطفال",
    descriptionEn: "Play-based learning, early development and parent communication.",
    descriptionAr: "التعلم باللعب، والنمو المبكر، والتواصل مع أولياء الأمور.",
    focusAreas: ["Play-based learning", "Early childhood development", "Routines and behaviour", "Parent communication", "Observation-based assessment"],
  },
  {
    slug: "special-education-teacher",
    nameEn: "Special Education Teacher",
    nameAr: "معلم تربية خاصة",
    descriptionEn: "Individual education plans, inclusion and adapted instruction.",
    descriptionAr: "الخطط التربوية الفردية، والدمج، وتكييف التدريس.",
    focusAreas: ["Individualized education plans", "Inclusion", "Adapting materials", "Behaviour support", "Working with families and specialists"],
  },
  {
    slug: "educational-technology",
    nameEn: "Educational Technology",
    nameAr: "تكنولوجيا التعليم",
    descriptionEn: "Digital tools, e-learning design and technology integration.",
    descriptionAr: "الأدوات الرقمية، وتصميم التعلم الإلكتروني، ودمج التكنولوجيا.",
    focusAreas: ["Technology integration", "Instructional design", "Learning management systems", "Digital assessment", "Training teachers on tools"],
  },
  {
    slug: "teaching-assistant",
    nameEn: "Teaching Assistant",
    nameAr: "معيد / مساعد تدريس",
    descriptionEn: "Supporting instruction, small groups and academic tasks.",
    descriptionAr: "دعم التدريس، والعمل مع المجموعات الصغيرة، والمهام الأكاديمية.",
    focusAreas: ["Supporting the lead teacher", "Small-group instruction", "Student support", "Grading and feedback", "Professional communication"],
  },
  {
    slug: "software-engineer",
    domain: "general",
    nameEn: "Software Engineer",
    nameAr: "مهندس برمجيات",
    descriptionEn: "Problem solving, code quality, system design and teamwork.",
    descriptionAr: "حل المشكلات، وجودة الكود، وتصميم الأنظمة، والعمل الجماعي.",
    focusAreas: ["Problem solving and debugging", "Code quality and testing", "System design trade-offs", "Projects they built", "Teamwork and code review"],
  },
  {
    slug: "ai-engineer",
    domain: "general",
    nameEn: "AI Engineer",
    nameAr: "مهندس ذكاء اصطناعي",
    descriptionEn: "Models, data, evaluation and shipping AI features.",
    descriptionAr: "النماذج، والبيانات، والتقييم، وإطلاق خصائص الذكاء الاصطناعي.",
    focusAreas: ["ML / LLM fundamentals", "Data quality", "Evaluation and metrics", "Deploying models", "Projects they built"],
  },
  {
    slug: "accountant",
    domain: "general",
    nameEn: "Accountant",
    nameAr: "محاسب",
    descriptionEn: "Accuracy, reporting, controls and tools.",
    descriptionAr: "الدقة، والتقارير المالية، والرقابة، والأدوات المحاسبية.",
    focusAreas: ["Accounting principles", "Financial reporting", "Accuracy and controls", "Excel / accounting software", "Deadlines and pressure"],
  },
  {
    slug: "hr-specialist",
    domain: "general",
    nameEn: "HR Specialist",
    nameAr: "أخصائي موارد بشرية",
    descriptionEn: "Recruitment, employee relations and HR processes.",
    descriptionAr: "التوظيف، وعلاقات الموظفين، وإجراءات الموارد البشرية.",
    focusAreas: ["Recruitment and interviewing", "Employee relations", "Policies and labour law basics", "Onboarding", "Confidentiality"],
  },
  {
    slug: "customer-service",
    domain: "general",
    nameEn: "Customer Service Representative",
    nameAr: "ممثل خدمة عملاء",
    descriptionEn: "Handling customers, problem solving and communication.",
    descriptionAr: "التعامل مع العملاء، وحل المشكلات، والتواصل.",
    focusAreas: ["Handling difficult customers", "Problem resolution", "Clear communication", "Empathy and patience", "Working with targets"],
  },
  {
    slug: "sales-representative",
    domain: "general",
    nameEn: "Sales Representative",
    nameAr: "مندوب مبيعات",
    descriptionEn: "Prospecting, persuasion, objections and targets.",
    descriptionAr: "البحث عن العملاء، والإقناع، والتعامل مع الاعتراضات، والأهداف.",
    focusAreas: ["Understanding customer needs", "Handling objections", "Closing", "Targets and resilience", "Product knowledge"],
  },
];
