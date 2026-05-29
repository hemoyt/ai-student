import { embedQuery } from "@/lib/ai/embeddings";
import type { TypedSupabaseClient } from "@/lib/supabase/types";
import type { RetrievedChunk } from "@/types";

export async function retrieveBookChunks({
  supabase,
  question,
  bookIds,
  matchCount = 8
}: {
  supabase: TypedSupabaseClient;
  question: string;
  bookIds: string[];
  matchCount?: number;
}) {
  if (!bookIds.length) {
    return [];
  }

  const queryEmbedding = await embedQuery(question);
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    query_text: question,
    selected_book_ids: bookIds,
    match_count: matchCount
  });

  if (error) {
    throw new Error(`Document retrieval failed: ${error.message}`);
  }

  return (data || []) as RetrievedChunk[];
}

export function buildContextFromChunks(chunks: RetrievedChunk[]) {
  return chunks
    .map((chunk, index) => {
      const metadata = chunk.metadata || {};
      const title =
        typeof metadata.book_title === "string" ? metadata.book_title : "كتاب محدد";
      const subject =
        typeof metadata.subject === "string" ? metadata.subject : "مادة غير محددة";
      const page = chunk.page_number ? `صفحة ${chunk.page_number}` : "صفحة غير محددة";

      return `[المصدر ${index + 1}: ${title} - ${subject} - ${page}]
${chunk.chunk_text}`;
    })
    .join("\n\n---\n\n");
}
