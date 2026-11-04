/* apply-kit-lib — Phase 2 human-in-the-loop tailoring parity (PURE logic).
 *
 * Sits between the kit generator (apply-kit-node.js, AI-tailored artifacts)
 * and the submit decision in the driver: what changed vs the master, WHY
 * (which JD keywords justify each section's edit), and whether the engine
 * may auto-submit an LLM-authored resume at all.
 *
 * Everything here is deterministic and vitest-pinned
 * (src/__tests__/applyKitTailor.test.ts). The driver never holds a submit
 * decision the gate closes. Never invents content — diffs only.
 */

/** Small deterministic djb2-ish hash → hex variant id (NOT crypto — ids must
 *  be stable across runs/machines so the version history dedupes by content). */
export function stableVariantId(text) {
  let h = 5381;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
  return `v${h.toString(16)}`;
}

const SECTION_RE = /^#{1,4}\s+(.*)$/;

/* A template resume uses UPPERCASE heading lines (SUMMARY / SKILLS /
   EXPERIENCE…); the AI rewrite is told "keep the same sections" so it
   inherits that shape, but may render them as markdown instead — both
   count, plain prose must not. */
const UPPER_RE = /^([A-Z][A-Z0-9 \-/&,#.:]{1,40})$/;

/** Split a resume's plain text into { heading, lines } sections. Text before
 *  the first heading lands under "(header)" (name, contact…). Whitespace
 *  only; never throws. */
export function splitResumeSections(text) {
  const lines = String(text ?? "").split("\n");
  const out = [];
  let cur = { heading: "(header)", lines: [] };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const md = line.match(SECTION_RE);
    /* an ALL-CAPS line is a section heading only when there IS body content
       above it — the template's first two lines (NAME, contact) are rendered
       uppercase too; promoting the very first line left the resume headerless
       and hid the name from the diff */
    const upper = md ? null : cur.lines.some((l) => l.trim()) ? line.match(UPPER_RE) : null;
    if (md || upper) {
      if (cur.heading !== "(header)" || cur.lines.length) out.push(cur);
      cur = { heading: md ? String(md[1]).trim() : String(upper[1]).trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.heading !== "(header)" || cur.lines.length) out.push(cur);
  return out;
}

function lcsDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", text: a[i] }); i++; }
    else { out.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < n) { out.push({ type: "del", text: a[i] }); i++; }
  while (j < m) { out.push({ type: "add", text: b[j] }); j++; }
  return out;
}

const normHeading = (h) => String(h ?? "").toLowerCase().replace(/[#_. ]+/g, "");

/** Which of `jdKeywords` justify this section's EDIT? Word-boundary,
 *  case-insensitive match against the ADDED lines only — the justification
 *  must point at what changed, not at text that was already on the master
 *  (a keyword the master already carried must never be claimed as the
 *  reason for an edit). */
export function keywordsSupportingChange(addedLines, jdKeywords) {
  const blob = addedLines.join("\n").toLowerCase();
  const out = [];
  for (const k of Array.isArray(jdKeywords) ? jdKeywords : []) {
    const kw = String(k ?? "").trim();
    if (!kw || out.includes(kw)) continue;
    let re;
    try { re = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i"); }
    catch { continue; }
    if (re.test(blob)) out.push(kw);
  }
  return out;
}

/** Phase 2 tailoring preview: per-section diff of the master resume vs the
 *  tailored variant, with JD-keyword justification per changed section.
 *  Returns { sections, changedCount, matchedKeywords } — pure, honest about
 *  sections ADDED (no master counterpart, status "changed", no dels). */
export function previewTailoredResume(masterText, variantText, { jdKeywords = [] } = {}) {
  const master = splitResumeSections(masterText);
  const variant = splitResumeSections(variantText);
  const byHeading = new Map(master.map((s) => [normHeading(s.heading), s]));
  const sections = [];
  const globalMatched = [];
  for (const vs of variant) {
    const ms = byHeading.get(normHeading(vs.heading));
    const lines = lcsDiff(ms ? ms.lines.filter((l) => l.trim()) : [], vs.lines.filter((l) => l.trim()));
    const changed = lines.some((l) => l.type !== "same");
    const supporting = changed ? keywordsSupportingChange(lines.filter((l) => l.type === "add").map((l) => l.text), jdKeywords) : [];
    for (const k of supporting) if (!globalMatched.includes(k)) globalMatched.push(k);
    sections.push({
      heading: vs.heading,
      status: (changed ? "changed" : "unchanged"),
      lines,
      matchedKeywords: supporting,
    });
  }
  return { sections, changedCount: sections.filter((s) => s.status === "changed").length, matchedKeywords: globalMatched };
}

/** The Phase 2 SUBMIT gate for LLM-authored content — fail-closed:
 *  an AI-tailored kit may not auto-submit unless the profile pre-consents
 *  (autoTailor: true) or this specific variant was approved. A template /
 *  master kit wrote nothing new, so it needs no approval. ABSENT llmAuthored
 *  is UNKNOWN authorship → blocks (a gate must never default open). */
export function tailorSubmitGate({ llmAuthored, autoTailor, approved } = {}) {
  if (llmAuthored === false) return { canSubmit: true, reason: "kit is the deterministic master/template — nothing AI-authored to approve" };
  if (llmAuthored !== true) return { canSubmit: false, reason: "kit authorship unknown — holding auto-submit (fail-closed)" };
  if (autoTailor === true) return { canSubmit: true, reason: "profile autoTailor:true — owner pre-consented to LLM tailoring" };
  if (approved === true) return { canSubmit: true, reason: "tailored variant approved" };
  return { canSubmit: false, reason: "LLM-tailored resume is unapproved — holding auto-submit (human approves in review first)" };
}

/** Version history for tailored variants. Pure: newest first, deduped by
 *  variant id (same content ⇒ same id — no twin rows), capped at `max`
 *  so a long campaign never bloats the record. */
export function appendResumeVariant(history, entry, { max = 25 } = {}) {
  const id = entry?.id || stableVariantId(entry?.resume || entry?.text || JSON.stringify(entry ?? {}));
  const e = { ...entry, id };
  return [e, ...(Array.isArray(history) ? history : []).filter((h) => h?.id !== id)].slice(0, Math.max(1, max));
}
