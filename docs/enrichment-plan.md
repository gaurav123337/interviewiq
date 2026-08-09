# InterviewIQ — v1 → v2 Enrichment Plan

> Prepared after the v1 milestone. Goal: turn a complete, capable product into one that
> competes on **revenue, realism and retention** without fighting the giants head-on.

---

## 1. Where v1 stands (honest snapshot)

InterviewIQ is a **free-first, offline-capable PWA** with a curated question engine that works
with no API key. What shipped:

- **Tailored sessions** — level (junior → CEO) × field (8) × company (~20, incl. general), or
  paste a **job description** for JD-tailored questions + model answers.
- **Mock interview loop** — full 45-min mode, per-question scoring (0–5), feedback, hints,
  results with grade + category breakdown + study-next suggestions.
- **Career roadmap** — goal wizard (role, target date, hours/week), optional skill diagnostic or
  self-assessment, week-by-week priority-ranked plan that **adapts to session results**.
- **Practice surfaces** — Question Bank, Drill mode (spaced repetition), deep-dive knowledge
  base (concepts, traps, Q&A, related topics) in every Learn drawer.
- **Code playground** — in-browser multi-language compiler (Pro-gated).
- **AI everywhere (optional key)** — feedback, hints, topic tutor, **RAG-grounded tutor
  answers with visible citations** from an admin-uploaded knowledge base.
- **Freemium** — paywall + quotas, Pro tier, cloud sync via Supabase (Google/GitHub OAuth),
  streaks + daily reminders (PWA notifications).
- **Admin/ops engine (the moat)** — user/business metrics, announcements, question-bank
  publishing, product config (feature flags, AI defaults, quotas), **auto-fill** (bulk import,
  PDF import + AI cleaning), **configurable weekly scraper** (sources + schedule from the
  dashboard, run-now), **review inbox** (editing, batch publish), **miss harvesting** (real
  user weak spots → drafts), **audit log with rollback**, RAG knowledge base.
- **Quality bar** — 177 unit/flow tests, typecheck clean, GitHub Pages deploy pipeline,
  schema fully verified on live Supabase.

## 2. Market landscape (2026)

| Player | Focus | Pricing (2026) | Standout |
|---|---|---|---|
| **LeetCode / HackerRank** | Coding problems, contests | ~$35/mo premium | The habit loop: daily problem + rating |
| **Interviewing.io** | Realistic mocks, FAANG style | **$179–$339/session**; AI interviewer tier | Real-engineer calibration, anonymity |
| **Pramp** | Peer mock interviews | ~$150/yr; free credits cut to 5/mo | Human practice, cheap |
| **Hello Interview** | SWE/EM, system design | **$47/mo, $79/yr, $279 lifetime**; mocks from $170 | Curated guides + AI-guided practice |
| **GreatFrontEnd** | Frontend only | subscription | 500+ questions, in-browser coding, prep plans |
| **Exponent / Interview Kickstart / Interview Query** | Courses + coaching | $200–$2,500 | Structured curricula, human coaches |
| **Final Round AI / Sidekick / Skillora** | AI interviewer + copilot | freemium → paid | Realistic recruiter simulations |
| **Google Interview Warmup** | Free voice practice | free | Voice-based, casual |
| **SmallTalk2Me / Yoodli** | Speaking/fluency | freemium | Feedback on delivery, not content |

**Pricing takeaway:** the market has collapsed into two bands — *cheap subscriptions*
($35–80/mo or ~$150/yr) for self-serve prep, and *expensive human mocks* ($170–340/session).
Nobody owns the **free-first + full-ladder + self-improving content** space.

## 3. Competitive matrix

| Capability | InterviewIQ | LeetCode | Interviewing.io | Hello Interview | GreatFrontEnd |
|---|---|---|---|---|---|
| Free tier that's genuinely usable | ✅ core, offline | ⚠️ limited | ❌ | ❌ | ⚠️ |
| Full ladder junior → CEO/CTO | ✅ | ❌ | ⚠️ | ⚠️ | ❌ |
| Field × company × JD tailoring | ✅ (incl. JD paste) | ❌ | ⚠️ | ⚠️ | ⚠️ |
| Mock interview + scoring + model answers | ✅ offline engine | ❌ | ✅ human/AI | ✅ AI | ⚠️ |
| **Voice mock interview** | ❌ gap | ❌ | ✅ | ✅ | ❌ |
| **Auto-graded coding (hidden tests)** | ❌ gap | ✅ | ✅ | ✅ | ✅ |
| Adaptive roadmap / study plan | ✅ | ⚠️ | ❌ | ⚠️ | ✅ plans |
| Spaced-repetition drill | ✅ | ❌ | ❌ | ❌ | ❌ |
| RAG knowledge base + citations | ✅ unique | ❌ | ❌ | ❌ | ❌ |
| Self-improving question bank (scraper, harvest) | ✅ unique | ❌ | ❌ | ❌ | ❌ |
| Admin dashboard / content ops | ✅ unique (B2B seed) | ❌ | ❌ | ❌ | ❌ |
| Real checkout (card payment) | ❌ gap (mailto) | ✅ | ✅ | ✅ | ✅ |
| Offline-first PWA | ✅ | ❌ | ❌ | ❌ | ❌ |
| User progress analytics | ⚠️ basic | ✅ strong | ⚠️ | ⚠️ | ⚠️ |
| Community / leaderboards | ❌ | ✅ | ✅ | ⚠️ | ❌ |

