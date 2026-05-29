import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const scoreSchema = z.object({
  score: z.number().min(0).max(100),
  correctCount: z.number().int().min(0),
  totalQuestions: z.number().int().min(1)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = scoreSchema.parse(await request.json());
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("quizzes")
      .update({ score: body.score })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,score")
      .single();

    if (error) throw error;

    return NextResponse.json({
      quiz: data,
      correctCount: body.correctCount,
      totalQuestions: body.totalQuestions
    });
  } catch (error) {
    return jsonError(error);
  }
}
