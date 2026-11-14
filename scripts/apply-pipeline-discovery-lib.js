/* Discovery planning is independent of candidate facts and authenticated browser state. */
const MAX_BOARDS = 20;
const hasCredentials = url => Boolean(url.username.length + url.password.length);
export function discoveryBoardPlan(board) {
  try {
    const url = new URL(board.url || board.jobs_url);
    if (url.protocol !== "https:" || hasCredentials(url) || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const token = parts[0];
    if (!token || !/^[a-zA-Z0-9_-]{1,100}$/.test(token)) return null;
    if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host)) return { provider: "greenhouse", endpoint: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, boardId: board.id, boardUrl: `https://${host}/${token}` };
    if (host === "jobs.lever.co") return { provider: "lever", endpoint: `https://api.lever.co/v0/postings/${token}?mode=json`, boardId: board.id, boardUrl: `https://${host}/${token}` };
    if (host === "jobs.ashbyhq.com") return { provider: "ashby", endpoint: `https://api.ashbyhq.com/posting-api/job-board/${token}`, boardId: board.id, boardUrl: `https://${host}/${token}` };
    return null;
  } catch { return null; }
}
export function planDiscoveryBoards(boards) {
  const seen = new Set();
  return (Array.isArray(boards) ? boards : []).map(discoveryBoardPlan).filter(plan => {
    if (!plan || !plan.boardId || seen.has(plan.endpoint)) return false;
    seen.add(plan.endpoint); return true;
  }).slice(0, MAX_BOARDS);
}
const text = (v, max = 12000) => typeof v === "string" ? v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
export function discoveryPostingUrl(value) {
  try {
    const url = new URL(value);
    if (hasCredentials(url)) return null;
    if (url.protocol !== "https:" || url.port || !/^(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)$/.test(url.hostname)) return null;
    url.hash = ""; url.search = "";
    return url.toString();
  } catch { return null; }
}
export function boardCandidateFromPosting(job) {
  const url = discoveryPostingUrl(job?.jobUrl || job?.url);
  if (!url) return null;
  const target = new URL(url), token = target.pathname.split("/").filter(Boolean)[0];
  if (!token || !/^[A-Za-z0-9_-]{1,100}$/.test(token)) return null;
  const type = target.hostname.endsWith("greenhouse.io") ? "greenhouse" : target.hostname === "jobs.lever.co" ? "lever" : "ashby";
  return { url: `${target.origin}/${token}`, label: text(job.company || token, 100), type };
}
export function parseDiscoveryJobs(plan, data) {
  const rows = plan.provider === "lever" ? data : data?.jobs;
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 200).flatMap(row => {
    const jobUrl = discoveryPostingUrl(row.absolute_url || row.hostedUrl || row.jobUrl);
    const title = text(row.title || row.text, 500);
    if (!jobUrl || !title) return [];
    const expected = new URL(plan.boardUrl), target = new URL(jobUrl);
    const greenhouse = plan.provider === "greenhouse" && ["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(target.hostname);
    if ((!greenhouse && expected.hostname !== target.hostname) || target.pathname.split("/").filter(Boolean)[0] !== expected.pathname.split("/").filter(Boolean)[0]) return [];
    const posted = row.publishedAt || row.createdAt || row.updated_at;
    const date = posted ? new Date(posted) : null;
    const reportedCompany = text(row.company || data?.name, 500);
    return [{ jobUrl, title, company: reportedCompany || expected.pathname.slice(1),
      description: text(row.descriptionPlain || row.description || row.content), skills: [],
      location: text(row.location?.name || row.location || row.categories?.location, 500),
      ...(date && Number.isFinite(date.getTime()) ? { postedAt: date.toISOString() } : {}),
      source: plan.provider, externalId: String(row.id || jobUrl).slice(0, 200), portal: plan.provider }];
  });
}
