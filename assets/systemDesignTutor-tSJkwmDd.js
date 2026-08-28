import{aJ as D,v as i,aK as m,D as f,aL as w,aI as y,w as p,aM as g,aN as x,aO as b,aP as v,aQ as L}from"./index-vFYcVXXm.js";import{a as N}from"./vendor-redux-_mUL87Rl.js";function P({onClose:e,title:t,desc:s,children:a}){return N.useEffect(()=>{const r=n=>{n.key==="Escape"&&e()};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[e]),D.createPortal(i.jsxs("div",{className:"fixed inset-0 z-[100]",children:[i.jsx("div",{className:"absolute inset-0",onClick:e,"aria-hidden":"true"}),i.jsxs("div",{role:"dialog","aria-modal":"true",className:"anim-drawer absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line/10 bg-gradient-to-b from-panel to-panel2 shadow-[0_0_60px_rgba(0,0,0,.5)]",children:[i.jsxs("div",{className:"flex items-start justify-between gap-3 border-b border-line/10 px-6 py-5",children:[i.jsxs("div",{className:"min-w-0",children:[i.jsx("h3",{className:"text-lg font-extrabold tracking-tight",children:t}),s&&i.jsx("p",{className:"mt-0.5 text-[12.5px] text-mut",children:s})]}),i.jsx("button",{onClick:e,"aria-label":"Close",className:"grid h-8 w-8 flex-none place-items-center rounded-lg border border-line/15 bg-wht/5 text-sm transition-colors hover:bg-wht/10",children:"✕"})]}),i.jsx("div",{className:"min-h-0 flex-1 overflow-y-auto px-6 py-5",children:a})]})]}),document.body)}function B(e){const t=e.toLowerCase().trim();return u(e).length>0?!0:/system design|distributed|scale|architecture|design.*(system|service|api|queue|cache|store)/i.test(t)}function u(e){return L(e).architectures??[]}function T(e){switch(e.toLowerCase()){case"junior":return"know what a load balancer, cache, and database do; explain basic client-server flow";case"mid":return"design a simple end-to-end system; identify 2-3 trade-offs; estimate basic throughput";case"senior":return"design a distributed system with caching, async processing, and failure handling; discuss CAP trade-offs concretely";case"staff":return"design for millions of users; discuss data partitioning, replication, and operational concerns (monitoring, rollback, incident response)";case"principal":case"cto":case"ceo":return"make org-wide architectural decisions; discuss build-vs-buy, vendor lock-in, technical debt, and long-term platform evolution";default:return"demonstrate solid systems thinking with concrete trade-offs"}}function k(e,t,s,a){const r=a.length?`

Known architectures for this topic:
`+a.map(n=>`${n.name}: ${n.blurb}
  Components: ${n.components.join(" → ")}
  Tradeoffs: ${n.tradeoffs.join("; ")}
  Scale: ${n.scaleNotes}
  Failures: ${n.failureModes.join("; ")}`).join(`

`):"";return`You are a senior systems architect teaching system design for a ${t} ${s} interview. Topic: "${e}".

Teaching strategy for system design:
1. Always start with requirements: functional + non-functional + scale estimates.
2. Build up the architecture step by step: start simple, add components only when needed.
3. For every design decision, name the trade-off explicitly (cost vs latency, consistency vs availability).
4. Walk through failure modes: what breaks, how the system handles it.
5. Mention real-world scale numbers when possible.
6. Use plain text diagrams when explaining component relationships (use arrows → to show flow).

At ${t} level, expect the candidate to: ${T(t)}

Tie everything back to how they'd explain it in a 45-minute whiteboard interview.${r}`}async function M(e,t){if(!m())throw new Error("AI coaching is temporarily disabled.");if(f()&&w()<=0)throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.");const s=y(t.fieldId),a=p(t.targetLevel),r=u(e),n=k(e,a.name,(s==null?void 0:s.name)??"",r),c=`Teach the system design topic "${e}" for a ${a.name} ${(s==null?void 0:s.name)??""} interview.
Include:
1) What the system does and why it's a classic interview topic.
2) A step-by-step architecture walkthrough (start simple, add complexity).
3) The 3 most important trade-offs and why you'd choose one side.
4) Common failure modes and how to handle them.
5) A 2-minute whiteboard explanation skeleton.
`+(r.length?`
Use the known architecture data above as reference — expand on the components and tradeoffs.`:`
If this is a known pattern, include a concrete architecture walkthrough.`),{sys:d}=await g(n,e,{field:t.fieldId,level:t.targetLevel}),l=await x("tutor",[{role:"system",content:d},{role:"user",content:c}],{maxTokens:800});return b(),v("ai_call",{system_design:!0,topic:e.slice(0,100)}),l}async function S(e,t,s){var h;if(!m())throw new Error("AI coaching is temporarily disabled.");if(f()&&w()<=0)throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.");const a=y(t.fieldId),r=p(t.targetLevel),n=u(e),c=k(e,r.name,(a==null?void 0:a.name)??"",n),d=((h=[...s].reverse().find(o=>o.role==="user"))==null?void 0:h.content)??"",{sys:l,citations:j,grounded:E,checked:$}=await g(c,d||e,{field:t.fieldId,level:t.targetLevel}),I=[{role:"system",content:l},...s.map(o=>({role:o.role,content:o.content}))],A=await x("tutor",I,{maxTokens:600});return b(),v("ai_call",{system_design_chat:!0,topic:e.slice(0,100)}),{text:A,citations:j,grounded:E,checked:$}}export{P as D,M as e,B as i,S as s};
