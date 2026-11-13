import { describe, expect, it } from "vitest";

/* Static drift checks complement the executable PostgreSQL assertions in
   supabase/tests/. They do not claim to verify live RLS or installed ACLs. */
const migrations = import.meta.glob<string>("../../supabase/migrations/20261113_*.sql", { query: "?raw", eager: true, import: "default" });
const expand = migrations["../../supabase/migrations/20261113_apply_tenant_expand.sql"];
const contract = migrations["../../supabase/migrations/20261113_apply_tenant_contract.sql"];
const harden = migrations["../../supabase/migrations/20261113_admin_rpc_hardening.sql"];
const bindings = migrations["../../supabase/migrations/20261113_apply_agent_bindings.sql"];
const runner = import.meta.glob<string>("../../scripts/migrate-apply-tenants.mjs", { query: "?raw", eager: true, import: "default" })["../../scripts/migrate-apply-tenants.mjs"];

describe("tenant migration security boundaries", () => {
  it("requires an explicit UUID and matching auth-user email before backfill", () => {
    expect(expand).toContain("current_setting('app.apply_legacy_user_id', true)");
    expect(expand).toContain("current_setting('app.apply_legacy_email', true)");
    expect(expand).toContain("from auth.users where id = v_user and lower(email) = v_email");
    expect(expand).toContain("legacy owner cannot change on migration replay");
    expect(expand).toContain("contracted tenant rollout cannot be expanded again");
  });
  it("replaces admin-wide table policies with own-read and audited RPC writes", () => {
    expect(expand).toContain("using (auth.uid() = user_id)");
    expect(expand).toContain("revoke all on public.%I from public, anon, authenticated");
    expect(expand).toContain("grant select on public.%I to authenticated");
    expect(expand).toContain("(user_id, job_url, variant_id)");
    expect(expand).toContain("(user_id, site_host, field_key)");
    expect(expand).toContain("r.user_id, public.review_posting_key(r.job_url)");
  });
  it("derives self-service identity and blocks agent UUID spoofing", () => {
    expect(expand).toContain("public.apply_core_action(auth.uid(), p_action, p_args)");
    expect(expand).toContain("owner is derived from authentication");
    expect(expand).toContain("revoke all on function public.apply_agent_action(uuid, text, jsonb) from public, anon, authenticated");
    expect(expand).toContain("service role required");
    expect(expand).toContain("else raise exception 'unsupported action'");
  });
  it("invalidates approval when content changes under the same variant hash", () => {
    expect(expand).toContain("apply_resume_variants.variant_text is distinct from excluded.variant_text");
    expect(expand).toContain("then false else apply_resume_variants.approved end");
  });
  it("contracts only after owner smoke use and retains ownership on rollback", () => {
    expect(contract).toContain("b.last_used_at is not null");
    expect(contract).toContain("app.apply_scoped_smoke_verified");
    expect(runner).toContain("INTERVIEWIQ_SCOPED_SMOKE_VERIFIED");
    expect(contract).toContain("alter column user_id drop default");
    expect(contract).toContain("set legacy_enabled = false");
    expect(contract).toContain("from public, anon, authenticated, service_role");
    expect(contract).not.toMatch(/drop\s+column\s+user_id/i);
  });
  it("keeps summary support separate from raw private readers", () => {
    expect(harden).toContain("'admin_user_usage','admin_user_apply_rows','admin_user_review_rows'");
    expect(harden).toContain("admin_user_apply_summary(p_user uuid)");
    expect(harden).toContain("if not public.is_admin() then raise exception 'forbidden'");
    expect(harden).toContain("drop policy if exists \"user notify admin read\"");
  });
  it("checks and locks the binding in the same transaction as every agent action", () => {
    expect(bindings).toContain("service_apply_agent_dispatch(");
    expect(bindings).toContain("b.revoked_at is null and b.token_hash = p_token_hash");
    expect(bindings).toContain("for update;");
    expect(bindings).toContain("public.apply_agent_action(v_binding.user_id, p_action, p_args)");
    expect(bindings).toContain("service_apply_agent_dispatch(uuid, text, text, jsonb) from public, anon, authenticated");
    expect(harden).toContain("'engine_list_apply_results_for_host'");
  });
  it("makes rollout inspection-only by default and explicitly ordered", () => {
    expect(runner).toContain('if (!apply)');
    expect(runner).toContain("INTERVIEWIQ_ROLLOUT_CONFIRMED");
    expect(runner.indexOf('"20261113_complimentary_grants.sql"')).toBeLessThan(runner.indexOf('"20261113_apply_tenant_expand.sql"'));
    expect(runner).toContain("Explicit --owner-id UUID and --owner-email required");
  });
});
