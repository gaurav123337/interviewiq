/* PDF / text extraction for the admin import pipeline.
   pdf.js runs in-browser — no upload to a server; content stays on device.
   The pdfjs library is lazy-loaded only when a file is actually processed,
   keeping it out of the app's startup bundle (and out of test envs). */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractDocxText } from "./docxRead";

type TextLike = { str?: string };

/** Extracts the text of a .pdf file (every page, joined). Throws on failure. */
export async function extractPdfText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const task = getDocument({ data: buf });
  const doc = await task.promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map(it => ("str" in it ? String((it as TextLike).str ?? "") : ""))
          .join(" ")
      );
    }
  } finally {
    await task.destroy().catch(() => {});
  }
  return pages.join("\n\n");
}

/** Extracts text from a supported file (pdf, docx or plain text) by extension. */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".docx")) return extractDocxText(file);
  return file.text();
}
