import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { COMPANIES, FIELDS, GENERAL_COMPANY, LEVELS, companyById, levelById } from "../data";
import type { Config } from "../types";
import { useApp } from "../store";
import { analyzeJd } from "../services/jd";
import { isPaywallEnabled, sessionsLeft } from "../services/entitlements";
import { UpgradeModal } from "./Upgrade";
import { btnGhost, btnLg, btnPrimary, cardCls, Difficulty, Modal, Seg, Switch } from "./ui";

export function Onboarding() {
  const { t } = useTranslation();
  const { state, selectLevel, selectField, selectCompany, setStep, startSession } = useApp();
  const { ob, step } = state;
  const [showConfig, setShowConfig] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [jdMode, setJdMode] = useState(false);

  /* paywall gate: dormant until CONFIG.features.paywall flips on */
  const begin = (cfg: Config) => {
    if (isPaywallEnabled() && sessionsLeft() <= 0) {
      setShowUpgrade(true);
      return;
    }
    startSession(cfg);
  };

  const steps = [t("onboarding.steps.0"), t("onboarding.steps.1"), t("onboarding.steps.2"), t("onboarding.steps.3")];
  const maxStep = ob.level ? (ob.field ? (ob.company ? 4 : 3) : 2) : 1;

  return (
    <div className="anim-view">
      <Hero />
      {/* stepper */}
      <div className="mb-2 mt-6 flex flex-wrap items-center justify-center gap-0">
        {steps.map((s, i) => {
          const n = i + 1;
          const cls = n === step ? "text-ink" : n < step ? "text-mut" : "text-fnt";
          const clickable = n <= maxStep;
          return (
            <span key={s} className="flex items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => setStep(n)}
                className={`flex items-center gap-2 rounded-full px-3 py-2 min-h-[44px] text-[13px] font-bold ${cls} ${clickable ? "cursor-pointer active:scale-95" : "cursor-default"}`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] ${n === step ? "grad-bg text-white shadow-[0_4px_14px_rgba(99,102,241,.5)]" : n < step ? "border border-ok/40 bg-ok/20 text-ok" : "border border-line/30 bg-wht/10"}`}>
                  {n < step ? "✓" : n}
                </span>
                {s}
              </button>
              {n < 4 && <span className="h-px w-6 bg-wht/20 sm:w-9" />}
            </span>
          );
        })}
      </div>

      {step === 1 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl font-extrabold tracking-tight">What level are you interviewing for?</h2>
          <p className="mb-5 text-[14.5px] text-mut">From first job to the corner office — questions scale with each level.</p>
          {!jdMode ? (
            <>
              <button
                type="button"
                onClick={() => setJdMode(true)}
                className="mb-5 flex w-full items-center gap-4 rounded-2xl border border-acc1/40 bg-gradient-to-r from-acc1/15 to-acc2/10 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-acc1/70 hover:shadow-[0_14px_34px_rgba(99,102,241,.18)]"
              >
                <span className="grid h-12 w-12 flex-none place-items-center rounded-xl grad-bg text-[24px] shadow-[0_6px_16px_rgba(99,102,241,.45)]">📋</span>
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-extrabold leading-tight">I have a job description</span>
                  <span className="block text-[13px] font-semibold text-mut">Paste the posting and we'll detect the level, field, company, and pick the most relevant questions.</span>
                </span>
                <span className="ml-auto text-acc3">→</span>
              </button>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                {LEVELS.map(l => (
                  <PickCard key={l.id} emoji={l.icon} name={l.name} meta={l.years} blurb={l.blurb} sel={ob.level === l.id} onPick={() => selectLevel(l.id)} />
                ))}
              </div>
            </>
          ) : (
            <JdEditor onBack={() => setJdMode(false)} />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Pick your field</h2>
          <p className="mb-5 text-[14.5px] text-mut">{ob.level ? `${levelById(ob.level).icon} ${levelById(ob.level).name} interview` : "Choose your focus area first."}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
            {FIELDS.map(f => (
              <PickCard key={f.id} emoji={f.icon} name={f.name} meta={f.skills.slice(0, 2).join(" · ")} blurb={f.blurb} sel={ob.field === f.id} onPick={() => selectField(f.id)} tags={f.skills.slice(0, 4)} />
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-8">
          <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Which company?</h2>
          <p className="mb-5 text-[14.5px] text-mut">Questions get tailored to each company's stack, culture and interview style.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
            <PickCard emoji={GENERAL_COMPANY.icon} name={GENERAL_COMPANY.name} meta="Balanced questions" blurb="No specific company — a well-rounded mix." sel={ob.company === "general"} onPick={() => selectCompany("general")} small />
            {COMPANIES.map(c => (
              <PickCard
                key={c.id} emoji={c.icon} name={c.name} blurb={c.tagline}
                meta={<span className="flex items-center gap-1.5">{c.hq} · <Difficulty level={c.difficulty} /></span>}
                sel={ob.company === c.id} onPick={() => selectCompany(c.id)} small
              />
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-8">
          <h2 className="mb-1 text-center text-2xl font-extrabold tracking-tight">Ready to be interviewed?</h2>
          <p className="mb-5 text-center text-[14.5px] text-mut">Here's your session profile — you can change anything by going back.</p>
          <div className={`${cardCls} mx-auto max-w-[640px] p-6`}>
            {ob.jd && <SumRow ico="📋" label="Tailored from" value="Job description" />}
            <SumRow ico="🎯" label="Level" value={ob.level ? `${levelById(ob.level).icon} ${levelById(ob.level).name}` : "—"} />
            <SumRow ico="💻" label="Field" value={ob.field ? `${FIELDS.find(f => f.id === ob.field)?.icon ?? ""} ${FIELDS.find(f => f.id === ob.field)?.name ?? ""}` : "—"} />
            <SumRow ico="🏢" label="Company" value={`${companyById(ob.company).icon} ${companyById(ob.company).name}`} />
            <SumRow ico="🎙️" label="Interviewer" value={`Alex — Senior Interviewer${ob.company && ob.company !== "general" ? `, ${companyById(ob.company).name}` : ""}`} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className={btnGhost} onClick={() => setStep(3)}>← Back</button>
            <button className={`${btnPrimary} ${btnLg}`} disabled={!ob.level || !ob.field || !ob.company} onClick={() => setShowConfig(true)}>
              Start Interview →
            </button>
            <button
              className="rounded-2xl border border-warn/40 bg-warn/10 px-8 py-4 text-[17px] font-bold text-warn transition-all hover:bg-warn/20"
              disabled={!ob.level || !ob.field || !ob.company}
              onClick={() => begin({ ...state.config, count: 10, mode: "mock", timing: "strict" })}
            >
              🎬 Full mock interview · 45 min
            </button>
          </div>
        </section>
      )}

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} onBegin={begin} />}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          reason="You've used your free interviews for this month — Pro unlocks unlimited sessions."
        />
      )}
    </div>
  );
}

function Hero() {
  return (
    <div className="pt-7 text-center">
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-acc3/30 bg-acc3/10 px-4 py-1.5 text-[13px] font-bold uppercase tracking-[.12em] text-acc3">
        🎯 AI Interview Coach · PWA · Works offline
      </span>
      <h1 className="text-[clamp(30px,5vw,46px)] font-extrabold leading-[1.15] tracking-tight">
        Walk into your interview <span className="grad-text">fully prepared</span>.
      </h1>
      <p className="mx-auto mt-4 max-w-[640px] text-base text-mut">
        Pick a level, a field, and a company — InterviewIQ builds a tailored session: company-fit questions, technical depth, and model answers, from junior developer to CEO.
      </p>
      <p className="mx-auto mt-2 max-w-[640px] text-sm text-fnt">Every answer gets scored with feedback. Add an API key in Settings for generative AI coaching.</p>
    </div>
  );
}

function PickCard({ emoji, name, meta, blurb, sel, onPick, tags, small }: {
  emoji: string; name: string; meta?: ReactNode; blurb: string; sel: boolean; onPick: () => void; tags?: string[]; small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
        sel
          ? "border-acc1/80 bg-gradient-to-b from-acc1/15 to-acc2/10 shadow-[0_0_0_1px_rgba(99,102,241,.5),0_14px_34px_rgba(99,102,241,.18)]"
          : "border-line/10 bg-gradient-to-b from-panel to-panel2 hover:border-line/30 hover:shadow-[0_14px_34px_rgba(2,6,23,.5)]"
      }`}
    >
      <span className={`absolute right-3 top-3 grid h-[22px] w-[22px] place-items-center rounded-full text-xs ${sel ? "grad-bg text-white" : "border border-line/30 text-transparent"}`}>✓</span>
      <span className="mb-2 flex items-center gap-2.5">
        <span className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-xl text-[22px] ${sel ? "grad-bg shadow-[0_6px_16px_rgba(99,102,241,.45)]" : "grad-bg-soft border border-line/10"}`}>{emoji}</span>
        <span className="min-w-0">
          <span className="block text-[15.5px] font-extrabold leading-tight">{name}</span>
          {meta && <span className="block text-xs font-semibold text-fnt">{meta}</span>}
        </span>
      </span>
      <span className="block text-[13px] leading-snug text-mut">{blurb}</span>
      {!small && tags && (
        <span className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map(t => <span key={t} className="rounded-md bg-wht/10 px-2 py-0.5 text-[11px] font-semibold text-mut">{t}</span>)}
        </span>
      )}
    </button>
  );
}

/* ---------- job-description editor ---------- */
function JdEditor({ onBack }: { onBack: () => void }) {
  const { applyJd } = useApp();
  const [text, setText] = useState("");
  const ready = text.trim().length >= 40;

  const analyze = () => {
    if (!ready) return;
    applyJd({ ...analyzeJd(text), text });
  };

  return (
    <div className={`${cardCls} mx-auto max-w-[720px] p-6`}>
      <label className="mb-1 block text-[15px] font-bold">Paste the job description</label>
      <p className="mb-3 text-[13px] text-mut">
        We'll detect the level, field and company, then build a session around the posting's keywords.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={9}
        placeholder="Senior Backend Engineer at Stripe… We're looking for someone with experience in Go, PostgreSQL and Kubernetes…"
        className="w-full resize-y rounded-xl border border-line/15 bg-deep/70 p-4 text-[14px] leading-relaxed placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={btnGhost} onClick={onBack}>← Back to levels</button>
        <span className="flex-1" />
        <button className={`${btnPrimary} ${btnLg}`} disabled={!ready} onClick={analyze}>
          Analyze & continue →
        </button>
      </div>
    </div>
  );
}

function SumRow({ ico, label, value }: { ico: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line/10 px-1 py-3 last:border-0">
      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-mut">{ico} {label}</span>
      <span className="text-right text-[14.5px] font-extrabold">{value}</span>
    </div>
  );
}

/* ---------- config modal ---------- */
function ConfigModal({ onClose, onBegin }: { onClose: () => void; onBegin: (cfg: Config) => void }) {
  const { state } = useApp();
  const [cfg, setCfg] = useState<Config>({ ...state.config });
  const company = companyById(state.ob.company);
  const field = FIELDS.find(f => f.id === state.ob.field);
  const set = (patch: Partial<Config>) => setCfg(c => ({ ...c, ...patch }));

  return (
    <Modal onClose={onClose} title="Configure your interview" desc={`Tailored to ${company.name} · ${field?.name ?? ""} · ${levelById(state.ob.level).name}`}>
      <OptRow title="Questions" sub="More questions = deeper assessment">
        <Seg options={[5, 8, 10, 15].map(c => ({ value: String(c), label: String(c) }))} value={String(cfg.count)} onChange={v => set({ count: Number(v) })} />
      </OptRow>
      <OptRow title="Mode" sub="Journey ramps junior→you · Behavioral runs STAR story questions">
        <Seg<Config["mode"]> options={[
          { value: "standard", label: "Standard" },
          { value: "journey", label: "Journey" },
          { value: "behavioral", label: "Behavioral" }
        ]} value={cfg.mode} onChange={v => set({ mode: v })} />
      </OptRow>
      <OptRow title="Timer" sub="Real interview pressure">
        <Seg<Config["timing"]> options={[{ value: "none", label: "Off" }, { value: "relaxed", label: "3 min" }, { value: "strict", label: "90 s" }]} value={cfg.timing} onChange={v => set({ timing: v })} />
      </OptRow>
      <OptRow title="Voice answers" sub="Dictate with your microphone">
        <Switch checked={cfg.voice} onChange={v => set({ voice: v })} />
      </OptRow>
      <div className="mt-5 flex gap-3">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={`${btnPrimary} ${btnLg} flex-1`} onClick={() => { onClose(); onBegin(cfg); }}>Begin interview 🎙</button>
      </div>
    </Modal>
  );
}

function OptRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/10 py-3.5 last:border-0">
      <div>
        <div className="text-[15px] font-bold">{title}</div>
        <div className="text-[12.5px] text-fnt">{sub}</div>
      </div>
      {children}
    </div>
  );
}
