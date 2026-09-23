#!/usr/bin/env node
/* Pure takedown-engine helpers (Phase 4 Item D3).
   Zero I/O — everything here is unit-testable from vitest. The I/O side lives
   in scripts/takedown.js (management-API reads/writes + regeneration) and in
   the admin UI (soft-delete flow). Mirrors scrape-lib.js style.
   The suppression SQL clause itself lives in scrape-lib.js
   (buildSuppressionClause / buildUpsertSql's optional 2nd arg). */

/* --------------------------------- md5 --------------------------------- */
/* Dependency-free md5 (RFC 1321) so tests can verify the DB-side suppression
   hashes: discovery.sql stores md5(lower(trim(question_text))) in
   takedown_suppressions, and questionHash() must produce the identical value
   for the same text (verified against pg md5() in the D3 tests). */

const K = new Int32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
]);

const S = new Int32Array([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
]);

function rotl(x, c) {
  return (x << c) | (x >>> (32 - c));
}

function toUtf8Bytes(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  /* minimal ASCII fallback for environments without TextEncoder */
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i] = code < 128 ? code : 63; /* '?' for non-ASCII in fallback mode */
  }
  return out;
}

function md5Hex(input) {
  const s = input;
  const n = s.length;
  const paddedLen = (((n + 8) >> 6) + 1) * 16;
  const words = new Int32Array(paddedLen);
  for (let i = 0; i < n; i++) words[i >> 2] |= s[i] << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  words[paddedLen - 2] = (n * 8) & 0xffffffff; /* low 32 bits of bit length */
  words[paddedLen - 1] = Math.floor((n * 8) / 0x100000000);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let i = 0; i < paddedLen; i += 16) {
    const [A, B, C, D] = [a, b, c, d];
    for (let j = 0; j < 64; j++) {
      let f;
      let g;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const x = words[i + g] | 0;
      const oldD = d;
      d = c;
      c = b;
      b = (b + rotl((a + f + K[j] + x) | 0, S[j])) | 0;
      a = oldD;
    }
    a = (a + A) | 0;
    b = (b + B) | 0;
    c = (c + C) | 0;
    d = (d + D) | 0;
  }

  const out = new Uint8Array(16);
  const put = (v, off) => {
    out[off] = v & 0xff;
    out[off + 1] = (v >>> 8) & 0xff;
    out[off + 2] = (v >>> 16) & 0xff;
    out[off + 3] = (v >>> 24) & 0xff;
  };
  put(a, 0);
  put(b, 4);
  put(c, 8);
  put(d, 12);
  let hex = "";
  for (const byte of out) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** Matches the DB side (discovery.sql): md5(lower(trim(question_text))). */
export function questionHash(text) {
  return md5Hex(toUtf8Bytes(String(text ?? "").trim().toLowerCase()));
}

/* ------------------------ coding-problem side ------------------------- */

/** Minimal per-problem entry for the takedown report / regenerated file. */
export function problemEntry(problem) {
  const source = problem?.source ?? problem?.meta?.source ?? null;
  return {
    id: String(problem?.id ?? ""),
    title: String(problem?.title ?? ""),
    source,
    attributed: Boolean(source)
  };
}

/** Pure filter used by scripts/takedown.js — drops taken-down problem ids. */
export function excludeProblems(problems, takenDownIds) {
  const drop = new Set((takenDownIds ?? []).map(String));
  return (problems ?? []).filter((p) => !drop.has(String(p?.id)));
}

/** Regenerated-file header note (pasted into the emitProblemsFile preamble). */
export function takedownNote(takenDownIds) {
  const n = (takenDownIds ?? []).length;
  return n
    ? `   Takedown note (${new Date().toISOString().slice(0, 10)}): ${n} attributed problem(s) removed on request — see takedowns audit table.\n`
    : "";
}
