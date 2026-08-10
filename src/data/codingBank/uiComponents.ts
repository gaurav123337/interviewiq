/* UI component bank — build a real component in HTML/CSS/JS, judged by the
   sandboxed iframe engine (src/services/runner.ts runUiTests). Each problem
   provides starter HTML + CSS and a JS skeleton; the user writes the behavior.
   Assertions drive real DOM events (clicks, input events) and read the rendered
   DOM + computed styles.

   Every problem carries a `reference` implementation — the bank self-test
   (src/__tests__/uicomponents.test.ts) asserts each reference passes its own
   full assertion suite through the judge core, so a broken problem or
   assertion can never ship silently. */

import type { UiProblem } from "../coding";

const JS_SKELETON = `// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`;

export const UI_COMPONENT_PROBLEMS: UiProblem[] = [
  {
    kind: "ui",
    id: "ui-counter",
    title: "Counter",
    difficulty: 1,
    category: "interaction",
    prompt: "Build a counter: clicking + increments the displayed number, clicking − decrements it. The count must never go out of sync with the display.",
    html: `<div class="counter">
  <button id="minus" aria-label="Decrease">−</button>
  <span id="value">0</span>
  <button id="plus" aria-label="Increase">+</button>
</div>`,
    css: `.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts at 0", check: `return document.querySelector('#value').textContent.trim() === '0';` },
      { label: "increments on +", check: `document.querySelector('#plus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '1';` },
      { label: "decrements on −", check: `document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '-1';` }
    ],
    hiddenAssertions: [
      { label: "handles rapid sequences consistently", check: `document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '0';` }
    ],
    hint: "Attach click listeners to both buttons and update #value from its current textContent.",
    reference: {
      html: `<div class="counter">
  <button id="minus" aria-label="Decrease">−</button>
  <span id="value">0</span>
  <button id="plus" aria-label="Increase">+</button>
</div>`,
      css: `.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,
      js: `const value = document.querySelector('#value');
document.querySelector('#plus').addEventListener('click', () => {
  value.textContent = Number(value.textContent) + 1;
});
document.querySelector('#minus').addEventListener('click', () => {
  value.textContent = Number(value.textContent) - 1;
});`
    }
  },
  {
    kind: "ui",
    id: "ui-accordion",
    title: "Accordion",
    difficulty: 2,
    category: "interaction",
    prompt: "Build an accordion: clicking a header opens its panel, opening one closes the others. aria-expanded on each header must track its open state.",
    html: `<div class="accordion">
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">What is InterviewIQ? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>An AI interviewer that prepares you for technical interviews.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Is it free? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>Yes — a free tier plus an optional Pro plan.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Which levels? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>From junior developer all the way to CEO.</p></div>
  </section>
</div>`,
    css: `.accordion { max-width: 420px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.acc-panel { display: none; padding: 4px 12px 12px; color: #475569; }
.acc-item.open .acc-panel { display: block; }
.acc-head { width: 100%; text-align: left; padding: 12px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "all panels closed initially", check: `return [...document.querySelectorAll('.acc-panel')].every(p => getComputedStyle(p).display === 'none');` },
      { label: "clicking a header opens its panel", check: `document.querySelectorAll('.acc-head')[1].click(); await sleep(20); return getComputedStyle(document.querySelectorAll('.acc-panel')[1]).display !== 'none';` },
      { label: "opening one closes the others", check: `document.querySelectorAll('.acc-head')[0].click(); await sleep(20); const open = [...document.querySelectorAll('.acc-item')].filter(i => i.classList.contains('open')); return open.length === 1 && open[0] === document.querySelectorAll('.acc-item')[0];` }
    ],
    hiddenAssertions: [
      { label: "aria-expanded tracks state", check: `const heads = document.querySelectorAll('.acc-head'); heads[2].click(); await sleep(20); return heads[2].getAttribute('aria-expanded') === 'true' && heads[0].getAttribute('aria-expanded') === 'false';` }
    ],
    hint: "Toggle an .open class on the clicked .acc-item while removing it from every other item; mirror it in aria-expanded.",
    reference: {
      html: `<div class="accordion">
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">What is InterviewIQ? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>An AI interviewer that prepares you for technical interviews.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Is it free? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>Yes — a free tier plus an optional Pro plan.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Which levels? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>From junior developer all the way to CEO.</p></div>
  </section>
</div>`,
      css: `.accordion { max-width: 420px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.acc-panel { display: none; padding: 4px 12px 12px; color: #475569; }
.acc-item.open .acc-panel { display: block; }
.acc-head { width: 100%; text-align: left; padding: 12px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; }`,
      js: `document.querySelectorAll('.acc-head').forEach(head => {
  head.addEventListener('click', () => {
    const item = head.closest('.acc-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.acc-item').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      head.setAttribute('aria-expanded', 'true');
    }
  });
});`
    }
  },
  {
    kind: "ui",
    id: "ui-tabs",
    title: "Tabs",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a tab panel: clicking a tab shows its panel and marks the tab active. Exactly one panel must be visible at a time, and aria-selected must follow the active tab.",
    html: `<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab active" data-tab="tab1" role="tab" aria-selected="true">Overview</button>
    <button class="tab" data-tab="tab2" role="tab" aria-selected="false">Pricing</button>
    <button class="tab" data-tab="tab3" role="tab" aria-selected="false">FAQ</button>
  </div>
  <div class="tab-panel active" id="tab1"><p>Overview content.</p></div>
  <div class="tab-panel" id="tab2"><p>Pricing content.</p></div>
  <div class="tab-panel" id="tab3"><p>FAQ content.</p></div>
</div>`,
    css: `.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "first panel visible initially", check: `return getComputedStyle(document.getElementById('tab1')).display !== 'none' && getComputedStyle(document.getElementById('tab2')).display === 'none';` },
      { label: "clicking a tab shows its panel", check: `document.querySelectorAll('.tab')[1].click(); await sleep(20); return getComputedStyle(document.getElementById('tab2')).display !== 'none' && getComputedStyle(document.getElementById('tab1')).display === 'none';` },
      { label: "exactly one panel visible", check: `document.querySelectorAll('.tab')[2].click(); await sleep(20); return document.querySelectorAll('.tab-panel.active').length === 1;` }
    ],
    hiddenAssertions: [
      { label: "aria-selected follows the active tab", check: `document.querySelectorAll('.tab')[1].click(); await sleep(20); return document.querySelectorAll('.tab')[1].getAttribute('aria-selected') === 'true' && document.querySelectorAll('.tab')[0].getAttribute('aria-selected') === 'false';` }
    ],
    hint: "On click: clear .active from every tab and panel, then add it to the clicked tab and its data-tab panel.",
    reference: {
      html: `<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab active" data-tab="tab1" role="tab" aria-selected="true">Overview</button>
    <button class="tab" data-tab="tab2" role="tab" aria-selected="false">Pricing</button>
    <button class="tab" data-tab="tab3" role="tab" aria-selected="false">FAQ</button>
  </div>
  <div class="tab-panel active" id="tab1"><p>Overview content.</p></div>
  <div class="tab-panel" id="tab2"><p>Pricing content.</p></div>
  <div class="tab-panel" id="tab3"><p>FAQ content.</p></div>
</div>`,
      css: `.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,
      js: `document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});`
    }
  },
  {
    kind: "ui",
    id: "ui-star-rating",
    title: "Star Rating",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a 5-star rating: clicking a star fills every star up to and including it (and the clicked value becomes the rating). Clicking a lower star lowers the rating.",
    html: `<div class="rating" data-value="0">
  <button class="star" data-star="1" aria-label="1 star">☆</button>
  <button class="star" data-star="2" aria-label="2 stars">☆</button>
  <button class="star" data-star="3" aria-label="3 stars">☆</button>
  <button class="star" data-star="4" aria-label="4 stars">☆</button>
  <button class="star" data-star="5" aria-label="5 stars">☆</button>
</div>`,
    css: `.star { font-size: 32px; background: none; border: none; cursor: pointer; color: #cbd5e1; padding: 2px; }
.star.active { color: #f59e0b; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "no stars active initially", check: `return document.querySelectorAll('.star.active').length === 0;` },
      { label: "clicking the third star fills three", check: `document.querySelectorAll('.star')[2].click(); await sleep(20); return document.querySelectorAll('.star.active').length === 3 && document.querySelector('.rating').dataset.value === '3';` },
      { label: "re-clicking a lower star lowers the rating", check: `document.querySelectorAll('.star')[1].click(); await sleep(20); return document.querySelectorAll('.star.active').length === 2;` }
    ],
    hiddenAssertions: [
      { label: "clicking the top star twice keeps it at five", check: `document.querySelectorAll('.star')[4].click(); await sleep(20); const first = document.querySelectorAll('.star.active').length; document.querySelectorAll('.star')[4].click(); await sleep(20); return first === 5 && document.querySelectorAll('.star.active').length === 5;` }
    ],
    hint: "On click, compare each star's data-star against the clicked value and toggle .active (and ★/☆) accordingly.",
    reference: {
      html: `<div class="rating" data-value="0">
  <button class="star" data-star="1" aria-label="1 star">☆</button>
  <button class="star" data-star="2" aria-label="2 stars">☆</button>
  <button class="star" data-star="3" aria-label="3 stars">☆</button>
  <button class="star" data-star="4" aria-label="4 stars">☆</button>
  <button class="star" data-star="5" aria-label="5 stars">☆</button>
</div>`,
      css: `.star { font-size: 32px; background: none; border: none; cursor: pointer; color: #cbd5e1; padding: 2px; }
.star.active { color: #f59e0b; }`,
      js: `const rating = document.querySelector('.rating');
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    const value = Number(star.dataset.star);
    rating.dataset.value = String(value);
    document.querySelectorAll('.star').forEach(s => {
      const active = Number(s.dataset.star) <= value;
      s.classList.toggle('active', active);
      s.textContent = active ? '★' : '☆';
    });
  });
});`
    }
  },
  {
    kind: "ui",
    id: "ui-todo",
    title: "Todo List",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a todo list: submitting the form adds a non-empty todo, empty input is ignored, and each item has a delete button that removes it.",
    html: `<div class="todo">
  <form id="todo-form">
    <input id="todo-input" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="todo-list"></ul>
</div>`,
    css: `.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts empty", check: `return document.querySelectorAll('#todo-list li').length === 0;` },
      { label: "adds a todo", check: `const input = document.querySelector('#todo-input'); input.value = 'Learn debounce'; document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn debounce');` },
      { label: "ignores empty input", check: `const input = document.querySelector('#todo-input'); input.value = '   '; document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelectorAll('#todo-list li').length === 1;` }
    ],
    hiddenAssertions: [
      { label: "delete removes the todo", check: `document.querySelector('.del').click(); await sleep(20); return document.querySelectorAll('#todo-list li').length === 0;` }
    ],
    hint: "Listen for submit, preventDefault, trim the input, and build each item with its own delete listener.",
    reference: {
      html: `<div class="todo">
  <form id="todo-form">
    <input id="todo-input" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="todo-list"></ul>
</div>`,
      css: `.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,
      js: `const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  li.innerHTML = '<span>' + esc(text) + '</span><button class="del" aria-label="Delete">✕</button>';
  li.querySelector('.del').addEventListener('click', () => li.remove());
  list.appendChild(li);
  input.value = '';
});`
    }
  },
  {
    kind: "ui",
    id: "ui-modal",
    title: "Modal Dialog",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a modal: hidden by default, opened by the trigger button, closed by the Close button and by clicking the backdrop.",
    html: `<div class="modal-wrap">
  <button id="open-modal">Open modal</button>
  <div class="modal-overlay" id="modal-overlay" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Welcome back</h3>
      <p>This is a modal dialog.</p>
      <button id="close-modal">Close</button>
    </div>
  </div>
</div>`,
    css: `.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; font-family: system-ui; }
.modal { background: #fff; padding: 24px; border-radius: 12px; max-width: 320px; }
#open-modal { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "hidden initially", check: `return document.querySelector('#modal-overlay').hidden === true;` },
      { label: "opens on the trigger click", check: `document.querySelector('#open-modal').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === false;` },
      { label: "closes via the close button", check: `document.querySelector('#close-modal').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === true;` }
    ],
    hiddenAssertions: [
      { label: "closes when the backdrop is clicked", check: `document.querySelector('#open-modal').click(); await sleep(20); document.querySelector('#modal-overlay').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === true;` }
    ],
    hint: "Toggle the overlay's hidden attribute; on backdrop clicks only close when the click target IS the overlay itself.",
    reference: {
      html: `<div class="modal-wrap">
  <button id="open-modal">Open modal</button>
  <div class="modal-overlay" id="modal-overlay" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Welcome back</h3>
      <p>This is a modal dialog.</p>
      <button id="close-modal">Close</button>
    </div>
  </div>
</div>`,
      css: `.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; font-family: system-ui; }
.modal { background: #fff; padding: 24px; border-radius: 12px; max-width: 320px; }
#open-modal { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,
      js: `const overlay = document.querySelector('#modal-overlay');
document.querySelector('#open-modal').addEventListener('click', () => { overlay.hidden = false; });
document.querySelector('#close-modal').addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });`
    }
  },
  {
    kind: "ui",
    id: "ui-dropdown",
    title: "Dropdown Select",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a dropdown: clicking the trigger toggles the menu, selecting an option updates the trigger label and closes the menu.",
    html: `<div class="dropdown">
  <button id="dd-trigger">Select a color ▾</button>
  <ul class="dd-menu" id="dd-menu" hidden>
    <li data-value="red">Red</li>
    <li data-value="green">Green</li>
    <li data-value="blue">Blue</li>
  </ul>
