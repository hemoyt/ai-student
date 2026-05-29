import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, jsonError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid()
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params);
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id,title,selected_book_ids,created_at,updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      throw new HttpError("Chat session not found.", 404);
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id,role,content,citations,created_at")
      .eq("session_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    const { data: books, error: booksError } = session.selected_book_ids.length
      ? await supabase
          .from("books")
          .select("id,title,subject,grade,cover_image,pdf_url,created_at,source_file")
          .in("id", session.selected_book_ids)
      : { data: [], error: null };

    if (booksError) throw booksError;

    return NextResponse.json({
      session,
      messages: messages || [],
      books: books || []
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params);
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
