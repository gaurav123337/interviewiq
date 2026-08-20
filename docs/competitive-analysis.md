# InterviewIQ — Competitive Analysis & Implementation Plan

## Market Leaders Profiled

| Platform | Pricing | Core Strength | Weakness |
|----------|---------|---------------|----------|
| **LeetCode** | $35/mo | Coding problems, company-tagged questions, contests | No mock interviews, no behavioral prep, no coaching |
| **Pramp** | Free | Peer-to-peer mock interviews | Inconsistent partner quality, no AI, limited fields |
| **Interviewing.io** | $100+/session | Real engineers from FAANG, anonymous practice | Expensive, scheduling friction, tech-only |
| **Big Interview** | $79/mo | Behavioral STAR coaching, video recording | Dated UI, weak technical prep, no coding |
| **Exponent** | $129/mo | PM interview cases, structured frameworks | PM-only, expensive, no coding |
| **Final Round AI** | $40/mo | AI mock interviews, transcript analysis | Shallow coaching, no offline, no career path |
| **InterviewBuddy** | Free-$30 | AI voice mock interviews | Basic AI, no company-specific questions |
| **HackerRank** | Enterprise | Technical assessments, screening | Assessment tool, not a prep tool |

## InterviewIQ — Current Feature Map

| Feature | Status | Competitive Parity |
|---------|--------|--------------------|
| AI-tailored questions (company, level, field) | ✅ Live | **Ahead** — no competitor does this as deeply |
| System design case studies | ✅ Live | **Ahead** — interactive cases + flashcards |
| Offline-first PWA | ✅ Live | **Ahead** — unique in the space |
| Company-specific question bank | ✅ Live | On par with LeetCode |
| Flashcards (spaced repetition) | ✅ Live | On par with Anki-based tools |
| Job feed (Greenhouse/Ashby boards) | ✅ Live | **Ahead** — unique integration |
| AI coaching (context-aware chat) | ✅ Live | On par with Final Round AI |
| Skill counselor / career roadmap | ✅ Live | **Ahead** — unique combination |
| Coding playground | ✅ Live | On par with LeetCode |
| Resume builder + PDF export | ✅ Live | On par with Big Interview |
| Voice mode | ✅ Live | On par with InterviewBuddy |
| Team/enterprise support | ✅ Live | **Ahead** — unique for teams |
| A/B testing + analytics CMS | ✅ Live | **Ahead** — operational maturity |
| **Video mock interviews** | ❌ Missing | Behind Big Interview, Final Round AI |
| **Live avatar/tutor** | ❌ Missing | Behind Exponent, Big Interview |
| **Peer matching** | ❌ Missing | Behind Pramp, Interviewing.io |
| **ATS resume scanner** | ❌ Missing | Behind Jobscan, ResumeWorded |
| **Behavioral STAR framework** | ⚠️ Partial | Behind Big Interview (structured drills) |
| **Salary negotiation coaching** | ❌ Missing | Behind Levels.fyi, Blind |
| **Company culture insights** | ❌ Missing | Behind Glassdoor, Blind |
| **LinkedIn integration** | ❌ Missing | Behind everywhere |
| **Progress analytics dashboard** | ⚠️ Basic | Behind LeetCode (streaks, heatmaps) |
| **Gamification** | ⚠️ Minimal | Behind LeetCode (badges, leaderboards) |
| **Mobile app (native)** | ❌ PWA only | Behind everyone with native apps |

## What Makes InterviewIQ Already Win

- **Offline-first** — no competitor has this
- **Company-specific AI questions** — deeper than LeetCode's static bank
- **Full-stack coverage** — coding + system design + behavioral + career in one app
- **PWA** — instant install, no app store friction
- **Self-hosted Supabase** — user data sovereignty

---

## Implementation Plan — 4 Phases

### Phase 1: Close the Gap (4-6 weeks)
*Target: Match table-stakes features competitors have*

