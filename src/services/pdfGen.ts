/* Dependency-free PDF generator — renders plain text as a letter-size PDF.
   No external lib: builds the PDF object graph + xref table by hand. Used
   for the tailored resume export so the app stays offline-capable and
   dependency-light. Handles line wrapping and bold section headers
   (ALL-CAPS lines in the resume template become headers). */

const PAGE_W = 612;   /* letter width, pt */
const PAGE_H = 792;   /* letter height, pt */
const MARGIN = 54;
const LINE_H = 13;
const HEADER_GAP = 7;
const MAX_LINES = 48; /* keep to a single page; truncate defensively */

/** Width of a string in Helvetica at a given size (approx: 0.5em avg). */
const widthOf = (s: string, size: number): number => s.length * size * 0.5;

/** Wrap text to fit the printable width. */
function wrap(text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(" ");
    let line = "";
    for (const w of words) {
      const probe = line ? line + " " + w : w;
      if (widthOf(probe, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = probe;
      }
    }
    out.push(line);
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Escape text and produce a PDF literal string. */
const lit = (s: string): string => `(${esc(s)})`;

/** Render plain text (resume template format) into a one-page PDF blob. */
export function renderResumePdf(text: string): Blob {
  const objs: string[] = [];
  const add = (body: string): number => {
    objs.push(body);
    return objs.length;
  };

  /* Content stream: section headers in bold, body lines in regular. */
  const stream: string[] = [];
  let lines: { bold: boolean; text: string }[] = [];

  /* Parse the template: ALL-CAPS standalone lines are section headers. */
  for (const raw of text.split("\n")) {
    const t = raw.trim();
    if (t && t === t.toUpperCase() && t.length > 2 && !/\d/.test(t[0]) && /^[A-Z0-9 .•·+&#-]+$/.test(t)) {
      lines.push({ bold: true, text: t });
    } else {
      for (const w of wrap(raw, 9.5, PAGE_W - 2 * MARGIN)) lines.push({ bold: false, text: w });
    }
  }
  lines = lines.slice(0, MAX_LINES);

  /* Write the stream with "Tf" font switching (Helvetica / -Bold). */
  const fontOf = (bold: boolean): string => (bold ? "/F2" : "/F1");
  let y = PAGE_H - MARGIN - 24;
  stream.push("BT");
  for (const { bold, text } of lines) {
    if (y < MARGIN + LINE_H) break; /* single page */
    if (bold) {
      y -= HEADER_GAP;
      stream.push(`${fontOf(true)} 11 Tf 0.16 0.18 0.24 rg`);
    } else {
      stream.push(`${fontOf(false)} 9.5 Tf 0.22 0.24 0.3 rg`);
    }
    stream.push(`1 0 0 1 ${MARGIN} ${y} Tm`);
    stream.push(`${lit(text)} Tj`);
    y -= LINE_H;
  }
  stream.push("ET");

  const streamId = add(`${stream.join("\n")}`);
  const fontHelv = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  const fontHelvBold = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );
  /* pages object must exist before the page references it as /Parent */
  const pagesId = add("<< /Type /Pages /Kids [] /Count 1 >>");
  const pageId = add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Resources << /Font << /F1 ${fontHelv} 0 R /F2 ${fontHelvBold} 0 R >> >> ` +
    `/Contents ${streamId} 0 R >>`
  );
  const catalogId = add("<< /Type /Catalog /Pages " + pagesId + " 0 R >>");

  /* page added after the pages object — patch the Kids array in place */
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  /* Assemble with correct object numbering (objs are 1-indexed). */
  const offsets: number[] = [];
  let cursor = 0;
  const chunks: string[] = [];
  chunks.push("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  cursor = chunks[0].length;
  objs.forEach((_, i) => {
    offsets.push(cursor);
    const body = `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
    chunks.push(body);
    cursor += body.length;
  });
  const xrefStart = cursor;
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  chunks.push(xref);
  cursor += xref.length;
  const trailer =
    `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(trailer);

  return new Blob(chunks, { type: "application/pdf" });
}

/** Triggers a browser download of the generated resume PDF. */
export function downloadResumePdf(resumeText: string, jobTitle: string, company: string): void {
  const blob = renderResumePdf(resumeText);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resume-${company}-${jobTitle.replace(/[^\w-]+/g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
