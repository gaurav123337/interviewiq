/* Static pure portal/receipt contracts. Real browser drivers and live markup
 * remain deliberately outside this suite; fixtures are not claims of live QA. */
import { describe, it, expect } from 'vitest';
import { adapterForJob, validatePublicJobUrl, validateAdapterRedirect, validateAdapterSession, validateSubmissionEvidence, clampPortalPolicy } from '../../scripts/apply-adapters-lib.js';
import type { SessionEvidence, SubmissionEvidence } from '../../scripts/apply-adapters-lib.js';
const NOW = Date.parse('2026-11-14T10:00:00Z'), BEFORE = '2026-11-14T09:59:00Z', CLICK = '2026-11-14T09:59:10Z', AFTER = '2026-11-14T09:59:11Z';
const gh = 'https://boards.greenhouse.io/acme/jobs/12345';
const ashby = 'https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555';
const lever = 'https://jobs.lever.co/acme/11111111-2222-3333-4444-555555555555';
const naukri = 'https://www.naukri.com/job-listings-frontend-engineer-acme-remote-2-to-5-years-141126123456';
const insta = 'https://www.instahyre.com/job-12345-frontend-engineer-at-acme/';
const workday = 'https://acme.wd5.myworkdayjobs.com/en-US/External/job/Remote/Software-Engineer_R12345';

describe('path-qualified known portal identities and final policies', () => {
  it.each([[gh, 'greenhouse', true], [ashby, 'ashby', true], [lever, 'lever', false], [naukri, 'naukri', true], [insta, 'instahyre', true], [workday, 'workday', false], ['https://www.linkedin.com/jobs/view/12345', 'linkedin', false]])('identifies %s deterministically', (url, id, auto) => {
    const a = adapterForJob(url as string);
    expect(a).toMatchObject({ id, supported: true, safeUrl: true, autoSubmit: auto });
    expect(a.boardIdentity).toContain(id); expect(a.jobIdentity).toContain(a.boardIdentity);
  });
  it('board identity includes vendor+host+board path, not shared ATS hostname', () => {
    expect(adapterForJob(gh).boardIdentity).not.toBe(adapterForJob(gh.replace('/acme/', '/beta/')).boardIdentity);
    expect(validateAdapterRedirect(gh, gh.replace('/acme/', '/beta/')).ok).toBe(false);
  });
  it.each(['https://boards.greenhouse.io/acme', 'https://jobs.ashbyhq.com/acme', 'https://www.naukri.com/login', 'https://www.instahyre.com/accounts/login/', 'https://www.linkedin.com/feed/', 'https://greenhouse.io/acme/jobs/12345'])('vendor/login/list root is not an application %s', url => {
    expect(adapterForJob(url).supported).toBe(false);
  });
  it('LinkedIn never policy runs after every override and ignores spoofed mode', () => {
    const a = adapterForJob('https://www.linkedin.com/jobs/view/12345', { overrides: { autoSubmit: true } });
    expect(a.autoSubmit).toBe(false); expect(a.mode).toBe('reviewOnly');
    expect(clampPortalPolicy({ ...a, autoSubmit: true, mode: 'automatic' }, { autoSubmit: true }).autoSubmit).toBe(false);
    expect(adapterForJob(gh, { overrides: { autoSubmit: false } }).autoSubmit).toBe(false);
    expect(adapterForJob('https://careers.unknown.example/job/123', { overrides: { autoSubmit: true } }).autoSubmit).toBe(false);
    expect(adapterForJob(lever, { overrides: { autoSubmit: true } }).autoSubmit).toBe(false);
  });
  it('unknown custom domain needs observed current job-bound known ATS evidence and stays review-only', () => {
    const base = adapterForJob(gh), evidence = { domain: 'careers.acme.example', adapter: 'greenhouse' as const, verifiedAt: BEFORE, formActionUrl: gh, requiredFields: ['#first_name', '#email'], jobIdentity: base.jobIdentity!, source: 'observed' as const };
    const a = adapterForJob('https://careers.acme.example/jobs/12345', { domainEvidence: evidence, now: NOW, overrides: { autoSubmit: true } });
    expect(a).toMatchObject({ id: 'greenhouse', supported: true, autoSubmit: false, mode: 'reviewOnly' });
    expect(adapterForJob('https://careers.acme.example/jobs/12345', { domainEvidence: { ...evidence, requiredFields: ['generatedJS()'] }, now: NOW }).supported).toBe(false);
  });
});

