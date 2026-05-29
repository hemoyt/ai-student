import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRouteAdmin } from "@/lib/supabase/route-auth";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    await requireRouteAdmin(supabase);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("ingestion_jobs")
      .select("id,book_id,source_file,status,processed_chunks,error,created_at,updated_at,book:books(title,subject,grade)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ jobs: data || [] });
  } catch (error) {
    return jsonError(error);
  }
}
