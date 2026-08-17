# InterviewIQ — Competitive Report (vs. market, 2026)

> Consolidates the market landscape from `docs/enrichment-plan.md` with the gap analysis
> done in the latest research pass. Honest pros and cons — nothing here is marketing.

---

## 1. Competitors compared (the list)

| # | Competitor | Category | Price band (2026) |
|---|---|---|---|
| 1 | **LeetCode** (+ HackerRank) | Coding problems, contests, rating | ~$35/mo premium |
| 2 | **Interviewing.io** | Realistic human mock interviews (FAANG-style) | $179–339/session; AI tier cheaper |
| 3 | **Pramp** | Peer mock interviews | ~$150/yr; free credits cut to ~5/mo |
| 4 | **Hello Interview** | SWE/EM + system design, AI-guided | $47/mo, $79/yr, $279 lifetime; mocks from $170 |
| 5 | **GreatFrontEnd** | Frontend-only coding, prep plans | subscription |
| 6 | **Exponent** | Courses + human coaching | $200+ |
| 7 | **Interview Kickstart** | Courses + placement + human coaches | $2,000+ |
| 8 | **Interview Query** | Data-science interview courses | subscription |
| 9 | **Final Round AI / Sidekick / Skillora** | AI interviewer + AI copilot | freemium → paid |
| 10 | **Google Interview Warmup** | Free voice practice | free |
| 11 | **SmallTalk2Me / Yoodli** | Speaking/fluency feedback | freemium |
| 12 | **Coding Ninjas / PrepInsta** | Placement + mentorship programs (India) | higher price points, outcomes-sold |
| 13 | **ByteByteGo / Grokking** | System-design depth | ~$100–200 |
| 14 | **Naukri / LinkedIn** | Job platforms (coverage benchmark, not interview prep) | free/premium |

**Where the market sits:** two bands — *cheap subscriptions* ($35–80/mo or ~$150/yr) for
self-serve prep, and *expensive human mocks* ($170–340/session). **Nobody owns the
free-first + full-ladder + self-improving content space** InterviewIQ targets.

---

## 2. Where InterviewIQ stands (capability matrix)

| Capability | InterviewIQ | LeetCode | Interviewing.io | Hello Interview | GreatFrontEnd |
|---|---|---|---|---|---|
| Free tier genuinely usable | ✅ core, offline | ⚠️ limited | ❌ | ❌ | ⚠️ |
| Full ladder junior → CEO/CTO | ✅ | ❌ | ⚠️ | ⚠️ | ❌ |
| Field × company × JD tailoring | ✅ (incl. JD paste) | ❌ | ⚠️ | ⚠️ | ⚠️ |
| Mock interview + scoring + model answers | ✅ offline engine | ❌ | ✅ human/AI | ✅ AI | ⚠️ |
| Voice mock interview | ❌ **gap** | ❌ | ✅ | ✅ | ❌ |
| Auto-graded coding (hidden tests) | ✅ in progress (bank self-tests) | ✅ | ✅ | ✅ | ✅ |
| Adaptive roadmap / study plan | ✅ | ⚠️ | ❌ | ⚠️ | ✅ plans |
| Spaced-repetition drill | ✅ | ❌ | ❌ | ❌ | ❌ |
| RAG knowledge base + citations | ✅ unique | ❌ | ❌ | ❌ | ❌ |
| Self-improving question bank (scraper + harvest) | ✅ unique | ❌ | ❌ | ❌ | ❌ |
| Admin / content-ops console | ✅ unique (B2B seed) | ❌ | ❌ | ❌ | ❌ |
| Real checkout | ✅ (pay-checkout edge functions + Razorpay modal) | ✅ | ✅ | ✅ | ✅ |
| Jobs: match % + tailored resume + apply hand-off | ✅ unique | ❌ | ❌ | ❌ | ❌ |
| Offline-first PWA | ✅ | ❌ | ❌ | ❌ | ❌ |
| Community / leaderboards | ❌ | ✅ | ✅ | ⚠️ | ❌ |

---

## 3. Pros — where we win (keep doubling down)

