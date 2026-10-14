-- NomClock initial schema
-- Every table is protected by row-level security: a user can only ever read or
-- write their own rows. Photos live in a private bucket under <user_id>/...

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  birth_date    date not null,
  sex           text not null check (sex in ('male','female')),
  height_cm     numeric(5,1) not null check (height_cm between 100 and 250),
  weight_kg     numeric(5,1) not null check (weight_kg between 30 and 300),
  activity      text not null default 'light'
                check (activity in ('sedentary','light','moderate','active','very_active')),
  goal          text not null default 'maintain' check (goal in ('lose','maintain','gain')),
  diet          text not null default 'omnivore'
                check (diet in ('omnivore','vegetarian','eggetarian','vegan','pescatarian','jain','keto')),
  budget        text not null default 'medium' check (budget in ('low','medium','high')),
  tastes        text[] not null default '{}',
  avoid         text[] not null default '{}',
  country       text not null default 'CA',
  region        text,
  timezone      text not null default 'America/Vancouver',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint adult check (birth_date <= (current_date - interval '18 years'))
);

-- Weight history so charts can show progress.
create table public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_on  date not null,
  weight_kg  numeric(5,1) not null check (weight_kg between 30 and 300),
  unique (user_id, logged_on)
);

-- ───────────────────────── meals ─────────────────────────
create table public.meals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_at         timestamptz not null default now(),
  slot             text not null default 'snack' check (slot in ('breakfast','lunch','dinner','snack')),
  photo_path       text,
  note             text,
  analysis_status  text not null default 'pending'
                   check (analysis_status in ('pending','processing','done','failed','manual')),
  analysis_error   text,
  ai_notes         text,
  created_at       timestamptz not null default now()
);
create index meals_user_time on public.meals (user_id, eaten_at desc);

create table public.meal_items (
  id             uuid primary key default gen_random_uuid(),
  meal_id        uuid not null references public.meals(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  portion_grams  numeric(7,1) not null check (portion_grams >= 0),
  portion_label  text,
  -- Nutrients for this portion: { kcal, protein, carbs, fat, fiber, ..., folate }
  nutrients      jsonb not null default '{}'::jsonb,
  source         text not null default 'manual' check (source in ('usda','cnf','ai_estimate','manual')),
  source_ref     text,
  confidence     numeric(3,2),
  created_at     timestamptz not null default now()
);
create index meal_items_meal on public.meal_items (meal_id);
create index meal_items_user on public.meal_items (user_id);

-- ───────────────────────── daily totals view ─────────────────────────
-- Grouped by the user's own local date. security_invoker makes RLS apply.
create view public.daily_totals with (security_invoker = true) as
select
  m.user_id,
  (m.eaten_at at time zone p.timezone)::date as day,
  count(distinct m.id)                                   as meals,
  coalesce(sum((i.nutrients->>'kcal')::numeric), 0)      as kcal,
  coalesce(sum((i.nutrients->>'protein')::numeric), 0)   as protein,
  coalesce(sum((i.nutrients->>'carbs')::numeric), 0)     as carbs,
  coalesce(sum((i.nutrients->>'fat')::numeric), 0)       as fat,
  coalesce(sum((i.nutrients->>'fiber')::numeric), 0)     as fiber,
  coalesce(sum((i.nutrients->>'sugar')::numeric), 0)     as sugar,
  coalesce(sum((i.nutrients->>'sodium')::numeric), 0)    as sodium
from public.meals m
join public.profiles p on p.id = m.user_id
left join public.meal_items i on i.meal_id = m.id
group by m.user_id, day;

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles    enable row level security;
alter table public.weight_logs enable row level security;
alter table public.meals       enable row level security;
alter table public.meal_items  enable row level security;

create policy "own profile" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own weights" on public.weight_logs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own meals" on public.meals
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own items" on public.meal_items
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid()))
  );

-- ───────────────────────── storage ─────────────────────────
-- Private bucket: photos are only reachable through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "read own photos" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "upload own photos" on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "update own photos" on storage.objects for update
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own photos" on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ───────────────────────── housekeeping ─────────────────────────
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
