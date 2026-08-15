/* trends-refresh — the weekly market-signal sweep (docs/skill-counselor.md §4).
   Tier 1 (always): counts skill mentions in OUR OWN job corpus (ATS + RSS +
   RemoteOK + imports — already fetched, zero new infra) for the last 30 days
   vs the prior 90.
   Tier 2 (best-effort): keyless npm download deltas (api.npmjs.org) and
   GitHub latest-release recency for the canonical repos.
   The blend (computeTrendScore / classifyStage — shared with the client) is
   stored per skill in skill_signals; PRESENTATION (badges) applies
   automatically, structural changes are emitted as update_proposals that only
   an admin can accept/ignore (the recorded decision).

   Triggered by pg_cron (supabase/trends-refresh-cron.sql) with the
   TRENDS_REFRESH_SECRET header, or by an admin via their JWT (requireAdmin). */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { serviceClient } from "../_shared/serviceClient.ts";
import {
  SKILL_KEYWORDS, SKILL_NPM, SKILL_REPO,
  classifyStage, computeTrendScore, mentionsIn, proposalsFromSignals
} from "../_shared/trends.ts";

const limitSweep = makeLimiter(1, 60_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ ok: false, error: "origin not allowed" }), { status: 403, headers });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers });
    }
    const secret = Deno.env.get("TRENDS_REFRESH_SECRET") ?? "";
    const sent = (req.headers.get("x-trends-secret") ?? "").trim();
    const admin = await requireAdmin(req);
    if (!((secret !== "" && sent === secret) || admin)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden — cron secret or admin session required" }), { status: 401, headers });
    }
    if (!limitSweep(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "sweep already running" }), { status: 429, headers });
    }

    const service = serviceClient();
    const now = Date.now();
    const day = 86_400_000;
    const since30 = new Date(now - 30 * day).toISOString();
    const since90 = new Date(now - 90 * day).toISOString();

    const { data: jobs30, error: e30 } = await service.from("jobs")
      .select("description, skills").gte("posted_at", since30);
    const { data: jobs90, error: e90 } = await service.from("jobs")
      .select("description, skills").lt("posted_at", since30).gte("posted_at", since90);
    if (e30 || e90) return json(headers, 500, { ok: false, error: (e30 ?? e90)?.message });

    const rows30 = (jobs30 ?? []) as { description?: string; skills?: string[] }[];
    const rows90 = (jobs90 ?? []) as { description?: string; skills?: string[] }[];

    /* npm deltas (keyless) — one range call per package, split in half */
    const npmDeltas = await fetchNpmDeltas(service);

    /* GitHub release recency (best-effort; token optional for headroom) */
    const ghRecent = await fetchGithubRecency(service);

    /* per-skill signals + shares */
    const skillIds = Object.keys(SKILL_KEYWORDS);
    const total30 = skillIds.reduce((n, id) => n + mentionsIn(rows30, SKILL_KEYWORDS[id]), 0) || 1;
    const signals = skillIds.map((id) => {
      const job30 = mentionsIn(rows30, SKILL_KEYWORDS[id]);
      const job90 = mentionsIn(rows90, SKILL_KEYWORDS[id]);
      return {
        skillId: id,
        job30,
        job90,
        share: job30 / total30,
        npmDelta: npmDeltas[id] ?? null,
        githubRecent: ghRecent[id] ?? false
      };
    });

    /* previous stages (for crossing detection) */
    const { data: prevRows } = await service.from("skill_signals")
      .select("skill_id, stage").order("window_start", { ascending: false }).limit(400);
    const prevStages: Record<string, string> = {};
    for (const r of (prevRows ?? []) as { skill_id: string; stage: string }[]) {
      if (!(r.skill_id in prevStages)) prevStages[r.skill_id] = r.stage;
    }

    const windowStart = new Date().toISOString().slice(0, 10);
    const stored: { skill_id: string; window_start: string; job_mentions_30d: number; job_mentions_90d: number; share: number; npm_delta: number | null; trend_score: number; stage: string }[] = [];
    for (const s of signals) {
      const score = computeTrendScore(s);
      const stage = classifyStage(score);
      stored.push({
        skill_id: s.skillId,
        window_start: windowStart,
        job_mentions_30d: s.job30,
        job_mentions_90d: s.job90,
        share: s.share ?? 0,
        npm_delta: s.npmDelta ?? null,
        trend_score: score,
        stage
      });
    }
    const { error: upsertErr } = await service.from("skill_signals").upsert(stored, { onConflict: "skill_id,window_start" });
    if (upsertErr) return json(headers, 500, { ok: false, error: upsertErr.message });

    /* structural proposals — admin gate */
    const proposals = proposalsFromSignals(signals, prevStages as Record<string, import("../_shared/trends.ts").TrendStage>);
    let proposed = 0;
    if (proposals.length) {
      const { error: propErr } = await service.from("update_proposals").insert(
        proposals.map(p => ({
          skill_id: p.skillId, kind: p.kind, reason: p.reason,
          signals: JSON.parse(JSON.stringify(p.signals))
        }))
      );
      if (propErr) return json(headers, 500, { ok: false, error: propErr.message });
      proposed = proposals.length;
    }

    return json(headers, 200, {
      ok: true,
      window: windowStart,
      skills: stored.length,
      jobs30: rows30.length,
      jobs90: rows90.length,
      proposed,
      summary: stored.slice().sort((a, b) => b.trend_score - a.trend_score).slice(0, 8).map(s => `${s.skill_id}:${s.stage}(${Math.round(s.trend_score)})`)
    });
  } catch (e) {
    return json(headers, 500, { ok: false, error: e instanceof Error ? e.message : "trend refresh failed" });
  }
});

async function fetchNpmDeltas(service: SupabaseClient): Promise<Record<string, number>> {
  void service;
  const out: Record<string, number> = {};
  const day = 86_400_000;
  const now = Date.now();
  for (const [id, pkg] of Object.entries(SKILL_NPM)) {
    try {
      const start = new Date(now - 14 * day).toISOString().slice(0, 10);
      const end = new Date(now).toISOString().slice(0, 10);
      const res = await fetch(`https://api.npmjs.org/downloads/range/${start}:${end}/${pkg}`, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as { downloads?: { day: string; downloads: number }[] };
      const days = data.downloads ?? [];
      const recent = days.slice(7).reduce((n, d) => n + d.downloads, 0);
      const prior = days.slice(0, 7).reduce((n, d) => n + d.downloads, 0);
      if (prior > 0) out[id] = (recent - prior) / prior;
    } catch { /* tier-2 is best-effort */ }
  }
  return out;
}

async function fetchGithubRecency(service: SupabaseClient): Promise<Record<string, boolean>> {
  void service;
  const out: Record<string, boolean> = {};
  const token = Deno.env.get("GITHUB_TOKEN") ?? "";
  const day = 86_400_000;
  for (const [id, repo] of Object.entries(SKILL_REPO)) {
    try {
      const headers: Record<string, string> = { accept: "application/vnd.github+json" };
      if (token) headers["authorization"] = `Bearer ${token}`;
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
      if (!res.ok) continue;
      const rel = (await res.json()) as { published_at?: string; name?: string };
      if (rel.published_at && Date.now() - new Date(rel.published_at).getTime() < 90 * day) out[id] = true;
    } catch { /* best-effort */ }
  }
  return out;
}

function json(headers: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