</div>`,
    css: `.dropdown { position: relative; display: inline-block; font-family: system-ui; }
#dd-trigger { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.dd-menu { position: absolute; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 140px; }
.dd-menu li { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dd-menu li:hover { background: #f1f5f9; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "menu closed initially", check: `return document.querySelector('#dd-menu').hidden === true;` },
      { label: "clicking the trigger opens the menu", check: `document.querySelector('#dd-trigger').click(); await sleep(20); return document.querySelector('#dd-menu').hidden === false;` },
      { label: "selecting an option updates the trigger and closes", check: `document.querySelectorAll('#dd-menu li')[1].click(); await sleep(20); return document.querySelector('#dd-trigger').textContent.includes('Green') && document.querySelector('#dd-menu').hidden === true;` }
    ],
    hiddenAssertions: [
      { label: "the trigger toggles the menu", check: `document.querySelector('#dd-trigger').click(); await sleep(20); const opened = document.querySelector('#dd-menu').hidden === false; document.querySelector('#dd-trigger').click(); await sleep(20); return opened && document.querySelector('#dd-menu').hidden === true;` }
    ],
    hint: "Toggle the menu's hidden attribute on trigger clicks; each option click sets the label and hides the menu.",
    reference: {
      html: `<div class="dropdown">
  <button id="dd-trigger">Select a color ▾</button>
  <ul class="dd-menu" id="dd-menu" hidden>
    <li data-value="red">Red</li>
    <li data-value="green">Green</li>
    <li data-value="blue">Blue</li>
  </ul>
</div>`,
      css: `.dropdown { position: relative; display: inline-block; font-family: system-ui; }
#dd-trigger { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.dd-menu { position: absolute; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 140px; }
.dd-menu li { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dd-menu li:hover { background: #f1f5f9; }`,
      js: `const trigger = document.querySelector('#dd-trigger');
const menu = document.querySelector('#dd-menu');
trigger.addEventListener('click', () => { menu.hidden = !menu.hidden; });
menu.querySelectorAll('li').forEach(li => {
  li.addEventListener('click', () => {
    trigger.textContent = li.textContent + ' ▾';
    menu.hidden = true;
  });
});`
    }
  },
  {
    kind: "ui",
    id: "ui-progress-bar",
    title: "Progress Bar",
    difficulty: 2,
    category: "interaction",
    prompt: "Build a progress bar: +10% grows the fill (capped at 100%), Reset returns it to 0%.",
    html: `<div class="progress-wrap">
  <div class="progress"><div class="fill" id="fill" style="width:0%"></div></div>
  <button id="progress-plus">+10%</button>
  <button id="progress-reset">Reset</button>
</div>`,
    css: `.progress { height: 18px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); transition: width .2s; }
.progress-wrap { max-width: 360px; font-family: system-ui; }
.progress-wrap button { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts at 0%", check: `return document.querySelector('#fill').style.width === '0%';` },
      { label: "increments by 10%", check: `document.querySelector('#progress-plus').click(); document.querySelector('#progress-plus').click(); await sleep(20); return document.querySelector('#fill').style.width === '20%';` },
      { label: "caps at 100%", check: `for (let i = 0; i < 12; i++) document.querySelector('#progress-plus').click(); await sleep(20); return document.querySelector('#fill').style.width === '100%';` }
    ],
    hiddenAssertions: [
      { label: "reset returns to 0%", check: `document.querySelector('#progress-reset').click(); await sleep(20); return document.querySelector('#fill').style.width === '0%';` }
    ],
    hint: "Parse the current width, clamp to 100, and write it back as a percentage.",
    reference: {
      html: `<div class="progress-wrap">
  <div class="progress"><div class="fill" id="fill" style="width:0%"></div></div>
  <button id="progress-plus">+10%</button>
  <button id="progress-reset">Reset</button>
</div>`,
      css: `.progress { height: 18px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); transition: width .2s; }
