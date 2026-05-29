import { redirect } from "next/navigation";
import { getAdminEmails } from "@/lib/env";
import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

export async function getCurrentUser() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const adminEmails = getAdminEmails();

  if (adminEmails.includes(user.email?.toLowerCase() || "")) {
    return user;
  }

  if (user.app_metadata?.role === "admin") {
    return user;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (data?.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}
