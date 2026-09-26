/* Model picker — after a key is saved, discover which models on the provider
   ACTUALLY WORK (live 1-token probes through the ai-chat edge function, which
   holds the key) and describe what each model handles optimally, so the owner
   can pick at a glance. Yesterday's gateway proved a listing is not a
   guarantee: listed models can 524 upstream or 403 on price — only a probe
   tells the truth.

   Also powers the 2-minute idle fallback: when the saved model is broken and
   the owner picks nothing, the pipeline self-heals onto the best probeable
   model (applyProviderModel needs no key re-entry — server-side patch). */

import { fetchAvailableModels, clearModelCache, type AiModel } from "./aiModels";
import { CONFIG } from "../config";
import { getSupabaseClient, getCloudState } from "./cloud";

/* ── types ─────────────────────────────────────────────────────────────── */

export interface ModelOption {
  id: string;
  name: string;
  /** Plain-language: what task this model handles optimally. */
  task: string;
  tags: string[];
  isThinking: boolean;
  latencyMs: number;
  /** Sorted rank — lower is a better default pick. */
  rank: number;
  recommended?: boolean;
}

export interface RejectedModel {
  model: string;
  httpStatus: number;
  note: string;
}

export interface ProbeReport {
  /** Working models, ranked best-default first. */
  options: ModelOption[];
  /** Listed models that failed the live probe (dead upstream, priced out…). */
  rejected: RejectedModel[];
  /** How many models were probed in total. */
  scanned: number;
}

export interface ProbeVerdict {
  model: string;
  status: "ok" | "failed";
  httpStatus: number;
  latencyMs: number;
  sample: string;
  quota?: string;
}

/* ── task descriptions ─────────────────────────────────────────────────── */

/** Fast/cheap model families — also the auto-pick preference. */
export const AUTO_PICK_MODEL_RE = /(flash|mini|lite|nano|fast|turbo|instant|small|haiku|air)/i;

/** What task does this model handle optimally? Derived from its id + the
    provider's capability tags — deliberately conservative wording. */
export function describeTask(id: string, tags: string[]): string {
  const lower = id.toLowerCase();
  if (tags.includes("embeddings")) return "Turns text into vectors for semantic search — not a chat model.";
  if (/seedream|image|imagine/.test(lower)) return "Image generation — not for text output.";
  if (/seedance|kling|hailuo|video/.test(lower)) return "Video generation — not for chat.";
  if (/-vl|vision|multimodal/.test(lower)) return "Sees images as well as text — use for screenshots and visual Q&A.";
  if (tags.includes("code") || /coder|codestral/.test(lower)) return "Best for code generation, debugging, and technical walkthroughs.";
  if (tags.includes("thinking")) return "Deep multi-step reasoning — slower and pricier; strongest on hard analysis, math, and design questions.";
  if (AUTO_PICK_MODEL_RE.test(lower)) return "Fast and inexpensive — great default for chat, feedback, summaries, and high-volume jobs.";
  if (/opus|ultra|max|pro\b/.test(lower)) return "Flagship quality for writing and analysis — heavier, slower, pricier.";
  if (/gemini|gpt|grok|llama|glm|qwen|kimi|minimax|deepseek|mistral/.test(lower)) return "General-purpose chat: strong at explanations, drafting, and interview answers.";
  return "General-purpose chat model.";
}

/** Deterministic rank for the auto-pick: the pipeline runs high-volume,
    strict-JSON jobs, so fast/cheap non-thinking models win; flagships and
    non-chat families lose; probe latency breaks ties. */
export function rankFor(m: { id: string; tags: string[]; latencyMs: number }): number {
  const lower = m.id.toLowerCase();
  let score = 100;
  if (AUTO_PICK_MODEL_RE.test(lower)) score -= 40;
  if (!m.tags.includes("thinking")) score -= 10;
  if (/opus|ultra|max/.test(lower)) score += 25;
  /* non-chat families (by id OR capability tag — "bge-m3" says embeddings
     only through its tag) can't serve the pipeline at all */
  if (m.tags.includes("embeddings") || /image|vl|vision|embed|video|tts|whisper/.test(lower)) score += 200;
  score += Math.min(20, Math.round(m.latencyMs / 500));
  return score;
}

/* ── merge listing + verdicts ──────────────────────────────────────────── */

export function buildModelOptions(listed: AiModel[], verdicts: ProbeVerdict[]): ProbeReport {
  const byId = new Map(verdicts.map(v => [v.model, v]));
  const options: ModelOption[] = [];
  const rejected: RejectedModel[] = [];
  for (const m of listed) {
    const v = byId.get(m.id);
    if (!v) continue; // not probed (cap hit) — never auto-suggest an unverified model
    if (v.status !== "ok") {
      rejected.push({
        model: m.id,
        httpStatus: v.httpStatus,
        note: v.quota ? `${v.sample} — ${v.quota}` : v.sample || `HTTP ${v.httpStatus}`
      });
      continue;
    }
    options.push({
      id: m.id,
      name: m.name,
      task: describeTask(m.id, m.tags),
      tags: m.tags,
      isThinking: m.isThinking,
      latencyMs: v.latencyMs,
      rank: rankFor({ id: m.id, tags: m.tags, latencyMs: v.latencyMs })
    });
  }
  options.sort((a, b) => a.rank - b.rank || a.latencyMs - b.latencyMs);
  if (options[0]) options[0].recommended = true;
  return { options, rejected, scanned: verdicts.length };
}

/* ── the scan itself ───────────────────────────────────────────────────── */

/** Authed POST to the ai-chat edge function (same ladder as GET /models). */
async function authedEdgeFetch(payload: unknown): Promise<Response> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in to your cloud account first.");
  return fetch(`${CONFIG.supabase.url}/functions/v1/ai-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": CONFIG.supabase.anonKey },
    body: JSON.stringify(payload)
  });
}

/** List + live-probe + rank every chat model on the configured provider. */
export async function scanProviderModels(force = false): Promise<ProbeReport> {
  const listed = await fetchAvailableModels(force);
  if (!listed.length) throw new Error("Couldn't list models — check the key and base URL, then retry.");
  const res = await authedEdgeFetch({ action: "probe-models" });
  const body = await res.json().catch(() => ({} as { verdicts?: ProbeVerdict[]; error?: string }));
  if (!res.ok || !Array.isArray(body.verdicts)) {
    throw new Error(body.error ?? `Model probe failed (HTTP ${res.status}).`);
  }
  return buildModelOptions(listed, body.verdicts);
}

/** Deterministic auto-pick — the top-ranked working option. */
export function autoPick(report: ProbeReport): ModelOption | null {
  return report.options[0] ?? null;
}

/* ── apply ─────────────────────────────────────────────────────────────── */

/** Switches the saved provider config onto `model` — server-side patch, so
    the key never has to be re-entered. Admin-gated by the edge function. */
export async function applyProviderModel(model: string): Promise<void> {
  const res = await authedEdgeFetch({ action: "set-provider-model", model });
  const body = await res.json().catch(() => ({} as { error?: string }));
  if (!res.ok || !(body as { ok?: boolean }).ok) {
    throw new Error(body.error ?? `Could not switch models (HTTP ${res.status}).`);
  }
  clearModelCache();
}
