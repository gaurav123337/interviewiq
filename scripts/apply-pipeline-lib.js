/* apply-pipeline-lib — pure decisions for the autonomous worker. The one-time
 * bank is USER-confirmed data, not old form-fill memory or AI-generated prose.
 * Labels, options and job bodies are bounded data; nothing here executes them. */
import { adapterForJob } from './apply-adapters-lib.js';

export const PIPELINE_LIMITS = Object.freeze({ question: 1000, option: 300, options: 100, answer: 12000, resume: 12000, description: 100000, facts: 200, savedAnswers: 1000, jobs: 1000 });
export const VERIFIED_FACT_KEYS = Object.freeze(['name', 'firstName', 'lastName', 'email', 'phone', 'skills', 'role', 'locations', 'location', 'yearsExperience', 'noticePeriod', 'currentSalary', 'expectedSalary', 'salaryCurrency', 'workAuthorization', 'requiresSponsorship', 'relocation', 'linkedin', 'portfolio', 'portalProfileApproved:naukri', 'portalAccountIdentity:naukri', 'portalResumeText:naukri', 'portalProfileApproved:instahyre', 'portalAccountIdentity:instahyre', 'portalResumeText:instahyre']);
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const confirmedTime = f => f?.confirmedAt;
const record = o => o != null && typeof o === 'object' && !Array.isArray(o);
const normalize = v => typeof v === 'string' ? v.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ') : '';
const countryAliases = { india: 'IN', in: 'IN', 'united states': 'US', 'united states of america': 'US', usa: 'US', us: 'US', 'u.s.': 'US', 'united kingdom': 'GB', uk: 'GB', gb: 'GB', canada: 'CA', ca: 'CA', germany: 'DE', de: 'DE', australia: 'AU', au: 'AU', singapore: 'SG', sg: 'SG' };
export function canonicalCountry(value) { const n = normalize(value); return countryAliases[n] || (/^[a-z]{2}$/.test(n) ? n.toUpperCase() : n); }
export function canonicalCurrency(value) { const n = normalize(value); return ({ rupees: 'INR', 'indian rupees': 'INR', 'us dollars': 'USD', dollars: '', 'british pounds': 'GBP', euros: 'EUR' })[n] ?? (/^[a-z]{3}$/.test(n) ? n.toUpperCase() : ''); }
const skillAliases = { 'react.js': 'react', reactjs: 'react', 'node.js': 'node', nodejs: 'node', 'vue.js': 'vue', vuejs: 'vue', 'next.js': 'next', nextjs: 'next', js: 'javascript', ts: 'typescript', 'c sharp': 'c#', 'c plus plus': 'c++', golang: 'go', 'amazon web services': 'aws' };
export function canonicalVerifiedSkill(value) { const n = normalize(value); return n.length <= 80 && /^[a-z0-9+#. /-]+$/.test(n) ? skillAliases[n] || n : ''; }
const jdSkillVocabulary = Object.freeze(['html', 'css', 'javascript', 'typescript', 'react', 'next', 'node', 'vue', 'angular', 'python', 'java', 'c++', 'c#', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'postgresql', 'mysql', 'mongodb', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'graphql', 'spring', 'django', 'flask', ...Object.keys(skillAliases)]);
export function extractVerifiedJobSkills(description) {
  if (!safeText(description, PIPELINE_LIMITS.description)) return [];
  const text = normalize(description), skills = new Set();
  for (const token of jdSkillVocabulary) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`, 'i').test(text)) skills.add(canonicalVerifiedSkill(token));
  }
  return [...skills].sort();
}
function time(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return NaN;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return NaN;
  return Date.parse(value);
}
function current(confirmed, expires, now) { const c = time(confirmed), e = expires === undefined ? Infinity : time(expires); return Number.isFinite(c) && c <= now && e > now && e > c; }
function safeText(s, limit) { return typeof s === 'string' && s.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s); }
function hostile(s) { return /[<>]|(?:javascript|data):|ignore (?:all |previous |prior )?instructions|system prompt|execute (?:code|script)|\beval\s*\(|\bfunction\s*\(/i.test(s); }
const contextKeys = ['country', 'currency', 'employer', 'portal', 'application'];
function canonicalContext(c) {
  const out = {};
  for (const k of contextKeys) if (c?.[k] !== undefined) {
    out[k] = k === 'country' ? canonicalCountry(c[k]) : k === 'currency' ? canonicalCurrency(c[k]) : k === 'application' ? (typeof c[k] === 'string' ? c[k].trim() : '') : normalize(c[k]);
  }
  return out;
}
function validContext(c) { return record(c) && Object.keys(c).every(k => contextKeys.includes(k) && safeText(c[k], 2000) && c[k].trim()); }
function contextMatches(saved, actual) { return Object.entries(canonicalContext(saved)).every(([k, v]) => v !== '' && v === actual[k]); }
const aliases = new Map();
for (const [meaning, labels] of Object.entries({
  name: ['full name', 'your name', 'name', 'legal name'], firstName: ['first name', 'given name'], lastName: ['last name', 'surname', 'family name'],
  email: ['email', 'email address', 'e-mail', 'e-mail address', 'your email address'], phone: ['phone', 'phone number', 'mobile number', 'contact number', 'telephone number'],
  location: ['current location', 'current city', 'city of residence', 'where do you live'], locations: ['preferred locations', 'preferred work locations'],
  yearsExperience: ['total years of experience', 'years of experience', 'total experience', 'how many years of experience do you have'],
  noticePeriod: ['notice period', 'what is your notice period', 'availability', 'when can you start'],
  currentSalary: ['current salary', 'current ctc', 'current compensation', 'what is your current salary'],
  expectedSalary: ['expected salary', 'expected ctc', 'salary expectation', 'salary expectations', 'desired salary', 'expected compensation', 'what are your salary expectations'],
  workAuthorization: ['work authorization', 'are you legally authorized to work', 'are you authorized to work', 'are you legally eligible to work', 'are you eligible to work'],
  requiresSponsorship: ['do you require sponsorship', 'will you require sponsorship', 'do you now or in the future require sponsorship', 'will you now or in the future require sponsorship', 'do you require visa sponsorship'],
  relocation: ['are you willing to relocate', 'willing to relocate', 'open to relocation'],
  linkedin: ['linkedin', 'linkedin profile', 'linkedin url'], portfolio: ['portfolio', 'portfolio url', 'website', 'personal website'],
  skills: ['skills', 'technical skills'], role: ['current role', 'job role', 'occupation'],
})) for (const label of labels) aliases.set(label, meaning);
function fieldShape(field) {
  const f = typeof field === 'string' ? { question: field } : (record(field) ? field : {});
  const raw = f.controlType || f.type || (normalize(f.tag) === 'textarea' ? 'textarea' : normalize(f.tag) === 'select' ? 'select' : 'text');
  const controlType = ['text', 'textarea', 'email', 'tel', 'number', 'date', 'url', 'select', 'radio', 'checkbox', 'file'].includes(raw) ? raw : 'unknown';
  return { ...f, question: f.question ?? f.label ?? '', controlType, options: f.options ?? [] };
}
function jobContext(job) { return canonicalContext({ ...(job?.country ? { country: job.country } : {}), ...(job?.salary?.currency ? { currency: job.salary.currency } : {}), ...(job?.company ? { employer: job.company } : {}), ...(job?.jobUrl ? { application: job.jobUrl, portal: adapterForJob(job).boardIdentity || adapterForJob(job).id } : {}) }); }
function defaultScope(meaning, context) {
  if (['workAuthorization', 'requiresSponsorship', 'currentSalary', 'expectedSalary'].includes(meaning)) return { scope: 'country', scopeKey: context.country };
  if (meaning === 'relocation') return { scope: 'employer', scopeKey: context.employer };
  if (meaning.startsWith('unknown:') || meaning.startsWith('demographic:')) return { scope: 'application', scopeKey: context.application };
  return { scope: 'global' };
}
export function classifyQuestion(field, job = {}) {
  const f = fieldShape(field), options = Array.isArray(f.options) ? f.options.slice(0, PIPELINE_LIMITS.options).map(o => typeof o === 'string' ? o.slice(0, PIPELINE_LIMITS.option) : o) : [];
  let q = normalize(typeof f.question === 'string' ? f.question.slice(0, PIPELINE_LIMITS.question) : '').replace(/[?*:.]+$/g, '').trim();
  let meaning = `unknown:${q}`, disposition = 'ask', reason;
  const context = { ...jobContext(job), ...canonicalContext(f.context) };
  const base = { question: typeof f.question === 'string' ? f.question.slice(0, PIPELINE_LIMITS.question) : '', controlType: f.controlType, options, context };
  if (f.required !== undefined && typeof f.required !== 'boolean') return { ...base, meaning: 'invalidQuestion', scope: 'application', scopeKey: context.application, disposition: 'ask', reason: 'malformed required flag' };
  if (!safeText(f.question, PIPELINE_LIMITS.question) || !q || hostile(f.question) || !Array.isArray(f.options) || f.options.length > PIPELINE_LIMITS.options || f.options.some(o => !safeText(o, PIPELINE_LIMITS.option) || hostile(o)) || (f.context !== undefined && !validContext(f.context))) {
    return { ...base, meaning: 'invalidQuestion', scope: 'application', scopeKey: context.application, disposition: 'ask', reason: 'unsafe or malformed field metadata' };
  }
  // Any consent checkbox or legal attestation needs a fresh human act; even an
  // exact old "Yes" is not blanket consent to new terms or data disclosure.
  if (/\b(?:consent|agree|certify|attest|acknowledge|terms|privacy policy|background check|data processing|declare|declaration|signature)\b/.test(q)) {
    return { ...base, meaning: 'manualAttestation', scope: 'application', scopeKey: context.application, disposition: 'manualAttestation', reason: 'fresh application-specific human attestation required' };
  }
  if (f.controlType === 'file') {
    // Mentioning a resume is not an upload instruction: negative, combined or
    // legal labels must never route the approved resume into another document slot.
    const resumeUpload = !/\b(?:not|no|never|except|excluding|without|other than)\b/.test(q) && /^(?:upload (?:your )?)?(?:resume|cv|curriculum vitae)(?:\s*\/\s*(?:resume|cv))?$/.test(q);
    return { ...base, meaning: resumeUpload ? 'resume' : `unknownFile:${q}`, scope: 'application', scopeKey: context.application, disposition: 'ask', reason: 'use exact approved resume only for recognized resume upload; other files need review' };
  }
  if (/\b(?:gender|race|ethnicity|disability|veteran|sexual orientation|religion|caste)\b/.test(q)) {
    meaning = `demographic:${q}`;
  } else {
    const curr = q.match(/(?:\s*\((USD|INR|GBP|EUR|CAD|AUD|SGD)\)|\s+(?:in\s+)?(USD|INR|GBP|EUR|CAD|AUD|SGD))$/i);
    if (curr) { context.currency = canonicalCurrency(curr[1] || curr[2]); q = q.slice(0, curr.index).trim(); }
    const place = q.match(/\s+in\s+(india|united states(?: of america)?|usa|us|united kingdom|uk|canada|germany|australia|singapore)$/);
    if (place) { context.country = canonicalCountry(place[1]); q = q.slice(0, place.index).trim(); }
    meaning = aliases.get(q) || meaning;
    const skillYears = q.match(/^(?:how many )?years (?:of )?(?:experience (?:with|in)|of (.+?) experience)(?: (.+?))?(?: do you have)?$/);
    const explicitSkillYears = q.match(/^(?:how many )?years of (.+?) experience(?: do you have)?$/) || q.match(/^(?:how many )?years (?:of )?experience (?:with|in) (.+?)(?: do you have)?$/);
    if (!aliases.has(q) && explicitSkillYears && canonicalVerifiedSkill(explicitSkillYears[1])) meaning = `skillYears:${canonicalVerifiedSkill(explicitSkillYears[1])}`;
    if (skillYears && meaning.startsWith('unknown:')) reason = 'skill-specific experience requires explicit skill-year fact';
    disposition = meaning.startsWith('unknown:') || meaning.startsWith('demographic:') ? 'ask' : 'answer';
  }
  const scoped = defaultScope(meaning, context);
  if (f.controlType === 'checkbox' && !['workAuthorization', 'requiresSponsorship', 'relocation'].includes(meaning)) return { ...base, context, meaning: 'manualAttestation', scope: 'application', scopeKey: context.application, disposition: 'manualAttestation', reason: 'unrecognized checkbox is not automatic blanket consent' };
  if (scoped.scope !== 'application' && !own(f.context, 'application')) delete context.application;
  // Stable identity facts are globally reusable; job-specific context only
  // constrains meanings that actually depend on that job, or explicit context.
  if (scoped.scope === 'global') for (const k of contextKeys) if (!own(f.context, k)) delete context[k];
  if (!f.required && disposition === 'ask') disposition = 'optionalLeave';
  return { ...base, context, meaning, ...scoped, disposition, ...(reason ? { reason } : {}) };
}
export function isTrustedResumeField(field, job = {}) {
  const classified = classifyQuestion(field, job);
  return classified.controlType === 'file' && classified.meaning === 'resume' && classified.disposition !== 'manualAttestation';
}
function keyFor(c, scope = c) {
  return JSON.stringify(['verified-question-v1', c.meaning, c.meaning === 'manualAttestation' ? normalize(c.question) : '', c.controlType, [...c.options].map(normalize).sort(), scope.scope, scope.scopeKey || '', canonicalContext(c.context)]);
}
export function questionBatchKey(field, job = {}, scope) { return keyFor(classifyQuestion(field, job), scope); }
function factValueValid(v) { return typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (safeText(v, PIPELINE_LIMITS.answer) && v.trim().length > 0) || (Array.isArray(v) && v.length <= 200 && v.every(x => !Array.isArray(x) && factValueValid(x))); }
export function validateVerifiedProfile(profile, now) {
  const reasons = [], n = time(now);
  if (!Number.isFinite(n)) reasons.push('invalid clock');
  if (!record(profile) || !Number.isSafeInteger(profile.revision) || profile.revision < 1 || !record(profile.facts) || Object.keys(profile.facts).length > PIPELINE_LIMITS.facts || !safeText(profile.resumeText, PIPELINE_LIMITS.resume) || typeof profile.resumeApproved !== 'boolean') reasons.push('malformed verified profile');
  else for (const [k, f] of Object.entries(profile.facts)) {
    if (['__proto__', 'prototype', 'constructor'].includes(k) || !safeText(k, 120) || !record(f) || f.source !== 'user' || !factValueValid(f.value) || !Number.isFinite(time(confirmedTime(f))) || time(confirmedTime(f)) > n || (f.validUntil !== undefined && (!Number.isFinite(time(f.validUntil)) || time(f.validUntil) <= time(confirmedTime(f)))) || (f.scope !== undefined && (!validContext(f.scope) || own(f.scope, 'currency')))) reasons.push(`invalid user fact: ${k}`);
  }
  return { ok: reasons.length === 0, reasons };
}
function compatibleValue(value, c) {
  const str = Array.isArray(value) ? value.join(', ') : String(value);
  if (!safeText(str, PIPELINE_LIMITS.answer) || !str.trim()) return null;
  if (['select', 'radio'].includes(c.controlType)) {
    if (!c.options.length) return null;
    const bool = v => ({ yes: true, true: true, no: false, false: false })[normalize(v)];
    const matches = c.options.filter(o => normalize(o) === normalize(str) || (typeof value === 'boolean' && bool(o) === value) || (['workAuthorization', 'requiresSponsorship', 'relocation'].includes(c.meaning) && bool(str) !== undefined && bool(o) === bool(str)));
    return matches.length === 1 ? matches[0] : null;
  }
  if (c.controlType === 'checkbox') {
    const boolean = typeof value === 'boolean' ? value : ({ yes: true, true: true, no: false, false: false })[normalize(str)];
    return ['workAuthorization', 'requiresSponsorship', 'relocation'].includes(c.meaning) && boolean !== undefined ? String(boolean) : null;
  }
  if (c.controlType === 'unknown' || c.controlType === 'file') return null;
  if (c.controlType === 'number' && !/^-?\d+(?:\.\d+)?$/.test(str)) return null;
  if (c.controlType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return null;
  return str;
}
function scopedFact(profile, key, context, now) {
  if (!own(profile?.facts, key)) return { missing: true };
  const f = profile.facts[key];
  if (!current(confirmedTime(f), f.validUntil, now)) return { missing: true, stale: true, error: `expired or future fact: ${key}` };
  if (f.scope && !contextMatches(f.scope, context)) return { error: `fact context mismatch: ${key}` };
  if (['workAuthorization', 'requiresSponsorship'].includes(key) && (!f.scope?.country || !context.country || canonicalCountry(f.scope.country) !== context.country || typeof f.value !== 'boolean')) return { error: `explicit country-bound boolean required: ${key}` };
  if (['currentSalary', 'expectedSalary'].includes(key) && (!f.scope?.country || !context.country || canonicalCountry(f.scope.country) !== context.country)) return { error: `explicit country-bound salary required: ${key}` };
  return { value: f.value, fact: f };
}
function scopeMatches(a, c, actual) {
  if (!['global', 'country', 'employer', 'portal', 'application'].includes(a.scope)) return false;
  if (a.scope !== 'global' && (!a.scopeKey || a.scopeKey !== actual[a.scope])) return false;
  if (a.scope === 'global' && a.scopeKey) return false;
  if (!contextMatches(a.context, actual)) return false;
  if (['country', 'employer', 'application'].includes(c.scope) && !actual[c.scope]) return false;
  if (['workAuthorization', 'requiresSponsorship', 'currentSalary', 'expectedSalary'].includes(c.meaning) && (!a.context.country || canonicalCountry(a.context.country) !== actual.country)) return false;
  if (['currentSalary', 'expectedSalary'].includes(c.meaning) && (!a.context.currency || canonicalCurrency(a.context.currency) !== actual.currency)) return false;
  if ((c.meaning.startsWith('unknown:') || c.meaning.startsWith('demographic:')) && a.scope !== 'application') return false;
  return true;
}
export function resolveVerifiedAnswer(field, { profile, answers = [], job = {}, now } = {}) {
  const c = classifyQuestion(field, job), n = time(now), revision = Number.isSafeInteger(profile?.revision) ? profile.revision : 0;
  const ask = reason => ({ kind: 'ask', questionKey: keyFor(c), meaning: c.meaning, question: c.question, controlType: c.controlType, options: c.options, context: c.context, scope: c.scope, ...(c.scopeKey ? { scopeKey: c.scopeKey } : {}), reason, profileRevision: revision });
  if (c.disposition === 'manualAttestation') {
    const manual = () => ({ kind: 'manualAttestation', meaning: c.meaning, question: c.question, reason: c.reason });
    if (!validateVerifiedProfile(profile, now).ok || !Array.isArray(answers) || answers.length > PIPELINE_LIMITS.savedAnswers || !c.context.application) return manual();
    const exact = answers.filter(a => record(a) && a.meaning === c.meaning && normalize(a.question) === normalize(c.question) && a.controlType === c.controlType && a.scope === 'application' && a.scopeKey === c.context.application && Array.isArray(a.options) && JSON.stringify(a.options.map(normalize).sort()) === JSON.stringify(c.options.map(normalize).sort()) && validContext(a.context) && JSON.stringify(canonicalContext(a.context)) === JSON.stringify(canonicalContext(c.context)));
    if (!exact.length || exact.some(a => a.source !== 'user' || a.autoReuse !== true || a.profileRevision !== revision || !safeText(a.id, 200) || !a.id || !current(a.confirmedAt, a.validUntil, n) || n - time(a.confirmedAt) > 86400000 || !safeText(a.answer, PIPELINE_LIMITS.answer))) return manual();
    const checkbox = c.controlType === 'checkbox';
    const values = exact.map(a => checkbox ? ({ true: 'true', yes: 'true', false: 'false', no: 'false' })[normalize(a.answer)] : compatibleValue(a.answer, c));
    if (values.some(v => !v) || new Set(values.map(normalize)).size !== 1) return manual();
    const approved = [...exact].sort((a, b) => a.id.localeCompare(b.id))[0];
    return { kind: 'fill', value: values[0], source: 'savedAnswer', answerId: approved.id, profileRevision: revision };
  }
  if (c.disposition === 'optionalLeave') return { kind: 'optionalLeave', meaning: c.meaning, reason: 'optional unanswered field; no inferred demographic or unknown answer' };
  const valid = validateVerifiedProfile(profile, now);
  if (!valid.ok) return ask(valid.reasons.join('; '));
  if (c.meaning === 'invalidQuestion' || c.controlType === 'file') return ask(c.reason);
  if (!Array.isArray(answers) || answers.length > PIPELINE_LIMITS.savedAnswers) return ask('malformed or oversized answer bank');
  const actual = { ...jobContext(job), ...c.context };
  if (c.scope !== 'global' && !c.scopeKey) return ask(`missing ${c.scope} context`);
  if (['currentSalary', 'expectedSalary'].includes(c.meaning) && !c.context.currency) return ask('explicit salary currency required; no inferred currency or conversion');
  const direct = !c.meaning.startsWith('unknown:') && !c.meaning.startsWith('demographic:') ? scopedFact(profile, c.meaning, actual, n) : { missing: true };
  if (direct.error && !direct.stale) return ask(direct.error);
  if (['currentSalary', 'expectedSalary'].includes(c.meaning) && !direct.missing) {
    const currency = scopedFact(profile, 'salaryCurrency', actual, n);
    if (!currency.fact || canonicalCurrency(currency.value) !== c.context.currency) return ask('salaryCurrency fact missing, expired or contradicts question currency');
  }
  const candidates = answers.filter(a => record(a) && a.meaning === c.meaning && a.controlType === c.controlType && Array.isArray(a.options) && JSON.stringify(a.options.map(normalize).sort()) === JSON.stringify(c.options.map(normalize).sort()) && validContext(a.context) && scopeMatches(a, c, actual));
  for (const a of candidates) if (a.source !== 'user' || a.autoReuse !== true || !safeText(a.id, 200) || !a.id || !safeText(a.question, PIPELINE_LIMITS.question) || !safeText(a.answer, PIPELINE_LIMITS.answer) || a.profileRevision !== revision || !current(a.confirmedAt, a.validUntil, n)) return ask('saved answer untrusted, expired or profile revision changed');
  const values = candidates.map(a => compatibleValue(a.answer, c));
  if (values.some(v => v === null)) return ask('saved answer is not compatible with current control/options');
  if (new Set(values.map(normalize)).size > 1) return ask('contradictory saved answers');
  if (!direct.missing) {
    const value = compatibleValue(direct.value, c);
    if (value === null) return ask('verified fact incompatible with exact control/options');
    if (values.some(v => normalize(v) !== normalize(value))) return ask('saved answer contradicts verified profile');
    return { kind: 'fill', value, source: 'fact', factKey: c.meaning, profileRevision: revision };
  }
  if (candidates.length) return { kind: 'fill', value: values[0], source: 'savedAnswer', answerId: [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0].id, profileRevision: revision };
  return ask(direct.error || c.reason || 'no explicit confirmed fact or context-compatible saved answer; legacy form answers are untrusted');
}
export { resolveVerifiedAnswer as resolveAnswer };
export function buildVerifiedResume(profile) {
  if (!profile?.resumeApproved || !Number.isSafeInteger(profile?.revision) || profile.revision < 1 || !safeText(profile.resumeText, PIPELINE_LIMITS.resume) || !profile.resumeText.trim()) return { ok: false, reason: 'exact user-approved resume required' };
  return { ok: true, text: profile.resumeText, source: 'user', profileRevision: profile.revision };
}

/* Matching never makes candidate claims from a posting, resume parsing or AI.
 * Explicit exclusions are hard gates; the explainable score ranks survivors. */
const roleAliases = { 'front end engineer': 'frontend engineer', 'frontend developer': 'frontend engineer', 'front end developer': 'frontend engineer', 'back end engineer': 'backend engineer', 'backend developer': 'backend engineer', 'full stack developer': 'fullstack engineer', 'full stack engineer': 'fullstack engineer', 'software developer': 'software engineer' };
function role(v) { const n = normalize(v).replace(/-/g, ' ').replace(/^(?:intern|junior|mid|senior|staff|principal|lead)\s+/, ''); return roleAliases[n] || n; }
function list(v) { return Array.isArray(v) && v.length <= 200 && v.every(s => safeText(s, 200)) ? [...new Set(v.map(normalize).filter(Boolean))] : []; }
const FRONTEND_SKILLS = ['react', 'typescript', 'javascript', 'vue', 'angular', 'next', 'html', 'css'];
const BACKEND_SKILLS = ['node', 'python', 'java', 'c#', 'go', 'rust', 'ruby', 'php', 'kotlin', 'spring', 'django', 'flask'];
export function verifiedRoleFamily(title) {
  const value = normalize(title).replace(/-/g, ' ');
  if (/\b(full\s?stack)\b/.test(value)) return 'fullstack';
  if (/\b(front\s?end|ui engineer)\b/.test(value)) return 'frontend';
  if (/\b(back\s?end)\b/.test(value)) return 'backend';
  if (/\b(qa|sdet|test engineer|data|machine learning|devops|sre|security)\b/.test(value)) return 'specialist';
  return /\b(engineer|developer|architect)\b/.test(value) ? 'software' : 'other';
}
const requirementClauses = description => description.split(/\n|[.;](?=\s|$)|,\s*but\s+/i);
const mandatoryRequirement = clause => /\b(require[ds]?|must|essential|mandatory|proficien(?:t|cy)|expertise|strong (?:knowledge|experience)|backend development|back.end development)\b/i.test(clause);
const optionalRequirement = clause => /\b(preferred|optional|nice.to.have|not required|not necessary|no experience)\b/i.test(clause);
const requirementVocabulary = [...jdSkillVocabulary].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const requirementFillers = /\b(?:require[ds]?|must|essential|mandatory|proficien(?:t|cy)|expertise|strong|knowledge|experience|in|with|of|and|or|know|have|be|is|are|a|an|the|to|for|using|development|frontend|backend|front|back|end|application|applications|skills?|technical|programming|language|languages|not|necessary|no)\b/gi;
function mandatoryClauseUnderstood(clause) {
  // Recognizing one skill does not verify the rest of a mandatory sentence.
  // Unknown technologies, qualifications and quantified experience stay manual.
  const remainder = normalize(clause).replace(new RegExp(`(?<![a-z0-9+#])(?:${requirementVocabulary})(?![a-z0-9+#])`, 'gi'), ' ')
    .replace(requirementFillers, ' ').replace(/[\s,.:;()/&-]/g, '');
  return remainder.length === 0;
}
function verifiedRequirementsReadable(job) {
  if (!safeText(job?.description, PIPELINE_LIMITS.description) || !job.description.trim() || hostile(job.description)) return false;
  return requirementClauses(job.description).every(clause => {
    if (!mandatoryRequirement(clause)) return true;
    const normalized = clause.replace(/and\s*\/\s*or/gi, 'or');
    // Mixed operator precedence and unrecognized mandatory requirements need
    // human review, not an invented interpretation from a high overlap score.
    return extractVerifiedJobSkills(clause).length > 0 && mandatoryClauseUnderstood(clause) && !(optionalRequirement(clause) && !/\b(not required|not necessary|no experience)\b/i.test(clause))
      && !(/\b(or)\b|\//i.test(normalized) && /\band\b/i.test(normalized));
  });
}
export function extractVerifiedRequirements(job) {
  const title = typeof job?.title === 'string' ? job.title : '';
  const description = safeText(job?.description, PIPELINE_LIMITS.description) ? job.description : '';
  const all = [...new Set([...extractVerifiedJobSkills(title), ...extractVerifiedJobSkills(description), ...list(job?.skills).map(canonicalVerifiedSkill).filter(Boolean)])].sort();
  const groups = new Map();
  const add = (skills, core, evidence) => {
    const anyOf = [...new Set(skills)].sort();
    if (!anyOf.length) return;
    const key = anyOf.join('/'), previous = groups.get(key);
    groups.set(key, { anyOf, core: core || previous?.core === true, evidence: evidence.slice(0, 300) });
  };
  const alternatives = new Set();
  const tokens = [...jdSkillVocabulary, 'html', 'css'].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  for (const clause of requirementClauses(description)) {
    const required = mandatoryRequirement(clause) && !optionalRequirement(clause);
    const ranges = [];
    const expression = new RegExp(`(?<![a-z0-9+#])(${tokens})(?:\\s*(?:and\\s*\\/\\s*or|\\/|or)\\s*(${tokens}))+(?![a-z0-9+#])`, 'gi');
    for (const found of clause.matchAll(expression)) {
      const skills = extractVerifiedJobSkills(found[0]);
      if (skills.length < 2) continue;
      add(skills, required, clause);
      ranges.push([found.index, found.index + found[0].length]);
      skills.forEach(s => alternatives.add(s));
    }
    if (required) {
      const standalone = [...clause].map((ch, index) => ranges.some(([a, b]) => index >= a && index < b) ? ' ' : ch).join('');
      for (const s of extractVerifiedJobSkills(standalone)) add([s], true, clause);
    }
  }
  for (const s of extractVerifiedJobSkills(title)) add([s], true, title);
  for (const s of all) if (!alternatives.has(s) && !groups.has(s)) add([s], false, 'Posting skill');
  return [...groups.values()].sort((a, b) => a.anyOf.join('/').localeCompare(b.anyOf.join('/')));
}
export function verifiedSimilarityKey(job, requirements = extractVerifiedRequirements(job)) {
  const seniority = normalize(job?.title).match(/\b(intern|junior|senior|staff|principal|lead)\b/)?.[1] || 'unspecified';
  return JSON.stringify(['verified-match-v1', verifiedRoleFamily(job?.title), seniority,
    requirements.map(g => `${g.core ? 'core:' : ''}${g.anyOf.join('/')}`).sort(), canonicalCountry(job?.country), normalize(job?.location), job?.remote === true]);
}
export function decideVerifiedJob(job, { profile, settings = {}, learning, settingsRevision = 0, now } = {}) {
  const match = matchVerifiedJob(job, { profile, settings, now });
  const requirements = extractVerifiedRequirements(job), similarityKey = verifiedSimilarityKey(job, requirements);
  const adapter = adapterForJob(job), portal = adapter.boardIdentity || '', codes = [], n = time(now);
  const valid = validateVerifiedProfile(profile, now);
  const skillFact = valid.ok ? scopedFact(profile, 'skills', jobContext(job), n) : {};
  const confirmed = new Set(list(skillFact.value).map(canonicalVerifiedSkill));
  if (!Number.isSafeInteger(settingsRevision) || settingsRevision < 0) codes.push('settings_revision_invalid');
  const missingCore = requirements.filter(g => g.core && !g.anyOf.some(s => confirmed.has(s))).map(g => g.anyOf.join('/'));
  if (!match.eligible) codes.push(...match.reasons.map(reason => reason.startsWith('core') ? 'missing_core_skill' : 'match_veto'));
  if (missingCore.length) codes.push('missing_core_skill');
  if (!verifiedRequirementsReadable(job)) codes.push('requirements_unverified');
  if (normalize(job?.boardMatch) === 'low') codes.push('board_match_low');
  if (job?.boardMatch !== undefined && !['low', 'medium', 'high', 'unknown'].includes(normalize(job.boardMatch))) codes.push('board_match_invalid');
  const active = (row, timestamp) => record(row) && row.source === 'user' && row.revokedAt === null && safeText(row.id, 200) && row.id.trim()
    && row.profileRevision === profile?.revision && row.settingsRevision === settingsRevision
    && Number.isSafeInteger(row.settingsRevision) && row.settingsRevision > 0 && Number.isFinite(time(row[timestamp])) && time(row[timestamp]) <= n;
  const feedback = Array.isArray(learning?.feedback) ? learning.feedback.filter(row => active(row, 'confirmedAt')
    && ['exact', 'similar'].includes(row.scope) && ['apply', 'skip'].includes(row.verdict)) : [];
  if (feedback.some(f => f.verdict === 'skip' && (f.scope === 'similar' && f.similarityKey === similarityKey || f.scope === 'exact' && f.jobUrl === job?.jobUrl))) codes.push('user_skip_similar');
  const gaps = requirements.filter(g => !g.core && !g.anyOf.some(s => confirmed.has(s))).map(g => g.anyOf.join('/'));
  let status = codes.length ? 'manual_actionable' : gaps.length ? gaps.length <= 2 && match.score >= 60 ? 'waiting_match_answer' : 'manual_actionable' : 'eligible_review';
  if (status === 'manual_actionable' && !codes.length) codes.push('too_many_skill_gaps');
  const grants = Array.isArray(learning?.grants) ? learning.grants : [];
  const grant = grants.find(g => active(g, 'grantedAt') && g.similarityKey === similarityKey && g.portal === portal
    && Number.isFinite(time(g.expiresAt)) && time(g.expiresAt) > n && time(g.expiresAt) > time(g.grantedAt) && time(g.expiresAt) <= time(g.grantedAt) + 30 * 86400000);
  if (status === 'eligible_review' && adapter.supported && adapter.autoSubmit && grant && buildVerifiedResume(profile).ok) status = 'eligible_auto';
  return { ...match, eligible: status === 'eligible_review' || status === 'eligible_auto', status, codes: [...new Set(codes)], missingCore,
    requirements, similarityKey, portal, ...(status === 'waiting_match_answer' ? { question: { kind: 'skill_gap', skills: gaps,
      text: `Do you have experience with ${gaps.join(', ')}? Confirm it in your profile and approve the updated resume before reconsidering.` } } : {}),
    ...(status === 'eligible_auto' ? { grantId: grant.id } : {}),
    reason: codes.length ? `${match.eligible ? '' : match.reason + '; '}${[...new Set(codes)].join('; ')}` : gaps.length ? `Unconfirmed skills: ${gaps.join(', ')}` : status === 'eligible_auto' ? 'Current scoped autonomy grant; factual gates passed' : 'Factual gates passed; explicit scoped autonomy grant required' };
}
export function matchVerifiedJob(job, { profile, settings = {}, now } = {}) {
  const reasons = [], missing = [], matched = [];
  if (!record(job)) { reasons.push('malformed job snapshot'); job = {}; }
  if (!record(settings)) { reasons.push('malformed match settings'); settings = {}; }
  const n = time(now), ctx = jobContext(job), revision = profile?.revision || 0;
  const valid = validateVerifiedProfile(profile, now);
  const arraySettings = ['roles', 'excludedRoles', 'locations', 'excludedLocations', 'countries', 'excludeCompanies', 'excludedSkills'];
  if (!record(settings) || arraySettings.some(k => settings[k] !== undefined && (!Array.isArray(settings[k]) || settings[k].length > 200 || settings[k].some(v => !safeText(v, 200) || !v.trim()))) || ['requireWorkAuthorization', 'allowSponsorship'].some(k => settings[k] !== undefined && typeof settings[k] !== 'boolean')) reasons.push('malformed match settings');
  if (!valid.ok) reasons.push(...valid.reasons);
  if (!verifiedRequirementsReadable(job)) reasons.push('requirements unverified');
  if (!record(job) || !safeText(job.title, 500) || !job.title.trim() || !safeText(job.company, 500) || !job.company.trim() || !safeText(job.description, PIPELINE_LIMITS.description) || !safeText(job.location, 500) || !Array.isArray(job.skills) || job.skills.length > 200 || job.skills.some(s => !safeText(s, 200))) reasons.push('malformed or oversized job snapshot');
  if (!adapterForJob(job).safeUrl) reasons.push('unsafe job URL');
  const get = key => valid.ok ? scopedFact(profile, key, ctx, n) : { missing: true };
  const confirmedRole = get('role'), confirmedLocations = get('locations'), skillFact = get('skills');
  const wantedRoles = list(settings.roles?.length ? settings.roles : typeof confirmedRole.value === 'string' ? [confirmedRole.value] : []);
  if (!wantedRoles.length) { missing.push('role'); reasons.push('confirmed role or explicit role filter required'); }
  else if (!wantedRoles.map(role).includes(role(job?.title))) reasons.push('role does not match confirmed role/filter');
  if (list(settings.excludedRoles).map(role).includes(role(job?.title))) reasons.push('excluded role');
  if (list(settings.excludeCompanies).includes(normalize(job?.company))) reasons.push('excluded employer');
  const location = normalize(job?.location), wantedLocations = list(settings.locations?.length ? settings.locations : confirmedLocations.value);
  if (!wantedLocations.length) { missing.push('locations'); reasons.push('confirmed locations or explicit location filter required'); }
  else if (!wantedLocations.includes(location)) reasons.push('location not permitted');
  if (list(settings.excludedLocations).includes(location)) reasons.push('excluded location');
  if (settings.countries?.length && !settings.countries.map(canonicalCountry).includes(ctx.country)) reasons.push('country not permitted or missing');
  if (settings.requireWorkAuthorization !== false) {
    const auth = get('workAuthorization');
    if (auth.value !== true) { missing.push('workAuthorization'); reasons.push(auth.error || 'country-bound work authorization not confirmed'); }
  }
  const posted = job?.postedAt === undefined ? NaN : time(job.postedAt), ageHours = Number.isFinite(posted) && posted <= n ? (n - posted) / 3600000 : null;
  if (job?.postedAt !== undefined && ageHours === null) reasons.push('invalid or future posting date');
  if (settings.maxAgeDays !== undefined) {
    if (!Number.isFinite(settings.maxAgeDays) || settings.maxAgeDays < 0 || ageHours === null || ageHours > settings.maxAgeDays * 24) { reasons.push('posting freshness requirement not met'); if (ageHours === null) missing.push('postedAt'); }
  }
  const salary = job?.salary, minimum = settings.minimumSalary;
  if (minimum) {
    if (!Number.isFinite(minimum.value) || minimum.value < 0 || !canonicalCurrency(minimum.currency)) reasons.push('invalid minimum salary filter');
    else if (!record(salary) || !canonicalCurrency(salary.currency) || canonicalCurrency(salary.currency) !== canonicalCurrency(minimum.currency) || (salary.period || 'year') !== (minimum.period || 'year')) { reasons.push('salary currency/period missing or different; no implicit conversion'); missing.push('salary'); }
    else if (!Number.isFinite(salary.min ?? salary.max) || (salary.max ?? salary.min) < minimum.value) reasons.push('salary below minimum or malformed');
  }
  const groups = extractVerifiedRequirements(job);
  const required = groups.map(g => g.anyOf.join('/'));
  const confirmed = new Set(Array.isArray(skillFact.value) ? skillFact.value.map(canonicalVerifiedSkill).filter(Boolean) : []);
  if (!confirmed.size) { reasons.push(skillFact.error || 'no confirmed skills'); missing.push('skills'); }
  for (const group of groups) (group.anyOf.some(s => confirmed.has(s)) ? matched : missing).push(group.anyOf.join('/'));
  const missingCore = groups.filter(g => g.core && !g.anyOf.some(s => confirmed.has(s))).map(g => g.anyOf.join('/'));
  if (missingCore.length) reasons.push(`core skill missing: ${missingCore.join(', ')}`);
  const family = verifiedRoleFamily(job.title);
  if (['frontend', 'fullstack'].includes(family) && !FRONTEND_SKILLS.some(s => confirmed.has(s))) reasons.push('core frontend experience unconfirmed');
  if (['backend', 'fullstack'].includes(family) && !BACKEND_SKILLS.some(s => confirmed.has(s))) reasons.push('core backend experience unconfirmed');
  if (!required.length) { reasons.push('job skills missing; no inferred requirements'); missing.push('job.skills'); }
  if (list(settings.excludedSkills).map(canonicalVerifiedSkill).some(s => groups.some(g => g.anyOf.includes(s)))) reasons.push('excluded job skill');
  if (settings.allowSponsorship === false && get('requiresSponsorship').value !== false) reasons.push('country-bound sponsorship requirement not confirmed');
  const overlap = required.length ? matched.length / required.length : 0, threshold = settings.minSkillOverlap ?? 0.5;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1 || overlap < threshold) reasons.push('confirmed skill overlap below threshold');
  const score = Math.round(70 * overlap + (ageHours === null ? 0 : Math.max(0, 20 * (1 - ageHours / 168))) + (wantedLocations.includes(location) ? 10 : 0));
  if (settings.threshold !== undefined && (!Number.isFinite(settings.threshold) || settings.threshold < 0 || settings.threshold > 100 || score < settings.threshold)) reasons.push('deterministic match score below threshold');
  return { eligible: !reasons.length, score, reason: reasons.length ? reasons.join('; ') : `confirmed skill overlap ${matched.length}/${required.length}; role/location/auth filters passed`, reasons, matched, missing: [...new Set(missing)], ageHours, profileRevision: revision, source: 'deterministic' };
}
export function rankVerifiedJobs(jobs, input) {
  if (!Array.isArray(jobs) || jobs.length > PIPELINE_LIMITS.jobs) return [];
  return jobs.map(job => ({ job, match: matchVerifiedJob(job, input) })).sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score || String(a.job?.jobUrl || '').localeCompare(String(b.job?.jobUrl || '')));
}
export function validateInPlaceApplication({ job, profile, evidence, now } = {}) {
  const adapter = adapterForJob(job), n = time(now), no = reason => ({ ok: false, reason });
  if (!['naukri', 'instahyre'].includes(adapter.id) || !adapter.supported || !adapter.autoSubmit) return no('only known in-place Naukri/Instahyre application contracts permitted');
  if (!validateVerifiedProfile(profile, now).ok || !buildVerifiedResume(profile).ok) return no('exact verified profile and approved resume required');
  const ctx = { ...jobContext(job), portal: adapter.boardIdentity };
  const confirmed = ['portalProfileApproved', 'portalAccountIdentity', 'portalResumeText'].map(key => scopedFact(profile, `${key}:${adapter.id}`, ctx, n));
  if (confirmed.some(f => !f.fact || f.fact.scope?.portal !== adapter.boardIdentity || !f.fact.validUntil || time(f.fact.validUntil) - time(confirmedTime(f.fact)) > 30 * 86400000)) return no('three user facts scoped to exact portal with explicit expiry within 30 days required');
  const [approved, account, resume] = confirmed;
  if (approved.value !== true || !safeText(account.value, 500) || !account.value.trim() || resume.value !== profile.resumeText) return no('saved portal profile/account/resume does not match exact approved base');
  if (!evidence || evidence.accountIdentity !== account.value || evidence.noQuestionsObserved !== true || evidence.profileReady !== true || evidence.applyControl?.role !== 'button' || evidence.applyControl.enabled !== true || !safeText(evidence.applyControl.name, 300) || !adapter.applyButtonText.test(evidence.applyControl.name)) return no('observed same account, profile readiness and no-questions pinned apply control required');
  return { ok: true, reason: 'known in-place saved-profile apply explicitly confirmed for exact account/profile/resume' };
}
export function preflightApplication(input = {}) {
  const { job, profile, answers, fields, approval, answerBankVersion, now, cancelled, budget, session, policy } = input, reasons = [], n = time(now);
  const valid = validateVerifiedProfile(profile, now);
  if (!valid.ok) reasons.push(...valid.reasons);
  const resume = buildVerifiedResume(profile);
  if (!resume.ok) reasons.push(resume.reason);
  if (cancelled !== false) reasons.push('cancelled or cancellation state unknown');
  if (!budget || budget.allowed !== true || !Number.isSafeInteger(budget.remaining) || budget.remaining <= 0) reasons.push('budget unavailable or exhausted');
  if (!session || session.ok !== true || session.jobUrl !== job?.jobUrl || !current(session.checkedAt, undefined, n) || n - time(session.checkedAt) > 300000) reasons.push('fresh exact-job session preflight required');
  const adapter = adapterForJob(job);
  if (!policy || policy.autoSubmit !== true || adapter.autoSubmit !== true) reasons.push('portal policy forbids automatic submission');
  if (!approval || approval.jobUrl !== job?.jobUrl || approval.profileRevision !== profile?.revision || !Number.isSafeInteger(answerBankVersion) || answerBankVersion < 0 || approval.answerBankVersion !== answerBankVersion || !resume.ok || approval.resumeText !== resume.text || !current(approval.approvedAt, approval.validUntil, n)) reasons.push('approval does not match exact job/resume/profile/answer-bank version');
  const inPlace = Array.isArray(fields) && fields.length === 0 && validateInPlaceApplication({ job, profile, evidence: session?.inPlace, now }).ok;
  if (!Array.isArray(fields) || fields.length > 200 || (fields.length === 0 && !inPlace)) reasons.push('verified application fields missing or malformed');
  if (Array.isArray(fields) && fields.some(f => typeof f.required !== 'boolean' || classifyQuestion(f, job).meaning === 'invalidQuestion')) reasons.push('invalid application field metadata or mandatory flag');
  const resolutions = Array.isArray(fields) && fields.length <= 200 ? fields.map(f => resolveVerifiedAnswer(f, { profile, answers, job, now })) : [];
  for (let i = 0; i < resolutions.length; i++) {
    const r = resolutions[i], f = fields[i];
    if (r.kind === 'ask' && f.required && !(fieldShape(f).controlType === 'file' && r.meaning === 'resume' && resume.ok)) reasons.push(`mandatory answer missing: ${r.meaning}`);
    if (r.kind === 'fill' && r.profileRevision !== profile?.revision) reasons.push('resolved answer profile revision mismatch');
    if (r.kind === 'fill' && f.required && fieldShape(f).controlType === 'checkbox' && r.value !== 'true' && classifyQuestion(f, job).meaning === 'manualAttestation') reasons.push('required consent was explicitly declined; do not submit');
    if (r.kind === 'manualAttestation' && f.required && !(approval?.attestations || []).some(a => a.source === 'user' && a.questionKey === questionBatchKey(f, job) && current(a.confirmedAt, undefined, n) && time(a.confirmedAt) >= time(approval.approvedAt))) reasons.push('mandatory consent/attestation requires fresh exact-question approval');
    if (f.controlType === 'file' && !resume.ok) reasons.push('approved resume upload missing');
  }
  return { ok: !reasons.length, reasons: [...new Set(reasons)], resolutions };
}
