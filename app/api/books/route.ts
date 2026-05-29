import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/errors";
import { requireRouteAdmin } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const querySchema = z.object({
  grade: z.preprocess(emptyToUndefined, z.enum(["grade1", "grade2", "grade3"]).optional()),
  q: z.preprocess(emptyToUndefined, z.string().optional()),
  scope: z.preprocess(emptyToUndefined, z.enum(["official", "all"]).optional())
});

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { grade, q, scope } = querySchema.parse(params);
    const supabase = await createSupabaseServerClient();

    if (scope === "all") {
      await requireRouteAdmin(supabase);
    }

    let query = supabase
      .from("books")
      .select("id,title,subject,grade,cover_image,pdf_url,created_at,source_file")
      .order("subject", { ascending: true })
      .order("title", { ascending: true });

    if (grade) {
      query = query.eq("grade", grade);
    }

    if (scope === "official") {
      query = query.or("source_file.ilike.%_mdl_%,pdf_url.ilike.%mdl.edu.sd%");
    }

    if (q) {
      const searchTerm = q.replace(/[%,()]/g, " ").trim();
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ books: data || [] });
  } catch (error) {
    return jsonError(error);
  }
}
