import type { LevelId, QA } from "../types";
import { LEVELS, fieldById } from "../data";
import { publishedFor } from "../services/remoteConfig";

export type BankItem = QA & { lvl: LevelId };

/** Flattens one field's questions across all levels, optionally filtered by search text.
    Includes admin-published question-bank updates. */
export function bankItems(fieldSel: string, q: string): { field: ReturnType<typeof fieldById>; items: BankItem[] } {
  const field = fieldById(fieldSel);
  const items: BankItem[] = [];
  for (const l of LEVELS) {
    for (const qq of [...(field?.questions[l.id] ?? []), ...publishedFor(fieldSel, l.id)]) items.push({ ...qq, lvl: l.id });
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
