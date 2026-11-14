/* Concrete, fixed-contract Playwright I/O. Decision rules live in the pure
 * libraries; no page text can provide selectors, JavaScript or candidate facts. */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { adapterForJob, validateAdapterRedirect, validateAdapterSession, validatePublicJobUrl } from './apply-adapters-lib.js';
import { acquirePipelineBrowser } from './apply-browser.js';
import { classifyQuestion, isTrustedResumeField } from './apply-pipeline-lib.js';

function readFormNodes(nodes) {
  const out = [], radios = new Set();
  const visible = n => !!(n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
  const label = n => (Array.from(n.labels || []).map(l => l.textContent?.trim()).join(' ') || n.getAttribute('aria-label')
    || n.closest('fieldset')?.querySelector('legend')?.textContent?.trim() || n.getAttribute('placeholder') || '').slice(0, 2000);
  const required = n => n.required === true || n.getAttribute('aria-required') === 'true';
  nodes.forEach((n, index) => {
    if (!visible(n) || n.disabled || ['hidden', 'submit', 'button', 'reset', 'password'].includes(n.type)) return;
    const type = n.tagName === 'SELECT' ? 'select' : n.tagName === 'TEXTAREA' ? 'textarea' : n.type || 'text';
    if (type === 'radio') {
      if (!n.name || radios.has(n.name)) return;
      radios.add(n.name);
      const members = nodes.map((r, i) => ({ r, i })).filter(({ r }) => r.type === 'radio' && r.name === n.name && visible(r));
      out.push({ id: String(index), domId: n.id, domName: n.name,
        question: n.closest('fieldset')?.querySelector('legend')?.textContent?.trim() || n.getAttribute('aria-label') || '',
        controlType: type, required: members.some(({ r }) => required(r)), options: members.map(({ r }) => label(r)), radioIndexes: members.map(({ i }) => i) });
    } else out.push({ id: String(index), domId: n.id, domName: n.name, question: label(n), controlType: type, required: required(n),
      options: type === 'select' ? Array.from(n.options).filter(o => !o.disabled && o.value !== '').map(o => o.textContent.trim()) : [] });
  });
  return out;
}
const fieldKey = field => JSON.stringify(field);

const controls = 'input, select, textarea';
const clock = () => new Date().toISOString();
const privateAddress = value => !isIP(value) || /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|224\.|240\.)/.test(value)
  || value === '::' || value === '::1' || /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(value) || value.startsWith('::ffff:');

