import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { ChatWorkspace } from "@/components/study/chat-workspace";
import { hasSupabasePublicEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export default async function StudyPage() {
  if (!hasSupabasePublicEnv()) {
    return <SetupNotice />;
  }

  await requireUser();

  return (
    <AppShell>
      <ChatWorkspace />
    </AppShell>
  );
}
