"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { BookCard } from "@/components/library/book-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { grades, type Book, type GradeId } from "@/types";

export function LibraryBrowser() {
  const [grade, setGrade] = useState<GradeId>("grade1");
  const [search, setSearch] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ grade, scope: "official" });
    if (search.trim()) params.set("q", search.trim());

    setIsLoading(true);
    setError(null);

    fetch(`/api/books?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || "تعذر تحميل الكتب");
        return response.json() as Promise<{ books: Book[] }>;
      })
      .then((payload) => setBooks(payload.books))
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [grade, search]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const studyHref = selectedIds.length
    ? `/study?grade=${grade}&books=${selectedIds.join(",")}`
    : "/study";

  function toggleBook(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">مكتبة الكتب</h1>
          <p className="mt-1 text-sm text-muted-foreground">اختر صفك ثم افتح كتابا أو أكثر للمذاكرة.</p>
        </div>
        {selectedIds.length ? (
          <Button asChild>
            <Link href={studyHref}>ابدأ بالمحدد ({selectedIds.length})</Link>
          </Button>
        ) : (
          <Button type="button" disabled>
            ابدأ بالمحدد (0)
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-2 sm:grid-cols-3">
            {grades.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setGrade(item.id)}
                className={`rounded-md border p-3 text-right transition ${
                  grade === item.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background hover:bg-accent"
                }`}
              >
                <span className="block font-medium">{item.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pr-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث باسم الكتاب أو المادة"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : books.length ? (
        <motion.div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.035 } }
          }}
        >
          {books.map((book) => (
            <motion.div
              key={book.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <BookCard
                book={book}
                selected={selected.has(book.id)}
                onToggle={() => toggleBook(book.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            لا توجد كتب لهذا الصف بعد. شغّل سكربت إدخال الكتب أو ارفع الكتب من لوحة الإدارة.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
