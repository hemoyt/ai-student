import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/errors";
import { getMaxUploadBytes, getStorageBucket } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRouteAdmin } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const metadataSchema = z.object({
  title: z.string().min(2).max(180),
  subject: z.string().min(2).max(120),
  grade: z.enum(["grade1", "grade2", "grade3"])
});

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const userClient = await createSupabaseServerClient();
    await requireRouteAdmin(userClient);

    const formData = await request.formData();
    const file = formData.get("file");
    const metadata = metadataSchema.parse({
      title: formData.get("title"),
      subject: formData.get("subject"),
      grade: formData.get("grade")
    });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (file.size > getMaxUploadBytes()) {
      return NextResponse.json({ error: "PDF is larger than the allowed upload size." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const bucket = getStorageBucket();
    const objectPath = `${metadata.grade}/${Date.now()}-${safeFileName(file.name) || "book"}.pdf`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: publicUrl } = admin.storage.from(bucket).getPublicUrl(objectPath);
    const { data: book, error: insertError } = await admin
      .from("books")
      .insert({
        ...metadata,
        pdf_url: publicUrl.publicUrl,
        source_file: objectPath
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await admin.from("ingestion_jobs").insert({
      book_id: book.id,
      source_file: objectPath,
      status: "queued"
    });

    return NextResponse.json({ book });
  } catch (error) {
    return jsonError(error);
  }
}
