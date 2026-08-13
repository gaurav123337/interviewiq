/* Salary benchmark extended features — location-aware markets (COL + FX),
   percentile positioning, and the offer comparison / negotiation helper. */

import { describe, expect, it } from "vitest";
import {
  BENCHMARK, detectMarket, fmtAmount, fmtBand, marketBand, MARKETS, negotiationPoints,
  offerVerdict, ordinal, positionInBand, positionRead
} from "../services/salaryBench";

describe("market detection", () => {
  it("matches known metros from free-text locations", () => {
    expect(detectMarket("San Francisco, CA").id).toBe("us-sf");
    expect(detectMarket("Bengaluru, India").id).toBe("in-bengaluru");
    expect(detectMarket("London, UK").id).toBe("uk-london");
    expect(detectMarket("Mumbai, Maharashtra").id).toBe("in-mumbai");
    expect(detectMarket("Remote — anywhere in the US").id).toBe("us-remote");
  });

  it("falls back to US national for unknown or empty locations", () => {
    expect(detectMarket("").id).toBe("us-national");
    expect(detectMarket(undefined).id).toBe("us-national");
    expect(detectMarket("Somewhere, Mars").id).toBe("us-national");
  });

  it("maps country-level locations to a tier-1 market", () => {
    expect(detectMarket("India").id).toBe("in-mumbai");
  });

  it("contains every level band for every market entry", () => {
    for (const m of MARKETS) {
      const senior = marketBand(BENCHMARK.senior, m);
      expect(senior.max).toBeGreaterThan(senior.min);
      expect(senior.currency).toBe(m.currency);
    }
  });
});

describe("marketBand", () => {
  it("leaves US national unchanged", () => {
    const mb = marketBand(BENCHMARK.senior, MARKETS[0]);
    expect(mb).toMatchObject({ min: 150000, max: 220000, currency: "USD" });
  });

  it("applies the COL multiplier for a high-cost market", () => {
    const mb = marketBand(BENCHMARK.senior, detectMarket("San Francisco, CA"));
    expect(mb.min).toBe(192000); // 150k × 1.28
    expect(mb.max).toBe(281600); // 220k × 1.28
    expect(mb.currency).toBe("USD");
  });

  it("converts to local currency for an international market", () => {
    const mb = marketBand(BENCHMARK.senior, detectMarket("Bengaluru, India"));
    // 150k USD × 0.22 = 33k USD → × ₹83 = 27,39,000 INR
    expect(mb.min).toBe(2739000);
    expect(mb.minUsd).toBe(33000);
    expect(mb.currency).toBe("INR");
  });
});

describe("percentile positioning", () => {
  const band = { min: 150000, max: 220000 };

  it("computes the position within a band, clamped", () => {
    expect(positionInBand(150000, band.min, band.max)).toBe(0);
    expect(positionInBand(185000, band.min, band.max)).toBe(50);
    expect(positionInBand(220000, band.min, band.max)).toBe(100);
    expect(positionInBand(999999, band.min, band.max)).toBe(100);
    expect(positionInBand(0, band.min, band.max)).toBe(0);
  });

  it("reads the position into a labelled verdict", () => {
    expect(positionRead(10).tone).toBe("low");
    expect(positionRead(50).tone).toBe("mid");
    expect(positionRead(90).tone).toBe("high");
    expect(positionRead(65).label).toContain("mid-point");
  });
});

describe("offer verdict + negotiation", () => {
  const band = { min: 150000, max: 220000 };
  const market = MARKETS[0]; // US national

  it("flags offers below the band and reports the gap", () => {
    const v = offerVerdict({ base: 120000, equity: 0, currency: "USD" }, band);
    expect(v.kind).toBe("below");
    expect(v.gapToMin).toBe(30000);
    expect(v.total).toBe(120000);
    expect(v.label).toBe("Below the market band");
  });

  it("recognizes offers inside and above the band", () => {
    expect(offerVerdict({ base: 180000, equity: 0, currency: "USD" }, band).kind).toBe("in-range");
    expect(offerVerdict({ base: 180000, equity: 50000, currency: "USD" }, band).kind).toBe("above");
  });

  it("counts equity toward total comp", () => {
    const v = offerVerdict({ base: 130000, equity: 40000, currency: "USD" }, band);
    expect(v.kind).toBe("in-range");
    expect(v.total).toBe(170000);
  });

  it("anchors below-market offers at the mid-point, honestly", () => {
    const pts = negotiationPoints({ base: 120000, equity: 0, currency: "USD" }, band, market);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(pts[0]).toContain("mid-point");
    expect(pts.some(p => p.includes("equity") || p.includes("ESOP"))).toBe(true);
  });

  it("advises in-range offers to name a specific number", () => {
    const pts = negotiationPoints({ base: 185000, equity: 0, currency: "USD" }, band, market);
    expect(pts.some(p => p.includes("specific number"))).toBe(true);
  });
});

describe("currency + ordinal formatting", () => {
  it("formats USD compactly", () => {
    expect(fmtAmount(150000, "USD")).toBe("$150k");
    expect(fmtAmount(1250000, "USD")).toBe("$1.3M");
    expect(fmtBand(120000, 150000, "USD")).toBe("$120k–$150k");
  });

  it("formats INR in lakhs and crores", () => {
    expect(fmtAmount(2739000, "INR")).toBe("₹27L");
    expect(fmtAmount(12500000, "INR")).toBe("₹1.3Cr");
    expect(fmtAmount(45000, "INR")).toBe("₹45k");
  });

  it("formats GBP and EUR with the right symbols", () => {
    expect(fmtAmount(96000, "GBP")).toBe("£96k");
    expect(fmtAmount(180000, "EUR")).toBe("€180k");
  });

  it("uses proper ordinal suffixes for percentiles", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(73)).toBe("73rd");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(100)).toBe("100th");
  });
});
