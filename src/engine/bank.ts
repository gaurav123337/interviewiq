import type { LevelId, QA } from "../types";
import { LEVELS, fieldById } from "../data";
import { publishedFor } from "../services/remoteConfig";

export type BankItem = QA & { lvl: LevelId; addedAt?: number | null; skills?: string[] };

/** Flattens one field's questions across all levels, optionally filtered by search text
    and/or skill. Includes admin-published question-bank updates. */
export function bankItems(fieldSel: string, q: string, skill = ""): { field: ReturnType<typeof fieldById>; items: BankItem[] } {
  const field = fieldById(fieldSel);
  let items: BankItem[] = [];
  for (const l of LEVELS) {
    for (const qq of [...(field?.questions[l.id] ?? []), ...publishedFor(fieldSel, l.id)]) items.push({ ...qq, lvl: l.id });
  }
  const s = skill.trim();
  if (s) items = items.filter(i => matchesSkill(i, s));
  if (q) {
    const t = q.toLowerCase();
    items = items.filter(i =>
      i.q.toLowerCase().includes(t) ||
      (i.a ?? "").toLowerCase().includes(t) ||
      (i.kp ?? []).some(k => k.toLowerCase().includes(t))
    );
  }
  return { field, items };
}

/** True when an item belongs to a skill: an explicit tag match wins (exact,
    case-insensitive); untagged items — the whole static core bank — still match
    through a q/a/key-points substring check. */
export function matchesSkill(item: Pick<BankItem, "q" | "a" | "kp" | "skills">, skill: string): boolean {
  const s = skill.trim().toLowerCase();
  if (!s) return true;
  if (item.skills?.some(k => k.trim().toLowerCase() === s)) return true;
  return (
    item.q.toLowerCase().includes(s) ||
    (item.a ?? "").toLowerCase().includes(s) ||
    (item.kp ?? []).some(k => k.toLowerCase().includes(s))
  );
}

/** Skill chips for the public-bank filter: the field's own skills first, then any
    extra tags published questions carry — deduped case-insensitively. */
export function bankSkillChips(fieldSkills: readonly string[] | undefined, items: readonly Pick<BankItem, "skills">[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const k = raw.trim();
    if (!k) return;
    const key = k.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(k);
  };
  for (const s of fieldSkills ?? []) push(s);
  for (const i of items) for (const s of i.skills ?? []) push(s);
  return out;
}

/** "22 Sep 2026" for an Added-chip, or null when the question has no timestamp
    (static core-bank questions). */
export function addedLabel(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
