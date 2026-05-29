import fs from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { embedDocumentsInBatches } from "../lib/ai/embeddings";
import { chunkPdfPages } from "../lib/pdf/chunk";
import { extractFirstPageText, extractPdfPagesFromBuffer } from "../lib/pdf/extract";
import {
  getMdlMetadataForFileName,
  getMdlTargetFileName,
  sourceKeyFromName
} from "../lib/pdf/mdl-curriculum";
import { detectBookMetadata } from "../lib/pdf/metadata";
import { getStorageBucket } from "../lib/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

type IngestedBook = {
  id: string;
  title: string;
  subject: string;
  grade: "grade1" | "grade2" | "grade3";
  source_file: string | null;
};

const rootDir = process.cwd();
const booksDir = path.join(rootDir, "books");
const mdlOnly = process.argv.includes("--mdl-only");
const forceReprocess = process.argv.includes("--force");
const mdlManifestPath = path.join(booksDir, ".mdl-intermediate-manifest.json");

type MdlManifest = {
  books?: Array<{
    targetFileName?: string;
    url?: string;
  }>;
};

let mdlManifestCache: Map<string, string> | null = null;

async function getMdlSourceUrl(filePath: string) {
  if (!mdlManifestCache) {
    mdlManifestCache = new Map();

    try {
      const manifest = JSON.parse(await fs.readFile(mdlManifestPath, "utf8")) as MdlManifest;
      for (const book of manifest.books || []) {
        if (book.targetFileName && book.url) {
          mdlManifestCache.set(book.targetFileName, book.url);
        }
      }
    } catch {
      // The manifest is created by npm run sync:mdl. Non-MDL ingestion does not need it.
    }
  }

  return mdlManifestCache.get(path.basename(filePath)) || null;
}

