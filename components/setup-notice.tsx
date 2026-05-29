import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <AlertCircle className="h-5 w-5" />
          </div>
          <CardTitle>إعداد البيئة مطلوب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            أضف قيم Supabase و OpenRouter و Gemini في ملف <span className="ltr inline-block rounded bg-muted px-1.5 py-0.5">.env.local</span> ثم شغّل قاعدة البيانات وسكربت إدخال الكتب.
          </p>
          <p className="ltr rounded-md bg-muted p-3 text-left text-xs">
            NEXT_PUBLIC_SUPABASE_URL
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY
            <br />
            SUPABASE_SERVICE_ROLE_KEY
            <br />
            OPENROUTER_API_KEY
            <br />
            GEMINI_API_KEY
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
