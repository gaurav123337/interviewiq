import type { Cat, Config, LevelId, QA, Session, SessionQuestion } from "../types";
import { SYSTEM_DESIGN, BEHAVIORAL, CTO_POOL, CEO_POOL, fieldById, companyById, levelById, LEVELS, LEVEL_INDEX } from "../data";
import { shuffle, pickN } from "./random";
import { pickRelevant } from "./relevance";

const CAT: Record<Cat, { label: string; color: string }> = {
  company: { label: "Company Fit", color: "#6366f1" },
  field: { label: "Technical", color: "#22d3ee" },
  behavioral: { label: "Behavioral", color: "#34d399" },
  sysdesign: { label: "System Design", color: "#a855f7" },
  cto: { label: "Leadership", color: "#fbbf24" },
  ceo: { label: "Business", color: "#fb7185" }
};

export interface ComposeArgs {
  fieldId: string | null;
  companyId: string | null;
  levelId: LevelId | null;
  count: number;
  mode: Config["mode"];
}

/** Composes a balanced interview: company-fit + technical depth + system design + behavioral. */
export function composeSession({ fieldId, companyId, levelId, count, mode }: ComposeArgs): Session {
  const field = fieldById(fieldId);
  const company = companyById(companyId);
  const lvl = levelById(levelId);
  const li = LEVEL_INDEX[lvl.id];
  const list: SessionQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: QA | undefined, cat: Cat, qlevel: LevelId, src: string) => {
    if (!q || seen.has(q.q)) return;
    seen.add(q.q);
    list.push({ ...q, cat, catLabel: CAT[cat].label, catColor: CAT[cat].color, level: qlevel, src });
  };
  const fieldQ = (lvlId: LevelId, n: number) => pickN(field?.questions[lvlId] ?? [], n);

  if (levelId === "cto") {
    pickN(company.sample, 2).forEach(q => add(q, "company", "cto", "company"));
    pickN(CTO_POOL, 2).forEach(q => add(q, "cto", "cto", "cto"));
    pickN(BEHAVIORAL, 1).forEach(q => add(q, "behavioral", "cto", "behavioral"));
    fieldQ("principal", 2).forEach(q => add(q, "field", "principal", "field"));
    fieldQ("staff", 1).forEach(q => add(q, "field", "staff", "field"));
    pickN(SYSTEM_DESIGN.principal ?? [], 1).forEach(q => add(q, "sysdesign", "principal", "sysdesign"));
  } else if (levelId === "ceo") {
    pickN(company.sample, 2).forEach(q => add(q, "company", "ceo", "company"));
    pickN(CEO_POOL, 3).forEach(q => add(q, "ceo", "ceo", "ceo"));
    pickN(BEHAVIORAL, 1).forEach(q => add(q, "behavioral", "ceo", "behavioral"));
    fieldQ("principal", 1).forEach(q => add(q, "field", "principal", "field"));
  } else if (mode === "journey") {
    const span = Math.max(1, li);
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const pickLevel = LEVELS[Math.max(0, Math.round(t * span))].id;
      const qs = field?.questions[pickLevel] ?? [];
      add(qs[Math.floor(Math.random() * qs.length)], "field", pickLevel, "field");
    }
    if (li >= 3) pickN(SYSTEM_DESIGN.senior ?? [], 1).forEach(q => add(q, "sysdesign", "senior", "sysdesign"));
    pickN(BEHAVIORAL, 1).forEach(q => add(q, "behavioral", levelId ?? "junior", "behavioral"));
    if (company.sample.length) pickN(company.sample, 1).forEach(q => add(q, "company", levelId ?? "junior", "company"));
  } else {
    const n = count;
    const nCompany = company.sample.length ? Math.max(1, Math.round(n * 0.3)) : 0;
    const nField = Math.max(1, n - nCompany - 1);
    const nSys = li >= 1 && li <= 4 ? Math.max(0, Math.min(1, Math.round(n * 0.12))) : 0;

    pickN(company.sample, Math.min(nCompany, company.sample.length)).forEach(q => add(q, "company", levelId ?? "junior", "company"));
    fieldQ(levelId ?? "junior", nField).forEach(q => add(q, "field", levelId ?? "junior", "field"));
    pickN(BEHAVIORAL, 1).forEach(q => add(q, "behavioral", levelId ?? "junior", "behavioral"));

    if (nSys) {
      const tier = li === 1 ? "mid" : li === 2 ? "senior" : li === 3 ? "staff" : "principal";
      pickN(SYSTEM_DESIGN[tier] ?? [], 1).forEach(q => add(q, "sysdesign", levelId ?? "junior", "sysdesign"));
    }
    if ((li === 2 || li === 3) && count >= 8) {
      fieldQ(LEVELS[li + 1].id, 1).forEach(q => add(q, "field", LEVELS[li + 1].id, "field"));
    }
  }

  const ordered = shuffle(list).sort((a, b) => LEVEL_INDEX[a.level] - LEVEL_INDEX[b.level]);
  return {
    questions: ordered.slice(0, count),
    meta: {
      field: field?.name ?? "General", fieldId: field?.id ?? "general",
      company: company.name, companyId: company.id,
      level: lvl.name, levelId: lvl.id, mode
    }
  };
}

