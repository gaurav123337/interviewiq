import { useSettings } from "./SettingsContext";
import { aiAvailable, clearKey } from "../../ai";
import { btnGhost, btnPrimary, btnSm, cardCls } from "../ui";

export function AISection() {
  const s = useSettings();

  return (
    <section className={`${cardCls} p-6`}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-[16px] font-extrabold">✨ AI feedback (optional)</h2>
        {aiAvailable() && <span className="rounded-full border border-ok/40 bg-ok/10 px-2.5 py-0.5 text-[11px] font-bold text-ok">ON</span>}
      </div>
      <p className="mb-4 text-[13px] text-mut">
        Works with any OpenAI-compatible endpoint — OpenAI, OpenRouter, Groq, Ollama. The key stays in your browser only.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-bold text-mut">API key</span>
          <input
            type="password" value={s.key} onChange={e => s.setKey(e.target.value)}
            placeholder="sk-…"
            className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-mut">Base URL</span>
            <input
              value={s.base} onChange={e => s.setBase(e.target.value)}
              className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-mut">Model</span>
            <input
              value={s.model} onChange={e => s.setModel(e.target.value)}
              className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-1">
          <button className={btnPrimary + btnSm} onClick={s.saveKey}>Save key</button>
          <button className={btnGhost + btnSm} onClick={s.testConnection} disabled={s.testing}>
            {s.testing ? <><span className="spinner" />Testing…</> : "Test connection"}
          </button>
          <button className={btnGhost + btnSm} onClick={() => { clearKey(); s.setKey(""); }}>Remove key</button>
        </div>
      </div>
    </section>
  );
}
