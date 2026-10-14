-- In-app ideas and feedback.
-- Users submit privately. Admins triage, reply, and can publish an idea to the
-- public ideas board, where any signed-in user can upvote it.

-- ───────────────────────── admins ─────────────────────────
-- Add yourself with: insert into public.admins(user_id) values ('<your auth user id>');
-- (run in the Supabase SQL editor; there is deliberately no API path to become admin)
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;  -- no policies: invisible to clients

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ───────────────────────── feedback ─────────────────────────
create table public.feedback (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind             text not null check (kind in ('feature', 'improvement', 'bug', 'other')),
  area             text not null default 'other'
                   check (area in ('today', 'photo', 'history', 'coach', 'trends', 'profile', 'design', 'other')),
  title            text not null check (char_length(title) between 3 and 120),
  details          text not null default '' check (char_length(details) <= 2000),
  screenshot_path  text,
  platform         text check (platform in ('web', 'ios', 'android')),
  app_version      text,
  status           text not null default 'new'
                   check (status in ('new', 'under_review', 'planned', 'in_progress', 'done', 'declined')),
  admin_note       text check (char_length(admin_note) <= 1000),
  is_public        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index feedback_user on public.feedback (user_id, created_at desc);
create index feedback_status on public.feedback (status, created_at desc);

create table public.feedback_votes (
  feedback_id  uuid not null references public.feedback(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

alter table public.feedback enable row level security;
alter table public.feedback_votes enable row level security;

-- Users: submit (status/reply/visibility are admin-only; max 10 per day), read own, delete own while still new.
create policy "submit feedback" on public.feedback for insert with check (
  user_id = auth.uid()
  and status = 'new' and admin_note is null and is_public = false
  and (select count(*) from public.feedback f where f.user_id = auth.uid() and f.created_at > now() - interval '1 day') < 10
);
create policy "read own feedback" on public.feedback for select using (user_id = auth.uid());
create policy "delete own new feedback" on public.feedback for delete using (user_id = auth.uid() and status = 'new');

-- Admins: read and triage everything.
create policy "admins read feedback" on public.feedback for select using (public.is_admin());
create policy "admins triage feedback" on public.feedback for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete feedback" on public.feedback for delete using (public.is_admin());

-- Votes: only on public ideas, one per user, removable.
create policy "read own votes" on public.feedback_votes for select using (user_id = auth.uid());
create policy "vote on public ideas" on public.feedback_votes for insert with check (
  user_id = auth.uid() and exists (select 1 from public.feedback f where f.id = feedback_id and f.is_public)
);
create policy "remove own vote" on public.feedback_votes for delete using (user_id = auth.uid());

create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_updated_at();

-- Public board: only the fields that are safe to show, never who submitted.
create function public.ideas_board()
returns table (
  id uuid, kind text, area text, title text, details text, status text, admin_note text,
  created_at timestamptz, votes bigint, my_vote boolean, mine boolean
)
language sql stable security definer set search_path = public as $$
  select f.id, f.kind, f.area, f.title, f.details, f.status, f.admin_note, f.created_at,
         (select count(*) from public.feedback_votes v where v.feedback_id = f.id),
         exists (select 1 from public.feedback_votes v where v.feedback_id = f.id and v.user_id = auth.uid()),
         f.user_id = auth.uid()
  from public.feedback f
  where f.is_public and auth.uid() is not null
  order by 9 desc, f.created_at desc
  limit 200;
$$;
revoke execute on function public.ideas_board() from anon;

-- Admin list with vote counts.
create function public.admin_feedback(status_filter text default null)
returns table (
  id uuid, user_id uuid, kind text, area text, title text, details text, screenshot_path text, platform text,
  app_version text, status text, admin_note text, is_public boolean, created_at timestamptz, votes bigint
)
language sql stable security definer set search_path = public as $$
  select f.id, f.user_id, f.kind, f.area, f.title, f.details, f.screenshot_path, f.platform, f.app_version,
         f.status, f.admin_note, f.is_public, f.created_at,
         (select count(*) from public.feedback_votes v where v.feedback_id = f.id)
  from public.feedback f
  where public.is_admin() and (status_filter is null or f.status = status_filter)
  order by f.created_at desc
  limit 500;
$$;
revoke execute on function public.admin_feedback(text) from anon;

-- Screenshots live in the private photo bucket under <user_id>/feedback/…;
-- the owner's existing folder policies cover upload, and admins may read them.
create policy "admins read feedback screenshots" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = 'feedback' and public.is_admin());
