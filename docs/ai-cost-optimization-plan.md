# AI Cost Optimization Plan — InterviewIQ

## Problem Statement

InterviewIQ uses AI (OpenAI-compatible) for 5 modules: interview feedback, hints, system design deep-dives, RAG tutor, and AI coach chat. Without cost controls, a single user can trigger hundreds of API calls per session, and scaling to 1,000+ users could produce $5,000–$20,000/month in API bills.

The app already has a freemium paywall and BYOK model, but lacks **response caching**, **smart model routing**, **token budgets**, and **cost monitoring** — the four pillars of AI cost control.

---

## Strategy 1: Semantic Response Cache (saves 60–80%)

**What:** Cache AI responses keyed by a hash of (system prompt + user prompt + model). Identical or near-identical questions return cached responses instantly.

**Why it's the biggest win:** The same interview questions recur across users. "Tell me about yourself at Google for a mid-level frontend role" is asked thousands of times — the AI feedback is ~90% identical each time.

**Implementation:**
```
Cache key = SHA-256(system_prompt + "|" + user_prompt + "|" + model)
Storage = Supabase table: ai_response_cache (key, response, module, created_at, hit_count)
TTL = 7 days (configurable per module)
```

**Expected savings:** 60–80% of API calls eliminated for repeated questions.

**Files to modify:**
- `src/ai.ts` — wrap `chatWithSettings()` with cache lookup
- New table: `ai_response_cache` with RLS (read: all, write: service role)
- `supabase/migrations/` — add migration

---

## Strategy 2: Smart Model Routing (saves 50–70%)

**What:** Route each module to the cheapest model that meets quality requirements. Not every AI call needs GPT-4o.

**Current state:** Default model is `gpt-4o-mini` (good), but admin can set expensive models per module.

**Recommended routing:**

| Module | Recommended Model | Cost per 1M tokens | Why |
|--------|-------------------|--------------------|----|
| **Hints** | `gpt-4o-mini` or `gemini-2.5-flash-lite` | $0.10–$0.15 input | Short, simple responses |
| **Feedback** | `gpt-4o-mini` | $0.15 input | Quality matters but mini is sufficient |
| **AI Coach** | `gpt-4o` | $2.50 input | Conversational quality matters |
| **System Design** | `gpt-4o-mini` | $0.15 input | Structured output, mini works |
| **RAG Tutor** | `gemini-2.5-flash` | $0.30 input | Good at grounded answers, cheap |

**Implementation:** Enforce model caps in the `ai-chat` edge function — admin can only pick from a curated list per module, never above the cap.

---

## Strategy 3: Token Budgets per Call (saves 30–50%)

**What:** Set strict `max_tokens` limits per module to prevent runaway output costs.

**Current state:** Default `max_tokens: 700` for all calls. Some modules waste tokens.

**Recommended limits:**

| Module | Current max_tokens | Recommended | Rationale |
|--------|--------------------|-------------|-----------|
| Hints | 120 | 120 | Already good ✅ |
| Feedback | 500 | 500 | Already good ✅ |
| AI Coach | 700 | 400 | Conversations should be concise |
| System Design | 700 | 600 | Structured output, doesn't need 700 |
| RAG Tutor | 700 | 500 | Factual answers are shorter |

**Additional:** Add a client-side "cost estimate" display showing approximate cost per call.

---

## Strategy 4: Prompt Optimization (saves 20–40%)

**What:** Reduce input tokens by compressing system prompts and removing redundancy.

**Current issues found:**
1. `getFeedback()` system prompt is ~80 tokens — could be ~40 with compression
2. `getHint()` system prompt is ~40 tokens — already efficient ✅
3. System design tutor sends full topic context every turn

**Actions:**
1. Shorten all system prompts by 30–50% (same instructions, fewer words)
2. For multi-turn conversations (AI coach), use prompt caching by placing static content first
3. Remove redundant context from follow-up messages

**Prompt caching (provider-native):**
- OpenAI auto-caches repeated prefixes (75% discount)
- Anthropic has explicit `cache_control` (90% discount on cached prefix)
- Structure prompts: static instructions FIRST, variable user content LAST

---

## Strategy 5: Rate Limiting + Quotas (saves 100% on abuse)

**What:** Prevent cost spikes from bots, power users, or loops.

**Current state:** Paywall has daily AI call limits, but no per-request rate limiting.

**Implementation:**

