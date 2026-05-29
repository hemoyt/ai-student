"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Brain, CheckCircle2, Clock3, Layers, Loader2, MessageSquare, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArabicDate } from "@/lib/utils";

type HistoryTab = "chats" | "flashcards" | "quizzes";

type HistoryBook = {
  id: string;
  title: string;
  subject: string;
  grade: string;
};

type ChatSessionSummary = {
  id: string;
  title: string;
  selected_book_ids: string[];
  created_at: string;
  updated_at: string;
};

type SavedFlashcard = {
  id: string;
  question: string;
  answer: string;
  book_id: string | null;
  created_at: string;
  books?: HistoryBook | null;
};

type SavedQuiz = {
  id: string;
  title: string;
  score: number | null;
  created_at: string;
  quiz_questions?: Array<{
    id: string;
    question: string;
    choices: unknown;
    correct_answer: string | null;
    explanation: string | null;
    difficulty: string;
  }>;
};

type HistoryPayload = {
  sessions: ChatSessionSummary[];
  flashcards: SavedFlashcard[];
  quizzes: SavedQuiz[];
};

const tabs: Array<{ id: HistoryTab; label: string; icon: typeof MessageSquare }> = [
  { id: "chats", label: "المحادثات", icon: MessageSquare },
  { id: "flashcards", label: "البطاقات", icon: Layers },
  { id: "quizzes", label: "الاختبارات", icon: Trophy }
];

export function StudyHistory() {
  const [activeTab, setActiveTab] = useState<HistoryTab>("chats");
  const [history, setHistory] = useState<HistoryPayload>({
    sessions: [],
    flashcards: [],
    quizzes: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    fetch("/api/study/history", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || "تعذر تحميل السجل");
        return response.json() as Promise<HistoryPayload>;
      })
      .then((payload) => setHistory(payload))
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const averageScore = useMemo(() => {
    const scores = history.quizzes
      .map((quiz) => (typeof quiz.score === "number" ? quiz.score : null))
      .filter((score): score is number => score !== null);

    return scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
  }, [history.quizzes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">سجل المذاكرة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            محادثاتك وبطاقاتك ونتائج الاختبارات محفوظة لحسابك فقط.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/flashcards/print">تصدير البطاقات PDF</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={MessageSquare} label="المحادثات" value={history.sessions.length} />
        <SummaryCard icon={Layers} label="البطاقات" value={history.flashcards.length} />
        <SummaryCard icon={Brain} label="متوسط الاختبارات" value={averageScore} suffix="%" />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جار تحميل السجل...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && activeTab === "chats" ? <ChatHistory sessions={history.sessions} /> : null}
      {!isLoading && activeTab === "flashcards" ? <FlashcardHistory flashcards={history.flashcards} /> : null}
      {!isLoading && activeTab === "quizzes" ? <QuizHistory quizzes={history.quizzes} /> : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  suffix
}: {
  icon: typeof Brain;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">
            {value}
            {suffix}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatHistory({ sessions }: { sessions: ChatSessionSummary[] }) {
  if (!sessions.length) {
    return <EmptyState title="لا توجد محادثات محفوظة" action="ابدأ محادثة من صفحة المساعد الذكي." />;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sessions.map((session) => (
        <Card key={session.id} className="shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="line-clamp-2 font-semibold leading-7">{session.title}</h2>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatArabicDate(session.updated_at)}
                </p>
              </div>
              <Badge variant="secondary">{session.selected_book_ids.length} كتاب</Badge>
            </div>
            <Button asChild className="w-full">
              <Link href={`/study?session=${session.id}`}>فتح المحادثة</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FlashcardHistory({ flashcards }: { flashcards: SavedFlashcard[] }) {
  if (!flashcards.length) {
    return <EmptyState title="لا توجد بطاقات محفوظة" action="أنشئ بطاقات مراجعة من صفحة المساعد." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {flashcards.map((card) => (
        <Card key={card.id} className="shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {card.books ? <Badge variant="secondary">{card.books.subject}</Badge> : null}
              <Badge variant="outline">{formatArabicDate(card.created_at)}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">السؤال</p>
              <p className="mt-1 text-sm font-semibold leading-7">{card.question}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">الإجابة</p>
              <p className="mt-1 text-sm leading-7">{card.answer}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function QuizHistory({ quizzes }: { quizzes: SavedQuiz[] }) {
  if (!quizzes.length) {
    return <EmptyState title="لا توجد اختبارات محفوظة" action="أنشئ MCQ أو اختبارا تدريبيا من صفحة المساعد." />;
  }

  return (
    <div className="space-y-3">
      {quizzes.map((quiz) => (
        <Card key={quiz.id} className="shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">{quiz.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{quiz.quiz_questions?.length || 0} سؤال</Badge>
                {typeof quiz.score === "number" ? (
                  <Badge variant="default">النتيجة {Math.round(quiz.score)}%</Badge>
                ) : (
                  <Badge variant="outline">لم يتم التصحيح</Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{formatArabicDate(quiz.created_at)}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(quiz.quiz_questions || []).slice(0, 4).map((question, index) => (
              <div key={question.id} className="rounded-md border bg-background p-3 text-sm leading-7">
                <p className="font-semibold">
                  {index + 1}. {question.question}
                </p>
                {question.correct_answer ? (
                  <p className="mt-1 text-muted-foreground">
                    الإجابة الصحيحة: {question.correct_answer}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ title, action }: { title: string; action: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-primary" />
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{action}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/study">
            <BookOpen className="h-4 w-4" />
            فتح المساعد
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
