import type { User } from "@supabase/supabase-js";
import { HttpError } from "@/lib/api/errors";
import { getAdminEmails } from "@/lib/env";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

export async function requireRouteUser(supabase: TypedSupabaseClient) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new HttpError("Unauthorized", 401);
  }

  return user;
}

export async function requireRouteAdmin(supabase: TypedSupabaseClient): Promise<User> {
  const user = await requireRouteUser(supabase);
  const adminEmails = getAdminEmails();

  if (adminEmails.includes(user.email?.toLowerCase() || "")) {
    return user;
  }

  if (user.app_metadata?.role === "admin") {
    return user;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || data?.role !== "admin") {
    throw new HttpError("Forbidden", 403);
  }

  return user;
}
