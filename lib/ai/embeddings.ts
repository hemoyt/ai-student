import { getGeminiEnv, getJinaApiKey, getOpenRouterEnv } from "@/lib/env";

type GeminiEmbedding = { values: number[] };
type GeminiBatchResponse = { embeddings?: GeminiEmbedding[] };
type OpenRouterEmbeddingResponse = {
  data?: Array<{ embedding: number[]; index?: number }>;
};
type EmbeddingTaskType = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";

// ── Gemini ────────────────────────────────────────────────────────────────────

function geminiEmbeddingUrl(model: string) {
  const { apiKey } = getGeminiEnv();
  const modelName = model.startsWith("models/") ? model : `models/${model}`;
  return `https://generativelanguage.googleapis.com/v1/${modelName}:batchEmbedContents?key=${apiKey}`;
}

function buildGeminiBody(texts: string[], taskType: EmbeddingTaskType, includeAdvancedFields: boolean) {
  const { model, dimensions } = getGeminiEnv();
  const modelName = model.startsWith("models/") ? model : `models/${model}`;
  return {
    requests: texts.map((text) => ({
      model: modelName,
      content: { parts: [{ text }] },
      ...(includeAdvancedFields ? { taskType, outputDimensionality: dimensions } : {})
    }))
  };
}

type GeminiError = { error?: { code?: number; details?: Array<{ retryDelay?: string; quotaId?: string }> } };

async function callGeminiBatch(
  texts: string[],
  taskType: EmbeddingTaskType,
  includeAdvancedFields: boolean,
  retries = 3
): Promise<number[][] | "daily_quota_exceeded"> {
  const { model } = getGeminiEnv();
  const response = await fetch(geminiEmbeddingUrl(model), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiBody(texts, taskType, includeAdvancedFields))
  });

  if (response.status === 429) {
    const errorJson = await response.json().catch(() => ({})) as GeminiError;
    const details = errorJson?.error?.details ?? [];
    const isDailyQuota = details.some(
      (d) => d.quotaId?.toLowerCase().includes("perday")
    );

    if (isDailyQuota) return "daily_quota_exceeded";

    if (retries > 0) {
      const retryDelayStr = details.find((d) => d.retryDelay)?.retryDelay ?? "30s";
      const delaySec = parseInt(retryDelayStr) + 5;
      console.log(`  Rate limited — waiting ${delaySec}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
      return callGeminiBatch(texts, taskType, includeAdvancedFields, retries - 1);
    }

    return "daily_quota_exceeded";
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini embeddings failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as GeminiBatchResponse;
  const embeddings = json.embeddings?.map((e) => e.values) ?? [];
  if (embeddings.length !== texts.length) throw new Error("Gemini returned unexpected embedding count.");
  return embeddings;
}

// ── Jina AI fallback ─────────────────────────────────────────────────────────

type JinaResponse = { data?: Array<{ embedding: number[]; index: number }> };

async function callOpenRouterEmbeddingBatch(
  texts: string[],
  _taskType: EmbeddingTaskType,
  retries = 4
): Promise<number[][]> {
  const { apiKey, siteUrl, appName } = getOpenRouterEnv();
  const { dimensions } = getGeminiEnv();
  const model =
    process.env.OPENROUTER_EMBEDDING_MODEL || "google/gemini-embedding-2-preview";

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": appName
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions,
      encoding_format: "float"
    })
  });

  if ((response.status === 429 || response.status === 529) && retries > 0) {
    const delayMs = response.status === 429 ? 65_000 : 15_000;
    console.log(`  OpenRouter embeddings limited (${response.status}) - waiting ${delayMs / 1000}s before retry...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return callOpenRouterEmbeddingBatch(texts, _taskType, retries - 1);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenRouter embeddings failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as OpenRouterEmbeddingResponse;
  const sorted = (json.data ?? [])
    .map((item, index) => ({ ...item, index: item.index ?? index }))
    .sort((a, b) => a.index - b.index);

  if (sorted.length !== texts.length) {
    throw new Error("OpenRouter returned unexpected embedding count.");
  }

  const vectors = sorted.map((item) => item.embedding);
  const invalid = vectors.find((vector) => vector.length !== dimensions);
  if (invalid) {
    throw new Error(
      `OpenRouter returned ${invalid.length} dimensions, but EMBEDDING_DIMENSIONS is ${dimensions}.`
    );
  }

  return vectors;
}

async function callJinaBatch(
  texts: string[],
  taskType: EmbeddingTaskType,
  retries = 4
): Promise<number[][]> {
  const apiKey = getJinaApiKey();
  if (!apiKey) throw new Error("JINA_API_KEY is not set — cannot fall back to Jina embeddings.");

  const { dimensions } = getGeminiEnv();
  const task = taskType === "RETRIEVAL_QUERY" ? "retrieval.query" : "retrieval.passage";

  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      input: texts,
      dimensions,
      task
    })
  });

  if (response.status === 429 && retries > 0) {
    console.log("  Jina rate limited — waiting 65s before retry...");
    await new Promise((resolve) => setTimeout(resolve, 65_000));
    return callJinaBatch(texts, taskType, retries - 1);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Jina embeddings failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as JinaResponse;
  const sorted = (json.data ?? []).sort((a, b) => a.index - b.index);
  if (sorted.length !== texts.length) throw new Error("Jina returned unexpected embedding count.");
  return sorted.map((e) => e.embedding);
}

// ── Public API ────────────────────────────────────────────────────────────────

// Session-level flag: once Gemini's daily quota is hit, skip it for the rest of this process.
let geminiDailyQuotaExhausted = false;

export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (process.env.EMBEDDING_PROVIDER?.toLowerCase() === "openrouter") {
    return callOpenRouterEmbeddingBatch(texts, taskType);
  }

  if (process.env.EMBEDDING_PROVIDER?.toLowerCase() === "jina") {
    return callJinaBatch(texts, taskType);
  }

  if (!geminiDailyQuotaExhausted) {
    // Try Gemini with advanced fields (taskType + outputDimensionality)
    let result = await callGeminiBatch(texts, taskType, true).catch(() => "daily_quota_exceeded" as const);
    if (result !== "daily_quota_exceeded") return result;

    // Try once without advanced fields (some models don't support them) — no extra retries
    result = await callGeminiBatch(texts, taskType, false, 0).catch(() => "daily_quota_exceeded" as const);
    if (result !== "daily_quota_exceeded") return result;

    // Quota exhausted — remember this for all subsequent batches in this run
    geminiDailyQuotaExhausted = true;
    console.log("  Gemini daily quota exhausted — using Jina AI for all remaining batches.");
  }

  return callJinaBatch(texts, taskType);
}

export async function embedQuery(text: string) {
  const [embedding] = await embedTexts([text], "RETRIEVAL_QUERY");
  return embedding;
}

export async function embedDocumentsInBatches(
  texts: string[],
  batchSize = 16,
  onBatch?: (completed: number, total: number) => void
) {
  const all: number[][] = [];
  const provider = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  const effectiveBatchSize =
    provider === "jina" || provider === "openrouter" ? Math.min(batchSize, 8) : batchSize;

  for (let index = 0; index < texts.length; index += effectiveBatchSize) {
    const batch = texts.slice(index, index + effectiveBatchSize);
    const vectors = await embedTexts(batch, "RETRIEVAL_DOCUMENT");
    all.push(...vectors);
    onBatch?.(all.length, texts.length);
  }
  return all;
}
