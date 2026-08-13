/* Dependency-free ZIP writer — store mode (no compression), so it's tiny,
   offline-safe, and testable. Produces a valid archive readable by any
   unzip tool / OS. Used for the batch apply-kit export. */

const CRC_TABLE: number[] = (() => {
  const t = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}
function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

export interface ZipEntry {
  name: string;
  content: string | Uint8Array;
}

/** Build a ZIP archive (store method) from named entries. */
export function zipFiles(entries: ZipEntry[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc(e.name);
    const data = typeof e.content === "string" ? enc(e.content) : e.content;
    const crc = crc32(data);

    /* local file header */
    chunks.push(new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, /* PK\x03\x04 */
      20, 0,                 /* version needed */
      0, 0,                  /* flags */
      0, 0,                  /* method: store */
      0, 0, 0, 0,            /* mod time/date */
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      0, 0                   /* extra length */
    ]));
    chunks.push(nameBytes);
    chunks.push(data);

    /* central directory entry */
    central.push(new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, /* PK\x01\x02 */
      20, 0, 20, 0,           /* version made by / needed */
      0, 0,                   /* flags */
      0, 0,                   /* method: store */
      0, 0, 0, 0,             /* mod time/date */
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      0, 0,                   /* extra length */
      0, 0,                   /* comment length */
      0, 0,                   /* disk number */
      0, 0,                   /* internal attrs */
      0, 0, 0, 0,             /* external attrs */
      ...u32(offset)
    ]));
    central.push(nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  /* end of central directory */
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const cdOffset = offset;
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, /* PK\x05\x06 */
    0, 0, 0, 0,             /* disk / cd-disk */
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(cdOffset),
    0, 0                    /* comment length */
  ]);

  const all: Uint8Array[] = [...chunks, ...central, eocd];
  const total = all.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return new Blob([out], { type: "application/zip" });
}

/** Triggers a browser download of the archive. */
export function downloadZip(entries: ZipEntry[], fileName: string): void {
  const blob = zipFiles(entries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
