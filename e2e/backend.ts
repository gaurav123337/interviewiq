import type { Route } from "@playwright/test";

export type Persona = "guest" | "free" | "pro" | "admin" | "addon" | "platinum" | "complimentary";
type OwnedRow = Record<string, unknown> & { user_id: string };
const USER_ID = "00000000-0000-4000-8000-000000000001";
const PIPELINE_DEFAULTS = { enabled: false, autoSubmit: false, threshold: 60, dailyCap: 10, weeklyCap: 50, employerDailyCap: 2, timeZone: "UTC", roles: [], locations: [], countries: [], excludeCompanies: [], requireWorkAuthorization: false, allowSponsorship: true, maxAgeDays: 14, aiConsent: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  readonly pipelineProfiles = new Map<string, Record<string, any>>();
  readonly pipelineSettings = new Map<string, Record<string, any>>();
  readonly pipelineAnswers: OwnedRow[] = [];
  readonly pipelineQuestions: OwnedRow[] = [];
  readonly pipelineBoards: OwnedRow[] = [];
  readonly pipelineRuns: OwnedRow[] = [];
  readonly pipelineTasks: OwnedRow[] = [];
  readonly pipelineAgents: OwnedRow[] = [];
  readonly pipelineSessions: OwnedRow[] = [];
  readonly pipelineCommands: OwnedRow[] = [];
  pipelineUnavailable = false;
  private pipelineSequence = 0;
  readonly pairingCodes: { id: string; user_id: string; code: string; expires_at: string }[] = [];
  readonly notifyConfigs = new Map<string, Record<string, unknown>>();
  notifyDeliveryFailure = false;
  notifyStaleAfterDelivery = false;
  readonly notifyDeliveries: { user_id: string; operation: "save" | "test"; chat_id: string; message_id: number }[] = [];
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
  private pipelineId() { return `70000000-0000-4000-8000-${String(++this.pipelineSequence).padStart(12, "0")}`; }
  /* No fixture auto-submission. A test must explicitly simulate worker evidence. */
  completeSyntheticPipelineTask(taskId: string, outcome: "submitted" | "unverified") {
    const task = this.pipelineTasks.find(row => row.user_id === this.userId && row.id === taskId);
    if (!task || task.status !== "queued") throw new Error("Synthetic task must be own and queued before worker evidence");
    task.status = outcome; task.reason = outcome === "submitted" ? "synthetic_confirmation_observed" : "synthetic_submit_timeout";
    const run = this.pipelineRuns.find(row => row.id === task.run_id && row.user_id === this.userId);
    if (run && this.pipelineTasks.filter(row => row.run_id === run.id).every(row => !["queued", "in_progress", "waiting_answer", "waiting_login", "waiting_review"].includes(String(row.status)))) {
      run.status = "completed"; run.finished_at = new Date().toISOString();
    }
  }
  private pipelineContract(body: Record<string, any>): { body: unknown; status?: number } | null {
    const args = body.p_args;
    const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === "object" && !Array.isArray(value);
    const shape = (allowed: string[], required: string[] = []) => object(args) && Object.keys(args).every(key => allowed.includes(key)) && required.every(key => key in args);
    const limit = (max = 200) => args.limit === undefined || Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= max;
    const revision = (value: unknown) => value === null || Number.isSafeInteger(value) && Number(value) > 0;
    const uuid = (value: unknown) => typeof value === "string" && UUID.test(value);
    const text = (value: unknown, max = 500, min = 1) => typeof value === "string" && value.length >= min && value.length <= max && !value.includes("\u0000");
    const stringList = (value: unknown, max = 100) => Array.isArray(value) && value.length <= max && value.every(item => text(item));
    const publicUrl = (value: unknown) => {
      if (!text(value, 2048)) return false;
      try { const url = new URL(value as string), host = url.hostname.replace(/\.$/, ""); return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && host.includes(".") && !host.includes(":") && !/^[\d.]+$/.test(host) && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host); } catch { return false; }
    };
    const owned = (rows: OwnedRow[]) => rows.filter(row => row.user_id === this.userId);
    const strip = (row: OwnedRow) => { const { user_id: _owner, lease_nonce: _nonce, ...result } = row; return result; };
    const reply = (value: unknown, status = 200) => ({ body: value, status });
    const invalid = (message: string, status = 400) => reply({ message, code: status === 409 ? "40001" : "22023" }, status);
    if (!this.signedIn || !object(args) || Object.keys(body).sort().join(",") !== "p_action,p_args") return null;
    if (this.pipelineUnavailable) return reply({ message: "Synthetic pipeline RPC not installed", code: "PGRST202" }, 404);
    const now = new Date().toISOString();
    const profile = this.pipelineProfiles.get(this.userId);
    let preferences = this.pipelineSettings.get(this.userId);
    const entitled = this.entitlement().auto_apply || this.persona === "admin";
    const needAccess = () => invalid("not entitled", 403);
    const invalidate = (reason: string) => {
      for (const task of owned(this.pipelineTasks)) if (["queued", "in_progress", "waiting_answer", "waiting_login", "waiting_review"].includes(String(task.status))) { task.status = "waiting_review"; task.reason = reason; }
    };
    switch (body.p_action) {
      case "learning.list": if (shape(["limit", "offset"]) && limit() && (args.offset === undefined || Number.isSafeInteger(args.offset) && args.offset >= 0 && args.offset <= 2147483647)) {
        return reply({ hasMore: false, learning: { feedback: [], grants: [], receipts: [], questions: [], eligibility: [] } });
      } break;
      case "profile.get": if (shape([])) return reply({ profile: profile ?? null }); break;
      case "settings.get": if (shape([])) {
        if (!preferences) { preferences = { revision: 1, data: structuredClone(PIPELINE_DEFAULTS), updated_at: now }; this.pipelineSettings.set(this.userId, preferences); }
        return reply({ settings: preferences });
      } break;
      case "profile.confirm": if (shape(["expectedRevision", "facts", "resumeText", "resumeApproved"], ["expectedRevision", "facts", "resumeText", "resumeApproved"]) && revision(args.expectedRevision) && object(args.facts) && Object.keys(args.facts).length <= 100 && text(args.resumeText, 12000, 0) && typeof args.resumeApproved === "boolean") {
        if (!entitled) return needAccess();
        if (args.expectedRevision !== (profile?.revision ?? null)) return invalid("revision conflict", 409);
        if (args.resumeApproved && !args.resumeText.trim()) return invalid("approved resume required");
        const facts: Record<string, unknown> = {};
        for (const [key, fact] of Object.entries(args.facts)) {
          if (!object(fact) || !(/^[A-Za-z][A-Za-z0-9_.:-]{0,119}$/.test(key) || /^skillYears:[a-z0-9+#. /-]{1,80}$/.test(key)) || fact.source !== "user" || Object.keys(fact).some(key => !["value", "source", "confirmedAt", "scope", "validUntil"].includes(key)) || !(text(fact.value, key.startsWith("portalResumeText:") ? 12000 : 10000, 0) || typeof fact.value === "boolean" || typeof fact.value === "number" && Number.isFinite(fact.value) || stringList(fact.value))) return null;
          if (fact.scope !== undefined && (!object(fact.scope) || Object.keys(fact.scope).some(key => !["country", "employer", "portal", "application"].includes(key)) || Object.values(fact.scope).some(value => !text(value)))) return null;
          if (fact.validUntil !== undefined && (!Number.isFinite(Date.parse(fact.validUntil)) || Date.parse(fact.validUntil) <= Date.now())) return invalid("invalid fact expiry");
          if (["workAuthorization", "requiresSponsorship"].includes(key) && !fact.scope?.country) return invalid("country scope required");
          facts[key] = { ...fact, source: "user", confirmedAt: now };
        }
        const saved = { revision: Number(profile?.revision ?? 0) + 1, answers_revision: Number(profile?.answers_revision ?? 0) + 1, facts, resume_text: args.resumeText, resume_approved: args.resumeApproved, confirmed_at: now, updated_at: now };
        this.pipelineProfiles.set(this.userId, saved);
        for (const answer of owned(this.pipelineAnswers)) if (!answer.revoked_at) { answer.revoked_at = now; answer.revoke_reason = "profile_changed"; }
        for (const question of owned(this.pipelineQuestions)) if (question.status === "pending") question.status = "dismissed";
        invalidate("profile_changed"); this.writes.push("pipeline:profile.confirm"); return reply({ profile: saved });
      } break;
      case "settings.put": if (shape(["expectedRevision", "settings"], ["expectedRevision", "settings"]) && revision(args.expectedRevision) && object(args.settings)) {
        const settings = args.settings;
        const allowed = [...Object.keys(PIPELINE_DEFAULTS), "minimumSalary", "quietFrom", "quietTo"];
        let zoneValid = text(settings.timeZone, 100);
        try { new Intl.DateTimeFormat("en", { timeZone: settings.timeZone }); } catch { zoneValid = false; }
        const int = (key: string, max: number, min = 0) => Number.isSafeInteger(settings[key]) && settings[key] >= min && settings[key] <= max;
        const quietValid = settings.quietFrom === undefined && settings.quietTo === undefined || typeof settings.quietFrom === "string" && typeof settings.quietTo === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.quietFrom) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.quietTo);
        if (Object.keys(settings).some(key => !allowed.includes(key)) || !Object.keys(PIPELINE_DEFAULTS).every(key => key in settings) || !["enabled", "autoSubmit", "aiConsent", "requireWorkAuthorization", "allowSponsorship"].every(key => typeof settings[key] === "boolean") || !int("threshold", 100) || !int("dailyCap", 100) || !int("weeklyCap", 500) || !int("employerDailyCap", 20) || !int("maxAgeDays", 90, 1) || !["roles", "locations", "countries", "excludeCompanies"].every(key => stringList(settings[key])) || !zoneValid || !quietValid) return null;
        if (settings.minimumSalary !== undefined && (!object(settings.minimumSalary) || !Number.isFinite(settings.minimumSalary.value) || settings.minimumSalary.value < 0 || !/^[A-Z]{3}$/.test(settings.minimumSalary.currency) || !["year", "month", "hour"].includes(settings.minimumSalary.period))) return null;
        if (!entitled && (settings.enabled || settings.autoSubmit)) return needAccess();
        if (args.expectedRevision !== (preferences?.revision ?? null)) return invalid("revision conflict", 409);
        const saved = { revision: Number(preferences?.revision ?? 0) + 1, data: structuredClone(settings), updated_at: now };
        this.pipelineSettings.set(this.userId, saved); invalidate("settings_changed"); this.writes.push("pipeline:settings.put"); return reply({ settings: saved });
      } break;
      case "answers.list": if (shape(["limit", "includeRevoked"]) && limit() && (args.includeRevoked === undefined || typeof args.includeRevoked === "boolean")) return reply({ answers: owned(this.pipelineAnswers).filter(row => args.includeRevoked || !row.revoked_at).slice(0, args.limit ?? 200).map(strip), revision: profile?.answers_revision ?? 0 }); break;
      case "answers.revoke": if (shape(["answerId"], ["answerId"]) && uuid(args.answerId)) {
        const answer = owned(this.pipelineAnswers).find(row => row.id === args.answerId); if (!answer) return invalid("answer not found", 404);
        answer.revoked_at = now; answer.revoke_reason = "user_revoked"; if (profile) profile.answers_revision++;
        invalidate("answer_revoked"); this.writes.push("pipeline:answers.revoke"); return reply({ answer: strip(answer) });
      } break;
      case "questions.list": if (shape(["limit", "status"]) && limit() && (args.status === undefined || ["pending", "answered", "dismissed"].includes(args.status))) return reply({ questions: owned(this.pipelineQuestions).filter(row => row.status === (args.status ?? "pending")).slice(0, args.limit ?? 200).map(strip) }); break;
      case "questions.answer": if (shape(["questionId", "answer", "scope", "scopeKey", "expiresAt", "confirm"], ["questionId", "answer", "scope", "confirm"]) && uuid(args.questionId) && text(args.answer, 10000) && args.confirm === true && ["global", "country", "employer", "portal", "application"].includes(args.scope) && (args.scope === "global" ? args.scopeKey === undefined || args.scopeKey === "" : text(args.scopeKey))) {
        if (!entitled) return needAccess();
        const question = owned(this.pipelineQuestions).find(row => row.id === args.questionId); if (!question) return invalid("question not found", 404);
        if (!profile || question.status !== "pending" || question.profile_revision !== profile.revision) return invalid("revision conflict", 409);
        if (question.scope !== args.scope || question.scope_key !== (args.scopeKey ?? "")) return invalid("question scope mismatch");
        if (["select", "radio"].includes(String(question.control_type)) && !(question.options as string[]).includes(args.answer)) return invalid("answer must match offered option");
        if (args.expiresAt !== undefined && (!Number.isFinite(Date.parse(args.expiresAt)) || Date.parse(args.expiresAt) <= Date.now())) return invalid("invalid answer expiry");
        const answer: OwnedRow = { user_id: this.userId, id: this.pipelineId(), question_key: question.question_key, meaning: question.meaning, question_text: question.question_text, control_type: question.control_type, options: question.options, context: question.context, answer: args.answer, scope: args.scope, scope_key: args.scopeKey ?? "", profile_revision: profile.revision, confirmed_at: now, expires_at: args.expiresAt ?? null, provenance: "user", revoked_at: null, revoke_reason: null };
        this.pipelineAnswers.push(answer); question.status = "answered"; question.answer_id = answer.id; profile.answers_revision++;
        for (const task of owned(this.pipelineTasks)) if (task.status === "waiting_answer" && (question.task_ids as string[]).includes(String(task.id)) && !owned(this.pipelineQuestions).some(other => other.status === "pending" && (other.task_ids as string[]).includes(String(task.id)))) { task.status = "queued"; task.answers_revision = profile.answers_revision; task.reason = null; }
        this.writes.push("pipeline:questions.answer"); return reply({ answer: strip(answer), revision: profile.answers_revision });
      } break;
      case "boards.list": if (shape(["limit"]) && limit()) return reply({ boards: owned(this.pipelineBoards).slice(0, args.limit ?? 200).map(strip) }); break;
      case "boards.add": if (shape(["url", "label", "type"], ["url"]) && publicUrl(args.url) && (args.label === undefined || text(args.label, 200)) && (args.type === undefined || ["manual", "greenhouse", "lever", "ashby", "workday"].includes(args.type))) {
        if (!entitled) return needAccess(); const host = new URL(args.url).hostname;
        const board: OwnedRow = { user_id: this.userId, id: this.pipelineId(), url: args.url, host, label: args.label ?? host, type: args.type ?? "manual", status: "pending", created_at: now, updated_at: now };
        this.pipelineBoards.push(board); this.writes.push("pipeline:boards.add"); return reply({ board: strip(board) });
      } break;
      case "run.list": if (shape(["limit"]) && limit()) return reply({ runs: owned(this.pipelineRuns).slice(0, args.limit ?? 200).map(strip) }); break;
      case "run.request": if (shape(["bindingId", "limit", "mode"], ["bindingId"]) && uuid(args.bindingId) && limit(100) && (args.mode === undefined || ["review", "auto"].includes(args.mode))) {
        if (!entitled) return needAccess();
        const binding = owned(this.pipelineAgents).find(row => row.binding_id === args.bindingId && !row.revoked_at) ?? owned(this.agentBindings).find(row => row.binding_id === args.bindingId && !row.revoked_at);
        if (!binding) return invalid("binding not found", 404);
        if (!profile || !preferences?.data.enabled) return invalid("confirmed profile and enabled settings required");
        if (args.mode === "auto" && (!profile.resume_approved || !preferences.data.autoSubmit)) return invalid("explicit auto-submit and approved resume required");
        const run: OwnedRow = { user_id: this.userId, id: this.pipelineId(), binding_id: args.bindingId, mode: args.mode ?? "review", status: "queued", profile_revision: profile.revision, settings_revision: preferences.revision, answers_revision: profile.answers_revision, candidate_count: 1, task_count: 1, created_at: now, started_at: null, finished_at: null };
        const job = { jobUrl: "https://employer.example.com/job/synthetic-pipeline", title: "Synthetic TypeScript Engineer", company: "Synthetic Company", description: "Strict synthetic pipeline fixture only", skills: ["typescript", "react"], location: "Remote", country: "US", postedAt: now, portal: "employer.example.com" };
        const task: OwnedRow = { user_id: this.userId, id: this.pipelineId(), run_id: run.id, target_binding_id: args.bindingId, job, status: "queued", lease_version: 0, lease_until: null, profile_revision: profile.revision, settings_revision: preferences.revision, answers_revision: profile.answers_revision, score: 100, reason: null };
        this.pipelineRuns.unshift(run); this.pipelineTasks.unshift(task); this.writes.push("pipeline:run.request"); return reply({ run: strip(run), publicFeedAvailable: true });
      } break;
      case "run.cancel": if (shape(["runId"], ["runId"]) && uuid(args.runId)) {
        const run = owned(this.pipelineRuns).find(row => row.id === args.runId); if (!run) return invalid("run not found", 404);
        run.status = "cancelled"; run.finished_at = now;
        for (const task of owned(this.pipelineTasks)) if (task.run_id === run.id && ["queued", "in_progress", "submitting", "waiting_answer", "waiting_login", "waiting_review"].includes(String(task.status))) { task.status = task.status === "submitting" ? "unverified" : "cancelled"; task.reason = "run_cancelled"; }
        this.writes.push("pipeline:run.cancel"); return reply({ run: strip(run) });
      } break;
      case "tasks.list": if (shape(["runId", "limit"]) && limit() && (args.runId === undefined || uuid(args.runId))) return reply({ tasks: owned(this.pipelineTasks).filter(row => !args.runId || row.run_id === args.runId).slice(0, args.limit ?? 200).map(strip) }); break;
      case "agent.list": if (shape(["limit"]) && limit()) {
        const agents = new Map(owned(this.agentBindings).map(row => [row.binding_id, { user_id: this.userId, binding_id: row.binding_id, label: row.label, engine_version: null, capabilities: [], status: null, profile_metadata: {}, heartbeat_at: null, revoked_at: row.revoked_at, last_used_at: row.last_used_at }] as const));
        for (const row of owned(this.pipelineAgents)) agents.set(row.binding_id, row as any);
        return reply({ agents: [...agents.values()].slice(0, args.limit ?? 200).map(strip) });
      } break;
      case "sessions.list": if (shape(["limit"]) && limit()) return reply({ sessions: owned(this.pipelineSessions).slice(0, args.limit ?? 200).map(strip) }); break;
      case "commands.request": if (shape(["bindingId", "type", "args"], ["bindingId", "type"]) && uuid(args.bindingId) && ["pause", "resume", "retry_login", "open_question", "check_session"].includes(args.type) && (args.args === undefined || object(args.args) && Object.keys(args.args).every(key => ["portal", "questionId"].includes(key)) && (args.args.portal === undefined || text(args.args.portal, 200)) && (args.args.questionId === undefined || uuid(args.args.questionId)))) {
        if (!entitled && args.type !== "pause") return needAccess();
        const binding = owned(this.pipelineAgents).find(row => row.binding_id === args.bindingId && !row.revoked_at) ?? owned(this.agentBindings).find(row => row.binding_id === args.bindingId && !row.revoked_at);
        if (!binding) return invalid("binding not found", 404);
        if (args.args?.questionId && !owned(this.pipelineQuestions).some(row => row.id === args.args.questionId)) return invalid("question not found", 404);
        const command: OwnedRow = { user_id: this.userId, id: this.pipelineId(), binding_id: args.bindingId, type: args.type, args: args.args ?? {}, status: "queued", reason: null, created_at: now, claimed_at: null, finished_at: null };
        this.pipelineCommands.push(command); this.writes.push("pipeline:commands.request"); return reply({ command: strip(command) });
      } break;
    }
    return null;
  }
  private notifyMetadata() {
    const row = this.notifyConfigs.get(this.userId);
    return row ? { chat_id: row.chat_id ?? null, has_token: !!row.bot_token, time_zone: row.time_zone ?? "UTC",
      delivery_tested_at: row.delivery_tested_at ?? null, updated_at: row.updated_at ?? null, revision: row.revision ?? 0 } : null;
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
      if (rpc === "get_my_notify_config" && method === "POST" && Object.keys(body).length === 0) {
        if (!this.signedIn) return denied();
        return json(this.notifyMetadata());
      }
      if (rpc === "get_my_entitlement") return json([this.entitlement()]);
      if (rpc === "my_apply_pipeline_action" && method === "POST") {
        if (!this.signedIn) return denied();
        const result = this.pipelineContract(body);
        if (result) return json(result.body, result.status);
        // Unknown actions and argument shapes fall through to the strict gate.
      }
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
    // Direct notify-table reads/writes are intentionally unsupported: browser metadata is RPC-only.
    if (path === "/functions/v1/send-notify-test" && method === "POST") {
      if (!this.signedIn) return denied();
      const keys = Object.keys(body).sort().join(",");
      const operation = body.operation;
      const validRevision = body.revision === null || (Number.isSafeInteger(body.revision) && body.revision >= 0);
      const shape = operation === "save" ? keys === "botToken,chatId,operation,revision,timeZone" : (operation === "test" || operation === "unbind") && keys === "operation,revision";
      if (shape && validRevision) {
        const config = this.notifyMetadata();
        if (body.revision !== (config?.revision ?? null)) return json({ sent: false, reason: "stale_binding", config }, 409);
        if (operation === "unbind") {
          const tombstone = { chat_id: null, bot_token: null, time_zone: "UTC", delivery_tested_at: null, updated_at: new Date().toISOString(), revision: Number(config?.revision ?? 0) + 1 };
          this.notifyConfigs.set(this.userId, tombstone); this.writes.push("notify:unbind");
          return json({ sent: false, disconnected: true, config: this.notifyMetadata() });
        }
        if (!this.entitlement().auto_apply && this.persona !== "admin") return json({ sent: false, reason: "not_entitled", config }, 403);
        const previous = this.notifyConfigs.get(this.userId);
        let chat = String(previous?.chat_id ?? "");
        let token = String(previous?.bot_token ?? "");
        let zone = String(previous?.time_zone ?? "UTC");
        if (operation === "save") {
          let validZone = typeof body.timeZone === "string" && body.timeZone.length > 0 && body.timeZone.length <= 100;
          try { new Intl.DateTimeFormat("en", { timeZone: body.timeZone }); } catch { validZone = false; }
          if (typeof body.chatId !== "string" || !/^-?[1-9][0-9]{0,19}$/.test(body.chatId) || typeof body.botToken !== "string"
            || (body.botToken !== "" && !/^[0-9]{5,16}:[A-Za-z0-9_-]{20,128}$/.test(body.botToken)) || (!body.botToken && !token) || !validZone) {
            return json({ sent: false, reason: "invalid_settings", config }, 400);
          }
          chat = body.chatId; token = body.botToken || token; zone = body.timeZone;
        }
        if (!chat || !token || this.notifyDeliveryFailure) return json({ sent: false, reason: "telegram_rejected", config }, 502);
        const message_id = this.notifyDeliveries.length + 1;
        this.notifyDeliveries.push({ user_id: this.userId, operation, chat_id: chat, message_id });
        if (this.notifyStaleAfterDelivery) return json({ sent: true, reason: "stale_binding", config, message_id }, 409);
        const now = new Date().toISOString();
        this.notifyConfigs.set(this.userId, { chat_id: chat, bot_token: token, time_zone: zone, delivery_tested_at: now, updated_at: now, revision: Number(config?.revision ?? 0) + 1 });
        this.writes.push(`notify:${operation}`);
        return json({ sent: true, config: this.notifyMetadata(), message_id });
      }
      // Unknown operations, extra fields and malformed revisions fail the strict fixture gate.
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