/* ------------------------------------------------------------------ */
/* Keyword-driven composition (JD tailoring + weak-topic follow-ups)    */
/* ------------------------------------------------------------------ */

export interface RelevantArgs {
  fieldId: string | null;
  companyId: string | null;
  levelId: LevelId | null;
  /** Keywords (e.g. job-description terms or missed key points) to prioritize. */
  keywords: string[];
  count: number;
}

/** Same shape as {@link composeSession}, but picks field questions most relevant to `keywords`. */
export function composeRelevantSession({ fieldId, companyId, levelId, keywords, count }: RelevantArgs): Session {
  const field = fieldById(fieldId);
  const company = companyById(companyId);
  const lvl = levelById(levelId);
  const li = LEVEL_INDEX[lvl.id];
  const list: SessionQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: QA | undefined, cat: Cat, qlevel: LevelId, src: string) => {
    if (!q || seen.has(q.q)) return;
    seen.add(q.q);
    list.push({ ...q, cat, catLabel: CAT[cat].label, catColor: CAT[cat].color, level: qlevel, src });
  };
  const fieldQ = (lvlId: LevelId, n: number) => pickRelevant(field?.questions[lvlId] ?? [], keywords, n);

  const nCompany = company.sample.length ? Math.max(1, Math.round(count * 0.25)) : 0;
  const nField = Math.max(2, count - nCompany - 1);

  pickN(company.sample, Math.min(nCompany, company.sample.length)).forEach(q => add(q, "company", lvl.id, "company"));
  fieldQ(lvl.id, nField).forEach(q => add(q, "field", lvl.id, "field"));
  pickN(BEHAVIORAL, 1).forEach(q => add(q, "behavioral", lvl.id, "behavioral"));
  if (li >= 1 && li <= 4) {
    const tier = li === 1 ? "mid" : li === 2 ? "senior" : li === 3 ? "staff" : "principal";
    pickN(SYSTEM_DESIGN[tier] ?? [], 1).forEach(q => add(q, "sysdesign", lvl.id, "sysdesign"));
  }
  if (count >= 8 && li < LEVELS.length - 1) {
    fieldQ(LEVELS[li + 1].id, 1).forEach(q => add(q, "field", LEVELS[li + 1].id, "field"));
  }

  const ordered = shuffle(list).sort((a, b) => LEVEL_INDEX[a.level] - LEVEL_INDEX[b.level]);
  return {
    questions: ordered.slice(0, count),
    meta: {
      field: field?.name ?? "General", fieldId: field?.id ?? "general",
      company: company.name, companyId: company.id,
      level: lvl.name, levelId: lvl.id, mode: "standard"
    }
  };
}
