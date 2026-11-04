import { describe, expect, it } from "vitest";
import {
  appendResumeVariant,
  keywordsSupportingChange,
  previewTailoredResume,
  splitResumeSections,
  stableVariantId,
  tailorSubmitGate,
} from "../../scripts/apply-kit-lib.js";

describe("Phase 2 — tailoring approval gate (submit decision, fail-closed)", () => {
  it("a template/master kit needs no approval", () => {
    expect(tailorSubmitGate({ llmAuthored: false, autoTailor: false, approved: false })).toMatchObject({ canSubmit: true });
  });

  it("autoTailor pre-consent and an approved variant both pass", () => {
    expect(tailorSubmitGate({ llmAuthored: true, autoTailor: true })).toMatchObject({ canSubmit: true });
    expect(tailorSubmitGate({ llmAuthored: true, approved: true })).toMatchObject({ canSubmit: true });
  });

  it("DEFAULT blocks: an unapproved LLM-tailored kit holds auto-submit (fail-closed)", () => {
    const gate = tailorSubmitGate({ llmAuthored: true, autoTailor: false, approved: false });
    expect(gate.canSubmit).toBe(false);
    expect(gate.reason).toMatch(/unapproved|approv/i);
    expect(tailorSubmitGate({}).canSubmit).toBe(false); // absent llmAuthored must NOT default to allowed
    expect(tailorSubmitGate({ llmAuthored: true }).canSubmit).toBe(false);
  });

  it("stableVariantId is deterministic and sensitive to content", () => {
    expect(stableVariantId("resume A")).toBe(stableVariantId("resume A"));
    expect(stableVariantId("resume A")).not.toBe(stableVariantId("resume B"));
  });
});

describe("Phase 2 — section splitting (template + markdown headings)", () => {
  it("splits the engine's UPPERCASE template shape", () => {
    const sections = splitResumeSections(
      "NAME\ncontact line\n\nSUMMARY\nbuilt software\n\nSKILLS\nNode.js, React\n\nEXPERIENCE\nEng — Acme (2020-2024)\n• shipped it"
    );
    expect(sections.map((s) => s.heading)).toEqual(["(header)", "SUMMARY", "SKILLS", "EXPERIENCE"]);
    expect(sections.find((s) => s.heading === "EXPERIENCE")?.lines).toContain("• shipped it");
  });

  it("also accepts markdown headings (the AI rewrite may reformat)", () => {
    const sections = splitResumeSections("## Summary\nx\n## Experience\ny");
    expect(sections.map((s) => s.heading.toLowerCase())).toEqual(["summary", "experience"]);
  });
});

describe("Phase 2 — preview: diff + JD-keyword justification", () => {
  const master = [
    "NAME",
    "x@y.z",
    "",
    "SUMMARY",
    "Frontend engineer building interfaces.",
    "",
    "EXPERIENCE",
    "Eng — Acme (2020-2024)",
    "• shipped React UI",
  ].join("\n");
  const variant = [
    "NAME",
    "x@y.z",
    "",
    "SUMMARY",
    "Frontend engineer building resilient GraphQL APIs and interfaces.",
    "",
    "EXPERIENCE",
    "Eng — Acme (2020-2024)",
    "• shipped React UI with Kubernetes operators",
  ].join("\n");

  it("marks changed sections and justifies them with keywords found on ADDED lines only", () => {
    const preview = previewTailoredResume(master, variant, { jdKeywords: ["GraphQL", "Kubernetes", "Docker"] });
    expect(preview.sections.map((s) => s.status)).toEqual(["unchanged", "changed", "changed"]);
    expect(preview.matchedKeywords).toEqual(["GraphQL", "Kubernetes"]); // Docker absent — never fabricated
    expect(preview.sections[1].matchedKeywords).toEqual(["GraphQL"]);
    expect(preview.sections[2].matchedKeywords).toEqual(["Kubernetes"]);
  });

  it("never claims a keyword the master already carried as the reason for an edit", () => {
    const v2 = master.replace("building interfaces.", "building interfaces in Kotlin.");
    const preview = previewTailoredResume(master, v2, { jdKeywords: ["React", "Kotlin"] });
    expect(preview.sections[1].matchedKeywords).toEqual(["Kotlin"]); // React is on the master, not on the added line
  });

  it("surfaces sections the variant added outright (no master counterpart)", () => {
    const v3 = master + "\n\nAWARDS\nA11y award 2024";
    const preview = previewTailoredResume(master, v3, { jdKeywords: ["a11y"] });
    const awards = preview.sections.find((s) => s.heading === "AWARDS");
    expect(awards?.status).toBe("changed");
    expect(awards?.matchedKeywords).toEqual(["a11y"]);
  });

  it("keyword support is word-boundary aware (GraphQL does not match GraphQLite blabber)", () => {
    expect(keywordsSupportingChange(["used GraphQLites"], ["GraphQL"])).toEqual([]);
    expect(keywordsSupportingChange(["used GraphQL and REST"], ["GraphQL"])).toEqual(["GraphQL"]);
  });
});

describe("Phase 2 — variant version history", () => {
  it("dedupes by content, newest first, capped", () => {
    let history: Array<Record<string, unknown>> = [];
    const a = { title: "A", resume: "text A" };
    history = appendResumeVariant(history, a, { max: 2 });
    history = appendResumeVariant(history, { title: "B", resume: "text B" }, { max: 2 });
    history = appendResumeVariant(history, { ...a, title: "A (again)" }, { max: 2 }); // same content ⇒ same id
    expect(history.map((h) => h.title)).toEqual(["A (again)", "B"]);
    const c = { title: "C", resume: "text C" };
    history = appendResumeVariant(history, c, { max: 2 });
    expect(history.map((h) => h.title)).toEqual(["C", "A (again)"]); // cap=2 evicted the oldest
  });
});
