import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, jsonError, requireUuidList } from "@/lib/api/errors";
import { streamChatCompletion } from "@/lib/ai/openrouter";
import { checkRateLimit } from "@/lib/rag/rate-limit";
import {
  buildGroundedUserPrompt,
  EDUCATIONAL_SYSTEM_PROMPT
} from "@/lib/rag/prompts";
import { buildContextFromChunks, retrieveBookChunks } from "@/lib/rag/retriever";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatSchema = z.object({
  question: z.string().min(2).max(2000),
  bookIds: z.array(z.string()).min(1).max(8),
  sessionId: z.string().uuid().nullish(),
  model: z.string().min(3).max(120).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = chatSchema.parse(await request.json());
    requireUuidList(body.bookIds);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateKey = `${user.id}:${request.headers.get("x-forwarded-for") || "local"}`;
    const rateLimit = checkRateLimit(rateKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const chunks = await retrieveBookChunks({
      supabase,
      question: body.question,
      bookIds: body.bookIds,
      matchCount: 8
    });
    const context = buildContextFromChunks(chunks);

    const sessionId = await ensureChatSession({
      supabase,
      userId: user.id,
      sessionId: body.sessionId ?? undefined,
      question: body.question,
      bookIds: body.bookIds
    });

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: body.question,
      citations: []
    });

    const citations = chunks.map((chunk) => ({
      book_id: chunk.book_id,
      page_number: chunk.page_number,
      score: chunk.score,
      metadata: chunk.metadata
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullAnswer = "";

        try {
          for await (const token of streamChatCompletion(
            [
              { role: "system", content: EDUCATIONAL_SYSTEM_PROMPT },
              {
                role: "user",
                content: buildGroundedUserPrompt({
                  question: body.question,
                  context
                })
              }
            ],
            { model: body.model, temperature: 0.15 }
          )) {
            fullAnswer += token;
            controller.enqueue(encoder.encode(token));
          }

          await supabase.from("chat_messages").insert({
            session_id: sessionId,
            user_id: user.id,
            role: "assistant",
            content: fullAnswer,
            citations:
              citations as unknown as Database["public"]["Tables"]["chat_messages"]["Insert"]["citations"]
          });

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Session-Id": sessionId,
        "X-RateLimit-Remaining": String(rateLimit.remaining)
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}

async function ensureChatSession({
  supabase,
  userId,
  sessionId,
  question,
  bookIds
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  sessionId?: string;
  question: string;
  bookIds: string[];
}) {
  if (sessionId) {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (error || !data?.id) {
      throw new HttpError("Chat session not found.", 404);
    }

    const { error: updateError } = await supabase
      .from("chat_sessions")
      .update({ selected_book_ids: bookIds })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (updateError) throw updateError;
    return data.id;
  }

  const title = question.length > 60 ? `${question.slice(0, 57)}...` : question;
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      title,
      selected_book_ids: bookIds
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
