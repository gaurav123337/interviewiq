import { useEffect, useState } from "react";
import { useApp } from "../store";
import { UpgradeModal } from "./Upgrade";
import { btnGhost, btnPrimary, cardCls, Chip } from "./ui";

const FEATURES = [
  { icon: "🎯", title: "Tailored sessions", body: "Pick your level (junior → CEO), field and target company — or paste a job description — and get questions written for that exact role, with model answers and scoring key points." },
  { icon: "🎤", title: "Mock interviews", body: "Full interview-mode rounds with per-question scoring, hints, category breakdowns and a study-next plan. Voice mode lets the interviewer speak while you answer aloud." },
  { icon: "🧭", title: "Career roadmap", body: "Tell it where you want to be and by when. InterviewIQ builds a week-by-week plan, runs an optional skill-gap diagnostic, and reschedules as your real results come in." },
  { icon: "🧠", title: "AI tutor with citations", body: "Ask anything about a topic. The tutor answers from your own knowledge base (PDFs, docs) with visible source citations — no hallucinated answers." },
  { icon: "💻", title: "Code playground", body: "Write and run code in multiple languages right in the browser, with hidden test cases that judge your solution the way a real interviewer would." },
  { icon: "📚", title: "Self-improving bank", body: "A curated question bank, spaced-repetition drill, deep-dive knowledge base — and a content engine that keeps adding fresh questions from real sources and your own misses." }
];

const STEPS = [
  { n: "1", title: "Pick your target", body: "Level, field, company — or paste the job description you're interviewing for." },
  { n: "2", title: "Get interviewed", body: "Answer tailored questions, get scored on key points, review model answers and AI feedback." },
  { n: "3", title: "Follow the roadmap", body: "Drill weak topics, track streaks and progress, and watch the roadmap adapt to your results." }
];

const FAQS = [
  { q: "Is InterviewIQ really free?", a: "Yes. The core experience — tailored questions, model answers, mock interviews, roadmap, drill and question bank — is free and works fully offline, with no account and no API key. Pro adds unlimited sessions, all company sets, voice mode and unlimited AI coaching." },
  { q: "Does it cover every level, from junior to CTO and CEO?", a: "Yes. Choose junior, mid, senior, staff, principal, CTO or CEO — combined with your field and target company — and the session is built for that exact combination." },
  { q: "Can I tailor questions to a specific company or job description?", a: "Yes. Pick from ~20 companies (or 'general'), or paste any job description and InterviewIQ generates questions around the role's actual requirements and keywords." },
  { q: "Does it work offline?", a: "Yes. InterviewIQ is an installable PWA. After the first load, everything works offline — sessions, history, streaks, drill and the question bank — and progress syncs to the cloud when you sign in." },
  { q: "Do I need an API key for AI feedback?", a: "No. The built-in scoring engine works with zero setup. Add an OpenAI-compatible key in Settings when you want generative AI feedback, hints and the tutor." }
];

