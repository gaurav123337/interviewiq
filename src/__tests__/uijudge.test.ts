// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { runUiInDoc } from "../services/runner";

/* jsdom can't load srcdoc iframes, so the tests exercise the judge CORE
   (runUiInDoc) against the test document; the production iframe wrapper around
   it is verified in the live browser. The reference bank self-test uses the
   same core, so every UI problem is still machine-verified. */
describe("UI judge core", () => {
  it("renders HTML/CSS/JS and passes DOM assertions", async () => {
    const html = `<button id="btn">0</button>`;
    const css = `#btn { color: rgb(1, 2, 3); }`;
    const js = `document.querySelector('#btn').addEventListener('click', () => {\n  const b = document.querySelector('#btn');\n  b.textContent = Number(b.textContent) + 1;\n});`;
    const results = await runUiInDoc(document, html, css, js, [
      { label: "starts at 0", check: `return document.querySelector('#btn').textContent === '0';` },
      { label: "increments on click", check: `document.querySelector('#btn').click(); await sleep(20); return document.querySelector('#btn').textContent === '1';` },
      { label: "computed style applies", check: `return getComputedStyle(document.querySelector('#btn')).color === 'rgb(1, 2, 3)';` }
    ]);
    expect(results.map(r => ({ pass: r.pass, error: r.error }))).toEqual([
      { pass: true, error: undefined },
      { pass: true, error: undefined },
      { pass: true, error: undefined }
    ]);
  });

  it("reports failing assertions with the check label", async () => {
    const results = await runUiInDoc(document, `<p id="x">hi</p>`, "", "", [
      { label: "wrong text", check: `return document.querySelector('#x').textContent === 'bye';` }
    ]);
    expect(results[0].pass).toBe(false);
  });

  it("surfaces errors thrown inside the checked code", async () => {
    const results = await runUiInDoc(document, `<p id="x">hi</p>`, "", "", [
      { label: "missing element", check: `return document.querySelector('#nope').textContent === 'x';` }
    ]);
    expect(results[0].pass).toBe(false);
    expect(results[0].error).toBeTruthy();
  });

  it("cleans up the injected DOM between runs", async () => {
    await runUiInDoc(document, `<span id="z">1</span>`, "", "", [
      { label: "exists", check: `return !!document.querySelector('#z');` }
    ]);
    expect(document.querySelector("#__ui-judge-root")).toBeNull();
    expect(document.querySelector("#z")).toBeNull();
  });
});
