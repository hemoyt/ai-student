import { NextResponse } from "next/server";
import { z } from "zod";
import { embedDocumentsInBatches } from "@/lib/ai/embeddings";
import { jsonError } from "@/lib/api/errors";
import { chunkPdfPages } from "@/lib/pdf/chunk";
import { extractPdfPagesFromBuffer } from "@/lib/pdf/extract";
import { getStorageBucket } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRouteAdmin } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const reprocessSchema = z.object({
  bookId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const userClient = await createSupabaseServerClient();
    await requireRouteAdmin(userClient);

    const { bookId } = reprocessSchema.parse(await request.json());
    const admin = createSupabaseAdminClient();
    const { data: book, error: bookError } = await admin
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (bookError) throw bookError;
    if (!book.source_file) {
      return NextResponse.json({ error: "Book does not have a storage source_file." }, { status: 400 });
    }

    const { data: job, error: jobError } = await admin
      .from("ingestion_jobs")
      .insert({
        book_id: book.id,
        source_file: book.source_file,
        status: "running"
      })
      .select()
      .single();

    if (jobError) throw jobError;

    try {
      const { data: blob, error: downloadError } = await admin.storage
        .from(getStorageBucket())
        .download(book.source_file);

      if ((downloadError || !blob) && !book.pdf_url) {
        throw downloadError || new Error("PDF download failed.");
      }

      let buffer: Buffer;
      if (blob) {
        buffer = Buffer.from(await blob.arrayBuffer());
      } else {
        const pdfUrl = book.pdf_url;
        if (!pdfUrl) {
          throw new Error("PDF download failed.");
        }

        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error(`PDF download failed: ${pdfResponse.status}`);
        }
        buffer = Buffer.from(await pdfResponse.arrayBuffer());
      }
      const pages = await extractPdfPagesFromBuffer(buffer);
      const chunks = await chunkPdfPages(pages);
      const embeddings = await embedDocumentsInBatches(
        chunks.map((chunk) => chunk.text),
        16,
        async (completed) => {
          await admin
            .from("ingestion_jobs")
            .update({ processed_chunks: completed })
            .eq("id", job.id);
        }
      );

      await admin.from("documents").delete().eq("book_id", book.id);

      for (let index = 0; index < chunks.length; index += 100) {
        const batch = chunks.slice(index, index + 100).map((chunk, offset) => ({
          book_id: book.id,
          chunk_text: chunk.text,
          embedding: embeddings[index + offset],
          page_number: chunk.pageNumber,
          metadata: {
            book_title: book.title,
            subject: book.subject,
            grade: book.grade,
            source_file: book.source_file,
            chapter: chunk.chapter,
            chunk_index: chunk.chunkIndex
          }
        }));

        const { error } = await admin.from("documents").insert(batch);
        if (error) throw error;
      }

      await admin
        .from("ingestion_jobs")
        .update({ status: "completed", processed_chunks: chunks.length })
        .eq("id", job.id);

      return NextResponse.json({ chunks: chunks.length, pages: pages.length });
    } catch (error) {
      await admin
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        })
        .eq("id", job.id);
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
