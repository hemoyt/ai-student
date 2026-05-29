import Link from "next/link";
import type { ComponentType } from "react";
import { BookOpen, Brain, CheckCircle2, History, Library, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";

export default async function DashboardPage() {
  if (!hasSupabasePublicEnv()) {
    return <SetupNotice />;
  }

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [
    { data: profile },
    { count: bookCount },
    { count: flashcardCount },
    { data: progress },
    { data: quizzes },
    { count: chatCount }
  ] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("books")
        .select("id", { count: "exact", head: true })
        .or("source_file.ilike.%_mdl_%,pdf_url.ilike.%mdl.edu.sd%"),
      supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("study_progress")
        .select("completed_lessons,total_lessons,books(title,subject)")
        .eq("user_id", user.id)
        .limit(5),
      supabase
        .from("quizzes")
        .select("score")
        .eq("user_id", user.id)
        .not("score", "is", null),
      supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    ]);

  const totalLessons =
    progress?.reduce((sum, item) => sum + (item.total_lessons || 0), 0) || 0;
  const completedLessons =
    progress?.reduce((sum, item) => sum + (item.completed_lessons || 0), 0) || 0;
  const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const quizScores = quizzes?.map((quiz) => Number(quiz.score)).filter(Number.isFinite) || [];
  const averageQuizScore = quizScores.length
    ? Math.round(quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length)
    : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline">{gradeLabel(profile?.grade)}</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal">
              مرحبا {profile?.full_name || user.email}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/study">
                <Brain className="h-4 w-4" />
                افتح المساعد
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/library">
                <Library className="h-4 w-4" />
                المكتبة
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <StatCard icon={BookOpen} label="الكتب المتاحة" value={bookCount || 0} />
          <StatCard icon={History} label="المحادثات" value={chatCount || 0} />
          <StatCard icon={CheckCircle2} label="الدروس المكتملة" value={completedLessons} />
          <StatCard icon={Trophy} label="البطاقات المحفوظة" value={flashcardCount || 0} />
          <StatCard icon={Brain} label="متوسط نتائج الاختبارات" value={averageQuizScore} suffix="%" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>تقدم المذاكرة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{completedLessons} من {totalLessons} درس</span>
              <span className="font-medium">{percent}%</span>
            </div>
            <Progress value={percent} />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <QuickAction href="/library" title="اختر الكتب" description="حدد كتابا واحدا أو عدة كتب ثم ابدأ جلسة RAG." />
          <QuickAction href="/study" title="أنشئ تدريبات" description="بطاقات، MCQ، اختبارات، ملخصات، ونقاط مهمة من الكتب." />
          <QuickAction href="/history" title="راجع سجلك" description="افتح محادثاتك السابقة وبطاقاتك ونتائج الاختبارات المحفوظة." />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">
            {value}
            {suffix}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  title,
  description
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-primary/50">
        <CardContent className="p-5">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function gradeLabel(grade?: string | null) {
  if (grade === "grade1") return "الصف الأول المتوسط";
  if (grade === "grade2") return "الصف الثاني المتوسط";
  if (grade === "grade3") return "الصف الثالث المتوسط";
  return "لم يحدد الصف";
}
