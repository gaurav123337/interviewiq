import { useState } from "react";
import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { aiAvailable } from "../ai";
import { aiTailorCoverLetter, aiTailorResume, atsCoverage, buildCoverLetter, buildResume, getApplyKit, saveApplyKit, type ApplyKit } from "../services/applyKit";
import { openResumePrint } from "../services/resumeHtml";
import { downloadResumePdf } from "../services/resumePdf";
import { downloadResumeDocx } from "../services/docx";
import { atsParsePreview } from "../services/atsPreview";
import { resumeBrandFor } from "../services/remoteConfig";
import { toast } from "../toast";
import { Chip, Modal } from "./ui";

/** Downloads text as a .txt file (same pattern as the account export). */
function downloadText(name: string, text: string, job: JobPosting) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${job.company}-${job.title.replace(/[^\w-]+/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResumeKitModal({ job, profile, match, onClose }: {
  job: JobPosting;
  profile: CareerProfile;
  match: JobMatch | null;
  onClose: () => void;
}) {
  const [kit, setKit] = useState<ApplyKit | null>(() => getApplyKit(job.id));
  const [tab, setTab] = useState<"resume" | "cover">("resume");
  const [aiBusy, setAiBusy] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);

  /* Build the template kit on first open if not already saved. */
  if (!kit) {
    const built: ApplyKit = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      resume: buildResume(profile, job, match),
      coverLetter: buildCoverLetter(profile, job, match),
      ai: false,
      createdAt: Date.now()
    };
    saveApplyKit(built);
    setKit(built);
  }

  const refresh = (resume: string, coverLetter: string, ai: boolean) => {
    const next: ApplyKit = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      resume,
      coverLetter,
      ai,
      createdAt: kit?.createdAt ?? Date.now()
    };
    saveApplyKit(next);
    setKit(next);
  };

  const aiRegenerate = async () => {
    if (!aiAvailable()) {
      toast("🔑 Add an API key in Settings to use AI tailoring — the template is ready to use as-is.");
      return;
    }
    setAiBusy(true);
    try {
      if (tab === "resume") {
        const resume = await aiTailorResume(profile, job, match);
        refresh(resume, kit?.coverLetter ?? buildCoverLetter(profile, job, match), true);
      } else {
        const cover = await aiTailorCoverLetter(profile, job, match);
        refresh(kit?.resume ?? buildResume(profile, job, match), cover, true);
      }
      toast("✨ AI-tailored — reviewed for accuracy before sending");
    } catch (err) {
      toast(`✗ AI tailoring failed — ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setAiBusy(false);
    }
  };

  const text = tab === "resume" ? kit?.resume ?? "" : kit?.coverLetter ?? "";
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => toast("📋 Copied to clipboard"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };

  return (
    <Modal
      onClose={onClose}
      title="📄 Resume & cover letter"
      desc={`Tailored to ${job.title} at ${job.company} — keywords mirror the posting, so it reads as written-for-this-role, not a generic apply.`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line/15 bg-deep/40 p-1">
          {(["resume", "cover"] as const).map(t => (
            <button
              key={t}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition-all ${tab === t ? "bg-acc1/15 text-acctxt" : "text-mut hover:text-ink"}`}
              onClick={() => setTab(t)}
            >
              {t === "resume" ? "📋 Resume" : "✉️ Cover letter"}
            </button>
          ))}
        </div>
        <Chip tone={kit?.ai ? "ok" : "default"}>{kit?.ai ? "✨ AI-tailored" : "Template"}</Chip>
        {tab === "resume" && (() => {
          const cov = atsCoverage(kit?.resume ?? "", job);
          return <Chip tone={cov.score >= 80 ? "ok" : cov.score >= 50 ? "co" : "warn"}>⚡ ATS {cov.score}%</Chip>;
        })()}
        <div className="ml-auto flex gap-2">
          <button
            className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
            onClick={copy}
          >
            📋 Copy
          </button>
          {tab === "resume" && atsOpen && (
            <AtsPreviewModal text={kit?.resume ?? ""} job={job} onClose={() => setAtsOpen(false)} />
          )}
          {tab === "resume" && (
            <>
              <button
                className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
                onClick={() => setAtsOpen(true)}
                title="See how an ATS would parse this resume"
              >
                🔍 ATS preview
              </button>
              <button
                className="rounded-xl bg-acc1/15 px-3 py-1.5 text-[12px] font-extrabold text-acctxt transition-all hover:bg-acc1/25 disabled:opacity-50"
                onClick={async () => {
                  try {
                    await downloadResumePdf(profile, job, match, resumeBrandFor(job.company));
                    toast("⬇️ PDF downloaded — one click, styled per company");
                  } catch (e) {
                    toast("✗ PDF failed — " + ((e as Error).message || "unknown error"));
                  }
                }}
                title="Download the designed resume as a PDF (one click)"
              >
                ⬇️ PDF
              </button>
              <button
                className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
                onClick={() => { downloadResumeDocx(profile, job, match); toast("⬇️ .docx downloaded — ATS-safe single column"); }}
                title="Download as .docx (text-first, best for ATS parsing)"
              >
                ⬇️ .docx
              </button>
              <button
                className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
                onClick={() => {
                  const ok = openResumePrint(profile, job, match, resumeBrandFor(job.company));
                  toast(ok ? "🖨️ Print view opened" : "✗ Popup blocked — allow popups for this site");
                }}
                title="Open the designed resume in a print window"
              >
                🖨️ Print
              </button>
            </>
          )}
          <button
            className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
            onClick={() => { downloadText(tab === "resume" ? "resume" : "cover-letter", text, job); toast("⬇️ Downloaded"); }}
          >
            ⬇️ .txt
          </button>
          <button
            className="rounded-xl bg-acc1/15 px-3 py-1.5 text-[12px] font-extrabold text-acctxt transition-all hover:bg-acc1/25 disabled:opacity-50"
            onClick={aiRegenerate}
            disabled={aiBusy}
          >
            {aiBusy ? "⏳ Polishing…" : "✨ Polish with AI"}
          </button>
        </div>
      </div>

      <pre className="max-h-[46vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/40 p-4 font-sans text-[12.5px] leading-relaxed text-fnt">
        {text}
      </pre>

      {tab === "resume" && (() => {
        const cov = atsCoverage(kit?.resume ?? "", job);
        return cov.missing.length > 0 ? (
          <p className="mt-3 text-[11.5px] text-mut">
            ATS tip: <b>{cov.missing.join(", ")}</b> {cov.missing.length === 1 ? "appears" : "appear"} in the posting but not in this
            resume — add them where true (skills or highlights) to clear automated filters.
          </p>
        ) : null;
      })()}
      <p className="mt-3 text-[11.5px] text-mut">
        Template mode works offline and never sends data anywhere. “Polish with AI” uses <b>your own API key</b> (Settings) and
        rewrites the same facts — it never invents employers or credentials, so review before sending.
      </p>
      <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}

