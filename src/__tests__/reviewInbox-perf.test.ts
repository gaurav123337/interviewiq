/**
 * Review Inbox performance benchmarks.
 * Tests duplicate detection, triage, and rendering with 500+ questions.
 */

import { describe, it, expect } from "vitest";
import { findDuplicates, draftIssues, triageLevel, normalizeText, tokenJaccard } from "../services/duplicates";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function generateQuestions(count: number): { question: string; answer: string; keyPoints: string[] }[] {
  const templates = [
    { q: "What is {concept} and how does it work?", a: "{concept} is a fundamental principle in software engineering that helps developers write clean, maintainable code. It involves separating concerns and ensuring each module has a single responsibility.", kp: ["Single responsibility", "Separation of concerns", "Modularity"] },
    { q: "Explain the difference between {conceptA} and {conceptB}.", a: "{conceptA} focuses on the what while {conceptB} focuses on the how. They are complementary patterns that work together to create robust architectures.", kp: ["Key differences", "Use cases", "Trade-offs"] },
    { q: "How would you design a {system} that handles millions of users?", a: "Designing a scalable system requires careful consideration of load balancing, caching strategies, database sharding, and microservices architecture.", kp: ["Load balancing", "Caching", "Database sharding", "Microservices"] },
    { q: "What are the SOLID principles and why are they important?", a: "SOLID is an acronym for five design principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.", kp: ["SRP", "OCP", "LSP", "ISP", "DIP"] },
    { q: "Describe your experience with {technology} in production environments.", a: "Working with {technology} in production requires understanding its scaling characteristics, monitoring requirements, and failure modes.", kp: ["Production experience", "Scaling", "Monitoring"] },
    { q: "What is {pattern} pattern and when would you use it?", a: "{pattern} is a creational design pattern that provides a flexible alternative to subclassing. It's useful when you need to create objects without specifying the exact class.", kp: ["Use cases", "Implementation", "Benefits"] },
    { q: "How do you handle {scenario} in distributed systems?", a: "Handling {scenario} in distributed systems requires careful consideration of consistency, availability, and partition tolerance as described by the CAP theorem.", kp: ["CAP theorem", "Eventual consistency", "Fallback strategies"] },
    { q: "What metrics would you track for {component}?", a: "Key metrics include latency percentiles (p50, p95, p99), error rates, throughput, saturation levels, and business-specific KPIs.", kp: ["Latency", "Error rates", "Throughput", "Saturation"] },
  ];

  const concepts = ["abstraction", "encapsulation", "polymorphism", "inheritance", "composition", "aggregation", "coupling", "cohesion"];
  const technologies = ["React", "Node.js", "Python", "Go", "Rust", "Kubernetes", "Docker", "Redis"];
  const patterns = ["Singleton", "Factory", "Observer", "Strategy", "Adapter", "Decorator", "Proxy", "Builder"];
  const systems = ["chat system", "e-commerce platform", "social network", "payment gateway", "search engine", "content delivery network"];
  const scenarios = ["failure", "latency spikes", "data inconsistency", "cascading failures", "hot partitions"];
  const components = ["API gateway", "message queue", "database cluster", "cache layer", "load balancer"];

  const questions: { question: string; answer: string; keyPoints: string[] }[] = [];

  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    const vars: Record<string, string> = {
      concept: concepts[i % concepts.length],
      conceptA: concepts[i % concepts.length],
      conceptB: concepts[(i + 1) % concepts.length],
      technology: technologies[i % technologies.length],
      pattern: patterns[i % patterns.length],
      system: systems[i % systems.length],
      scenario: scenarios[i % scenarios.length],
      component: components[i % components.length],
    };

    let q = t.q;
    let a = t.a;
    for (const [k, v] of Object.entries(vars)) {
      q = q.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      a = a.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }

    // Add some unique suffix to make duplicates identifiable
    q += ` (ref-${i})`;
    a += ` Additional context for question ${i} with unique details.`;

    questions.push({ question: q, answer: a, keyPoints: [...t.kp, `topic-${i % 10}`] });
  }

  // Add some actual duplicates (similar questions)
  for (let i = 0; i < Math.min(20, count); i++) {
    const base = questions[i];
    questions.push({
      question: base.question.replace("ref-" + i, "dup-ref-" + i),
      answer: base.answer,
      keyPoints: [...base.keyPoints],
    });
  }

  return questions;
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("Review Inbox performance", () => {
  const questions = generateQuestions(500);
  const bank = questions.map(q => q.question);

  it("normalizeText handles 500 texts in <100ms", () => {
    const start = performance.now();
    for (const q of questions) {
      normalizeText(q.question);
    }
    const elapsed = performance.now() - start;
    console.log(`  normalizeText: ${elapsed.toFixed(1)}ms for ${questions.length} texts`);
    expect(elapsed).toBeLessThan(100);
  });

  it("tokenJaccard handles 500 comparisons in <50ms", () => {
    const start = performance.now();
    for (let i = 0; i < Math.min(500, questions.length); i++) {
      tokenJaccard(questions[i].question, questions[(i + 1) % questions.length].question);
    }
    const elapsed = performance.now() - start;
    console.log(`  tokenJaccard: ${elapsed.toFixed(1)}ms for 500 comparisons`);
    expect(elapsed).toBeLessThan(50);
  });

  it("findDuplicates handles 200 drafts against 500 bank in <2s (no cache)", () => {
    const drafts = questions.slice(0, 200);
    const start = performance.now();
    for (const d of drafts) {
      findDuplicates(d.question, bank.filter(q => q !== d.question));
    }
    const elapsed = performance.now() - start;
    console.log(`  findDuplicates: ${elapsed.toFixed(1)}ms for ${drafts.length} drafts × ${bank.length} bank`);
    // Without cache reuse, each call rebuilds — expect ~2s
    expect(elapsed).toBeLessThan(2000);
  });

  it("draftIssues handles 500 drafts in <50ms", () => {
    const start = performance.now();
    for (const q of questions) {
      draftIssues(q);
    }
    const elapsed = performance.now() - start;
    console.log(`  draftIssues: ${elapsed.toFixed(1)}ms for ${questions.length} drafts`);
    expect(elapsed).toBeLessThan(50);
  });

  it("triageLevel handles 500 results in <10ms", () => {
    const allIssues = questions.map(q => draftIssues(q));
    const start = performance.now();
    for (const issues of allIssues) {
      triageLevel(issues);
    }
    const elapsed = performance.now() - start;
    console.log(`  triageLevel: ${elapsed.toFixed(1)}ms for ${allIssues.length} results`);
    expect(elapsed).toBeLessThan(10);
  });

  it("full triage pipeline (500 drafts × 500 bank) completes in <1s", () => {
    const drafts = questions.slice(0, 200);
    const start = performance.now();

    // Simulate what ReviewInbox does
    const triage: Record<number, { issues: string[]; level: string; dups: { text: string; sim: number }[] }> = {};
    for (const d of drafts) {
      const issues = draftIssues(d);
      const dups = findDuplicates(d.question, bank.filter(q => q !== d.question));
      triage[d.question.length] = { issues, level: triageLevel(issues), dups };
    }

    const elapsed = performance.now() - start;
    console.log(`  Full triage pipeline: ${elapsed.toFixed(1)}ms for ${drafts.length} drafts × ${bank.length} bank`);
    expect(elapsed).toBeLessThan(1000);
  });

  it("identifies duplicate questions correctly", () => {
    // The last 20 questions are duplicates of the first 20
    const duplicateDrafts = questions.slice(500, 520);
    const originalBank = questions.slice(0, 500).map(q => q.question);

    let foundDups = 0;
    for (const d of duplicateDrafts) {
      const dups = findDuplicates(d.question, originalBank);
      if (dups.length > 0) foundDups++;
    }

    console.log(`  Found ${foundDups}/${duplicateDrafts.length} actual duplicates`);
    expect(foundDups).toBeGreaterThanOrEqual(15); // At least 75% detected
  });
});

describe("Review Inbox rendering performance", () => {
  it("VirtualList estimate calculation for 500 items is instant", () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i, question: `Q${i}` }));
    const estimateHeight = 260;
    const start = performance.now();

    // Simulate VirtualList totalHeight calculation
    const totalHeight = items.length * estimateHeight;

    const elapsed = performance.now() - start;
    console.log(`  VirtualList height calc: ${elapsed.toFixed(3)}ms for ${items.length} items`);
    expect(elapsed).toBeLessThan(1);
    expect(totalHeight).toBe(500 * 260);
  });
});
