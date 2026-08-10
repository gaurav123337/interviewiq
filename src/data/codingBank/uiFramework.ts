/* Framework component bank — React and Vue challenges. Unlike the vanilla UI
   bank, these render with a real library: the judge loads the UMD builds from
   a CDN into the sandbox (see UiProblem.libs), then mounts the user's component
   and asserts on the rendered DOM exactly like the vanilla problems.

   React problems use React.createElement (no JSX — the sandbox has no compiler),
   which is itself a classic interview topic. Vue problems use the global build,
   whose template compiler is included.

   The bank self-test fetches the same UMD builds at test time and pre-injects
   them into the test document (skipped when offline), so references are
   validated against the real libraries. */

import type { UiProblem } from "../coding";

const JS_SKELETON = `// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`;

const REACT_LIBS = [
  { url: "https://unpkg.com/react@18.3.1/umd/react.production.min.js", global: "React" },
  { url: "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", global: "ReactDOM" }
];

const VUE_LIBS = [
  { url: "https://unpkg.com/vue@3.4.38/dist/vue.global.prod.js", global: "Vue" }
];

export const UI_FRAMEWORK_PROBLEMS: UiProblem[] = [
  {
    kind: "ui",
    id: "ui-react-counter",
    title: "React Counter",
    difficulty: 2,
    category: "react",
    libs: REACT_LIBS,
    prompt: "Build a counter with React: clicking + increments the displayed number, clicking − decrements it. Use React.createElement (no JSX) and mount into #root with ReactDOM.createRoot.",
    html: `<div id="root"></div>`,
    css: `.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts at 0", check: `return document.querySelector('#value').textContent.trim() === '0';` },
      { label: "increments on +", check: `document.querySelector('#plus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '1';` },
      { label: "decrements on −", check: `document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '-1';` }
    ],
    hiddenAssertions: [
      { label: "rapid sequences stay consistent", check: `document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '0';` }
    ],
    hint: "Use useState for the count and pass onClick handlers that update it; React re-renders the span automatically.",
    reference: {
      html: `<div id="root"></div>`,
      css: `.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,
      js: `function Counter() {
  const [count, setCount] = React.useState(0);
  return React.createElement("div", { className: "counter" },
    React.createElement("button", { id: "minus", onClick: () => setCount(c => c - 1) }, "\u2212"),
    React.createElement("span", { id: "value" }, count),
    React.createElement("button", { id: "plus", onClick: () => setCount(c => c + 1) }, "+")
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Counter));`
    }
  },
  {
    kind: "ui",
    id: "ui-react-todo",
    title: "React Todo List",
    difficulty: 3,
    category: "react",
    libs: REACT_LIBS,
    prompt: "Build a todo list with React: submitting the form adds a non-empty todo, empty input is ignored, and each item has a delete button that removes it. Use React.createElement and useState.",
    html: `<div id="root"></div>`,
    css: `.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts empty", check: `return document.querySelectorAll('#todo-list li').length === 0;` },
      { label: "submit adds a todo", check: `const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, 'Learn React'); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn React');` },
      { label: "empty input is ignored", check: `const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '   '); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1;` }
    ],
    hiddenAssertions: [
      { label: "delete removes an item", check: `document.querySelector('.del').click(); await sleep(30); return document.querySelectorAll('#todo-list li').length === 0;` }
    ],
    hint: "Keep items in state; onSubmit prevents default, trims the input, appends, and clears the text field. Each item's delete handler filters by index.",
    reference: {
      html: `<div id="root"></div>`,
      css: `.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,
      js: `function App() {
  const [items, setItems] = React.useState([]);
  const [text, setText] = React.useState("");
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setItems([...items, t]);
    setText("");
  };
  const del = (i) => setItems(items.filter((_, j) => j !== i));
  return React.createElement("div", { className: "todo" },
    React.createElement("form", { id: "todo-form", onSubmit: add },
      React.createElement("input", { id: "todo-input", value: text, onChange: (e) => setText(e.target.value), placeholder: "What needs doing?" }),
      React.createElement("button", { type: "submit" }, "Add")),
    React.createElement("ul", { id: "todo-list" },
      items.map((it, i) =>
        React.createElement("li", { key: i },
          React.createElement("span", null, it),
          React.createElement("button", { className: "del", onClick: () => del(i) }, "\u2715"))))
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));`
    }
  },
  {
    kind: "ui",
    id: "ui-react-tabs",
    title: "React Tabs",
    difficulty: 2,
    category: "react",
    libs: REACT_LIBS,
    prompt: "Build a tab panel with React: clicking a tab shows its panel and marks it active; aria-selected must follow. Exactly one panel is visible at a time. Use React.createElement and useState.",
    html: `<div id="root"></div>`,
    css: `.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "first panel visible initially", check: `return getComputedStyle(document.getElementById('tab1')).display !== 'none' && getComputedStyle(document.getElementById('tab2')).display === 'none';` },
      { label: "clicking a tab shows its panel", check: `document.querySelectorAll('.tab')[1].click(); await sleep(30); return getComputedStyle(document.getElementById('tab2')).display !== 'none' && getComputedStyle(document.getElementById('tab1')).display === 'none';` },
      { label: "exactly one panel active", check: `document.querySelectorAll('.tab')[2].click(); await sleep(30); return document.querySelectorAll('.tab-panel.active').length === 1;` }
    ],
    hiddenAssertions: [
      { label: "aria-selected follows the active tab", check: `document.querySelectorAll('.tab')[1].click(); await sleep(30); return document.querySelectorAll('.tab')[1].getAttribute('aria-selected') === 'true' && document.querySelectorAll('.tab')[0].getAttribute('aria-selected') === 'false';` }
    ],
    hint: "Track the active tab id in state; each tab button sets it, and class + aria-selected derive from it.",
    reference: {
      html: `<div id="root"></div>`,
      css: `.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,
      js: `const PANELS = [
  { id: "tab1", label: "Overview" },
  { id: "tab2", label: "Pricing" },
  { id: "tab3", label: "FAQ" }
];
function Tabs() {
  const [active, setActive] = React.useState("tab1");
  return React.createElement("div", { className: "tabs" },
    React.createElement("div", { className: "tab-list", role: "tablist" },
      PANELS.map(p =>
        React.createElement("button", {
          key: p.id, className: "tab" + (active === p.id ? " active" : ""), "data-tab": p.id, role: "tab",
          "aria-selected": String(active === p.id),
          onClick: () => setActive(p.id)
        }, p.label))),
    PANELS.map(p =>
      React.createElement("div", { key: p.id, id: p.id, className: "tab-panel" + (active === p.id ? " active" : "") },
        React.createElement("p", null, p.label + " content.")))
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Tabs));`
    }
  },
  {
    kind: "ui",
    id: "ui-vue-counter",
    title: "Vue Counter",
    difficulty: 2,
    category: "vue",
    libs: VUE_LIBS,
    prompt: "Build a counter with Vue 3: clicking + increments the displayed number, clicking − decrements it. Use createApp with a template and data() state, then mount into #root.",
    html: `<div id="root"></div>`,
    css: `.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts at 0", check: `return document.querySelector('#value').textContent.trim() === '0';` },
      { label: "increments on +", check: `document.querySelector('#plus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '1';` },
      { label: "decrements on −", check: `document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '-1';` }
    ],
    hiddenAssertions: [
      { label: "rapid sequences stay consistent", check: `document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '0';` }
    ],
    hint: "data() returns the count, methods mutate it, and the template renders {{ count }} with @click handlers.",
    reference: {
      html: `<div id="root"></div>`,
      css: `.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,
      js: `Vue.createApp({
  data() { return { count: 0 }; },
  methods: {
    inc() { this.count += 1; },
    dec() { this.count -= 1; }
  },
  template: '<div class="counter">' +
    '<button id="minus" @click="dec">\u2212</button>' +
    '<span id="value">{{ count }}</span>' +
    '<button id="plus" @click="inc">+</button>' +
  '</div>'
}).mount("#root");`
    }
  },
  {
    kind: "ui",
    id: "ui-vue-todo",
    title: "Vue Todo List",
    difficulty: 3,
    category: "vue",
    libs: VUE_LIBS,
    prompt: "Build a todo list with Vue 3: submitting the form adds a non-empty todo (empty input ignored), and each item has a delete button. Use createApp, v-model and v-for.",
    html: `<div id="root"></div>`,
    css: `.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,
    js: JS_SKELETON,
    assertions: [
      { label: "starts empty", check: `return document.querySelectorAll('#todo-list li').length === 0;` },
      { label: "submit adds a todo", check: `const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, 'Learn Vue'); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn Vue');` },
      { label: "empty input is ignored", check: `const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '   '); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1;` }
    ],
    hiddenAssertions: [
      { label: "delete removes an item", check: `document.querySelector('.del').click(); await sleep(30); return document.querySelectorAll('#todo-list li').length === 0;` }
    ],
    hint: "v-model binds the input; the submit handler trims, pushes to items, and clears the field; v-for renders each item with a del(i) button.",
    reference: {
      html: `<div id="root"></div>`,
      css: `.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,
      js: `Vue.createApp({
  data() { return { text: "", items: [] }; },
  methods: {
    add() {
      const t = this.text.trim();
      if (!t) return;
      this.items.push(t);
      this.text = "";
    },
    del(i) { this.items.splice(i, 1); }
  },
  template: '<div class="todo">' +
    '<form id="todo-form" @submit.prevent="add">' +
      '<input id="todo-input" v-model="text" placeholder="What needs doing?" />' +
      '<button type="submit">Add</button>' +
    '</form>' +
    '<ul id="todo-list">' +
      '<li v-for="(it, i) in items" :key="i"><span>{{ it }}</span><button class="del" @click="del(i)">\u2715</button></li>' +
    '</ul>' +
  '</div>'
}).mount("#root");`
    }
  }
];
