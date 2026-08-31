import{aC as m,F as a,L as c}from"./index-CBrrl0ce.js";const f=new Set(a.map(t=>t.id)),u=new Set(c.map(t=>t.id));var l;const y=`You are a senior interview question curator. Convert the raw material below into a
JSON array of interview questions. Each item MUST be exactly:
{ "fieldId": <one of: ${a.map(t=>t.id).join(", ")}>, "level": <one of: ${c.map(t=>t.id).join(", ")}>, "question": "<a single, realistic interview question>", "answer": "<a concise model answer, 2-5 sentences>", "keyPoints": ["<1-4 scoring key points>"] }
Rules:
- Only extract content that is genuinely useful as an interview question. Skip ads, navigation, and noise.
- Infer fieldId and level from the content; default to ${((l=a[0])==null?void 0:l.id)??"general"} / "mid" when unclear.
- Aim for 5-12 high-quality questions.
- Reply with ONLY the JSON array — no markdown fences, no commentary.

RAW MATERIAL:
"""`;async function S(t,d={}){const n=(await m([{role:"system",content:"You produce strict JSON only."},{role:"user",content:y+t.slice(0,24e3)+`
"""`}],{temperature:.2,maxTokens:d.maxTokens??2e3})).replace(/```(?:json)?/g,"").trim(),i=n.indexOf("["),s=n.lastIndexOf("]");if(i<0||s<=i)throw new Error("AI response was not a JSON array");const r=JSON.parse(n.slice(i,s+1));if(!Array.isArray(r))throw new Error("AI response was not an array");return r.filter(e=>!!e&&typeof e=="object").map(e=>({fieldId:String(e.fieldId??e.field??"").trim(),level:String(e.level??e.levelId??"").trim().toLowerCase(),question:String(e.question??e.q??"").trim(),answer:String(e.answer??e.a??"").trim(),keyPoints:Array.isArray(e.keyPoints)?e.keyPoints.map(o=>String(o).trim()).filter(Boolean):String(e.keyPoints??"").split(",").map(o=>o.trim()).filter(Boolean)})).filter(e=>e.question&&f.has(e.fieldId)&&u.has(e.level))}export{S as c};
