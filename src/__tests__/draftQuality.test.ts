import { describe, expect, it } from "vitest";
import {
  deriveSkills, looksTruncated, noiseReason, partitionNoiseItems
} from "../../scripts/draft-quality-lib.js";
import { extractFromJson, buildUpsertSql } from "../../scripts/scrape-lib.js";
import { routeItems } from "../../scripts/crawl-orchestrate-lib.js";

describe("deriveSkills — canonical tags for the Bank's skill filters", () => {
  it("tags the requested cases: react and java", () => {
    expect(deriveSkills("How does the virtual DOM work in React?")).toEqual(["React"]);
    expect(deriveSkills("Explain Java thread pools and the memory model.")).toEqual(["Java"]);
  });

  it("does not confuse Java with JavaScript", () => {
    expect(deriveSkills("JavaScript closures vs Java classes")).toEqual(["JavaScript", "Java"]);
    expect(deriveSkills("What is the event loop in JavaScript?")).toEqual(["JavaScript"]);
  });

  it("normalizes aliases (reactjs, react.js, nodejs, postgres, k8s, tailwind)", () => {
    expect(deriveSkills("reactjs state management")[0]).toBe("React");
    expect(deriveSkills("React.js hooks")[0]).toBe("React");
    expect(deriveSkills("nodejs streams")[0]).toBe("Node.js");
    expect(deriveSkills("postgres indexes")[0]).toBe("PostgreSQL");
    expect(deriveSkills("k8s pods")[0]).toBe("Kubernetes");
    expect(deriveSkills("tailwind vs plain CSS")).toEqual(["CSS"]);
  });

  it("tags topic shelves (system design, patterns, SOLID, TDD, FP) without over-matching", () => {
    expect(deriveSkills("Design a URL shortening service like Bit.ly")).toEqual(["System Design"]);
    expect(deriveSkills("system design interviews")).toEqual(["System Design"]);
    expect(deriveSkills("How would you design a rate limiter?")).toEqual([]); /* not question-leading */
    expect(deriveSkills("What is the Law of Demeter?")).toEqual(["Design Patterns"]);
    expect(deriveSkills("Explain cohesion and loose coupling")).toEqual(["Design Patterns"]);
    expect(deriveSkills("Name the SOLID principles")).toEqual(["SOLID"]);
    expect(deriveSkills("a solid understanding of algorithms")).toEqual([]); /* bare lowercase 'solid' never matches */
    expect(deriveSkills("In TDD, why write tests first?")).toEqual(["TDD"]);
    expect(deriveSkills("What defines a pure function?")).toEqual(["Functional Programming"]);
  });

  it("tags the 2026-09-25 topic shelves (ML, data structures, microservices, concurrency) without over-matching", () => {
    expect(deriveSkills("What is the bias-variance trade-off?")).toEqual(["Machine Learning"]);
    expect(deriveSkills("What is overfitting and how do you prevent it?")).toEqual(["Machine Learning"]);
    expect(deriveSkills("Which metrics for evaluating regression models do you know?")).toEqual(["Machine Learning"]);
    expect(deriveSkills("How do you handle regression testing in CI?")).toEqual([]); /* regression ≠ ML */
    expect(deriveSkills("Explain hash tables vs binary search trees and time complexity")).toEqual(["Data Structures"]);
    expect(deriveSkills("What is Big-O notation?")).toEqual(["Data Structures"]);
    expect(deriveSkills("What are microservices and how do they communicate?")).toEqual(["Microservices"]);
    expect(deriveSkills("What is a deadlock and how do you prevent race conditions?")).toEqual(["Concurrency"]);
    expect(deriveSkills("What are MSE and RMSE?")).toEqual([]); /* unknown acronyms never guessed */
    expect(deriveSkills("Tell me about machine learning model deployment")).toEqual(["Machine Learning"]);
  });

  it("does not tag CSS from the bare English word 'less' (#113/#121/#169 stray lesson)", () => {
    expect(deriveSkills("What are your thoughts on the use of the goto statement in programming?")).toEqual([]);
    expect(deriveSkills("What are the benefits of refactoring code in software development?")).toEqual([]);
    expect(deriveSkills("Use fewer globals and less duplication")).toEqual([]);
    expect(deriveSkills("When would you choose Sass or Less over plain CSS?")).toEqual(["CSS"]); /* preprocessor context still matches */
  });

  it("never guesses unknown technologies and tolerates empty input", () => {
    expect(deriveSkills("Explain the CAP theorem and consistency models.")).toEqual([]);
    expect(deriveSkills("")).toEqual([]);
    expect(deriveSkills(null)).toEqual([]);
  });
});

