"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient, hasBrowserSupabaseEnv } from "@/lib/supabase/client";
import { grades, type GradeId } from "@/types";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState<GradeId>("grade1");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("إعداد Supabase غير مكتمل.");
      setIsLoading(false);
      return;
    }

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                grade
              }
            }
          });

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    router.replace(searchParams.get("next") || "/dashboard");
    router.refresh();
  }

  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isSignup ? "إنشاء حساب طالب" : "تسجيل الدخول"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasBrowserSupabaseEnv() ? (
            <p className="rounded-md bg-muted p-3 text-sm leading-6 text-muted-foreground">
              أضف إعدادات Supabase في ملف البيئة قبل استخدام المصادقة.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              {isSignup ? (
                <div className="space-y-2">
                  <Label htmlFor="name">اسم الطالب</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {isSignup ? (
                <div className="space-y-2">
                  <Label htmlFor="grade">الصف الدراسي</Label>
                  <select
                    id="grade"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value as GradeId)}
                  >
                    {grades.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignup ? <UserPlus /> : <LogIn />}
                {isSignup ? "إنشاء الحساب" : "دخول"}
              </Button>
            </form>
          )}

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <Link href="/login" className="text-primary hover:underline">
                لدي حساب بالفعل
              </Link>
            ) : (
              <Link href="/signup" className="text-primary hover:underline">
                إنشاء حساب جديد
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
