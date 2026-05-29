import { AppShell } from "@/components/app-shell";
import { LibraryBrowser } from "@/components/library/library-browser";
import { SetupNotice } from "@/components/setup-notice";
import { hasSupabasePublicEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export default async function LibraryPage() {
  if (!hasSupabasePublicEnv()) {
    return <SetupNotice />;
  }

  await requireUser();

  return (
    <AppShell>
      <LibraryBrowser />
    </AppShell>
  );
}
