/* Guard the release graph itself: retrying verification must not republish. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
const deploy = read('.github/workflows/deploy.yml'), verify = read('.github/workflows/verify-live.yml');
function job(text,name) {
  const match = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:\\n|$(?![\\s\\S]))`,'m').exec(text);
  assert(match,`Missing job ${name}`); return match[1];
}
test('publication preserves hard gates and records all assets before both deploys', () => {
  const publish = job(deploy,'build-and-deploy').split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');
  const order = ['npm audit --omit=dev --audit-level=high','npm run eval:rag','npm run typecheck','npm run build','npm test',
    'deno test','npm run test:apply:worker','npm run test:e2e:check && npm run test:e2e',
    'name: Record frontend manifest','name: Deploy to gh-pages branch','name: Deploy to Wasmer Edge','name: Archive frontend release manifest'];
  let last=-1;
  for(const step of order) { const next=publish.indexOf(step);assert(next>last,`Missing/out-of-order ${step}`);last=next; }
  assert.match(publish,/github\.ref == 'refs\/heads\/main'/);
  assert.match(publish,/cancel-in-progress: false/);
  assert(!publish.includes('test:e2e:live'));assert(!publish.includes('supabase functions deploy'));
  assert.match(publish,/artifact_name/);assert.match(publish,/if-no-files-found: error/);
});
test('live verification is a separate read-only dependency with no inherited secrets', () => {
  const live=job(deploy,'verify-live');
  assert.match(live,/needs: build-and-deploy/);assert.match(live,/contents: read/);assert.match(live,/actions: read/);
  assert.match(live,/uses: \.\/\.github\/workflows\/verify-live\.yml/);
  for(const key of ['release_sha','release_run_id','release_attempt'])assert.match(live,new RegExp(`needs.build-and-deploy.outputs.${key}`));
  assert(!live.includes('secrets:'));assert(!live.includes(': write'));
});
test('manual verification accepts only original release identity and has no publishing path', () => {
  assert.match(verify,/workflow_call:/);assert.match(verify,/workflow_dispatch:/);
  for(const key of ['release_run_id','release_attempt','release_sha'])assert(verify.includes(`${key}:`));
  assert(!/\$\{\{\s*secrets\./.test(verify));assert(!verify.includes(': write'));
  assert(!/npm run build|vite build|wasmer deploy|supabase functions|publish_branch|actions-gh-pages/.test(verify));
  assert.match(verify,/persist-credentials: false/);assert.match(verify,/github\.ref == 'refs\/heads\/main'/);
  assert.match(verify,/artifact-ids: \$\{\{ steps.publication.outputs.artifact_id \}\}/);
  assert.match(verify,/digest-mismatch: error/);
  assert(verify.indexOf('Validate original publication provenance')<verify.indexOf('Download original manifest'));
  assert(verify.indexOf('Wait for every original published asset')<verify.indexOf('npm run test:e2e:live'));
  assert(verify.indexOf('Recheck release identity after browser journeys')>verify.indexOf('npm run test:e2e:live'));
  assert.match(verify,/live-verification-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
  assert.match(verify,/group: frontend-verification-/);
});
test('backend remains explicitly opted in and downstream of verified publication', () => {
  const backend=job(deploy,'deploy-backend');
  assert.match(backend,/needs: \[build-and-deploy, verify-live\]/);
  assert.match(backend,/github.event_name == 'workflow_dispatch'.*inputs.deploy_supabase/);
  assert.match(backend,/github.ref == 'refs\/heads\/main'/);
  assert.match(backend,/SUPABASE_ACCESS_TOKEN/);
  assert(!verify.includes('deploy-backend'));
});
test('browser failures and default PR isolation remain strict', () => {
  const config=read('playwright.config.ts');
  assert.match(config,/failOnFlakyTests: !!process.env.CI/);
  assert.match(config,/serviceWorkers: "block"/);
  const runner=read('scripts/virtual-tester.mjs');
  assert.match(runner,/VIRTUAL_TEST_MODE: command === "live" \? "live" : "isolated"/);
  assert(runner.includes('scripts/verify-frontends-lib.test.mjs'));
  assert(runner.includes('scripts/virtual-tester-live-lib.test.mjs'));
  const virtualWorkflow=read('.github/workflows/virtual-tester.yml');
  assert.equal((virtualWorkflow.match(/psql -U postgres -d postgres -X -A -t -q -c 'select 1'/g)||[]).length,2);
  assert.equal((virtualWorkflow.match(/if \[ "\$ready" -eq 2 \]; then exit 0; fi/g)||[]).length,2);
  assert(!virtualWorkflow.includes('pg_isready'));
});
