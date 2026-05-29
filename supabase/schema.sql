create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists public.classes (
  id text primary key check (id in ('grade1', 'grade2', 'grade3')),
  name_ar text not null,
  sort_order integer not null unique
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  grade text references public.classes(id),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  grade text not null references public.classes(id),
  cover_image text,
  pdf_url text,
  source_file text,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null,
  chapter_number integer,
  unique (book_id, title)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chunk_text text not null,
  embedding vector(768) not null,
  page_number integer,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(chunk_text, ''))) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  book_id uuid references public.books(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  choices jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  difficulty text not null default 'medium',
  created_at timestamptz not null default now()
);

create table if not exists public.study_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  completed_lessons integer not null default 0,
  total_lessons integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_number integer,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'محادثة تعليمية',
  selected_book_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete set null,
  source_file text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  processed_chunks integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_grade_idx on public.books(grade);
create index if not exists books_subject_idx on public.books(subject);
create index if not exists documents_book_id_idx on public.documents(book_id);
create index if not exists documents_search_vector_idx on public.documents using gin(search_vector);
create index if not exists documents_embedding_idx on public.documents using hnsw (embedding vector_cosine_ops);
create index if not exists chat_messages_session_id_idx on public.chat_messages(session_id, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_progress_touch_updated_at on public.study_progress;
create trigger study_progress_touch_updated_at
before update on public.study_progress
for each row execute function public.touch_updated_at();

drop trigger if exists chat_sessions_touch_updated_at on public.chat_sessions;
create trigger chat_sessions_touch_updated_at
before update on public.chat_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists ingestion_jobs_touch_updated_at on public.ingestion_jobs;
create trigger ingestion_jobs_touch_updated_at
before update on public.ingestion_jobs
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, grade)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'grade', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if
    new.role is distinct from old.role
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin()
  then
    raise exception 'Only admins can change profile roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

create or replace function public.match_documents(
  query_embedding vector(768),
  query_text text,
  selected_book_ids uuid[],
  match_count integer default 8
)
returns table (
  id uuid,
  book_id uuid,
  chunk_text text,
  page_number integer,
  metadata jsonb,
  score double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select
      d.id,
      d.book_id,
      d.chunk_text,
      d.page_number,
      d.metadata,
      1 - (d.embedding <=> query_embedding) as vector_score,
      ts_rank_cd(d.search_vector, plainto_tsquery('simple', query_text)) as text_score
    from public.documents d
    where d.book_id = any(selected_book_ids)
  )
  select
    candidates.id,
    candidates.book_id,
    candidates.chunk_text,
    candidates.page_number,
    candidates.metadata,
    (
      candidates.vector_score * 0.78 +
      least(coalesce(candidates.text_score, 0), 1) * 0.22
    )::double precision as score
  from candidates
  order by score desc
  limit greatest(match_count, 1);
$$;

alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.documents enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.study_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ingestion_jobs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "classes are readable" on public.classes;
create policy "classes are readable" on public.classes
for select using (true);

drop policy if exists "subjects are readable" on public.subjects;
create policy "subjects are readable" on public.subjects
for select using (true);

drop policy if exists "admins manage subjects" on public.subjects;
create policy "admins manage subjects" on public.subjects
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "books are readable" on public.books;
create policy "books are readable" on public.books
for select using (true);

drop policy if exists "admins manage books" on public.books;
create policy "admins manage books" on public.books
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chapters are readable" on public.chapters;
create policy "chapters are readable" on public.chapters
for select using (true);

drop policy if exists "admins manage chapters" on public.chapters;
create policy "admins manage chapters" on public.chapters
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "documents readable to authenticated users" on public.documents;
create policy "documents readable to authenticated users" on public.documents
for select to authenticated using (true);

drop policy if exists "admins manage documents" on public.documents;
create policy "admins manage documents" on public.documents
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users manage own flashcards" on public.flashcards;
create policy "users manage own flashcards" on public.flashcards
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own quizzes" on public.quizzes;
create policy "users manage own quizzes" on public.quizzes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own quiz questions" on public.quiz_questions;
create policy "users read own quiz questions" on public.quiz_questions
for select using (
  exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.user_id = auth.uid()
  )
);

drop policy if exists "users insert own quiz questions" on public.quiz_questions;
create policy "users insert own quiz questions" on public.quiz_questions
for insert with check (
  exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.user_id = auth.uid()
  )
);

drop policy if exists "users manage own progress" on public.study_progress;
create policy "users manage own progress" on public.study_progress
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own bookmarks" on public.bookmarks;
create policy "users manage own bookmarks" on public.bookmarks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own chat sessions" on public.chat_sessions;
create policy "users manage own chat sessions" on public.chat_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own chat messages" on public.chat_messages;
create policy "users manage own chat messages" on public.chat_messages
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admins manage ingestion jobs" on public.ingestion_jobs;
create policy "admins manage ingestion jobs" on public.ingestion_jobs
for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', true, 104857600, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "book pdfs are readable" on storage.objects;
create policy "book pdfs are readable" on storage.objects
for select using (bucket_id = 'books');

drop policy if exists "admins manage book pdfs" on storage.objects;
create policy "admins manage book pdfs" on storage.objects
for all using (bucket_id = 'books' and public.is_admin())
with check (bucket_id = 'books' and public.is_admin());
