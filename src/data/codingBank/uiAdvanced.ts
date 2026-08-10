/* Advanced UI component bank — the next tier of frontend challenges: toast
   systems, drag-and-drop, virtualization, OTP inputs and more. Judged by the
   same sandboxed iframe engine (runUiTests) as the core bank.

   jsdom constraints the assertions must respect (the bank self-test runs them
   through the judge core in jsdom):
     - DragEvent is undefined → checks construct it with a guarded fallback and
       attach a fake dataTransfer via defineProperty (works in real browsers too).
     - No layout → offsetHeight/getBoundingClientRect are 0, so the virtual-list
       problem uses a fixed ROW height + scrollTop (a plain property).

   Every problem carries a `reference` implementation validated by the bank
   self-test (src/__tests__/uicomponents.test.ts). */

import type { UiProblem } from "../coding";

const JS_SKELETON = `// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`;

export const UI_ADVANCED_PROBLEMS: UiProblem[] = [
  {
    kind: "ui",
    id: "ui-toast",
    title: "Toast Notifications",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a toast system: clicking “Show toast” appends a toast with the message; toasts auto-dismiss after 1 second; each toast has a close button; “Clear all” removes every toast.",
    html: `<div class="toast-wrap">
  <div id="toast-host" class="toast-host"></div>
  <div class="toast-controls">
    <button id="toast-show">Show toast</button>
    <button id="toast-clear">Clear all</button>
  </div>
</div>`,
    css: `.toast-host { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; font-family: system-ui; }
.toast { display: flex; align-items: center; gap: 10px; background: #1e293b; color: #f8fafc; padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; min-width: 180px; }
.toast .t-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: auto; }
.toast-controls { margin-top: 120px; font-family: system-ui; }
.toast-controls button { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "no toasts initially", check: `return document.querySelectorAll('.toast').length === 0;` },
      { label: "showing a toast appends it", check: `document.querySelector('#toast-show').click(); await sleep(20); const ts = document.querySelectorAll('.toast'); return ts.length === 1 && ts[0].textContent.includes('Saved');` },
      { label: "multiple toasts stack", check: `document.querySelector('#toast-show').click(); document.querySelector('#toast-show').click(); await sleep(20); return document.querySelectorAll('.toast').length === 3;` },
      { label: "close removes a single toast", check: `document.querySelector('.toast .t-close').click(); await sleep(20); return document.querySelectorAll('.toast').length === 2;` }
    ],
    hiddenAssertions: [
      { label: "toasts auto-dismiss after 1s", check: `await sleep(1100); return document.querySelectorAll('.toast').length === 0;` },
      { label: "clear-all removes everything", check: `document.querySelector('#toast-show').click(); document.querySelector('#toast-show').click(); await sleep(20); document.querySelector('#toast-clear').click(); await sleep(20); return document.querySelectorAll('.toast').length === 0;` }
    ],
    hint: "Append a toast element with its own close listener and a setTimeout that removes it after 1s; Clear all empties the host.",
    reference: {
      html: `<div class="toast-wrap">
  <div id="toast-host" class="toast-host"></div>
  <div class="toast-controls">
    <button id="toast-show">Show toast</button>
    <button id="toast-clear">Clear all</button>
  </div>
</div>`,
      css: `.toast-host { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; font-family: system-ui; }
.toast { display: flex; align-items: center; gap: 10px; background: #1e293b; color: #f8fafc; padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; min-width: 180px; }
.toast .t-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: auto; }
.toast-controls { margin-top: 120px; font-family: system-ui; }
.toast-controls button { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,
      js: `const host = document.querySelector('#toast-host');
const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
document.querySelector('#toast-show').addEventListener('click', () => {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + esc('Saved!') + '</span><button class="t-close" aria-label="Dismiss">✕</button>';
  t.querySelector('.t-close').addEventListener('click', () => t.remove());
  host.appendChild(t);
  setTimeout(() => t.remove(), 1000);
});
document.querySelector('#toast-clear').addEventListener('click', () => { host.innerHTML = ''; });`
    }
  },
  {
    kind: "ui",
    id: "ui-tooltip",
    title: "Tooltip",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a tooltip: hovering the trigger shows the tooltip, moving the mouse away hides it. It must also open on keyboard focus and close on blur (accessibility).",
    html: `<div class="tip-wrap">
  <button id="tip-btn" aria-describedby="tip">Hover me</button>
  <div id="tip" class="tip" hidden>More information about this action.</div>
</div>`,
    css: `.tip-wrap { position: relative; display: inline-block; font-family: system-ui; padding-top: 40px; }
#tip-btn { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.tip { position: absolute; top: 0; left: 0; background: #1e293b; color: #f8fafc; padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "hidden initially", check: `return document.querySelector('#tip').hidden === true;` },
      { label: "hover shows it", check: `document.querySelector('#tip-btn').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(20); return document.querySelector('#tip').hidden === false;` },
      { label: "mouse-out hides it", check: `document.querySelector('#tip-btn').dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); await sleep(20); return document.querySelector('#tip').hidden === true;` }
    ],
    hiddenAssertions: [
      { label: "keyboard focus opens it", check: `document.querySelector('#tip-btn').dispatchEvent(new FocusEvent('focus')); await sleep(20); return document.querySelector('#tip').hidden === false;` }
    ],
    hint: "Four listeners on the trigger: mouseover/focus show, mouseout/blur hide.",
    reference: {
      html: `<div class="tip-wrap">
  <button id="tip-btn" aria-describedby="tip">Hover me</button>
  <div id="tip" class="tip" hidden>More information about this action.</div>
</div>`,
      css: `.tip-wrap { position: relative; display: inline-block; font-family: system-ui; padding-top: 40px; }
#tip-btn { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.tip { position: absolute; top: 0; left: 0; background: #1e293b; color: #f8fafc; padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; }`,
      js: `const btn = document.querySelector('#tip-btn');
const tip = document.querySelector('#tip');
btn.addEventListener('mouseover', () => { tip.hidden = false; });
btn.addEventListener('mouseout', () => { tip.hidden = true; });
btn.addEventListener('focus', () => { tip.hidden = false; });
btn.addEventListener('blur', () => { tip.hidden = true; });`
    }
  },
  {
    kind: "ui",
    id: "ui-tags-input",
    title: "Tag Input",
    difficulty: 2,
    category: "forms",
    prompt: "Build a tag input: pressing Enter turns the typed text into a chip, empty and duplicate tags are ignored, and each chip has a ✕ button that removes it.",
    html: `<div class="tags-wrap">
  <div id="tag-list" class="tag-list"></div>
  <input id="tag-input" placeholder="Type a tag and press Enter" autocomplete="off" />
</div>`,
    css: `.tags-wrap { max-width: 360px; font-family: system-ui; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 30px; }
.tag { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag .t-x { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
#tag-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; font-family: system-ui; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts with no tags", check: `return document.querySelectorAll('.tag').length === 0;` },
      { label: "Enter adds a chip", check: `const input = document.querySelector('#tag-input'); input.value = 'react'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); const tags = [...document.querySelectorAll('.tag')]; return tags.length === 1 && tags[0].textContent.includes('react');` },
      { label: "duplicates are ignored", check: `const input = document.querySelector('#tag-input'); input.value = 'react'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); return document.querySelectorAll('.tag').length === 1;` },
      { label: "✕ removes a chip", check: `document.querySelector('.tag .t-x').click(); await sleep(20); return document.querySelectorAll('.tag').length === 0;` }
    ],
    hiddenAssertions: [
      { label: "multiple tags accumulate", check: `const input = document.querySelector('#tag-input'); input.value = 'vue'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); input.value = 'svelte'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); const labels = [...document.querySelectorAll('.tag')].map(t => t.textContent); return labels.length === 2 && labels.some(l => l.includes('vue')) && labels.some(l => l.includes('svelte'));` }
    ],
    hint: "On Enter: trim the value, bail on empty or existing tag, append a chip with its own remove listener, then clear the input.",
    reference: {
      html: `<div class="tags-wrap">
  <div id="tag-list" class="tag-list"></div>
  <input id="tag-input" placeholder="Type a tag and press Enter" autocomplete="off" />
