/* drill — deck building. Covers the Item 12 skill-driven deck (deckForSkills),
   the untouched round-driven deck (practiceForRound) as a refactor regression
   guard, and the makeDeck contract. Note: pickRelevant tie-breaks and falls
   back with Math.random(), so deck *contents/order* are non-deterministic —
   these tests assert bounds, shape and the empty-input guards only. */

import { beforeEach, describe, expect, it } from "vitest";
import type { DrillCard } from "../services/drill";
import { deckForSkills, makeDeck, practiceForRound, resetSrs } from "../services/drill";

const FIELD = "frontend"; // roadmap field with a populated question bank

/** Every card the UI relies on: string prompt/answer, array key points, a level. */
function assertShape(cards: DrillCard[]) {
  for (const c of cards) {
    expect(typeof c.q).toBe("string");
    expect(typeof c.a).toBe("string");
    expect(Array.isArray(c.kp)).toBe(true);
    expect(typeof c.lvl).toBe("string");
  }
}

beforeEach(() => resetSrs());

describe("deckForSkills (Item 12 gap prep-loop)", () => {
  it("returns an empty deck for no labels (safe)", () => {
    expect(deckForSkills([], FIELD)).toEqual([]);
  });

  it("builds a deck from a skill label", () => {
    const deck = deckForSkills(["React"], FIELD);
    expect(deck.length).toBeGreaterThan(0);
    assertShape(deck);
  });

  it("canonical display names drive a real sweep (Node.js → node)", () => {
    // "Node.js" folds to the catalog display, which must still tokenize into a
    // usable keyword — a broken canonicalization would yield an empty deck.
    expect(deckForSkills(["Node.js"], FIELD).length).toBeGreaterThan(0);
  });

  it("never returns more than `count` cards", () => {
    const many = ["React", "TypeScript", "CSS", "Node.js", "GraphQL", "Docker", "Kubernetes"];
    expect(deckForSkills(many, FIELD, 3).length).toBeLessThanOrEqual(3);
    expect(deckForSkills(many, FIELD).length).toBeLessThanOrEqual(6); // default cap
  });

  it("de-duped labels never crash and stay within the cap", () => {
    // "Node.js" / "node" / "NODE.JS" all fold to one slug — no double counting.
    const deck = deckForSkills(["Node.js", "node", "NODE.JS"], FIELD, 6);
    expect(deck.length).toBeLessThanOrEqual(6);
    assertShape(deck);
  });

  it("returns [] for labels that carry no searchable token (never a random deck)", () => {
    // "C++" / "C#" / "R" / "C" have a non-empty canonical slug but tokenize to
    // nothing (tokenize strips +/# and drops the lone letter). They must NOT slip
    // through to pickRelevant's random fallback and surface unrelated cards.
    expect(deckForSkills(["C++"], FIELD)).toEqual([]);
    expect(deckForSkills(["C++", "C#", "R", "C"], FIELD)).toEqual([]);
    // mixed: the untokenizable label is dropped, the real one still drives a deck.
    const mixed = deckForSkills(["C++", "React"], FIELD);
    expect(mixed.length).toBeGreaterThan(0);
    assertShape(mixed);
  });
});

describe("practiceForRound (refactor regression guard)", () => {
  it("returns an empty deck when the notes have no usable keywords", () => {
    expect(practiceForRound("", FIELD)).toEqual([]);
    expect(practiceForRound("a to of", FIELD)).toEqual([]); // all tokens length ≤ 2
  });

  it("still builds a deck from round notes after the shared-core extraction", () => {
    const deck = practiceForRound("react hooks state components rendering", FIELD);
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.length).toBeLessThanOrEqual(6);
    assertShape(deck);
  });
});

describe("makeDeck contract", () => {
  it("respects the count cap and returns well-formed cards", () => {
    const deck = makeDeck(FIELD, "all", 5);
    expect(deck.length).toBeLessThanOrEqual(5);
    assertShape(deck);
  });
});
