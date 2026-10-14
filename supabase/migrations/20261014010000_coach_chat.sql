-- Coach chat history. Kept so the coach remembers recent context across sessions;
-- users can clear it any time, and it's deleted with the account.
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) <= 4000),
  -- For assistant turns: { options: [...], tip: "..." } so cards can be re-rendered.
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index chat_messages_user_time on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

-- Users read and delete their own history. Inserts happen only in the coach-chat
-- function, so a client can't plant fake "assistant" turns into its context.
create policy "read own chat" on public.chat_messages for select using (user_id = auth.uid());
create policy "delete own chat" on public.chat_messages for delete using (user_id = auth.uid());