</div>`,
      css: `.tags-wrap { max-width: 360px; font-family: system-ui; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 30px; }
.tag { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag .t-x { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
#tag-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; font-family: system-ui; }`,
      js: `const input = document.querySelector('#tag-input');
const list = document.querySelector('#tag-list');
const tags = () => [...document.querySelectorAll('.tag')].map(t => t.dataset.tag);
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const value = input.value.trim();
  if (!value || tags().includes(value)) return;
  const chip = document.createElement('span');
  chip.className = 'tag';
  chip.dataset.tag = value;
  chip.innerHTML = value + ' <button class="t-x" aria-label="Remove">✕</button>';
  chip.querySelector('.t-x').addEventListener('click', () => chip.remove());
  list.appendChild(chip);
  input.value = '';
});`
    }
  },
  {
    kind: "ui",
    id: "ui-stepper",
    title: "Multi-step Wizard",
    difficulty: 2,
    category: "forms",
    prompt: "Build a 3-step wizard: Next advances (blocked on step 1 until the name field is filled), Back returns to the previous step, and reaching the last step shows the summary panel. The indicator must show the current step.",
    html: `<div class="stepper">
  <div class="step-indicator" data-step="1">Step <span id="step-num">1</span> of 3</div>
  <div class="step-panel" data-step="1">
    <label for="s-input">Your name</label>
    <input id="s-input" placeholder="Ada Lovelace" autocomplete="off" />
  </div>
  <div class="step-panel" data-step="2">
    <p>Pick a focus area.</p>
    <select id="s-focus"><option>Frontend</option><option>Backend</option><option>Full-stack</option></select>
  </div>
  <div class="step-panel" data-step="3">
    <p class="stepper-done">🎉 You're all set — review and finish.</p>
  </div>
  <div class="stepper-nav">
    <button id="back">Back</button>
    <button id="next">Next</button>
  </div>
</div>`,
    css: `.stepper { max-width: 380px; font-family: system-ui; }
.step-indicator { font-weight: 700; margin-bottom: 12px; font-size: 13px; color: #6366f1; }
.step-panel { display: none; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px; min-height: 90px; }
.step-panel[data-step="1"] { display: block; }
#s-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; margin-top: 6px; font-family: system-ui; }
.stepper-nav { display: flex; gap: 8px; }
.stepper-nav button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "step 1 visible initially", check: `return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none' && getComputedStyle(document.querySelector('.step-panel[data-step="2"]')).display === 'none';` },
      { label: "Next is blocked without a name", check: `document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '1';` },
      { label: "a valid name advances", check: `document.querySelector('#s-input').value = 'Ada'; document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="2"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '2';` },
      { label: "Back returns to step 1", check: `document.querySelector('#back').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none';` }
    ],
    hiddenAssertions: [
      { label: "reaching the last step shows the summary", check: `document.querySelector('#s-input').value = 'Ada'; document.querySelector('#next').click(); document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="3"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '3';` }
    ],
    hint: "Keep a step index; Next validates the name on step 1, moves the index, and toggles panel display + the indicator number.",
    reference: {
      html: `<div class="stepper">
  <div class="step-indicator" data-step="1">Step <span id="step-num">1</span> of 3</div>
  <div class="step-panel" data-step="1">
    <label for="s-input">Your name</label>
    <input id="s-input" placeholder="Ada Lovelace" autocomplete="off" />
  </div>
  <div class="step-panel" data-step="2">
    <p>Pick a focus area.</p>
    <select id="s-focus"><option>Frontend</option><option>Backend</option><option>Full-stack</option></select>
  </div>
  <div class="step-panel" data-step="3">
    <p class="stepper-done">🎉 You're all set — review and finish.</p>
  </div>
  <div class="stepper-nav">
    <button id="back">Back</button>
    <button id="next">Next</button>
  </div>
</div>`,
      css: `.stepper { max-width: 380px; font-family: system-ui; }
.step-indicator { font-weight: 700; margin-bottom: 12px; font-size: 13px; color: #6366f1; }
.step-panel { display: none; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px; min-height: 90px; }
.step-panel[data-step="1"] { display: block; }
#s-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; margin-top: 6px; font-family: system-ui; }
.stepper-nav { display: flex; gap: 8px; }
.stepper-nav button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,
      js: `const panels = [...document.querySelectorAll('.step-panel')];
const input = document.querySelector('#s-input');
let step = 0;
const show = () => {
  panels.forEach((p, i) => { p.style.display = i === step ? 'block' : 'none'; });
  document.querySelector('#step-num').textContent = String(step + 1);
  document.querySelector('.step-indicator').dataset.step = String(step + 1);
  document.querySelector('#back').disabled = step === 0;
  document.querySelector('#next').textContent = step === panels.length - 1 ? 'Finish' : 'Next';
};
document.querySelector('#next').addEventListener('click', () => {
  if (step === 0 && !input.value.trim()) return;
  if (step < panels.length - 1) step++;
  show();
});
document.querySelector('#back').addEventListener('click', () => {
  if (step > 0) step--;
  show();
});
show();`
    }
  },
  {
    kind: "ui",
    id: "ui-otp-input",
    title: "OTP Input",
    difficulty: 2,
    category: "forms",
    prompt: "Build a 4-digit OTP input: typing a digit fills the current box and moves focus to the next, Backspace on an empty box moves focus back, and the full code is written to #otp-wrap's data-code attribute.",
    html: `<div id="otp-wrap" class="otp-wrap" data-code="">
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 1" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 2" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 3" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 4" />
</div>`,
    css: `.otp-wrap { display: flex; gap: 10px; font-family: system-ui; }
.otp { width: 52px; height: 56px; text-align: center; font-size: 22px; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "all boxes start empty", check: `return [...document.querySelectorAll('.otp')].every(i => i.value === '');` },
      { label: "typing fills a box and advances focus", check: `const boxes = document.querySelectorAll('.otp'); boxes[0].value = '1'; boxes[0].dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return boxes[0].value === '1' && document.activeElement === boxes[1];` },
      { label: "the full code is collected", check: `const boxes = document.querySelectorAll('.otp'); boxes.forEach((b, i) => { b.value = String(i + 1); b.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(20); return document.querySelector('#otp-wrap').dataset.code === '1234';` }
    ],
    hiddenAssertions: [
      { label: "backspace on an empty box moves back", check: `const boxes = document.querySelectorAll('.otp'); boxes[0].value = ''; boxes[1].value = ''; boxes[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); await sleep(20); return document.activeElement === boxes[0];` }
    ],
    hint: "On input: keep one digit, focus the next box, and recompute data-code from all boxes. On Backspace of an empty box, focus the previous one.",
    reference: {
      html: `<div id="otp-wrap" class="otp-wrap" data-code="">
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 1" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 2" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 3" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 4" />
</div>`,
      css: `.otp-wrap { display: flex; gap: 10px; font-family: system-ui; }
.otp { width: 52px; height: 56px; text-align: center; font-size: 22px; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }`,
      js: `const wrap = document.querySelector('#otp-wrap');
const boxes = [...document.querySelectorAll('.otp')];
boxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\\D/g, '').slice(0, 1);
    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    wrap.dataset.code = boxes.map(b => b.value).join('');
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
  });
});`
    }
  },
  {
    kind: "ui",
    id: "ui-drag-drop",
    title: "Drag-and-drop Sortable List",
    difficulty: 3,
    category: "interaction",
    prompt: "Build a sortable list using HTML5 drag-and-drop: dragging an item and dropping it onto another moves it to that position (inserted before the drop target). The dragged item gets a .dragging class while being dragged, removed on dragend.",
    html: `<ul id="dd-list" class="dd-list">
  <li class="dd-item" draggable="true" data-id="A">Item A</li>
  <li class="dd-item" draggable="true" data-id="B">Item B</li>
  <li class="dd-item" draggable="true" data-id="C">Item C</li>
  <li class="dd-item" draggable="true" data-id="D">Item D</li>
</ul>`,
    css: `.dd-list { list-style: none; padding: 0; margin: 0; max-width: 320px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.dd-item { padding: 12px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; cursor: grab; }
.dd-item.dragging { opacity: .5; border-style: dashed; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts in order A B C D", check: `return [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id).join(',') === 'A,B,C,D';` },
      { label: "dragging A onto C reorders", check: `const order = () => [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id);
const dt = { effectAllowed: 'move', _d: {}, setData(k, v) { this._d[k] = v; }, getData(k) { return this._d[k] || ''; } };
const fire = (el, type) => { let e; try { e = new DragEvent(type, { bubbles: true, cancelable: true }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); } Object.defineProperty(e, 'dataTransfer', { value: dt }); el.dispatchEvent(e); };
const items = document.querySelectorAll('.dd-item');
fire(items[0], 'dragstart');
fire(items[2], 'dragover');
fire(items[2], 'drop');
fire(items[0], 'dragend');
await sleep(20);
return order().join(',') === 'B,A,C,D';` }
    ],
    hiddenAssertions: [
      { label: "dragging C onto A moves it to the front", check: `const order = () => [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id);
const dt = { effectAllowed: 'move', _d: {}, setData(k, v) { this._d[k] = v; }, getData(k) { return this._d[k] || ''; } };
const fire = (el, type) => { let e; try { e = new DragEvent(type, { bubbles: true, cancelable: true }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); } Object.defineProperty(e, 'dataTransfer', { value: dt }); el.dispatchEvent(e); };
const from = [...document.querySelectorAll('.dd-item')].find(li => li.dataset.id === 'C');
const to = [...document.querySelectorAll('.dd-item')].find(li => li.dataset.id === 'A');
fire(from, 'dragstart');
fire(to, 'dragover');
fire(to, 'drop');
fire(from, 'dragend');
await sleep(20);
return order().join(',') === 'B,C,A,D' && !document.querySelector('.dd-item.dragging');` }
    ],
    hint: "On dragstart store the dragged element + setData; on dragover preventDefault (required for drop); on drop insertBefore(dragged, target); on dragend clear the .dragging class.",
    reference: {
      html: `<ul id="dd-list" class="dd-list">
  <li class="dd-item" draggable="true" data-id="A">Item A</li>
  <li class="dd-item" draggable="true" data-id="B">Item B</li>
  <li class="dd-item" draggable="true" data-id="C">Item C</li>
  <li class="dd-item" draggable="true" data-id="D">Item D</li>
</ul>`,
      css: `.dd-list { list-style: none; padding: 0; margin: 0; max-width: 320px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.dd-item { padding: 12px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; cursor: grab; }
.dd-item.dragging { opacity: .5; border-style: dashed; }`,
      js: `let dragged = null;
document.querySelectorAll('.dd-item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    dragged = item;
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  item.addEventListener('dragover', (e) => { e.preventDefault(); });
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragged || dragged === item) return;
    item.parentNode.insertBefore(dragged, item);
  });
  item.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('dragging');
    dragged = null;
  });
});`
    }
  },
  {
    kind: "ui",
    id: "ui-virtual-list",
    title: "Virtualized List",
    difficulty: 3,
    category: "performance",
    prompt: "Build a virtualized list: render 1000 items but keep only the visible window in the DOM (≤ 15 rows). Rows are 24px tall in a 200px viewport. Scrolling must re-render the window, and the total must be exposed in #vlist's data-total.",
    html: `<div id="vlist" class="vlist" style="height:200px;overflow:auto;position:relative"></div>`,
    css: `.vlist { max-width: 360px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: system-ui; }
