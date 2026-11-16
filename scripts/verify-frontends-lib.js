/* Exact-build readiness, independent of publishing and browser retries. All network
   destinations are fixed; manifests are data, never executable artifacts. */
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { LIVE_SITES } from './virtual-tester-lib.js';

export const RELEASE_REPOSITORY = 'gaurav123337/interviewiq';
export const RELEASE_MARKER = 'release.json';
const MAX_FILES = 2000, MAX_FILE_BYTES = 128 * 1024 * 1024, MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value > 0 && value <= max;
const sleep = ms => new Promise(done => setTimeout(done, ms));
export class VerificationError extends Error {
  constructor(code, report) { super(code); this.code = code; this.report = report; }
}
function requireThat(condition, code) { if (!condition) throw new VerificationError(code); }
export function releaseIdentity(value) {
  requireThat(object(value) && value.repository === RELEASE_REPOSITORY && /^[a-f0-9]{40}$/.test(value.commit)
    && /^[1-9]\d{0,19}$/.test(String(value.runId)) && /^[1-9]\d{0,5}$/.test(String(value.runAttempt)), 'invalid_release_identity');
  return { repository: value.repository, commit: value.commit, runId: String(value.runId), runAttempt: String(value.runAttempt) };
}
export const manifestArtifactName = identity => {
  const id = releaseIdentity(identity);
  return `frontend-manifest-${id.commit}-${id.runId}-${id.runAttempt}`;
};
export function safeAssetPath(value) {
  return typeof value === 'string' && value.length <= 500 && /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));
}
function sameIdentity(left, right) { return JSON.stringify(releaseIdentity(left)) === JSON.stringify(releaseIdentity(right)); }
export function validateManifest(value, expected) {
  requireThat(object(value) && value.version === 1 && sameIdentity(value, expected), 'manifest_identity_mismatch');
  requireThat(Array.isArray(value.files) && value.files.length >= 3 && value.files.length <= MAX_FILES, 'invalid_manifest_files');
  const names = new Set(); let total = 0;
  for (const file of value.files) {
    requireThat(object(file) && safeAssetPath(file.path) && !names.has(file.path.toLowerCase())
      && Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_FILE_BYTES
      && /^[a-f0-9]{64}$/.test(file.sha256), 'invalid_manifest_entry');
    names.add(file.path.toLowerCase()); total += file.size;
  }
  requireThat(total <= MAX_TOTAL_BYTES && ['index.html', 'sw.js', RELEASE_MARKER].every(name => value.files.some(file => file.path === name)), 'incomplete_manifest');
  return value;
}
export async function createManifest(dist, identity) {
  const id = releaseIdentity(identity), root = resolve(dist), files = [];
  requireThat((await lstat(root)).isDirectory() && !(await lstat(root)).isSymbolicLink(), 'invalid_build_directory');
  async function walk(directory, prefix = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix + entry.name, full = join(directory, entry.name);
      requireThat(safeAssetPath(relative) && !entry.isSymbolicLink(), 'unsafe_build_path');
      if (entry.isDirectory()) { await walk(full, `${relative}/`); continue; }
      requireThat(entry.isFile() && relative !== RELEASE_MARKER && files.length < MAX_FILES - 1, 'invalid_build_file');
      const stat = await lstat(full);
      requireThat(!stat.isSymbolicLink() && stat.size <= MAX_FILE_BYTES, 'invalid_build_file');
      const bytes = await readFile(full);
      requireThat(bytes.length === stat.size, 'build_changed_during_manifest');
      files.push({ path: relative, size: bytes.length, sha256: sha256(bytes) });
    }
  }
  await walk(root);
  requireThat(files.some(file => file.path === 'index.html') && files.some(file => file.path === 'sw.js')
    && files.some(file => file.path.startsWith('assets/')), 'incomplete_build');
  const marker = Buffer.from(JSON.stringify({ version: 1, ...id }) + '\n');
  const manifest = { version: 1, ...id, files: [...files, { path: RELEASE_MARKER, size: marker.length, sha256: sha256(marker) }].sort((a, b) => a.path.localeCompare(b.path)) };
  validateManifest(manifest, id);
  // The marker ships in this exact build; it distinguishes a later release with identical shell bytes.
  await writeFile(join(root, RELEASE_MARKER), marker, { flag: 'wx' });
  return manifest;
}

