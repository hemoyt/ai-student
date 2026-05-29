"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  History,
  HelpCircle,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  Trophy
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatArabicDate } from "@/lib/utils";
import {
  generationLabels,
  grades,
  type Book,
  type GradeId,
  type StudyGenerationType
} from "@/types";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
};

type FlashcardItem = {
  question: string;
  answer: string;
};

type QuizItem = {
  type?: string;
  question: string;
  choices: string[];
  correct_answer?: string;
  explanation?: string;
  difficulty?: string;
};

type ChatSessionSummary = {
  id: string;
  title: string;
  selected_book_ids: string[];
  created_at: string;
  updated_at: string;
};

type ChatSessionPayload = {
  session: ChatSessionSummary;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }>;
  books: Book[];
};

const generationTypes = Object.keys(generationLabels) as StudyGenerationType[];

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const initialGrade = (searchParams.get("grade") as GradeId | null) || "grade1";
  const initialBookIds = searchParams.get("books")?.split(",").filter(Boolean) || [];
  const initialSessionId = searchParams.get("session");

  const [grade, setGrade] = useState<GradeId>(initialGrade);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set(initialBookIds));
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [historyCounts, setHistoryCounts] = useState({ flashcards: 0, quizzes: 0 });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [generationType, setGenerationType] = useState<StudyGenerationType>("flashcards");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [generationResult, setGenerationResult] = useState<Record<string, unknown> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/books?grade=${grade}&scope=official`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).error || "تعذر تحميل الكتب");
        }

        return response.json() as Promise<{ books: Book[] }>;
      })
      .then((payload) => setBooks(payload.books))
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      });

    return () => controller.abort();
  }, [grade]);

  useEffect(() => {
    void refreshHistory();
  }, []);

  useEffect(() => {
    if (initialSessionId) {
      void loadChatSession(initialSessionId);
    }
  }, [initialSessionId]);

  const selectedIds = useMemo(() => Array.from(selectedBookIds), [selectedBookIds]);
  const selectedBooks = books.filter((book) => selectedBookIds.has(book.id));

  function toggleBook(id: string) {
    setSelectedBookIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseGrade(nextGrade: GradeId) {
    setGrade(nextGrade);
    setSelectedBookIds(new Set());
    setSessionId(null);
    setMessages([]);
    setGenerationResult(null);
  }

  async function refreshHistory() {
    setIsHistoryLoading(true);

    try {
      const response = await fetch("/api/study/history");
      if (!response.ok) return;
      const payload = (await response.json()) as {
        sessions: ChatSessionSummary[];
        flashcards: unknown[];
        quizzes: unknown[];
      };

      setChatSessions(payload.sessions || []);
      setHistoryCounts({
        flashcards: payload.flashcards?.length || 0,
        quizzes: payload.quizzes?.length || 0
      });
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function loadChatSession(id: string) {
    setIsLoadingSession(true);
    setError(null);
    setGenerationResult(null);

    try {
      const response = await fetch(`/api/chat/sessions/${id}`);
      const payload = (await response.json()) as ChatSessionPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر فتح المحادثة");

      setSessionId(payload.session.id);
      setMessages(
        payload.messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      );
      setSelectedBookIds(new Set(payload.session.selected_book_ids));

      const firstGrade = payload.books[0]?.grade;
      if (firstGrade === "grade1" || firstGrade === "grade2" || firstGrade === "grade3") {
        setGrade(firstGrade);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر فتح المحادثة");
    } finally {
      setIsLoadingSession(false);
    }
  }

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || isSending) return;
    if (!selectedIds.length) {
      setError("اختر كتابا واحدا على الأقل.");
      return;
    }

    const currentQuestion = question.trim();
    setQuestion("");
    setError(null);
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: currentQuestion },
      { role: "assistant", content: "" }
    ]);

    try {
      const response = await fetch("/api/rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          bookIds: selectedIds,
          sessionId: sessionId || undefined
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: "تعذر إرسال السؤال" }));
        throw new Error(payload.error);
      }

      const nextSessionId = response.headers.get("X-Chat-Session-Id");
      if (nextSessionId) setSessionId(nextSessionId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        answer += decoder.decode(value, { stream: true });
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "assistant", content: answer };
          return next;
        });
      }

      void refreshHistory();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "حدث خطأ غير متوقع");
      setMessages((current) => current.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }

  async function generateStudyMaterial() {
    if (!selectedIds.length) {
      setError("اختر كتابا واحدا على الأقل.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationResult(null);

    try {
      const response = await fetch("/api/study/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: generationType,
          bookIds: selectedIds,
          topic: topic.trim() || undefined,
          count,
          difficulty
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إنشاء التدريب");
      setGenerationResult(
        payload.quizId ? { ...payload.result, quiz_id: payload.quizId } : payload.result
      );
      void refreshHistory();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "حدث خطأ غير متوقع");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">الصف والكتب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {grades.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseGrade(item.id)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm font-medium transition",
                    grade === item.id
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "bg-background hover:border-primary/40 hover:bg-secondary"
                  )}
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>

            <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
              {books.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => toggleBook(book.id)}
                  className={cn(
                    "w-full rounded-md border p-3 text-right transition",
                    selectedBookIds.has(book.id)
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "bg-background hover:border-primary/40 hover:bg-secondary/70"
                  )}
                >
                  <span className="flex items-start gap-2 text-sm font-medium leading-6">
                    <BookOpen className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span>{book.title}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{book.subject}</span>
                </button>
              ))}
              {!books.length ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  لا توجد كتب لهذا الصف.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">مولد المذاكرة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={generationType}
              onChange={(event) => setGenerationType(event.target.value as StudyGenerationType)}
            >
              {generationTypes.map((type) => (
                <option key={type} value={type}>
                  {generationLabels[type]}
                </option>
              ))}
            </select>
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="الموضوع أو الفصل"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                aria-label="عدد الأسئلة أو البطاقات"
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as "easy" | "medium" | "hard")}
                aria-label="مستوى الصعوبة"
              >
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">متقدم</option>
              </select>
            </div>
            <Button className="w-full" onClick={generateStudyMaterial} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles />}
              إنشاء
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                سجل الطالب
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/history">عرض الكل</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-1">
                {historyCounts.flashcards} بطاقة
              </span>
              <span className="rounded-md bg-muted px-2 py-1">
                {historyCounts.quizzes} اختبار
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isHistoryLoading ? (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جار تحميل السجل...
              </div>
            ) : chatSessions.length ? (
              chatSessions.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadChatSession(item.id)}
                  className={cn(
                    "w-full rounded-md border p-3 text-right text-sm transition",
                    sessionId === item.id
                      ? "border-primary bg-primary/10"
                      : "bg-background hover:border-primary/40 hover:bg-secondary/70"
                  )}
                  disabled={isLoadingSession}
                >
                  <span className="flex items-start gap-2 font-medium leading-6">
                    <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span className="line-clamp-2">{item.title}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatArabicDate(item.updated_at)}
                  </span>
                </button>
              ))
            ) : (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                لا توجد محادثات محفوظة بعد.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
              <Brain className="h-6 w-6 text-primary" />
              المساعد الذكي
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedBooks.length ? (
                selectedBooks.map((book) => (
                  <Badge key={book.id} variant="secondary">
                    {book.subject}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline">لم يتم اختيار كتب</Badge>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : null}

        <Card className="min-h-[520px] shadow-sm">
          <CardContent className="flex min-h-[520px] flex-col p-0">
            <div className="flex-1 space-y-4 overflow-auto p-4">
              {messages.length ? (
                messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm leading-7 shadow-sm",
                      message.role === "user"
                        ? "mr-auto max-w-[86%] bg-primary text-primary-foreground"
                        : "ml-auto max-w-[92%] bg-muted"
                    )}
                  >
                    {message.content || "جار إعداد الإجابة..."}
                  </motion.div>
                ))
              ) : (
                <div className="flex h-full min-h-[360px] items-center justify-center text-center text-sm leading-7 text-muted-foreground">
                  اختر الكتب واسأل عن درس، تمرين، ملخص، أو اختبار.
                </div>
              )}
            </div>

            <form onSubmit={sendQuestion} className="border-t bg-card p-4">
              <div className="flex gap-2">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="اكتب سؤالك هنا"
                  className="min-h-12 flex-1 resize-none"
                />
                <Button type="submit" size="icon" disabled={isSending || !question.trim()}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {generationResult ? <GeneratedResult result={generationResult} /> : null}
      </section>
    </div>
  );
}

function GeneratedResult({ result }: { result: Record<string, unknown> }) {
  if (typeof result.error === "string") {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4 text-sm leading-7 text-muted-foreground">{result.error}</CardContent>
      </Card>
    );
  }

  const flashcards = normalizeFlashcards(result.flashcards);
  if (flashcards.length) {
    return <FlashcardResult cards={flashcards} />;
  }

  const questions = normalizeQuestions(result.questions);
  if (questions.length) {
    return <QuizResult result={result} questions={questions} />;
  }

  const drills = normalizeDrills(result.drills);
  if (drills.length) {
    return <DrillResult drills={drills} />;
  }

  return <TextResult result={result} />;
}

function FlashcardResult({ cards }: { cards: FlashcardItem[] }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          بطاقات المراجعة
        </CardTitle>
        <Badge variant="secondary">{cards.length} بطاقة</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {cards.map((card, index) => {
          const isRevealed = Boolean(revealed[index]);

          return (
            <div
              key={`${card.question}-${index}`}
              className="flex min-h-[210px] flex-col justify-between rounded-md border bg-background p-4 shadow-sm"
            >
              <div className="space-y-3">
                <Badge variant="muted">بطاقة {index + 1}</Badge>
                <p className="text-sm font-semibold leading-7">{card.question}</p>
                <div
                  className={cn(
                    "rounded-md border p-3 text-sm leading-7 transition",
                    isRevealed
                      ? "border-primary/30 bg-primary/5 text-foreground"
                      : "border-dashed bg-muted/50 text-muted-foreground"
                  )}
                >
                  {isRevealed ? card.answer : "راجع السؤال أولا ثم أظهر الإجابة."}
                </div>
              </div>
              <Button
                type="button"
                variant={isRevealed ? "outline" : "secondary"}
                className="mt-4"
                onClick={() =>
                  setRevealed((current) => ({
                    ...current,
                    [index]: !current[index]
                  }))
                }
              >
                {isRevealed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {isRevealed ? "إخفاء الإجابة" : "إظهار الإجابة"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QuizResult({
  result,
  questions
}: {
  result: Record<string, unknown>;
  questions: QuizItem[];
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreStatus, setScoreStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const scorableQuestions = questions.filter((item) => item.choices.length && item.correct_answer);
  const score = scorableQuestions.reduce((total, item) => {
    const index = questions.indexOf(item);
    return total + (answers[index] === item.correct_answer ? 1 : 0);
  }, 0);
  const percent = scorableQuestions.length ? Math.round((score / scorableQuestions.length) * 100) : 0;
  const quizId = typeof result.quiz_id === "string" ? result.quiz_id : null;

  async function submitQuiz() {
    setSubmitted(true);

    if (!quizId || !scorableQuestions.length) return;

    setScoreStatus("saving");
    try {
      const response = await fetch(`/api/quizzes/${quizId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: percent,
          correctCount: score,
          totalQuestions: scorableQuestions.length
        })
      });

      if (!response.ok) throw new Error("Failed to save score");
      setScoreStatus("saved");
    } catch {
      setScoreStatus("failed");
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-primary" />
            {typeof result.title === "string" ? result.title : "تدريب اختيار من متعدد"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {typeof result.duration_minutes === "number" ? (
              <Badge variant="secondary">{result.duration_minutes} دقيقة</Badge>
            ) : null}
            {typeof result.difficulty === "string" ? (
              <Badge variant="outline">{difficultyLabel(result.difficulty)}</Badge>
            ) : null}
            <Badge variant="secondary">{questions.length} سؤال</Badge>
          </div>
        </div>

        {submitted && scorableQuestions.length ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Trophy className="h-5 w-5" />
                النتيجة: {score} من {scorableQuestions.length}
              </div>
              <Badge variant="default">{percent}%</Badge>
            </div>
            {scoreStatus !== "idle" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {scoreStatus === "saving"
                  ? "جار حفظ النتيجة..."
                  : scoreStatus === "saved"
                    ? "تم حفظ النتيجة في حسابك."
                    : "ظهرت النتيجة، لكن تعذر حفظها."}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((item, index) => {
          const selected = answers[index];
          const isCorrect = submitted && selected === item.correct_answer;
          const isWrong = submitted && Boolean(selected) && selected !== item.correct_answer;

          return (
            <div key={`${item.question}-${index}`} className="rounded-md border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-7">
                  <span className="text-primary">{index + 1}. </span>
                  {item.question}
                </p>
                {submitted && item.correct_answer ? (
                  <Badge variant={isCorrect ? "default" : isWrong ? "outline" : "muted"}>
                    {isCorrect ? "صحيح" : isWrong ? "خطأ" : "بدون إجابة"}
                  </Badge>
                ) : null}
              </div>

              {item.choices.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {item.choices.map((choice) => {
                    const isSelected = selected === choice;
                    const isAnswer = submitted && choice === item.correct_answer;

                    return (
                      <button
                        key={choice}
                        type="button"
                        disabled={submitted}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            [index]: choice
                          }))
                        }
                        className={cn(
                          "rounded-md border px-3 py-2 text-right text-sm leading-6 transition",
                          isSelected && !submitted && "border-primary bg-primary/10",
                          submitted && isAnswer && "border-primary bg-primary/10 text-primary",
                          submitted && isSelected && !isAnswer && "border-destructive bg-destructive/10 text-destructive",
                          !isSelected && !submitted && "hover:border-primary/40 hover:bg-secondary"
                        )}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md bg-muted p-3 text-sm leading-7 text-muted-foreground">
                  سؤال مقالي. ستظهر الإجابة النموذجية بعد التصحيح.
                </div>
              )}

              {submitted ? (
                <div className="mt-3 space-y-2 rounded-md bg-muted p-3 text-sm leading-7">
                  {item.correct_answer ? (
                    <p>
                      <span className="font-semibold">الإجابة الصحيحة: </span>
                      {item.correct_answer}
                    </p>
                  ) : null}
                  {item.explanation ? (
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">الشرح: </span>
                      {item.explanation}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="sm:min-w-40"
            disabled={!scorableQuestions.length}
            onClick={submitQuiz}
          >
            <CheckCircle2 className="h-4 w-4" />
            تصحيح الإجابات
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
              setScoreStatus("idle");
            }}
          >
            <RotateCcw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DrillResult({ drills }: { drills: Array<FlashcardItem & { hint?: string }> }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">تدريبات سؤال وجواب</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {drills.map((item, index) => (
          <div key={`${item.question}-${index}`} className="rounded-md border bg-background p-4">
            <p className="text-sm font-semibold leading-7">
              {index + 1}. {item.question}
            </p>
            {item.hint ? <p className="mt-2 text-sm leading-7 text-muted-foreground">تلميح: {item.hint}</p> : null}
            <p className="mt-3 rounded-md bg-muted p-3 text-sm leading-7">{item.answer}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TextResult({ result }: { result: Record<string, unknown> }) {
  const title = typeof result.title === "string" ? result.title : "الناتج";
  const summary = typeof result.summary === "string" ? result.summary : null;
  const items = Array.isArray(result.items) ? result.items.map(String).filter(Boolean) : [];

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary ? <p className="rounded-md bg-muted p-4 text-sm leading-7">{summary}</p> : null}
        {items.length ? (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-md border bg-background p-3 text-sm leading-7">
                <span className="font-semibold text-primary">{index + 1}. </span>
                {item}
              </div>
            ))}
          </div>
        ) : (
          Object.entries(result).map(([key, value]) => (
            <div key={key} className="rounded-md border bg-background p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{key}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function normalizeFlashcards(value: unknown): FlashcardItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const question = typeof item.question === "string" ? item.question.trim() : "";
      const answer = typeof item.answer === "string" ? item.answer.trim() : "";
      return question && answer ? { question, answer } : null;
    })
    .filter((item): item is FlashcardItem => Boolean(item));
}

function normalizeQuestions(value: unknown): QuizItem[] {
  if (!Array.isArray(value)) return [];

  const questions: QuizItem[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const question = typeof item.question === "string" ? item.question.trim() : "";
    if (!question) continue;

    questions.push({
      type: typeof item.type === "string" ? item.type : undefined,
      question,
      choices: normalizeStringList(item.choices),
      correct_answer: typeof item.correct_answer === "string" ? item.correct_answer.trim() : undefined,
      explanation: typeof item.explanation === "string" ? item.explanation.trim() : undefined,
      difficulty: typeof item.difficulty === "string" ? item.difficulty : undefined
    });
  }

  return questions;
}

function normalizeDrills(value: unknown): Array<FlashcardItem & { hint?: string }> {
  if (!Array.isArray(value)) return [];

  const drills: Array<FlashcardItem & { hint?: string }> = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const answer = typeof item.answer === "string" ? item.answer.trim() : "";
    const hint = typeof item.hint === "string" ? item.hint.trim() : undefined;
    if (question && answer) drills.push({ question, answer, hint });
  }

  return drills;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function difficultyLabel(value: string) {
  if (value === "easy") return "سهل";
  if (value === "hard") return "متقدم";
  return "متوسط";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
