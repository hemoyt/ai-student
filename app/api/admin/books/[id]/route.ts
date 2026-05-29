import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/errors";
import { getStorageBucket } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRouteAdmin } from "@/lib/supabase/route-auth";

const updateBookSchema = z.object({
  title: z.string().trim().min(2).max(180),
  subject: z.string().trim().min(2).max(120),
  grade: z.enum(["grade1", "grade2", "grade3"])
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userClient = await createSupabaseServerClient();
    await requireRouteAdmin(userClient);

    const { id } = await params;
    const body = updateBookSchema.parse(await request.json());
    const admin = createSupabaseAdminClient();

    const { data: book, error } = await admin
      .from("books")
      .update(body)
      .eq("id", id)
      .select("id,title,subject,grade,cover_image,pdf_url,created_at,source_file")
      .single();

    if (error) throw error;

    await updateDocumentMetadata(id, {
      book_title: book.title,
      subject: book.subject,
      grade: book.grade
    });

    return NextResponse.json({ book });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userClient = await createSupabaseServerClient();
    await requireRouteAdmin(userClient);

    const { id } = await params;
    const admin = createSupabaseAdminClient();

    const { data: book, error: bookError } = await admin
      .from("books")
      .select("source_file")
      .eq("id", id)
      .single();

    if (bookError) throw bookError;

    if (book.source_file) {
      await admin.storage.from(getStorageBucket()).remove([book.source_file]);
    }

    await admin.from("documents").delete().eq("book_id", id);
    await admin.from("ingestion_jobs").delete().eq("book_id", id);

    const { error } = await admin.from("books").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

async function updateDocumentMetadata(
  bookId: string,
  metadata: { book_title: string; subject: string; grade: string }
) {
  const admin = createSupabaseAdminClient();
  const { data: documents, error } = await admin
    .from("documents")
    .select("id,metadata")
    .eq("book_id", bookId);

  if (error) throw error;
  if (!documents?.length) return;

  for (let index = 0; index < documents.length; index += 100) {
    const batch = documents.slice(index, index + 100);
    await Promise.all(
      batch.map(async (document) => {
        const nextMetadata = {
          ...(isRecord(document.metadata) ? document.metadata : {}),
          ...metadata
        };

        const { error: updateError } = await admin
          .from("documents")
          .update({ metadata: nextMetadata })
          .eq("id", document.id);

        if (updateError) throw updateError;
      })
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
