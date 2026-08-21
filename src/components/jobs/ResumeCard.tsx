import { cardCls, btnDanger, btnGhost, btnOk, btnPrimary, btnSm, Chip } from "../ui";
import type { CareerProfile, UploadedResume } from "../../types";
import { resumeToProfile } from "../../services/resume";

export interface ResumeCardProps {
  profile: CareerProfile | null;
  resume: UploadedResume | null;
  resumeFormOpen: boolean;
  resumeShowAll: boolean;
  resumePaste: string;
  resumeBusy: boolean;
  showResumeBanner: boolean;
  setResumeFormOpen: (v: boolean) => void;
  setResumeShowAll: (fn: (s: boolean) => boolean) => void;
  setResumePaste: (v: string) => void;
  handleResumeFile: (file: File) => Promise<void>;
  applyResume: (text: string, fileName: string) => void;
  removeResume: () => void;
  dismissResumeBanner: () => void;
}

export function ResumeCard({
  profile,
  resume,
  resumeFormOpen,
  resumeShowAll,
  resumePaste,
  resumeBusy,
  showResumeBanner,
  setResumeFormOpen,
  setResumeShowAll,
  setResumePaste,
  handleResumeFile,
  applyResume,
  removeResume,
  dismissResumeBanner,
}: ResumeCardProps) {
  return (
    <>
      {showResumeBanner && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-acc1/30 bg-acc1/10 px-4 py-3 transition-all"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleResumeFile(file);
          }}
        >
          <span className="text-[12.5px] text-fnt">
            📎 Your profile has <b>{(() => { const n = (profile?.skills.length ?? 0) - resumeToProfile(resume!.text).skills.length; return `${n} skill${n === 1 ? "" : "s"}`; })()}</b> beyond what this resume mentions.
            Re-upload it to keep skill chips strictly from the resume — anything you still want can be re-added from 💡 Suggestions.
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <label className={`${btnPrimary} ${btnSm} cursor-pointer`} title="Pick your resume file">
              ↺ Re-upload resume
              <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleResumeFile(f); e.target.value = ""; }} />
            </label>
            <button className={btnGhost + btnSm} onClick={dismissResumeBanner}>✕ Not now</button>
          </span>
          <span className="w-full text-[10.5px] text-mut">💾 Or drop your .pdf / .txt / .docx anywhere on this banner.</span>
        </div>
      )}

      {/* resume upload — the fastest way to a match profile */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📄 Your resume</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Upload a .pdf / .txt or paste the text — we extract your skills, title and experience, then match you against every company below. Everything stays on your device.</p>
        </div>
        <div className="p-5">
          {resume && !resumeFormOpen ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-extrabold">✅ {resume.fileName}</span>
                <Chip tone="ok">{resume.profile.skills.length} skills</Chip>
                <Chip>{resume.profile.years} yrs</Chip>
                <span className="text-[12.5px] font-semibold text-ink">{resume.profile.headline}</span>
              </div>
              {resume.profile.skills.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {resume.profile.skills.slice(0, resumeShowAll ? undefined : 14).map(s => (
                    <span key={s} className="rounded-full border border-acc1/35 bg-acc1/10 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt">{s}</span>
                  ))}
                  {resume.profile.skills.length > 14 && (
                    <button
                      className="cursor-pointer rounded-full border border-acc1/35 bg-acc1/10 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/20"
                      onClick={() => setResumeShowAll(s => !s)}
                      title={resumeShowAll ? "Show fewer skills" : `Show all ${resume.profile.skills.length} extracted skills`}
                    >
                      {resumeShowAll ? "− show less" : `+${resume.profile.skills.length - 14} more`}
                    </button>
                  )}
                </div>
              )}
              <p className="mt-2 text-[11px] text-mut">
                📄 {resume.profile.skills.length} skills extracted from this resume
                {(profile?.skills.length ?? 0) > resume.profile.skills.length
                  ? ` · +${(profile?.skills.length ?? 0) - resume.profile.skills.length} added in your profile`
                  : ""} — the match feed and company ranking below are scored from these. You can still edit the profile card above.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnGhost + btnSm} onClick={() => setResumeFormOpen(true)}>↺ Replace resume</button>
                <button className={btnDanger + btnSm} onClick={removeResume}>🗑 Remove</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${btnOk} ${btnSm} cursor-pointer`}>
                  {resumeBusy ? <><span className="spinner" />Reading…</> : "📎 Upload .pdf / .txt / .docx"}
                  <input
                    type="file" accept=".pdf,.txt,.docx" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void handleResumeFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {resume && <button className={btnGhost + btnSm} onClick={() => { setResumeFormOpen(false); setResumePaste(""); }}>Cancel</button>}
              </div>
              <textarea
                rows={3}
                value={resumePaste}
                onChange={e => setResumePaste(e.target.value)}
                placeholder="…or paste your resume text here (or drop a .pdf / .txt)"
                className="inp mt-3 h-auto w-full resize-y text-[13px]"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-mut">Tip: PDFs with selectable text work best — scanned pages fall back to OCR (needs a connection).</span>
                <button className={btnPrimary + btnSm} disabled={resumeBusy || resumePaste.trim().length < 40} onClick={() => applyResume(resumePaste, "pasted-resume.txt")}>
                  🔍 Analyze &amp; match
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
