/* Content Quality Scorer — LLM-as-Judge for content curation.
   Uses the project's existing multi-provider AI infrastructure:
   - BYOK (user's own API key) → direct call with fallback chain
   - Cloud proxy (ai-chat edge function) → admin-configured provider
   - Supports any OpenAI-compatible endpoint

   Evaluates scraped content on 5 dimensions:
     1. Accuracy     — factual correctness and verifiability
     2. Relevance    — usefulness for interview preparation
     3. Depth        — completeness and thoroughness
     4. Freshness    — how current the information is
     5. Credibility  — source authority and trustworthiness

   Returns structured scores + reasoning for admin review. */

import { chat, type ChatMessage } from "../ai";
import { getSupabaseClient } from "./cloud";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface QualityScores {
  overall: number;
  accuracy: number;
  relevance: number;
  depth: number;
  freshness: number;
  credibility: number;
}

export interface QualityVerdict {
  scores: QualityScores;
  notes: string;
  model: string;
  passedThreshold: boolean;
  autoApproved: boolean;
  checkedAt: string;
}

/* ── Thresholds (admin-configurable from content_quality_config) ───────── */

interface QualityThresholds {
  minOverall: number;
  minAccuracy: number;
  minCredibility: number;
  autoApproveAbove: number;
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

function buildScoringMessages(
  title: string,
  content: string,
  sourceName: string,
  domain: string,
  contentType: string,
): ChatMessage[] {
  const truncated = content.slice(0, 4000);

  return [
    {
      role: "system",
      content: [
        "You are a senior content quality reviewer for an interview preparation platform.",
        "Evaluate the following content on 5 dimensions. Be strict but fair.",
        "",
        "SCORING CRITERIA:",
        "- Accuracy (0-100): Are the facts verifiable? Any obvious errors or outdated info?",
        "- Relevance (0-100): How useful is this for someone preparing for tech interviews?",
        "- Depth (0-100): Is it thorough and well-explained, or superficial?",
        "- Freshness (0-100): Is the information current? Does it reference recent trends/versions?",
        "- Credibility (0-100): Does the source domain and writing quality suggest authority?",
        "",
        "RESPOND IN EXACTLY THIS JSON FORMAT:",
        "{",
        '  "accuracy": <number 0-100>,',
        '  "relevance": <number 0-100>,',
        '  "depth": <number 0-100>,',
        '  "freshness": <number 0-100>,',
        '  "credibility": <number 0-100>,',
        '  "notes": "<2-3 sentence reasoning>"',
        "}",
        "",
        "DO NOT include any text outside the JSON block.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "SOURCE: " + sourceName + " (" + domain + ")",
        "TYPE: " + contentType,
        "TITLE: " + title,
        "",
        "CONTENT:",
        truncated,
        "",
        "Evaluate this content's quality for an interview preparation platform.",
      ].join("\n"),
    },
  ];
}

/* ── Parse LLM response ────────────────────────────────────────────────── */

function parseScores(raw: string): QualityScores | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    const clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));
    return {
      overall: 0,
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

function computeOverall(scores: Omit<QualityScores, "overall">): number {
  const weights = {
    accuracy: 0.30,
    relevance: 0.20,
    depth: 0.15,
    freshness: 0.15,
    credibility: 0.20,
  };
  return Math.round(
    scores.accuracy * weights.accuracy +
    scores.relevance * weights.relevance +
    scores.depth * weights.depth +
    scores.freshness * weights.freshness +
    scores.credibility * weights.credibility,
  );
}

/* ── Main scoring function ─────────────────────────────────────────────── */

/**
 * Score a single content item using LLM-as-Judge.
 * Uses the project's multi-provider chat (BYOK or cloud proxy).
 */
export async function scoreContent(params: {
  title: string;
  content: string;
  sourceName: string;
  domain: string;
  contentType: string;
}): Promise<QualityVerdict> {
  const { title, content, sourceName, domain, contentType } = params;

  const messages = buildScoringMessages(title, content, sourceName, domain, contentType);

  // Use multi-provider chat (handles BYOK, cloud proxy, fallback chain)
  const rawText = await chat(messages, {
    temperature: 0.1,
    maxTokens: 300,
    module: "contentQuality",
  });

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
    model: "multi-provider",
    passedThreshold,
    autoApproved,
    checkedAt: new Date().toISOString(),
  };
}

/** Score a content item and update it in the database. */
export async function scoreAndUpdateContent(contentId: string): Promise<QualityVerdict> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  const { data: item, error: fetchError } = await client
    .from("content_items")
    .select("title, content, source_name, domain, content_type")
    .eq("id", contentId)
    .single();

  if (fetchError || !item) throw new Error("Content item not found");

  const verdict = await scoreContent({
    title: item.title,
    content: item.content,
    sourceName: item.source_name,
    domain: item.domain,
    contentType: item.content_type,
  });

  // Generate summary using the same multi-provider chat
  const summary = await generateSummary(item.title, item.content).catch(() => null);

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
      status: verdict.autoApproved ? "approved" : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  if (updateError) throw updateError;

  return verdict;
}

/** Generate a 2-3 sentence summary of content. */
async function generateSummary(title: string, content: string): Promise<string | null> {
  const truncated = content.slice(0, 3000);

  try {
    const result = await chat(
      [
        {
          role: "system",
          content: "Summarize the following article in 2-3 concise sentences. Focus on the key takeaway for interview preparation.",
        },
        {
          role: "user",
          content: "TITLE: " + title + "\n\nCONTENT:\n" + truncated,
        },
      ],
      { temperature: 0.3, maxTokens: 150, module: "contentQuality" },
    );
    return result || null;
  } catch {
    return null;
  }
}

/** Batch score all pending content items that haven't been scored yet */
export async function batchScoreContent(): Promise<{ scored: number; errors: number }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

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
    await new Promise(r => setTimeout(r, 2000));
  }

  return { scored, errors };
}
