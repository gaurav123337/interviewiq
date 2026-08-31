/* skillVocab — the canonical skill vocabulary (roadmap Item 11, PR1).

   Locks the invariants the whole unification rests on:
   1. The Skill Counselor under-count bug is fixed at the vocabulary layer:
      display names like "Node.js" / "CI/CD" / "Data structures" now resolve to
      the SAME catalog ids the counselor compares against (node / ci-cd /
      data-structures) — previously a plain .toLowerCase() left them unmatched.
   2. Composite FIELDS labels decompose into atomic catalog slugs, and tight
      tokens ("CI/CD", "Node.js") are NOT shredded by the separator split.
   3. canonicalize is idempotent on its own `.display`, and every catalog id
      round-trips from its display name — so the canonical store never drifts. */

import { describe, expect, it } from "vitest";
import { canonicalize, decompose, slugify, displayName } from "../data/skillVocab";
import { SKILLS } from "../data/skillCatalog";

describe("slugify", () => {
  it.each([
    ["Node.js", "node-js"],
    ["CI/CD", "ci-cd"],
    ["Data structures", "data-structures"],
    ["REST APIs", "rest-apis"],
    ["  Tailwind CSS  ", "tailwind-css"],
    ["React · Vue · Angular", "react-vue-angular"],
    [".NET", "net"],
    ["C++", "c++"],
    ["C#", "c#"],
  ])("slugify(%j) === %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("canonicalize — Skill Counselor under-count fix (the headline bug)", () => {
  it.each([
    ["Node.js", "node"],
    ["CI/CD", "ci-cd"],
    ["Data structures", "data-structures"],
    ["System design", "system-design"],
    ["PostgreSQL", "databases"],
    ["Authentication", "authentication"],
  ])("canonicalize(%j) resolves to catalog id %j", (input, catalogId) => {
    const c = canonicalize(input);
    expect(c.slug).toBe(catalogId);
    expect(c.catalogId).toBe(catalogId);
    // display is upgraded to the catalog's own name.
    expect(c.display).toBe(SKILLS[catalogId].name);
  });

  it("resolves a bare catalog id to itself", () => {
    expect(canonicalize("react")).toMatchObject({ slug: "react", catalogId: "react" });
    expect(canonicalize("data-structures")).toMatchObject({ slug: "data-structures", catalogId: "data-structures" });
  });

  it("leaves a non-catalog skill as a slug with no catalogId", () => {
    const c = canonicalize("Elasticsearch");
    expect(c.slug).toBe("elasticsearch");
    expect(c.catalogId).toBeUndefined();
    expect(c.display).toBe("Elasticsearch");
  });
});

describe("decompose — composite FIELDS labels → atomic slugs", () => {
  it.each([
    ["React · Vue · Angular", ["react", "vue", "angular"]],
    ["JavaScript / TypeScript", ["javascript", "typescript"]],
    ["CSS & accessibility", ["css", "accessibility"]],
    ["Go · Java · Node · Python", ["go", "java", "node", "python"]],
    ["Kubernetes & Docker", ["kubernetes", "docker"]],
    ["Frontend + backend", ["frontend", "backend"]],
  ])("decompose(%j) === %j", (input, expected) => {
    expect(decompose(input)).toEqual(expected);
  });

  it("does NOT shred tight tokens: 'CI/CD & IaC' keeps ci-cd whole", () => {
    // The " & " split fires; the tight "/" inside "CI/CD" must not.
    const out = decompose("CI/CD & IaC");
    expect(out).toContain("ci-cd");
    expect(out).not.toContain("ci");
    expect(out).not.toContain("cd");
  });

  it("canonicalizes a separator-free label whole", () => {
    expect(decompose("Distributed systems")).toEqual(["distributed-systems"]);
  });

  it("de-dupes atomics that collapse to the same slug", () => {
    // "SRE" and "observability" both resolve to the observability node.
    expect(decompose("SRE & observability")).toEqual(["observability"]);
  });
});

describe("idempotency & catalog round-trip (no drift in the canonical store)", () => {
  const samples = [
    "Node.js", "CI/CD", "Data structures", "PostgreSQL", "react", "System design",
    "Elasticsearch", "Vue", "Web performance", "Authentication", "Databases",
  ];

  it("canonicalize is idempotent on its own display", () => {
    for (const s of samples) {
      const once = canonicalize(s);
      const twice = canonicalize(once.display);
      expect(twice.slug).toBe(once.slug);
      expect(twice.display).toBe(once.display);
    }
  });

  it("every catalog skill's display name round-trips to its own id", () => {
    for (const [id, skill] of Object.entries(SKILLS)) {
      expect(canonicalize(skill.name).catalogId).toBe(id);
    }
  });
});

describe("displayName", () => {
  it("returns the catalog name for a known slug, else the slug itself", () => {
    expect(displayName("node")).toBe("Node.js");
    expect(displayName("ci-cd")).toBe("CI/CD");
    expect(displayName("some-unknown-slug")).toBe("some-unknown-slug");
  });
});
