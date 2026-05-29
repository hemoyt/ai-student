"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

export function BookCard({
  book,
  selected,
  onToggle
}: {
  book: Book;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={cn("overflow-hidden transition", selected && "border-primary ring-2 ring-primary/20")}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onToggle}
            className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border bg-muted text-primary"
            aria-label={`اختيار ${book.title}`}
          >
            {book.cover_image ? (
              <Image src={book.cover_image} alt={book.title} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-8 w-8" />
              </div>
            )}
            {selected ? (
              <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge>{book.subject}</Badge>
              <Badge variant="outline">{gradeLabel(book.grade)}</Badge>
            </div>
            <h3 className="line-clamp-2 text-base font-semibold leading-7">{book.title}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant={selected ? "default" : "outline"} size="sm" onClick={onToggle}>
                {selected ? "مختار" : "اختيار"}
              </Button>
              {book.pdf_url ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={book.pdf_url} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    فتح
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function gradeLabel(grade: string) {
  if (grade === "grade1") return "الأول";
  if (grade === "grade2") return "الثاني";
  return "الثالث";
}
