import nextEnv from "@next/env";
import { Client } from "pg";
import { mdlIntermediateBooks } from "../lib/pdf/mdl-curriculum";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

type BookRow = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  source_file: string | null;
  pdf_url: string | null;
};

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

async function main() {
  const supabase = createSupabaseAdminClient();
  const pg = await connectPostgres();
  let updatedBooks = 0;
  let updatedDocuments = 0;
  const missing: string[] = [];

  try {
    for (const metadata of mdlIntermediateBooks) {
      const { data: matches, error } = await supabase
        .from("books")
        .select("id,title,subject,grade,source_file,pdf_url")
        .or(`source_file.ilike.%${metadata.sourceKey}%,pdf_url.ilike.%${metadata.sourceKey}%`);

      if (error) throw error;
      const books = (matches || []) as BookRow[];

      if (!books.length) {
        missing.push(`${metadata.grade}/${metadata.title} (${metadata.sourceKey})`);
        continue;
      }

      for (const book of books) {
        const { error: updateError } = await supabase
          .from("books")
          .update({
            title: metadata.title,
            subject: metadata.subject,
            grade: metadata.grade
          })
          .eq("id", book.id);

        if (updateError) throw updateError;
        updatedBooks += 1;

        updatedDocuments += await updateDocumentMetadata(pg, book.id, {
          book_title: metadata.title,
          subject: metadata.subject,
          grade: metadata.grade,
          source_key: metadata.sourceKey,
          official_curriculum: true
        });

        console.log(`Updated ${metadata.grade}: ${metadata.title}`);
      }
    }
  } finally {
    await pg?.end().catch(() => undefined);
  }

  console.log("\nMDL curation complete");
  console.log(`Books updated: ${updatedBooks}`);
  console.log(`Document rows updated: ${updatedDocuments}`);

  if (missing.length) {
    console.log(`Missing source keys: ${missing.length}`);
    for (const item of missing) console.log(`- ${item}`);
  }
}

async function connectPostgres() {
  if (!process.env.DATABASE_URL) return null;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });

  await client.connect();
  return client;
}

async function updateDocumentMetadata(
  pg: Client | null,
  bookId: string,
  metadata: Record<string, Json>
) {
  if (pg) {
    const result = await pg.query(
      `
        update public.documents
        set metadata = metadata || $2::jsonb
        where book_id = $1
      `,
      [bookId, JSON.stringify(metadata)]
    );

    return result.rowCount || 0;
  }

  const supabase = createSupabaseAdminClient();
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id,metadata")
    .eq("book_id", bookId);

  if (error) throw error;
  if (!documents?.length) return 0;

  for (let index = 0; index < documents.length; index += 100) {
    const batch = documents.slice(index, index + 100);
    await Promise.all(
      batch.map(async (document) => {
        const nextMetadata = {
          ...(isRecord(document.metadata) ? document.metadata : {}),
          ...metadata
        };

        const { error: updateError } = await supabase
          .from("documents")
          .update({ metadata: nextMetadata })
          .eq("id", document.id);

        if (updateError) throw updateError;
      })
    );
  }

  return documents.length;
}

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