.progress-wrap { max-width: 360px; font-family: system-ui; }
.progress-wrap button { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,
      js: `const fill = document.querySelector('#fill');
const current = () => Number(fill.style.width.replace('%', '')) || 0;
document.querySelector('#progress-plus').addEventListener('click', () => {
  fill.style.width = Math.min(100, current() + 10) + '%';
});
document.querySelector('#progress-reset').addEventListener('click', () => { fill.style.width = '0%'; });`
    }
  },
  {
    kind: "ui",
    id: "ui-autocomplete",
    title: "Autocomplete",
    difficulty: 3,
    category: "interaction",
    prompt: "Build an autocomplete: typing filters a fixed dataset, suggestions show in the list, clicking a suggestion fills the input, and no matches hides the list.",
    html: `<div class="autocomplete">
  <input id="ac-input" placeholder="Type a language…" autocomplete="off" />
  <ul id="ac-list" class="ac-list" hidden></ul>
</div>`,
    css: `.ac-list { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow: auto; font-family: system-ui; }
.ac-list li { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
.ac-list li:hover { background: #f1f5f9; }
#ac-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 240px; font-family: system-ui; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "no suggestions when empty", check: `return document.querySelector('#ac-list').hidden === true;` },
      { label: "typing filters suggestions", check: `const input = document.querySelector('#ac-input'); input.value = 'py'; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); const items = [...document.querySelectorAll('#ac-list li')].map(li => li.textContent); return items.length === 1 && items[0] === 'Python';` },
      { label: "clicking a suggestion fills the input", check: `document.querySelector('#ac-list li').click(); await sleep(20); return document.querySelector('#ac-input').value === 'Python' && document.querySelector('#ac-list').hidden === true;` }
    ],
    hiddenAssertions: [
      { label: "no matches hides the list", check: `const input = document.querySelector('#ac-input'); input.value = 'zzz'; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#ac-list').hidden === true;` }
    ],
    hint: "On each input event, re-render the list from a filter of the dataset; hide it when the query is empty or has no matches.",
    reference: {
      html: `<div class="autocomplete">
  <input id="ac-input" placeholder="Type a language…" autocomplete="off" />
  <ul id="ac-list" class="ac-list" hidden></ul>
</div>`,
      css: `.ac-list { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow: auto; font-family: system-ui; }
.ac-list li { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
.ac-list li:hover { background: #f1f5f9; }
#ac-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 240px; font-family: system-ui; }`,
      js: `const DATA = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'Swift', 'Kotlin'];
const input = document.querySelector('#ac-input');
const list = document.querySelector('#ac-list');
input.addEventListener('input', () => {
  const q = input.value.trim().toLowerCase();
  list.innerHTML = '';
  const matches = DATA.filter(d => d.toLowerCase().includes(q));
  if (!q || !matches.length) { list.hidden = true; return; }
  matches.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m;
    li.addEventListener('click', () => { input.value = m; list.hidden = true; });
    list.appendChild(li);
  });
  list.hidden = false;
});`
    }
  },
  {
    kind: "ui",
    id: "ui-carousel",
    title: "Image Carousel",
    difficulty: 3,
    category: "interaction",
    prompt: "Build a carousel: next and prev move between slides, wrapping around at the ends. Exactly one slide is visible at a time.",
    html: `<div class="carousel">
  <div class="track">
    <div class="slide active"><p>Slide 1</p></div>
    <div class="slide"><p>Slide 2</p></div>
    <div class="slide"><p>Slide 3</p></div>
  </div>
  <div class="carousel-nav">
    <button id="car-prev" aria-label="Previous">‹</button>
    <button id="car-next" aria-label="Next">›</button>
  </div>
</div>`,
    css: `.carousel { max-width: 420px; position: relative; font-family: system-ui; }
.track { display: flex; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
.slide { min-width: 100%; display: none; height: 160px; place-items: center; background: #f8fafc; font-size: 22px; font-weight: 700; }
.slide.active { display: grid; }
.carousel-nav { display: flex; gap: 8px; margin-top: 10px; }
.carousel-nav button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 18px; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "first slide active initially", check: `return document.querySelectorAll('.slide')[0].classList.contains('active') && document.querySelectorAll('.slide.active').length === 1;` },
      { label: "next moves to the second slide", check: `document.querySelector('#car-next').click(); await sleep(20); return document.querySelectorAll('.slide')[1].classList.contains('active');` },
      { label: "prev goes back one", check: `document.querySelector('#car-prev').click(); await sleep(20); return document.querySelectorAll('.slide')[0].classList.contains('active');` }
    ],
    hiddenAssertions: [
      { label: "prev wraps to the last slide", check: `document.querySelector('#car-prev').click(); await sleep(20); return document.querySelectorAll('.slide')[2].classList.contains('active');` }
    ],
    hint: "Keep an index, move it modulo the slide count, and toggle .active to match.",
    reference: {
      html: `<div class="carousel">
  <div class="track">
    <div class="slide active"><p>Slide 1</p></div>
    <div class="slide"><p>Slide 2</p></div>
    <div class="slide"><p>Slide 3</p></div>
  </div>
  <div class="carousel-nav">
    <button id="car-prev" aria-label="Previous">‹</button>
    <button id="car-next" aria-label="Next">›</button>
  </div>
</div>`,
      css: `.carousel { max-width: 420px; position: relative; font-family: system-ui; }
.track { display: flex; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
.slide { min-width: 100%; display: none; height: 160px; place-items: center; background: #f8fafc; font-size: 22px; font-weight: 700; }
.slide.active { display: grid; }
.carousel-nav { display: flex; gap: 8px; margin-top: 10px; }
.carousel-nav button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 18px; }`,
      js: `const slides = [...document.querySelectorAll('.slide')];
let index = 0;
const show = (i) => {
  index = (i + slides.length) % slides.length;
  slides.forEach((s, j) => s.classList.toggle('active', j === index));
};
document.querySelector('#car-next').addEventListener('click', () => show(index + 1));
document.querySelector('#car-prev').addEventListener('click', () => show(index - 1));`
    }
  },
  {
    kind: "ui",
    id: "ui-tic-tac-toe",
    title: "Tic-tac-toe",
    difficulty: 3,
    category: "interaction",
    prompt: "Build tic-tac-toe: X goes first, clicking an empty cell places the current mark and switches turns, occupied cells can't be overwritten, and three in a row announces the winner. A Restart button resets the board.",
    html: `<div class="ttt">
  <div class="ttt-status" id="ttt-status">X's turn</div>
  <div class="ttt-grid">
    <button class="cell" data-cell="0"></button>
    <button class="cell" data-cell="1"></button>
    <button class="cell" data-cell="2"></button>
    <button class="cell" data-cell="3"></button>
    <button class="cell" data-cell="4"></button>
    <button class="cell" data-cell="5"></button>
    <button class="cell" data-cell="6"></button>
    <button class="cell" data-cell="7"></button>
    <button class="cell" data-cell="8"></button>
  </div>
  <button id="ttt-reset">Restart</button>
</div>`,
    css: `.ttt-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; margin: 12px 0; font-family: system-ui; }
.cell { width: 72px; height: 72px; font-size: 26px; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; }
.ttt-status { font-weight: 600; margin-bottom: 8px; font-family: system-ui; }
#ttt-reset { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "X plays first", check: `return document.querySelector('#ttt-status').textContent.includes("X's turn");` },
      { label: "clicking a cell places X and switches turns", check: `document.querySelectorAll('.cell')[0].click(); await sleep(20); return document.querySelectorAll('.cell')[0].textContent === 'X' && document.querySelector('#ttt-status').textContent.includes("O's turn");` },
      { label: "occupied cells cannot be overwritten", check: `document.querySelectorAll('.cell')[0].click(); await sleep(20); return document.querySelectorAll('.cell')[0].textContent === 'X';` }
    ],
    hiddenAssertions: [
      { label: "three in a row announces the winner", check: `const c = document.querySelectorAll('.cell'); c[0].click(); c[3].click(); c[1].click(); c[4].click(); c[2].click(); await sleep(20); return document.querySelector('#ttt-status').textContent.includes('X wins');` }
    ],
    hint: "Track the current player and move count; after each move check the 8 winning lines before switching turns.",
    reference: {
      html: `<div class="ttt">
  <div class="ttt-status" id="ttt-status">X's turn</div>
  <div class="ttt-grid">
    <button class="cell" data-cell="0"></button>
    <button class="cell" data-cell="1"></button>
    <button class="cell" data-cell="2"></button>
    <button class="cell" data-cell="3"></button>
    <button class="cell" data-cell="4"></button>
    <button class="cell" data-cell="5"></button>
    <button class="cell" data-cell="6"></button>
    <button class="cell" data-cell="7"></button>
    <button class="cell" data-cell="8"></button>
  </div>
  <button id="ttt-reset">Restart</button>
</div>`,
      css: `.ttt-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; margin: 12px 0; font-family: system-ui; }
.cell { width: 72px; height: 72px; font-size: 26px; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; }
.ttt-status { font-weight: 600; margin-bottom: 8px; font-family: system-ui; }
#ttt-reset { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,
      js: `const cells = [...document.querySelectorAll('.cell')];
const status = document.querySelector('#ttt-status');
let current = 'X';
let moves = 0;
const WIN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const hasWinner = () => WIN.some(combo => combo.every(i => cells[i].textContent === current));
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (cell.textContent || hasWinner()) return;
    cell.textContent = current;
    moves++;
    if (hasWinner()) { status.textContent = current + ' wins!'; return; }
    if (moves === 9) { status.textContent = 'Draw'; return; }
    current = current === 'X' ? 'O' : 'X';
    status.textContent = current + "'s turn";
  });
});
document.querySelector('#ttt-reset').addEventListener('click', () => {
  cells.forEach(c => { c.textContent = ''; });
  current = 'X';
  moves = 0;
  status.textContent = "X's turn";
});`
    }
  },
  {
    kind: "ui",
    id: "ui-signup-form",
    title: "Signup Form Validation",
    difficulty: 2,
    category: "forms",
    prompt: "Build signup-form validation: submitting with an invalid email and/or a short password shows inline errors; fixing the fields clears them; a fully valid submit is counted as successful.",
    html: `<form id="signup-form" novalidate>
  <div class="field">
    <label for="su-email">Email</label>
    <input id="su-email" type="email" />
    <p class="error" id="email-error" hidden>Enter a valid email.</p>
  </div>
  <div class="field">
    <label for="su-pass">Password</label>
    <input id="su-pass" type="password" />
    <p class="error" id="pass-error" hidden>Password must be at least 6 characters.</p>
  </div>
  <button type="submit">Sign up</button>
