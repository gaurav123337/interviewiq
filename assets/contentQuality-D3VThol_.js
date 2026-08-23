import{ai as p,T as O}from"./index-z8pK99YK.js";import"./vendor-redux-_mUL87Rl.js";import"./vendor-react-D2Xel5Cr.js";const m={minOverall:60,minAccuracy:50,minCredibility:60,autoApproveAbove:85};async function C(){try{const n=await p();if(!n)return m;const{data:e}=await n.from("content_quality_config").select("value").eq("key","thresholds").maybeSingle();return e!=null&&e.value?{...m,...e.value}:m}catch{return m}}function k(n,e,t,o,s){const r=e.slice(0,4e3),i=`You are a senior content quality reviewer for an interview preparation platform.
Evaluate the following content on 5 dimensions. Be strict but fair.

SCORING CRITERIA:
- Accuracy (0-100): Are the facts verifiable? Any obvious errors or outdated info?
- Relevance (0-100): How useful is this for someone preparing for tech interviews?
- Depth (0-100): Is it thorough and well-explained, or superficial?
- Freshness (0-100): Is the information current? Does it reference recent trends/versions?
- Credibility (0-100): Does the source domain and writing quality suggest authority?

RESPOND IN EXACTLY THIS JSON FORMAT:
{
  "accuracy": <number 0-100>,
  "relevance": <number 0-100>,
  "depth": <number 0-100>,
  "freshness": <number 0-100>,
  "credibility": <number 0-100>,
  "notes": "<2-3 sentence reasoning>"
}

DO NOT include any text outside the JSON block.`,a=`SOURCE: ${t} (${o})
TYPE: ${s}
TITLE: ${n}

CONTENT:
${r}

Evaluate this content's quality for an interview preparation platform.`;return{system:i,user:a}}function N(n){try{const e=n.match(/\{[\s\S]*\}/);if(!e)return null;const t=JSON.parse(e[0]),o=s=>Math.max(0,Math.min(100,Number(s)||0));return{overall:0,accuracy:o(t.accuracy),relevance:o(t.relevance),depth:o(t.depth),freshness:o(t.freshness),credibility:o(t.credibility)}}catch{return null}}function q(n){const e={accuracy:.3,relevance:.2,depth:.15,freshness:.15,credibility:.2},t=n.accuracy*e.accuracy+n.relevance*e.relevance+n.depth*e.depth+n.freshness*e.freshness+n.credibility*e.credibility;return Math.round(t)}async function I(n){var g,w,v,b;const{title:e,content:t,sourceName:o,domain:s,contentType:r,model:i="gpt-4o-mini"}=n,{system:a,user:l}=k(e,t,o,s,r),c=S(i);if(!c)throw new Error("No AI key configured for quality scoring");const y=await fetch(c.base+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${c.key}`},body:JSON.stringify({model:i,messages:[{role:"system",content:a},{role:"user",content:l}],temperature:.1,max_tokens:300})});if(!y.ok)throw new Error(`Quality scoring API failed (${y.status})`);const f=(((v=(w=(g=(await y.json()).choices)==null?void 0:g[0])==null?void 0:w.message)==null?void 0:v.content)??"").trim(),h=N(f);if(!h)throw new Error("Failed to parse quality scores from AI response");const _=q(h),u={...h,overall:_},d=await C(),T=u.overall>=d.minOverall&&u.accuracy>=d.minAccuracy&&u.credibility>=d.minCredibility,A=u.overall>=d.autoApproveAbove,E=((b=f.match(/"notes"\s*:\s*"([^"]*)"/))==null?void 0:b[1])??"Scored by LLM-as-Judge";return{scores:u,notes:E,model:i,passedThreshold:T,autoApproved:A,checkedAt:new Date().toISOString()}}async function $(n){var l;const e=await p();if(!e)throw new Error("Cloud not configured");const{data:t,error:o}=await e.from("content_items").select("title, content, source_name, domain, content_type").eq("id",n).single();if(o||!t)throw new Error("Content item not found");let s="gpt-4o-mini";try{const{data:c}=await e.from("content_quality_config").select("value").eq("key","scoring").maybeSingle();(l=c==null?void 0:c.value)!=null&&l.model&&(s=c.value.model)}catch{}const r=await I({title:t.title,content:t.content,sourceName:t.source_name,domain:t.domain,contentType:t.content_type,model:s}),i=await D(t.title,t.content,s).catch(()=>null),{error:a}=await e.from("content_items").update({quality_score:r.scores.overall,accuracy_score:r.scores.accuracy,relevance_score:r.scores.relevance,depth_score:r.scores.depth,freshness_score:r.scores.freshness,credibility_score:r.scores.credibility,quality_notes:r.notes,quality_model:r.model,quality_checked_at:r.checkedAt,summary:i,status:r.autoApproved?"approved":(r.passedThreshold,"pending"),updated_at:new Date().toISOString()}).eq("id",n);if(a)throw a;return r}async function D(n,e,t){var a,l,c;const o=S(t);if(!o)return null;const s=e.slice(0,3e3),r=await fetch(o.base+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${o.key}`},body:JSON.stringify({model:t,messages:[{role:"system",content:"Summarize the following article in 2-3 concise sentences. Focus on the key takeaway for interview preparation."},{role:"user",content:`TITLE: ${n}

CONTENT:
${s}`}],temperature:.3,max_tokens:150})});return r.ok&&(((c=(l=(a=(await r.json()).choices)==null?void 0:a[0])==null?void 0:l.message)==null?void 0:c.content)??"").trim()||null}function S(n){try{const e=localStorage.getItem("ai_settings");if(e){const t=JSON.parse(e);if(t.key)return{key:t.key,base:t.base||"https://api.openai.com/v1",model:n}}}catch{}try{O().user}catch{}return null}async function M(){const n=await p();if(!n)throw new Error("Cloud not configured");const{data:e,error:t}=await n.from("content_items").select("id, title, content, source_name, domain, content_type").eq("status","pending").is("quality_score",null).limit(10);if(t)throw t;if(!(e!=null&&e.length))return{scored:0,errors:0};let o=0,s=0;for(const r of e){try{await $(r.id),o++}catch{s++}await new Promise(i=>setTimeout(i,2e3))}return{scored:o,errors:s}}export{M as batchScoreContent,$ as scoreAndUpdateContent,I as scoreContent};