1. **Free-first + offline** — usable with no account, no API key, no network. No competitor
   combines all three.
2. **Full-ladder, tailored prep** — junior→CEO × 8 fields × ~20 companies × pasted JD.
   Broadest coverage in the space.
3. **Self-improving content engine** — scraper → review → harvest → RAG keeps content fresh
   at ~zero editorial cost. This is the moat; the new content-sourcing plan extends it
   (GitHub raw, HN API, AI cleaning) to close the depth gap.
4. **Spaced-repetition drill + adaptive roadmap** — retention mechanics the category kings
   don't offer.
5. **RAG-grounded tutor with visible citations** — unique; competitors' AI answers have no
   provenance.
6. **Admin/ops console** — already a "product console"; the seed of a future B2B/white-label
   business (orgs, seats, custom banks).
7. **Code playground with multi-format judging** (CLI + JS functions + browser UI) — a
   position nobody holds: LeetCode does CLI, GreatFrontEnd does frontend, neither does both
   in a free offline PWA.
8. **Jobs integration** — ATS + RSS + Adzuna salary + compliant apply hand-off; no prep
   competitor has a live jobs loop.
9. **Real checkout now shipped** — provider-agnostic `pay-checkout` edge functions + Razorpay
   modal (the earlier "mailto-only" gap is closed).

## 4. Cons — honest gaps vs. market

| # | Gap | Severity | Status / plan |
|---|---|---|---|
| 1 | **Question-bank depth** — LeetCode's 3,000+ company-tagged problems is the category king; we're a fraction | High | `docs/question-bank-expansion.md` P1/P4 (mirrors + AI-authored, self-tested problems) |
| 2 | **No live human mock interviews** — interviewing.io/Pramp are the gold standard; AI feedback ≠ a live engineer | High (irreducible) | Conscious defer — cannot be faked; AI tier is the honest substitute |
| 3 | **No network effects yet** — no forums, leaderboards, community content; LeetCode's forums are a moat | Medium | Defer (expensive, low ROI for v2) |
| 4 | **AI is bring-your-own-key** — smooth for power users, a wall for everyone else; competitors bundle AI | Medium | Add an optional server-side AI key (`AI_CLEAN_KEY` plan) + keep the free scoring engine honest |
| 5 | **No mobile app** — big miss in India where mobile-first is the norm | Medium | PWA is installable; native app is a future phase |
| 6 | **No placement/mentorship programs** — Coding Ninjas/PrepInsta/Interview Kickstart sell outcomes + humans | Medium | Out of scope by design (no human team); revisit for B2B |
| 7 | **Young brand, young data** — match % and trend engine need user volume + job-corpus history; corpus is ATS+RSS+Adzuna, honest but smaller than Naukri/LinkedIn | Medium | HN trends (P2) + scraper volume compound over time |
| 8 | **Jobs depend on third-party sources** — legal guardrails limit scraping; can't match LinkedIn coverage | Low | By design (compliant lanes in `phase2-platform-integrations.md`) |
| 9 | **No system-design depth** — ByteByteGo/Grokking dominate that track | Medium | P1 System Design Primer + AI-cleaned drafts address the question side |
| 10 | **No voice interview** — every realistic competitor has it | Medium | Listed as P0-1 in `enrichment-plan.md` (browser SpeechRecognition + TTS) |

## 5. Positioning

> **"The only free, offline-first interview coach that takes you from junior to CEO — with a
> question bank that writes itself and an admin console your team can run."**

Don't fight LeetCode on problems or Interviewing.io on human mocks. Win on **coverage**
(full ladder × field × company), **frictionlessness** (free, offline, no account),
**fresh content** (self-improving pipeline), and later **team delivery** (admin engine as the
product for companies).

## 6. One-line verdict

InterviewIQ is **the broadest free tier in the market and the only self-improving content
engine**, but it will stay a "second app" for grinders until the question-bank depth (con #1)
and voice realism (con #10) are closed. The content-sourcing plan is the highest-leverage
path: it attacks the #1 con without hiring anyone.
