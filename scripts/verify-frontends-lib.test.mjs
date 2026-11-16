import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createManifest, validateManifest, releaseIdentity, safeAssetPath, manifestArtifactName,
  validatePublication, validateProvenance, verifyFrontends, RELEASE_REPOSITORY, RELEASE_MARKER } from './verify-frontends-lib.js';
import { LIVE_SITES } from './virtual-tester-lib.js';

const identity = { repository: RELEASE_REPOSITORY, commit: 'a'.repeat(40), runId: '12345', runAttempt: '2' };
const content = { 'index.html':'shell', 'sw.js':'worker', 'assets/lazy/chunk.js':'lazy content', [RELEASE_MARKER]:JSON.stringify({version:1,...identity})+'\n' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = () => ({ version:1, ...identity, files:Object.entries(content).map(([path,bytes]) => ({path,size:Buffer.byteLength(bytes),sha256:hash(bytes)})) });
const copy = value => JSON.parse(JSON.stringify(value));
const responseFor = url => new Response(content[new URL(url).pathname.replace('/interviewiq/','')], {status:200});
const options = overrides => ({ sites:[LIVE_SITES[0]], retryDelayMs:1, deadlineMs:1000, ...overrides });

function publication() {
  const run = {id:12345,run_attempt:2,repository:{full_name:RELEASE_REPOSITORY},head_repository:{full_name:RELEASE_REPOSITORY},head_sha:identity.commit,head_branch:'main',event:'push',path:'.github/workflows/deploy.yml'};
  const job = {id:99,name:'build-and-deploy',status:'completed',conclusion:'success',started_at:'2026-11-14T00:00:00Z',completed_at:'2026-11-14T00:10:00Z',steps:['Record frontend manifest','Deploy to gh-pages branch','Deploy to Wasmer Edge','Archive frontend release manifest'].map(name => ({name,conclusion:'success'}))};
  const artifact = {id:77,name:manifestArtifactName(identity),expired:false,created_at:'2026-11-14T00:09:00Z',digest:`sha256:${'b'.repeat(64)}`,workflow_run:{id:12345,head_sha:identity.commit}};
  return {run,jobs:[job],artifacts:[artifact]};
}

test('manifest contains every public file including nested lazy chunks and pins exact release marker', async () => {
  const dir=await mkdtemp(join(tmpdir(),'frontend-manifest-'));
  try {
    await mkdir(join(dir,'assets','lazy'),{recursive:true});
    await Promise.all(Object.entries(content).filter(([name])=>name!==RELEASE_MARKER).map(([name,bytes])=>writeFile(join(dir,name),bytes)));
    const created=await createManifest(dir,identity);
    assert.equal(created.files.length,4);
    assert.deepEqual(JSON.parse(await readFile(join(dir,RELEASE_MARKER),'utf8')),{version:1,...identity});
    assert.equal(created.files.find(file=>file.path==='assets/lazy/chunk.js').sha256,hash('lazy content'));
    await assert.rejects(createManifest(dir,identity),/invalid_build_file/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('manifest rejects directory links instead of following a planted build path', async () => {
  const dir=await mkdtemp(join(tmpdir(),'frontend-link-')), outside=await mkdtemp(join(tmpdir(),'frontend-outside-'));
  try {
    await symlink(outside,join(dir,'assets'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(createManifest(dir,identity),/unsafe_build_path/);
  } finally { await rm(dir,{recursive:true,force:true}); await rm(outside,{recursive:true,force:true}); }
});
test('path and identity validation reject traversal, ambiguous paths and different repositories', () => {
  for(const path of ['../secret','.env','assets/../secret','assets//x','/x','a\\b','a?x=1','a%2fb','assets/.hidden','a#x']) assert.equal(safeAssetPath(path),false,path);
  assert.equal(safeAssetPath('assets/lazy/CoachChat-abc.js'),true);
  assert.throws(()=>releaseIdentity({...identity,repository:'someone/else'}));
  assert.throws(()=>releaseIdentity({...identity,runAttempt:'2\n'}));
  assert.throws(()=>validateManifest(manifest(),{...identity,commit:'b'.repeat(40)}),/identity/);
  const duplicate=manifest();duplicate.files.push({...duplicate.files[0],path:'INDEX.HTML'});
  assert.throws(()=>validateManifest(duplicate,identity),/entry/);
  const missing=manifest();missing.files=missing.files.filter(file=>file.path!==RELEASE_MARKER);
  assert.throws(()=>validateManifest(missing,identity),/incomplete/);
});
test('successful original publisher and exact immutable manifest are mandatory', () => {
  const p=publication(),proof=validatePublication(identity,p.run,p.jobs,p.artifacts);
  assert.equal(proof.artifactId,'77'); assert.deepEqual(validateProvenance(proof),identity);
  for(const mutate of [
    p=>p.run.repository.full_name='other/repo', p=>p.run.head_repository.full_name='fork/repo',
    p=>p.run.event='pull_request', p=>p.run.path='.github/workflows/test.yml',p=>p.run.head_branch='feature',
    p=>p.run.head_sha='c'.repeat(40), p=>p.run.run_attempt=1,
    p=>p.jobs[0].conclusion='failure', p=>p.jobs[0].steps.pop(),
    p=>p.artifacts[0].expired=true, p=>p.artifacts[0].name='wrong',
    p=>p.artifacts[0].workflow_run.head_sha='d'.repeat(40),p=>p.artifacts[0].created_at='2026-11-13T00:00:00Z',
    p=>p.artifacts.push(copy(p.artifacts[0])),
  ]) { const invalid=publication();mutate(invalid);assert.throws(()=>validatePublication(identity,invalid.run,invalid.jobs,invalid.artifacts)); }
});
test('checks lazy chunks on browser-equivalent URLs and rechecks release identity', async () => {
  const calls=[];
  const result=await verifyFrontends(manifest(),identity,options({fetchFn:async (url,init)=>{
    calls.push(url);assert.equal(new URL(url).search,'');assert.equal(init.redirect,'manual');assert.equal(init.method,'GET');return responseFor(url);
  }}));
  assert.equal(result.passed,true);assert.equal(result.ready,4);assert.equal(result.total,4);
  assert.equal(calls.filter(url=>url.endsWith(RELEASE_MARKER)).length,2);
  assert(calls.some(url=>url.endsWith('assets/lazy/chunk.js')));
});
test('transient HTTP and stale hash failures retry in readiness without hiding diagnostics', async () => {
  let attempts=0,clock=0;
  const result=await verifyFrontends(manifest(),identity,options({now:()=>clock,sleepFn:async ms=>{clock+=ms;},fetchFn:async url=>{
    if(url.endsWith('chunk.js') && ++attempts===1)return new Response('unavailable',{status:503});
    if(url.endsWith('chunk.js') && attempts===2)return new Response('fake content',{status:200});
    return responseFor(url);
  }}));
  assert.equal(result.recoveredFiles,1);assert.deepEqual(result.failures.map(row=>row.kind),['http','hash']);
  assert.equal(result.failures[0].status,503);
});
test('every unresolved asset is bounded by one overall deadline', async () => {
  let clock=0;
  await assert.rejects(verifyFrontends(manifest(),identity,options({deadlineMs:3,now:()=>clock,sleepFn:async ms=>{clock+=ms;},fetchFn:async()=>new Response('',{status:503})})),error=>{
    assert.equal(error.code,'readiness_deadline_exceeded');assert.equal(error.report.pending.length,4);assert.equal(clock,3);return true;
  });
});
test('redirects are never followed and transport errors do not become HTTP 503', async () => {
  let clock=0;
  await assert.rejects(verifyFrontends(manifest(),identity,options({deadlineMs:2,now:()=>clock,sleepFn:async ms=>{clock+=ms;},fetchFn:async url=>{
    if(url.endsWith('chunk.js'))throw new Error('must not expose URL or tokens');
    return new Response('',{status:302,headers:{Location:'https://elsewhere.example/'}});
  }})),error=>{
    assert(error.report.failures.some(row=>row.kind==='transport'));assert(error.report.failures.some(row=>row.kind==='redirect'));
    assert(!JSON.stringify(error.report).includes('must not expose'));return true;
  });
});
test('fetch or body stalls time out even when a mock ignores abort', async () => {
  await assert.rejects(verifyFrontends(manifest(),identity,options({deadlineMs:20,requestTimeoutMs:5,fetchFn:()=>new Promise(()=>{})})),error=>error.code==='readiness_deadline_exceeded');
  await assert.rejects(verifyFrontends(manifest(),identity,options({deadlineMs:20,requestTimeoutMs:5,fetchFn:async()=>new Response(new ReadableStream({start(){}}))})),error=>error.report.failures.every(row=>row.kind==='timeout'));
});
test('a superseded release marker fails after otherwise successful checks', async () => {
  let markers=0;
  await assert.rejects(verifyFrontends(manifest(),identity,options({fetchFn:async url=>url.endsWith(RELEASE_MARKER)&&++markers===2?new Response('new release'):responseFor(url)})),error=>error.code==='release_changed_or_superseded');
});
test('manifest or destination mismatch prevents every network request', async () => {
  let calls=0;
  await assert.rejects(verifyFrontends(manifest(),identity,options({sites:['http://127.0.0.1/'],fetchFn:async()=>{calls++;return new Response();}})),/invalid_readiness_options/);
  await assert.rejects(verifyFrontends({...manifest(),commit:'c'.repeat(40)},identity,options({fetchFn:async()=>{calls++;return new Response();}})),/identity/);
  assert.equal(calls,0);
});
