/* Dependency-free .docx reader — a DOCX is just a ZIP of OOXML parts, so we
   parse the end-of-central-directory + central directory by hand, pull
   word/document.xml, inflate it (stored or deflate-raw via the platform
   DecompressionStream), and strip the markup to plain text. Works fully
   offline; no new dependencies. */

const decoder = new TextDecoder();

interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflated. */
  method: number;
  data: Uint8Array;
}

/** Scan backwards for the end-of-central-directory signature (PK\x05\x06). */
function findEocd(buf: Uint8Array): number {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) return i;
  }
  return -1;
}

const u16 = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number): number => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Parse the central directory; slice each entry's data out of the local header. */
export function parseZip(buf: Uint8Array): ZipEntry[] {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error("Not a zip archive");
  const cdOffset = u32(buf, eocd + 16);
  const cdSize = u32(buf, eocd + 12);
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p + 46 <= end) {
    if (buf[p] !== 0x50 || buf[p + 1] !== 0x4b || buf[p + 2] !== 0x01 || buf[p + 3] !== 0x02) break;
    const method = u16(buf, p + 10);
    const compSize = u32(buf, p + 20);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const localOffset = u32(buf, p + 42);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    /* local file header is 30 bytes + its own name/extra lengths */
    const dataStart = localOffset + 30 + u16(buf, localOffset + 26) + u16(buf, localOffset + 28);
    entries.push({ name, method, data: buf.subarray(dataStart, dataStart + compSize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Inflate a deflate-raw stream via the platform API (Node 18+ / modern
    browsers). Response-based so it also works under jsdom (whose Blob has no
    .stream()). */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof (globalThis as { DecompressionStream?: unknown }).DecompressionStream !== "function") {
    throw new Error("DecompressionStream unavailable in this browser");
  }
  const body = new Response(new Uint8Array(data)).body;
  if (!body) throw new Error("Streaming not available");
  const out = body.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** word/document.xml → readable text: paragraph/tab/break aware, entities decoded. */
export function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts the text of a .docx file (word/document.xml, paragraphs joined). */
export async function extractDocxText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = parseZip(buf);
  const doc = entries.find(e => e.name === "word/document.xml");
  if (!doc) throw new Error("Not a .docx file — missing word/document.xml");
  const raw = doc.method === 0 ? doc.data : await inflateRaw(doc.data);
  return docxXmlToText(decoder.decode(raw));
}
