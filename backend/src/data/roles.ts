// Interview roles. To add a role: append an entry here and run `npm run db:seed`.
export interface RoleSeed {
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  focusAreas: string[];
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
];
