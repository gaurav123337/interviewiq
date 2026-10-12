# Four Engine Capability Improvements

> **2026-10-11 — ALL FOUR ITEMS NOW WIRED** (commit 08944497+): extractJdSkills is
> jdSkillMatch's single JD scanner; detectSubmissionSuccess is the pinned
> success detector at both submit doors (JS-click + auto-submit, page+frame);
> Instahyre badge pre-filter (instaMatchFromCardText → __instaMatch →
> instaSkip — LOW skips gates, missing badge never rejects); smarter fitScore
> with evidence-gated seniority-gap (−8/run, cap 16) and outside-preferred-
> location (−10) penalties. 8 new test pins; 1678/1678 green.
>
> **2026-10-12 — OWNER-VISITABLE OPT-IN/OUT**: `rules.boardMatch` on each job_sites
> row (🎯 match: on / off / default in the registry panel; `admin_set_site_rules`
> RPC, SQL pending manual apply) opts any board into the pre-filter without a
> code change or turns it off for a builtin site. Lib: `boardMatchSkip(…, opts)`;
> driver threads the opt through collectJobs + openJob + the gate. SQL NOT yet
> applied — the toggle errors honestly until it is.
>
> **2026-10-12 — PRE-FILTER GENERALIZED TO LINKEDIN + NAUKRI**: LinkedIn's "your
> profile matches N% / Top Applicant" detail-page signal and Naukri's narrow card
> badge join Instahyre's badge via `boardMatchSkip` (allowlist instahyre/
> linkedin/naukri; LOW-only; missing signal never rejects). LinkedIn's
> match lives on the DETAIL page (openJob captures it; verified against
> LinkedIn's own help docs), naukri cards carry promo-% noise (20-30% hike) so
> its parser only trusts explicit match badges, linkedin cards carry no match
> signal at all and never parsed one. Legacy __instaMatch still honored on
> instahyre. 6 new pins; 1684/1684 deterministic green.

## 1. Full JD Capture ✅ IMPLEMENTED
**Extract skill chips and tags from job postings, not just description text**

- Added `extractJdSkills(description)` function to extract canonical skills from JD text
- Scans entire description for skill keywords using SKILL_ALIASES mapping
- Captures skills from "Key Technologies", "Required Skills", and inline mentions
- Returns deduped set of canonical skills (e.g., "Next.js" → "react")
- **Impact**: Better skill matching when JD lists skills in structured sections vs prose
- **Files modified**: scripts/apply-engine-lib.js, scripts/apply-engine-lib.d.ts

---

## 2. Verify Submissions ✅ IMPLEMENTED
**Detect success text reliably and catch false-applied cases**

- Added `detectSubmissionSuccess(pageText, siteKey)` function
- Uses site-specific `successText` regex from SITE_RULES (already defined per site)
- Returns `true` ONLY when success text is detected (fail-closed)
- Prevents "missing success text" from being recorded as success
- **Impact**: Catches false-submitted cases like "submit button not found (may already be applied)"
- **Files modified**: scripts/apply-engine-lib.js, scripts/apply-engine-lib.d.ts

---

## 3. Smarter Fit Score ✅ INTEGRATED 2026-10-11
**Incorporate seniority, location, and core function into fit calculation**

**Current approach**: Keyword overlap only — matched/(matched+missing)×100 with core-missing penalty

**Shipped 2026-10-11**:
- `fitScore(matched, missing, coreMissing, opts)` with `jobSeniority`/`profileSeniority` (−8 per rung the job outranks the profile, capped 16; more-senior-than-job never penalized), `location` + `preferredLocations` (−10 for known non-remote outside-preference). `coreFunction` deliberately NOT absorbed here — core-stack mismatch is the AI judge's missingCore penalty (already wired) and role-family mismatch is `titleFieldMismatch` (a hard gate), so a third number would double-count the same evidence.
- Example: React Dev (mid-level, Bangalore) applying to Senior React role (NYC) = lower fit than exact match
- **Impact**: More realistic ranking in review queue; owner spends time on high-fit jobs first
- **Status**: Design ready, needs integration with job gate

---

## 4. Use InstaMatch Signal ✅ INTEGRATED 2026-10-11
**Pre-filter low-match jobs on Instahyre before exploring them**

**Current Instahyre behavior**: No pre-filtering; engine explores every job

**Proposed approach**:
- Read Instahyre's `instaMatch` attribute (appears in opportunities list as color badge)
- **LOW** (red badge) = skip immediately (engine agrees with their ML)
- **MID** (yellow badge) = explore with skill gate + judge
- **HIGH** (green badge) = prioritize; often auto-apply
- Example: SDET role with LOW InstaMatch for Frontend profile = skip without gate cost
- **Impact**: Saves gate evaluations on obviously wrong matches; respects their signal
- **Generalized 2026-10-12**: `instaMatchFromCardText` → `linkedinMatchFromDetailText`/
  `naukriMatchFromCardText`/`instaSkip` (alias) with `BOARD_MATCH_SITES`
  allowlist = instahyre + linkedin + naukri, stamp `__boardMatch` on every
  explicit collector; obfuscated-class-name collector keeps its instahyre-only
  `__cardText` capture. LinkedIn's signal is on the DETAIL page (OpenJob
  captures from the last learned pageText; verified against their help docs);
  naukri's parser only trusts explicit match badges (its cards carry
  "20-30% hike"-style promo % that a generic parser would misread);
  linkedin cards carry no match signal at all and never parsed one.

---

## Current State (as of Oct 2, 2026)

### ✅ Already merged (PR #164)
- Title field mismatch detector (`titleFieldMismatch`)
- Exemplar stopword filter
- Judge prompt hardening
- Fit score core-missing penalty
- Tests: 66/66 passing

### ⚙️ Ready to integrate
- `extractJdSkills(description)` — use in `jdSkillMatch` flow
- `detectSubmissionSuccess(pageText, siteKey)` — call after form submit in `auto-apply-jobs.js`
- Smarter fit score enhancements — minor signature change to `fitScore()`
- Instahyre signal parsing — read from job object during gate evaluation

### 📊 Recommendation for next phase
1. **Implement extractJdSkills integration** — highest ROI, simplest change
2. **Implement detectSubmissionSuccess** — critical for honest submit tracking
3. **Add Instahyre signal** — pre-filter saves engine cycles
4. **Enhance fit score** — nicest-to-have, good for UX but less urgent

---

## Testing Strategy
- Unit tests for each new function (follow applyEngine.test.ts pattern)
- Integration test: full JD capture + skill matching on a real posting
- Regression: all existing 66 tests must still pass
- End-to-end: run on Instahyre with new signal filtering
