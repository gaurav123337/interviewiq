/* Keyless ATS discovery only. No candidate data, logged-in browser or project credential enters a feed request. */
import { planDiscoveryBoards, parseDiscoveryJobs, boardCandidateFromPosting } from "./apply-pipeline-discovery-lib.js";
import { extractVerifiedJobSkills } from "./apply-pipeline-lib.js";

const MAX_BODY = 2 * 1024 * 1024;
async function readJson(response) {
  if (!response.ok || !response.body) throw new Error("Public job feed unavailable");
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new Error("Public job feed exceeds limit");
      chunks.push(value);
    }
  } finally { if (size > MAX_BODY) await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function discoverPipelineJobs({ action, signal, fetchFn = globalThis.fetch }) {
  if (signal?.aborted) return { collected: 0, unavailable: 0 };
  let { boards = [] } = await action("boards.list", { limit: 200 });
  let collected = 0, unavailable = 0;
  const candidates = new Map();
  for (let offset = 0; offset < 1000; offset += 200) {
    if (signal?.aborted) break;
    const { jobs = [] } = await action("jobs.list", { offset, limit: 200 });
    for (const job of jobs) {
      const candidate = boardCandidateFromPosting(job);
      if (candidate && candidates.size < 20) candidates.set(candidate.url, candidate);
    }
    if (jobs.length < 200) break;
  }
  const existing = new Set(boards.map(board => board.url || board.jobs_url));
  for (const candidate of candidates.values()) {
    if (signal?.aborted) break;
    if (existing.has(candidate.url)) continue;
    try {
      const { board } = await action("boards.discover", candidate);
      if (board) { boards = [...boards, board]; existing.add(candidate.url); }
    } catch { unavailable++; }
  }
  for (const plan of planDiscoveryBoards(boards)) {
    if (signal?.aborted) break;
    try {
      const timeout = AbortSignal.timeout(15_000);
      const response = await fetchFn(plan.endpoint, {
        method: "GET", redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { Accept: "application/json" },
      });
      const jobs = parseDiscoveryJobs(plan, await readJson(response)).map(job => ({ ...job, skills: extractVerifiedJobSkills(job) }));
      for (let offset = 0; offset < jobs.length; offset += 100) {
        if (signal?.aborted) break;
        const batch = jobs.slice(offset, offset + 100);
        await action("jobs.ingest", { boardId: plan.boardId, jobs: batch });
        collected += batch.length;
      }
    } catch { unavailable++; }
  }
  return { collected, unavailable };
}
