/* Content Quality Scorer — LLM-as-Judge for content curation.
   Evaluates scraped content on 5 dimensions:
     1. Accuracy     — factual correctness and verifiability
     2. Relevance    — usefulness for interview preparation
     3. Depth        — completeness and thoroughness
     4. Freshness    — how current the information is
     5. Credibility  — source authority and trustworthiness

   Uses the existing AI settings (BYOK or cloud proxy) to call the LLM.
   Returns structured scores + reasoning for admin review. */

import { getSupabaseClient, getCloudState } from "./cloud";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface QualityScores {
  overall: number;        // composite 0-100
  accuracy: number;       // 0-100
  relevance: number;      // 0-100
  depth: number;          // 0-100
  freshness: number;      // 0-100
  credibility: number;    // 0-100
}

export interface QualityVerdict {
  scores: QualityScores;
  notes: string;          // AI reasoning
  model: string;
  passedThreshold: boolean;
  autoApproved: boolean;
  checkedAt: string;
}

/* ── Thresholds (admin-configurable from content_quality_config) ───────── */

interface QualityThresholds {
  minOverall: number;       // default 60
  minAccuracy: number;      // default 50
  minCredibility: number;   // default 60
  autoApproveAbove: number; // default 85
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  minOverall: 60,
  minAccuracy: 50,
  minCredibility: 60,
  autoApproveAbove: 85,
};

async function getThresholds(): Promise<QualityThresholds> {
  try {
    const client = await getSupabaseClient();
    if (!client) return DEFAULT_THRESHOLDS;
    const { data } = await client
      .from("content_quality_config")
      .select("value")
      .eq("key", "thresholds")
      .maybeSingle();
    if (!data?.value) return DEFAULT_THRESHOLDS;
    return { ...DEFAULT_THRESHOLDS, ...(data.value as Partial<QualityThresholds>) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

/* ── Quality scoring prompt ────────────────────────────────────────────── */

function buildScoringPrompt(
  title: string,
  content: string,
  sourceName: string,
  domain: string,
  contentType: string,
): { system: string; user: string } {
  const truncated = content.slice(0, 4000); // cap for token budget

  const system = `You are a senior content quality reviewer for an interview preparation platform.
Evaluate the following content on 5 dimensions. Be strict but fair.

SCORING CRITERIA:
- Accuracy (0-100): Are the facts verifiable? Any obvious errors or outdated info?
- Relevance (0-100): How useful is this for someone preparing for tech interviews?
- Depth (0-100): Is it thorough and well-explained, or superficial?
- Freshness (0-100): Is the information current? Does it reference recent trends/versions?
- Credibility (0-100): Does the source domain and writing quality suggest authority?

RESPOND IN EXACTLY THIS JSON FORMAT:
{
  "accuracy": <number 0-100>,
  "relevance": <number 0-100>,
  "depth": <number 0-100>,
  "freshness": <number 0-100>,
  "credibility": <number 0-100>,
  "notes": "<2-3 sentence reasoning>"
}

DO NOT include any text outside the JSON block.`;

  const user = `SOURCE: ${sourceName} (${domain})
TYPE: ${contentType}
TITLE: ${title}

CONTENT:
${truncated}

Evaluate this content's quality for an interview preparation platform.`;

  return { system, user };
}

/* ── Parse LLM response ────────────────────────────────────────────────── */

function parseScores(raw: string): QualityScores | null {
  try {
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    const clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));
    return {
      overall: 0, // computed below
      accuracy: clamp(parsed.accuracy),
      relevance: clamp(parsed.relevance),
      depth: clamp(parsed.depth),
      freshness: clamp(parsed.freshness),
      credibility: clamp(parsed.credibility),
    };
  } catch {
    return null;
  }
}

/** Compute composite score: weighted average of dimensions. */
function computeOverall(scores: Omit<QualityScores, "overall">): number {
  // Weights: accuracy and credibility matter most for interview prep
  const weights = {
    accuracy: 0.30,
    relevance: 0.20,
    depth: 0.15,
    freshness: 0.15,
    credibility: 0.20,
  };
  const total =
    scores.accuracy * weights.accuracy +
    scores.relevance * weights.relevance +
    scores.depth * weights.depth +
    scores.freshness * weights.freshness +
    scores.credibility * weights.credibility;
  return Math.round(total);
}

/* ── Main scoring function ─────────────────────────────────────────────── */

/** Score a single content item using the LLM-as-Judge approach. */
export async function scoreContent(params: {
  title: string;
  content: string;
  sourceName: string;
  domain: string;
  contentType: string;
  model?: string;
}): Promise<QualityVerdict> {
  const { title, content, sourceName, domain, contentType, model = "gpt-4o-mini" } = params;

  const { system, user } = buildScoringPrompt(title, content, sourceName, domain, contentType);

  // Call AI using the same pattern as the main ai module
  const settings = getAiSettingsForScoring(model);
  if (!settings) {
    throw new Error("No AI key configured for quality scoring");
  }

  const start = Date.now();
  const res = await fetch(settings.base + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1, // low temp for consistent scoring
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    throw new Error(`Quality scoring API failed (${res.status})`);
  }

  const body = await res.json();
  const rawText = (body.choices?.[0]?.message?.content ?? "").trim();
  const latencyMs = Date.now() - start;

  const scores = parseScores(rawText);
  if (!scores) {
    throw new Error("Failed to parse quality scores from AI response");
  }

  const overall = computeOverall(scores);
  const allScores = { ...scores, overall };

  const thresholds = await getThresholds();
  const passedThreshold =
    allScores.overall >= thresholds.minOverall &&
    allScores.accuracy >= thresholds.minAccuracy &&
    allScores.credibility >= thresholds.minCredibility;
  const autoApproved = allScores.overall >= thresholds.autoApproveAbove;

  const notes = rawText.match(/"notes"\s*:\s*"([^"]*)"/)?.[1] ?? "Scored by LLM-as-Judge";

  return {
    scores: allScores,
    notes,
    model,
    passedThreshold,
    autoApproved,
    checkedAt: new Date().toISOString(),
  };
}

