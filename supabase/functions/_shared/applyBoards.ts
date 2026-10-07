/* First-class auto-apply board identity (jobs-fetch → job_sites registry).

   Every live greenhouse/ashby board the fetch pipeline pulls is ALSO a
   job_sites registry row so the local auto-apply engine runs it via --all
   exactly like a discovered board. The identity is pure so the deno corpus
   pins the host convention (path-qualified: two boards share one ATS
   hostname, so `boards.greenhouse.io/lyft` ≠ `boards.greenhouse.io/airbnb`)
   and the source gating (lever/rss/remoteok feeds stay app-only). */

export interface ApplyBoardIdentity {
  provider: string;
  /** unique registry key — path-qualified because ATS hostnames are shared */
  host: string;
  jobsUrl: string;
  /** "<Company> · <Provider>" — falls back to the board token when the API
      doesn't return a company name (label column caps at 80 chars) */
  label: string;
}

/** Board identity for the registry, or null when the provider is not (yet)
    an auto-apply board (lever/rss/remoteok only feed the app's jobs table). */
export function applyBoardIdentity(provider: string, board: string, company: string | null): ApplyBoardIdentity | null {
  const b = String(board || "").trim();
  if (!b) return null;
  if (provider === "greenhouse") {
    return {
      provider,
      host: `boards.greenhouse.io/${b}`,
      jobsUrl: `https://boards.greenhouse.io/${b}`,
      label: `${company || b} · Greenhouse`.slice(0, 80),
    };
  }
  if (provider === "ashby") {
    return {
      provider,
      host: `jobs.ashbyhq.com/${b}`,
      jobsUrl: `https://jobs.ashbyhq.com/${b}`,
      label: `${company || b} · Ashby`.slice(0, 80),
    };
  }
  return null;
}