async function listPdfFiles() {
  await fs.mkdir(booksDir, { recursive: true });
  const entries = await fs.readdir(booksDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .filter((entry) => !mdlOnly || /^grade[123]_mdl_/.test(entry.name))
    .map((entry) => path.join(booksDir, entry.name));
}

async function uniqueTargetPath(targetName: string) {
  const parsed = path.parse(targetName);
  let candidate = path.join(booksDir, targetName);
  let counter = 2;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(booksDir, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

async function renamePdfIfNeeded(filePath: string, targetFileName: string) {
  const currentName = path.basename(filePath);

  if (currentName === targetFileName) return filePath;

  // Already renamed in a previous run — don't rename again or the hash suffix
  // changes every time, creating duplicate book records and breaking skip logic.
  if (/^grade[123]_/.test(currentName)) return filePath;

  const targetPath = await uniqueTargetPath(targetFileName);
  await fs.rename(filePath, targetPath);
  return targetPath;
}

async function upsertBook({
  filePath,
  title,
  subject,
  grade
}: {
  filePath: string;
  title: string;
  subject: string;
  grade: "grade1" | "grade2" | "grade3";
}) {
  const supabase = createSupabaseAdminClient();
  const bucket = getStorageBucket();
  const objectPath = `${grade}/${path.basename(filePath)}`;
  const bytes = await fs.readFile(filePath);
  const externalPdfUrl = await getMdlSourceUrl(filePath);
  let pdfUrl: string | null = null;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, {
      contentType: "application/pdf",
      upsert: true
    });

  if (uploadError) {
    const statusCode = (uploadError as { statusCode?: unknown }).statusCode;
    const isTooLarge = String(statusCode) === "413";

    if (!isTooLarge || !externalPdfUrl) throw uploadError;

    console.log("  Storage upload skipped for oversized PDF; using MDL source URL.");
    pdfUrl = externalPdfUrl;
  } else {
    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    pdfUrl = publicUrl.publicUrl;
  }

  const { data: existing, error: selectError } = await supabase
    .from("books")
    .select("id,title,subject,grade,source_file")
    .eq("source_file", objectPath)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { data, error } = await supabase
      .from("books")
      .update({
        title,
        subject,
        grade,
        pdf_url: pdfUrl,
        source_file: objectPath
      })
      .eq("id", existing.id)
      .select("id,title,subject,grade,source_file")
      .single();

    if (error) throw error;
    return data as IngestedBook;
  }

  const { data, error } = await supabase
    .from("books")
    .insert({
      title,
      subject,
      grade,
      pdf_url: pdfUrl,
      source_file: objectPath
    })
    .select("id,title,subject,grade,source_file")
    .single();

  if (error) throw error;
  return data as IngestedBook;
}

async function writeChapters(bookId: string, chunks: Awaited<ReturnType<typeof chunkPdfPages>>) {
  const supabase = createSupabaseAdminClient();
  const chapters = Array.from(new Set(chunks.map((chunk) => chunk.chapter).filter(Boolean)));

  if (!chapters.length) return;

  const { error } = await supabase.from("chapters").upsert(
    chapters.map((title, index) => ({
      book_id: bookId,
      title: title!,
      chapter_number: index + 1
    })),
    { onConflict: "book_id,title" }
  );

  if (error) throw error;
}

async function writeDocuments(book: IngestedBook, filePath: string) {
  const supabase = createSupabaseAdminClient();
  const buffer = await fs.readFile(filePath);
  const pages = await extractPdfPagesFromBuffer(buffer);
  const chunks = await chunkPdfPages(pages);
  const localFile = path.basename(filePath);
  const sourceKey = sourceKeyFromName(localFile);

  const { data: job, error: jobError } = await supabase
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
    const embeddings = await embedDocumentsInBatches(
      chunks.map((chunk) => chunk.text),
      16,
      async (completed, total) => {
        await supabase
          .from("ingestion_jobs")
          .update({ processed_chunks: completed })
          .eq("id", job.id);
        console.log(`  Embedded ${completed}/${total} chunks`);
      }
    );

    await supabase.from("documents").delete().eq("book_id", book.id);

    for (let index = 0; index < chunks.length; index += 100) {
      const rows = chunks.slice(index, index + 100).map((chunk, offset) => ({
        book_id: book.id,
        chunk_text: chunk.text,
        embedding: embeddings[index + offset],
        page_number: chunk.pageNumber,
        metadata: {
          book_title: book.title,
          subject: book.subject,
          grade: book.grade,
          chapter: chunk.chapter,
          source_file: book.source_file,
          local_file: localFile,
          source_key: sourceKey,
          official_curriculum: Boolean(sourceKey),
          chunk_index: chunk.chunkIndex
        }
      }));

      const { error } = await supabase.from("documents").insert(rows);
      if (error) throw error;
    }

    await writeChapters(book.id, chunks);
    await supabase
      .from("ingestion_jobs")
      .update({ status: "completed", processed_chunks: chunks.length })
      .eq("id", job.id);

    return { pages: pages.length, chunks: chunks.length };
  } catch (error) {
    await supabase
      .from("ingestion_jobs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      })
      .eq("id", job.id);
    throw error;
  }
}

async function ingestFile(filePath: string) {
  const originalName = path.basename(filePath);
  console.log(`\nProcessing ${originalName}`);

  const buffer = await fs.readFile(filePath);
  const firstPageText = await extractFirstPageText(buffer);
  const detectedMetadata = detectBookMetadata(firstPageText, originalName);
  const curatedMetadata = getMdlMetadataForFileName(originalName);
  const metadata = curatedMetadata
    ? {
        ...detectedMetadata,
        title: curatedMetadata.title,
        subject: curatedMetadata.subject,
        subjectSlug: curatedMetadata.subjectSlug,
        grade: curatedMetadata.grade,
        gradeLabel: gradeLabel(curatedMetadata.grade),
        targetFileName:
          getMdlTargetFileName(originalName, detectedMetadata.grade) ||
          detectedMetadata.targetFileName
      }
    : detectedMetadata;
  const normalizedPath = await renamePdfIfNeeded(filePath, metadata.targetFileName);

  console.log(`  Grade: ${metadata.gradeLabel}`);
  console.log(`  Subject: ${metadata.subject}`);
  console.log(`  Title: ${metadata.title}`);
  console.log(`  File: ${path.basename(normalizedPath)}`);

  const book = await upsertBook({
    filePath: normalizedPath,
    title: metadata.title,
    subject: metadata.subject,
    grade: metadata.grade
  });

  const supabase = createSupabaseAdminClient();
  const { data: completedJob } = await supabase
    .from("ingestion_jobs")
    .select("id")
    .eq("book_id", book.id)
    .eq("status", "completed")
    .maybeSingle();

  if (completedJob && !forceReprocess) {
    console.log(`  Already ingested — skipping.`);
    return;
  }

  const result = await writeDocuments(book, normalizedPath);
  console.log(`  Saved ${result.chunks} chunks from ${result.pages} pages`);
}

function gradeLabel(grade: IngestedBook["grade"]) {
  if (grade === "grade1") return "الصف الأول المتوسط";
  if (grade === "grade2") return "الصف الثاني المتوسط";
  return "الصف الثالث المتوسط";
}

async function main() {
  const files = await listPdfFiles();

  if (!files.length) {
    console.log("No PDF files found in ./books.");
    return;
  }

  for (const file of files) {
    await ingestFile(file);
  }

  console.log(`\nFinished ingesting ${files.length} PDF files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