/* how an ATS would read this export — sections, contact, flags, coverage */
function AtsPreviewModal({ text, job, onClose }: { text: string; job: JobPosting; onClose: () => void }) {
  const p = atsParsePreview(text, job);
  return (
    <Modal onClose={onClose} title="🔍 ATS parse preview" desc="A simulation of how applicant-tracking software would read this resume — what it keeps, what it stumbles on.">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Words", value: p.wordCount, tone: "text-ink" },
          { label: "Sections", value: p.sections.length, tone: "text-acc1" },
          { label: "Keywords", value: `${p.coverage.found.length}/${job.skills.length}`, tone: "text-ok" },
          { label: "ATS score", value: `${p.coverage.score}%`, tone: p.coverage.score >= 80 ? "text-ok" : p.coverage.score >= 50 ? "text-acc3" : "text-warn" }
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-line/15 bg-deep/30 p-3 text-center">
            <div className={`text-xl font-extrabold ${c.tone}"`}>{c.value}</div>
            <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-mut">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-line/15 bg-deep/30 p-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-mut">What the parser keeps</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {p.sections.map(s => <Chip key={s} tone="co">{s}</Chip>)}
          {p.header.slice(1).map(h => <Chip key={h} tone="default">{h.slice(0, 32)}{h.length > 32 ? "…" : ""}</Chip>)}
        </div>
        <div className="mt-2 text-[12px] text-fnt">
          {p.contact.email ? `📧 ${p.contact.email} · ` : ""}
          {p.contact.phone ? `📱 ${p.contact.phone} · ` : ""}
          {p.contact.linkedin ? "💼 LinkedIn ✓" : ""}
          {!p.contact.email && !p.contact.phone && !p.contact.linkedin && <span className="text-warn">No email/phone detected — add them to the header.</span>}
        </div>
      </div>

      {p.flags.length > 0 && (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-warn">⚠️ Parse flags</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-fnt">
            {p.flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-line/15 bg-deep/30 p-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Keyword coverage vs {job.company}</div>
        {p.coverage.missing.length > 0 ? (
          <p className="mt-1 text-[12px] text-fnt">Missing: <b>{p.coverage.missing.join(", ")}</b> — add them where true to clear automated filters.</p>
        ) : (
          <p className="mt-1 text-[12px] text-ok">All required keywords present — this would clear a keyword filter.</p>
        )}
        {p.coverage.found.length > 0 && <p className="mt-1 text-[12px] text-fnt">Found: <b className="text-ok">{p.coverage.found.join(", ")}</b></p>}
      </div>

      <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}
