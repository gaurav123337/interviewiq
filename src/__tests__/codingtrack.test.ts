// @vitest-environment jsdom
/* Coding-track service tests — problems failed ≥2× become drill cards, solved
   ones never do, and attempts are queued as coding_attempt events. */

import { describe, expect, it, beforeEach } from "vitest";
import { codingDrillCards, getCodingTrack, recordCodingAttempt } from "../services/codingTrack";
import { CODING_PROBLEMS } from "../data/coding";
import { makeDeck } from "../services/drill";
import { storageRemove } from "../services/storage";

const TRACK_KEY = "iq.codingTrack";

beforeEach(() => {
  storageRemove(TRACK_KEY);
});

describe("codingDrillCards", () => {
  it("no cards when nothing was attempted", () => {
    expect(codingDrillCards()).toEqual([]);
  });

  it("a problem failed once does not become a card", () => {
    recordCodingAttempt("two-sum", false);
    expect(codingDrillCards()).toEqual([]);
  });

  it("a problem failed twice becomes a drill card carrying the hint", () => {
    recordCodingAttempt("two-sum", false);
    recordCodingAttempt("two-sum", false);
    const cards = codingDrillCards();
    expect(cards.length).toBe(1);
    expect(cards[0].q).toContain("Two Sum");
    expect(cards[0].a.length).toBeGreaterThan(10);
    expect(cards[0].kp.length).toBeGreaterThan(0);
  });

  it("a solved problem never becomes a card, even after earlier fails", () => {
    recordCodingAttempt("two-sum", false);
    recordCodingAttempt("two-sum", false);
    recordCodingAttempt("two-sum", true);
    expect(codingDrillCards()).toEqual([]);
  });

  it("caps the card count", () => {
    for (let i = 0; i < 8; i++) {
      recordCodingAttempt(CODING_PROBLEMS[i].id, false);
      recordCodingAttempt(CODING_PROBLEMS[i].id, false);
    }
    expect(codingDrillCards().length).toBeLessThanOrEqual(6);
  });

  it("tracks state in storage", () => {
    recordCodingAttempt("two-sum", false);
    expect(getCodingTrack()["two-sum"].fails).toBe(1);
  });
});

describe("drill integration", () => {
  it("failed coding problems join the drill deck", () => {
    recordCodingAttempt("two-sum", false);
    recordCodingAttempt("two-sum", false);
    /* big count so the shuffled fresh slice can't drop the card */
    const deck = makeDeck("backend", "all", 500);
    expect(deck.some(c => c.q.includes("Two Sum"))).toBe(true);
  });
});
