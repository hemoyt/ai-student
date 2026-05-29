import { AdminPanel } from "@/components/admin/admin-panel";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { hasSupabasePublicEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/supabase/auth";

export default async function AdminPage() {
  if (!hasSupabasePublicEnv()) {
    return <SetupNotice />;
  }

  await requireAdmin();

  return (
    <AppShell>
      <AdminPanel />
    </AppShell>
  );
}
