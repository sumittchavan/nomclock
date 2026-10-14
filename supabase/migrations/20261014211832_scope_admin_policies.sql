-- is_admin() is only executable by signed-in users, so scope every policy that calls it
-- to the authenticated role; anonymous requests then simply see nothing instead of erroring.
alter policy "admins read feedback screenshots" on storage.objects to authenticated;
alter policy "admins read feedback" on public.feedback to authenticated;
alter policy "admins triage feedback" on public.feedback to authenticated;
alter policy "admins delete feedback" on public.feedback to authenticated;
