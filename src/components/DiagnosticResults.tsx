import { useState } from "react";
import { LEVEL_INDEX, levelById, fieldById } from "../data";
import { aiAvailable } from "../ai";
import { explainGap } from "../services/tutor";
import { getProfile } from "../services/goal";
import { useApp } from "../store";
import { toast } from "../toast";
import { btnGhost, btnOk, btnPrimary, btnSm, cardCls } from "./ui";

/** Shown by Results.tsx when the just-finished session was a skill diagnostic. */
export function DiagnosticResults() {
  const { nav, startDiagnostic } = useApp();
  const [aiFor, setAiFor] = useState<string | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const profile = getProfile();
  const goal = profile?.goal;
  const diag = profile?.diagnostic;

  if (!goal || !diag) {
    return (
      <div className={`${cardCls} mx-auto mt-6 max-w-[640px] p-7 text-center`}>
        <div className="mb-2 text-[40px]">🎯</div>
        <h3 className="mb-1 text-lg font-extrabold">Diagnostic finished, but no goal was saved</h3>
        <p className="mb-5 text-sm text-mut">Head to the Roadmap tab to set your target role, then retake the diagnostic.</p>
        <button className={btnPrimary} onClick={() => nav("roadmap")}>🧭 Open Roadmap</button>
      </div>
    );
  }

  const field = fieldById(goal.fieldId);
  const target = levelById(goal.targetLevel);
  const measured = levelById(diag.level);
  const gap = LEVEL_INDEX[goal.targetLevel] - LEVEL_INDEX[diag.level];
  const weak = profile.skills
    .filter(s => (s.measured !== undefined ? s.measured : s.self / 5) < 0.6)
    .slice(0, 5);

  const onExplain = async (skill: string) => {
    setAiFor(skill); setAi(null); setAiLoading(true);
    try { setAi(await explainGap(skill, goal)); }
    catch (e) { toast("✗ " + ((e as Error).message || "AI unavailable — add an API key in Settings")); setAi(null); }
    finally { setAiLoading(false); }
  };

  return (
    <div className="anim-view mx-auto max-w-[720px]">
      <div className="overflow-hidden rounded-[22px] border border-line/10 bg-gradient-to-b from-panel to-panel2 p-7 text-center card-shadow">
        <div className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">Skill diagnostic complete 🎯</div>
        <div className="mt-4 text-[40px] font-extrabold leading-none">
          {measured.icon} {measured.name}
        </div>
        <div className="mt-2 text-sm text-mut">Measured across {goal.fieldId ? field?.name : ""} questions · {Math.round(diag.pct * 100)}% overall coverage</div>
        <div className={`mx-auto mt-4 w-fit rounded-full border px-4 py-1 text-[13px] font-extrabold ${gap > 0 ? "border-warn/40 bg-warn/10 text-warn" : "border-ok/40 bg-ok/10 text-ok"}`}>
          {gap > 0 ? `${gap} level${gap === 1 ? "" : "s"} below ${target.name}` : "You're at your target level 🎉"}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5 no-print">
          <button className={btnOk + btnSm} onClick={() => nav("roadmap")}>🧭 Build my roadmap →</button>
          <button className={btnGhost + btnSm} onClick={() => startDiagnostic(goal.fieldId, goal.targetLevel)}>🔁 Retake diagnostic</button>
        </div>
      </div>

      <div className={`${cardCls} mt-5 p-5`}>
        <h3 className="text-[16px] font-extrabold">📊 Skill gaps</h3>
        <p className="mb-4 text-[13px] text-mut">Coverage per skill (self-assessment in brackets). Weak skills feed the roadmap's P0 topics.</p>
        <div className="space-y-2.5">
          {profile.skills.filter(s => s.measured !== undefined).map(s => {
            const cov = s.measured ?? 0;
            const tone = cov >= 0.8 ? "bg-ok" : cov >= 0.6 ? "bg-warn" : "bg-bad";
            return (
              <div key={s.skill}>
                <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold">
                  <span className="text-mut">{s.skill}</span>
                  <span className={cov >= 0.6 ? "text-ok" : "text-bad"}>{Math.round(cov * 100)}%{s.self ? <span className="text-fnt"> · self {s.self}/5</span> : null}</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-wht/10">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(3, cov * 100)}%` }} />
                </div>
                {cov < 0.6 && aiAvailable() && (
                  <div className="mt-1.5">
                    <button className={btnGhost + btnSm} onClick={() => onExplain(s.skill)} disabled={aiLoading && aiFor === s.skill}>
                      {aiLoading && aiFor === s.skill ? "…" : "✨"} Why this matters
                    </button>
                    {aiFor === s.skill && ai && (
                      <p className="mt-2 whitespace-pre-wrap rounded-xl border border-acc1/25 bg-acc1/10 p-3 text-[13px] leading-relaxed text-ink">{ai}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!profile.skills.some(s => s.measured !== undefined) && (
          <p className="text-[13px] text-fnt">No per-skill measurements — retake the diagnostic for a detailed breakdown.</p>
        )}
        {weak.length > 0 && !aiAvailable() && (
          <p className="mt-3 text-[12px] text-fnt">💡 Add an AI key in Settings to get an explanation of why each gap matters.</p>
        )}
      </div>
    </div>
  );
}
