/* Scanned-PDF OCR fallback — gating logic for when pdfjs text extraction
   yields almost nothing and the page is OCR'd instead (services/pdf.ts). */

import { describe, expect, it } from "vitest";
import { shouldOcr } from "../services/pdf";

describe("shouldOcr", () => {
  it("triggers OCR when pdfjs extracted almost no text from a real page", () => {
    expect(shouldOcr("", 1)).toBe(true);
    expect(shouldOcr("   \n  ", 3)).toBe(true);
    expect(shouldOcr("stray header only", 2)).toBe(true);
  });

  it("does not OCR text PDFs — they already extracted fine", () => {
    expect(shouldOcr("Senior Go Engineer 9+ years building microservices", 1)).toBe(false);
  });

  it("does not OCR empty files with no pages", () => {
    expect(shouldOcr("", 0)).toBe(false);
  });
});
