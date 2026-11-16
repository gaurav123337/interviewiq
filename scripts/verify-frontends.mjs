#!/usr/bin/env node
/* Publication records exact bytes once. Verification downloads only data and
   authenticates GitHub metadata in a separate, read-only step. */
import { readFile, writeFile, mkdir, appendFile, lstat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createManifest, releaseIdentity, manifestArtifactName, validatePublication, validateProvenance,
  verifyFrontends, VerificationError, RELEASE_REPOSITORY } from './verify-frontends-lib.js';

function argsFor(command, argv) {
  const allowed = { record: ['dist','out'], provenance: ['run-id','run-attempt','commit','out'],
    verify: ['manifest','provenance','out'] }[command];
  if (!allowed) throw new VerificationError('expected_record_provenance_or_verify');
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2), value = argv[i + 1];
    if (!argv[i]?.startsWith('--') || !allowed.includes(key) || !value || value.startsWith('--') || Object.hasOwn(args,key)) throw new VerificationError('invalid_arguments');
    args[key] = value;
  }
  if (allowed.some(key => !args[key])) throw new VerificationError('missing_argument');
  return args;
}
async function jsonFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new VerificationError('invalid_input_file');
  return JSON.parse(await readFile(file,'utf8'));
}
async function save(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value,null,2) + '\n', { flag: 'wx' });
}
async function github(path) {
  if (process.env.GITHUB_REPOSITORY !== RELEASE_REPOSITORY || !process.env.GH_TOKEN) throw new VerificationError('github_read_context_required');
  const response = await fetch(`https://api.github.com/repos/${RELEASE_REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new VerificationError(`github_metadata_http_${response.status}`); }
  return response.json();
}
async function main() {
  if (!process.versions.node.startsWith('22.')) throw new VerificationError('node_22_required');
  const command = process.argv[2], args = argsFor(command,process.argv.slice(3));
  if (command === 'record') {
    const identity = releaseIdentity({ repository: process.env.GITHUB_REPOSITORY, commit: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT });
    if (process.env.GITHUB_REF !== 'refs/heads/main' || !['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) throw new VerificationError('main_publication_context_required');
    const manifest = await createManifest(args.dist,identity);
    await save(args.out,manifest);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
      `artifact_name=${manifestArtifactName(identity)}\nrelease_sha=${identity.commit}\nrelease_run_id=${identity.runId}\nrelease_attempt=${identity.runAttempt}\n`);
    console.log(JSON.stringify({ recorded: true, ...identity, files: manifest.files.length }));
  } else if (command === 'provenance') {
    const identity = releaseIdentity({ repository: process.env.GITHUB_REPOSITORY, commit: args.commit,
      runId: args['run-id'], runAttempt: args['run-attempt'] });
    const [run,jobs,artifacts] = await Promise.all([
      github(`actions/runs/${identity.runId}/attempts/${identity.runAttempt}`),
      github(`actions/runs/${identity.runId}/attempts/${identity.runAttempt}/jobs?per_page=100`),
      github(`actions/runs/${identity.runId}/artifacts?per_page=100`),
    ]);
    if (jobs.total_count > 100 || artifacts.total_count > 100) throw new VerificationError('release_metadata_limit_exceeded');
    const provenance = validatePublication(identity,run,jobs.jobs,artifacts.artifacts);
    await save(args.out,provenance);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `artifact_id=${provenance.artifactId}\n`);
    console.log(JSON.stringify({ publicationVerified: true, ...provenance }));
  } else {
    const provenance = await jsonFile(args.provenance), identity = validateProvenance(provenance);
    const manifest = await jsonFile(args.manifest);
    try {
      const result = await verifyFrontends(manifest,identity);
      await save(args.out,result);
      const summary = `Verified ${result.total} published files across ${result.sites.length} sites for ${identity.commit}; ${result.recoveredFiles} needed readiness retries. Browser failures remain strict.\n`;
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
      console.log(summary.trim());
    } catch (error) {
      await save(args.out, { passed: false, code: error instanceof VerificationError ? error.code : 'verification_failed', ...(error.report || {}) });
      throw error;
    }
  }
}
main().catch(error => {
  console.error(JSON.stringify({ passed: false, code: error instanceof VerificationError ? error.code : 'invalid_input_or_transport' }));
  process.exitCode = 1;
});
