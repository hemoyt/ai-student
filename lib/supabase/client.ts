"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

let browserClient: TypedSupabaseClient | null = null;

export function hasBrowserSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

export function getSupabaseBrowserClient() {
  if (!hasBrowserSupabaseEnv()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
    );
  }

  return browserClient;
}
