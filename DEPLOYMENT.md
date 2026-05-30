# Deployment Guide

This app deploys as a Next.js 15 project on Vercel with Supabase for Auth, PostgreSQL, pgvector, and Storage. Keep local PDFs and generated QA files out of Vercel; production reads books from Supabase Storage and vectors from `documents`.

## 1. Supabase Setup

1. Create a Supabase project.
2. Enable the `vector` extension. The schema also runs `create extension if not exists "vector";`.
3. Run the schema and seed SQL:

```bash
npm install
npm run db:setup
```

If you prefer the Supabase SQL editor, run `supabase/schema.sql` first, then `supabase/seed.sql`.

4. Confirm the public Storage bucket exists:

```text
books
```

5. Create the production admin user in Supabase Auth.
6. Add the admin email to `ADMIN_EMAILS`, or mark the profile as admin:

```sql
update public.profiles
set role = 'admin'
where id = '<auth-user-id>';
```

## 2. Environment Variables

Add these values in Vercel Project Settings -> Environment Variables. Do not expose server-only keys in client code.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_STORAGE_BUCKET=books
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=deepseek/deepseek-chat
OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2-preview
OPENROUTER_SITE_URL=https://your-production-domain.com
OPENROUTER_APP_NAME=Sudan Middle School AI
EMBEDDING_PROVIDER=openrouter
EMBEDDING_DIMENSIONS=768
ADMIN_EMAILS=
AI_RATE_LIMIT_PER_MINUTE=12
MAX_UPLOAD_MB=100
```

Use either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`.

## 3. Curriculum Ingestion

Run full PDF ingestion locally or in a worker, not inside Vercel serverless functions. The admin reprocess API is intended for small or individual jobs.

```bash
npm run seed:books
npm run sync:mdl
npm run curate:mdl
npm run ingest:mdl
```

Use force mode only when you intentionally want to re-embed the corpus:

```bash
npm run ingest:mdl:force
```

After ingestion, confirm the admin panel shows completed jobs and that the library displays books for each class.

## 4. Predeploy Verification

Run the full local gate before deploying:

```bash
npm run deploy:verify
```

This runs:

- TypeScript checks
- ESLint
- Supabase/data/storage/RPC validation
- Next.js production build

For a faster environment-only check:

```bash
npm run deploy:check
```

The check masks secrets and prints only pass/warn/fail status.

## 5. Vercel Deployment

1. Import the repository into Vercel.
2. Set the environment variables above for Production and Preview.
3. Deploy with the default Vercel Next.js builder.
4. After the deployment finishes, open:

```text
https://your-production-domain.com/api/health
```

Expected healthy response:

```json
{
  "ok": true,
  "status": "ok"
}
```

If it returns `degraded`, check the response details for missing curriculum chunks, storage bucket access, or AI environment variables.

## 6. Production Smoke Test

After deployment:

1. Sign in as the admin user.
2. Open `/admin` and confirm books, ingestion jobs, and users load.
3. Open `/library`, choose a grade, and select one or more books.
4. Ask a textbook question in `/study`.
5. Generate flashcards and MCQs.
6. Confirm previous chats, flashcards, and quiz history appear for the same user.

## 7. Model Switching

Change `OPENROUTER_DEFAULT_MODEL` to any model available in OpenRouter:

- `deepseek/deepseek-chat`
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4o-mini`
- `google/gemini-flash-1.5`
- `qwen/qwen-2.5-72b-instruct`

Chat access is centralized in `lib/ai/openrouter.ts`.

## 8. Embeddings

Production default:

```bash
EMBEDDING_PROVIDER=openrouter
OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2-preview
EMBEDDING_DIMENSIONS=768
```

If you switch to a model with a different vector size, update `documents.embedding vector(768)` and the `match_documents` argument in `supabase/schema.sql`, then re-ingest all books.

## 9. Security Checklist

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY`, and `GEMINI_API_KEY` server-only.
- Confirm RLS policies are enabled in Supabase.
- Set `ADMIN_EMAILS` only to trusted admin accounts.
- Keep `AI_RATE_LIMIT_PER_MINUTE` conservative for student use.
- Validate every upload by MIME type and file size.
- Rotate keys after sharing them in chat, screenshots, or logs.
- Keep `.env.local` out of Git and Vercel uploads.

## 10. Operational Notes

- `.vercelignore` excludes the root `/books/`, `/deliverables/`, and `/qa-artifacts/` directories from deployment while preserving app routes such as `app/api/books`.
- Supabase should be the source of truth for PDFs and vector chunks.
- Large scanned PDFs may need OCR before ingestion; text-only extraction cannot create useful chunks from image-only pages.
- Back up Supabase before large reprocessing runs.
- Use `/api/health` as the first check after every deploy.