</form>`,
    css: `.field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; font-family: system-ui; }
.field label { font-weight: 600; font-size: 13px; }
.field input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 260px; font-family: system-ui; }
.error { color: #dc2626; font-size: 12px; margin: 0; }
#signup-form button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-family: system-ui; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "empty submit shows both errors", check: `document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === false && document.querySelector('#pass-error').hidden === false;` },
      { label: "valid input clears the errors", check: `document.querySelector('#su-email').value = 'ada@example.com'; document.querySelector('#su-pass').value = 'secret123'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === true && document.querySelector('#pass-error').hidden === true;` },
      { label: "a bad email is still flagged", check: `document.querySelector('#su-email').value = 'not-an-email'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === false;` }
    ],
    hiddenAssertions: [
      { label: "a fully valid submit counts as successful", check: `const before = Number(document.querySelector('#signup-form').dataset.submits || 0); document.querySelector('#su-email').value = 'ok@example.com'; document.querySelector('#su-pass').value = 'abcdef'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return Number(document.querySelector('#signup-form').dataset.submits || 0) === before + 1;` }
    ],
    hint: "On submit (preventDefault), set each error's hidden flag from a validation result and count only fully-valid submits.",
    reference: {
      html: `<form id="signup-form" novalidate>
  <div class="field">
    <label for="su-email">Email</label>
    <input id="su-email" type="email" />
    <p class="error" id="email-error" hidden>Enter a valid email.</p>
  </div>
  <div class="field">
    <label for="su-pass">Password</label>
    <input id="su-pass" type="password" />
    <p class="error" id="pass-error" hidden>Password must be at least 6 characters.</p>
  </div>
  <button type="submit">Sign up</button>
</form>`,
      css: `.field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; font-family: system-ui; }
.field label { font-weight: 600; font-size: 13px; }
.field input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 260px; font-family: system-ui; }
.error { color: #dc2626; font-size: 12px; margin: 0; }
#signup-form button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-family: system-ui; }`,
      js: `const form = document.querySelector('#signup-form');
const email = document.querySelector('#su-email');
const pass = document.querySelector('#su-pass');
const emailErr = document.querySelector('#email-error');
const passErr = document.querySelector('#pass-error');
let ok = 0;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const emailOk = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value);
  const passOk = pass.value.length >= 6;
  emailErr.hidden = emailOk;
  passErr.hidden = passOk;
  if (emailOk && passOk) ok++;
  form.dataset.submits = String(ok);
});`
    }
  }
];
