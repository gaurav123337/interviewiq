import { beforeEach, describe, expect, it } from "vitest";
import { earnCertificate, getCertificates } from "../services/certificates";
import type { SavedSession } from "../types";

/* Item 20 (Phase 3) — load-bearing path: earned certificates.
   Pure + localStorage. The 0.7 eligibility boundary, field/date mapping, hash
   format + determinism, the dedup return-existing branch, and accumulation order
   were all unasserted. Storage suite (in-memory shim from setup.ts). The session
   date is a FIXED epoch (Date.UTC ... noon) so `new Date(s.date).toISOString()`
   is timezone-stable — no clock dependency. No XP assertions (the earn path has
   no XP side effect). */

// Jan 15 2026, 12:00 UTC — noon keeps the ISO date on 2026-01-15 in every zone.
const FIXED_EPOCH = Date.UTC(2026, 0, 15, 12, 0, 0);

function makeSession(opts: {
  id?: string;
  pct?: number;
  grade?: string;
  score?: number;
  date?: number;
} = {}): SavedSession {
  return {
    id: opts.id ?? "s1",
    date: opts.date ?? FIXED_EPOCH,
    meta: {
      field: "Frontend",
      fieldId: "frontend",
      company: "Acme",
      companyId: "acme",
      level: "Senior",
      levelId: "senior",
      mode: "mock",
    },
    config: { count: 5, mode: "mock", timing: "none", voice: false },
    agg: { score: opts.score ?? 42, pct: opts.pct ?? 0.8, grade: opts.grade ?? "A" },
    answers: [],
  };
}

beforeEach(() => localStorage.clear());

describe("earnCertificate — eligibility boundary", () => {
  it("earns at exactly 0.7 (the check is < 0.7)", () => {
    const cert = earnCertificate(makeSession({ pct: 0.7 }));
    expect(cert).not.toBeNull();
    expect(cert!.pct).toBe(0.7);
  });

  it("does not earn just below 0.7", () => {
    expect(earnCertificate(makeSession({ pct: 0.69 }))).toBeNull();
    expect(getCertificates()).toEqual([]);
  });
});

describe("earnCertificate — field & shape mapping", () => {
  it("maps session fields onto the certificate and formats the date", () => {
    const cert = earnCertificate(makeSession())!;
    expect(cert.id).toBe("cert-s1");
    expect(cert.sessionId).toBe("s1");
    expect(cert.level).toBe("Senior");
    expect(cert.field).toBe("Frontend");
    expect(cert.company).toBe("Acme");
    expect(cert.score).toBe(42);
    expect(cert.pct).toBe(0.8);
    expect(cert.grade).toBe("A");
    expect(cert.date).toBe("2026-01-15");
  });

  it("produces an IQ + 8-hex verification hash", () => {
    const cert = earnCertificate(makeSession())!;
    expect(cert.hash).toMatch(/^IQ[0-9a-f]{8}$/);
  });
});

describe("earnCertificate — hash determinism", () => {
  it("is stable for the same session across fresh stores", () => {
    const h1 = earnCertificate(makeSession({ id: "s1" }))!.hash;
    localStorage.clear();
    const h2 = earnCertificate(makeSession({ id: "s1" }))!.hash;
    expect(h1).toBe(h2);
  });

  it("differs for sessions with different identifiers", () => {
    const a = earnCertificate(makeSession({ id: "s1" }))!.hash;
    const b = earnCertificate(makeSession({ id: "s2" }))!.hash;
    expect(a).not.toBe(b);
  });
});

describe("earnCertificate — dedup & accumulation", () => {
  it("returns the existing certificate on a repeat session (no duplicate row)", () => {
    const first = earnCertificate(makeSession({ id: "s1" }))!;
    const again = earnCertificate(makeSession({ id: "s1" }))!;
    expect(again).toEqual(first);
    expect(getCertificates()).toHaveLength(1);
  });

  it("appends distinct sessions in insertion order", () => {
    earnCertificate(makeSession({ id: "s1" }));
    earnCertificate(makeSession({ id: "s2" }));
    const all = getCertificates();
    expect(all).toHaveLength(2);
    expect(all.map(c => c.sessionId)).toEqual(["s1", "s2"]);
  });
});

describe("getCertificates", () => {
  it("defaults to an empty array on a clean store", () => {
    expect(getCertificates()).toEqual([]);
  });
});