export function validatePublication(identity, run, jobs, artifacts) {
  const id = releaseIdentity(identity);
  requireThat(object(run) && String(run.id) === id.runId && String(run.run_attempt) === id.runAttempt
    && run.repository?.full_name === id.repository && run.head_repository?.full_name === id.repository
    && run.head_sha === id.commit && run.head_branch === 'main' && ['push', 'workflow_dispatch'].includes(run.event)
    && run.path === '.github/workflows/deploy.yml', 'untrusted_release_run');
  requireThat(Array.isArray(jobs) && jobs.length <= 100 && Array.isArray(artifacts) && artifacts.length <= 100, 'invalid_release_metadata');
  const publishers = jobs.filter(job => job.name === 'build-and-deploy');
  const steps = ['Record frontend manifest', 'Deploy to gh-pages branch', 'Deploy to Wasmer Edge', 'Archive frontend release manifest'];
  const publisher = publishers[0];
  requireThat(publishers.length === 1 && publisher.status === 'completed' && publisher.conclusion === 'success'
    && Number.isFinite(Date.parse(publisher.started_at)) && Number.isFinite(Date.parse(publisher.completed_at))
    && steps.every(name => publisher.steps?.filter(step => step.name === name && step.conclusion === 'success').length === 1), 'publication_not_verified');
  const matches = artifacts.filter(artifact => artifact.name === manifestArtifactName(id));
  const artifact = matches[0];
  requireThat(matches.length === 1 && artifact.expired === false && integer(artifact.id)
    && artifact.workflow_run?.head_sha === id.commit && String(artifact.workflow_run?.id) === id.runId
    && Date.parse(artifact.created_at) >= Date.parse(publisher.started_at)
    && Date.parse(artifact.created_at) <= Date.parse(publisher.completed_at)
    && /^sha256:[a-f0-9]{64}$/.test(artifact.digest), 'original_manifest_artifact_unavailable');
  return { version: 1, ...id, artifactId: String(artifact.id), artifactName: artifact.name,
    artifactDigest: artifact.digest, publicationJobId: String(publisher.id), publishedAt: publisher.completed_at };
}
export function validateProvenance(value) {
  const id = releaseIdentity(value);
  requireThat(value.version === 1 && /^[1-9]\d*$/.test(value.artifactId) && value.artifactName === manifestArtifactName(id)
    && /^sha256:[a-f0-9]{64}$/.test(value.artifactDigest) && /^[1-9]\d*$/.test(value.publicationJobId)
    && Number.isFinite(Date.parse(value.publishedAt)), 'invalid_publication_provenance');
  return id;
}

async function checkFile(base, file, { fetchFn, timeoutMs }) {
  const controller = new AbortController(); let timer, response, timedOut = false;
  const timeout = new Promise(resolveTimeout => {
    timer = setTimeout(() => { timedOut = true; controller.abort(); resolveTimeout({ kind: 'timeout' }); }, timeoutMs);
  });
  const operation = (async () => {
    try {
      response = await fetchFn(new URL(file.path, base).href, { method: 'GET', redirect: 'manual',
        headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal });
      if (response.status >= 300 && response.status < 400 || response.redirected) return { kind: 'redirect', status: response.status };
      if (response.status !== 200) return { kind: 'http', status: response.status };
      const digest = createHash('sha256'); let size = 0;
      if (response.body) for await (const chunk of response.body) {
        if (timedOut) return { kind: 'timeout' };
        size += chunk.byteLength;
        if (size > file.size) return { kind: 'size' };
        digest.update(chunk);
      }
      if (size !== file.size) return { kind: 'size' };
      return digest.digest('hex') === file.sha256 ? { kind: 'ready' } : { kind: 'hash' };
    } catch { return { kind: timedOut ? 'timeout' : 'transport' }; }
    finally { if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {}); }
  })();
  try { return await Promise.race([operation, timeout]); }
  finally { clearTimeout(timer); controller.abort(); }
}

export async function verifyFrontends(manifest, expected, options = {}) {
  validateManifest(manifest, expected);
  const { fetchFn = fetch, now = Date.now, sleepFn = sleep, deadlineMs = 180000, requestTimeoutMs = 15000,
    retryDelayMs = 5000, concurrency = 6, sites = LIVE_SITES } = options;
  requireThat(integer(deadlineMs, 600000) && integer(requestTimeoutMs, 30000) && integer(retryDelayMs, 30000)
    && integer(concurrency, 8) && Array.isArray(sites) && sites.length > 0 && new Set(sites).size === sites.length
    && sites.every(site => LIVE_SITES.includes(site)), 'invalid_readiness_options');
  const started = now(), deadline = started + deadlineMs, failures = [], checked = new Map();
  const marker = manifest.files.find(file => file.path === RELEASE_MARKER);
  let pending = sites.flatMap(site => manifest.files.map(file => ({ site, file, attempts: 0 })));
  const report = () => ({ version: 1, ...releaseIdentity(expected), elapsedMs: now() - started,
    total: manifest.files.length * sites.length, ready: checked.size, failures, sites });
  while (pending.length && now() < deadline) {
    const retry = []; let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
      while (cursor < pending.length && now() < deadline) {
        const item = pending[cursor++]; item.attempts++;
        const result = await checkFile(item.site, item.file, { fetchFn, timeoutMs: Math.max(1, Math.min(requestTimeoutMs, deadline - now())) });
        const key = item.site + item.file.path;
        if (result.kind === 'ready') checked.set(key, item.attempts);
        else {
          if (failures.length < 2000) failures.push({ site: item.site, path: item.file.path, attempt: item.attempts, ...result });
          retry.push(item);
        }
      }
    }));
    retry.push(...pending.slice(cursor)); pending = retry;
    if (pending.length && now() < deadline) await sleepFn(Math.min(retryDelayMs, deadline - now()));
  }
  if (pending.length) throw new VerificationError('readiness_deadline_exceeded', { ...report(), pending: pending.map(item => ({ site: item.site, path: item.file.path })) });
  // A superseding publication must not pass using hashes observed before it changed.
  for (const site of sites) for (const file of [marker, ...manifest.files.filter(file => ['index.html','sw.js'].includes(file.path))]) {
    if (now() >= deadline) throw new VerificationError('readiness_deadline_exceeded', report());
    const result = await checkFile(site, file, { fetchFn, timeoutMs: Math.max(1, Math.min(requestTimeoutMs, deadline - now())) });
    if (result.kind !== 'ready') throw new VerificationError('release_changed_or_superseded', { ...report(), finalCheck: { site, path: file.path, ...result } });
  }
  return { ...report(), passed: true, recoveredFiles: [...checked.values()].filter(attempts => attempts > 1).length };
}
