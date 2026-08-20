/* Testimonials, recommended resources (affiliate), and support/tip jar.
   Revenue streams:
   1. Affiliate links to courses/books (Amazon, Udemy, etc.)
   2. Premium upsell prompts
   3. Tip jar (Buy Me a Coffee / Stripe)
   4. Sponsored case study placements (marked clearly)
   
   Data is fetched from Supabase (database) with localStorage cache fallback.
   Admins manage this content via the Content CMS in the Admin dashboard. */

import { useState, useEffect, useCallback } from "react";
import { cardCls } from "./ui";
import { toast } from "../toast";
import { fetchTestimonials, fetchResources, fetchBannersForPosition, trackClick, trackImpression, getVisitorVariant } from "../services/contentService";

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

/* Local display interface (maps from DB types) */
interface Testimonial {
  id?: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  rating: number;
  text: string;
  highlight?: string;
}

/* Default testimonials — used when Supabase is unreachable */
const FALLBACK_TESTIMONIALS: Testimonial[] = [
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
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK_TESTIMONIALS);

  const load = useCallback(async () => {
    try {
      const dbItems = await fetchTestimonials();
      const variant = getVisitorVariant();
      // A/B filter: show 'all' + user's variant, hide the other variant
      const filtered = dbItems.filter(t => t.variant === "all" || t.variant === variant);
      setTestimonials(filtered.map(t => ({ name: t.name, role: t.role, company: t.company, avatar: t.avatar, rating: t.rating, text: t.text, highlight: t.highlight ?? undefined, id: t.id })));
    } catch {
      // Keep fallback
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = showAll ? testimonials : testimonials.slice(0, 3);

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

      {testimonials.length > 3 && (
        <div className="mt-6 text-center">
          <button onClick={() => setShowAll(!showAll)} className="rounded-xl border border-line/15 bg-wht/5 px-5 py-2 text-[13px] font-bold text-acctxt transition-all hover:bg-wht/10">
            {showAll ? "Show fewer" : `Show all ${testimonials.length} reviews`}
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
  const [resources, setResources] = useState<Resource[]>(RESOURCES);

  const load = useCallback(async () => {
    try {
      const dbItems = await fetchResources();
      setResources(dbItems.map(r => ({ title: r.title, author: r.author, type: r.type, description: r.description, affiliateUrl: r.affiliate_url, icon: r.icon, price: r.price, badge: r.badge ?? undefined })));
    } catch {
      // Keep fallback
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

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
        {resources.map((r, i) => (
          <a
            key={r.title + i}
            href={r.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => { void trackClick("resource", String(i)); }}
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
/* Auto-Rotating Banners                                               */
/* ------------------------------------------------------------------ */

interface BannerData {
  id: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_url: string;
  image_url: string;
  bg_gradient: string;
  text_color: string;
}

export function AutoRotatingBanners({ position }: { position: "hero" | "midpage" | "footer" }) {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const items = await fetchBannersForPosition(position);
        if (items.length > 0) {
          setBanners(items.map(b => ({ id: b.id, title: b.title, subtitle: b.subtitle, cta_text: b.cta_text, cta_url: b.cta_url, image_url: b.image_url, bg_gradient: b.bg_gradient, text_color: b.text_color })));
        }
      } catch { /* silent */ }
    })();
  }, [position]);

  // Track impressions when banners change
  useEffect(() => {
    if (banners.length > 0 && banners[currentIdx]) {
      void trackImpression("banner", banners[currentIdx].id);
    }
  }, [currentIdx, banners]);

  // Auto-rotate every 5 seconds if multiple banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentIdx(prev => (prev + 1) % banners.length);
        setTransitioning(false);
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[currentIdx];

  return (
    <div className="mb-6">
      <div
        className={`relative overflow-hidden rounded-2xl p-6 text-center transition-all duration-300 ${transitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
        style={{ background: banner.bg_gradient, color: banner.text_color }}
      >
        {banner.image_url && (
          <div className="absolute inset-0 z-0">
            <img src={banner.image_url} alt="" className="h-full w-full object-cover opacity-20" />
          </div>
        )}
        <div className="relative z-10">
          <h3 className="text-[clamp(18px,3vw,24px)] font-extrabold">{banner.title}</h3>
          {banner.subtitle && <p className="mt-2 text-[13px] opacity-80">{banner.subtitle}</p>}
          {banner.cta_text && banner.cta_url && (
            <a href={banner.cta_url} target="_blank" rel="noopener noreferrer" onClick={() => void trackClick("banner", banner.id)} className="mt-3 inline-block rounded-xl bg-white/20 px-5 py-2 text-[13px] font-bold backdrop-blur-sm transition-all hover:bg-white/30">
              {banner.cta_text} →
            </a>
          )}
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setCurrentIdx(i)} className={`h-1.5 rounded-full transition-all ${i === currentIdx ? "w-4 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Popup Banner — modal overlay with auto-dismiss                      */
/* ------------------------------------------------------------------ */

export function PopupBanners() {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const items = await fetchBannersForPosition("popup");
        if (items.length > 0) {
          setBanner(items[0]);
          // Show after a short delay so it doesn't clash with page load
          setTimeout(() => setVisible(true), 2000);
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Track impression when shown
  useEffect(() => {
    if (visible && banner) {
      void trackImpression("banner", banner.id);
    }
  }, [visible, banner]);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => handleClose(), 12000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleClose = () => {
    setTransitioning(true);
    setTimeout(() => { setVisible(false); setTransitioning(false); }, 300);
  };

  if (!banner || !visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${transitioning ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />
      {/* Banner card */}
      <div
        className={`relative z-10 w-full max-w-[480px] overflow-hidden rounded-2xl p-8 text-center shadow-2xl transition-all duration-300 ${transitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
        style={{ background: banner.bg_gradient, color: banner.text_color }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-full bg-black/20 text-[14px] backdrop-blur-sm transition-all hover:bg-black/40"
        >
          ✕
        </button>
        {banner.image_url && (
          <div className="absolute inset-0 z-0">
            <img src={banner.image_url} alt="" className="h-full w-full object-cover opacity-20" />
          </div>
        )}
        <div className="relative z-10">
          <h3 className="text-[clamp(20px,4vw,28px)] font-extrabold">{banner.title}</h3>
          {banner.subtitle && <p className="mt-3 text-[14px] opacity-80">{banner.subtitle}</p>}
          {banner.cta_text && banner.cta_url && (
            <a
              href={banner.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void trackClick("banner", banner.id)}
              className="mt-4 inline-block rounded-xl bg-white/20 px-6 py-2.5 text-[14px] font-bold backdrop-blur-sm transition-all hover:bg-white/30"
            >
              {banner.cta_text} →
            </a>
          )}
        </div>
      </div>
    </div>
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
