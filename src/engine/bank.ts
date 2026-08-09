import type { LevelId, QA } from "../types";
import { LEVELS, fieldById } from "../data";

export type BankItem = QA & { lvl: LevelId };

/** Flattens one field's questions across all levels, optionally filtered by search text. */
export function bankItems(fieldSel: string, q: string): { field: ReturnType<typeof fieldById>; items: BankItem[] } {
  const field = fieldById(fieldSel);
  const items: BankItem[] = [];
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
