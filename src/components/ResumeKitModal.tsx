import { useState } from "react";
import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { aiAvailable } from "../ai";
import { aiTailorCoverLetter, aiTailorResume, atsCoverage, buildCoverLetter, buildResume, getApplyKit, quantifiedClaims, saveApplyKit, type ApplyKit } from "../services/applyKit";
import { diffLines } from "../services/diff";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
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
  /* diff baselines: the last kit from a DIFFERENT job, the plain template,
     or the last AI-polished version of this job */
  const [compareBase, setCompareBase] = useState<null | "prev" | "template" | "ai">(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [prevKit] = useState<{ jobId: string; company: string; resume: string; coverLetter: string } | null>(
    () => storageGet(STORAGE_KEYS.lastKit, null)
  );
  const canCompare = !!prevKit && prevKit.jobId !== job.id;
  /* remember this job as the compare baseline for the next kit you open */
  const close = () => {
    if (kit) {
      storageSet(STORAGE_KEYS.lastKit, { jobId: job.id, company: job.company, resume: kit.resume, coverLetter: kit.coverLetter });
    }
    onClose();
  };

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

  const refresh = (resume: string, coverLetter: string, ai: boolean, aiVersions?: { aiResume?: string; aiCover?: string }) => {
    const next: ApplyKit = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      resume,
      coverLetter,
      ai,
      aiResume: aiVersions?.aiResume ?? kit?.aiResume,
      aiCover: aiVersions?.aiCover ?? kit?.aiCover,
      createdAt: kit?.createdAt ?? Date.now()
    };
    saveApplyKit(next);
    setKit(next);
  };

  const toggleEdit = () => {
    if (editing) {
      const other = tab === "resume" ? (kit?.coverLetter ?? buildCoverLetter(profile, job, match)) : (kit?.resume ?? buildResume(profile, job, match));
      refresh(tab === "resume" ? editText : other, tab === "resume" ? other : editText, kit?.ai ?? false);
      setEditing(false);
      toast("💾 Edits saved — exports use this text");
    } else {
      setEditText(text);
      setEditing(true);
      setCompareBase(null);
    }
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
        refresh(resume, kit?.coverLetter ?? buildCoverLetter(profile, job, match), true, { aiResume: resume });
      } else {
        const cover = await aiTailorCoverLetter(profile, job, match);
        refresh(kit?.resume ?? buildResume(profile, job, match), cover, true, { aiCover: cover });
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
      onClose={close}
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
          {!compareBase && (
            <button
              className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
              onClick={toggleEdit}
              title={editing ? "Save your edits — exports will use this text" : "Edit the text before exporting"}
            >
              {editing ? "💾 Save edits" : "✏️ Edit"}
            </button>
          )}
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
                    await downloadResumePdf(profile, job, match, resumeBrandFor(job.company), kit?.resume);
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
                onClick={() => { downloadResumeDocx(profile, job, match, kit?.resume); toast("⬇️ .docx downloaded — ATS-safe single column"); }}
                title="Download as .docx (text-first, best for ATS parsing)"
              >
                ⬇️ .docx
              </button>
              <button
                className="rounded-xl border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold text-fnt transition-all hover:text-ink"
                onClick={() => {
                  const ok = openResumePrint(profile, job, match, resumeBrandFor(job.company), kit?.resume);
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

      {/* diff baselines — previous job, the plain template, or the last AI polish */}
      <div className="mb-2 mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-mut">⚖️ Compare:</span>
        {canCompare && prevKit && (
          <button
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${compareBase === "prev" ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
            onClick={() => setCompareBase(b => b === "prev" ? null : "prev")}
            title={`What changed vs the ${prevKit.company} kit — green is new, red is gone`}
          >
            vs {prevKit.company}
          </button>
        )}
        <button
          className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${compareBase === "template" ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
          onClick={() => setCompareBase(b => b === "template" ? null : "template")}
          title="What changed vs the plain template (no AI, no edits)"
        >
          vs plain template
        </button>
        {kit?.[tab === "resume" ? "aiResume" : "aiCover"] && (
          <button
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${compareBase === "ai" ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
            onClick={() => setCompareBase(b => b === "ai" ? null : "ai")}
            title="What changed vs the last AI-polished version"
          >
            vs AI polish
          </button>
        )}
        {compareBase && (
          <button className="text-[11px] font-bold text-mut hover:text-ink" onClick={() => setCompareBase(null)}>✕ hide</button>
        )}
      </div>

      {(() => {
        const baseline =
          compareBase === "prev" && prevKit
            ? prevKit[tab === "resume" ? "resume" : "coverLetter"]
            : compareBase === "template"
              ? (tab === "resume" ? buildResume(profile, job, match) : buildCoverLetter(profile, job, match))
              : compareBase === "ai"
                ? (tab === "resume" ? kit?.aiResume : kit?.aiCover)
                : null;
        const showDiff = compareBase !== null && baseline !== undefined && baseline !== null && kit;
        if (showDiff) {
          return (
            <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-line/15 bg-deep/40 p-3 font-mono text-[12px] leading-relaxed">
              {diffLines(baseline!, kit![tab === "resume" ? "resume" : "coverLetter"]).map((l, i) => (
                <div key={i} className={`whitespace-pre-wrap ${l.type === "add" ? "bg-ok/10 text-ok" : l.type === "del" ? "bg-bad/10 text-bad line-through" : "text-fnt"}`}>
                  {l.type === "add" ? "+ " : l.type === "del" ? "− " : "  "}{l.text || " "}
                </div>
              ))}
            </div>
          );
        }
        if (editing) {
          return (
            <textarea
              className="max-h-[46vh] min-h-[260px] w-full resize-y rounded-xl border border-acc1/30 bg-deep/50 p-4 font-sans text-[12.5px] leading-relaxed text-ink outline-none"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              spellCheck={false}
            />
          );
        }
        return (
          <pre className="max-h-[46vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/40 p-4 font-sans text-[12.5px] leading-relaxed text-fnt">
            {text}
          </pre>
        );
      })()}

      {tab === "resume" && !editing && !compareBase && (() => {
        const claims = quantifiedClaims(profile, 2);
        return claims.length > 0 ? (
          <p className="mt-3 text-[11.5px] text-mut">
            🧮 Evidence reused from your profile: <b>{claims.join(" · ")}</b> — tweak any line with ✏️ before exporting.
          </p>
        ) : null;
      })()}

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
      <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={close}>
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
