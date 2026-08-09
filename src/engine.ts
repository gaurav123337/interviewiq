import type { Aggregate, Answer, Cat, CatStat, Config, Feedback, LevelId, QA, Session, SessionQuestion } from "./types";
import { SYSTEM_DESIGN, BEHAVIORAL, CTO_POOL, CEO_POOL, fieldById, companyById, levelById, LEVELS, LEVEL_INDEX } from "./data";

const CAT: Record<Cat, { label: string; color: string }> = {
  company: { label: "Company Fit", color: "#6366f1" },
  field: { label: "Technical", color: "#22d3ee" },
  behavioral: { label: "Behavioral", color: "#34d399" },
  sysdesign: { label: "System Design", color: "#a855f7" },
  cto: { label: "Leadership", color: "#fbbf24" },
  ceo: { label: "Business", color: "#fb7185" }
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pickN = <T,>(arr: T[], n: number): T[] => {
  if (n <= 0) return [];
  return shuffle(arr).slice(0, Math.min(n, arr.length));
};

const STOP = new Set(
  ("a an the and or but if of to in on at for with from by as is are was were be been being it its this that these those do does did done has have had i you he she we they them their your my our his her not no can could will would should may might must shall than then so such there here what which who whom when where why how all any both each few more most other some only own same very just about into over under up out off above below again once also too").split(" ")
);

const tokens = (text: string): string[] =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(w => w.length > 1 && !STOP.has(w));

const kpTokens = (kp: string): string[] => tokens(kp).filter(w => w.length > 2);

export interface ComposeArgs {
  fieldId: string | null;
  companyId: string | null;
  levelId: LevelId | null;
  count: number;
  mode: Config["mode"];
}

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

/* ---------- scoring ---------- */

export function scoreAnswer(userText: string, question: SessionQuestion): { score: number; pct: number; covered: string[]; missed: string[]; words: number } {
  const words = tokens(userText);
  const ansLen = words.length;
  let hit = 0;
  const covered: string[] = [];
  const missed: string[] = [];
  for (const kp of question.kp ?? []) {
    const kt = kpTokens(kp);
    if (!kt.length) continue;
    const isHit = kt.some(t => words.includes(t));
    if (isHit) { hit++; covered.push(kp); } else { missed.push(kp); }
  }
  const total = Math.max(1, question.kp.length);
  const rawPct = hit / total;
  const lenPct = Math.min(1, ansLen / 30);
  const combined = rawPct * 0.75 + lenPct * 0.25;
  let score = Math.round(1 + combined * 4);
  if (!userText || !userText.trim()) score = 0;
  score = Math.max(0, Math.min(5, score));
  return { score, pct: combined, covered, missed, words: ansLen };
}

const LEVEL_TIPS: Record<LevelId, string> = {
  junior: "At junior level, showing a clear, correct reasoning process matters more than perfect answers.",
  mid: "At mid level, interviewers want structured answers: approach, implementation, and tradeoffs.",
  senior: "At senior level, lead with the tradeoffs — interviewers are evaluating judgment, not just correctness.",
  staff: "At staff level, connect your answer to org-level impact: leverage, risk, and how the decision scales.",
  principal: "At principal level, frame answers around org-wide strategy and high-leverage bets.",
  cto: "At CTO level, answers should land in business terms: cost, risk, people, and outcomes.",
  ceo: "At CEO level, everything ties back to strategy, markets, and the people who execute it."
};

export function buildFeedback(userText: string, question: SessionQuestion): Feedback {
  const r = scoreAnswer(userText, question);
  const strengths: string[] = [];
  const gaps: string[] = [];
  if (r.score === 0) {
    strengths.push("You submitted an empty answer — every answer, even a partial one, is a chance to show your reasoning.");
    gaps.push("Structure your answer: state your approach, walk through it, then summarize the tradeoffs.");
  } else {
    if (r.covered.length) {
      pickN(r.covered, Math.min(2, r.covered.length)).forEach(kp => strengths.push(`You touched on: ${kp}.`));
    } else {
      strengths.push("You engaged with the question — keep building the habit of structuring answers (approach → reasoning → tradeoffs).");
    }
    if (r.missed.length) {
      pickN(r.missed, Math.min(3, r.missed.length)).forEach(kp => gaps.push(`Consider covering: ${kp}.`));
    }
    if (r.words < 25 && r.score >= 1) {
      gaps.push(`Your answer was brief (${r.words} words). Interviewers reward concrete detail — add an example or walk through your reasoning step by step.`);
    }
    if (r.words >= 25 && r.score <= 2) {
      gaps.push("Length isn't the issue — coverage is. Re-read the model answer and note which key points you missed.");
    }
    gaps.push(LEVEL_TIPS[question.level]);
  }
  return { ...r, strengths, gaps };
}

export function grade(pct: number): string {
  return pct >= 0.9 ? "A" : pct >= 0.8 ? "B" : pct >= 0.65 ? "C" : pct >= 0.5 ? "D" : "F";
}

interface CatAcc { label: string; score: number; pct: number; n: number }

export function aggregate(answers: Answer[]): Aggregate {
  const byCat = new Map<string, CatAcc>();
  let total = 0;
  let sum = 0;
  for (const a of answers) {
    const cat = a.q.catLabel;
    const cur = byCat.get(cat) ?? { label: cat, score: 0, pct: 0, n: 0 };
    cur.n++;
    cur.score = 0;
    byCat.set(cat, cur);
  }
  for (const a of answers) {
    const cur = byCat.get(a.q.catLabel)!;
    cur.score += a.fb.score;
  }
  for (const a of answers) {
    total++;
    sum += a.fb.score;
  }
  if (!total) return { score: 0, pct: 0, grade: "F", cats: [] };
  const cats: CatStat[] = [...byCat.entries()].map(([label, v]) => ({
    label,
    score: +(v.score / v.n).toFixed(2),
    pct: v.score / (v.n * 5)
  }));
  const pct = sum / (total * 5);
  return { score: +(pct * 5).toFixed(2), pct, grade: grade(pct), cats };
}

export function topicSuggestions(answers: Answer[]): string[] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    for (const kp of a.fb.missed ?? []) counts.set(kp, (counts.get(kp) ?? 0) + 1);
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([kp]) => kp);
}

export function bankItems(fieldSel: string, q: string): { field: ReturnType<typeof fieldById>; items: (QA & { lvl: LevelId })[] } {
  const field = fieldById(fieldSel);
  const items: (QA & { lvl: LevelId })[] = [];
  for (const l of LEVELS) {
    for (const qq of field?.questions[l.id] ?? []) items.push({ ...qq, lvl: l.id });
  }
  if (q) {
    const t = q.toLowerCase();
    return {
      field,
      items: items.filter(i =>
        i.q.toLowerCase().includes(t) ||
        (i.a ?? "").toLowerCase().includes(t) ||
        (i.kp ?? []).some(k => k.toLowerCase().includes(t))
      )
    };
  }
  return { field, items };
}
