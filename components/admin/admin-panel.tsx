"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit3, Loader2, RefreshCcw, Save, Trash2, Upload, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { grades, type Book, type GradeId } from "@/types";

type IngestionJob = {
  id: string;
  book_id: string | null;
  source_file: string | null;
  book: { title: string; subject: string; grade: string } | null;
  status: "queued" | "running" | "completed" | "failed";
  processed_chunks: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  grade: string | null;
  role: string | null;
  created_at: string;
};

type BookDraft = {
  title: string;
  subject: string;
  grade: GradeId;
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "muted"> = {
  completed: "default",
  running: "secondary",
  queued: "muted",
  failed: "outline"
};

const statusLabel: Record<IngestionJob["status"], string> = {
  completed: "مكتمل",
  running: "قيد المعالجة",
  queued: "في الانتظار",
  failed: "فشل"
};

const statusClass: Record<string, string> = {
  failed: "text-red-500"
};

export function AdminPanel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState<GradeId>("grade1");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingBookId, setSavingBookId] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookDraft, setBookDraft] = useState<BookDraft | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"books" | "users">("books");

  useEffect(() => {
    void refreshData();
  }, []);

  async function refreshData() {
    const [booksRes, jobsRes, usersRes] = await Promise.all([
      fetch("/api/books?scope=all"),
      fetch("/api/admin/ingestion-jobs"),
      fetch("/api/admin/users")
    ]);

    if (booksRes.ok) {
      const payload = (await booksRes.json()) as { books: Book[] };
      setBooks(payload.books);
    }

    if (jobsRes.ok) {
      const payload = (await jobsRes.json()) as { jobs: IngestionJob[] };
      setJobs(payload.jobs);
    }

    if (usersRes.ok) {
      const payload = (await usersRes.json()) as { users: UserProfile[] };
      setUsers(payload.users);
    }
  }

  async function uploadBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("subject", subject);
    formData.set("grade", grade);
    formData.set("file", file);

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر رفع الكتاب");

      setMessage("تم رفع الكتاب وإضافة مهمة إدخال جديدة.");
      setTitle("");
      setSubject("");
      setFile(null);
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setIsUploading(false);
    }
  }

  function startEditingBook(book: Book) {
    setEditingBookId(book.id);
    setBookDraft({
      title: book.title,
      subject: book.subject,
      grade: book.grade
    });
  }

  async function saveBookMetadata(bookId: string) {
    if (!bookDraft) return;

    setSavingBookId(bookId);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookDraft)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ بيانات الكتاب");

      setMessage("تم تحديث بيانات الكتاب والفهرس المرتبط به.");
      setEditingBookId(null);
      setBookDraft(null);
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setSavingBookId(null);
    }
  }

  async function reprocessBook(bookId: string) {
    setReprocessingId(bookId);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إعادة المعالجة");

      setMessage(`اكتملت المعالجة: ${payload.chunks} مقطع.`);
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setReprocessingId(null);
    }
  }

  async function deleteBook(bookId: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الكتاب؟ سيتم حذف جميع البيانات المرتبطة به.")) {
      return;
    }

    setDeletingId(bookId);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "تعذر حذف الكتاب");
      }

      setMessage("تم حذف الكتاب بنجاح.");
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleUserRole(user: UserProfile) {
    const newRole = user.role === "admin" ? "student" : "admin";
    setTogglingUserId(user.id);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: newRole })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "تعذر تغيير الصلاحية");
      }

      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setTogglingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">لوحة الإدارة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          إدارة الكتب والمستخدمين والفهارس التعليمية.
        </p>
      </div>

      {message ? (
        <p className="rounded-md bg-muted p-3 text-sm leading-7 text-muted-foreground">{message}</p>
      ) : null}

      <div className="flex gap-2 border-b">
        <button
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "books"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("books")}
          type="button"
        >
          الكتب ({books.length})
        </button>
        <button
          className={`flex items-center gap-1 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("users")}
          type="button"
        >
          <Users className="h-3.5 w-3.5" />
          المستخدمون ({users.length})
        </button>
      </div>

      {activeTab === "books" ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>رفع كتاب</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={uploadBook}>
                  <div className="space-y-2">
                    <Label htmlFor="title">اسم الكتاب</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">المادة</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">الصف</Label>
                    <GradeSelect
                      id="grade"
                      value={grade}
                      onChange={(nextGrade) => setGrade(nextGrade)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">ملف PDF</Label>
                    <Input
                      id="file"
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <Button className="w-full" disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload />}
                    رفع
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>الكتب ({books.length})</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[560px] space-y-3 overflow-y-auto">
                {books.map((book) => {
                  const isEditing = editingBookId === book.id && bookDraft;

                  return (
                    <div
                      key={book.id}
                      className="flex flex-col gap-3 rounded-md border bg-background p-3 shadow-sm"
                    >
                      {isEditing ? (
                        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                          <div className="space-y-2">
                            <Label htmlFor={`title-${book.id}`}>اسم الكتاب</Label>
                            <Input
                              id={`title-${book.id}`}
                              value={bookDraft.title}
                              onChange={(event) =>
                                setBookDraft((current) =>
                                  current ? { ...current, title: event.target.value } : current
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`grade-${book.id}`}>الصف</Label>
                            <GradeSelect
                              id={`grade-${book.id}`}
                              value={bookDraft.grade}
                              onChange={(nextGrade) =>
                                setBookDraft((current) =>
                                  current ? { ...current, grade: nextGrade } : current
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`subject-${book.id}`}>المادة</Label>
                            <Input
                              id={`subject-${book.id}`}
                              value={bookDraft.subject}
                              onChange={(event) =>
                                setBookDraft((current) =>
                                  current ? { ...current, subject: event.target.value } : current
                                )
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium leading-7">{book.title}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant="secondary">{book.subject}</Badge>
                              <Badge variant="outline">{gradeLabel(book.grade)}</Badge>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveBookMetadata(book.id)}
                              disabled={savingBookId === book.id}
                            >
                              {savingBookId === book.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              حفظ
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingBookId(null);
                                setBookDraft(null);
                              }}
                            >
                              <X className="h-4 w-4" />
                              إلغاء
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingBook(book)}
                            disabled={Boolean(reprocessingId || deletingId)}
                          >
                            <Edit3 className="h-4 w-4" />
                            تعديل البيانات
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => reprocessBook(book.id)}
                          disabled={reprocessingId === book.id || deletingId === book.id || Boolean(isEditing)}
                        >
                          {reprocessingId === book.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                          إعادة الفهرسة
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBook(book.id)}
                          disabled={deletingId === book.id || reprocessingId === book.id || Boolean(isEditing)}
                        >
                          {deletingId === book.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          حذف
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {!books.length ? (
                  <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
                    لا توجد كتب.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>حالة الإدخال</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] space-y-3 overflow-y-auto">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="grid gap-2 rounded-md border bg-background p-3 text-sm md:grid-cols-[150px_1fr_120px]"
                >
                  <Badge
                    variant={statusVariant[job.status] ?? "outline"}
                    className={statusClass[job.status]}
                  >
                    {statusLabel[job.status]}
                  </Badge>
                  <span className="truncate">
                    {job.book?.title || job.source_file || job.book_id}
                  </span>
                  <span>{job.processed_chunks} مقطع</span>
                  {job.error ? <p className="text-destructive md:col-span-3">{job.error}</p> : null}
                </div>
              ))}
              {!jobs.length ? (
                <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
                  لا توجد مهام إدخال.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {activeTab === "users" ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>المستخدمون ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] space-y-3 overflow-y-auto">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-md border bg-background p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{user.full_name || "-"}</p>
                  <p className="ltr text-left text-sm text-muted-foreground">{user.email || "-"}</p>
                  <div className="flex gap-2">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "مدير" : "طالب"}
                    </Badge>
                    {user.grade ? <Badge variant="outline">{gradeLabel(user.grade)}</Badge> : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleUserRole(user)}
                  disabled={togglingUserId === user.id}
                >
                  {togglingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {user.role === "admin" ? "إلغاء الإدارة" : "تعيين مديرا"}
                </Button>
              </div>
            ))}
            {!users.length ? (
              <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
                لا يوجد مستخدمون.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function GradeSelect({
  id,
  value,
  onChange
}: {
  id: string;
  value: GradeId;
  onChange: (value: GradeId) => void;
}) {
  return (
    <select
      id={id}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as GradeId)}
    >
      {grades.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function gradeLabel(value: string) {
  return grades.find((item) => item.id === value)?.label || value;
}
