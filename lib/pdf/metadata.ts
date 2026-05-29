import crypto from "node:crypto";
import path from "node:path";
import { compactForSearch, cleanPdfText } from "@/lib/pdf/clean";
import type { GradeId } from "@/types";

export type DetectedBookMetadata = {
  title: string;
  subject: string;
  subjectSlug: string;
  grade: GradeId;
  gradeLabel: string;
  targetFileName: string;
};

const subjectCatalog = [
  {
    slug: "math",
    label: "الرياضيات",
    keywords: ["رياضيات", "جبر", "هندسه", "حساب", "مثلث", "معادلات"]
  },
  {
    slug: "science",
    label: "العلوم الطبيعية",
    keywords: ["علوم طبيعيه", "العلوم الطبيعيه", "احياء", "فيزياء", "كيمياء", "بيئه"]
  },
  {
    slug: "arabic",
    label: "اللغة العربية",
    keywords: ["اللغه العربيه", "نحو", "قراءه", "ادب", "بلاغه", "تعبير"]
  },
  {
    slug: "islamic",
    label: "التربية الإسلامية",
    keywords: ["تربيه اسلاميه", "القران", "الحديث", "الفقه", "العقيده"]
  },
  {
    slug: "english",
    label: "اللغة الإنجليزية",
    keywords: ["english", "انجليزي", "اللغه الانجليزيه"]
  },
  {
    slug: "social",
    label: "الدراسات الاجتماعية",
    keywords: ["دراسات اجتماعيه", "جغرافيا", "تاريخ", "وطنيه", "المواطنة"]
  },
  {
    slug: "technology",
    label: "الحاسوب وتقنية المعلومات",
    keywords: ["حاسوب", "تقنيه", "اتصالات", "معلومات", "الحاسوب"]
  },
  {
    slug: "art",
    label: "التربية الفنية",
    keywords: ["تربيه فنيه", "رسم", "فنيه"]
  }
];

function detectGrade(text: string, fileName: string): GradeId {
  const haystack = `${text} ${compactForSearch(fileName)}`;

  if (
    /grade\s*3|third|الصف\s*الثالث|ثالث\s*متوسط|الثالث\s*متوسط/.test(haystack)
  ) {
    return "grade3";
  }

  if (
    /grade\s*2|second|الصف\s*الثاني|ثاني\s*متوسط|الثاني\s*متوسط/.test(haystack)
  ) {
    return "grade2";
  }

  return "grade1";
}

function gradeLabel(grade: GradeId) {
  if (grade === "grade1") return "الصف الأول المتوسط";
  if (grade === "grade2") return "الصف الثاني المتوسط";
  return "الصف الثالث المتوسط";
}

function detectSubject(text: string, fileName: string) {
  const haystack = `${text} ${compactForSearch(fileName)}`;
  const match = subjectCatalog.find((subject) =>
    subject.keywords.some((keyword) => haystack.includes(compactForSearch(keyword)))
  );

  return match || { slug: "general", label: "كتاب مدرسي", keywords: [] };
}

function plausibleTitleLine(line: string) {
  const cleaned = cleanPdfText(line);
  if (cleaned.length < 4 || cleaned.length > 90) return false;

  const reject = [
    "جمهورية السودان",
    "وزارة التربية",
    "المركز القومي",
    "بخت الرضا",
    "المرحلة المتوسطة",
    "الطبعة"
  ];

  return !reject.some((item) => compactForSearch(cleaned).includes(compactForSearch(item)));
}

function detectTitle(firstPageText: string, subjectLabel: string) {
  const lines = firstPageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const subjectLine = lines.find((line) =>
    compactForSearch(line).includes(compactForSearch(subjectLabel))
  );

  if (subjectLine && plausibleTitleLine(subjectLine)) {
    return cleanPdfText(subjectLine);
  }

  const candidate = lines.find(plausibleTitleLine);
  return candidate ? cleanPdfText(candidate) : subjectLabel;
}

function stableSuffix(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function detectBookMetadata(firstPageText: string, fileName: string): DetectedBookMetadata {
  const normalized = compactForSearch(firstPageText);
  const grade = detectGrade(normalized, fileName);
  const subject = detectSubject(normalized, fileName);
  const title = detectTitle(firstPageText, subject.label);
  const suffix = stableSuffix(`${fileName}:${title}`);
  const bookSlug = slugify(`${subject.slug}-${path.parse(fileName).name}`) || subject.slug;

  return {
    title,
    subject: subject.label,
    subjectSlug: subject.slug,
    grade,
    gradeLabel: gradeLabel(grade),
    targetFileName: `${grade}_${subject.slug}_${bookSlug}_${suffix}.pdf`
  };
}
