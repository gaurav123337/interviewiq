# 🔐 InterviewIQ — App-wide Security Protocols

*Status: proposed. **Audit date: 2026-08-15** (verified against the codebase at commit `b6e90ae`). Umbrella doc — subsystem specs: `resource-safety-guard.md` (user-submitted resources), `skill-counselor.md` §6 (submission flow). Every new feature ships with a security review; this doc is the checklist.*

## 1. Design invariants (non-negotiable)

1. **The server is authoritative.** Client-side checks (entitlements, admin flags, licensing) are UX only — every security decision is re-enforced server-side (RLS, security-definer RPCs, edge-function checks).
2. **Least privilege.** Service-role keys never leave the server; users can only touch their own rows; admin actions are gated by `is_admin()` / `is_owner()` and audited.
3. **Fail closed.** Any check that errors, times out, or is inconclusive denies — never grants.
4. **Never trust input.** Every user string is plain text or escaped; no raw HTML; URLs are validated and their destinations re-checked; outbound fetches are SSRF-safe.
5. **The AI has no authority.** Fetched/untrusted content is data, never instructions (prompt-injection invariant — see §8).
6. **No execution of third-party code.** The app never runs, imports, or renders code/pages from a resource or imported job.
7. **Privacy by default.** The user's data is theirs: local-first storage, scoped RLS, no unnecessary collection, and export/delete paths.

## 2. Data & asset inventory

| Asset | Where | Sensitivity | Notes |
|---|---|---|---|
| Resume text + extracted profile | localStorage `iq.resume` + Supabase `uploaded_resumes` (+ `career_profiles`) | **High (PII)** | RLS: admin-read only, user-scoped writes; stored indefinitely (no retention policy yet — G10) |
| Career profile, apply kits (cover letters/resumes), sessions, question bank, skills/goals | localStorage `iq.*` + `user_sync` (jsonb) | High (PII) | RLS: `auth.uid() = user_id` on every row (schema.sql) |
| AI keys (user BYOK) | localStorage `iq.apiKey` | Medium | User's own key; exfiltration risk mitigated by CSP + no-third-party scripts (G2/G12) |
| Admin email secrets (`ragEmailSecret`, `applyEmailSecret`, `recsEmailSecret`) | localStorage (admin-local keys) | **High** | Sent as headers to digest functions; exfiltration risk if XSS — move server-side (G3) |
| Auth (email/password, OAuth) | Supabase Auth | High | Sessions persisted; email confirmation on; MFA not enforced (G8) |
| Payments (razorpay/stripe) | `payments`, `subscriptions`, `entitlements`, `coupons` + provider | High | Webhook-signed, idempotent, RLS admin-only (verified — §5) |
| Jobs feed | `jobs` (public board data) | Low | Public read; written via admin-gated + service-role paths |
| Edge function secrets | Supabase Edge Function secrets (`Deno.env`) | High | Never in client bundle (verified — `.env` gitignored) |
| Site | GitHub Pages (`gaurav123337.github.io/interviewiq`) | Public | No CSP headers today (G2) |

## 3. Verified strengths (from code audit)