export function Landing() {
  const { nav } = useApp();
  const [upgrade, setUpgrade] = useState(false);
  /* admin-published pricing (app_config → pricing) — shows INR when
     published, falls back to the baked-in USD catalog */
  const [remotePrice, setRemotePrice] = useState<number | null>(null);
  const [remoteCurrency, setRemoteCurrency] = useState("");
  useEffect(() => {
    let on = true;
    void import("../services/billing").then(({ getRemotePricing }) =>
      getRemotePricing().then(rp => { if (on && rp) { setRemotePrice(rp.monthly ?? null); setRemoteCurrency(rp.currency ?? ""); } })
    ).catch(() => {});
    return () => { on = false; };
  }, []);
  const proPrice = remotePrice != null ? `${remoteCurrency === "INR" ? "₹" : remoteCurrency ? remoteCurrency + " " : "$"}${remotePrice}` : "$9";

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="anim-view mx-auto w-full max-w-[1100px]">
      {/* hero */}
      <section className="pt-10 pb-14 text-center sm:pt-16">
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-acc1/40 bg-acc1/10 px-4 py-1.5 text-[12.5px] font-bold text-acctxt">
          ⚡ Free · Offline-first · No account needed
        </span>
        <h1 className="mx-auto mt-5 max-w-[820px] text-[clamp(32px,6vw,58px)] font-extrabold leading-[1.05] tracking-tight">
          From <span className="grad-text">junior developer</span> to <span className="grad-text">CTO & CEO</span> — interview prep that knows your target.
        </h1>
        <p className="mx-auto mt-5 max-w-[640px] text-[15.5px] leading-relaxed text-mut">
          InterviewIQ is the AI interviewer that tailors every question to your field, level and target company —
          or your pasted job description. Answer, get scored, follow the roadmap, and walk in ready.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button className={btnPrimary + " px-8 py-3.5 text-[15.5px]"} onClick={() => nav("onboard")}>
            Start practicing free →
          </button>
          <button className={btnGhost + " px-6 py-3.5 text-[15px]"} onClick={() => scrollTo("pricing")}>
            See pricing
          </button>
        </div>
        <div className="mx-auto mt-9 flex max-w-[560px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] font-bold text-mut">
          <span>8 fields</span><span className="text-wht/20">•</span>
          <span>7 levels</span><span className="text-wht/20">•</span>
          <span>20+ companies</span><span className="text-wht/20">•</span>
          <span>JD tailoring</span><span className="text-wht/20">•</span>
          <span>Works offline</span>
        </div>
      </section>

      {/* features */}
      <section id="features" className="pb-14">
        <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          Everything you need to <span className="grad-text">walk in ready</span>
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-[14px] text-mut">One coach for the whole ladder — from your first coding question to the CTO room.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className={`${cardCls} p-5 transition-transform hover:-translate-y-0.5`}>
              <span className="grid h-11 w-11 place-items-center rounded-xl grad-bg-soft text-[20px]">{f.icon}</span>
              <h3 className="mt-3 text-[15.5px] font-extrabold">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mut">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="pb-14">
        <div className={`${cardCls} grid grid-cols-1 gap-6 p-6 sm:grid-cols-3 sm:p-8`}>
          {STEPS.map(s => (
            <div key={s.n} className="flex gap-3.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl grad-bg text-[15px] font-extrabold text-white">{s.n}</span>
              <div>
                <h3 className="text-[14.5px] font-extrabold">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-mut">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="pb-14">
        <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          Simple, honest <span className="grad-text">pricing</span>
        </h2>
        <p className="mx-auto mt-2 max-w-[480px] text-center text-[14px] text-mut">Start free. Upgrade only when you want unlimited everything.</p>
        <div className="mx-auto mt-8 grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-extrabold">Free</h3>
              <Chip tone="ok">FOREVER</Chip>
            </div>
            <div className="mt-3 text-[13px] text-mut">Everything you need to start today.</div>
            <div className="mt-4 text-[34px] font-extrabold tracking-tight">$0<span className="text-[14px] font-bold text-mut">/mo</span></div>
            <ul className="mt-5 space-y-2 text-[13.5px] text-ink">
              <li className="before:content-['✓'] before:mr-2 before:text-ok">8 tailored sessions / month</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">All fields, levels & companies</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Mock interviews + scoring</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Career roadmap & drill</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Offline-first PWA</li>
            </ul>
            <button className={btnGhost + " mt-6 w-full"} onClick={() => nav("onboard")}>Start free</button>
          </div>
          <div className="grad-bg-soft relative overflow-hidden rounded-2xl border border-acc1/40 p-6 shadow-[0_18px_50px_rgba(99,102,241,.25)]">
            <span className="absolute right-4 top-4"><Chip tone="co">POPULAR</Chip></span>
            <h3 className="text-[16px] font-extrabold">Pro</h3>
            <div className="mt-3 text-[13px] text-mut">Unlimited practice, AI coaching and voice rounds.</div>
            <div className="mt-4 text-[34px] font-extrabold tracking-tight">{proPrice}<span className="text-[14px] font-bold text-mut">/mo</span></div>
            <ul className="mt-5 space-y-2 text-[13.5px] text-ink">
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Unlimited interview sessions</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Unlimited AI feedback & hints</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Voice mode — speak your answers</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Journey & full mock modes</li>
              <li className="before:content-['✓'] before:mr-2 before:text-ok">Progress analytics & full history</li>
            </ul>
            <button className={btnPrimary + " mt-6 w-full"} onClick={() => setUpgrade(true)}>Go Pro</button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="pb-14">
        <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          Frequently asked <span className="grad-text">questions</span>
        </h2>
        <div className="mx-auto mt-7 max-w-[680px] space-y-2.5">
          {FAQS.map(f => (
            <details key={f.q} className={`${cardCls} group p-4`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-acc3 transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-mut">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="pb-10 text-center">
        <div className={`${cardCls} grad-bg-soft p-8 sm:p-10`}>
          <h2 className="text-[clamp(22px,3.6vw,32px)] font-extrabold tracking-tight">Your next interview is the one you'll <span className="grad-text">ace</span>.</h2>
          <p className="mx-auto mt-2 max-w-[440px] text-[14px] text-mut">No account. No credit card. Just pick a target and start.</p>
          <button className={btnPrimary + " mt-6 px-8 py-3.5 text-[15.5px]"} onClick={() => nav("onboard")}>
            Start practicing free →
          </button>
        </div>
      </section>

      {/* footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 py-6 text-[12.5px] text-mut">
        <span className="font-extrabold">Interview<span className="grad-text">IQ</span> — AI Interview Coach</span>
        <span className="flex flex-wrap gap-4">
          <button className="hover:text-ink" onClick={() => nav("onboard")}>Practice</button>
          <button className="hover:text-ink" onClick={() => scrollTo("pricing")}>Pricing</button>
          <button className="hover:text-ink" onClick={() => scrollTo("faq")}>FAQ</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "terms"; nav("legal"); }}>Terms</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "privacy"; nav("legal"); }}>Privacy</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "refunds"; nav("legal"); }}>Refunds</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "shipping"; nav("legal"); }}>Shipping</button>
          <a href="https://github.com/gaurav123337/interviewiq" target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
        </span>
      </footer>

      {upgrade && <UpgradeModal onClose={() => setUpgrade(false)} reason="Go Pro — unlimited sessions, AI coaching and voice mode." />}
    </div>
  );
}
