/* Remote product data — the cache the client reads for admin-published
   configuration. Pure (storage-only) so the engine, bank and entitlements
   can read it without depending on the Supabase layer.

   An admin dashboard (components/Admin.tsx) publishes these; initAdmin()
   (services/admin.ts) fetches them and writes here. Offline-first: the app
   always falls back to the last cached copy, then to local defaults. */

import type { LevelId, QA } from "../types";
import { CONFIG } from "../config";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

/* ------------------------------------------------------------------ */
/* Remote configuration                                                */
/* ------------------------------------------------------------------ */

export interface RemoteConfig {
  /** Feature switches. Absent/true = on; false = hidden from the nav / disabled. */
  features: {
    paywall?: boolean;
    roadmap?: boolean;
    playground?: boolean;
    jd?: boolean;
    drill?: boolean;
  };
  /** AI coaching overrides (server-side defaults the product team can tune). */
  ai: {
    enabled?: boolean;
    model?: string;
    /** Model used for RAG embeddings (must return 1536-dim vectors). */
    embeddingsModel?: string;
    maxTokens?: number;
    temperature?: number;
  };
  /** Freemium quotas (override the baked-in free limits). */
  limits: {
    sessionsPerMonth?: number;
    aiPerDay?: number;
  };
  /** Company question-frequency overrides — admin-tunable; merged over the
      baked-in COMPANY_FREQ table so rankings can be tuned without a deploy. */
  companyFreq?: Record<string, Partial<Record<string, 1 | 2 | 3>>>;
}

export const REMOTE_CONFIG_DEFAULTS: RemoteConfig = { features: {}, ai: {}, limits: {}, companyFreq: {} };

export function getRemoteConfig(): RemoteConfig {
  const c = storageGet<RemoteConfig>(STORAGE_KEYS.remoteConfig, REMOTE_CONFIG_DEFAULTS);
  return {
    features: { ...REMOTE_CONFIG_DEFAULTS.features, ...(c?.features ?? {}) },
    ai: { ...REMOTE_CONFIG_DEFAULTS.ai, ...(c?.ai ?? {}) },
    limits: { ...REMOTE_CONFIG_DEFAULTS.limits, ...(c?.limits ?? {}) },
    companyFreq: { ...(c?.companyFreq ?? {}) }
  };
}

export function setRemoteConfig(c: Partial<RemoteConfig>): void {
  storageSet(STORAGE_KEYS.remoteConfig, c);
}

/** Feature on unless the admin explicitly turned it off. */
export function featureOn(f: keyof RemoteConfig["features"]): boolean {
  return getRemoteConfig().features[f] !== false;
}

/** The paywall is the local master switch AND the remote flag. */
export function paywallOn(): boolean {
  return CONFIG.features.paywall && featureOn("paywall");
}

/** Base quotas the product team can override remotely. */
export const BASE_LIMITS = { sessionsPerMonth: 3, aiPerDay: 5 };

export function getLimits(): { sessionsPerMonth: number; aiPerDay: number } {
  const { limits } = getRemoteConfig();
  return {
    sessionsPerMonth: limits.sessionsPerMonth ?? BASE_LIMITS.sessionsPerMonth,
    aiPerDay: limits.aiPerDay ?? BASE_LIMITS.aiPerDay
  };
}

/** AI defaults an admin can push instead of the baked-in ones. */
export function getAiDefaults(): { model?: string; embeddingsModel?: string; maxTokens?: number; temperature?: number } {
  const { ai } = getRemoteConfig();
  return { model: ai.model, embeddingsModel: ai.embeddingsModel, maxTokens: ai.maxTokens, temperature: ai.temperature };
}

export function aiEnabled(): boolean {
  return getRemoteConfig().ai.enabled !== false;
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export interface Announcement {
  id: number;
  title: string;
  body: string;
  badge?: string | null;
  createdAt: number;
  published: boolean;
}

export function getAnnouncements(): Announcement[] {
  return storageGet<Announcement[]>(STORAGE_KEYS.announcements, []);
}

export function setAnnouncements(a: Announcement[]): void {
  storageSet(STORAGE_KEYS.announcements, a);
}

export function getSeenAnnouncements(): number[] {
  return storageGet<number[]>(STORAGE_KEYS.announceSeen, []);
}

export function markAnnouncementSeen(id: number): void {
  const seen = getSeenAnnouncements();
  if (!seen.includes(id)) storageSet(STORAGE_KEYS.announceSeen, [...seen, id]);
}

/** Newest published announcement the user hasn't dismissed yet, if any. */
export function nextUnseenAnnouncement(): Announcement | null {
  const seen = getSeenAnnouncements();
  const unseen = getAnnouncements()
    .filter(a => a.published && !seen.includes(a.id))
    .sort((a, b) => b.createdAt - a.createdAt);
  return unseen[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Published question-bank updates                                     */
/* ------------------------------------------------------------------ */

export interface PublishedQuestion {
  id: number;
  fieldId: string;
  level: LevelId;
  question: string;
  answer: string;
  keyPoints: string[];
  published: boolean;
  /** Last edit/review time (ISO) — drives staleness in the Quality Center. */
  updatedAt: string | null;
}

export function getPublishedQuestions(): PublishedQuestion[] {
  return storageGet<PublishedQuestion[]>(STORAGE_KEYS.publishedQ, []);
}

export function setPublishedQuestions(qs: PublishedQuestion[]): void {
  storageSet(STORAGE_KEYS.publishedQ, qs);
}

/** Published questions for one field+level, as plain QA (mergeable into pools). */
export function publishedFor(fieldId: string, level: LevelId): QA[] {
  return getPublishedQuestions()
    .filter(p => p.published && p.fieldId === fieldId && p.level === level)
    .map(p => ({ q: p.question, a: p.answer, kp: p.keyPoints }));
}
