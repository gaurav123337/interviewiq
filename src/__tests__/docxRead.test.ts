/* .docx reader — dependency-free: parses the ZIP central directory, inflates
   word/document.xml (stored or deflate-raw), and strips markup to text. */

import { describe, expect, it } from "vitest";
import { crc32, zipFiles } from "../services/zip";
import { docxXmlToText, extractDocxText, parseZip } from "../services/docxRead";

const enc = (s: string) => new TextEncoder().encode(s);
const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

const DOC_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:body>` +
  `<w:p><w:r><w:t>Senior Frontend Engineer</w:t></w:r></w:p>` +
  `<w:p><w:r><w:t>7+ years with React &amp; TypeScript</w:t></w:r></w:p>` +
  `</w:body></w:document>`;

/** Builds a zip with arbitrary compression methods (0 = store, 8 = deflate). */
async function buildZip(entries: { name: string; data: Uint8Array; method: number }[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc(e.name);
    const crc = crc32(e.data);
    chunks.push(new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, e.method, 0, 0, 0, 0, 0,
      ...u32(crc), ...u32(e.data.length), ...u32(e.data.length), ...u16(nameBytes.length), 0, 0
    ]));
    chunks.push(nameBytes, e.data);
    central.push(new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, e.method, 0, 0, 0, 0, 0,
      ...u32(crc), ...u32(e.data.length), ...u32(e.data.length),
      ...u16(nameBytes.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset)
    ]));
    central.push(nameBytes);
    offset += 30 + nameBytes.length + e.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const cdOffset = offset;
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0,
    ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(cdOffset), 0, 0
  ]);
  const all = [...chunks, ...central, eocd];
  const total = all.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const body = new Response(new Uint8Array(data)).body;
  if (!body) throw new Error("no body");
  const out = body.pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

describe("docxXmlToText", () => {
  it("joins paragraphs and decodes entities", () => {
    expect(docxXmlToText(DOC_XML)).toBe("Senior Frontend Engineer\n7+ years with React & TypeScript");
  });

  it("handles tabs, breaks and numeric entities", () => {
    const xml = `<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/></w:r></w:p><w:p><w:r><w:t>&#39;q&#39;</w:t></w:r></w:p>`;
    expect(docxXmlToText(xml)).toBe("a\tb\n\n'q'");
  });
});

describe("extractDocxText", () => {
  it("reads a stored (uncompressed) docx produced by the app's zip writer", async () => {
    const blob = zipFiles([{ name: "word/document.xml", content: DOC_XML }]);
    const file = new File([blob], "resume.docx");
    const text = await extractDocxText(file);
    expect(text).toContain("Senior Frontend Engineer");
    expect(text).toContain("7+ years with React & TypeScript");
  });

  it("inflates a deflated (real-world) docx", async () => {
    const compressed = await deflateRaw(enc(DOC_XML));
    const zip = await buildZip([{ name: "word/document.xml", data: compressed, method: 8 }]);
    const file = new File([new Uint8Array(zip)], "resume.docx");
    const text = await extractDocxText(file);
    expect(text).toContain("Senior Frontend Engineer");
    expect(text).toContain("7+ years with React & TypeScript");
  });

  it("rejects files without word/document.xml", async () => {
    const zip = await buildZip([{ name: "word/styles.xml", data: enc("<x/>"), method: 0 }]);
    const file = new File([new Uint8Array(zip)], "resume.docx");
    await expect(extractDocxText(file)).rejects.toThrow(/document.xml/);
  });

  it("rejects non-zip bytes", async () => {
    const file = new File([enc("this is just a text file")], "resume.docx");
    await expect(extractDocxText(file)).rejects.toThrow(/zip/i);
  });

  it("parseZip exposes entries with names and methods", async () => {
    const zip = await buildZip([{ name: "word/document.xml", data: enc(DOC_XML), method: 0 }]);
    const entries = parseZip(zip);
    expect(entries.map(e => e.name)).toContain("word/document.xml");
    expect(entries[0].method).toBe(0);
  });
});
