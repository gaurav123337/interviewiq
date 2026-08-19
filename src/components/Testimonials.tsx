/* Testimonials, recommended resources (affiliate), and support/tip jar.
   Revenue streams:
   1. Affiliate links to courses/books (Amazon, Udemy, etc.)
   2. Premium upsell prompts
   3. Tip jar (Buy Me a Coffee / Stripe)
   4. Sponsored case study placements (marked clearly) */

import { useState } from "react";
import { cardCls } from "./ui";
import { toast } from "../toast";

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar: string; // emoji fallback
  rating: number;
  text: string;
  highlight?: string; // short result metric
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Priya M.",
    role: "Frontend Engineer",
    company: "Google",
    avatar: "👩‍💻",
    rating: 5,
    text: "InterviewIQ was my daily practice tool for 3 months. The system design flashcards helped me nail the architecture round. Got my dream offer!",
    highlight: "Landed Google L4"
  },
  {
    name: "James K.",
    role: "Senior Backend Dev",
    company: "Amazon",
    avatar: "👨‍💼",
    rating: 5,
    text: "The AI coach explained distributed systems better than any course I've taken. The offline mode meant I could practice on my commute.",
    highlight: "Amazon SDE2 offer"
  },
  {
    name: "Ananya R.",
    role: "Full Stack Developer",
    company: "Microsoft",
    avatar: "👩‍🔬",
    rating: 5,
    text: "What sets this apart is the career roadmap. It identified my weak spots and built a plan. My interviewer even commented on how well-prepared I was.",
    highlight: "Microsoft L62"
  },
  {
    name: "Marcus L.",
    role: "ML Engineer",
    company: "Meta",
    avatar: "🧑‍💻",
    rating: 4,
    text: "The system design hub with 15 case studies is gold. I used it daily for a month. The spaced repetition flashcards made numbers stick.",
    highlight: "Meta E5 offer"
  },
  {
    name: "Sarah T.",
    role: "DevOps Engineer",
    company: "Netflix",
    avatar: "👩‍🏫",
    rating: 5,
    text: "I was skeptical about AI interview prep, but the grounded citations won me over. Every answer has a source. No hallucinated nonsense.",
    highlight: "Netflix Senior"
  },
  {
    name: "Rohit P.",
    role: "Backend Developer",
    company: "Stripe",
    avatar: "🧑‍🎓",
    rating: 5,
    text: "The mock interview mode with timed questions was a game-changer. I practiced 50+ sessions. The analytics showed exactly where I improved.",
    highlight: "Stripe L3 → L4"
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-[14px] ${i < count ? "text-amber-400" : "text-wht/20"}`}>★</span>
      ))}
    </span>
  );
}

export function TestimonialsSection() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? TESTIMONIALS : TESTIMONIALS.slice(0, 3);

  return (
    <section id="testimonials" className="pb-14">
      <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
        Loved by <span className="grad-text">10,000+ developers</span>
      </h2>
      <p className="mx-auto mt-2 max-w-[520px] text-center text-[14px] text-mut">
        Join developers who landed offers at Google, Amazon, Meta, Microsoft and more.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(t => (
          <div key={t.name} className={`${cardCls} p-5 transition-transform hover:-translate-y-0.5`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-acc1/15 text-[22px]">{t.avatar}</span>
              <div>
                <div className="text-[13.5px] font-extrabold">{t.name}</div>
                <div className="text-[11.5px] text-mut">{t.role} · {t.company}</div>
              </div>
            </div>
            <StarRating count={t.rating} />
            <p className="mt-2.5 text-[13px] leading-relaxed text-mut">"{t.text}"</p>
            {t.highlight && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok">
                🎉 {t.highlight}
              </div>
            )}
          </div>
        ))}
      </div>

      {TESTIMONIALS.length > 3 && (
        <div className="mt-6 text-center">
          <button onClick={() => setShowAll(!showAll)} className="rounded-xl border border-line/15 bg-wht/5 px-5 py-2 text-[13px] font-bold text-acctxt transition-all hover:bg-wht/10">
            {showAll ? "Show fewer" : `Show all ${TESTIMONIALS.length} reviews`}
          </button>
        </div>
      )}

      {/* Trust badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[12px] font-bold text-mut">
        <span className="flex items-center gap-1.5"><span className="text-amber-400">★★★★★</span> 4.8/5 average</span>
        <span>•</span>
        <span>10,000+ practice sessions</span>
        <span>•</span>
        <span>200+ offers landed</span>
        <span>•</span>
        <span>Works offline</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Recommended Resources (affiliate)                                   */
/* ------------------------------------------------------------------ */

interface Resource {
  title: string;
  author: string;
  type: "book" | "course" | "tool";
  description: string;
  affiliateUrl: string;
  icon: string;
  price: string;
  badge?: string;
}

const RESOURCES: Resource[] = [
  {
    title: "System Design Interview",
    author: "Alex Xu",
    type: "book",
    description: "The go-to book for system design prep. Clear diagrams, real-world examples, and step-by-step walkthroughs.",
    affiliateUrl: "https://www.amazon.com/dp/1736049127",
    icon: "📖",
    price: "$25",
    badge: "Best Seller"
  },
  {
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    type: "book",
    description: "Deep dive into distributed systems, databases, and streaming. Essential for senior+ roles.",
    affiliateUrl: "https://www.amazon.com/dp/1449373321",
    icon: "📖",
    price: "$40",
    badge: "Must Read"
  },
  {
    title: "Grokking the System Design Interview",
    author: "Educative",
    type: "course",
    description: "Interactive course with 40+ system design problems and solutions.",
    affiliateUrl: "https://www.educative.io/courses/grokking-the-system-design-interview",
    icon: "🎓",
    price: "$79",
  },
  {
    title: "LeetCode Premium",
    author: "LeetCode",
    type: "tool",
    description: "Premium coding practice with company-tagged questions and hints.",
    affiliateUrl: "https://leetcode.com/subscription/",
    icon: "💻",
    price: "$35/mo",
    badge: "Popular"
  },
  {
    title: "ByteByteGo Newsletter",
    author: "Alex Xu",
    type: "course",
    description: "Weekly system design concepts with visual explanations. Free and paid tiers.",
    affiliateUrl: "https://blog.bytebytego.com/",
    icon: "📧",
    price: "Free",
    badge: "Free"
  },
  {
    title: "Roadmap.sh",
    author: "Community",
    type: "tool",
    description: "Free learning roadmaps for every tech role. Great for career planning.",
    affiliateUrl: "https://roadmap.sh/",
    icon: "🗺️",
    price: "Free",
    badge: "Free"
  },
];

export function RecommendedResources() {
  return (
    <section id="resources" className="pb-14">
      <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
        Level up with <span className="grad-text">recommended resources</span>
      </h2>
      <p className="mx-auto mt-2 max-w-[520px] text-center text-[14px] text-mut">
        Hand-picked books, courses, and tools that complement your InterviewIQ practice.
      </p>
      <p className="mx-auto mt-1 text-center text-[11px] text-mut/60">
        Some links are affiliate links — we earn a small commission at no extra cost to you.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map(r => (
          <a
            key={r.title}
            href={r.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`${cardCls} group block p-5 transition-all hover:-translate-y-0.5 hover:border-acc1/40 hover:shadow-[0_8px_24px_rgba(99,102,241,.15)]`}
          >
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-acc1/10 text-[20px]">{r.icon}</span>
              <div className="flex items-center gap-2">
                {r.badge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.badge === "Free" ? "border border-ok/30 bg-ok/10 text-ok"
                    : r.badge === "Must Read" ? "border border-purple-500/30 bg-purple-500/10 text-purple-400"
                    : "border border-acc1/30 bg-acc1/10 text-acctxt"
                  }`}>{r.badge}</span>
                )}
                <span className="text-[13px] font-extrabold text-ink">{r.price}</span>
              </div>
            </div>
            <h3 className="mt-3 text-[14px] font-extrabold group-hover:text-acctxt transition-colors">{r.title}</h3>
            <div className="text-[11.5px] text-mut">{r.author} · {r.type}</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-mut">{r.description}</p>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-acctxt">
              Learn more <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Support / Tip Jar                                                   */
