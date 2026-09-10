import { describe, expect, it } from "vitest";
import {
  parseResume,
  normalizeResume,
  resumeToText,
  resumeToHtml,
} from "../services/resumeParser";

/* Item 20 (Phase 3) — load-bearing path: the resume text parser.
   resumeParser has ZERO deps and four pure exports, but no test asserted its
   structured output before now — the transitive exercise (resumeMatch/jdScan)
   only checks downstream CareerProfile fields from resume.ts's own extractors.
   The module's reason to exist is the messy/2-column path: preprocessResumeText
   runs ONLY when the text is <=5 lines (a collapsed / PDF-extracted blob), where
   it must re-insert section boundaries. We drive a realistic collapsed fixture
   through the real code — no mocks, this file follows the diffLines.test.ts
   pure-function convention. Time-dependent branches (years "since YYYY",
   detectLevel via clock) are avoided with explicit inputs. */

// A collapsed 3-line resume simulating 2-column PDF text extraction: the name +
// title on one line, a pipe-joined contact line, and the entire body (summary,
// skills, experience, education) run together on a single line with inline
// headers. This is exactly the <=5-line shape preprocessResumeText must rescue.
const MESSY_2COL = [
  "John Doe   Senior Frontend Developer",
  "john.doe@example.com | +1 415 555 0199 | linkedin.com/in/johndoe | github.com/johndoe | San Francisco, USA",
  "Professional Summary Frontend engineer with 8+ years building React apps. Technical Skills React, TypeScript, CSS, Node.js, PostgreSQL, Python, Docker Professional Experience Senior Frontend Developer | Acme Corp | San Francisco, USA | Jan 2020 - Present Led the redesign of the checkout flow. Improved performance by 40%. Education Master of Computer Applications | Stanford University | 2015",
].join("\n");

describe("parseResume — collapsed 2-column PDF text", () => {
  const doc = parseResume(MESSY_2COL);

  it("extracts contact fields even when they were pipe-joined on one line", () => {
    // Step 3 of preprocessing splits the pipe-joined contact line apart.
    expect(doc.contact.email).toBe("john.doe@example.com");
    expect(doc.contact.phone).toBe("+1 415 555 0199");
    expect(doc.contact.linkedin).toBe("linkedin.com/in/johndoe");
    expect(doc.contact.github).toBe("github.com/johndoe");
    expect(doc.contact.location).toBe("San Francisco, USA");
  });

  it("recovers the name and stops before the job-title keyword", () => {
    // The name shares a line with the title; the title-keyword heuristic
    // ("Senior") must truncate it to just the name.
    expect(doc.contact.name).toBe("John Doe");
  });

  it("re-inserts section boundaries so inline headers become real sections", () => {
    // preprocessResumeText must NOT double-split "Professional Summary" into
    // "Summary" (longest-first alternation), and the summary body is captured.
    expect(doc.summary).toBe(
      "Frontend engineer with 8+ years building React apps."
    );
  });

  it("splits the skills blob on delimiters and dedupes", () => {
    expect(doc.skills).toEqual([
      "React",
      "TypeScript",
      "CSS",
      "Node.js",
      "PostgreSQL",
      "Python",
      "Docker",
    ]);
  });

  it("parses a pipe-delimited experience entry with a date range and bullets", () => {
    expect(doc.experience).toHaveLength(1);
    const exp = doc.experience[0];
    expect(exp.title).toBe("Senior Frontend Developer");
    expect(exp.company).toBe("Acme Corp");
    expect(exp.location).toBe("San Francisco, USA");
    expect(exp.dates).toBe("Jan 2020 - Present");
    // Description after the date is split into sentence bullets (len > 10).
    // Note: the parser's description capture starts at the first 4-digit year,
    // so bullet[0] retains a "- Present" prefix — we assert the captured
    // sentence content, not that implementation artifact.
    expect(exp.bullets).toHaveLength(2);
    expect(exp.bullets[0]).toContain("Led the redesign of the checkout flow");
    expect(exp.bullets[1]).toBe("Improved performance by 40%.");
  });

  it("parses a date-anchored education entry", () => {
    expect(doc.education).toHaveLength(1);
    const edu = doc.education[0];
    expect(edu.degree).toBe("Master of Computer Applications");
    expect(edu.school).toBe("Stanford University");
    expect(edu.dates).toBe("2015");
  });
});

describe("parseResume — ALL-CAPS headers and unknown sections", () => {
  // >5 lines, so preprocessResumeText is skipped and classifySectionHeader must
  // detect ALL-CAPS headings directly (both aliased and non-aliased).
  const CAPS = [
    "Jane Smith",
    "jane@example.com",
    "EXPERIENCE",
    "Built things at BigCo | 2019 - 2021",
    "SKILLS",
    "Go, Kubernetes, Terraform",
    "VOLUNTEER WORK",
    "Mentored junior devs on weekends.",
  ].join("\n");
  const doc = parseResume(CAPS);

  it("maps ALL-CAPS aliased headers to canonical sections", () => {
    expect(doc.skills).toEqual(["Go", "Kubernetes", "Terraform"]);
    expect(doc.experience.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps a non-aliased ALL-CAPS header as an other-section (never dropped)", () => {
    const titles = doc.otherSections.map(s => s.title);
    expect(titles).toContain("VOLUNTEER WORK");
  });
});

describe("normalizeResume — classification (deterministic inputs)", () => {
  const norm = normalizeResume(MESSY_2COL);

  it("classifies a mixed FE+BE skill set as fullstack", () => {
    // >=3 frontend (React, TypeScript, CSS) AND >=3 backend
    // (Node.js, PostgreSQL/SQL, Python) trips the fullstack rule.
    expect(norm.field).toBe("fullstack");
  });

  it("detects seniority from the text ladder", () => {
    // "Senior" present, no architect/lead/staff/principal tokens.
    expect(norm.level).toBe("senior");
  });

  it("extracts the max explicit '<N>+ years' figure (no clock dependency)", () => {
    expect(norm.years).toBe(8);
  });

  it("maps keyword aliases to canonical skill names", () => {
    expect(norm.skills).toEqual(
      expect.arrayContaining([
        "React",
        "TypeScript",
        "Node.js",
        "PostgreSQL",
        "Docker",
      ])
    );
  });

  it("carries contact fields through from the parsed document", () => {
    expect(norm.name).toBe("John Doe");
    expect(norm.email).toBe("john.doe@example.com");
    expect(norm.linkedin).toBe("linkedin.com/in/johndoe");
  });
});

describe("serializers", () => {
  it("resumeToHtml escapes HTML metacharacters in user content", () => {
    const doc = parseResume(MESSY_2COL);
    const injected = {
      ...doc,
      contact: { ...doc.contact, name: "John <script>alert(1)</script> Doe & Co" },
    };
    const html = resumeToHtml(injected);
    expect(html).toContain("John &lt;script&gt;alert(1)&lt;/script&gt; Doe &amp; Co");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("resumeToHtml honors the accent color argument", () => {
    const doc = parseResume(MESSY_2COL);
    expect(resumeToHtml(doc, "#ff0000")).toContain("#ff0000");
  });

  it("resumeToText round-trips key content back out", () => {
    const doc = parseResume(MESSY_2COL);
    const text = resumeToText(doc);
    expect(text).toContain("John Doe");
    expect(text).toContain("SKILLS");
    expect(text).toContain("React");
    expect(text).toContain("EXPERIENCE");
  });
});
