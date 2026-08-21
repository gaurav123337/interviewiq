/* Switch.tsx — toggle switch */

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-block h-[26px] w-[46px] flex-none cursor-pointer">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="absolute inset-0 rounded-full bg-wht/20 transition-colors peer-checked:grad-bg" />
      <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
}
