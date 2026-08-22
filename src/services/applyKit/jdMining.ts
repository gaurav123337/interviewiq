/* JD-aware mining — keywords + responsibilities pulled from the posting */

import type { JobPosting } from "../../types";

const JD_STOP = new Set([
  "the","a","an","and","or","of","to","in","for","with","on","at","by","as","is","are","be","been","will","can","should","must","have","has","had","from","that","this","these","those","it","its","not","but","about","into","over","under","between","out","up","down","off","we","you","your","their","they","our","us","who","what","when","where","how","all","any","each","more","most","some","such","than","then","there","here","which","while","through","within","across","using","use","used","including","include","etc","able","ability","strong","join","team","role","job","work","company","experience","skills","help","make","making","building","looking","someone","day","year","years","new","great","plus","well","like","also","one","two","would","could","may","might","per","via","ready","want","need","succeed","excited","impact","every","other","first","way","things","thing","really","much","many","s","t","ll","ve","re","senior","staff","lead","principal","junior","sr","mid","entry","contract","full","time","remote","hybrid","onsite","location","salary","benefits","culture","mission","product","products","customers","customer","users","user","people","build","built","builds","develop","development","design","designs","designing","create","creating","manage","managing","support","supporting","own","owns","drive","driving","scale","scaling","ship","shipping","improve","improving","optimize","optimizing","partner","partnering","collaborate","collaborating","implement","implementing","leading","mentor","mentoring","grow","growing","launch","launching","define","defining","operate","operating","measure","measuring","write","writing","review","reviewing","test","testing","deploy","deploying","automate","automating","integrate","integrating","prototype","prototyping","research","researching","analyze","analyzing","architect","architecting","maintain","maintaining","deliver","delivering","solve","solving","problem","problems","solution","solutions","process","processes","systems","system","data","tool","tools","stack","tech","technical","technology","engineering","engineers","engineer","software","platform","infrastructure","modern","best","practices","quality","high","performance","fast","speed","reliable","scalable","secure","security","global","international","environment","environments","opportunity","opportunities","candidate","candidates","position","positions","posting","open","roles","description","above","below","please","apply","applying","application","resume","email","contact","reach","questions","feel","free","let","know","thanks","thank","regards","best","usa","us","uk","nyc","sf","la","tokyo","london","toronto","japan","india","bengaluru","berlin","paris","amsterdam","united","states","city","cities","office","offices","region","regions","country","countries","world","worldwide"
]);

/** Role-specific keywords: title tokens + ATS skills + frequent JD words,
    ranked by how much the posting leans on them. Pure + testable. */
export function jdKeywords(job: JobPosting, max = 8): string[] {
  const counts = new Map<string, number>();
  const add = (t: string) => {
    const k = t.toLowerCase().trim().replace(/^\.+|\.+$/g, "");
    if (k.length < 3 || JD_STOP.has(k) || /^[0-9+#.]+$/.test(k)) return;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const w of (job.title ?? "").toLowerCase().split(/[^a-z0-9+#.]+/)) add(w);
  for (const s of job.skills) for (const w of s.toLowerCase().split(/[^a-z0-9+#.]+/)) add(w);
  for (const w of (job.description ?? "").toLowerCase().split(/[^a-z0-9+#.]+/)) add(w);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, max);
}

const JD_ACTION = /(build|design|develop|own|lead|drive|scale|ship|maintain|partner|collaborate|implement|improve|optimize|create|manage|support|research|analyze|architect|mentor|grow|launch|define|evolve|operate|write|review|test|deploy|automate|integrate|prototype|measure|monitor|troubleshoot|investigate|coach|advise|communicate)/i;

/** Substantive lines from the JD (action-verb bullets preferred) that the
    resume/letter can mirror back. Pure + testable. */
export function jdResponsibilities(job: JobPosting, max = 4): string[] {
  if (!job.description) return [];
  const sentences = (job.description
    .replace(/\s+/g, " ")
    .replace(/[\u2022\u00b7\u2023\u25aa\u25cf]/g, ".")
    .replace(/\.\s*\./g, ".")
    .split(/(?<=[.!?])\s+/))
    .map(s => s.trim().replace(/^[-*.]\s*/, ""))
    .filter(s => s.length >= 40 && s.length <= 200)
    .filter(s => !/who we are|about us|our mission|what we offer|benefits include|perks|equal opportunity|e-?verify|we ('re| are) looking|apply today|learn more|visit our|how to apply/i.test(s))
    .filter(s => !/^(join|come|we('re| are| care| value| believe| love| think| know| hope| pride)|about (us|the role)|our (team|mission|company|story)|as a|become|want to|help us|apply if|you will|what you'?ll|your day|the role|this role|in this role|overview|responsibilities|requirements|qualifications|preferred|bonus|who we are)/i.test(s))
    .filter(s => {
      const t = s.toLowerCase();
      if (job.title && t.includes(job.title.toLowerCase().slice(0, 40))) return false;
      if (/^(remote|united states|usa|uk|canada|india|japan|tokyo|london|berlin|paris|amsterdam|singapore|australia|new york|san francisco|seattle|austin|bengaluru|toronto|vancouver)[, .\-]?/i.test(s)) return false;
      return true;
    });
  const action = sentences.filter(s => JD_ACTION.test(s));
  const pool = action.length >= max ? action : [...action, ...sentences];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of pool) {
    if (seen.has(s) || out.length >= max) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
