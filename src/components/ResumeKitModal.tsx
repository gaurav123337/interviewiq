import { memo, useState } from "react";
import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { aiReachable } from "../ai";
import { aiTailorCoverLetter, aiTailorResume, atsCoverage, atsKeywordDrilldown, buildCoverLetter, buildResume, getApplyKit, jdKeywords, quantifiedClaims, saveApplyKit, type ApplyKit, type AtsKeywordRow } from "../services/applyKit";
import { diffLines } from "../services/diff";
import { matchJob } from "../services/jobs";
import { markAppliedVia } from "../services/applyTrack";
import { sourceLabel } from "../services/importJob";
import { getDisplayCurrency } from "../services/currency";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "../services/storage";
import { openResumePrint, buildResumeHtml } from "../services/resumeHtml";
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

/* ─── Content Area (extracted for TypeScript clarity) ───────────────── */
function ContentArea({ compareBase, prevKit, tab, kit, profile, job, match, displayCurrency, editing, editText, setEditText, text }: {
  compareBase: null | "prev" | "template" | "ai";
  prevKit: { jobId: string; company: string; resume: string; coverLetter: string } | null;
  tab: "resume" | "cover";
  kit: ApplyKit | null;
  profile: CareerProfile;
  job: JobPosting;
  match: JobMatch | null;
  displayCurrency: string;
  editing: boolean;
  editText: string;
  setEditText: (s: string) => void;
  text: string;
}) {
  const baseline =
    compareBase === "prev" && prevKit
      ? prevKit[tab === "resume" ? "resume" : "coverLetter"]
      : compareBase === "template"
        ? (tab === "resume" ? buildResume(profile, job, match) : buildCoverLetter(profile, job, match, displayCurrency))
        : compareBase === "ai"
          ? (tab === "resume" ? kit?.aiResume : kit?.aiCover)
          : null;
  const showDiff = compareBase !== null && baseline !== undefined && baseline !== null && kit;

  if (showDiff) {
    return (
      <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-line/10 bg-deep/30 p-4">
        <div className="space-y-0.5 font-mono text-[12px] leading-relaxed">
          {diffLines(baseline!, kit[tab === "resume" ? "resume" : "coverLetter"]).map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap rounded-lg px-2 py-0.5 ${
              l.type === "add" ? "bg-ok/10 text-ok" : l.type === "del" ? "bg-bad/10 text-bad line-through" : "text-fnt"
            }`}>
              {l.type === "add" ? "+ " : l.type === "del" ? "− " : "  "}{l.text || " "}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <textarea
        className="max-h-[50vh] min-h-[300px] w-full resize-y rounded-2xl border-2 border-acc1/30 bg-deep/50 p-5 font-sans text-[13px] leading-relaxed text-ink outline-none transition-colors focus:border-acc1/60"
        value={editText}
        onChange={e => setEditText(e.target.value)}
        spellCheck={false}
      />
    );
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-line/10 bg-white/5 p-5">
      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.8] text-fnt">
        {text}
      </pre>
    </div>
  );
}

export const ResumeKitModal = memo(function ResumeKitModal({ job, profile, match, onAddSkill, onClose }: {
  job: JobPosting;
  profile: CareerProfile;
  match: JobMatch | null;
  onAddSkill?: (skill: string) => void;
  onClose: () => void;
}) {
  const displayCurrency = getDisplayCurrency(profile.location);
  const [kit, setKit] = useState<ApplyKit | null>(() => getApplyKit(job.id));
  const [tab, setTab] = useState<"resume" | "cover">("resume");
  const [aiBusy, setAiBusy] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compareBase, setCompareBase] = useState<null | "prev" | "template" | "ai">(() => {
    const stored = storageGet<null | "prev" | "template" | "ai">(STORAGE_KEYS.lastCompare, null);
    if (stored === "prev") {
      const prev = storageGet<{ jobId: string } | null>(STORAGE_KEYS.lastKit, null);
      return prev && prev.jobId !== job.id ? "prev" : null;
    }
    if (stored === "ai") {
      const k = getApplyKit(job.id);
      return k?.aiResume || k?.aiCover ? "ai" : null;
    }
    return stored;
  });
  const pickCompareBase = (base: null | "prev" | "template" | "ai") => {
    setCompareBase(base);
    if (base) storageSet(STORAGE_KEYS.lastCompare, base);
    else storageRemove(STORAGE_KEYS.lastCompare);
  };
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [prevKit] = useState<{ jobId: string; company: string; resume: string; coverLetter: string } | null>(
    () => storageGet(STORAGE_KEYS.lastKit, null)
  );
  const canCompare = !!prevKit && prevKit.jobId !== job.id;

  const close = () => {
    if (kit) {
      storageSet(STORAGE_KEYS.lastKit, { jobId: job.id, company: job.company, resume: kit.resume, coverLetter: kit.coverLetter });
    }
    onClose();
  };

  if (!kit) {
    const built: ApplyKit = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      resume: buildResume(profile, job, match),
      coverLetter: buildCoverLetter(profile, job, match, displayCurrency),
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

  const handleAddSkill = (skill: string) => {
    const already = profile.skills.some(s => s.toLowerCase() === skill.toLowerCase());
    onAddSkill?.(skill);
    if (already) return;
    const nextProfile = { ...profile, skills: [...profile.skills, skill] };
    const m = matchJob(nextProfile, job);
    const resume = tab === "resume" ? buildResume(nextProfile, job, m) : (kit?.resume ?? buildResume(nextProfile, job, m));
    const cover = tab === "cover" ? buildCoverLetter(nextProfile, job, m, displayCurrency) : (kit?.coverLetter ?? buildCoverLetter(nextProfile, job, m, displayCurrency));
    refresh(resume, cover, kit?.ai ?? false);
    toast(tab === "cover" ? `✉️ Cover letter regenerated with "${skill}"` : `📄 Resume regenerated with "${skill}" — ATS coverage updated`);
  };

  const toggleEdit = () => {
    if (editing) {
      const other = tab === "resume" ? (kit?.coverLetter ?? buildCoverLetter(profile, job, match, displayCurrency)) : (kit?.resume ?? buildResume(profile, job, match));
      refresh(tab === "resume" ? editText : other, tab === "resume" ? other : editText, kit?.ai ?? false);
      setEditing(false);
      toast("💾 Edits saved — exports use this text");
    } else {
      setEditText(text);
      setEditing(true);
      pickCompareBase(null);
    }
  };

  const aiRegenerate = async () => {
    if (!aiReachable()) {
      toast("🔑 Add an API key in Settings or sign in to use AI tailoring — the template is ready to use as-is.");
      return;
    }
    setAiBusy(true);
    try {
      if (tab === "resume") {
        const resume = await aiTailorResume(profile, job, match);
        // Validate AI output — keep original if result is too short or empty
        const template = buildResume(profile, job, match);
        if (!resume || resume.trim().length < template.length * 0.3) {
          toast("⚠️ AI output too short — keeping original resume");
          refresh(template, kit?.coverLetter ?? buildCoverLetter(profile, job, match, displayCurrency), false);
        } else {
          refresh(resume, kit?.coverLetter ?? buildCoverLetter(profile, job, match, displayCurrency), true, { aiResume: resume });
          toast("✨ AI-tailored — reviewed for accuracy before sending");
        }
      } else {
        const cover = await aiTailorCoverLetter(profile, job, match);
        const template = buildCoverLetter(profile, job, match, displayCurrency);
        if (!cover || cover.trim().length < template.length * 0.3) {
          toast("⚠️ AI output too short — keeping original cover letter");
          refresh(kit?.resume ?? buildResume(profile, job, match), template, false);
        } else {
          refresh(kit?.resume ?? buildResume(profile, job, match), cover, true, { aiCover: cover });
          toast("✨ AI-tailored — reviewed for accuracy before sending");
        }
      }
      // Clear compare mode so user sees the actual content
      pickCompareBase(null);
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

  const atsScore = tab === "resume" ? atsCoverage(kit?.resume ?? "", job) : null;

  return (
    <Modal onClose={close} title="" desc="">
      <>
      {/* ─── Header with job info ─────────────────────────────────────── */}
      <div className="mb-5 rounded-2xl border border-line/10 bg-gradient-to-br from-acc1/5 to-transparent p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acc1/15 text-[18px]">📄</span>
              <div>
                <h3 className="text-[16px] font-extrabold text-ink">Resume & Cover Letter</h3>
                <p className="mt-0.5 text-[12px] text-mut">
                  Tailored for <span className="font-semibold text-ink">{job.title}</span> at <span className="font-semibold text-ink">{job.company}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={kit?.ai ? "ok" : "default"}>
              {kit?.ai ? "✨ AI-polished" : "📝 Template"}
            </Chip>
            {atsScore && job.skills.length > 0 && (
              <Chip tone={atsScore.score >= 80 ? "ok" : atsScore.score >= 50 ? "co" : "warn"}>
                ⚡ ATS {atsScore.score}%
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tab switcher ──────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex rounded-xl border border-line/15 bg-deep/50 p-1">
          {(["resume", "cover"] as const).map(t => (
            <button
              key={t}
              className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-all ${
                tab === t
                  ? "bg-acc1 text-white shadow-lg shadow-acc1/25"
                  : "text-mut hover:text-ink"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "resume" ? "📋 Resume" : "✉️ Cover Letter"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            className="rounded-xl bg-gradient-to-r from-acc1 to-purple-600 px-4 py-2 text-[13px] font-bold text-white shadow-lg shadow-acc1/25 transition-all hover:shadow-xl hover:shadow-acc1/30 disabled:opacity-50"
            onClick={aiRegenerate}
            disabled={aiBusy}
          >
            {aiBusy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Polishing…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">✨ Polish with AI</span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Action bar ────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Primary actions */}
        <button
          className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok transition-all hover:bg-ok/20"
          onClick={() => { window.open(job.url || "#", "_blank", "noopener"); markAppliedVia(job.id, sourceLabel(job.source)); toast(`🔗 Opened ${sourceLabel(job.source)} — complete the application there`); }}
        >
          🔗 Apply on {sourceLabel(job.source)}
        </button>

        <div className="h-6 w-px bg-line/20" />

        {/* Edit & Copy */}
        <button
          className="rounded-xl border border-line/15 bg-deep/40 px-3 py-2 text-[12px] font-bold text-fnt transition-all hover:border-acc1/30 hover:text-ink"
          onClick={copy}
        >
          📋 Copy
        </button>
        {!compareBase && (
          <button
            className="rounded-xl border border-line/15 bg-deep/40 px-3 py-2 text-[12px] font-bold text-fnt transition-all hover:border-acc1/30 hover:text-ink"
            onClick={toggleEdit}
          >
            {editing ? "💾 Save" : "✏️ Edit"}
          </button>
        )}

        <div className="h-6 w-px bg-line/20" />

        {/* Export options */}
        {tab === "resume" && (
          <>
            <button
              className="rounded-xl border border-line/15 bg-deep/40 px-3 py-2 text-[12px] font-bold text-fnt transition-all hover:border-acc1/30 hover:text-ink"
              onClick={() => setAtsOpen(true)}
            >
              🔍 ATS Check
            </button>
            <button
              className="rounded-xl border border-acc1/30 bg-acc1/10 px-3 py-2 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/20"
              onClick={() => setPreviewOpen(true)}
            >
              👁️ Preview
            </button>
            <button
              className="rounded-xl bg-acc1/15 px-3 py-2 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/25"
              onClick={async () => {
                try {
                  await downloadResumePdf(profile, job, match, resumeBrandFor(job.company), kit?.resume);
                  toast("⬇️ PDF downloaded");
                } catch (e) {
                  toast("✗ PDF failed — " + ((e as Error).message || "unknown error"));
                }
              }}
            >
              📥 PDF
            </button>
            <button
              className="rounded-xl border border-line/15 bg-deep/40 px-3 py-2 text-[12px] font-bold text-fnt transition-all hover:border-acc1/30 hover:text-ink"
              onClick={() => { downloadResumeDocx(profile, job, match, kit?.resume); toast("⬇️ .docx downloaded"); }}
            >
              📥 DOCX
            </button>
            <button
              className="rounded-xl border border-line/15 bg-deep/40 px-3 py-2 text-[12px] font-bold text-fnt transition-all hover:border-acc1/30 hover:text-ink"
              onClick={() => {
                const ok = openResumePrint(profile, job, match, resumeBrandFor(job.company), kit?.resume);
                toast(ok ? "🖨️ Print view opened" : "✗ Popup blocked");
              }}
            >
              🖨️ Print
            </button>
          </>
        )}
        <button
          className="rounded-xl border border-line/15 bg-deep/40 px-3 py-2 text-[12px] font-bold text-fnt transition-all hover:border-acc1/30 hover:text-ink"
          onClick={() => { downloadText(tab === "resume" ? "resume" : "cover-letter", text, job); toast("⬇️ Downloaded"); }}
        >
          📥 TXT
        </button>
      </div>

      {/* ─── ATS Preview Modal ─────────────────────────────────────────── */}
      {tab === "resume" && atsOpen ? (
        <AtsPreviewModal text={kit?.resume ?? ""} job={job} onAddSkill={handleAddSkill} onClose={() => setAtsOpen(false)} />
      ) : null}

      {/* ─── Compare bar ───────────────────────────────────────────────── */}
      {(canCompare || kit?.[tab === "resume" ? "aiResume" : "aiCover"]) ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/30 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-mut">⚖️ Compare with:</span>
          {canCompare && prevKit ? (
            <button
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                compareBase === "prev" ? "bg-acc1/20 text-acctxt" : "text-mut hover:bg-deep/50 hover:text-ink"
              }`}
              onClick={() => pickCompareBase(compareBase === "prev" ? null : "prev")}
            >
              vs {prevKit.company}
            </button>
          ) : null}
          <button
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              compareBase === "template" ? "bg-acc1/20 text-acctxt" : "text-mut hover:bg-deep/50 hover:text-ink"
            }`}
            onClick={() => pickCompareBase(compareBase === "template" ? null : "template")}
          >
            vs Template
          </button>
          {kit?.[tab === "resume" ? "aiResume" : "aiCover"] ? (
            <button
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                compareBase === "ai" ? "bg-acc1/20 text-acctxt" : "text-mut hover:bg-deep/50 hover:text-ink"
              }`}
              onClick={() => pickCompareBase(compareBase === "ai" ? null : "ai")}
            >
              vs AI Version
            </button>
          ) : null}
          {compareBase ? (
            <button className="ml-auto text-[11px] font-bold text-mut hover:text-ink" onClick={() => pickCompareBase(null)}>
              ✕ Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ─── Content area ──────────────────────────────────────────────── */}
      <ContentArea
        compareBase={compareBase}
        prevKit={prevKit}
        tab={tab}
        kit={kit}
        profile={profile}
        job={job}
        match={match}
        displayCurrency={displayCurrency}
        editing={editing}
        editText={editText}
        setEditText={setEditText}
        text={text}
      />

      {/* ─── Smart tips ────────────────────────────────────────────────── */}
      {tab === "resume" && !editing && !compareBase && (() => {
        const claims = quantifiedClaims(profile, 2);
        const cov = atsCoverage(kit?.resume ?? "", job);
        const miss = cov.missing.length
          ? cov.missing
          : atsKeywordDrilldown(kit?.resume ?? "", job).jd.filter(r => !r.present).map(r => r.keyword);

        if (!claims.length && !miss.length) return null;

        return (
          <div className="mt-4 space-y-2">
            {claims.length > 0 && (
              <div className="rounded-xl border border-acc1/20 bg-acc1/5 px-4 py-2.5">
                <p className="text-[12px] text-fnt">
                  <span className="font-bold text-acctxt">🧮 Evidence used:</span>{" "}
                  <span className="text-mut">{claims.join(" · ")}</span>
                </p>
              </div>
            )}
            {miss.length > 0 && (
              <div className="rounded-xl border border-warn/20 bg-warn/5 px-4 py-2.5">
                <p className="text-[12px] text-fnt">
                  <span className="font-bold text-warn">⚡ ATS tip:</span>{" "}
                  <span className="text-mut">
                    Add <b>{miss.slice(0, 4).join(", ")}</b>{miss.length > 4 ? ` +${miss.length - 4} more` : ""} where true to clear filters.
                  </span>
                </p>
              </div>
            )}
          </div>
        );
      })}

      {tab === "cover" && !editing && !compareBase && (() => {
        const has = new Set((profile?.skills ?? []).map(s => s.toLowerCase()));
        const missing = (match?.missing ?? []).filter(s => !has.has(s.toLowerCase()));
        const skip = new Set([...(match?.matched ?? []), ...(match?.missing ?? [])].map(s => s.toLowerCase()));
        const leans = jdKeywords(job, 6).filter(k => !has.has(k) && !skip.has(k));
        const rows = [
          ...missing.map(k => ({ k, missing: true })),
          ...leans.slice(0, Math.max(0, 4 - missing.length)).map(k => ({ k, missing: false }))
        ];
        if (!rows.length) return null;

        return (
          <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 px-4 py-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">💡 Keywords to consider</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {rows.map(({ k, missing: isMissing }) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <Chip
                    tone={isMissing ? "warn" : "co"}
                    title={isMissing ? `Missing from your profile` : `Posting emphasizes this`}
                  >
                    {isMissing ? `✗ ${k}` : k}
                  </Chip>
                  <button
                    className="grid h-5 w-5 place-items-center rounded-full border border-acc1/40 bg-acc1/10 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/25"
                    onClick={() => handleAddSkill(k)}
                    title={`Add "${k}" to profile`}
                  >
                    +
                  </button>
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-line/10 bg-deep/20 px-4 py-3">
        <p className="flex-1 text-[11px] leading-relaxed text-mut">
          Template mode is offline. "Polish with AI" uses <span className="font-semibold text-fnt">your API key</span> and rewrites facts — never invents credentials.
        </p>
        <button
          className="shrink-0 rounded-xl border border-line/15 bg-deep/40 px-5 py-2 text-[13px] font-bold text-mut transition-all hover:border-acc1/30 hover:text-ink"
          onClick={close}
        >
          Done
        </button>
      </div>

      {/* ─── PDF Preview Overlay ─────────────────────────────────────────── */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewOpen(false)}>
          <div
            className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-line/20 bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between border-b border-line/20 bg-gradient-to-r from-acc1/5 to-transparent px-6 py-4">
              <div>
                <h3 className="text-[15px] font-bold text-ink">📄 Resume Preview</h3>
                <p className="text-[12px] text-mut">Tailored for {job.title} at {job.company}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl bg-acc1 px-4 py-2 text-[12px] font-bold text-white transition-all hover:bg-acc1/90"
                  onClick={async () => {
                    try {
                      await downloadResumePdf(profile, job, match, resumeBrandFor(job.company), kit?.resume);
                      toast("⬇️ PDF downloaded");
                    } catch (e) {
                      toast("✗ PDF failed — " + ((e as Error).message || "unknown error"));
                    }
                  }}
                >
                  📥 Download PDF
                </button>
                <button
                  className="rounded-xl border border-line/15 bg-deep/40 px-4 py-2 text-[12px] font-bold text-mut transition-all hover:text-ink"
                  onClick={() => setPreviewOpen(false)}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            {/* Preview content */}
            <div className="overflow-y-auto bg-gray-100 p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <iframe
                srcDoc={buildResumeHtml(profile, job, match, resumeBrandFor(job.company), kit?.resume)}
                title="Resume Preview"
                className="mx-auto w-full border-0 bg-white shadow-lg"
                style={{ height: '800px', maxWidth: '720px' }}
              />
            </div>
          </div>
        </div>
      )}
      </>
    </Modal>
  );
});

