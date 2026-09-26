/* 💎 Platinum feature card — bridges the app to the LOCAL auto-apply engine
   (scripts/auto-apply-jobs.js). Non-Platinum users see the pitch + upgrade
   CTA; Platinum users get their profile as apply-profile.json (download) and
   copy-paste run commands per job board. The engine itself runs locally —
   the card never applies anything server-side. */

import { useMemo, useState } from "react";
import { cardCls, btnGhost, btnOk, btnPrimary, btnSm, Chip } from "../ui";
import { APPLY_SITES, engineCommands, exportProfileJson, platinumActive } from "../../services/autoApply";

export function AutoApplyCard({ locked, onUpgrade, platinum }: {
  locked: boolean;
  platinum: boolean;
  onUpgrade: () => void;
}) {
  const [openSite, setOpenSite] = useState<string | null>(null);
  const active = platinum && !locked;
  const profileJson = useMemo(() => (active ? exportProfileJson() : ""), [active]);
  const missing = useMemo(() => {
    if (!active) return [];
    try {
      const p = JSON.parse(profileJson) as { name?: string; email?: string; phone?: string };
      return (["name", "email", "phone"] as const).filter(k => !p[k]);
    } catch { return ["name", "email", "phone"]; }
  }, [profileJson]);

  const download = () => {
    const blob = new Blob([profileJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "apply-profile.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied — user can select manually */ }
  };

  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/10 p-5">
        <div>
          <h3 className="text-[14.5px] font-extrabold">🤖 Auto-apply engine {active ? "" : "· 💎 Platinum"}</h3>
          <p className="mt-0.5 max-w-[720px] text-[11.5px] text-fnt">
            A local Playwright browser that searches your job boards, tailors a resume + cover letter to each JD with AI,
            fills the application with your profile answers, and submits — auto on Instahyre &amp; Naukri, review-gate on LinkedIn.
            Runs on your machine with your logged-in sessions; one-time manual login per site.
          </p>
        </div>
        <Chip tone={active ? "ok" : "co"}>{active ? "💎 Platinum active" : "🔒 Platinum"}</Chip>
      </div>

      {!active ? (
        <div className="p-5">
          <ul className="mb-4 space-y-1 text-[12.5px] text-fnt">
            <li>• Persists your job-board logins (Google OAuth / OTP — you sign in once, it never stores passwords)</li>
            <li>• JD-tailored resume + cover letter per posting, from your career profile and the admin AI provider</li>
            <li>• Honest answers only — required questions it can't answer confidently stop the submission for your review</li>
            <li>• Run reports: submitted / needs-review / skipped, per job</li>
          </ul>
          <button className={btnPrimary + btnSm} onClick={onUpgrade}>💎 Unlock with Platinum</button>
        </div>
      ) : (
        <div className="p-5">
          {missing.length > 0 && (
            <p className="mb-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] text-ink">
              ⚠️ Your profile is missing <b>{missing.join(", ")}</b> — the engine fail-closes on required fields, so fill
              them in your career profile / resume first.
            </p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button className={btnOk + btnSm} onClick={download}>⬇️ Download apply-profile.json</button>
            <button className={btnGhost + btnSm} onClick={() => void copy(profileJson)}>📋 Copy JSON</button>
            <span className="text-[11px] text-mut">save it to the repo root (next to package.json)</span>
          </div>

          <div className="space-y-2">
            {APPLY_SITES.map(s => (
              <div key={s.id} className="rounded-xl border border-line/10 bg-deep/40">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  onClick={() => setOpenSite(openSite === s.id ? null : s.id)}
                >
                  <span className="text-[13px] font-bold text-fnt">
                    {s.label} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${s.submit === "auto" ? "bg-ok/15 text-ok" : "bg-warn/15 text-ink"}`}>{s.submit === "auto" ? "AUTO-SUBMIT" : "REVIEW GATE"}</span>
                  </span>
                  <span className="text-mut">{openSite === s.id ? "▴" : "▾"}</span>
                </button>
                {openSite === s.id && (
                  <div className="space-y-2 px-4 pb-4">
                    {engineCommands(s.id).map(c => (
                      <div key={c.command} className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line/10 bg-deep/80 px-3 py-2 font-mono text-[11.5px] text-fnt">{c.command}</code>
                        <button className={btnGhost + btnSm} title={c.label} onClick={() => void copy(c.command)}>📋</button>
                      </div>
                    ))}
                    <p className="text-[11px] text-mut">
                      Requires one-time setup on your machine: <code className="font-mono">npm i -D playwright &amp;&amp; npx playwright install chromium</code>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-mut">
            Reports land in <code className="font-mono">freebuff-apply-reports/</code>; the admin Scraper log shows apply runs too.
          </p>
        </div>
      )}
    </div>
  );
}