describe("noiseReason — the live crawl's noise, classified", () => {
  it("catches exactly the junk from the 2026-09-24 run", () => {
    expect(noiseReason("http://codepen.io/kennymkchan/pen/qRGGeG?editors=0012")).toBe("url-as-question");
    expect(noiseReason("?utm_source=Engineering+Blog+Subscribers&utm_campaign=9eae78")).toBe("tracking-params");
    expect(noiseReason('&utm_medium=email&utm_term=0_af8c"}],"_tags":["story","author_fagnerbrack"')).toBe("tracking-params");
    expect(noiseReason("nobody-could-answer-1cc7e38f4f59?gi=119a6b0e346b")).toBe("tracking-params");
    expect(noiseReason("Как получить доступ к закрытым видео?")).toBe("non-english");
    /* repo-name items are readable-but-thin — the review-first tier, not hard noise */
    expect(noiseReason("What the f*ck Python? 😱")).toBeNull();
    expect(looksTruncated("What the f*ck Python? 😱")).toBe(true);
  });

  it("catches HN announcement/promo stories, but not Ask-HN prep questions", () => {
    expect(noiseReason("Tell HN: Interviewed with Triplebyte? Your profile is about to become public")).toBe("hn-story");
    expect(noiseReason("Show HN: Oasys – system design interview platform")).toBe("hn-story");
    expect(noiseReason("show hn: pair programming whiteboard")).toBe("hn-story");
    /* Ask HN = someone asking a real (if scrappy) question — reviewers decide */
    expect(noiseReason("Ask HN: How do you prepare for system design interviews?")).toBeNull();
    expect(looksTruncated("Ask HN: How do you prepare for system design interviews?")).toBe(false);
  });

  it("passes legit interview questions (null = keep)", () => {
    expect(noiseReason("What is hoisting in JavaScript?")).toBeNull();
    expect(noiseReason("Explain the difference between REST and GraphQL.")).toBeNull();
    expect(noiseReason("How would you design a rate limiter?")).toBeNull();
    expect(noiseReason(null)).toBe("empty");
  });
});

describe("looksTruncated — the review-first tier", () => {
  it("flags lowercase fragments and short no-punctuation lines", () => {
    expect(looksTruncated("developer's skill level?")).toBe(true);
    expect(looksTruncated("skills...  what do you think?")).toBe(true);
    expect(looksTruncated("What is hoisting in JavaScript?")).toBe(false);
  });
});

describe("partitionNoiseItems — split + skill tagging", () => {
  it("keeps good items with derived skills, drops noise with reasons", () => {
    const good = { question: "What are React hooks?", answer: "Functions that let you use state.", skills: [] as string[] };
    const junk = { question: "http://codepen.io/pen/123", answer: "", skills: [] as string[] };
    const [keep, dropped] = partitionNoiseItems([good, junk]);
    expect(keep).toHaveLength(1);
    expect(keep[0].skills).toEqual(["React"]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toBe("url-as-question");
  });

  it("respects existing skill tags instead of re-deriving", () => {
    const [keep] = partitionNoiseItems([{ question: "Explain database sharding strategies for large datasets.", answer: "Splitting data across nodes.", skills: ["PostgreSQL"] }]);
    expect(keep[0].skills).toEqual(["PostgreSQL"]);
  });
});

describe("normalizeItem derives skills centrally (cron + discovery + Run-now)", () => {
  const source = { fieldId: "frontend", level: "senior" };
  it("extractFromJson items come out skill-tagged", () => {
    const items = extractFromJson(
      { questions: [{ question: "What is reconciliation in React?", answer: "The diffing algorithm." }] },
      source
    );
    expect(items[0].skills).toEqual(["React"]);
  });

  it("explicit source skills win over derivation", () => {
    const items = extractFromJson(
      { questions: [{ question: "What is hoisting?", answer: "A", skills: ["JavaScript"] }] },
      source
    );
    expect(items[0].skills).toEqual(["JavaScript"]);
  });
});

describe("buildUpsertSql writes the skills column", () => {
  it("inserts skill tags as jsonb ( Bank filter source of truth)", () => {
    const sql = buildUpsertSql([
      { fieldId: "frontend", level: "senior", question: "What's hoisting?", answer: "A", keyPoints: [], skills: ["JavaScript", "React"] }
    ]);
    expect(sql).toContain("meta, skills, published");
    expect(sql).toContain('["JavaScript","React"]');
  });
});

describe("routeItems drops hard noise and surfaces it", () => {
  const seed = { url: "https://example.com/q", host: "example.com", kind: "html", attributionSource: "example.com", licenseCheck: false };

  it("noise never reaches qa/problems; good items do", () => {
    const items = [
      { fieldId: "frontend", level: "senior", question: "What is lifting state in React?", answer: "Move state up.", keyPoints: [], skills: ["React"] },
      { fieldId: "frontend", level: "senior", question: "http://codepen.io/x/pen/1", answer: "", keyPoints: [] },
      { fieldId: "frontend", level: "senior", question: '&utm_medium=email&utm_term=0_af8"}],"_tags":["story"', answer: "", keyPoints: [] }
    ] as unknown as { fieldId: string; level: string; question: string; answer: string; keyPoints: string[] }[];
    const out = routeItems(items, seed);
    expect(out.qa).toHaveLength(1);
    expect(out.noise).toHaveLength(2);
    expect(out.noise.map(n => n.reason)).toEqual(["url-as-question", "tracking-params"]);
  });

  it("returns an empty noise array for clean input (backward compatible)", () => {
    const out = routeItems(
      [{ fieldId: "frontend", level: "senior", question: "What is useMemo?", answer: "Memoization.", keyPoints: [] }],
      seed
    );
    expect(out.noise).toEqual([]);
  });
});