| Limit | Free | Pro | Admin |
|-------|------|-----|-------|
| AI calls/day | 20 | Unlimited | Unlimited |
| AI calls/minute | 5 | 15 | Unlimited |
| Max tokens/request | 500 | 1000 | Unlimited |
| Max conversation turns | 10 | 50 | Unlimited |

**Edge function rate limiting:**
```typescript
// In ai-chat edge function
const RATE_LIMIT_KEY = `rate:${userId}:${moduleId}`;
const current = await redis.get(RATE_LIMIT_KEY);
if (current > MAX_PER_MINUTE) throw new Error("Rate limited");
await redis.incr(RATE_LIMIT_KEY);
await redis.expire(RATE_LIMIT_KEY, 60);
```

---

## Strategy 6: Cost Monitoring Dashboard (visibility)

**What:** Track real-time AI spend per user, per module, per day.

**New table: `ai_cost_log`**
```sql
CREATE TABLE ai_cost_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  module TEXT NOT NULL,          -- 'feedback', 'hint', 'coach', etc.
  model TEXT NOT NULL,           -- 'gpt-4o-mini', 'gpt-4o', etc.
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  estimated_cost_usd NUMERIC(10,6) NOT NULL,
  cached BOOLEAN DEFAULT FALSE, -- was this a cache hit?
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Admin dashboard additions:**
- Daily AI cost graph (by module)
- Top 10 most expensive users
- Cache hit rate %
- Model usage breakdown
- Cost per registered user trend

**Alerts:**
- Daily spend > $10 → warning
- Daily spend > $50 → alert + auto-disable non-essential modules
- Monthly spend > $500 → page admin

---

## Strategy 7: Fallback Chain (saves on errors + retries)

**What:** When the primary model fails or is rate-limited, fall back to a cheaper model instead of retrying the expensive one.

**Fallback chain:**
```
gpt-4o → gpt-4o-mini → gemini-2.5-flash → cached response → offline engine
```

**Implementation:** Add to `chatWithSettings()`:
```typescript
const FALLBACK_MODELS = ["gpt-4o-mini", "gemini-2.5-flash"];
// On 429/500, try next model in chain
// On all failures, return cached response if available
// Last resort: return offline scoring engine result
```

---

## Implementation Roadmap

### Phase 1: Quick Wins (1–2 days)
- [ ] Set module-specific `max_tokens` limits
- [ ] Shorten system prompts by 30%
- [ ] Add per-user rate limiting in edge function

### Phase 2: Caching (3–5 days)
- [ ] Create `ai_response_cache` table
- [ ] Implement cache lookup in `chatWithSettings()`
- [ ] Add cache hit rate tracking

### Phase 3: Smart Routing (2–3 days)
- [ ] Enforce model caps per module
- [ ] Add fallback chain in `chatWithSettings()`
- [ ] Auto-downgrade to cheaper model on rate limit

### Phase 4: Monitoring (2–3 days)
- [ ] Create `ai_cost_log` table
- [ ] Log every API call with token counts and estimated cost
- [ ] Add admin dashboard graphs
- [ ] Set up spend alerts

### Phase 5: Advanced (ongoing)
- [ ] Prompt caching with provider-native support
- [ ] Batch API for non-urgent operations (content generation)
- [ ] A/B test model quality vs cost per module
- [ ] User-facing cost transparency ("This session used ~$0.02 of AI")

---

## Cost Projections

| Scenario | Users | Without optimization | With optimization |
|----------|-------|---------------------|-------------------|
| Early stage | 100 | $50–100/mo | $10–20/mo |
| Growth | 1,000 | $500–1,000/mo | $50–100/mo |
| Scale | 10,000 | $5,000–10,000/mo | $200–500/mo |
| Enterprise | 100,000 | $50,000+/mo | $1,000–3,000/mo |

**Key insight:** The cache alone (Strategy 1) eliminates 60–80% of calls because interview questions are highly repetitive across users. Combined with model routing (Strategy 2), total cost drops by 80–90%.

---

## Revenue Offset

| Tier | Price | AI cost/user/month | Margin |
|------|-------|--------------------|--------|
| Free | $0 | $0.02 (20 calls × cached) | -$0.02 |
| Pro | $9/mo | $0.10 (unlimited × cached) | $8.90 |
| Team | $29/mo | $0.30 (5 users × cached) | $28.70 |

At 1,000 Pro users: **$9,000 revenue vs $100 AI cost = 98.9% margin**
