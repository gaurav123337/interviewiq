/* Fix: the live DB is missing public.is_owner() (admin.sql was never fully
   applied), so is_admin() — and every admin-gated RPC that calls it, e.g.
   admin_set_entitlement — fails with "function public.is_owner() does not
   exist". Recreate both exactly as admin.sql defines them. */

create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public as $$
  select auth.jwt() ->> 'email' = 'gaurav.123337@gmail.com'
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.app_admins where email = auth.jwt() ->> 'email'
  )
$$;

revoke execute on function public.is_owner() from anon, public;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_admin() to authenticated, service_role;