/** Score a content item and update it in the database. */
export async function scoreAndUpdateContent(
  contentId: string,
): Promise<QualityVerdict> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  // Fetch the content item
  const { data: item, error: fetchError } = await client
    .from("content_items")
    .select("title, content, source_name, domain, content_type")
    .eq("id", contentId)
    .single();

  if (fetchError || !item) throw new Error("Content item not found");

  // Get scoring model from config
  let scoringModel = "gpt-4o-mini";
  try {
    const { data: config } = await client
      .from("content_quality_config")
      .select("value")
      .eq("key", "scoring")
      .maybeSingle();
    if (config?.value?.model) scoringModel = config.value.model;
  } catch { /* use default */ }

  // Score it
  const verdict = await scoreContent({
    title: item.title,
    content: item.content,
    sourceName: item.source_name,
    domain: item.domain,
    contentType: item.content_type,
    model: scoringModel,
  });

  // Generate summary
  const summary = await generateSummary(item.title, item.content, scoringModel).catch(() => null);

  // Update the content item
  const { error: updateError } = await client
    .from("content_items")
    .update({
      quality_score: verdict.scores.overall,
      accuracy_score: verdict.scores.accuracy,
      relevance_score: verdict.scores.relevance,
      depth_score: verdict.scores.depth,
      freshness_score: verdict.scores.freshness,
      credibility_score: verdict.scores.credibility,
      quality_notes: verdict.notes,
      quality_model: verdict.model,
      quality_checked_at: verdict.checkedAt,
      summary: summary,
      status: verdict.autoApproved
        ? "approved"
        : verdict.passedThreshold
          ? "pending"
          : "pending", // still goes to review, but flagged
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  if (updateError) throw updateError;

  return verdict;
}

/** Generate a 2-3 sentence summary of content. */
async function generateSummary(
  title: string,
  content: string,
  model: string,
): Promise<string | null> {
  const settings = getAiSettingsForScoring(model);
  if (!settings) return null;

  const truncated = content.slice(0, 3000);
  const res = await fetch(settings.base + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Summarize the following article in 2-3 concise sentences. Focus on the key takeaway for interview preparation.",
        },
        {
          role: "user",
          content: `TITLE: ${title}\n\nCONTENT:\n${truncated}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    }),
  });

  if (!res.ok) return null;
  const body = await res.json();
  return (body.choices?.[0]?.message?.content ?? "").trim() || null;
}

/* ── AI settings resolution ────────────────────────────────────────────── */

function getAiSettingsForScoring(model: string): { key: string; base: string; model: string } | null {
  // Try user's local settings first
  try {
    const stored = localStorage.getItem("ai_settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.key) return { key: parsed.key, base: parsed.base || "https://api.openai.com/v1", model };
    }
  } catch { /* ignore */ }

  // Try cloud state (BYOK via settings)
  try {
    const cloud = getCloudState();
    if (cloud.user) {
      // Cloud users without their own key go through edge function
      // For now, require BYOK for quality scoring
    }
  } catch { /* ignore */ }

  return null;
}

/** Batch score all pending content items that haven't been scored yet */
export async function batchScoreContent(): Promise<{ scored: number; errors: number }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  // Fetch pending items without quality scores
  const { data: items, error: fetchError } = await client
    .from("content_items")
    .select("id, title, content, source_name, domain, content_type")
    .eq("status", "pending")
    .is("quality_score", null)
    .limit(10);

  if (fetchError) throw fetchError;
  if (!items?.length) return { scored: 0, errors: 0 };

  let scored = 0;
  let errors = 0;

  for (const item of items) {
    try {
      await scoreAndUpdateContent(item.id);
      scored++;
    } catch {
      errors++;
    }
    // Rate limit between AI calls
    await new Promise(r => setTimeout(r, 2000));
  }

  return { scored, errors };
}
