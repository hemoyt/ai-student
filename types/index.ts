export type GradeId = "grade1" | "grade2" | "grade3";

export type StudyGenerationType =
  | "flashcards"
  | "mcq"
  | "exam"
  | "summary"
  | "key_points"
  | "notes"
  | "qa_drills";

export type Book = {
  id: string;
  title: string;
  subject: string;
  grade: GradeId;
  cover_image: string | null;
  pdf_url: string | null;
  source_file?: string | null;
  created_at: string;
};

export type RetrievedChunk = {
  id: string;
  book_id: string;
  chunk_text: string;
  page_number: number | null;
  metadata: Record<string, unknown>;
  score: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export const grades: Array<{
  id: GradeId;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "grade1",
    label: "الصف الأول المتوسط",
    shortLabel: "الأول",
    description: "مواد السنة الأولى في المرحلة المتوسطة"
  },
  {
    id: "grade2",
    label: "الصف الثاني المتوسط",
    shortLabel: "الثاني",
    description: "مواد السنة الثانية في المرحلة المتوسطة"
  },
  {
    id: "grade3",
    label: "الصف الثالث المتوسط",
    shortLabel: "الثالث",
    description: "مواد السنة الثالثة في المرحلة المتوسطة"
  }
];

export const generationLabels: Record<StudyGenerationType, string> = {
  flashcards: "بطاقات مراجعة",
  mcq: "أسئلة اختيار من متعدد",
  exam: "اختبار تدريبي",
  summary: "ملخص",
  key_points: "نقاط مهمة",
  notes: "ملاحظات مذاكرة",
  qa_drills: "تدريبات سؤال وجواب"
};
