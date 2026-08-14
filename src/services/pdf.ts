/* PDF / text extraction for the admin import pipeline.
   pdf.js runs in-browser — no upload to a server; content stays on device.
   The pdfjs library is lazy-loaded only when a file is actually processed,
   keeping it out of the app's startup bundle (and out of test envs).

   Scanned PDFs (image-only pages) get a tesseract.js OCR fallback: the
   library is lazy-loaded and its worker/wasm/lang data are fetched from the
   jsdelivr CDN on first use, so OCR needs connectivity while text PDFs stay
   fully offline. */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ensureUint8Polyfills } from "./uint8Polyfill";
import { extractDocxText } from "./docxRead";

/* pdfjs-dist 6.x uses Uint8Array.prototype.toHex (ES2024) for document
   fingerprints; old engines (Chromium < 139, Safari < 18.2) lack it. Install
   the polyfill on the main thread too — it covers the fake-worker fallback. */
ensureUint8Polyfills();

type TextLike = { str?: string };

/** Pure gate: scanned pages (almost no extractable text) get OCR'd. */
export function shouldOcr(text: string, pageCount: number): boolean {
  return text.trim().length < 40 && pageCount > 0;
}

/** Extracts the text of a .pdf file (every page, joined). Throws on failure. */
export async function extractPdfText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  if (!GlobalWorkerOptions.workerPort) {
    try {
      /* wrapper worker — polyfills Uint8Array inside the worker's own scope */
      const { default: PdfWorker } = await import("./pdf.worker?worker");
      GlobalWorkerOptions.workerPort = new PdfWorker();
    } catch {
      /* fallback: let pdfjs spin up the raw worker; if it can't, the fake
         worker runs on the main thread where ensureUint8Polyfills() already
         applied at module load. */
      GlobalWorkerOptions.workerSrc = workerUrl;
    }
  }
  const buf = await file.arrayBuffer();
  const task = getDocument({ data: buf });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map(it => ("str" in it ? String((it as TextLike).str ?? "") : ""))
          .join(" ")
      );
    }
    let text = pages.join("\n\n");
    /* scanned pages yield almost no extractable text — OCR them as a fallback */
    if (shouldOcr(text, doc.numPages)) {
      try {
        const ocr = await ocrPdfPages(doc);
        if (ocr.trim().length > text.trim().length) text = ocr;
      } catch {
        /* OCR unavailable (offline, blocked CDN…) — keep what pdfjs found */
      }
    }
    return text;
  } finally {
    await task.destroy().catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* OCR fallback for scanned (image-only) PDFs                          */
/* ------------------------------------------------------------------ */

/** Render every page to a canvas and run tesseract.js on it. Requires
    connectivity on first use (worker, wasm core and eng language data are
    fetched from the CDN). Never throws to the caller — failures just mean
    "no OCR", and the empty-file check in the UI reports it. */
async function ocrPdfPages(doc: PDFDocumentProxy): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      /* 2× scale — better accuracy on small text, still fast for a resume */
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const { data } = await worker.recognize(canvas);
      parts.push(data.text);
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}

/** Extracts text from a supported file (pdf, docx or plain text) by extension. */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".docx")) return extractDocxText(file);
  return file.text();
}
