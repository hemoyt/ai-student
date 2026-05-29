import { NextResponse } from "next/server";
import { z } from "zod";
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
      .from("profiles")
      .select("id,full_name,grade,role,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
    if (authError) throw authError;

    const authMap = new Map(authUsers.users.map((u) => [u.id, u]));
    const users = (data || []).map((profile) => ({
      ...profile,
      email: authMap.get(profile.id)?.email ?? null,
      role:
        authMap.get(profile.id)?.app_metadata?.role === "admin"
          ? "admin"
          : profile.role
    }));

    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error);
  }
}

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "admin"])
});

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await requireRouteAdmin(supabase);

    const { userId, role } = updateRoleSchema.parse(await request.json());
    const admin = createSupabaseAdminClient();

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role }
    });

    if (authError) throw authError;

    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error && error.code !== "P0001") throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
