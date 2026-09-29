/* #129 follow-up: the engine (service_role) must be able to call the
   weekly-digest RPC; admin functions were only granted to authenticated. */
grant execute on function public.admin_apply_weekly_digest() to service_role;
