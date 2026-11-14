/* A synthetic human actor, never imported by production. Actual worker main,
 * actual headed Playwright, same ephemeral binding profile and fixed local DOM. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { main } from '../../scripts/apply-pipeline-worker.js';
assert.equal(process.env.INTERVIEWIQ_APPLY_SYNTHETIC, '1');
const origin = new URL(process.env.INTERVIEWIQ_APPLY_FIXTURE_ORIGIN);
assert.equal(origin.hostname, '127.0.0.1'); assert.equal(origin.protocol, 'http:');
const launch = chromium.launchPersistentContext.bind(chromium);
let headed = 0, actorOrdinal = 0;
chromium.launchPersistentContext = async (profilePath, options) => {
  const context = await launch(profilePath, options);
  if (options.headless === false) {
    headed++;
    const act = async page => {
      // Xvfb has no window manager to focus new tabs; keep real actionability checks enabled.
      await page.bringToFront();
      if (process.env.INTERVIEWIQ_APPLY_FIXTURE_MODE === 'review') {
        await page.waitForURL(url => url.origin === origin.origin && /^\/fixture\/jobs\/\d+$/.test(url.pathname), { timeout: 20000 });
        const legal = page.getByLabel('I agree to these exact terms', { exact: true });
        await legal.waitFor(); await new Promise(resolve => setTimeout(resolve, 1500));
        assert.equal(await legal.isChecked(), false);
        assert.equal(await page.getByLabel('First name', { exact: true }).inputValue(), '');
        console.log(JSON.stringify({ syntheticActor: 'headed_review', at: new Date().toISOString() }));
        await page.close(); return;
      }
      await page.waitForURL(url => url.origin === origin.origin && url.pathname.startsWith('/job-listings-'), { timeout: 20000 });
      await page.waitForLoadState('domcontentloaded');
      await page.getByRole('heading', { name: 'Synthetic candidate sign-in', exact: true }).waitFor();
      const ordinal = ++actorOrdinal;
      // Separate explicit fixture sign-in pages reuse the same headed binding profile.
      const account = ordinal === 1 ? 'wrong@example.invalid' : 'fixture@example.invalid';
      await new Promise(resolve => setTimeout(resolve, ordinal === 1 ? 8000 : 100));
      await page.bringToFront();
      await page.getByLabel('Email', { exact: true }).fill(account);
      await page.getByLabel('Fixture password', { exact: true }).fill('synthetic-not-a-secret');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      console.log(JSON.stringify({ syntheticActor: 'headed_signin', ordinal, headedLaunches: headed, at: new Date().toISOString() }));
    };
    context.on('page', page => { act(page).catch(() => {}); });
  }
  return context;
};
await main();
