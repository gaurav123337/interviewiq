import { useState } from "react";
import { btnDanger, cardCls, btnPrimary, btnGhost, btnSm, Chip } from "../ui";
import { toast } from "../../toast";
import {
  MODULE_LIST,
  clearModuleModel,
  getModuleOverride,
  hasModuleOverride,
  listModuleOverrides,
  setModuleModel,
  testModuleModel,
  type ModuleId
} from "../../services/moduleModels";
import { checkModelSuitability } from "../../services/modelCapabilities";

export function ModuleModelsSection() {
  const [overrides, setOverrides] = useState(() => listModuleOverrides());
  const [testingModule, setTestingModule] = useState<ModuleId | null>(null);
  const [testResult, setTestResult] = useState<{ moduleId: ModuleId; ok: boolean; note: string } | null>(null);
  const [editing, setEditing] = useState<ModuleId | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editBase, setEditBase] = useState("");
  const [editModel, setEditModel] = useState("");

  const hasAny = overrides.length > 0;

  const startEdit = (id: ModuleId) => {
    const existing = getModuleOverride(id);
    setEditing(id);
    setEditKey(existing?.key ?? "");
    setEditBase(existing?.base ?? "");
    setEditModel(existing?.model ?? "");
    setTestResult(null);
  };

  const cancelEdit = () => { setEditing(null); setTestResult(null); };

  const doTest = async (id: ModuleId) => {
    setTestingModule(id);
    setTestResult(null);
    try {
      const r = await testModuleModel({ key: editKey, base: editBase || "https://api.openai.com/v1", model: editModel || undefined });
      setTestResult({ moduleId: id, ...r });
    } finally {
      setTestingModule(null);
    }
  };

  const doSave = (id: ModuleId) => {
    if (!editKey.trim()) {
      clearModuleModel(id);
    } else {
      setModuleModel(id, { key: editKey.trim(), base: editBase.trim(), model: editModel.trim() });
    }
    setOverrides(listModuleOverrides());
    setEditing(null);
    toast(editKey.trim() ? `✅ Model saved for ${MODULE_LIST.find(m => m.id === id)?.label ?? id}` : `↩️ ${MODULE_LIST.find(m => m.id === id)?.label ?? id} reverted to global default`);
  };

  const doClear = (id: ModuleId) => {
    clearModuleModel(id);
    setOverrides(listModuleOverrides());
    toast(`↩️ ${MODULE_LIST.find(m => m.id === id)?.label ?? id} reverted to global default`);
  };

  return (
    <section className={`${cardCls} p-6`}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-[16px] font-extrabold">🧩 AI models per feature</h2>
        {hasAny && <Chip tone="co">{overrides.length} custom</Chip>}
      </div>
      <p className="mb-4 text-[13px] text-mut">
        Each feature can use a different model. Leave empty to use the global default from above.
        Some models are better at explaining (tutor), others at code generation (playground).
      </p>

      <div className="space-y-2">
        {MODULE_LIST.map(m => {
          const active = hasModuleOverride(m.id);
          const isEditing = editing === m.id;
          const ov = overrides.find(o => o.moduleId === m.id);

          if (isEditing) {
            return (
              <div key={m.id} className="rounded-xl border border-acc1/40 bg-acc1/10 p-4 space-y-2.5">
                <div className="text-[13px] font-bold text-acctxt">✏️ {m.label}</div>
                <p className="text-[12px] text-mut">{m.description}</p>
                <label className="block">
                  <span className="mb-0.5 block text-[11.5px] font-bold text-mut">API key</span>
                  <input
                    type="password" value={editKey} onChange={e => setEditKey(e.target.value)}
                    placeholder="sk-… (leave blank to use global key)"
                    className="w-full rounded-lg border border-line/20 bg-deep/60 px-3 py-2 font-mono text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-0.5 block text-[11.5px] font-bold text-mut">Base URL</span>
                    <input
                      value={editBase} onChange={e => setEditBase(e.target.value)}
                      placeholder="Default: OpenAI"
                      className="w-full rounded-lg border border-line/20 bg-deep/60 px-3 py-2 font-mono text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[11.5px] font-bold text-mut">Model</span>
                    <input
                      value={editModel} onChange={e => setEditModel(e.target.value)}
                      placeholder={m.suggestedModel}
                      className="w-full rounded-lg border border-line/20 bg-deep/60 px-3 py-2 font-mono text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                    />
                    {editModel.trim() && (() => {
                      const suit = checkModelSuitability(editModel.trim(), m.id);
                      if (suit.severity === "ok") {
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-ok/20 bg-ok/5 px-2.5 py-1.5">
                            <span className="text-[13px]">✅</span>
                            <span className="text-[11px] font-medium text-ok">{suit.message}</span>
                          </div>
                        );
                      }
                      if (suit.severity === "warning") {
                        return (
                          <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px]">⚠️</span>
                              <span className="text-[11px] font-bold text-amber-400">Not ideal for {m.label}</span>
                            </div>
                            <p className="mt-1 text-[10.5px] text-amber-300/80 leading-snug">{suit.message}</p>
                            {suit.suggestions.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {suit.suggestions.map((s, i) => (
                                  <p key={i} className="text-[10.5px] text-amber-300/70">💡 {s}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </label>
                </div>
                {testResult && testResult.moduleId === m.id && (
                  <div className={`rounded-lg px-3 py-2 text-[12px] ${testResult.ok ? "border border-ok/30 bg-ok/10 text-ok" : "border border-warn/30 bg-warn/10 text-warn"}`}>
                    {testResult.ok ? "✓" : "✗"} {testResult.note}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className={btnPrimary + btnSm} onClick={() => doSave(m.id)}>Save</button>
                  <button className={btnGhost + btnSm} onClick={() => doTest(m.id)} disabled={testingModule === m.id || !editKey.trim()}>
                    {testingModule === m.id ? <><span className="spinner" />Testing…</> : "Test connection"}
                  </button>
                  <button className={btnGhost + btnSm} onClick={cancelEdit}>Cancel</button>
                  {active && <button className={btnDanger + btnSm} onClick={() => { doClear(m.id); cancelEdit(); }}>Clear override</button>}
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${active ? "border-acc1/30 bg-acc1/10" : "border-line/10 bg-wht/5"}`}>
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold">{m.label}</span>
                  {active && <Chip tone="ok">{ov?.model ?? "custom"}</Chip>}
                  {active && ov?.model && (() => {
                    const suit = checkModelSuitability(ov.model, m.id);
                    if (!suit.suitable) return <Chip tone="warn">⚠️ not ideal</Chip>;
                    return null;
                  })()}
                </div>
                <div className="text-[12px] text-mut">{m.description}</div>
                {!active && <div className="text-[11px] text-fnt">Suggested: {m.suggestedModel}</div>}
                {m.needsJson && <div className="text-[10px] text-amber-400/60">⚡ Needs non-thinking model for JSON output</div>}
              </div>
              <button className={btnGhost + btnSm} onClick={() => startEdit(m.id)}>
                {active ? "✏️ Edit" : "➕ Set model"}
              </button>
              {active && <button className={btnGhost + btnSm} onClick={() => doClear(m.id)}>↩️ Default</button>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-line/10 bg-wht/3 p-3">
        <p className="text-[11.5px] font-bold text-fnt">💡 How to choose the right model</p>
        <ul className="mt-1 space-y-1 text-[11px] text-mut">
          <li>• <span className="text-ok">JSON-output modules</span> (refine, normalize, index, quality) → use <code className="text-fnt">gpt-4o-mini</code> or <code className="text-fnt">gemini-2.5-flash</code> (no thinking mode)</li>
          <li>• <span className="text-ok">Conversational modules</span> (coach, hints, feedback, tutor) → thinking models like <code className="text-fnt">qwen3</code> or <code className="text-fnt">deepseek-r1</code> are great here</li>
          <li>• The compatibility indicator (⚠️/✅) shows whether your chosen model fits the module's needs</li>
          <li>• Leave empty to use the global default model from the AI settings above</li>
        </ul>
      </div>
    </section>
  );
}
