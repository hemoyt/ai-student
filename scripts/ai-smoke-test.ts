import nextEnv from "@next/env";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { completeJson, completeText } from "../lib/ai/openrouter";
import {
  buildGenerationPrompt,
  buildGroundedUserPrompt,
  EDUCATIONAL_SYSTEM_PROMPT
} from "../lib/rag/prompts";
import { buildContextFromChunks, retrieveBookChunks } from "../lib/rag/retriever";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const supabase = createSupabaseAdminClient();
  const { data: documents, error: documentError } = await supabase
    .from("documents")
    .select("book_id,chunk_text,metadata")
    .contains("metadata", { official_curriculum: true })
    .not("chunk_text", "is", null)
    .limit(1);

  if (documentError) throw documentError;
  const sampleDocument = documents?.[0];
  const bookId = sampleDocument?.book_id;
  if (!bookId) throw new Error("No document chunks available.");

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id,title,subject,grade")
    .eq("id", bookId)
    .single();

  if (bookError) throw bookError;

  const question = `لخص أهم فكرة في هذا النص: ${sampleDocument.chunk_text.slice(0, 220)}`;
  const chunks = await retrieveBookChunks({
    supabase,
    question,
    bookIds: [bookId],
    matchCount: 3
  });
  const context = buildContextFromChunks(chunks);

  const answer = await completeText(
    [
      { role: "system", content: EDUCATIONAL_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildGroundedUserPrompt({ question, context })
      }
    ],
    { maxTokens: 350, temperature: 0.1 }
  );

  const flashcards = await completeJson(
    [
      { role: "system", content: EDUCATIONAL_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          buildGenerationPrompt({
            type: "flashcards",
            context,
            topic: "مراجعة عامة",
            count: 2
          }) +
          '\nJSON المطلوب: {"flashcards":[{"question":"...","answer":"..."}]}'
      }
    ],
    { maxTokens: 700, temperature: 0.1 }
  );

  const mcq = await completeJson(
    [
      { role: "system", content: EDUCATIONAL_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          buildGenerationPrompt({
            type: "mcq",
            context,
            topic: "تدريب سريع",
            count: 2
          }) +
          '\nJSON المطلوب: {"questions":[{"question":"...","choices":["...","...","...","..."],"correct_answer":"...","explanation":"..."}]}'
      }
    ],
    { maxTokens: 900, temperature: 0.1 }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        book,
        retrievedChunks: chunks.length,
        answerPreview: answer.slice(0, 360),
        flashcards,
        mcq
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
