/* Concept-graph retrieval — Phase 2 of the offline tutor.
   The deep-dive knowledge base is a graph: every topic (label → DeepDive)
   links to related topics. Retrieval resolves the user's message to a topic
   via the concept families, then walks the related-links in BFS to pull
   concepts, traps and QA from the topic's neighborhood — so the tutor can
   explain and hint from the knowledge base, not just the current question's
   key points. */

import { deepDiveRegistry, getDeepDive, type DeepDive } from "../data/deepDive";
import { conceptOverlap, conceptSet, sigTokens } from "./concepts";

export interface GraphNode {
  label: string;
  dd: DeepDive;
  score: number;
  depth: number;
}

/* Topic index: every topic's concept families (from its content) + the
   significant tokens of its label and concept names. Built once — static data. */
const TOPIC_INDEX: { label: string; families: Set<string>; keywords: Set<string> }[] = (() => {
  const out: { label: string; families: Set<string>; keywords: Set<string> }[] = [];
  for (const { label, dd } of deepDiveRegistry()) {
    const families = new Set<string>();
    const texts = [label, ...dd.concepts.map(c => c.name), ...dd.points, ...dd.traps, ...dd.qa.map(q => q.q + " " + q.a)];
    for (const t of texts) for (const f of conceptSet(t)) families.add(f);
    const keywords = new Set<string>();
    for (const t of [label, ...dd.concepts.map(c => c.name)]) for (const k of sigTokens(t)) keywords.add(k);
    out.push({ label, families, keywords });
  }
  return out;
})();

/** Resolves a message to the deep-dive topic it's most about (families + label
    keywords), or null when the message isn't clearly about a knowledge topic.
    Scoring rewards label-centrality (the matched family appears in the topic's
    own label) and uses a focus-ratio tie-break so a topic where the concept is
    incidental (e.g. a qa that mentions "cache") doesn't beat a dedicated one. */
export function topicFor(text: string): { label: string; score: number } | null {
  const ct = conceptSet(text);
  const kws = sigTokens(text);
  let best: { label: string; score: number } | null = null;
  for (const t of TOPIC_INDEX) {
    let matched = 0;
    let score = 0;
    const labelFams = conceptSet(t.label);
    for (const f of t.families) {
      if (ct.has(f)) { matched += 1; score += 2; if (labelFams.has(f)) score += 3; }
    }
    for (const k of t.keywords) if (kws.has(k)) score += 2;
    if (matched) score += matched / t.families.size;
    if (score > 0 && (!best || score > best.score)) best = { label: t.label, score };
  }
  return best;
}

/** BFS over the topic graph: the seed topic first, then its related topics
    (depth 1+), ranked by concept overlap with the message. Returns up to
    `maxNodes` nodes (seed included). */
export function graphRetrieve(text: string, maxNodes = 3): GraphNode[] {
  const seed = topicFor(text);
  if (!seed) return [];
  const out: GraphNode[] = [];
  const seen = new Set<string>([seed.label]);
  const queue: { label: string; depth: number }[] = [{ label: seed.label, depth: 0 }];
  while (queue.length && out.length < maxNodes) {
    const { label, depth } = queue.shift()!;
    const dd = getDeepDive(label);
    const score = depth === 0
      ? seed.score + 10
      : conceptOverlap(text, label + " " + dd.points.join(" ") + " " + dd.concepts.map(c => c.name).join(" "));
    if (depth === 0 || score > 0) out.push({ label, dd, score, depth });
    for (const rel of dd.related) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      queue.push({ label: rel, depth: depth + 1 });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, maxNodes);
}

/** A formatted "📖 From the knowledge base" block for coach replies — the seed
    topic's concepts, and related topics' traps when they're reachable via the
    graph. Empty string when the message maps to no topic. */
export function knowledgeSection(text: string, maxNodes = 2): string {
  const nodes = graphRetrieve(text, maxNodes);
  if (!nodes.length) return "";
  const blocks: string[] = [];
  for (const n of nodes) {
    const parts: string[] = [];
    if (n.dd.concepts.length) {
      parts.push(n.dd.concepts.slice(0, 3).map(c => `• ${c.name} — ${c.blurb}`).join("\n"));
    }
    if (n.depth > 0 && n.dd.traps.length) {
      parts.push("⚠️ watch for: " + n.dd.traps.slice(0, 2).join(" · "));
    }
    if (parts.length) blocks.push("**" + n.label + "**\n" + parts.join("\n"));
  }
  return "📖 From the knowledge base:\n\n" + blocks.join("\n\n");
}
