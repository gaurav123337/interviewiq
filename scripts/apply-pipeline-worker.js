#!/usr/bin/env node
/* Separate paired entry point; the human-owned legacy driver is unchanged. */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getApplyAgentRuntimeContext } from './apply-agent-runtime.js';
import { createPipelineTransport, createPipelineNotifyConfig } from './job-sites-db.js';
import { createTelegramSender, formatJobNotification, formatRunNotification } from './telegram-notify-lib.js';
import { createPortalBrowser } from './apply-portal-adapters.js';
import { createPipelineWorker, PIPELINE_ENGINE_VERSION } from './apply-pipeline-worker-lib.js';

export async function main(argv = process.argv, env = process.env) {
  const runtime = getApplyAgentRuntimeContext({ argv, env });
  if (runtime.mode !== 'paired') throw new Error('The pipeline worker requires a paired agent binding');
  if (argv.includes('--url') || argv.includes('--profile') || argv.includes('--legacy-data-root')) throw new Error('Worker jobs/profile must come from the authenticated pipeline');
  const synthetic = env.INTERVIEWIQ_APPLY_SYNTHETIC === '1';
  const fixtureOrigin = synthetic ? env.INTERVIEWIQ_APPLY_FIXTURE_ORIGIN : undefined;
  if (env.INTERVIEWIQ_APPLY_FIXTURE_ORIGIN && !synthetic) throw new Error('Fixture origin requires synthetic mode');
  const endpoint = new URL(runtime.endpoint);
  if (endpoint.protocol === 'http:' && !synthetic) throw new Error('Production worker requires an HTTPS backend endpoint');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const action = createPipelineTransport(runtime);
  const browser = createPortalBrowser(runtime, { fixtureOrigin, headless: !argv.includes('--headed') });
  let discover;
  if (!synthetic) {
    const module = await import('./apply-pipeline-discovery.js');
    discover = module.discoverPipelineJobs;
  }
  const sender = synthetic ? null : createTelegramSender({ getConfig: createPipelineNotifyConfig(runtime) });
  const notify = sender ? event => sender.send(options => formatJobNotification({ ...event,
    siteHost: new URL(event.jobUrl).hostname,
    result: event.status === 'submitted' ? 'submitted' : event.status === 'failed' ? 'error' : 'needs_review',
    detail: 'Recorded paired task result; submission confirmation is required' }, options)) : undefined;
  const notifySummary = sender ? batch => sender.send(options => formatRunNotification(batch, options), undefined, { summary: true }) : undefined;
  const worker = createPipelineWorker({ runtime, action, browser, signal: controller.signal, discover, notify, notifySummary,
    pollMs: synthetic ? 50 : 5000,
    onState: event => console.log(JSON.stringify(event)) });
  const maxCycles = argv.includes('--once') ? 1 : synthetic ? Number(env.INTERVIEWIQ_APPLY_FIXTURE_CYCLES || 100) : Infinity;
  try { return await worker.run({ maxCycles }); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error(`Unable to start ${PIPELINE_ENGINE_VERSION}; check binding/runtime configuration`); process.exitCode = 1; });
}
