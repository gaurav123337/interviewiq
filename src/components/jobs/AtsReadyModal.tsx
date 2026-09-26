/* AtsReadyModal — "Make ATS-ready" pipeline: rewrite the uploaded resume into
   ATS-compliant plain text (optionally targeted at one posting), show
   before/after parse scores + a diff, then hand the result back to the resume
   card ("use as my resume") or download it. */

import { useMemo, useState } from "react";
import type { JobPosting, UploadedResume } from "../../types";
import { makeAtsReady, type AtsReadyResult } from "../../services/atsReady";
import { diffLines } from "../../services/diff";
import { toast } from "../../toast";
import { Chip, Modal } from "../ui";

/** Same download pattern as the apply-kit (ResumeKitModal.downloadText). */
function downloadText(text: string, resume: UploadedResume, job: JobPosting | null) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = resume.fileName.replace(/\.[^.]+$/, "");
  a.download = `${base}-ATS${job ? `-${job.company}` : ""}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function Score({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line/15 bg-deep/30 p-3 text-center">
      <div className={`text-xl font-extrabold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-mut">{label}</div>
    </div>
  );
}

const scoreTone = (n: number) => (n >= 80 ? "text-ok" : n >= 50 ? "text-acc3" : n > 0 ? "text-warn" : "text-mut");

export function AtsReadyModal({ resume, jobs, onUseResume, onClose }: {
  resume: UploadedResume;
  jobs: JobPosting[];
  onUseResume: (text: string) => void;
  onClose: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AtsReadyResult | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const job = useMemo(() => jobs.find(j => j.id === jobId) ?? null, [jobs, jobId]);
  /* top postings by skill overlap with the resume — shortlist for the picker */
  const suggested = useMemo(() => {
    const lower = resume.text.toLowerCase();
    return [...jobs]
      .map(j => ({ j, hits: j.skills.filter(s => lower.includes(s.toLowerCase())).length }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 8)
      .map(x => x.j);
  }, [jobs, resume.text]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await makeAtsReady({ resumeText: resume.text, job });
      setResult(r);
      toast(`🎯 ATS rewrite ready — coverage ${r.before.coverage.score}% → ${r.after.coverage.score}%`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="🎯 Make ATS-ready"
      desc="Rewrites your resume into the single-column, standard-header plain text that applicant-tracking systems parse best — aligned to a target job if you pick one. Facts are never invented."
    >
      {!result && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-mut">Target job (optional)</label>
          <select
            className="mt-1.5 w-full rounded-xl border border-line/20 bg-deep/40 px-3 py-2.5 text-[13px] text-ink outline-none focus:border-acc1/60"
            value={jobId}
            onChange={e => setJobId(e.target.value)}
          >
            <option value="">— Generic ATS cleanup (no specific posting) —</option>
            {suggested.map(j => (
              <option key={j.id} value={j.id}>{j.title} · {j.company}</option>
            ))}
          </select>
          {job && job.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 10).map(s => <Chip key={s} tone="co">{s}</Chip>)}
            </div>
          )}

          <button
            className="grad-bg mt-4 w-full rounded-xl px-4 py-3 text-[14px] font-extrabold text-white transition-all hover:brightness-110 disabled:opacity-50"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? <><span className="spinner" /> Rewriting your resume…</> : "⚙️ Optimize for ATS"}
          </button>
          <p className="mt-2 text-center text-[11px] text-mut">
            Uses your AI settings (module: <b>ATS Resume Optimizer</b>). Your resume never leaves the configured provider.
          </p>
          {error && <div className="mt-3 rounded-xl border border-bad/30 bg-bad/10 p-3 text-[12.5px] text-bad">✗ {error}</div>}
        </div>
      )}

      {result && (
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Score label="ATS score" value={`${result.after.coverage.score}%`} tone={scoreTone(result.after.coverage.score)} />
            <Score label="Sections" value={String(result.after.sections.length)} tone="text-acc1" />
            <Score label="Words" value={String(result.after.wordCount)} tone={result.after.flags.length ? "text-warn" : "text-ok"} />
          </div>
          {job && (
            <p className="mt-2 text-center text-[12px] text-fnt">
              Keyword coverage vs this posting: <b className={scoreTone(result.after.coverage.score)}>
                {result.before.coverage.score}% → {result.after.coverage.score}%
              </b>
            </p>
          )}

          {result.mirroredSkills.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Now mirrored from the posting</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.mirroredSkills.map(s => <Chip key={s} tone="ok">✓ {s}</Chip>)}
              </div>
            </div>
          )}

          {result.changes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-[12px] text-fnt">
              {result.changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}

          <div className="mt-4">
            <button className="text-[12px] font-bold text-acctxt" onClick={() => setShowDiff(v => !v)}>
              {showDiff ? "◀ show rewritten resume" : "⇄ show diff vs original"}
            </button>
            <div className="mt-2 max-h-[38vh] overflow-y-auto rounded-2xl border border-line/10 bg-deep/30 p-4">
              {showDiff ? (
                <div className="space-y-0.5 font-mono text-[12px] leading-relaxed">
                  {diffLines(resume.text, result.text).map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap rounded-lg px-2 py-0.5 ${l.type === "add" ? "bg-ok/10 text-ok" : l.type === "del" ? "bg-bad/10 text-bad line-through" : "text-fnt"}`}>
                      {l.type === "add" ? "+ " : l.type === "del" ? "− " : "  "}{l.text || " "}
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-[1.7] text-fnt">{result.text}</pre>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="border border-line/20 px-3.5 py-1.5 text-[13px] text-mut rounded-lg hover:bg-wht/10" onClick={() => downloadText(result.text, resume, job)}>⬇ Download .txt</button>
            <button className="grad-bg rounded-xl px-4 py-2 text-[13px] font-extrabold text-white hover:brightness-110" onClick={() => { onUseResume(result.text); onClose(); }}>
              ✅ Use as my resume
            </button>
          </div>
          <p className="mt-2 text-[11px] text-mut">
            "Use as my resume" re-extracts skills from the rewritten text and updates the match feed — your old version stays until you confirm.
          </p>
        </div>
      )}
    </Modal>
  );
}