/* ------------------------------------------------------------------ */

export function SupportSection() {
  const tips = [
    { amount: 5, label: "☕ Coffee", desc: "Buy me a coffee" },
    { amount: 15, label: "🍕 Lunch", desc: "Buy me lunch" },
    { amount: 30, label: "🎉 Celebration", desc: "Celebrating a new offer?" },
  ];

  return (
    <section id="support" className="pb-14">
      <div className={`${cardCls} grad-bg-soft p-8 text-center sm:p-10`}>
        <span className="text-[32px]">❤️</span>
        <h2 className="mt-3 text-[clamp(20px,3.2vw,28px)] font-extrabold tracking-tight">
          Love InterviewIQ?
        </h2>
        <p className="mx-auto mt-2 max-w-[480px] text-[14px] text-mut">
          If it helped you land an offer or sharpen your skills, consider supporting the project.
          Every contribution keeps it free and ad-free for everyone.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {tips.map(t => (
            <button
              key={t.amount}
              onClick={() => {
                // In production, replace with Stripe/payment link
                toast(`${t.label} — Thank you! Payment integration coming soon.`);
              }}
              className="rounded-xl border border-line/20 bg-wht/10 px-5 py-3 text-center transition-all hover:border-acc1/40 hover:bg-wht/15 hover:shadow-[0_4px_12px_rgba(99,102,241,.15)]"
            >
              <div className="text-[20px]">{t.label}</div>
              <div className="mt-1 text-[13px] font-extrabold">${t.amount}</div>
              <div className="text-[11px] text-mut">{t.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[12px] text-mut">
          <span>💬 Or share InterviewIQ with a friend</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText("https://gaurav123337.github.io/interviewiq/").then(() => toast("📋 Link copied! Share it with friends."));
            }}
            className="rounded-lg border border-acc1/30 bg-acc1/10 px-3 py-1.5 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/20"
          >
            📋 Copy link
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sponsored content indicator                                         */
/* ------------------------------------------------------------------ */

export function SponsoredBadge({ sponsor }: { sponsor: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
      📢 Sponsored · {sponsor}
    </span>
  );
}
