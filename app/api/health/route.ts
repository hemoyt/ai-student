import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ConfigError, getStorageBucket } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded" | "error";

type HealthCheck = {
  status: HealthStatus;
  details?: Record<string, unknown>;
  error?: string;
};

const tableNames = [
  "classes",
  "subjects",
  "books",
  "documents",
  "profiles"
] as const;

function statusCode(status: HealthStatus) {
  if (status === "ok") return 200;
  if (status === "degraded") return 503;
  return 500;
}

function safeError(error: unknown) {
  if (error instanceof ConfigError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown health check error.";
}

export async function GET() {
  const checks: Record<string, HealthCheck> = {};
  let overall: HealthStatus = "ok";

  try {
    const supabase = createSupabaseAdminClient();
    const bucket = getStorageBucket();

    const tableResults = await Promise.all(
      tableNames.map(async (table) => {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true });

        if (error) {
          throw new Error(`${table}: ${error.message}`);
        }

        return [table, count ?? 0] as const;
      })
    );

    const { data: bucketData, error: bucketError } =
      await supabase.storage.getBucket(bucket);

    if (bucketError) {
      throw new Error(`storage bucket "${bucket}": ${bucketError.message}`);
    }

    const counts = Object.fromEntries(tableResults);
    const hasBooks = (counts.books ?? 0) > 0;
    const hasDocuments = (counts.documents ?? 0) > 0;

    checks.supabase = {
      status: "ok",
      details: {
        tables: counts,
        storageBucket: bucketData.name
      }
    };

    checks.curriculum = {
      status: hasBooks && hasDocuments ? "ok" : "degraded",
      details: {
        books: counts.books,
        documents: counts.documents,
        message:
          hasBooks && hasDocuments
            ? "Curriculum data is available."
            : "Upload and ingest books before using RAG in production."
      }
    };

    overall = checks.curriculum.status;
  } catch (error) {
    checks.supabase = {
      status: error instanceof ConfigError ? "degraded" : "error",
      error: safeError(error)
    };
    overall = checks.supabase.status;
  }

  checks.ai = {
    status: process.env.OPENROUTER_API_KEY ? "ok" : "degraded",
    details: {
      openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      chatModel: process.env.OPENROUTER_DEFAULT_MODEL || "deepseek/deepseek-chat",
      embeddingProvider: process.env.EMBEDDING_PROVIDER || "openrouter",
      embeddingModel:
        process.env.OPENROUTER_EMBEDDING_MODEL ||
        process.env.GEMINI_EMBEDDING_MODEL ||
        "not configured"
    }
  };

  if (checks.ai.status !== "ok" && overall === "ok") {
    overall = "degraded";
  }

  return NextResponse.json(
    {
      ok: overall === "ok",
      status: overall,
      timestamp: new Date().toISOString(),
      checks
    },
    { status: statusCode(overall) }
  );
}