export function createPortalBrowser(runtime, { fixtureOrigin, headless = true, acquire = acquirePipelineBrowser } = {}) {
  if (fixtureOrigin) {
    const fixture = new URL(fixtureOrigin);
    if (process.env.INTERVIEWIQ_APPLY_SYNTHETIC !== '1' || fixture.protocol !== 'http:' || fixture.hostname !== '127.0.0.1' || fixture.pathname !== '/' || fixture.search || fixture.hash) {
      throw new Error('Loopback browser fixtures require explicit synthetic mode');
    }
  }
  let browser, browserHeadless, serial = Promise.resolve();
  const exclusive = operation => {
    const next = serial.then(operation);
    serial = next.catch(() => {});
    return next;
  };
  const active = new Set();
  const publicHosts = new Map();
  const realUrl = url => fixtureOrigin ? new URL(new URL(url).pathname + new URL(url).search, fixtureOrigin).href : url;
  const canonicalUrl = (url, jobUrl) => fixtureOrigin && new URL(url).origin === new URL(fixtureOrigin).origin
    ? new URL(new URL(url).pathname + new URL(url).search, new URL(jobUrl).origin).href : url;
  async function ensureBrowser(headed = false) {
    if (headed && browser && browserHeadless) {
      if (active.size) throw new Error('Finish active pages before switching the binding profile to headed mode');
      await browser.cleanup(); browser = null;
    }
    if (!browser) {
      browserHeadless = headed ? false : headless;
      browser = await acquire(runtime, { headless: browserHeadless });
      await browser.ctx.route('**/*', async route => {
        const request = route.request();
        let u;
        try { u = new URL(request.url()); } catch { return route.abort(); }
        if (fixtureOrigin) return u.origin === new URL(fixtureOrigin).origin ? route.continue() : route.abort();
        if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return route.abort();
        if (request.isNavigationRequest() && !validatePublicJobUrl(u.href).ok) return route.abort();
        try {
          let allowed = publicHosts.get(u.hostname);
          if (allowed === undefined) {
            const addresses = await lookup(u.hostname, { all: true });
            allowed = addresses.length > 0 && addresses.every(a => !privateAddress(a.address));
            publicHosts.set(u.hostname, allowed);
          }
          return allowed ? route.continue() : route.abort();
        } catch { return route.abort(); }
      });
    }
    return browser;
  }
  async function open(job, { headed = false } = {}) {
    const adapter = adapterForJob(job);
    if (!adapter.supported || !adapter.safeUrl) throw new Error('Unsupported application target');
    const page = await exclusive(async () => {
      const acquired = await ensureBrowser(headed);
      const page = await acquired.ctx.newPage();
      active.add(page);
      return page;
    });
    page.setDefaultTimeout(3000);
    page.setDefaultNavigationTimeout(20000);
    try {
      await page.goto(realUrl(job.jobUrl), { waitUntil: 'domcontentloaded' });
      if (!validateAdapterRedirect(job, canonicalUrl(page.url(), job.jobUrl)).ok) throw new Error('Application redirect changed identity');
      // Only the known ATS application tab is reversible navigation, never a private-board Apply button.
      if (['ashby', 'lever'].includes(adapter.id) && !await page.locator('form').count()) {
        const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => ({ href: n.href, text: n.textContent?.trim() })));
        const candidates = links.filter(link => /^apply(?: for this job)?(?: now)?$/i.test(link.text || '') && validateAdapterRedirect(job, canonicalUrl(link.href, job.jobUrl)).ok);
        if (candidates.length === 1) await page.goto(candidates[0].href, { waitUntil: 'domcontentloaded' });
      }
      return portalHandle(page, job, adapter);
    } catch (error) { active.delete(page); await page.close().catch(() => {}); throw error; }
  }
  function portalHandle(page, job, adapter) {
    let observedFields = [], latestSession, verifiedExpected;
    async function observeApplyControl() {
      const control = page.getByRole('button', { name: adapter.applyButtonText });
      if (await control.count() !== 1 || !await control.isVisible()) return null;
      return { role: 'button', name: (await control.innerText()).trim(), enabled: await control.isEnabled() };
    }
    async function inPlaceEvidence() {
      const identity = await page.locator('a[href^="mailto:"]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length)
        .map(n => n.getAttribute('href')?.slice('mailto:'.length).split('?')[0]).filter(Boolean));
      const dialog = page.getByRole('dialog');
      const visibleDialogs = await dialog.evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).length);
      const visibleControls = await page.locator(controls).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length
        && !n.disabled && n.type !== 'hidden' && n.type !== 'submit' && n.type !== 'button' && !n.closest('[role="search"]')).length);
      const body = await page.locator('body').innerText();
      const profileReady = /profile\s+(?:is\s+)?(?:complete|ready)|resume\s+(?:is\s+)?(?:uploaded|updated|ready)/i.test(body)
        && !/complete\s+your\s+profile|upload\s+your\s+resume|profile\s+incomplete/i.test(body);
      return { accountIdentity: identity.length === 1 ? identity[0] : '', noQuestionsObserved: visibleControls === 0 && visibleDialogs === 0,
        profileReady, applyControl: await observeApplyControl() };
    }
    async function session() {
      const observedSelectors = [], verifiedFields = [];
      for (const selector of [...adapter.loginSelectors, ...adapter.authenticatedSelectors, ...adapter.fieldSelectors]) {
        const nodes = page.locator(selector);
        for (let i = 0; i < await nodes.count(); i++) {
          if (await nodes.nth(i).isVisible()) { observedSelectors.push(selector); break; }
        }
        if (adapter.fieldSelectors.includes(selector) && observedSelectors.includes(selector)) {
          verifiedFields.push({ selector, required: await nodes.first().evaluate(n => n.required === true || n.getAttribute('aria-required') === 'true') });
        }
      }
      const body = (await page.locator('body').innerText()).slice(0, 20000);
      const applyControl = ['naukri', 'instahyre'].includes(adapter.id) ? await observeApplyControl() : undefined;
      const evidence = { url: canonicalUrl(page.url(), job.jobUrl), checkedAt: clock(), now: Date.now(), error: false,
        ...(applyControl ? { applyControl } : {}),
        challenge: /verify you are human|captcha|access denied|unusual traffic/i.test(body),
        loginVisible: adapter.loginSelectors.some(s => observedSelectors.includes(s)), observedSelectors, verifiedFields,
        cookies: adapter.requiresAuth ? await page.context().cookies(realUrl(job.jobUrl)) : [] };
      // Cookie values are used in-memory only by the pure validator and never reported.
      latestSession = validateAdapterSession(adapter, evidence);
      return latestSession;
    }
    async function fields() {
      if (!latestSession?.ok) throw new Error('Positive session probe required before form collection');
      observedFields = await page.locator(controls).evaluateAll(readFormNodes);
      if (observedFields.length > 200) throw new Error('Application form exceeds bounded controls');
      return observedFields.map(({ radioIndexes, ...field }) => field);
    }
    async function observedLocator(field) {
      const original = observedFields.find(f => f.id === field.id);
      const current = (await page.locator(controls).evaluateAll(readFormNodes)).find(f => f.id === field.id);
      if (!original || !current || fieldKey(original) !== fieldKey(current)) throw new Error('Live application field changed; recollect before writing');
      const { radioIndexes, ...published } = original;
      if (fieldKey(published) !== fieldKey(field)) throw new Error('Unrecognized field observation');
      const locator = original.domId ? page.getByLabel(original.question, { exact: true }) : page.locator(controls).nth(Number(field.id));
      // Label can be nonunique; fall back to the verified position only after exact full fingerprint equality.
      return { original, locator: await locator.count() === 1 ? locator : page.locator(controls).nth(Number(field.id)) };
    }
    async function fill(field, value) {
      const { original, locator } = await observedLocator(field);
      if (field.controlType === 'radio') {
        const index = original.options.indexOf(value);
        if (index < 0 || original.options.lastIndexOf(value) !== index) throw new Error('Radio option mismatch');
        await page.locator(controls).nth(original.radioIndexes[index]).check();
      } else if (field.controlType === 'select') await locator.selectOption({ label: value });
      else if (field.controlType === 'checkbox') {
        if (!['true', 'false', 'yes', 'no'].includes(String(value).toLowerCase())) throw new Error('Explicit boolean consent required');
        await locator.setChecked(['true', 'yes'].includes(String(value).toLowerCase()));
      } else if (field.controlType === 'file') throw new Error('Approved artifact upload required');
      else await locator.fill(value);
    }
    async function upload(field, artifact) {
      if (!isTrustedResumeField(field, job)) throw new Error('Only an exact observed resume question can receive an artifact');
      const { locator } = await observedLocator(field);
      await locator.setInputFiles(artifact);
    }
    async function clear(field) {
      if (field.required) return false;
      const { original, locator } = await observedLocator(field);
      if (field.controlType === 'radio') {
        // Native radios cannot be safely unchecked by a user-like action; an unconfirmed selection pauses.
        return !(await Promise.all(original.radioIndexes.map(index => page.locator(controls).nth(index).isChecked()))).some(Boolean);
      }
      if (field.controlType === 'checkbox') await locator.setChecked(false);
      else if (field.controlType === 'file') await locator.setInputFiles([]);
      else if (field.controlType === 'select') {
        const empty = await locator.evaluate(n => Array.from(n.options).filter(o => o.value === '' && !o.disabled).length);
        if (empty === 1) await locator.selectOption('');
        else return await locator.evaluate(n => n.selectedOptions.length === 0 || Array.from(n.selectedOptions).every(o => o.value === ''));
      } else if (['text', 'textarea', 'email', 'tel', 'number', 'date', 'url'].includes(field.controlType)) await locator.fill('');
      else return false;
      return true;
    }
    async function complete() {
      return page.locator(controls).evaluateAll(nodes => nodes.every(n => !n.getClientRects().length || n.disabled || !(n.required || n.getAttribute('aria-required') === 'true')
        || (n.type === 'radio' ? nodes.some(r => r.type === 'radio' && r.name === n.name && r.checked)
          : n.type === 'file' ? n.files?.length > 0 : n.type === 'checkbox' ? n.checked : n.checkValidity() && String(n.value).trim().length > 0)));
    }
    async function verifyFilled(expected) {
      const current = await page.locator(controls).evaluateAll(readFormNodes);
      if (current.length !== observedFields.length || fieldKey(current) !== fieldKey(observedFields)
        || expected.length !== observedFields.length || new Set(expected.map(item => item.field.id)).size !== expected.length) return false;
      for (const item of expected) {
        const original = observedFields.find(f => f.id === item.field.id);
        if (!original) return false;
        const { radioIndexes, ...published } = original;
        if (fieldKey(published) !== fieldKey(item.field)) return false;
        const locator = page.locator(controls).nth(Number(original.id));
        if (item.empty === true) {
          if (original.required) return false;
          if (original.controlType === 'radio') {
            if ((await Promise.all(original.radioIndexes.map(index => page.locator(controls).nth(index).isChecked()))).some(Boolean)) return false;
          } else if (!await locator.evaluate(n => n.type === 'checkbox' ? !n.checked : n.type === 'file' ? !n.files?.length
            : n.tagName === 'SELECT' ? Array.from(n.selectedOptions).every(o => o.value === '') : n.value === '')) return false;
          continue;
        }
        const actual = await locator.evaluate(n => n.type === 'file' ? Array.from(n.files || []).map(f => f.name)
          : n.tagName === 'SELECT' ? n.selectedOptions[0]?.textContent?.trim() : n.type === 'checkbox' ? String(n.checked) : n.value);
        if (item.artifact) { if (!Array.isArray(actual) || actual.length !== 1 || actual[0] !== item.artifact.split(/[\\/]/).at(-1)) return false; }
        else if (original.controlType === 'radio') {
          const index = original.options.indexOf(item.value);
          if (index < 0 || !await page.locator(controls).nth(original.radioIndexes[index]).isChecked()) return false;
        } else if (original.controlType === 'checkbox') {
          if (actual !== String(['true', 'yes'].includes(item.value.toLowerCase()))) return false;
        } else if (actual !== item.value) return false;
      }
      verifiedExpected = expected;
      return true;
    }
    async function snapshot() {
      const receipt = adapter.receiptSelector && page.locator(adapter.receiptSelector);
      let data;
      if (receipt && await receipt.count() === 1 && await receipt.isVisible()) {
        data = { selector: adapter.receiptSelector, text: (await receipt.innerText()).trim().slice(0, 2000), jobIdentity: adapter.jobIdentity,
          receiptId: await receipt.getAttribute('data-receipt-id') ?? undefined };
      }
      return { url: canonicalUrl(page.url(), job.jobUrl), observedAt: clock(), jobIdentity: adapter.jobIdentity, ...(data ? { receipt: data } : {}) };
    }
    async function submit() {
      if (!adapter.autoSubmit || !adapter.submitSelector) throw new Error('Portal policy forbids submission');
      if (!verifiedExpected || !await verifyFilled(verifiedExpected)) throw new Error('Every live field requires verified value or empty state before the click');
      const button = page.locator(adapter.submitSelector);
      if (await button.count() !== 1 || !await button.isVisible() || !await button.isEnabled()) throw new Error('Unique enabled submit control not found');
      await button.click({ noWaitAfter: true });
      if (adapter.receiptSelector) await page.locator(adapter.receiptSelector).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return snapshot();
    }
    return { adapter, session, fields, fill, clear, upload, complete, verifyFilled, snapshot, submit, inPlaceEvidence,
      showQuestion: async question => {
        const normalize = value => String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
        const matches = (await fields()).filter(field => {
          const classified = classifyQuestion(field, job);
          return normalize(field.question) === normalize(question.question_text) && field.controlType === question.control_type
            && JSON.stringify(field.options.map(normalize).sort()) === JSON.stringify(question.options.map(normalize).sort())
            && Object.entries(question.context || {}).every(([key, value]) => classified.context[key] === value);
        });
        if (matches.length !== 1) return false;
        const { locator } = await observedLocator(matches[0]);
        await locator.scrollIntoViewIfNeeded(); await page.bringToFront();
        return true;
      },
      waitForReview: async ({ signal, timeoutMs = 180000 } = {}) => {
        const start = Date.now(), bounded = Math.max(1, Math.min(180000, timeoutMs));
        while (!signal?.aborted && !page.isClosed() && Date.now() - start < bounded) await new Promise(resolve => setTimeout(resolve, 100));
      },
      close: async () => { await page.close().catch(() => {}); active.delete(page); },
      waitForLogin: async ({ signal, timeoutMs = 180000 } = {}) => {
        const start = Date.now(), bounded = Math.max(1, Math.min(180000, timeoutMs));
        while (!signal?.aborted && Date.now() - start < bounded && !page.isClosed()) {
          // Human sign-in may navigate away; return to the requested exact job only after positive auth markers.
          const hasAuth = await Promise.all(adapter.authenticatedSelectors.map(s => page.locator(s).isVisible().catch(() => false)));
          if (hasAuth.some(Boolean) && canonicalUrl(page.url(), job.jobUrl) !== job.jobUrl) await page.goto(realUrl(job.jobUrl), { waitUntil: 'domcontentloaded' });
          const check = await session().catch(() => ({ ok: false }));
          if (check.ok) return check;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return { ok: false, reason: 'Sign-in was not verified within the bounded window' };
      } };
  }
  return { open,
    login: async (job, options = {}) => {
      // Once headed, independent task tabs reuse this same binding profile without a mode switch.
      const handle = await open(job, { headed: true });
      try { return await handle.waitForLogin(options); } finally { await handle.close(); }
    },
    review: async (job, question, options = {}) => {
      const handle = await open(job, { headed: true });
      try {
        const session = await handle.session();
        if (!session.ok || !await handle.showQuestion(question)) return { opened: false };
        await handle.waitForReview(options);
        return { opened: true };
      } finally { await handle.close(); }
    },
    close: () => exclusive(async () => {
      for (const page of active) await page.close().catch(() => {});
      active.clear(); if (browser) await browser.cleanup(); browser = null;
    }) };
}
