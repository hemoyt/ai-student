import { AppShell } from "@/components/app-shell";
import { StudyHistory } from "@/components/history/study-history";
import { SetupNotice } from "@/components/setup-notice";
import { hasSupabasePublicEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export default async function HistoryPage() {
  if (!hasSupabasePublicEnv()) {
    return <SetupNotice />;
  }

  await requireUser();

  return (
    <AppShell>
      <StudyHistory />
    </AppShell>
  );
}
