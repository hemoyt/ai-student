export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function hasSupabasePublicEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new ConfigError(
      "Supabase public environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return { url, anonKey };
}

export function getSupabaseServiceEnv() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) {
    throw new ConfigError(
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required for this operation."
    );
  }

  return { url, serviceRoleKey };
}

export function getOpenRouterEnv() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new ConfigError("OPENROUTER_API_KEY is required for AI generation.");
  }

  return {
    apiKey,
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || "deepseek/deepseek-chat",
    siteUrl: process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    appName: process.env.OPENROUTER_APP_NAME || "Sudan Middle School AI"
  };
}

export function getGeminiEnv() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ConfigError("GEMINI_API_KEY is required for embeddings.");
  }

  return {
    apiKey,
    model: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS || 768)
  };
}

export function getJinaApiKey() {
  return process.env.JINA_API_KEY ?? null;
}

export function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "books";
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getRateLimitPerMinute() {
  return Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 12);
}

export function getMaxUploadBytes() {
  return Number(process.env.MAX_UPLOAD_MB || 100) * 1024 * 1024;
}
