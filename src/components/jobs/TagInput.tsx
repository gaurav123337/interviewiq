import { useState } from "react";


export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const items = draft.split(",").map(s => s.trim()).filter(Boolean);
    if (!items.length) return;
    onChange([...new Set([...value, ...items])]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-acc1/35 bg-acc1/10 px-2.5 py-1 text-[12px] font-bold text-acctxt">
            {t}
            <button className="text-[11px] text-mut hover:text-bad" onClick={() => onChange(value.filter(x => x !== t))} aria-label={`Remove ${t}`}>✕</button>
          </span>
        ))}
      </div>
      <input
        className="inp mt-1.5"
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}
