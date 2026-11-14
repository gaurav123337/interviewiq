# Verified autonomous auto-apply

## What is being changed

The new workflow is **job-first**: collect permitted public postings, match them against confirmed preferences and skills, queue jobs for a selected paired machine, inspect each form, resolve verified answers, and submit only where permitted with confirmation evidence.

The web app no longer needs Telegram to start that pipeline. Telegram is an optional outcome channel. The older owner-only Run command stays explicitly labelled as legacy; it still requires its own installed listener and session profile.

## One-time setup

1. Sign in and pair the local agent with `npm run apply:pair`.
2. Open Jobs → Verified application pipeline.
3. Import your **own** saved profile/resume as a draft, or enter facts manually. Review and confirm them; extracted drafts are never automatically verified.
4. Approve the exact base resume text. The worker does not add experience or skills from a job description.
5. Set roles, locations/countries, company exclusions, salary/currency rules, matching threshold, application caps and quiet hours. Automation and automatic submission are explicit opt-ins.
6. Select the intended paired machine. Sign in through its browser when prompted; ordinary Chrome login and another machine's sessions are not assumed.
7. Start the local worker with Node22:

```bash
npm run apply:setup
npm run apply:agent -- --agent-config "<external-binding-config>"
```

`--once` performs one bounded poll cycle. Without it, the worker polls tasks while the machine is online. This command does not install autostart or an OS scheduled task. A persistent installation/restart is a separate deliberate operation.

## Ask once, with context

New required questions appear in an Action needed inbox. Confirm the answer and its reuse scope. Equivalent valid questions reuse it automatically; different countries, currencies, employers, options or meanings do not.

Examples:
- Work authorization and sponsorship are distinct country-specific facts.
- Current versus expected salary and their currency/period are not interchangeable.
- Experience in a particular skill requires that declared skill-specific experience—not total career duration.
- User corrections/profile revisions invalidate stale plans and answers.
- New legal terms require explicit application-specific confirmation; they are never blanket checked. A declined required consent blocks submission.
- Optional sensitive demographics are not inferred.

Unknown facts pause only the affected job. Other eligible jobs continue. Confirmation can resume the paused job without re-asking equivalent questions, but no uncertain submit attempt is automatically replayed.

Passwords and cookies remain in that binding's local browser profile. Sign-in/check commands select a persisted eligible job for the chosen agent, so a worker restart does not depend on remembered tabs. A portal sign-in command is not permission to submit or to review a different application.

Human-only questions use **Open question for human review** to open the exact linked application in a bounded local review window. The worker never answers those questions, clicks Submit in that window, or treats closing the window as proof of an application. Independent eligible portals can continue while a human sign-in/review is pending; the same portal waits to avoid competing with the human session.

## Existing profile-only portals

Naukri/Instahyre in-place application paths require a verified browser account and a fresh explicit confirmation that the portal's saved profile/resume matches your exact approved resume. Each portal has its own scope and account identity; approving one cannot authorize another. The confirmation expires (at most30days), and editing the base resume invalidates it.

The worker must observe the pinned Apply control, correct account and no unresolved required form questions. If it cannot establish those conditions, it requests review instead of guessing. This confirmation is not permission to bypass portal restrictions.

## Discovery and support boundaries

Known keyless Greenhouse, Lever and Ashby feeds are collected without candidate details, cookies or provider credentials. New boards discovered from public feed URLs are owner-private pending sources, not automatic global permissions. Unsupported/new sites remain collection or review-only until a tested adapter supports them.

A high JD-match score cannot invent eligibility or authorize a forbidden submit path. LinkedIn remains review-only. CAPTCHA, OAuth/OTP, account challenges, new attestations and unsupported controls remain legitimate human stops.

## Truthful status and retry

- Run and task IDs are separate from browser tabs. Progress comes from persisted task states.
- Agent offline/login needed/answer needed/unsupported/review/unverified are shown separately.
- A reserved attempt is persisted **before** the submit click.
- A crash or ambiguous post-click acknowledgement produces unverified status and requires reconciliation; it does not retry Apply blindly.
- Confirmed results keep their original event timestamps. Notification failure does not change the application outcome or rerun it.
- Leases, binding identity, profile/answer/settings revisions, cancellation and budgets are rechecked before submission.

On Windows, keep the binding's external state/config location short enough for Chromium file uploads. A deeply nested custom temporary/state root can let a file input appear populated while multipart upload fails; the worker must leave that attempt unverified, not infer success. Local fixtures use short disposable temp roots. An unverified application is never retried automatically merely because a path or environment was corrected.

## Verification and rollout

Implementation uses pure resolver/adapter tests, real local synthetic worker/browser fixtures, disposable PostgreSQL ownership/lease/reservation proofs and frontend fixtures. A green website test alone does not establish real logged-in portal success.

No production migration, actual portal login, existing runner restart, schedule installation, Telegram message or real application is part of local testing. These require the applicable separate approval. Keep implemented, locally verified, deployed and live-verified status distinct.
