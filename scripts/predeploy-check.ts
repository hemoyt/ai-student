import nextEnv from "@next/env";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { getStorageBucket } from "../lib/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

type Status = "pass" | "warn" | "fail";

type Check = {
  name: string;
  status: Status;
  detail: string;
};

const checks: Check[] = [];

const requiredTables = [
  "classes",
  "subjects",
  "profiles",
  "books",
  "chapters",
  "documents",
  "flashcards",
  "quizzes",
  "quiz_questions",
  "study_progress",
  "bookmarks",
  "chat_sessions",
  "chat_messages",
  "ingestion_jobs"
] as const;

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function add(name: string, status: Status, detail: string) {
  checks.push({ name, status, detail });
}

function requireEnv(name: string) {
  add(
    `env:${name}`,
    hasEnv(name) ? "pass" : "fail",
    hasEnv(name) ? "configured" : "missing"
  );
}

function requireOneOf(name: string, envNames: string[]) {
  const configured = envNames.filter(hasEnv);
  add(
    `env:${name}`,
    configured.length > 0 ? "pass" : "fail",
    configured.length > 0
      ? `configured via ${configured.join(" or ")}`
      : `missing one of ${envNames.join(", ")}`
  );
}

async function checkTableCounts() {
  const supabase = createSupabaseAdminClient();

  for (const table of requiredTables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });

    if (error) {
      add(`table:${table}`, "fail", error.message);
      continue;
    }

    add(`table:${table}`, "pass", `${count ?? 0} rows reachable`);
  }

  const { count: classCount, error: classError } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true });
  const { count: bookCount, error: bookError } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true });
  const { count: documentCount, error: documentError } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });
  const { count: officialDocumentCount, error: officialError } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .contains("metadata", { official_curriculum: true });

  add(
    "data:classes",
    !classError && (classCount ?? 0) >= 3 ? "pass" : "fail",
    classError?.message || `${classCount ?? 0} classes found`
  );
  add(
    "data:books",
    !bookError && (bookCount ?? 0) > 0 ? "pass" : "fail",
    bookError?.message || `${bookCount ?? 0} books found`
  );
  add(
    "data:documents",
    !documentError && (documentCount ?? 0) > 0 ? "pass" : "fail",
    documentError?.message || `${documentCount ?? 0} document chunks found`
  );
  add(
    "data:official-curriculum",
    !officialError && (officialDocumentCount ?? 0) > 0 ? "pass" : "warn",
    officialError?.message ||
      `${officialDocumentCount ?? 0} official curriculum chunks found`
  );

  const bucket = getStorageBucket();
  const { data: bucketData, error: bucketError } =
    await supabase.storage.getBucket(bucket);

  add(
    "storage:books-bucket",
    bucketError ? "fail" : "pass",
    bucketError?.message || `bucket "${bucketData?.name || bucket}" is reachable`
  );

  const { data: sampleBook, error: sampleBookError } = await supabase
    .from("books")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (sampleBookError || !sampleBook) {
    add(
      "rpc:match_documents",
      sampleBookError ? "fail" : "warn",
      sampleBookError?.message || "skipped because no books exist"
    );
    return;
  }

  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || 768);
  const queryEmbedding = Array.from({ length: dimensions }, () => 0.001);
  const { error: rpcError } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    query_text: "test",
    selected_book_ids: [sampleBook.id],
    match_count: 1
  });

  add(
    "rpc:match_documents",
    rpcError ? "fail" : "pass",
    rpcError?.message || "retrieval function is callable"
  );
}

async function main() {
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireOneOf("SUPABASE_PUBLIC_KEY", [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  ]);
  requireOneOf("SUPABASE_SERVER_KEY", [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY"
  ]);
  requireEnv("OPENROUTER_API_KEY");

  const embeddingProvider = process.env.EMBEDDING_PROVIDER || "openrouter";
  add(
    "env:EMBEDDING_PROVIDER",
    ["openrouter", "gemini"].includes(embeddingProvider) ? "pass" : "warn",
    embeddingProvider
  );

  if (embeddingProvider === "gemini") {
    requireEnv("GEMINI_API_KEY");
  } else {
    add(
      "env:OPENROUTER_EMBEDDING_MODEL",
      hasEnv("OPENROUTER_EMBEDDING_MODEL") ? "pass" : "warn",
      process.env.OPENROUTER_EMBEDDING_MODEL ||
        "using provider default may be less predictable"
    );
  }

  add(
    "env:EMBEDDING_DIMENSIONS",
    Number(process.env.EMBEDDING_DIMENSIONS || 768) === 768 ? "pass" : "warn",
    `${process.env.EMBEDDING_DIMENSIONS || 768}`
  );
  add(
    "env:ADMIN_EMAILS",
    hasEnv("ADMIN_EMAILS") ? "pass" : "warn",
    hasEnv("ADMIN_EMAILS") ? "configured" : "no production admin allow-list set"
  );
  add(
    "env:OPENROUTER_SITE_URL",
    /localhost|127\.0\.0\.1/.test(process.env.OPENROUTER_SITE_URL || "")
      ? "warn"
      : "pass",
    /localhost|127\.0\.0\.1/.test(process.env.OPENROUTER_SITE_URL || "")
      ? "local URL detected; set the production domain in Vercel"
      : process.env.OPENROUTER_SITE_URL
        ? "production URL configured"
        : "not set; OpenRouter will receive the local default"
  );

  const hasBlockingEnvFailure = checks.some((check) => check.status === "fail");

  if (!hasBlockingEnvFailure) {
    try {
      await checkTableCounts();
    } catch (error) {
      add(
        "supabase:connection",
        "fail",
        error instanceof Error ? error.message : "Unknown Supabase error."
      );
    }
  }

  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;

  for (const check of checks) {
    const icon =
      check.status === "pass" ? "[pass]" : check.status === "warn" ? "[warn]" : "[fail]";
    console.log(`${icon} ${check.name}: ${check.detail}`);
  }

  console.log("");
  console.log(
    `Predeploy check completed with ${failCount} failure(s) and ${warnCount} warning(s).`
  );

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