- **RLS everywhere**: every table enables RLS — `user_sync`, `payments`, `billing_actions`, `entitlements`, `grant_codes`, `subscriptions`, `coupons`, `app_admins`, `app_config`, `announcements`, `published_questions`, `usage_events`, `profiles`, `career_profiles`, `uploaded_resumes`, `jobs`, `pdf_*`, `question_feedback`. User rows are owner-scoped; admin tables are `is_admin()`-gated.
- **Owner-only admin grant**: `is_owner()` (PO email, `admin.sql`) — only the PO can grant/revoke admins, owner can't be revoked; enforced in security-definer RPCs server-side. Pro ≠ admin (separate entitlements, server-verified `is_admin()`).
- **Payment integrity**: `pay-webhook` verifies the provider HMAC signature (Razorpay/Stripe), constant-time compares, **idempotency** (replayed webhooks can't double-grant/double-consume coupons), coupons consumed only after payment confirms, refund policy enforced server-side (`pay-refund`), and the client's checkout callback is verified (`verifyPaymentSignature`) before any UI claim.
- **Digest broadcast is secret-gated**: the mass-email path requires `x-apply-secret === RECS_DIGEST_SECRET`; pg_cron-only by default.
- **Secrets hygiene**: `.env` gitignored; `.env.example` is templates only; service-role keys exist only as edge-function env; the client uses only the publishable anon key.
- **Escaping**: email HTML is escaped (`renderHtml`); UI renders user text as React text nodes (no `innerHTML`).
- **Deploy gates**: CI runs typecheck, the full vitest suite, Deno shared-code tests, and a RAG golden-set gate before Pages deploy.

## 4. Threat surface → controls

| Surface | Threat | Control | Status |
|---|---|---|---|
| Auth | brute force, account takeover | Supabase built-in sign-in rate limiting; email confirmation; OAuth google/github | ✅ present; ⚠️ MFA not enforced for admins (G8) |
| Authorization | horizontal/vertical privilege escalation | RLS owner-scoping + `is_admin()`/`is_owner()` RPCs; client flags are never authoritative | ✅ strong |
| Edge functions | unauthenticated abuse, SSRF, DB spam | JWT check or secret gate or public-by-design; SSRF-safe fetch; rate limits | ⚠️ **G1, G5** |
| Payments | forged webhooks, replay, refund abuse | signature verify + idempotency + server policy | ✅ strong |
| Client | XSS, exfiltration of keys | CSP + security headers, no raw HTML, no third-party scripts | ⚠️ **G2** |
| AI/LLM | prompt injection via JD/resume/resource content | untrusted-data rule, no raw content to the model | ⚠️ partly (G12) |
| UGC (resources) | malicious links/lines | L0–L5 guard (`resource-safety-guard.md`) | 📋 planned |
| Email | header injection, secret leakage | fixed from-address, escaped body, secrets → server | ⚠️ G3 |
| CI/CD | compromised actions, leaked secrets | pinned deps, npm audit, SHA-pinned actions | ⚠️ G7 |
| PII | retention, breach blast radius | export/delete, retention policy, object storage for resumes | ⚠️ G10, G11 |

## 5. Edge-function protocol (the gaps that matter)

Every edge function must declare one of three auth modes — and enforce it:

1. **`jwt`** — verify the caller's Supabase JWT (`supabase.auth.getUser(authHeader)`) and scope data to `user.id`. Pay-* functions already do this. ✅
2. **`secret`** — a shared secret for internal/system callers (digest broadcast, pg_cron). ✅ for `send-recommendations-digest`; ⚠️ the on-demand email path accepts a client-supplied `x-resend-key` — remove; the key must live server-side only (G3/G6).
3. **`public`** — genuinely public by design, **and then it must be non-destructive, rate-limited, and SSRF-safe.** This is where the audit found the real holes:

### G1 — SSRF in `import-job` (fix first, P0)
`import-job` fetches an **arbitrary user-supplied URL** with only scheme + robots.txt checks. With `--no-verify-jwt` and CORS reflecting any origin, *any website* can drive it. Risks: probing cloud metadata (`169.254.169.254`), internal Supabase endpoints, and using the function as an open fetcher/proxy. **Fix**: a shared `safeFetch` helper (protocol: https-only, resolve DNS, reject private/reserved/loopback IPs and IP-literal hosts, block metadata ranges, follow ≤ 3 redirects re-checking each hop, 15s timeout, 2MB cap, deny-list + allow-list of known job-board hosts, robots.txt check retained). Same helper used by `jobs-fetch`, `resource-review` (planned), and any future fetcher.

### G5 — public functions lack rate limiting + origin policy
`jobs-fetch` (writes the shared `jobs` table via service role) and `import-job` (outbound fetches) are `--no-verify-jwt` with `Access-Control-Allow-Origin: <any origin>`. Anyone can: spam the jobs table with garbage (poisons the feed/digests), or burn fetch quota. **Fix**: (a) CORS to an explicit allow-list (the site origin + `null` for dev) instead of reflecting; (b) per-IP + per-key rate limits (e.g., jobs-fetch ≤ 1/5min, import-job ≤ 10/min); (c) jobs-fetch requires a lightweight shared secret (or JWT with an admin claim) — it's an admin-triggered refresh, not a public endpoint; the client's scheduled refresh can use the secret stored server-side and exposed via a scoped RPC.

### G6 — digest email CORS + client-supplied key
The digest functions reflect any origin and accept `x-resend-key` from the client. The admin UI passing its own key is the current workaround for "no server secret" — replace with a server-side `RESEND_API_KEY` (already supported) and drop the client key path entirely.

## 6. Client-side protocol

- **CSP (G2, P0)**: add a strict Content-Security-Policy (default-src 'self'; script-src 'self'; no unsafe-inline/unsafe-eval; connect-src to supabase + AI endpoints; img-src https: data:). GitHub Pages can't set headers, so ship a `<meta http-equiv="Content-Security-Policy">` in `index.html` + the same in the service worker's shell response. This is the single highest-leverage XSS mitigation.
- **No raw HTML**: keep the no-`innerHTML` rule (React text nodes, escaped). Add a lint rule that fails on `dangerouslySetInnerHTML` / `innerHTML`.
- **Keys**: AI BYOK keys stay in localStorage (user's choice, documented) — CSP + no third-party scripts keep them safer; never log them.
- **Admin secrets (G3, P0)**: move the digest email secrets out of localStorage into edge-function env; the admin UI calls the function, which uses its own secret. localStorage stores at most a *capability hint*, never the secret itself.

## 7. Authorization protocol (enforced server-side, always)

- **New tables → RLS on day one** with explicit policies (default deny; user-scoped `auth.uid() = user_id`; admin tables `is_admin()`).
- **Admin actions go through security-definer RPCs** that re-check `is_admin()`/`is_owner()`; the client flag is cosmetic.
- **Role ladder**: `user < pro (entitlement) < admin < owner`. Pro ≠ admin; admin ≠ Pro. Only `is_owner()` grants admin. Nothing bypasses the paywall except `is_admin()` (server-verified) — and even admins have their own limits (no Pro auto-grant).
- **Audit (G9, P1)**: add an `admin_audit` table (actor, action, target, ts, note) written by every admin RPC; surface in Admin as a read-only log. Payments already have this via `billing_actions`.

## 8. AI / LLM protocol

The app is BYOK (user's own model key, called from the client). Controls:
- **Untrusted-data rule**: anything fetched or pasted (job descriptions, resumes, imported pages, future resource content) is data, never instructions. The system prompt states it; content is summarized/sanitized before use, never passed raw where avoidable.
- **No raw UGC into prompts**: titles/notes/saved-links are plain text with length caps (L0 in `resource-safety-guard.md`); future personalized plans read app-generated summaries + metadata, not raw pages.
- **Exfiltration hardening**: the AI never receives secrets (never put admin secrets/keys in prompt context); answers render as plain text.
- **Fail-closed classifier** (planned): the prompt-injection heuristics + optional AI second opinion from the guard extend to *all* AI-consuming surfaces, not just resources.

## 9. CI/CD & dependency protocol

- **Supply chain (G7, P1)**: run `npm audit --omit=dev` (or `npm audit --audit-level=high`) in CI as a deploy gate; enable GitHub Dependabot (npm + actions); pin third-party Actions by **commit SHA** (currently tag-pinned `@v5`/`@v2`) with a comment; keep `package-lock.json` committed (already ✅).
- **Secrets**: only GitHub Secrets + Supabase Edge Function secrets; never in repo (`.env` gitignored ✅); rotate on personnel change; the `SUPABASE_ACCESS_TOKEN` in CI is scoped to this project.
- **Build provenance**: build is hermetic (`npm ci`), deploy is immutable (Pages artifact), edge functions deployed explicitly per function (list in `deploy.yml` — new functions must be added there or they silently stay stale).

## 10. PII, privacy & retention

- **Export**: add a "Download my data" in Settings — dumps all `iq.*` keys (already local) + pulls `user_sync`/`uploaded_resumes` rows as JSON (P1).
- **Delete**: "Delete my account" → deletes `user_sync`, `uploaded_resumes`, `career_profiles`, `usage_events` rows (cascade) and the auth user; payments rows are retained masked per provider/billing-law (legal requirement — document it) (P1).
- **Retention (G10)**: uploaded_resumes currently stored forever. Add a retention window (e.g., 12 months since last sync) + admin cleanup job; document in a privacy policy.
- **Resume storage (G11, P2)**: move full resume text to Supabase Storage objects (private bucket, signed URLs, RLS via `storage.objects` policies) with `uploaded_resumes` holding only the extracted profile + object id — shrinks PII blast radius and enables per-object lifecycle rules.

## 11. Incident response & keeping it current

- **Kill switches**: revoke resource (already planned in the guard), revoke an admin (owner-only RPC exists ✅), suspend a user (add `profiles.suspended` checked by RLS-aware RPCs), disable paywall remotely (existing `remoteConfig`).
- **Report & quarantine**: the guard's 🚩 flow; extend a generic "report" to jobs/feed items (a bad imported URL) with auto-quarantine.
- **Security regression suite (generalize the guard's)**: a `security-regression.test.ts` — must-block URLs (metadata endpoints, private IPs, IP-literals, shortener chains), must-reject inputs (HTML in title/note, oversized fields), must-verify RLS policy shapes (SQL fixture scan). Runs in CI on every change to security-relevant modules.
- **Cadence**: quarterly security review (this doc re-audited, diff vs last commit), dependency audit monthly (Dependabot), secret rotation yearly + on incident, and a **post-incident protocol**: reproduce → fix → add regression case → re-audit §3–§9.

## 12. Gap roadmap

| Priority | Item | Refs |
|---|---|---|
| **P0** | SSRF-safe `safeFetch` + fix `import-job` (and `jobs-fetch`) | G1, §5 |
| **P0** | CSP + security headers (meta + SW shell); `no-innerHTML` lint | G2, §6 |
| **P0** | Move admin email secrets server-side; drop client `x-resend-key` | G3/G6, §5 |
| **P0** | Flip `testLicensing` off; enforce server entitlements only | G4 |
| **P0** | Rate limits + explicit CORS allow-list on public functions; secret-gate `jobs-fetch` | G5, §5 |
| **P1** | `npm audit` gate + Dependabot + SHA-pinned actions | G7, §9 |
| **P1** | Admin MFA (TOTP) + strong password policy for owner/admin | G8 |
| **P1** | `admin_audit` log + "Download my data" + "Delete account" | G9, §10 |
| **P1** | Resume retention policy + privacy policy | G10 |
| **P2** | Resumes → private Storage bucket + signed URLs + lifecycle | G11, §10 |
| **P2** | Security regression suite in CI; generic report/quarantine for feed items | §11 |
| **P2** | Fail-closed AI prompt-injection classifier across all AI surfaces | §8 |

## 13. Open questions

1. **CSP strictness** — a strict CSP can break the offline PWA's inline styles/tailwind; how aggressive should the first cut be (`unsafe-inline` styles allowed, scripts strict)?
2. **jobs-fetch gating** — shared secret exposed to the client via a scoped RPC vs admin-only trigger vs keep public + rate-limited? (Recommend secret via RPC.)
3. **MFA** — enforce for owner/admin only, or offer to all users?
4. **Retention length** — default resume retention (12 months?) and what to do with `payments` records (provider/billing-law requires keeping some)?
5. **AI relay** — eventually move AI calls server-side (key + output moderation, consistent prompt hygiene) vs keep BYOK client-direct? (BYOK is a privacy feature; a relay is a control feature — could be both: relay only for Pro.)
