import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FIELDS, LEVELS, levelById } from "../data";
import type { LevelId } from "../types";
import { bankItems } from "../engine";
import { useApp } from "../store";
import { btnSoft, btnSm, cardCls, Chip, KpNeutral } from "./ui";

export function Bank() {
  const { state, practice } = useApp();
  const [q, setQ] = useState("");
  const [fieldSel, setFieldSel] = useState(state.ob.field ?? FIELDS[0].id);
  const [lvlSel, setLvlSel] = useState<LevelId | "all">("all");

  const { field, items } = useMemo(() => bankItems(fieldSel, q), [fieldSel, q]);
  const shown = lvlSel === "all" ? items : items.filter(i => i.lvl === lvlSel);

  return (
    <div className="anim-view">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">📚 Question Bank</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Every question, <span className="grad-text">with solutions</span>.</h1>
        <p className="mx-auto mt-2 max-w-[600px] text-[14.5px] text-mut">Browse {FIELDS.length} fields × {LEVELS.length} levels of technical questions with model answers and key points.</p>
      </div>

      {/* toolbar */}
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]">🔍</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search questions, topics, keywords…"
            className="w-full rounded-xl border border-line/15 bg-deep/80 py-2.5 pl-10 pr-4 text-[14px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
          />
        </div>
        <select
          value={fieldSel}
          onChange={e => { setFieldSel(e.target.value); setLvlSel("all"); }}
          className="rounded-xl border border-line/15 bg-deep/80 px-3.5 py-2.5 text-[14px] font-semibold focus:border-acc1/80 focus:outline-none"
        >
          {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
      </div>

      {/* level filter */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <FilterChip active={lvlSel === "all"} onClick={() => setLvlSel("all")}>All levels</FilterChip>
        {LEVELS.map(l => (
          <FilterChip key={l.id} active={lvlSel === l.id} onClick={() => setLvlSel(l.id)}>{l.icon} {l.name}</FilterChip>
        ))}
      </div>

      {shown.length > 0 && (
        <div className="mb-3 mt-4"><Chip>{shown.length} question{shown.length === 1 ? "" : "s"} · {field?.name ?? ""}</Chip></div>
      )}

      {shown.length ? (
        <div className="space-y-3">
          {shown.map((i, idx) => (
            <details key={idx} className={`${cardCls} group px-5 py-4`}>
              <summary className="flex cursor-pointer list-none items-center gap-2.5">
                <Chip tone="lvl">{levelById(i.lvl).icon} {levelById(i.lvl).name}</Chip>
                <span className="min-w-[140px] flex-1 text-[14.5px] font-bold leading-snug">{i.q}</span>
                <span className="text-mut transition-transform group-open:rotate-90">▸</span>
              </summary>
              <div className="mt-4 space-y-3 border-t border-line/10 pt-4">
                <div className="rounded-xl border border-acc1/25 bg-acc1/10 p-4">
                  <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-acc3">Model answer</div>
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-ink">{i.a}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(i.kp || []).map(k => <KpNeutral key={k}>{k}</KpNeutral>)}
                </div>
                <button className={btnSoft + btnSm} onClick={() => practice(fieldSel, i)}>🎯 Practice this question</button>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className={`${cardCls} mt-4 flex flex-col items-center px-5 py-16 text-center`}>
          <div className="mb-3 text-[42px]">🔎</div>
          <h3 className="mb-1 text-lg font-bold">No questions found</h3>
          <p className="text-sm text-mut">Try a different search term or level.</p>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12.5px] font-bold transition-all ${active ? "grad-bg border-transparent text-white shadow-[0_4px_12px_rgba(99,102,241,.4)]" : "border-line/15 bg-wht/5 text-mut hover:bg-wht/10 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