/* ─── Keyword chip for ATS drill-down ──────────────────────────────────── */
function KeywordChip({ row, onAdd }: { row: AtsKeywordRow; onAdd?: () => void }) {
  return row.present ? (
    <Chip tone="ok" title="Appears in your resume">✓ {row.keyword}</Chip>
  ) : (
    <span className="inline-flex items-center gap-1">
      <Chip tone="warn" title="Missing from resume">✗ {row.keyword}</Chip>
      {onAdd && (
        <button
          className="grid h-5 w-5 place-items-center rounded-full border border-acc1/40 bg-acc1/10 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/25"
          onClick={onAdd}
          title={`Add "${row.keyword}" to profile`}
        >
          +
        </button>
      )}
    </span>
  );
}

/* ─── ATS Preview Modal ─────────────────────────────────────────────────── */
function AtsPreviewModal({ text, job, onAddSkill, onClose }: { text: string; job: JobPosting; onAddSkill?: (skill: string) => void; onClose: () => void }) {
  const p = atsParsePreview(text, job);
  const d = atsKeywordDrilldown(text, job);
  return (
    <Modal onClose={onClose} title="🔍 ATS Parse Preview" desc="How applicant-tracking software reads this resume.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Words", value: p.wordCount, tone: "text-ink" },
          { label: "Sections", value: p.sections.length, tone: "text-acc1" },
          { label: "Keywords", value: job.skills.length ? `${d.found.length}/${d.skills.length}` : `${d.jd.filter(r => r.present).length}/${d.jd.length}`, tone: "text-ok" },
          { label: "ATS Score", value: job.skills.length ? `${d.score}%` : "—", tone: job.skills.length ? (d.score >= 80 ? "text-ok" : d.score >= 50 ? "text-acc3" : "text-warn") : "text-mut" }
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-line/15 bg-deep/30 p-4 text-center">
            <div className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-mut">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line/15 bg-deep/30 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Parser Output</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.sections.map(s => <Chip key={s} tone="co">{s}</Chip>)}
          {p.header.slice(1).map(h => <Chip key={h} tone="default">{h.slice(0, 32)}{h.length > 32 ? "…" : ""}</Chip>)}
        </div>
        <div className="mt-3 text-[12px] text-fnt">
          {p.contact.email ? `📧 ${p.contact.email} · ` : ""}
          {p.contact.phone ? `📱 ${p.contact.phone} · ` : ""}
          {p.contact.linkedin ? "💼 LinkedIn ✓" : ""}
          {!p.contact.email && !p.contact.phone && !p.contact.linkedin && <span className="text-warn">No contact info detected — add to header.</span>}
        </div>
      </div>

      {p.flags.length > 0 && (
        <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-warn">⚠️ Parse Flags</div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-fnt">
            {p.flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line/15 bg-deep/30 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Keyword Coverage</div>
          {d.total > 0 && (
            <Chip tone={d.hits / d.total >= 0.7 ? "ok" : d.hits / d.total >= 0.4 ? "co" : "warn"}>
              {d.hits}/{d.total}
            </Chip>
          )}
        </div>
        {d.skills.length > 0 && (
          <>
            <div className="mt-3 text-[12px] font-bold text-fnt">Required Skills</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.skills.map(r => <KeywordChip key={r.keyword} row={r} onAdd={onAddSkill ? () => onAddSkill(r.keyword) : undefined} />)}
            </div>
          </>
        )}
        {d.jd.length > 0 && (
          <>
            <div className="mt-3 text-[12px] font-bold text-fnt">Role Keywords</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.jd.map(r => <KeywordChip key={r.keyword} row={r} onAdd={onAddSkill && job.skills.length === 0 ? () => onAddSkill(r.keyword) : undefined} />)}
            </div>
          </>
        )}
        {d.total > 0 && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-deep/60">
            <div
              className={`h-full rounded-full transition-all ${d.hits / d.total >= 0.7 ? "bg-ok" : d.hits / d.total >= 0.4 ? "bg-acc3" : "bg-warn"}`}
              style={{ width: `${Math.round((d.hits / d.total) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <button className="mt-5 w-full rounded-xl bg-deep/40 py-3 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}
