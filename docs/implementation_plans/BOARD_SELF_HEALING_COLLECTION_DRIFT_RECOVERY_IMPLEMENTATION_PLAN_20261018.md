# Board Self-Healing — Collection Drift Recovery Without Human Input

**Timestamp:** **2026-10-18T08:35:00.000Z (UTC) | 18-10-2026 14:05:00 (IST)**

## Overview

Closes the last human-input requirement at collect time. Until now a board
that redesigned its list markup produced a "collection drift" counter and a
digest line asking the owner to re-run/check selectors; worse, the
report-side learner's `listLinkPattern` was persisted every run but never
read back by the collector — the learn→use loop had no use half. This
change makes the collector read back, retry, and heal.

## The loop, end to end

1. **Hint ladder (read-back)** — `collectHintsForSite` builds the collect
   order: persisted list-heal pattern first, then the learner's
   `listLinkPattern`, then builtin hints. Generic broad hints are
   deliberately NOT in the primary pass (tight-scope boards — instahyre,
   naukri — would re-acquire fail-open unknown-kind noise).
2. **Widen retry** — primary ladder collected zero → the SAME in-page scan
   re-runs once with the generic superset merged in (recovery on markup
   churn without any AI call).
3. **AI list heal** — still zero → ONE heal: `dumpControlsForHeal` →
   `aiHealButton(ai, controls, "open a real job posting from the list")` →
   re-scan verification (`healPickVerifies`, verbatim name, conf ≥ 0.8) →
   matching anchors collected as `__navCandidate` rows → the NORMAL
   adjudicator decides posting-vs-nav. The pick cannot inject chrome no
   matter what it returns; nothing is ever clicked at this layer.
4. **Persist on success** — `postingHintFromUrl(out[0].url)` derives the
   board's detail-path pattern; `persistHealedListPattern` writes
   `healedListPattern` + a `collectHeal` counter to the registry rules blob
   (`engine_set_job_site_rules` merges it whole — no SQL change).
5. **Persist on failure** — drift is now recorded exactly ONCE, after all
   recovery paths fail, so the digest line means "self-heal ran and could
   not recover" instead of "check selectors".

Pure layer ([apply-engine-lib.js](../../../scripts/apply-engine-lib.js)):
`postingHintFromUrl` (canonical path substrings per known board family;
unknown boards derive the directory directly before the id-bearing
segment; injection-shield regex `HINT_TOKEN_RE`) and
`collectHintsForSite` (ordered, deduped, injection-proof). Driver:
[auto-apply-jobs.js](../../../scripts/auto-apply-jobs.js) — the in-page
scan is declared once and invoked per hint pass; `collectJobs` grew
`learnedRules`/`ai` params wired from `runSingle`.

## Verification

- `node --check` driver + lib: exit 0.
- `npx vitest run src/__tests__/applyEngine.test.ts`: **186/186** (5 new
  pins: per-family hint derivation incl. lever uuid boards, list-URL/garbage
  rejections, ladder order + dedupe, injection-payload rejection,
  null input tolerance).
- `npm run typecheck`: exit 0.
- Full pre-push gate (all files/tests, build, no-innerHTML): green.

## Boundaries kept deliberately

- Captchas + account-appeal flows remain human-only areas (policy).
- Facts the profile lacks still fail closed to the needs-review queue —
  the engine never invents answers.
- The heal requires a reachable AI provider; without one the widen retry +
  honest drift record are the fallback (no new hard failure modes).
