import{t as e}from"./data-DMLj1ZLf.js";import{t}from"./levels-DvemuOtu.js";import{n}from"./ai-Ddm_Urx0.js";var r=new Set(e.map(e=>e.id)),i=new Set(t.map(e=>e.id)),a=`You are a senior interview question curator. Convert the raw material below into a
JSON array of interview questions. Each item MUST be exactly:
{ "fieldId": <one of: ${e.map(e=>e.id).join(`, `)}>, "level": <one of: ${t.map(e=>e.id).join(`, `)}>, "question": "<a single, realistic interview question>", "answer": "<a concise model answer, 2-5 sentences>", "keyPoints": ["<1-4 scoring key points>"] }
Rules:
- Only extract content that is genuinely useful as an interview question. Skip ads, navigation, and noise.
- Infer fieldId and level from the content; default to ${e[0]?.id??`general`} / "mid" when unclear.
- Aim for 5-12 high-quality questions.
- Reply with ONLY the JSON array — no markdown fences, no commentary.

RAW MATERIAL:
"""`;async function o(e,t={}){let o=(await n([{role:`system`,content:`You produce strict JSON only.`},{role:`user`,content:a+e.slice(0,24e3)+`
"""`}],{temperature:.2,maxTokens:t.maxTokens??2e3})).replace(/```(?:json)?/g,``).trim(),s=o.indexOf(`[`),c=o.lastIndexOf(`]`);if(s<0||c<=s)throw Error(`AI response was not a JSON array`);let l=JSON.parse(o.slice(s,c+1));if(!Array.isArray(l))throw Error(`AI response was not an array`);return l.filter(e=>!!e&&typeof e==`object`).map(e=>({fieldId:String(e.fieldId??e.field??``).trim(),level:String(e.level??e.levelId??``).trim().toLowerCase(),question:String(e.question??e.q??``).trim(),answer:String(e.answer??e.a??``).trim(),keyPoints:Array.isArray(e.keyPoints)?e.keyPoints.map(e=>String(e).trim()).filter(Boolean):String(e.keyPoints??``).split(`,`).map(e=>e.trim()).filter(Boolean)})).filter(e=>e.question&&r.has(e.fieldId)&&i.has(e.level))}export{o as t};