import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sessionsResult, flashcardsResult, quizzesResult] = await Promise.all([
      supabase
        .from("chat_sessions")
        .select("id,title,selected_book_ids,created_at,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase
        .from("flashcards")
        .select("id,question,answer,book_id,created_at,books(id,title,subject,grade)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("quizzes")
        .select("id,title,score,created_at,quiz_questions(id,question,choices,correct_answer,explanation,difficulty)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40)
    ]);

    if (sessionsResult.error) throw sessionsResult.error;
    if (flashcardsResult.error) throw flashcardsResult.error;
    if (quizzesResult.error) throw quizzesResult.error;

    return NextResponse.json({
      sessions: sessionsResult.data || [],
      flashcards: flashcardsResult.data || [],
      quizzes: quizzesResult.data || []
    });
  } catch (error) {
    return jsonError(error);
  }
}
