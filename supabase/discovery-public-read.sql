/* ================================================================== */
/*  Phase 4 Item D4 — public credits surface                           */
/*                                                                     */
/*  discovery_seeds / discovered_resources (supabase/discovery.sql,    */
/*  applied with D3) are admin-only via RLS. The "Sources & credits"   */
/*  page and the Skill Counselor's "Community discovered" card must    */
/*  work for signed-out visitors, so this adds a read-only PUBLIC view */
/*  over APPROVED resources only.                                      */
/*                                                                     */
/*  Fail-closed invariants (docs/resource-safety-guard.md):            */
/*  • only status = 'approved' rows are visible — nothing reaches the  */
/*    public surface without the recorded admin decision (L4);         */
/*  • the view is read-only — admins manage rows through the base      */
/*    table; no INSERT/UPDATE/DELETE policy exists on the view;        */
/*  • all strings render as plain text downstream (never raw HTML).    */
/*                                                                     */
/*  Idempotent: safe to re-run. Owner step after merge:                */
/*    npx supabase db query --linked --file supabase/discovery-public-read.sql */
/* ================================================================== */

create or replace view public.discovered_resources_public as
  select id, url, title, kind, attribution, license, status, created_at
  from public.discovered_resources
  where status = 'approved';

/* Postgres 15+ views default to the owner's privileges (security_invoker
   semantics are NOT enabled): base-table RLS is bypassed, so the where
   clause above is the gate. Kept as a view (not a table) so approvals
   reflect immediately with no sync step. */

grant select on public.discovered_resources_public to anon, authenticated;