describe('strict public URL/redirect boundary', () => {
  it.each(['http://boards.greenhouse.io/acme/jobs/12345', 'https://user:pass@boards.greenhouse.io/acme/jobs/12345', 'https://127.0.0.1/jobs/1', 'https://2130706433/jobs/1', 'https://0x7f000001/jobs/1', 'https://[::1]/jobs/1', 'https://10.0.0.1/jobs/1', 'https://localhost/jobs/1', 'https://boards.greenhouse.io.evil.example/acme/jobs/1', 'https://boards.greenhouse.io:8443/acme/jobs/1', 'https://boards.greenhouse.io/acme/jobs/1?redirect=https://evil.example', 'https://boards.greenhouse.io/acme/jobs/1?next=%2Flogin', 'https://boards.greenhouse.io/acme%2fjobs%2f12345', 'https://boards.greenhouse.io/acme/jobs/12345#javascript:evil()', ' https://boards.greenhouse.io/acme/jobs/12345'])('rejects unsafe URL %s', url => {
    expect(validatePublicJobUrl(url).ok).toBe(false); expect(adapterForJob(url).autoSubmit).toBe(false);
  });
  it('safe known same-job application route accepted, unknown/cross-board redirects denied', () => {
    expect(validatePublicJobUrl(gh).ok).toBe(true);
    expect(validateAdapterRedirect(lever, `${lever}/apply`).ok).toBe(true);
    expect(validateAdapterRedirect(gh, 'https://unknown.example/jobs/1').ok).toBe(false);
    expect(validateAdapterRedirect(gh, gh.replace('12345', '99999')).ok).toBe(false);
  });
});
const session = (url = gh): SessionEvidence => {
  const a = adapterForJob(url), selector = a.fieldSelectors[0];
  return { url, checkedAt: BEFORE, now: NOW, error: false, challenge: false, loginVisible: false, observedSelectors: [selector, ...a.authenticatedSelectors.slice(0, 1)], verifiedFields: [{ selector, required: true }], cookies: a.sessionCookieNames.map(name => ({ name, value: 'fixture', domain: new URL(url).hostname, expires: NOW / 1000 + 3600, secure: true })) };
};
describe('positive auth/cookie/application session probes', () => {
  it.each([gh, ashby, lever, naukri, insta, workday])('real generic/vendor selectors permitted for %s', url => {
    expect(validateAdapterSession(adapterForJob(url), session(url)).ok).toBe(true);
  });
  it('Greenhouse observed native form selector is valid, no test-only attrs required', () => {
    const e = session(); e.observedSelectors = ['#application_form input:not([type=hidden]):not([disabled])']; e.verifiedFields = [{ selector: e.observedSelectors[0], required: true }];
    expect(validateAdapterSession(adapterForJob(gh), e).ok).toBe(true);
  });
  it('Naukri/Instahyre in-place requires positive auth + pinned enabled apply control', () => {
    for (const url of [naukri, insta]) {
      const a = adapterForJob(url), e = session(url); e.verifiedFields = []; e.observedSelectors = [...a.authenticatedSelectors]; e.applyControl = { role: 'button', name: 'Apply', enabled: true };
      expect(validateAdapterSession(a, e).ok).toBe(true);
      e.applyControl.name = 'Sign in'; expect(validateAdapterSession(a, e).ok).toBe(false);
    }
  });
  it.each(['login', 'noFields', 'noAuth', 'noCookie', 'stale', 'challenge', 'error', 'generatedSelector', 'wrongJob'])('fails closed %s', reason => {
    const a = adapterForJob(insta), e = session(insta);
    if (reason === 'login') e.loginVisible = true;
    if (reason === 'noFields') e.verifiedFields = [];
    if (reason === 'noAuth') e.observedSelectors = [a.fieldSelectors[0]];
    if (reason === 'noCookie') e.cookies = [];
    if (reason === 'stale') e.checkedAt = '2026-11-14T08:00:00Z';
    if (reason === 'challenge') e.challenge = true;
    if (reason === 'error') e.error = true;
    if (reason === 'generatedSelector') e.observedSelectors.push('evilGeneratedSelector');
    if (reason === 'wrongJob') e.url = gh;
    expect(validateAdapterSession(a, e).ok).toBe(false);
  });
  it('missing page error/challenge/login probes and unknown adapters cannot apply', () => {
    const e = session(); delete e.error;
    expect(validateAdapterSession(adapterForJob(gh), e).ok).toBe(false);
    expect(validateAdapterSession(adapterForJob('https://unknown.example/jobs/1'), session()).ok).toBe(false);
  });
});
const receipt = (): SubmissionEvidence => {
  const a = adapterForJob(gh);
  return { before: { url: gh, observedAt: BEFORE, jobIdentity: a.jobIdentity! }, after: { url: gh, observedAt: AFTER, jobIdentity: a.jobIdentity!, receipt: { selector: a.receiptSelector!, text: 'Your application has been submitted.', jobIdentity: a.jobIdentity!, receiptId: 'receipt-12345' } }, clickedAt: CLICK, now: NOW };
};
describe('new job-bound positive submission evidence, never click equals applied', () => {
  it('new exact receipt id + positive job-bound confirmation verifies', () => expect(validateSubmissionEvidence(gh, receipt())).toMatchObject({ verified: true, status: 'submitted', receiptId: 'receipt-12345' }));
  it('new job-scoped receipt route + positive confirmation verifies without id', () => {
    const e = receipt(); delete e.after.receipt!.receiptId; e.after.url = `${gh}/thanks`;
    expect(validateSubmissionEvidence(gh, e).verified).toBe(true);
  });
  it('expected exact successful POST receipt + positive confirmation verifies', () => {
    const e = receipt(); delete e.after.receipt!.receiptId; e.expectedNetworkUrl = 'https://boards.greenhouse.io/acme/jobs/12345/submit'; e.after.network = [{ url: e.expectedNetworkUrl, method: 'POST', status: 201, jobIdentity: e.after.jobIdentity, receiptId: 'network-receipt-1' }];
    expect(validateSubmissionEvidence(gh, e).verified).toBe(true);
    e.after.network[0].status = 403; expect(validateSubmissionEvidence(gh, e).verified).toBe(false);
  });
  it('receipt id cannot verify an unrelated same-host job destination', () => {
    const e = receipt(); e.after.url = gh.replace('12345', '99999');
    expect(validateSubmissionEvidence(gh, e).verified).toBe(false);
  });
  it.each(['textOnly', 'urlOnly', 'broadText', 'negative', 'preexisting', 'wrongJob', 'wrongSelector', 'crossHost', 'oldSnapshot', 'noClick', 'noReceipt'])('unconfirmed %s stays unverified', reason => {
    const e = receipt();
    if (reason === 'textOnly') delete e.after.receipt!.receiptId;
    if (reason === 'urlOnly') { e.after.url = `${gh}/thanks`; delete e.after.receipt; }
    if (reason === 'broadText') e.after.receipt!.text = 'Apply now. Applications submitted in 2025. Other jobs available.';
    if (reason === 'negative') e.after.receipt!.text = 'Your application was not submitted.';
    if (reason === 'preexisting') e.before.receipt = { ...e.after.receipt! };
    if (reason === 'wrongJob') e.after.receipt!.jobIdentity = 'other-job';
    if (reason === 'wrongSelector') e.after.receipt!.selector = 'body';
    if (reason === 'crossHost') e.after.url = 'https://evil.example/thanks';
    if (reason === 'oldSnapshot') e.after.observedAt = BEFORE;
    if (reason === 'noClick') e.clickedAt = '';
    if (reason === 'noReceipt') delete e.after.receipt;
    expect(validateSubmissionEvidence(gh, e)).toMatchObject({ verified: false, status: 'unverified' });
  });
});