.row { position: absolute; left: 0; right: 0; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "DOM stays bounded and starts at row 0", check: `const rows = document.querySelectorAll('#vlist .row'); return rows.length > 0 && rows.length <= 15 && rows[0].dataset.index === '0' && document.querySelector('#vlist').dataset.total === '1000';` },
      { label: "scrolling moves the visible window", check: `const list = document.querySelector('#vlist'); list.scrollTop = 480; list.dispatchEvent(new Event('scroll')); await sleep(20); const rows = document.querySelectorAll('#vlist .row'); const first = Number(rows[0].dataset.index); return rows.length <= 15 && first >= 10 && first <= 60;` }
    ],
    hiddenAssertions: [
      { label: "near the end the last rows render", check: `const list = document.querySelector('#vlist'); list.scrollTop = 23800; list.dispatchEvent(new Event('scroll')); await sleep(20); const rows = document.querySelectorAll('#vlist .row'); const last = Number(rows[rows.length - 1].dataset.index); return rows.length <= 15 && last >= 990;` }
    ],
    hint: "On init and scroll: compute start = floor(scrollTop / 24) − 2, render only start..start+visible, position each row at top = i * 24.",
    reference: {
      html: `<div id="vlist" class="vlist" style="height:200px;overflow:auto;position:relative"></div>`,
      css: `.vlist { max-width: 360px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: system-ui; }
.row { position: absolute; left: 0; right: 0; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; }`,
      js: `const list = document.getElementById('vlist');
const TOTAL = 1000, ROW = 24, BUFFER = 2;
list.dataset.total = String(TOTAL);
const render = () => {
  const start = Math.max(0, Math.floor(list.scrollTop / ROW) - BUFFER);
  const visible = Math.ceil(200 / ROW) + BUFFER * 2;
  const end = Math.min(TOTAL, start + visible);
  list.innerHTML = '';
  for (let i = start; i < end; i++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.index = String(i);
    row.style.cssText = 'position:absolute;top:' + (i * ROW) + 'px;height:' + ROW + 'px;';
    row.textContent = 'Row ' + i;
    list.appendChild(row);
  }
};
list.addEventListener('scroll', render);
render();`
    }
  },
  {
    kind: "ui",
    id: "ui-countdown",
    title: "Countdown Timer",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a countdown timer starting at 5 seconds: Start begins counting down by one each second (display never goes below 0), Pause freezes it, Reset returns it to 5.",
    html: `<div class="cd-wrap">
  <div id="cd-display" class="cd-display">5</div>
  <div class="cd-controls">
    <button id="cd-start">Start</button>
    <button id="cd-pause">Pause</button>
    <button id="cd-reset">Reset</button>
  </div>
</div>`,
    css: `.cd-wrap { text-align: center; font-family: system-ui; }
.cd-display { font-size: 56px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: 12px; }
.cd-controls { display: flex; gap: 8px; justify-content: center; }
.cd-controls button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts at 5", check: `return document.querySelector('#cd-display').textContent.trim() === '5';` },
      { label: "Start counts down", check: `document.querySelector('#cd-start').click(); await sleep(1200); return Number(document.querySelector('#cd-display').textContent.trim()) < 5;` },
      { label: "Pause freezes the countdown", check: `document.querySelector('#cd-pause').click(); const v = Number(document.querySelector('#cd-display').textContent.trim()); await sleep(1000); return Number(document.querySelector('#cd-display').textContent.trim()) === v;` }
    ],
    hiddenAssertions: [
      { label: "Reset returns to 5", check: `document.querySelector('#cd-reset').click(); await sleep(20); return document.querySelector('#cd-display').textContent.trim() === '5';` }
    ],
    hint: "setInterval decrements every second while running; Pause clears the interval; Reset clears it and restores 5.",
    reference: {
      html: `<div class="cd-wrap">
  <div id="cd-display" class="cd-display">5</div>
  <div class="cd-controls">
    <button id="cd-start">Start</button>
    <button id="cd-pause">Pause</button>
    <button id="cd-reset">Reset</button>
  </div>
</div>`,
      css: `.cd-wrap { text-align: center; font-family: system-ui; }
.cd-display { font-size: 56px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: 12px; }
.cd-controls { display: flex; gap: 8px; justify-content: center; }
.cd-controls button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,
      js: `const display = document.querySelector('#cd-display');
let seconds = 5, timer = null;
const render = () => { display.textContent = String(seconds); };
document.querySelector('#cd-start').addEventListener('click', () => {
  if (timer) return;
  timer = setInterval(() => {
    seconds = Math.max(0, seconds - 1);
    render();
    if (seconds === 0) { clearInterval(timer); timer = null; }
  }, 1000);
});
document.querySelector('#cd-pause').addEventListener('click', () => { clearInterval(timer); timer = null; });
document.querySelector('#cd-reset').addEventListener('click', () => { clearInterval(timer); timer = null; seconds = 5; render(); });
render();`
    }
  },
  {
    kind: "ui",
    id: "ui-theme-toggle",
    title: "Theme Toggle",
    difficulty: 1,
    category: "interaction",
    prompt: "Build a light/dark theme toggle: clicking the button toggles the .dark class on <body>, persists the choice to localStorage (key: theme, values light/dark — the judge sandbox blocks storage, so keep it best-effort), and reflects the state in the button's aria-pressed and data-theme attributes.",
    html: `<div class="theme-wrap">
  <button id="theme-btn" aria-pressed="false">🌙 Dark mode</button>
  <p class="theme-note">The page should switch between light and dark when toggled.</p>
</div>`,
    css: `.theme-wrap { font-family: system-ui; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 320px; }
#theme-btn { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; cursor: pointer; font-weight: 700; font-family: system-ui; }
body.dark { background: #0f172a; }
body.dark .theme-wrap { border-color: #334155; }
body.dark .theme-note { color: #e2e8f0; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts in light mode", check: `return !document.body.classList.contains('dark');` },
      { label: "clicking toggles to dark", check: `document.querySelector('#theme-btn').click(); await sleep(20); return document.body.classList.contains('dark') && document.querySelector('#theme-btn').getAttribute('aria-pressed') === 'true';` },
      { label: "clicking again returns to light", check: `document.querySelector('#theme-btn').click(); await sleep(20); return !document.body.classList.contains('dark') && document.querySelector('#theme-btn').getAttribute('aria-pressed') === 'false';` }
    ],
    hiddenAssertions: [
      /* localStorage is realm-isolated in jsdom, so the check reads the DOM mirror (data-theme) —
         the user's implementation must still write localStorage for real-world persistence. */
      { label: "the state is tracked on the button", check: `document.querySelector('#theme-btn').click(); await sleep(20); return document.querySelector('#theme-btn').dataset.theme === 'dark' && document.body.classList.contains('dark');` }
    ],
    hint: "Toggle the body class, mirror it in aria-pressed and localStorage on every click.",
    reference: {
      html: `<div class="theme-wrap">
  <button id="theme-btn" aria-pressed="false">🌙 Dark mode</button>
  <p class="theme-note">The page should switch between light and dark when toggled.</p>
</div>`,
      css: `.theme-wrap { font-family: system-ui; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 320px; }
#theme-btn { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; cursor: pointer; font-weight: 700; font-family: system-ui; }
body.dark { background: #0f172a; }
body.dark .theme-wrap { border-color: #334155; }
body.dark .theme-note { color: #e2e8f0; }`,
      js: `const btn = document.querySelector('#theme-btn');
const save = (v) => { try { localStorage.setItem('theme', v); } catch { /* opaque-origin sandbox has no storage — best-effort */ } };
const apply = (dark) => {
  document.body.classList.toggle('dark', dark);
  btn.setAttribute('aria-pressed', String(dark));
  btn.dataset.theme = dark ? 'dark' : 'light';
  btn.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode';
  save(dark ? 'dark' : 'light');
};
try { apply(localStorage.getItem('theme') === 'dark'); } catch { apply(false); }
btn.addEventListener('click', () => apply(!document.body.classList.contains('dark')));`
    }
  },
  {
    kind: "ui",
    id: "ui-slider",
    title: "Range Slider",
    difficulty: 2,
    category: "forms",
    prompt: "Build a range slider: dragging (or changing) the slider updates the fill bar width to the same percentage and shows the numeric value in the label.",
    html: `<div class="slider-wrap">
  <div class="slider-track"><div id="s-fill" class="slider-fill" style="width:0%"></div></div>
  <input id="range" type="range" min="0" max="100" value="0" />
  <div class="slider-value">Value: <span id="s-val">0</span></div>
</div>`,
    css: `.slider-wrap { max-width: 340px; font-family: system-ui; }
.slider-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.slider-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); }
#range { width: 100%; margin: 12px 0 6px; }
.slider-value { font-size: 13px; font-weight: 700; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts at 0", check: `return document.querySelector('#s-val').textContent.trim() === '0' && document.querySelector('#s-fill').style.width === '0%';` },
      { label: "moving the slider updates fill + label", check: `const range = document.querySelector('#range'); range.value = '60'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#s-val').textContent.trim() === '60' && document.querySelector('#s-fill').style.width === '60%';` }
    ],
    hiddenAssertions: [
      { label: "maxing out fills the bar", check: `const range = document.querySelector('#range'); range.value = '100'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#s-fill').style.width === '100%';` }
    ],
    hint: "Listen for the input event and write range.value into both the fill width and the label.",
    reference: {
      html: `<div class="slider-wrap">
  <div class="slider-track"><div id="s-fill" class="slider-fill" style="width:0%"></div></div>
  <input id="range" type="range" min="0" max="100" value="0" />
  <div class="slider-value">Value: <span id="s-val">0</span></div>
</div>`,
      css: `.slider-wrap { max-width: 340px; font-family: system-ui; }
.slider-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.slider-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); }
#range { width: 100%; margin: 12px 0 6px; }
.slider-value { font-size: 13px; font-weight: 700; }`,
      js: `const range = document.querySelector('#range');
const fill = document.querySelector('#s-fill');
const val = document.querySelector('#s-val');
const update = () => { fill.style.width = range.value + '%'; val.textContent = range.value; };
range.addEventListener('input', update);
update();`
    }
  }
];