## 4. Where we win / where we lose

**Win (keep doubling down):**
1. **Free-first + offline** — works with no account, no key, no network. Unique.
2. **Full-ladder, tailored prep** — junior→CEO × field × company × JD. Broadest coverage.
3. **Self-improving content engine** — scraper + review + harvest + RAG is a moat no
   subscription competitor has; it keeps content fresh at ~zero editorial cost.
4. **Admin/ops = future B2B** — the dashboard is already a "product console"; teams could
   white-label it (orgs, seats, custom question banks).

**Lose (fix or consciously defer):**
1. **No voice interview** — every realistic competitor has it; the biggest realism gap.
2. **No auto-graded coding** — the playground compiles but doesn't judge; can't serve the
   LeetCode-style habit loop.
3. **No real checkout** — paywall is on, but Pro can't be bought. Revenue = 0 until fixed.
4. **Thin user analytics** — no skill radar / trend / streak calendar facing the user.
5. **No marketing surface** — single-page JS app, no SEO landing, no shareable results.
6. **No community** — fine to defer; expensive to build, low priority for v2.

## 5. Tomorrow's plan (prioritized)

Ordered by **impact ÷ effort**, sized for one focused session. P0 first.

### P0 — revenue + realism (highest impact)

**1. Voice mock interview (realism)**
- Browser-native: `webkitSpeechRecognition`/`SpeechRecognition` (transcribe answers) +
  `speechSynthesis` (interviewer speaks the question). No new dependencies.
- Add "🎤 Respond out loud" toggle in the Interview view; transcript becomes the answer
  (still editable); TTS reads questions when enabled. Works offline in the PWA.
- Gate: Pro (voice is the classic upsell). Files: `src/services/voice.ts` (new),
  `src/components/Interview.tsx`, entitlements check.
- DoD: voice round-trip test in a real browser; graceful fallback when API missing.

**2. Real checkout (revenue)**
- Set `CONFIG.proUrl` to a Lemon Squeezy / Stripe payment link (one-time + monthly).
- Upgrade modal: clean plan comparison + "Unlock Pro" button → payment link →
  return-URL deep-link; entitlements already key off `getTier()`.
- DoD: purchase flow opens, tier flips to `pro` on return, quota gating lifts.

**3. Coding judge (stretch P0)**
- Extend the playground: problems carry hidden test cases (add to bank schema + admin
  editor); run against submitted code, compare outputs, report pass/fail + score into the
  session result. This is the biggest piece — split if the session runs long.

### P1 — retention + differentiation

**4. User progress analytics** — skill radar (per-field skills from history coverage),
week-over-week score trend, streak calendar, weak-topic list → "practice these". Data
already exists (`services/progress.ts`, history, roadmap progress). New view under
`/progress` or a Profile tab.

**5. STAR behavioral coach** — dedicated behavioral mode: situational questions + STAR
framework feedback (data for behavioral already in the deep-dive KB; wire into a mode with
a STAR-specific scorer).

**6. Miss-feedback loop to the roadmap** — push harvest/miss data into the roadmap's
weak-topic weeks automatically (extends `applySessionToProgress`).

### P2 — growth + polish (defer or parallel)

**7. SEO landing + shareable results** — static landing (meta/OG), "Share my result" cards.
**8. Certificates** — printable completion certificate after a mock interview pass.
**9. Resume import** — PDF resume → skill/JD extraction to seed the roadmap goal.
**10. Team/enterprise** — orgs, seats, white-label admin (long-term moat play).

## 6. How to win (positioning for v2)

> **"The only free, offline-first interview coach that takes you from junior to CEO —
> with a question bank that writes itself and an admin console your team can run."**

Don't fight LeetCode on problems or Interviewing.io on human mocks. Win on:
**coverage** (full ladder × field × company), **frictionlessness** (free, offline, no
account), **fresh content** (self-improving pipeline), and later **team delivery** (the
admin engine becomes the product for companies).

## 7. Suggested tomorrow order

1. Voice mock interview (P0-1) → 2. Checkout (P0-2) → 3. Progress analytics (P1-4)
→ 4. STAR coach (P1-5) → 5. Coding judge (P0-3, stretch).
Keep each shipped + tested + deployed before starting the next; every item lands on the
live Pages site with the existing test/typecheck/build gate.
