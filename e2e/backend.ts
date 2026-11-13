import type { Route } from "@playwright/test";

export type Persona = "guest" | "free" | "pro" | "admin" | "addon" | "platinum" | "complimentary";
type OwnedRow = Record<string, unknown> & { user_id: string };
const USER_ID = "00000000-0000-4000-8000-000000000001";
const PUBLIC_CONFIG_KEYS = new Set(["features", "ai", "limits", "companyFreq", "company_freq", "coachVocab", "coach_vocab", "rag", "policies", "menuVisibility", "jobs", "resumeBranding", "site_config", "refund_policy", "pricing"]);
const EMPTY_TABLES = new Set([
  "announcements", "published_questions", "content_items", "content_sources", "skill_roadmaps", "skill_prerequisites",
  "resources", "resource_submissions", "resource_interactions", "pdf_documents", "pdf_chunks", "discovery_sources",
  "skill_trends", "trending_skills", "salary_benchmarks", "user_resumes", "resume_variants", "team_audit", "app_admins",
  "admin_banners", "admin_ads", "admin_testimonials", "admin_resources", "admin_tips", "recovery_codes", "discovered_resources_public"
]);

/* This is a contract fixture, not a replacement for Supabase/RLS tests. Each
   supported endpoint is explicit; unexpected calls are test failures. */
export class FixtureBackend {
  persona: Persona = "guest";
  userId = USER_ID;
  signedIn = false;
  authFailure = false;
  syncFailure = false;
  aiFailure = false;
  paymentAvailable = false;
  readonly articles: Record<string, unknown>[] = [];
  readonly calls: { method: string; path: string; userId: string; body?: unknown }[] = [];
  readonly syncRows = new Map<string, Record<string, unknown>>();
  readonly applyResults: OwnedRow[] = [];
  readonly reviews: OwnedRow[] = [];
  readonly variants: OwnedRow[] = [];
  readonly exemplars: OwnedRow[] = [];
  readonly memoryStats: OwnedRow[] = [];
  readonly skillStrikes: OwnedRow[] = [];
  readonly agentBindings: OwnedRow[] = [];
  readonly pairingCodes: { id: string; user_id: string; code: string; expires_at: string }[] = [];
  readonly notifyConfigs = new Map<string, Record<string, unknown>>();
  readonly careerProfiles = new Map<string, Record<string, unknown>>();
  readonly uploadedResumes = new Map<string, Record<string, unknown>>();
  readonly giftCodes = new Map<string, { product: "platinum"; redeemedBy?: string }>();
  readonly redeemedGifts = new Map<string, "platinum">();
  readonly teams: Record<string, unknown>[] = [];
  readonly configRows: Record<string, unknown>[] = [];
  readonly unexpected: string[] = [];
  readonly writes: string[] = [];

  private ownRows(rows: OwnedRow[]) {
    // Synthetic filtering only: these browser tests do not exercise real RLS.
    return rows.filter(row => row.user_id === this.userId).map(({ user_id: _owner, ...row }) => row);
  }
  private entitlement() {
    const gift = this.redeemedGifts.get(this.userId);
    const platinum = this.persona === "platinum" || gift === "platinum";
    const complimentary = this.persona === "complimentary" || !!gift;
    const pro = platinum || this.persona === "pro" || this.persona === "admin";
    return {
      tier: pro ? "pro" : "free", active: pro, plan: platinum ? "platinum" : pro ? "monthly" : null,
      auto_apply: platinum || this.persona === "addon" || complimentary, is_platinum: platinum,
      source: gift ? "gift_code" : complimentary ? "admin" : "synthetic",
      paid_tier: gift || this.persona === "complimentary" ? "free" : pro ? "pro" : "free",
      paid_plan: gift || this.persona === "complimentary" ? null : platinum ? "platinum" : pro ? "monthly" : null,
      complimentary, complimentary_product: gift ?? (complimentary ? "auto_apply" : null),
      complimentary_source: gift ? "gift_code" : complimentary ? "admin" : null,
      complimentary_grant_id: complimentary ? 1 : null, complimentary_expires_at: null,
    };
  }
  private user() {
    return { id: this.userId, aud: "authenticated", role: "authenticated", email: "virtual-tester@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", identities: [] };
  }
  private session() {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return { access_token: `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: this.userId, aud: "authenticated", role: "authenticated", exp: expiry })}.synthetic`, refresh_token: "virtual-fixture-refresh-only", token_type: "bearer", expires_in: 3600, expires_at: expiry, user: this.user() };
  }
  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const call = { method, path, userId: this.userId, body: undefined as unknown };
    this.calls.push(call);
    const json = async (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-range": "0-0/*" }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    let body: Record<string, any> = {};
    try { body = request.postDataJSON() ?? {}; } catch { /* endpoints without JSON bodies */ }
    call.body = request.postData() ? body : undefined;
    const denied = () => {
      this.unexpected.push(`${method} ${path} (forbidden for ${this.persona})`);
      return json({ message: "Synthetic permission denied", error: "forbidden" }, 403);
    };

