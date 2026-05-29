import nextEnv from "@next/env";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { GradeId } from "../types";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const classes: Array<{ id: GradeId; name_ar: string; sort_order: number }> = [
  { id: "grade1", name_ar: "الصف الأول المتوسط", sort_order: 1 },
  { id: "grade2", name_ar: "الصف الثاني المتوسط", sort_order: 2 },
  { id: "grade3", name_ar: "الصف الثالث المتوسط", sort_order: 3 }
];

const subjects = [
  { slug: "math", name_ar: "الرياضيات" },
  { slug: "science", name_ar: "العلوم الطبيعية" },
  { slug: "arabic", name_ar: "اللغة العربية" },
  { slug: "islamic", name_ar: "التربية الإسلامية" },
  { slug: "english", name_ar: "اللغة الإنجليزية" },
  { slug: "social", name_ar: "الدراسات الاجتماعية" },
  { slug: "technology", name_ar: "الحاسوب وتقنية المعلومات" },
  { slug: "art", name_ar: "التربية الفنية" },
  { slug: "general", name_ar: "كتاب مدرسي" }
];

async function main() {
  const supabase = createSupabaseAdminClient();

  const { error: classesError } = await supabase
    .from("classes")
    .upsert(classes, { onConflict: "id" });
  if (classesError) throw classesError;

  const { error: subjectsError } = await supabase
    .from("subjects")
    .upsert(subjects, { onConflict: "slug" });
  if (subjectsError) throw subjectsError;

  console.log(`Seeded ${classes.length} classes and ${subjects.length} subjects.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