#### 1.1 ATS Resume Scanner
- Upload PDF → extract skills → compare against job posting → gap report
- Leverage existing `pdf.ts`, `cleaner.ts`, `resume.ts`
- Display match % like Jobs feed cards

#### 1.2 Structured Behavioral Drills (STAR)
- STAR framework prompts (Situation → Task → Action → Result)
- Score each STAR component with AI feedback
- Track behavioral skill progression over time

#### 1.3 Progress Dashboard Overhaul
- Daily/weekly streaks with calendar heatmap (LeetCode-style)
- Skill radar chart (frontend, backend, system design, behavioral)
- Session history with trend lines
- Certificates earned vs available

#### 1.4 Gamification
- Achievement badges (First Session, 7-day Streak, 100 Questions, etc.)
- XP system tied to question difficulty and session length
- Weekly leaderboard (opt-in, anonymized)

### Phase 2: Differentiate (6-8 weeks)
*Target: Build features competitors CAN'T replicate*

#### 2.1 AI Voice Mock Interview (Full Session)
- Continuous voice conversation (not just one Q&A)
- AI adapts follow-ups based on answers in real-time
- Post-session transcript with auto-scoring
- Use existing `voice.ts` + streaming AI

#### 2.2 Company Culture Intelligence
- Scrape Glassdoor/Blind reviews → synthesize culture signals
- "What they value" cards per company
- Interview tips specific to company culture
- Tie into existing `jd.ts` and company data

#### 2.3 Interview Simulation Mode
- Timed full mock interview (45-60 min)
- Mix of technical + behavioral + system design
- Difficulty ramps based on performance
- End-to-end scoring with breakdown

#### 2.4 Salary Intelligence
- Levels.fyi-style comp data per company/level/location
- Negotiation scripts and tactics
- Offer comparison calculator
- Tie into existing `salaryBench.ts`

### Phase 3: Scale (8-10 weeks)
*Target: Network effects and retention*

#### 3.1 Peer Matching
- Match users by level/field for practice sessions
- Text-based or voice-based peer interviews
- Rate your partner (quality control)
- Anonymous mode (like Interviewing.io)

#### 3.2 Team Analytics Dashboard
- Manager view: team skill gaps, completion rates
- Exportable reports for L&D teams
- Custom question sets per team
- Tie into existing `teams.ts`

#### 3.3 Community Features
- User-contributed questions (reviewed like Reddit)
- Company-specific tips board
- Study groups / accountability partners
- Shared flashcard decks

#### 3.4 Email Digest System
- Weekly progress summary
- New questions in your target companies
- Market trends (hot skills, new companies hiring)
- Tie into existing `send-recommendations-digest`

### Phase 4: Platform (ongoing)
*Target: Moat and ecosystem*

#### 4.1 Mobile App (React Native)
- Convert PWA to native using existing React codebase
- Push notifications for streaks, new content
- Offline-first architecture carries over

#### 4.2 API / Integrations
- LinkedIn profile import (skills, experience)
- Calendar integration (schedule practice sessions)
- Slack/Teams bot for daily question delivery
- ATS integrations (Greenhouse, Lever webhooks)

#### 4.3 Content Marketplace
- Expert-created question packs (curated, quality-gated)
- Company-specific interview guides
- Certification prep courses
- Revenue share with content creators

---

## Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| ATS Resume Scanner | 🔥 High | Medium | **P0** |
| STAR Behavioral Drills | 🔥 High | Low | **P0** |
| Progress Dashboard | 🔥 High | Medium | **P0** |
| Gamification | Medium | Low | **P1** |
| AI Voice Mock Session | 🔥 High | High | **P1** |
| Company Culture Intel | 🔥 High | Medium | **P1** |
| Interview Simulation | High | High | **P2** |
| Salary Intelligence | Medium | Medium | **P2** |
| Peer Matching | High | High | **P2** |
| Team Analytics | Medium | Low | **P1** |
| Community Features | Medium | High | **P3** |
| Mobile App | High | Very High | **P3** |
| API / Integrations | Medium | High | **P3** |
| Content Marketplace | Medium | High | **P4** |