    if (path === "/auth/v1/token" && method === "POST") {
      if (this.authFailure) return json({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
      this.signedIn = true;
      if (this.persona === "guest") this.persona = "free";
      return json(this.session());
    }
    if (path === "/auth/v1/user" && method === "GET") return this.signedIn ? json(this.user()) : json({ message: "No session" }, 401);
    if (path === "/auth/v1/logout" && method === "POST") { this.signedIn = false; return json({}); }
    if (path === "/auth/v1/settings" && method === "GET") return json({ external: { email: true, google: false, github: false }, disable_signup: true });
    if (path === "/auth/v1/factors" && method === "GET") return json({ all: [], totp: [], phone: [] });

    if (path.startsWith("/rest/v1/rpc/")) {
      const rpc = path.slice("/rest/v1/rpc/".length);
      if (rpc === "is_admin") return json(this.signedIn && this.persona === "admin");
      if (rpc.startsWith("admin_") && (!this.signedIn || this.persona !== "admin")) return denied();
      if (rpc === "admin_get_apply_config") return json(null);
      if (rpc === "get_my_entitlement") return json([this.entitlement()]);
      if (rpc === "my_apply_action" && method === "POST") {
        if (!this.signedIn) return denied();
        const args = body.p_args;
        if (args && typeof args === "object" && !Array.isArray(args)) {
          const noArgs = Object.keys(args).length === 0;
          const hasLimit = Object.keys(args).length === 1 && Number.isInteger(args.limit) && args.limit > 0;
          const limited = (rows: unknown[]) => rows.slice(0, args.limit);
          switch (body.p_action) {
            case "results.list": if (hasLimit) return json(limited(this.ownRows(this.applyResults))); break;
            case "reviews.list": if (noArgs) return json(this.ownRows(this.reviews).filter(row => !row.status || row.status === "pending")); break;
            case "reviews.resolved": if (hasLimit) return json(limited(this.ownRows(this.reviews).filter(row => row.status && row.status !== "pending"))); break;
            case "variants.list": if (hasLimit) return json(limited(this.ownRows(this.variants))); break;
            case "exemplars.list": if (hasLimit) return json(limited(this.ownRows(this.exemplars))); break;
            case "memory.stats": if (noArgs) return json(this.ownRows(this.memoryStats)); break;
            case "strikes.list": if (noArgs) return json(this.ownRows(this.skillStrikes)); break;
          }
        }
        // Unsupported actions/arguments must reach the strict failure below.
      }
      if (rpc === "redeem_grant" && method === "POST" && typeof body.p_code === "string") {
        if (!this.signedIn) return denied();
        const gift = this.giftCodes.get(body.p_code);
        if (gift) {
          if (gift.redeemedBy) return json({ message: "already_used" }, 400);
          gift.redeemedBy = this.userId;
          this.redeemedGifts.set(this.userId, gift.product);
          this.writes.push("redeem_grant");
          return json([this.entitlement()]);
        }
      }
      if (rpc === "my_teams") return json(this.teams);
      if (rpc === "team_grants_pro") return json(false);
      if (["latest_skill_signals", "my_pending_invites", "get_my_payments", "get_my_subscription", "get_my_notifications", "team_roster", "search_pdf_chunks", "search_pdf_chunks_lex", "match_pdf_chunks", "get_public_sources"].includes(rpc)) return json([]);
      if (rpc === "create_team") {
        this.writes.push(rpc);
        this.teams.push({ team_id: "00000000-0000-4000-8000-000000000002", team_name: body.p_name, role: "owner", seats: body.p_seats, members: 1 });
        return json(this.teams[0].team_id);
      }
      if (["admin_stats", "admin_analytics", "admin_metrics"].includes(rpc)) return json({});
      if (["admin_list_users", "admin_list_payments", "admin_list_subscriptions", "admin_list_coupons", "admin_billing_actions"].includes(rpc)) return json([]);
    }
    if (path === "/rest/v1/app_config") {
      if (method === "GET" || method === "HEAD") {
        const key = url.searchParams.get("key")?.replace(/^eq\./, "");
        const admin = this.signedIn && this.persona === "admin";
        if (!admin && key && !PUBLIC_CONFIG_KEYS.has(key)) return denied();
        // Public bootstrap reads product configuration, never private engine config.
        if (!admin && !key && url.searchParams.get("select") !== "key,value") return denied();
        const readable = admin ? this.configRows : this.configRows.filter(row => PUBLIC_CONFIG_KEYS.has(String(row.key)));
        const rows = key ? readable.filter(row => row.key === key) : readable;
        return json(request.headers().accept?.includes("vnd.pgrst.object") ? rows[0] ?? null : rows);
      }
      if (method === "POST" && this.persona === "admin") {
        const rows = Array.isArray(body) ? body : [body];
        for (const row of rows) {
          const index = this.configRows.findIndex(existing => existing.key === row.key);
          if (index < 0) this.configRows.push(row); else this.configRows[index] = row;
        }
        this.writes.push("app_config"); return json(rows, 201);
      }
    }
    if (path === "/rest/v1/user_sync") {
      if (this.syncFailure) return json({ message: "Synthetic sync unavailable" }, 503);
      const own = () => [...this.syncRows.values()].filter(row => (row.user_id ?? USER_ID) === this.userId);
      if (method === "GET") return json(own());
      if (method === "POST") {
        const rows = Array.isArray(body) ? body : [body];
        if (rows.some(row => row.user_id && row.user_id !== this.userId)) return denied();
        for (const row of rows) this.syncRows.set(this.userId === USER_ID ? row.key : `${this.userId}:${row.key}`, { ...row, user_id: this.userId });
        this.writes.push("user_sync"); return json(own(), 201);
      }
      if (method === "DELETE") { this.writes.push("user_sync:delete"); return json([]); }
    }
    if (["/rest/v1/profiles", "/rest/v1/usage_events", "/rest/v1/answer_feedback", "/rest/v1/ai_cost_log"].includes(path)) {
      if (method === "POST" || method === "PATCH") { this.writes.push(path); return json(body, 201); }
      if (method === "GET") return json([]);
    }
    if (path === "/rest/v1/content_items" && method === "GET") return json(this.articles);
    if (path === "/rest/v1/jobs" && method === "GET") {
      const source = url.searchParams.get("source");
      return json(source && source !== "eq.greenhouse" ? [] : [{ source: "greenhouse", external_id: "virtual-1", title: "Synthetic TypeScript Engineer", company: "Example Test Company", location: "Remote", remote: true, description: "Synthetic fixture only. Build TypeScript and React applications with testing and PostgreSQL.", url: "https://employer.example.invalid/job/virtual-1", skills: ["typescript", "react", "testing"], level: "senior", salary: null, company_size: "small", posted_at: new Date().toISOString() }]);
    }
    if (path.startsWith("/rest/v1/") && ["GET", "HEAD"].includes(method) && EMPTY_TABLES.has(path.slice(9))) return json([]);
    if (["/rest/v1/career_profiles", "/rest/v1/uploaded_resumes"].includes(path) && method === "GET") {
      if (!this.signedIn || url.searchParams.get("user_id") !== `eq.${this.userId}` || url.searchParams.get("select") !== "data") return denied();
      const rows = path === "/rest/v1/career_profiles" ? this.careerProfiles : this.uploadedResumes;
      const row = rows.get(this.userId);
      return json(request.headers().accept?.includes("vnd.pgrst.object") ? row ?? null : row ? [row] : []);
    }
    if (["/rest/v1/job_sites", "/rest/v1/site_credentials"].includes(path) && this.persona !== "admin") return denied();
    if (path === "/rest/v1/user_notify_config") {
      if (!this.signedIn) return denied();
      if (method === "GET") {
        const config = this.notifyConfigs.get(this.userId);
        return json(request.headers().accept?.includes("vnd.pgrst.object") ? config ?? null : config ? [config] : []);
      }
    }
    if (path === "/functions/v1/apply-agent" && method === "POST") {
      if (!this.signedIn) return denied();
      const keys = Object.keys(body);
      if (body.operation === "bindings.list" && keys.length === 1) return json({ ok: true, bindings: this.ownRows(this.agentBindings) });
      if (body.operation === "pair.create" && keys.length === 1) {
        if (!this.entitlement().auto_apply && this.persona !== "admin") return json({ ok: false, error: "Auto-apply access required" }, 403);
        const sequence = this.pairingCodes.length + 1;
        const pairing = { id: `synthetic-pair-${sequence}`, user_id: this.userId, code: `SYNTHETIC-PAIR-${sequence}`, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() };
        this.pairingCodes.push(pairing);
        this.writes.push("pair.create");
        const { user_id: _owner, ...response } = pairing;
        return json({ ok: true, pairing: response });
      }
      if (body.operation === "bindings.revoke" && keys.length === 2 && typeof body.binding_id === "string") {
        const binding = this.agentBindings.find(row => row.user_id === this.userId && row.binding_id === body.binding_id);
        if (!binding) return json({ ok: false, error: "Binding not found" }, 404);
        binding.revoked_at = new Date().toISOString();
        this.writes.push("bindings.revoke");
        return json({ ok: true });
      }
    }
    if (path === "/functions/v1/secret-status" && method === "GET") return json({ ok: true, checkedAt: "2026-01-01T00:00:00Z", serviceRoleAvailable: false, secrets: [], summary: { total: 0, configured: 0, missing: 0, missingRequired: 0, missingOptional: 0, missingRequiredNames: [], missingOptionalNames: [] } });
    if (path === "/functions/v1/ai-chat") {
      if (method === "GET") return json({ models: ["virtual-model"] });
      if (this.aiFailure) return json({ error: "Synthetic AI unavailable" }, 503);
      return json({ text: "A synthetic tutor explanation: define the problem, compare the trade-offs, and verify the result with a concrete test.", model: "virtual-model", usage: { prompt_tokens: 10, completion_tokens: 20 } });
    }
    if (path === "/functions/v1/embed" && method === "POST") {
      const input = body.input ?? body.texts ?? [body.text ?? ""];
      return json({ data: (Array.isArray(input) ? input : [input]).map((_: unknown, index: number) => ({ embedding: Array(1536).fill(0).map((v, i) => i === 0 ? 1 : v), index })), model: "text-embedding-3-small" });
    }
    if (path === "/functions/v1/jobs-fetch" && method === "POST") return json({ added: 0, updated: 0, total: 1, errors: {} });
    if (path === "/functions/v1/pay-checkout" && method === "POST") {
      return this.paymentAvailable ? json({ provider: "razorpay", order_id: "virtual-order", amount_minor: 900, currency: "USD", key_id: "rzp_test_synthetic" }) : json({ error: "Synthetic payment provider unavailable — no charge attempted" }, 503);
    }
    if (path === "/functions/v1/pay-verify" && method === "POST" && this.paymentAvailable) {
      this.persona = "pro"; this.writes.push("synthetic-pay-verify");
      return json({ ok: true, granted: "pro", plan: "monthly" });
    }

    this.unexpected.push(`${method} ${path}`);
    return json({ error: "Unsupported fixture contract", endpoint: path }, 501);
  }
}
