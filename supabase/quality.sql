/* ------------------------------------------------------------------ */
/* Content Quality Center                                              */
/* ------------------------------------------------------------------ */
/* Adds the tables/RPCs behind the admin dashboard's Quality section:
 *   question_feedback     — 👍/👎/🚩 votes on model answers (any user,
 *                           signed in or not — matches the no-account ethos)
 *   updated_at on
 *     published_questions — staleness tracking (last edit/review)
 *   admin_question_quality— per-question scoreboard (attempts, avg score,
 *                           miss/pass rate, feedback, last seen)
 *   admin_feedback_feed   — recent raw feedback rows
 *   touch_question        — mark a question as reviewed (bumps staleness)
 *
 * The composite quality score itself is computed client-side (quality.ts)
 * from the fields this RPC returns, so it stays unit-testable.
 */

create table if not exists public.question_feedback (
  id bigint generated always as identity primary key,
  user_id uuid,                                   /* null for anonymous users */
  question text not null,
  field_id text,
  level text,
  kind text not null check (kind in ('up', 'down', 'flag')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.question_feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'question_feedback' and policyname = 'feedback public insert') then
    create policy "feedback public insert" on public.question_feedback for insert
      with check (user_id is null or user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'question_feedback' and policyname = 'feedback admin read') then
    create policy "feedback admin read" on public.question_feedback for select
      using (public.is_admin());
  end if;
end $$;

/* staleness: when was this question last edited or marked reviewed? */
alter table public.published_questions add column if not exists updated_at timestamptz not null default now();

/* Auto-bump updated_at on any content change, but only content changes —
   the audit trigger must skip pure updated_at touches so "mark reviewed"
   doesn't spam the activity log with empty diffs. */
create or replace function public.log_question_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act text; qid bigint; f text; l text; q text; d jsonb; actor_email text;
begin
  actor_email := coalesce(nullif(auth.jwt() ->> 'email', ''), 'system');
  if tg_op = 'INSERT' then
    act := 'create'; qid := new.id; f := new.field_id; l := new.level; q := new.question;
    d := jsonb_build_object('published', new.published);
  elsif tg_op = 'UPDATE' then
    /* only updated_at changed (a "mark reviewed" touch) → not a content edit */
    if old.field_id = new.field_id and old.level = new.level and old.question = new.question
       and old.answer = new.answer and old.key_points = new.key_points and old.published = new.published then
      return new;
    end if;
    act := 'update'; qid := new.id; f := new.field_id; l := new.level; q := new.question;
    d := jsonb_build_object(
      'before', jsonb_build_object('field_id', old.field_id, 'level', old.level, 'question', old.question, 'answer', old.answer, 'key_points', old.key_points, 'published', old.published),
      'after',  jsonb_build_object('field_id', new.field_id, 'level', new.level, 'question', new.question, 'answer', new.answer, 'key_points', new.key_points, 'published', new.published)
    );
  else
    act := 'delete'; qid := old.id; f := old.field_id; l := old.level; q := old.question;
    d := jsonb_build_object(
      'row', jsonb_build_object('field_id', old.field_id, 'level', old.level, 'question', old.question, 'answer', old.answer, 'key_points', old.key_points, 'published', old.published)
    );
  end if;
  insert into public.question_audit (question_id, action, field_id, level, question, actor, diff)
  values (qid, act, f, l, q, actor_email, d);
  return coalesce(new, old);
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists question_updated_at_trg on public.published_questions;
create trigger question_updated_at_trg
  before update on public.published_questions
  for each row execute function public.touch_updated_at();

drop trigger if exists question_audit_trg on public.published_questions;
create trigger question_audit_trg
  after insert or update or delete on public.published_questions
  for each row execute function public.log_question_audit();

/* Per-question scoreboard: aggregates every scored answer (from
   session_answers events) plus 👍/👎/🚩 feedback. The client merges
   staleness from published_questions and computes the composite score. */
create or replace function public.admin_question_quality(max_rows integer default 300)
returns table (
  question text, field_id text, level text,
  attempts bigint, avg_score double precision, miss_rate double precision, pass_rate double precision,
  ups bigint, downs bigint, flags bigint, last_seen timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with flattened as (
      select e.meta->>'fieldId' as field_id,
             e.meta->>'levelId' as level,
             x.value->>'q' as question,
             (x.value->>'score')::numeric as score,
             e.created_at
      from public.usage_events e
      cross join lateral jsonb_array_elements(e.meta->'items') as x(value)
      where e.kind = 'session_answers'
    ),
    perf as (
      select f.question,
             min(f.field_id) as field_id,
             min(f.level) as level,
             count(*) as attempts,
             round(avg(f.score)::numeric, 1) as avg_score,
             round(100.0 * count(*) filter (where f.score <= 2) / nullif(count(*), 0), 1) as miss_rate,
             round(100.0 * count(*) filter (where f.score >= 3) / nullif(count(*), 0), 1) as pass_rate,
             max(f.created_at) as last_seen
      from flattened f
      where f.question is not null and f.question <> ''
      group by f.question
    ),
    fb as (
      select question,
             count(*) filter (where kind = 'up') as ups,
             count(*) filter (where kind = 'down') as downs,
             count(*) filter (where kind = 'flag') as flags
      from public.question_feedback
      group by question
    )
    select p.question, p.field_id, p.level, p.attempts, p.avg_score, p.miss_rate, p.pass_rate,
           coalesce(fb.ups, 0), coalesce(fb.downs, 0), coalesce(fb.flags, 0), p.last_seen
    from perf p
    left join fb on fb.question = p.question
    order by p.attempts desc
    limit max_rows;
end $$;

/* Recent raw feedback rows (admin review surface). */
create or replace function public.admin_feedback_feed(max_rows integer default 50)
returns table (question text, field_id text, level text, kind text, reason text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select f.question, f.field_id, f.level, f.kind, f.reason, f.created_at
    from public.question_feedback f
    order by f.created_at desc
    limit max_rows;
end $$;

/* Mark a question as reviewed — bumps updated_at (staleness clock restarts)
   and logs a 'refresh' audit entry. */
create or replace function public.touch_question(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select field_id, level, question into r from public.published_questions where id = p_id;
  if not found then raise exception 'question not found'; end if;
  update public.published_questions set updated_at = now() where id = p_id;
  insert into public.question_audit (question_id, action, field_id, level, question, actor, diff)
  values (p_id, 'refresh', r.field_id, r.level, r.question,
          coalesce(nullif(auth.jwt() ->> 'email', ''), 'admin'),
          jsonb_build_object('note', 'reviewed'));
end $$;

/* Coding scoreboard — pass rate per playground problem from coding_attempt
   events (queued by src/services/codingTrack.ts on every full-suite run). */
create or replace function public.admin_coding_quality(max_rows integer default 200)
returns table (
  problem_id text, attempts bigint, passes bigint, pass_rate double precision,
  last_seen timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select e.meta->>'problemId' as problem_id,
           count(*) as attempts,
           count(*) filter (where (e.meta->>'passed')::boolean) as passes,
           round(100.0 * count(*) filter (where (e.meta->>'passed')::boolean) / nullif(count(*), 0), 1) as pass_rate,
           max(e.created_at) as last_seen
    from public.usage_events e
    where e.kind = 'coding_attempt' and e.meta->>'problemId' is not null
    group by e.meta->>'problemId'
    order by attempts desc
    limit max_rows;
end $$;

/* Coach gap scoreboard — weak coding topics most debated in saved AI-coach
   discussions across all users (queued by src/components/CoachChat.tsx as
   coach_discussion events with meta.topics). */
create or replace function public.admin_coach_gaps(max_rows integer default 50)
returns table (topic text, discussions bigint, users bigint, last_seen timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select t.topic as topic,
           count(*) as discussions,
           count(distinct e.user_id) as users,
           max(e.created_at) as last_seen
    from public.usage_events e
    cross join lateral jsonb_array_elements_text(coalesce(e.meta->'topics', '[]'::jsonb)) as t(topic)
    where e.kind = 'coach_discussion'
    group by t.topic
    order by discussions desc, users desc
    limit max_rows;
end $$;
