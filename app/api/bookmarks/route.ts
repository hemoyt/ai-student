import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bookmarkSchema = z.object({
  book_id: z.string().uuid(),
  page_number: z.number().int().positive().optional(),
  note: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    const body = bookmarkSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({ ...body, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ bookmark: data });
  } catch (error) {
    return jsonError(error);
  }
}
