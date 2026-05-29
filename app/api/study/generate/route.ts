import { NextResponse } from "next/server";
import { z } from "zod";
import { completeJson } from "@/lib/ai/openrouter";
import { jsonError, requireUuidList } from "@/lib/api/errors";
import { buildGenerationPrompt, EDUCATIONAL_SYSTEM_PROMPT } from "@/lib/rag/prompts";
import { buildContextFromChunks, retrieveBookChunks } from "@/lib/rag/retriever";
import { checkRateLimit } from "@/lib/rag/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generationLabels } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const generateSchema = z.object({
  type: z.enum([
    "flashcards",
    "mcq",
    "exam",
    "summary",
    "key_points",
    "notes",
    "qa_drills"
  ]),
  bookIds: z.array(z.string()).min(1).max(8),
  topic: z.string().max(300).optional(),
  count: z.number().int().min(1).max(30).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  model: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = generateSchema.parse(await request.json());
    requireUuidList(body.bookIds);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`${user.id}:generate`);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many AI requests." }, { status: 429 });
    }

    const retrievalQuestion =
      body.topic ||
      `${generationLabels[body.type]} من الدروس المهمة في الكتب المحددة`;

    const chunks = await retrieveBookChunks({
      supabase,
      question: retrievalQuestion,
      bookIds: body.bookIds,
      matchCount: body.type === "exam" ? 14 : 10
    });

    const context = buildContextFromChunks(chunks);
    const result = await completeJson<Record<string, unknown>>(
      [
        { role: "system", content: EDUCATIONAL_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            buildGenerationPrompt({
              type: body.type,
              context,
              topic: body.topic,
              count: body.count,
              difficulty: body.difficulty
            }) +
            "\n\n" +
            expectedJsonShape(body.type)
        }
      ],
      {
        model: body.model,
        temperature: 0.12,
        maxTokens: body.type === "exam" ? 2600 : 1800
      }
    );

    const persisted = await persistGeneratedStudyMaterial({
      supabase,
      userId: user.id,
      type: body.type,
      bookIds: body.bookIds,
      result
    });

    return NextResponse.json({ result, citations: chunks, ...persisted });
  } catch (error) {
    return jsonError(error);
  }
}

function expectedJsonShape(type: string) {
  if (type === "flashcards") {
    return `JSON المطلوب:
{"flashcards":[{"question":"سؤال مباشر إجابته موجودة حرفيا أو معنى في السياق","answer":"إجابة قصيرة من السياق"}]}
لا تنشئ بطاقة إذا لم تكن إجابتها واضحة من السياق.`;
  }

  if (type === "mcq") {
    return `JSON المطلوب:
{"questions":[{"question":"...","choices":["أ","ب","ج","د"],"correct_answer":"...","explanation":"..."}]}`;
  }

  if (type === "exam") {
    return `JSON المطلوب:
{"title":"...","duration_minutes":45,"difficulty":"easy|medium|hard","questions":[{"type":"mcq|short_answer","question":"...","choices":["..."],"correct_answer":"...","explanation":"..."}]}`;
  }

  if (type === "qa_drills") {
    return `JSON المطلوب:
{"drills":[{"question":"...","answer":"...","hint":"..."}]}`;
  }

  return `JSON المطلوب:
{"title":"...","items":["..."],"summary":"..."}`;
}

async function persistGeneratedStudyMaterial({
  supabase,
  userId,
  type,
  bookIds,
  result
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  type: string;
  bookIds: string[];
  result: Record<string, unknown>;
}) {
  let quizId: string | undefined;

  if (type === "flashcards" && Array.isArray(result.flashcards)) {
    const rows = result.flashcards
      .filter((item): item is { question: string; answer: string } => {
        return (
          typeof item === "object" &&
          item !== null &&
          "question" in item &&
          "answer" in item &&
          typeof item.question === "string" &&
          typeof item.answer === "string"
        );
      })
      .map((item) => ({
        user_id: userId,
        question: item.question,
        answer: item.answer,
        book_id: bookIds.length === 1 ? bookIds[0] : null
      }));

    if (rows.length) {
      await supabase.from("flashcards").insert(rows);
    }
  }

  if ((type === "mcq" || type === "exam") && Array.isArray(result.questions)) {
    const { data: quiz } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        title:
          typeof result.title === "string"
            ? result.title
            : type === "exam"
              ? "اختبار تدريبي"
              : "تدريب اختيار من متعدد"
      })
      .select("id")
      .single();

    if (quiz?.id) {
      quizId = quiz.id;
      const questionRows = result.questions
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          quiz_id: quiz.id,
          question: String(item.question || ""),
          choices: Array.isArray(item.choices) ? item.choices : [],
          correct_answer:
            typeof item.correct_answer === "string" ? item.correct_answer : null,
          explanation: typeof item.explanation === "string" ? item.explanation : null,
          difficulty: typeof item.difficulty === "string" ? item.difficulty : "medium"
        }))
        .filter((item) => item.question.length > 0);

      if (questionRows.length) {
        await supabase.from("quiz_questions").insert(questionRows);
      }
    }
  }

  return { quizId };
}
