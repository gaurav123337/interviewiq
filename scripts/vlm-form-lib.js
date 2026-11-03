/* vlm-form-lib — pure decisions for the Tier-4 VLM form fallback (Phase 3 of
 * docs/auto-apply-parity-plan.md). Everything here is hand-writable logic with
 * no Playwright/provider imports, pinned by src/__tests__/vlmFormLib.test.ts.
 *
 * WHY THIS TIER EXISTS: the engine's extractors are DOM-driven (selectors,
 * frames, accessibility dumps). A handful of exotic forms (custom shadow-DOM
 * widgets, canvas-rendered UIs) expose NO visible controls to any query —
 * fillColor=0, every required field becomes needs-review, the job stalls.
 * The owner's screens (Hark-style computer use) solve that with raw vision.
 * We take the SAME idea but keep our difference: the model NEVER supplies
 * values, only FIELD METADATA (what labels it can see). Answers still come
 * from planFormAnswers on the verified profile — hallucination stays
 * structurally impossible; the submit gates stay exactly as fail-closed. */

/** Hard ceiling on fields parsed from one screenshot — a "form" claiming more
 *  is junk output, not a form (and caps token spend in the reply). */
export const MAX_VLM_FIELDS = 40;

/** Kinds the driver knows how to act on. Everything else is parsed but SKIPPED
 *  with an honest reason (file uploads and radios need option-list grounding a
 *  screenshot cannot give reliably). */
export const VLM_FILLABLE_KINDS = ["text", "textarea", "email", "tel", "url", "number", "date", "select", "checkbox"];

/** The fill cap per single VLM attempt. A real mitigation against prompt
 *  injection (a page can paint 500 fake "labels") — bounded work per call. */
export const MAX_VLM_FILLS_PER_ATTEMPT = 25;

/** Gate for the driver: attempt the VLM fallback ONLY when it can help.
 *  - no AI provider → nothing to call;
 *  - DOM already found fields → the cheaper deterministic path owns it;
 *  - the owner's per-site rule may veto (`rules.vlmFill: false`), defaulting
 *    to ON because this tier only ever runs where DOM extraction found
 *    nothing, and it can only ADD profile-drafted answers — every submit
 *    decision is unchanged. */
export function vlmFillEligible({ fieldsCount = 0, hasAi = false, rules = null } = {}) {
  if (!hasAi) return { ok: false, reason: "no AI provider configured" };
  if (fieldsCount > 0) return { ok: false, reason: "DOM extraction already found fields" };
  if (rules && rules.vlmFill === false) return { ok: false, reason: "site rule vlmFill=false" };
  return { ok: true, reason: "" };
}

/** Prompt pair for the extraction call (no image here — the Kit shim attaches
 *  the screenshot as a message part; these strings only define the CONTRACT:
 *  respond with metadata about what you SEE, never fill values, never yours to
 *  invent). Page text rides as DATA, never as instructions. */
export function vlmFieldsPrompt(pageTitle = "") {
  return {
    system:
      'You extract FORM FIELD METADATA from a screenshot of a job-application page. ' +
      'Return ONLY a JSON array, one object per visible form field:\n' +
      '[{"label":"<exact visible label text>","type":"text|textarea|email|tel|url|number|select|checkbox|radio|file|other","required":true|false,"options":["<exact option text>"]?}]\n' +
      'Rules: label must be copied VERBATIM from the screenshot (asterisk ⇒ required:true). ' +
      'options ONLY for select/radio. type "other" for anything you cannot classify. ' +
      'NEVER invent or suggest answer values. You describe fields ONLY.',
    user:
      (typeof pageTitle === "string" && pageTitle.trim() ? `Page title: ${pageTitle.trim().slice(0, 120)}\n` : "") +
      'List every form field visible in this screenshot. JSON array only, no commentary.'
  };
}

/** Parse the model reply into { fields, skipped } — fail-closed, permissive on
 *  formatting (code fences, prose around JSON), strict on content (unknown
 *  entries are SKIPPED and counted, never guessed into a kind). Points out:
 *  - parse failure / non-array / empty → fields:[] (caller skips the tier);
 *  - unusable kinds (file/radio/other) are returned but flagged so the driver
 *    pushes them to needs-review instead of touching the control. */
export function parseVlmFields(raw) {
  const out = { fields: [], skipped: 0 };
  if (typeof raw !== "string" || raw.trim().length === 0) return out;
  /* fenced or bare: find the FIRST object within a [...] block — scan between
     the first '[' and its matching ']' so prose before/after is tolerated. */
  const start = raw.indexOf("[");
  if (start < 0) return out;
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return out;
  let arr;
  try { arr = JSON.parse(raw.slice(start, end + 1)); } catch { return out; }
  if (!Array.isArray(arr)) return out;
  for (const item of arr.slice(0, MAX_VLM_FIELDS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) { out.skipped++; continue; }
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 160) : "";
    const rawType = typeof item.type === "string" ? item.type.toLowerCase().trim() : "";
    if (!label) { out.skipped++; continue; }
    const kind = VLM_FILLABLE_KINDS.includes(rawType) ? rawType : "other";
    out.fields.push({
      label,
      kind,
      fillable: kind !== "other",
      required: item.required === true,
      options: [...(Array.isArray(item.options) ? item.options : [])]
        .filter((o) => typeof o === "string" && o.trim().length > 0 && o.trim().length <= 120)
        .map((o) => o.trim())
        .slice(0, 20)
    });
  }
  return out;
}
