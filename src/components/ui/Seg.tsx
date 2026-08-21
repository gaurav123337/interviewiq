/* Seg.tsx — segmented control / tab bar */

export function Seg<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 overflow-x-auto rounded-xl bg-wht/10 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all ${value === o.value ? "grad-bg text-white shadow-[0_4px_12px_rgba(99,102,241,.4)]" : "text-mut hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
