/* NumField.tsx — labeled number input */

export function NumField({ label, value, step = 1, onChange }: {
  label: string; value: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-mut">{label}</span>
      <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="inp w-full" />
    </label>
  );
}
