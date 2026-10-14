-- Security advisor: is_admin() should not be callable by anonymous visitors.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
