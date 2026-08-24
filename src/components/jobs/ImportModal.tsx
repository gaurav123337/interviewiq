/* Platform import modal — paste job URLs from any site and add to feed */

import { useState } from "react";
import type { JobPosting } from "../../types";
import { getSupabaseClient } from "../../services/cloud";
import { CONFIG } from "../../config";
import { toast } from "../../toast";
import { btnGhost, btnPrimary, btnSm, Chip, Modal } from "../ui";
import { importFromUrlWithFallback, sourceLabel, splitJobUrls } from "../../services/importJob";
import { addImportedJob, listJobs } from "../../services/jobs";
import { decodeHtml } from "../../util";

const SAMPLE_IMPORT_URLS = [
  "https://jobs.ashbyhq.com/notion/f1f9e19d-cbf3-49eb-9824-d04adf2e3d75",
  "https://jobs.ashbyhq.com/notion/72532ca0-eb7d-4d9e-b982-50f52614fca9",
  "https://app.careerpuck.com/job-board/lyft/job/8603653002?gh_jid=8603653002"
];

interface Props {
  onClose: () => void;
  onImported: (jobs: JobPosting[]) => void;
  onApplyQueue: (jobs: JobPosting[]) => void;
}

export function ImportModal({ onClose, onImported, onApplyQueue }: Props) {
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<{ url: string; job: JobPosting | null; error: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = async () => {
    const urls = splitJobUrls(url);
    if (!urls.length) { setError("Paste at least one job link — one per line."); return; }
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const client = await getSupabaseClient();
      const session = await client?.auth.getSession().catch(() => null);
      const token = session?.data?.session?.access_token ?? undefined;
      const out: { url: string; job: JobPosting | null; error: string | null }[] = [];
      for (const raw of urls) {
        const res = await importFromUrlWithFallback(raw, { supabaseUrl: CONFIG.supabase.url, token });
        out.push(res.ok ? { url: raw, job: res.job, error: null } : { url: raw, job: null, error: res.message });
      }
      setResults(out);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    const jobs = results.filter(r => r.job).map(r => r.job!);
    if (!jobs.length) return;
    for (const j of jobs) addImportedJob(j);
    onImported(listJobs());
    toast(`➕ Imported ${jobs.length} job${jobs.length === 1 ? "" : "s"} — now in your match feed`);
    if (jobs.length) onApplyQueue(jobs);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title="➕ Add jobs from platforms"
      desc="Paste one or more job links (one per line) from Naukri, LinkedIn, Indeed — or any company page. We read the public postings and score them like any feed job. Applying always happens on the platform's own page; InterviewIQ never applies for you."
    >
      <div className="flex items-start gap-2">
        <textarea
          className="inp h-24 w-full flex-1"
          placeholder={"https://www.naukri.com/job/\u2026\nhttps://www.linkedin.com/jobs/view/\u2026\nhttps://in.indeed.com/viewjob?jk=\u2026"}
          value={url}
          onChange={e => { setUrl(e.target.value); setError(null); setResults([]); }}
          spellCheck={false}
        />
        <button className={btnPrimary + btnSm} onClick={() => void preview()} disabled={busy || !url.trim()}>
          {busy ? "\u23f3 Reading\u2026" : "\U0001f50e Preview"}
        </button>
      </div>
      <button
        className="mt-2 text-[11.5px] font-bold text-acctxt underline-offset-2 hover:underline"
        onClick={() => setUrl(SAMPLE_IMPORT_URLS.join("\n"))}
        title="Fill the box with a few real public postings to try the flow"
      >
        \u2728 Try sample links
      </button>

      {busy && <p className="mt-3 text-[12px] text-mut">\u23f3 Reading postings\u2026 (public fetch, rate-limited per site)</p>}

      {error && !busy && (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 p-3.5">
          <p className="text-[12.5px] text-fnt">\u2717 {error}</p>
        </div>
      )}

      {results.length > 0 && !busy && (
        <div className="mt-3 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl border p-3.5 ${r.job ? "border-line/15 bg-deep/30" : "border-warn/30 bg-warn/10"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {r.job ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone="co">{sourceLabel(r.job.source)}</Chip>
                        {r.job.remote && <Chip tone="ok">REMOTE</Chip>}
                        {r.job.level && <span className="text-[11px] font-bold uppercase tracking-wider text-mut">\u00b7 {r.job.level}</span>}
                      </div>
                      <div className="mt-1.5 text-[13.5px] font-extrabold text-ink">{decodeHtml(r.job.title)}</div>
                      {r.job.company && <div className="text-[12px] font-bold text-fnt">{r.job.company}</div>}
                      {r.job.location && <div className="text-[11.5px] text-mut">\U0001f4cd {r.job.location}</div>}
                      {r.job.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.job.skills.slice(0, 6).map(s => <Chip key={s} tone="default">{s}</Chip>)}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-[12.5px] font-bold text-warn">\u2717 Couldn't read this link</p>
                      <p className="mt-0.5 break-all text-[11.5px] text-fnt">{r.error}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] font-bold text-acctxt underline">
                        Open the job page manually \u2197
                      </a>
                    </>
                  )}
                </div>
                {r.job && (
                  <button
                    className="shrink-0 text-[12px] font-bold text-mut hover:text-ink"
                    onClick={() => setResults(list => list.filter((_, x) => x !== i))}
                    title="Remove from this import"
                  >
                    \u2715
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              className={btnPrimary + btnSm}
              onClick={confirm}
              disabled={!results.some(r => r.job)}
            >
              \u2795 Add {results.filter(r => r.job).length} to feed
            </button>
            <button className={btnGhost + btnSm} onClick={() => { setResults([]); setUrl(""); setError(null); }}>
              \u21ba Start over
            </button>
          </div>
          <p className="mt-1 text-[11px] text-mut">The apply button on each job opens its page on the platform \u2014 you complete it there.</p>
        </div>
      )}
    </Modal>
  );
}
