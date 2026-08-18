/* System Design deep-dive tutor — topic-specific tutoring strategy.
   Unlike the generic tutor (tutor.ts), this module:
   1. Detects when the topic is a system design case study
   2. Uses a specialized system prompt with diagram reasoning
   3. Supports "draw me an architecture" and "compare approaches" intents
   4. Grounds in the curated architecture data from deepDive.ts
   5. Uses the tutor module's AI model (per-module routing) */

import { chatForModule } from "../ai";
import type { CareerGoal } from "../types";
import { fieldById, levelById } from "../data";
import { getDeepDive, type DeepDiveArchitecture } from "../data/deepDive";
import { withGrounding, type Citation } from "./tutor";
import { aiCallsLeft, isPaywallEnabled, recordAiCall } from "./entitlements";
import { aiEnabled } from "./remoteConfig";
import { queueEvent } from "./events";

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

/** Detect if a topic label maps to a system design case study. */
export function isSystemDesignTopic(label: string): boolean {
  const key = label.toLowerCase().trim();
  /* Direct match against the architecture registry */
  if (getArchitectures(label).length > 0) return true;
  /* Keyword heuristic for topics that commonly need system design treatment */
  return /system design|distributed|scale|architecture|design.*(system|service|api|queue|cache|store)/i.test(key);
}

/** Get architecture case studies for a topic, if any. */
export function getArchitectures(label: string): DeepDiveArchitecture[] {
  const dd = getDeepDive(label);
  return (dd as { architectures?: DeepDiveArchitecture[] }).architectures ?? [];
}

/* ------------------------------------------------------------------ */
/* Prompt building                                                     */
/* ------------------------------------------------------------------ */

function levelSystemExpectations(level: string): string {
  switch (level.toLowerCase()) {
    case "junior":
      return "know what a load balancer, cache, and database do; explain basic client-server flow";
    case "mid":
      return "design a simple end-to-end system; identify 2-3 trade-offs; estimate basic throughput";
    case "senior":
      return "design a distributed system with caching, async processing, and failure handling; discuss CAP trade-offs concretely";
    case "staff":
      return "design for millions of users; discuss data partitioning, replication, and operational concerns (monitoring, rollback, incident response)";
    case "principal":
    case "cto":
    case "ceo":
      return "make org-wide architectural decisions; discuss build-vs-buy, vendor lock-in, technical debt, and long-term platform evolution";
    default:
      return "demonstrate solid systems thinking with concrete trade-offs";
  }
}

function systemDesignPrompt(
  topic: string,
  levelName: string,
  fieldName: string,
  architectures: DeepDiveArchitecture[]
): string {
  const archBlock = architectures.length
    ? "\n\nKnown architectures for this topic:\n" + architectures.map(a =>
      `${a.name}: ${a.blurb}\n` +
      `  Components: ${a.components.join(" → ")}\n` +
      `  Tradeoffs: ${a.tradeoffs.join("; ")}\n` +
      `  Scale: ${a.scaleNotes}\n` +
      `  Failures: ${a.failureModes.join("; ")}`
    ).join("\n\n")
    : "";

  return (
    `You are a senior systems architect teaching system design for a ${levelName} ${fieldName} interview. ` +
    `Topic: "${topic}".\n\n` +
    `Teaching strategy for system design:\n` +
    `1. Always start with requirements: functional + non-functional + scale estimates.\n` +
    `2. Build up the architecture step by step: start simple, add components only when needed.\n` +
    `3. For every design decision, name the trade-off explicitly (cost vs latency, consistency vs availability).\n` +
    `4. Walk through failure modes: what breaks, how the system handles it.\n` +
    `5. Mention real-world scale numbers when possible.\n` +
    `6. Use plain text diagrams when explaining component relationships (use arrows → to show flow).\n\n` +
    `At ${levelName} level, expect the candidate to: ${levelSystemExpectations(levelName)}\n\n` +
    `Tie everything back to how they'd explain it in a 45-minute whiteboard interview.${archBlock}`
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Explain a system design topic with architecture-aware grounding. */
export async function explainSystemDesign(
  topic: string,
  goal: CareerGoal
): Promise<string> {
  if (!aiEnabled()) throw new Error("AI coaching is temporarily disabled.");
  if (isPaywallEnabled() && aiCallsLeft() <= 0) {
    throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.");
  }

  const field = fieldById(goal.fieldId);
  const lvl = levelById(goal.targetLevel);
  const architectures = getArchitectures(topic);

  const sys = systemDesignPrompt(topic, lvl.name, field?.name ?? "", architectures);

  const usr =
    `Teach the system design topic "${topic}" for a ${lvl.name} ${field?.name ?? ""} interview.\n` +
    `Include:\n` +
    `1) What the system does and why it's a classic interview topic.\n` +
    `2) A step-by-step architecture walkthrough (start simple, add complexity).\n` +
    `3) The 3 most important trade-offs and why you'd choose one side.\n` +
    `4) Common failure modes and how to handle them.\n` +
    `5) A 2-minute whiteboard explanation skeleton.\n` +
    (architectures.length
      ? `\nUse the known architecture data above as reference — expand on the components and tradeoffs.`
      : `\nIf this is a known pattern, include a concrete architecture walkthrough.`);

  const { sys: sysGrounded } = await withGrounding(sys, topic, {
    field: goal.fieldId,
    level: goal.targetLevel
  });

  const out = await chatForModule("tutor", [
    { role: "system", content: sysGrounded },
    { role: "user", content: usr }
  ], { maxTokens: 800 });

  recordAiCall();
  void queueEvent("ai_call", { system_design: true, topic: topic.slice(0, 100) });
  return out;
}

/** Continue a system-design-specific tutor conversation. */
export async function systemDesignChat(
  topic: string,
  goal: CareerGoal,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ text: string; citations: Citation[]; grounded: boolean; checked: boolean }> {
  if (!aiEnabled()) throw new Error("AI coaching is temporarily disabled.");
  if (isPaywallEnabled() && aiCallsLeft() <= 0) {
    throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.");
  }

  const field = fieldById(goal.fieldId);
  const lvl = levelById(goal.targetLevel);
  const architectures = getArchitectures(topic);

  const sys = systemDesignPrompt(topic, lvl.name, field?.name ?? "", architectures);

  const lastUser = [...history].reverse().find(m => m.role === "user")?.content ?? "";

  const { sys: sysGrounded, citations, grounded, checked } = await withGrounding(sys, lastUser || topic, {
    field: goal.fieldId,
    level: goal.targetLevel
  });

  const msgs = [
    { role: "system" as const, content: sysGrounded },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
  ];

  const text = await chatForModule("tutor", msgs, { maxTokens: 600 });

  recordAiCall();
  void queueEvent("ai_call", { system_design_chat: true, topic: topic.slice(0, 100) });
  return { text, citations, grounded, checked };
}
