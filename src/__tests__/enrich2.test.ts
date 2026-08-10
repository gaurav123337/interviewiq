// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { analyzeResume } from "../services/resume";
import { earnCertificate, getCertificates } from "../services/certificates";
import { encodeSharePayload, decodeSharePayload } from "../components/ShareView";
import type { SavedSession } from "../types";

beforeEach(() => localStorage.clear());

describe("resume import", () => {
  it("detects a senior backend resume", () => {
    const r = analyzeResume("Senior Backend Engineer — 7+ years building REST APIs, microservices, PostgreSQL and distributed systems with Go and Kubernetes.");
    expect(r.levelId).toBe("senior");
    expect(r.fieldId).toBe("backend");
    expect(r.skills.length).toBeGreaterThan(0);
  });

  it("detects a junior frontend resume by keyword density", () => {
    const r = analyzeResume("Junior Frontend Developer. React, CSS, HTML, JavaScript, responsive UI, accessibility, webpack build.");
    expect(r.levelId).toBe("junior");
    expect(r.fieldId).toBe("frontend");
  });

  it("defaults to backend/mid when nothing matches", () => {
    const r = analyzeResume("I ride bicycles and enjoy cooking.");
    expect(r.fieldId).toBe("backend");
    expect(r.levelId).toBe("mid");
  });
});

describe("share payload", () => {
  it("round-trips a payload through base64url encoding", () => {
    const p = { id: "x", date: "2026-08-10", meta: { field: "Backend", company: "Stripe", level: "Senior", mode: "mock" as const }, agg: { score: 4.2, pct: 0.84, grade: "A" }, cats: [{ label: "Technical", pct: 0.9 }] };
    const enc = encodeSharePayload(p);
    expect(enc).not.toContain("+");
    expect(enc).not.toContain("/");
    /* padding stripped — round-trip still works */
    const dec = decodeSharePayload(enc);
    expect(dec?.agg.grade).toBe("A");
    expect(dec?.meta.company).toBe("Stripe");
  });

  it("returns null for corrupted payloads", () => {
    expect(decodeSharePayload("$$$not-valid$$$")).toBeNull();
  });
});

describe("certificates", () => {
  const session: SavedSession = {
    id: "s1", date: Date.now(),
    meta: { field: "Backend", fieldId: "backend", company: "Stripe", companyId: "stripe", level: "Senior", levelId: "senior", mode: "mock" },
    config: { count: 8, mode: "mock", timing: "relaxed", voice: false },
    agg: { score: 4.2, pct: 0.84, grade: "A" },
    answers: []
  };

  it("earns a certificate for a passing score", () => {
    const cert = earnCertificate(session);
    expect(cert).not.toBeNull();
    expect(cert!.hash).toMatch(/^IQ/);
    expect(getCertificates()).toHaveLength(1);
  });

  it("does not earn a certificate below 70%", () => {
    const low: SavedSession = { ...session, id: "s2", agg: { score: 2, pct: 0.4, grade: "C" } };
    expect(earnCertificate(low)).toBeNull();
    expect(getCertificates()).toHaveLength(0);
  });

  it("is idempotent for the same session", () => {
    earnCertificate(session);
    const second = earnCertificate(session);
    expect(second!.hash).toBe(earnCertificate(session)!.hash);
    expect(getCertificates()).toHaveLength(1);
  });
});