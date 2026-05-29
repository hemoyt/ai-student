import Link from "next/link";
import {
  BookOpen,
  Brain,
  GraduationCap,
  History,
  LayoutDashboard,
  ShieldCheck
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoutButton } from "@/components/logout-button";
import { getAdminEmails } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "لوحة الدراسة", icon: LayoutDashboard },
  { href: "/library", label: "المكتبة", icon: BookOpen },
  { href: "/study", label: "المساعد الذكي", icon: Brain },
  { href: "/history", label: "السجل", icon: History },
  { href: "/admin", label: "الإدارة", icon: ShieldCheck }
];

export async function AppShell({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const canAccessAdmin = await getCanAccessAdmin();
  const visibleNavItems = navItems.filter((item) => item.href !== "/admin" || canAccessAdmin);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="sudan-flag-strip" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-foreground">منصة السودان التعليمية</p>
              <p className="text-xs text-primary">المرحلة المتوسطة</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <ModeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8", className)}>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-2 backdrop-blur md:hidden">
        <div className={cn("grid gap-1", canAccessAdmin ? "grid-cols-5" : "grid-cols-4")}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

async function getCanAccessAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;

  const adminEmails = getAdminEmails();
  if (adminEmails.includes(user.email?.toLowerCase() || "")) return true;
  if (user.app_metadata?.role === "admin") return true;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return data?.role === "admin";
}
