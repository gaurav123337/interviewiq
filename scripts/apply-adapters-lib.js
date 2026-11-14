/* apply-adapters-lib — static portal contracts, NOT a browser driver. Known
 * vendors require a posting path, not just a recognizable domain. Unknown
 * sites and LinkedIn are never auto-submit-capable, including after overrides.
 * Observed selectors/receipts are worker evidence, never arbitrary JS or CSS. */
import { ATS_PACKS, SITE_RULES } from './apply-engine-lib.js';
const limits = { url: 2048, receipt: 2000 };
const formFields = ['form input:not([type=hidden]):not([disabled])', 'form textarea', 'form select'];
const definitions = Object.freeze({
  greenhouse: { hosts: ['boards.greenhouse.io', 'job-boards.greenhouse.io'], public: true, auto: true, fields: ['#first_name', '#last_name', '#email', '#resume'], submit: '#submit_app', receipt: '#application_confirmation' },
  ashby: { hosts: ['jobs.ashbyhq.com'], public: true, auto: true, fields: ['input[name="_systemfield_name"]', 'input[name="_systemfield_email"]', 'input[type="file"]'], submit: 'button[type="submit"]', receipt: '[data-testid="application-success"]' },
  lever: { hosts: ['jobs.lever.co'], public: true, auto: false, fields: ['input[name="name"]', 'input[name="email"]', 'input[name="resume"]'], submit: 'button[type="submit"]', receipt: '.application-confirmation' },
  naukri: { hosts: ['www.naukri.com', 'naukri.com'], public: false, auto: true, fields: formFields, authenticated: ['a[href="/mnjuser/myapply"]', 'a[href="https://www.naukri.com/mnjuser/myapply"]'], login: ['input[name="username"]', 'input[type="password"]'], cookies: [], submit: 'button:has-text("Apply")', receipt: '[role="status"]' },
  instahyre: { hosts: ['www.instahyre.com', 'instahyre.com'], public: false, auto: true, fields: formFields, authenticated: ['a[href="/candidate/opportunities/"]'], login: ['input[name="login"]', 'input[type="password"]'], cookies: ['sessionid'], submit: 'button:has-text("Submit")', receipt: '[role="status"]' },
  workday: { hosts: ['*.myworkdayjobs.com'], public: false, auto: false, fields: ['[data-automation-id="legalNameSection"]', '[data-automation-id="email"]', '[data-automation-id="resumeUpload"]'], authenticated: ['[data-automation-id="candidateHome"]'], login: ['[data-automation-id="signInContent"]'], cookies: [], submit: '[data-automation-id="submit"]', receipt: '[data-automation-id="applicationSubmitted"]' },
  linkedin: { hosts: ['www.linkedin.com', 'linkedin.com'], public: false, auto: false, fields: ['.jobs-easy-apply-content'], authenticated: ['a[href="/feed/"]'], login: ['input[name="session_key"]', 'input[name="session_password"]'], cookies: ['li_at'], submit: null, receipt: '.artdeco-inline-feedback--success' },
});
function hostAllowed(host, allowed) { return allowed.some(h => h.startsWith('*.') ? host.endsWith(h.slice(1)) && host !== h.slice(2) : host === h); }
function urlSyntax(url) {
  if (typeof url !== 'string' || url.length > limits.url || url !== url.trim() || /[\u0000-\u0020\u007f\\]/.test(url)) return { ok: false, reason: 'malformed public URL' };
  let u;
  try { u = new URL(url); } catch { return { ok: false, reason: 'invalid URL' }; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || u.hash) return { ok: false, reason: 'HTTPS URL without credentials, custom port or fragment required' };
  const host = u.hostname.toLowerCase();
  // Reject ALL literal IPs, not just obvious RFC1918 addresses: URL parsing
  // canonicalizes decimal/octal/hex IPv4 spellings that bypass naive guards.
  if (!host.includes('.') || host.endsWith('.') || host.includes(':') || /^\[/.test(host) || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host) || !/^[a-z0-9.-]+$/.test(host)) return { ok: false, reason: 'public DNS hostname required; private/local/IP targets denied' };
  let path;
  try { path = decodeURIComponent(u.pathname); } catch { return { ok: false, reason: 'malformed URL encoding' }; }
  if (/[\\\u0000-\u001f]/.test(path) || path.split('/').includes('..') || /%2f|%5c|%25|%00/i.test(u.pathname)) return { ok: false, reason: 'unsafe path encoding' };
  for (const [k, v] of u.searchParams) if (/^(?:url|redirect|redirect_uri|redirecturl|next|return|returnurl|continue|callback)$/i.test(k) || /^(?:https?:|javascript:|data:|\/\/)/i.test(v)) return { ok: false, reason: 'embedded redirect destination denied' };
  return { ok: true, url: u.href, hostname: host, reason: 'public HTTPS URL syntax verified' };
}
export function validatePublicJobUrl(url, { allowedHosts = Object.values(definitions).flatMap(d => d.hosts) } = {}) {
  const result = urlSyntax(url);
  if (!result.ok) return result;
  if (!Array.isArray(allowedHosts) || !hostAllowed(result.hostname, allowedHosts)) return { ok: false, reason: 'hostname not in explicit safe-host allowlist' };
  return result;
}
function postingIdentity(id, u) {
  const parts = u.pathname.split('/').filter(Boolean);
  if (id === 'greenhouse' && parts.length === 3 && parts[1] === 'jobs' && /^\d+$/.test(parts[2]) && /^[a-z0-9_-]+$/i.test(parts[0])) return { board: parts[0], job: parts[2] };
  if (['ashby', 'lever'].includes(id) && parts.length >= 2 && parts.length <= 3 && /^[a-z0-9_-]+$/i.test(parts[0]) && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(parts[1]) && (parts.length === 2 || parts[2] === 'application' || parts[2] === 'apply')) return { board: parts[0], job: parts[1].toLowerCase() };
  if (id === 'naukri' && /^job-listings-[a-z0-9-]+-\d{8,}$/i.test(parts[0]) && parts.length === 1) return { board: 'candidate', job: parts[0] };
  if (id === 'instahyre' && parts.length === 1 && /^job-\d+-[a-z0-9-]+$/i.test(parts[0])) return { board: 'candidate', job: parts[0] };
  if (id === 'linkedin' && parts.length === 3 && parts[0] === 'jobs' && parts[1] === 'view' && /^\d+$/.test(parts[2])) return { board: 'jobs', job: parts[2] };
  if (id === 'workday') {
    const index = parts.indexOf('job');
    if (index >= 1 && index < parts.length - 1 && /^[a-z0-9_-]+$/i.test(parts[index - 1]) && /_[a-z0-9-]+$/i.test(parts.at(-1))) return { board: parts[index - 1], job: parts.at(-1) };
  }
  return null;
}
const empty = (jobUrl, reason, safeUrl = false) => ({ id: 'unknown', supported: false, safeUrl, reason, jobUrl: typeof jobUrl === 'string' ? jobUrl : '', boardIdentity: null, jobIdentity: null, mode: 'unsupported', autoSubmit: false, requiresAuth: true, loginSelectors: [], authenticatedSelectors: [], fieldSelectors: [], sessionCookieNames: [], submitSelector: null, receiptSelector: null });
export function clampPortalPolicy(adapter, overrides = {}) {
  // This clamp runs LAST. Persisted trust, user rules and an AI suggestion can
  // never promote LinkedIn, unknown hosts or a review-only vendor to auto mode.
  const parsed = urlSyntax(adapter.jobUrl);
  const qualified = parsed.ok && definitions[adapter.id] && hostAllowed(parsed.hostname, definitions[adapter.id].hosts) && postingIdentity(adapter.id, new URL(parsed.url));
  const canAuto = qualified && adapter.supported === true && adapter.safeUrl === true && adapter.id !== 'linkedin' && adapter.id !== 'unknown' && definitions[adapter.id]?.auto === true && !adapter.reason.startsWith('custom domain');
  const autoSubmit = canAuto && overrides.autoSubmit !== false;
  return { ...adapter, autoSubmit, mode: !adapter.supported ? 'unsupported' : autoSubmit ? 'automatic' : 'reviewOnly' };
}
export function adapterForJob(job, { overrides = {}, domainEvidence, now = Date.now() } = {}) {
  const input = typeof job === 'string' ? job : job?.jobUrl, parsed = urlSyntax(input);
  if (!parsed.ok) return empty(input, parsed.reason);
  const u = new URL(parsed.url), entry = Object.entries(definitions).find(([, d]) => hostAllowed(u.hostname, d.hosts));
  if (!entry) {
    const e = domainEvidence, d = definitions[e?.adapter];
    if (e && d && e.source === 'observed' && e.domain === u.hostname && Number.isFinite(Date.parse(e.verifiedAt)) && Date.parse(e.verifiedAt) <= now && now - Date.parse(e.verifiedAt) <= 86400000 && typeof e.jobIdentity === 'string' && e.jobIdentity && Array.isArray(e.requiredFields) && e.requiredFields.length >= 2 && e.requiredFields.every(s => d.fields.includes(s)) && adapterForJob(e.formActionUrl).id === e.adapter && adapterForJob(e.formActionUrl).jobIdentity === e.jobIdentity) {
      const base = adapterForJob(e.formActionUrl);
      return clampPortalPolicy({ ...base, jobUrl: parsed.url, autoSubmit: false, reason: 'custom domain observed ATS form evidence; review only' }, overrides);
    }
    return empty(input, 'unknown host unsupported; explicit ATS evidence required');
  }
  const [id, d] = entry, identity = postingIdentity(id, u);
  if (!identity) return empty(input, 'known vendor host but not a qualified posting URL', true);
  const boardIdentity = `${id}:${u.hostname}/${identity.board}`, jobIdentity = `${boardIdentity}/${identity.job}`;
  return clampPortalPolicy({ id, supported: true, safeUrl: true, reason: 'known path-qualified portal contract', jobUrl: parsed.url, boardIdentity, jobIdentity, autoSubmit: d.auto, mode: d.auto ? 'automatic' : 'reviewOnly', requiresAuth: !d.public, loginSelectors: Object.freeze(d.login || ['input[type="password"]']), authenticatedSelectors: Object.freeze(d.authenticated || []), fieldSelectors: Object.freeze([...new Set([...(ATS_PACKS[id]?.fieldSelectorHints || formFields), ...d.fields])]), sessionCookieNames: Object.freeze(d.cookies || []), applyButtonText: SITE_RULES[id].applyButtonText, submitButtonText: SITE_RULES[id].submitButtonText, submitSelector: d.submit, receiptSelector: d.receipt }, overrides);
}
export function validateAdapterRedirect(from, to) {
  const a = adapterForJob(from), b = adapterForJob(typeof to === 'string' ? to : '');
  if (!a.supported || !b.supported || !b.safeUrl) return { ok: false, adapter: b, reason: 'redirect must land on a known qualified posting adapter' };
  if (a.jobIdentity !== b.jobIdentity) return { ok: false, adapter: b, reason: 'redirect crosses board/job identity; requires new job-bound approval' };
  return { ok: true, adapter: b, reason: 'same verified board/job identity' };
}
function isoTime(s) { return typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN; }
export function validateAdapterSession(adapter, evidence = {}) {
  const out = reason => ({ ok: false, jobUrl: adapter.jobUrl, checkedAt: evidence.checkedAt || '', reason });
  if (!adapter.supported || !adapter.safeUrl) return out('unsupported or unsafe portal');
  if (evidence.error !== false || evidence.challenge !== false || evidence.loginVisible !== false) return out('page/challenge/login probe failed or missing');
  const checked = isoTime(evidence.checkedAt);
  if (!Number.isFinite(checked) || !Number.isFinite(evidence.now) || checked > evidence.now || evidence.now - checked > 300000) return out('stale or invalid session probe');
  if (!validateAdapterRedirect(adapter.jobUrl, evidence.url).ok) return out('probe URL does not match approved job');
  if (!Array.isArray(evidence.observedSelectors) || evidence.observedSelectors.some(s => ![...adapter.loginSelectors, ...adapter.authenticatedSelectors, ...adapter.fieldSelectors].includes(s))) return out('unrecognized or generated selector evidence');
  if (adapter.loginSelectors.some(s => evidence.observedSelectors.includes(s))) return out('login-only page cannot apply');
  const inPlace = ['naukri', 'instahyre'].includes(adapter.id) && evidence.applyControl?.role === 'button' && evidence.applyControl.enabled === true && typeof evidence.applyControl.name === 'string' && adapter.applyButtonText.test(evidence.applyControl.name);
  if (!Array.isArray(evidence.verifiedFields) || (!inPlace && evidence.verifiedFields.length < 1) || evidence.verifiedFields.some(f => !adapter.fieldSelectors.includes(f.selector) || !evidence.observedSelectors.includes(f.selector) || typeof f.required !== 'boolean')) return out('verified application fields missing; login-only is not an application');
  if (adapter.requiresAuth) {
    if (!adapter.authenticatedSelectors.some(s => evidence.observedSelectors.includes(s))) return out('positive authenticated-page probe required');
    const host = new URL(evidence.url).hostname;
    for (const name of adapter.sessionCookieNames) if (!(evidence.cookies || []).some(c => c.name === name && typeof c.value === 'string' && c.value.length > 0 && typeof c.domain === 'string' && (host === c.domain.replace(/^\./, '') || host.endsWith('.' + c.domain.replace(/^\./, ''))) && c.secure !== false && (c.expires === undefined || c.expires === -1 || c.expires > evidence.now / 1000))) return out(`verified session cookie missing: ${name}`);
  }
  return { ok: true, jobUrl: adapter.jobUrl, checkedAt: evidence.checkedAt, reason: 'positive application-field and auth/session probes verified' };
}
function positiveReceipt(text) {
  return typeof text === 'string' && text.length <= limits.receipt && !/not (?:been )?(?:submitted|received|sent)|failed|error|unsuccessful|unable|not detected/i.test(text) && /^(?:thank you(?: for (?:applying|your application))?[.!]?\s*)?(?:your |the )?application (?:has been |was )?(?:successfully )?(?:received|submitted|sent)[.!]?$|^thank you for (?:applying|your application)[.!]?$/i.test(text.trim());
}
function receiptRoute(id, beforeUrl, afterUrl, identity) {
  const a = urlSyntax(beforeUrl), b = urlSyntax(afterUrl);
  if (!a.ok || !b.ok || a.hostname !== b.hostname || a.url === b.url) return false;
  const u = new URL(b.url), posting = adapterForJob(beforeUrl);
  if (posting.id !== id || posting.jobIdentity !== identity) return false;
  const original = new URL(a.url).pathname.replace(/\/(?:apply|application)\/?$/, '').replace(/\/$/, '');
  return u.pathname === `${original}/thanks` || u.pathname === `${original}/confirmation` || u.pathname === `${original}/submitted` || (u.pathname.replace(/\/$/, '') === original && /^[a-z0-9_-]{4,200}$/i.test(u.searchParams.get('submissionId') || ''));
}
export function validateSubmissionEvidence(job, evidence = {}) {
  const adapter = adapterForJob(job), { before, after } = evidence;
  const no = reason => ({ verified: false, status: 'unverified', reason });
  if (!adapter.supported || !adapter.safeUrl || !before || !after) return no('known portal and pre/post evidence required');
  const clicked = isoTime(evidence.clickedAt), pre = isoTime(before.observedAt), post = isoTime(after.observedAt);
  if (![clicked, pre, post, evidence.now].every(Number.isFinite) || pre > clicked || post <= clicked || post > evidence.now || evidence.now - post > 300000) return no('fresh ordered pre-click/post-click evidence required');
  if (before.jobIdentity !== adapter.jobIdentity || after.jobIdentity !== adapter.jobIdentity || !validateAdapterRedirect(adapter.jobUrl, before.url).ok) return no('evidence is not bound to exact approved board/job');
  const r = after.receipt;
  if (!r || r.selector !== adapter.receiptSelector || r.jobIdentity !== adapter.jobIdentity || !positiveReceipt(r.text)) return no('new positive job-bound receipt required; broad page text is not proof');
  if (before.receipt && (positiveReceipt(before.receipt.text) || (r.receiptId && r.receiptId === before.receipt.receiptId))) return no('receipt existed before click; no new submission proof');
  const sameReceipt = typeof r.receiptId === 'string' && /^[a-z0-9_-]{4,200}$/i.test(r.receiptId) && r.receiptId !== before.receipt?.receiptId;
  const network = Array.isArray(after.network) && after.network.some(e => {
    const safe = validatePublicJobUrl(e.url), requested = evidence.expectedNetworkUrl;
    return safe.ok && requested && e.url === requested && new URL(e.url).hostname === new URL(adapter.jobUrl).hostname && e.method === 'POST' && e.status >= 200 && e.status < 300 && e.jobIdentity === adapter.jobIdentity && typeof e.receiptId === 'string' && /^[a-z0-9_-]{4,200}$/i.test(e.receiptId) && (!r.receiptId || e.receiptId === r.receiptId) && !(before.network || []).some(p => p.receiptId === e.receiptId);
  });
  const route = receiptRoute(adapter.id, before.url, after.url, adapter.jobIdentity);
  if (!validateAdapterRedirect(adapter.jobUrl, after.url).ok && !route) return no('post-submit URL is not the same job or exact qualified receipt route');
  if (!sameReceipt && !network && !route) return no('receipt requires new id, exact job receipt route or expected successful network evidence');
  if (!urlSyntax(after.url).ok || new URL(after.url).hostname !== new URL(before.url).hostname) return no('unsafe or cross-host receipt destination');
  return { verified: true, status: 'submitted', reason: 'new positive job-bound receipt plus independent receipt evidence', ...(sameReceipt ? { receiptId: r.receiptId } : {}) };
}
