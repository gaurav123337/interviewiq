/* Regression guard for the RAG false-grounding defect: withGrounding must only
   ever cite hits that clear the grounding threshold. A below-threshold near-miss
   used to be returned as a citation with grounded:false, which the coach/tutor
   UI then rendered as "📚 Grounded · N sources" — falsely claiming the answer
   came from the knowledge base when the model was told to answer from general
   knowledge. Because withGrounding is the sole producer of these citations,
   filtering here keeps every consumer (CoachChat, FloatingCoach, RoadmapTutor)
   honest without each UI having to re-check the grounded flag. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RagHit } from "../services/rag";

const retrieveContext = vi.hoisted(() => vi.fn());
const notifyKnowledgeGap = vi.hoisted(() => vi.fn());

vi.mock("../services/rag", async () => {
  const actual = await vi.importActual<typeof import("../services/rag")>("../services/rag");
  return {
    ...actual,
    retrieveContext,
    notifyKnowledgeGap,
    documentTitles: vi.fn(async () => new Map<number, string>([[1, "Doc One"], [2, "Doc Two"]]))
  };
});

import { withGrounding } from "../services/tutor";

const hit = (documentId: number, grounded: boolean): RagHit => ({
  documentId,
  content: `chunk ${documentId}`,
  similarity: grounded ? 0.72 : 0.31,
  hybrid: 0.5,
  grounded
});

afterEach(() => {
  retrieveContext.mockReset();
  notifyKnowledgeGap.mockReset();
});

describe("withGrounding citation discipline", () => {
  it("cites nothing and reports not-grounded when every hit is below the threshold", async () => {
    /* the concrete false-grounding scenario: off-topic question, KB returns
       only nearest-but-weak chunks (all grounded:false) */
    retrieveContext.mockResolvedValue({ hits: [hit(1, false), hit(2, false)], checked: true });
    const r = await withGrounding("SYS", "how would you shard a DB for 100M users");
    expect(r.grounded).toBe(false);
    expect(r.citations).toEqual([]);
    /* honest signal that the topic wasn't covered — never a "grounded" badge */
    expect(notifyKnowledgeGap).toHaveBeenCalledOnce();
  });

  it("cites only the hits that clear the threshold when results are mixed", async () => {
    retrieveContext.mockResolvedValue({ hits: [hit(1, false), hit(2, true)], checked: true });
    const r = await withGrounding("SYS", "q");
    expect(r.grounded).toBe(true);
    expect(r.citations.map(c => c.documentId)).toEqual([2]);
    expect(r.citations.every(c => c.grounded)).toBe(true);
    expect(notifyKnowledgeGap).not.toHaveBeenCalled();
  });

  it("cites all hits when they all clear the threshold", async () => {
    retrieveContext.mockResolvedValue({ hits: [hit(1, true), hit(2, true)], checked: true });
    const r = await withGrounding("SYS", "q");
    expect(r.grounded).toBe(true);
    expect(r.citations.map(c => c.documentId)).toEqual([1, 2]);
  });

  it("stays silent when retrieval never ran (checked:false → no false 'not in KB' claim)", async () => {
    retrieveContext.mockResolvedValue({ hits: [], checked: false });
    const r = await withGrounding("SYS", "q");
    expect(r.grounded).toBe(false);
    expect(r.citations).toEqual([]);
    expect(notifyKnowledgeGap).not.toHaveBeenCalled();
  });
});
