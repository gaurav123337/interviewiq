/* Dependency-free .docx writer — a DOCX is just a ZIP of OOXML parts, so we
   reuse the store-mode ZIP writer. Renders the parsed resume sections as a
   single-column, text-first document — the layout ATS parsers handle best.
   Works fully offline; no new dependencies. */

import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { buildResume } from "./applyKit";
import { parseResumeSections } from "./resumeHtml";
import { zipFiles } from "./zip";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Runs of text: bold = section header, regular = body. */
function paragraphsFor(text: string): { bold: boolean; text: string }[] {
  const { header, sections } = parseResumeSections(text);
  const out: { bold: boolean; text: string }[] = [];
  for (const h of header) out.push({ bold: h === header[0], text: h });
  for (const sec of sections) {
    out.push({ bold: true, text: sec.title.toUpperCase() });
    for (const item of sec.items) out.push({ bold: false, text: item });
  }
  return out;
}

/** Builds a .docx Blob from the resume text (single-column, text-first). */
export function resumeDocxBlob(resumeText: string): Blob {
  const body = paragraphsFor(resumeText)
    .map(p => {
      const props = p.bold
        ? '<w:rPr><w:b/><w:sz w:val="24"/></w:rPr>'
        : '<w:rPr><w:sz w:val="20"/></w:rPr>';
      return `<w:p><w:r>${props}<w:t xml:space="preserve">${escXml(p.text)}</w:t></w:r></w:p>`;
    })
    .join("");

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

  return zipFiles([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rels },
    { name: "word/document.xml", content: documentXml }
  ]);
}

const contentTypes =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `</Types>`;

const rels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

/** One-click download of the ATS-safe .docx. */
export function downloadResumeDocx(
  profile: CareerProfile,
  job: JobPosting,
  match: JobMatch | null
): void {
  const blob = resumeDocxBlob(buildResume(profile, job, match));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resume-${job.company}-${job.title.replace(/[^\w-]+/g, "-")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
