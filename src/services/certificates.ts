/* Earned certificates for completed mock/practice sessions. Stored in
   localStorage so they work offline and persist across sessions. */

import { storageGet, storageSet } from "./storage";
import type { SavedSession } from "../types";

const CERT_KEY = "iq.certificates";

export interface Certificate {
  id: string;
  sessionId: string;
  level: string;
  field: string;
  company: string;
  score: number;
  pct: number;
  grade: string;
  date: string; // ISO date
  /** SHA-256 style verification hash (not a real hash — enough for a badge). */
  hash: string;
}

/** Generates a verification string from session data. */
function makeHash(s: SavedSession): string {
  const raw = `${s.id}|${s.agg.pct}|${s.agg.grade}|${s.date}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h) + raw.charCodeAt(i);
    h |= 0;
  }
  return `IQ${Math.abs(h).toString(16).padStart(8, "0")}`;
}

/** Earn a certificate when a session meets the bar (≥ 70%). Returns null if not eligible. */
export function earnCertificate(s: SavedSession): Certificate | null {
  if (s.agg.pct < 0.7) return null;

  const existing = getCertificates();
  if (existing.some(c => c.sessionId === s.id)) return existing.find(c => c.sessionId === s.id) ?? null;

  const cert: Certificate = {
    id: `cert-${s.id}`,
    sessionId: s.id,
    level: s.meta.level,
    field: s.meta.field,
    company: s.meta.company,
    score: s.agg.score,
    pct: s.agg.pct,
    grade: s.agg.grade,
    date: new Date(s.date).toISOString().slice(0, 10),
    hash: makeHash(s)
  };

  storageSet(CERT_KEY, [...existing, cert]);
  return cert;
}

export function getCertificates(): Certificate[] {
  return storageGet<Certificate[]>(CERT_KEY, []);
}