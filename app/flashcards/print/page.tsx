import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { SetupNotice } from "@/components/setup-notice";
import { Card, CardContent } from "@/components/ui/card";
import { hasSupabasePublicEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function FlashcardsPrintPage() {
  if (!hasSupabasePublicEnv()) {
    return <SetupNotice />;
  }

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id,question,answer,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <AppShell>
      <div className="space-y-5 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-normal">بطاقات المراجعة</h1>
          <PrintButton />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 print:mt-0 print:grid-cols-2">
        {(flashcards || []).map((card) => (
          <Card key={card.id} className="break-inside-avoid shadow-none">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs text-muted-foreground">السؤال</p>
                <p className="mt-1 leading-7">{card.question}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">الإجابة</p>
                <p className="mt-1 leading-7">{card.answer}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
