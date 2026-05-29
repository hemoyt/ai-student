# Sudan Middle School AI Learning Platform

Arabic-first AI learning platform for Sudan middle school students. Students choose a grade, select one or more curriculum books, and ask grounded AI questions or generate study material using RAG over the selected textbooks only.

## Stack

- Next.js 15, TypeScript, TailwindCSS, shadcn-style UI primitives, Framer Motion
- Supabase Auth, PostgreSQL, Storage, pgvector
- OpenRouter chat completion with switchable models
- OpenRouter embeddings using `google/gemini-embedding-2-preview` by default, with Gemini API/Jina fallbacks
- PDF ingestion with `pdf-parse` and LangChain recursive text splitter

## Main Features

- Email/password authentication and student profile
- Grade selection for first, second, and third Sudan middle school classes
- Book library with search, grade filters, PDF open links, and multi-book selection
- RAG chat constrained to selected book IDs
- Flashcards, MCQ, exams, summaries, key points, notes, and Q/A drills
- Saved chats, saved flashcards, quiz records, progress, bookmarks, and printable flashcard export
- Admin upload, reprocess embeddings, and ingestion status
- RTL Arabic UI, dark mode, responsive layout

## Environment

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Or use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for newer Supabase projects.
SUPABASE_SERVICE_ROLE_KEY=
# Or use SUPABASE_SECRET_KEY for newer Supabase projects.
SUPABASE_STORAGE_BUCKET=books

OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=deepseek/deepseek-chat
OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2-preview
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Sudan Middle School AI

EMBEDDING_PROVIDER=openrouter
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768

ADMIN_EMAILS=admin@example.com
AI_RATE_LIMIT_PER_MINUTE=12
MAX_UPLOAD_MB=100
```

## Database Setup

1. Create a Supabase project.
2. In SQL editor, run `supabase/schema.sql`.
3. Run `supabase/seed.sql`.
4. Create the first admin user in Supabase Auth, then either:
   - set `ADMIN_EMAILS` to that email, or
   - update `public.profiles.role = 'admin'` for that user.

The schema creates the `books` storage bucket, vector indexes, RLS policies, and `match_documents` hybrid retrieval RPC.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deployment Readiness

Before deploying to Vercel, run:

```bash
npm run deploy:verify
```

This runs TypeScript, linting, the Supabase/data/storage/RPC readiness check, and the production Next.js build. After deployment, verify:

```text
https://your-domain.com/api/health
```

See `DEPLOYMENT.md` for the full production checklist.

## Ingest Books

Place PDFs in `./books/`, then run:

```bash
npm run seed:books
npm run sync:mdl
npm run ingest:mdl
npm run ingest:books
```

If you want the project to apply the schema from the command line, add a Supabase
Postgres connection string as `DATABASE_URL` and run:

```bash
npm run db:setup
```

The ingestion script:

1. scans all PDFs in `books/`
2. reads the first page
3. detects grade, subject, and title
4. renames files as `grade_subject_book.pdf`
5. uploads PDFs to Supabase Storage
6. extracts and cleans page text
7. chunks with size `1200` and overlap `200`
8. embeds with OpenRouter Gemini Embedding 2 Preview when `EMBEDDING_PROVIDER=openrouter`
9. writes vectors and metadata to `documents`

## RAG Guarantee

The chat API embeds the student question, calls `match_documents` with only the selected book IDs, builds the context, and sends this system prompt to OpenRouter:

```text
You are an educational AI assistant for Sudan middle school students.
Answer ONLY from provided textbook context.
If answer is not in context, say:
'المعلومة غير موجودة في الكتاب المحدد.'
Use simple Arabic.
Explain step-by-step.
Be educational and concise.
```

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run deploy:check
npm run deploy:verify
npm run sync:mdl
npm run seed:books
npm run ingest:mdl
npm run ingest:books
```

## Important Files

- `app/api/rag/chat/route.ts` streaming grounded chat API
- `app/api/study/generate/route.ts` study material generator
- `scripts/ingest-books.ts` production ingestion pipeline
- `scripts/sync-mdl-intermediate.ts` official MDL intermediate PDF sync
- `lib/ai/openrouter.ts` OpenRouter provider abstraction
- `lib/ai/embeddings.ts` embedding provider service
- `lib/rag/retriever.ts` selected-book retrieval
- `supabase/schema.sql` database, RLS, vector RPC, storage policies
