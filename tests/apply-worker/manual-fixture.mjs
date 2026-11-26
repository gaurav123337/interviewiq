/* Loopback-only manual browser gate: a separate synthetic human actor applies.
 * The actual portal manual method must never fill, upload or click itself. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { createPortalBrowser } from '../../scripts/apply-portal-adapters.js';

process.env.INTERVIEWIQ_APPLY_SYNTHETIC = '1';
const jobUrl = 'https://boards.greenhouse.io/fixture/jobs/1';
const job = { jobUrl, title: 'Software Engineer', company: 'Fixture', skills: ['JavaScript'],
  description: 'JavaScript required.', location: 'Remote' };
let posts = 0, staleProbeScenario = false;
const server = createServer((request, response) => {
  if (request.method === 'POST') posts++;
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(request.method === 'POST'
    ? `<a href="mailto:fixture@example.invalid">Account</a>${staleProbeScenario ? '<input type="password" aria-label="Sign in required">' : '<form><label for="first_name">Full name</label><input id="first_name" name="name" required></form>'}<div id="application_confirmation">Application submitted.</div>`
    : '<a href="mailto:fixture@example.invalid">Account</a><form method="post"><label for="first_name">Full name</label><input id="first_name" name="name" required><button id="submit_app" type="submit">Submit</button></form>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const fixtureOrigin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const portal = createPortalBrowser({ mode: 'paired' }, { fixtureOrigin,
  acquire: async () => ({ ctx: context, cleanup: async () => context.close() }) });
try {
  assert.equal(typeof portal.manual, 'function', 'Manual browser operation must be implemented');
  const unopened = await portal.manual(job, { timeoutMs: 150 });
  assert.equal(unopened.opened, true);
  assert.equal(unopened.after, undefined);
  assert.equal(posts, 0, 'Opening manually must not submit a form');
  const resultPromise = portal.manual(job, { timeoutMs: 10000 });
  let page;
  for (let i = 0; i < 100; i++) {
    page = context.pages()[0];
    if (page && await page.locator('#first_name').count()) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert(page, 'The manual exact-job tab must open');
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal(await page.locator('#first_name').inputValue(), '', 'Manual operation leaves unconfirmed fields untouched');
  assert.equal(posts, 0, 'No browser submit before the synthetic human act');
  await page.locator('#first_name').fill('Synthetic human');
  await page.locator('#submit_app').click();
  const observed = await resultPromise;
  assert.equal(posts, 1, 'Only the separate synthetic human submits');
  assert.equal(observed.before.receipt, null);
  assert.equal(observed.before.accountIdentity, 'fixture@example.invalid');
  assert.equal(observed.after.accountIdentity, observed.before.accountIdentity);
  assert.equal(observed.after.receipt.selector, '#application_confirmation');
  assert.equal(observed.after.receipt.text, 'Application submitted.');
  assert.equal(observed.after.jobUrl, jobUrl);
  assert.equal(observed.before.session.ok, true);
  assert.equal(observed.after.session.ok, true);
  staleProbeScenario = true;
  const stalePromise = portal.manual(job, { timeoutMs: 10000 });
  for (let i = 0; i < 100; i++) {
    page = context.pages()[0];
    if (page && await page.locator('#first_name').count()) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await new Promise(resolve => setTimeout(resolve, 600));
  await page.locator('#first_name').fill('Synthetic human');
  await page.locator('#submit_app').click();
  const stale = await stalePromise;
  assert.equal(stale.after, undefined, 'A failed current session probe cannot inherit an earlier authentication success');
  console.log(JSON.stringify({ passed: true, manualOpenPosts: 0, humanPosts: posts, independentReceipt: true, staleSessionCredit: false }));
} finally {
  await portal.close(); await browser.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
