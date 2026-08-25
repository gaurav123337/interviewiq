import { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useWebVitals, PerfOverlay } from "./PerformanceMonitor";
import { useApp } from "../store";
import { UpgradeModal } from "./Upgrade";
import { btnGhost, btnPrimary, cardCls, Chip } from "./ui";
import { TestimonialsSection, RecommendedResources, SupportSection, AutoRotatingBanners, PopupBanners } from "./Testimonials";

const FEATURES = [
  { icon: "🎯", titleKey: "landing.features.tailored.title", bodyKey: "landing.features.tailored.body" },
  { icon: "🎤", titleKey: "landing.features.mock.title", bodyKey: "landing.features.mock.body" },
  { icon: "🧭", titleKey: "landing.features.roadmap.title", bodyKey: "landing.features.roadmap.body" },
  { icon: "🧠", titleKey: "landing.features.tutor.title", bodyKey: "landing.features.tutor.body" },
  { icon: "💻", titleKey: "landing.features.playground.title", bodyKey: "landing.features.playground.body" },
  { icon: "📚", titleKey: "landing.features.bank.title", bodyKey: "landing.features.bank.body" }
];

const STEPS = [
  { n: "1", titleKey: "landing.howItWorks.step1.title", bodyKey: "landing.howItWorks.step1.body" },
  { n: "2", titleKey: "landing.howItWorks.step2.title", bodyKey: "landing.howItWorks.step2.body" },
  { n: "3", titleKey: "landing.howItWorks.step3.title", bodyKey: "landing.howItWorks.step3.body" }
];

const FAQS = [
  { qKey: "landing.faqs.q1", aKey: "landing.faqs.a1" },
  { qKey: "landing.faqs.q2", aKey: "landing.faqs.a2" },
  { qKey: "landing.faqs.q3", aKey: "landing.faqs.a3" },
  { qKey: "landing.faqs.q4", aKey: "landing.faqs.a4" },
  { qKey: "landing.faqs.q5", aKey: "landing.faqs.a5" }
];

export function Landing() {
  const { t } = useTranslation();
  const { nav } = useApp();
  const vitals = useWebVitals();
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
  /* one currency per pricing card — the Free tier mirrors the Pro tier's
     admin-published currency (₹0 for INR, $0 otherwise) so a page never
     shows "$0" next to "₹699" */
  const priceSym = remotePrice != null ? (remoteCurrency === "INR" ? "₹" : remoteCurrency ? remoteCurrency + " " : "$") : "$";
  const proPrice = remotePrice != null ? `${priceSym}${remotePrice}` : "$9";
  const freePrice = `${priceSym}0`;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="anim-view mx-auto w-full max-w-[1100px]">
      {/* popup banner */}
      <PopupBanners />

      {/* hero banner */}
      <AutoRotatingBanners position="hero" />

      {/* hero */}
      <section className="pt-10 pb-14 text-center sm:pt-16">
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-acc1/40 bg-acc1/10 px-4 py-1.5 text-[12.5px] font-bold text-acctxt">
          {t("landing.badge")}
        </span>
        <h1 className="mx-auto mt-5 max-w-[820px] text-[clamp(32px,6vw,58px)] font-extrabold leading-[1.05] tracking-tight">
          <Trans i18nKey="landing.heroTitle" components={{ 1: <span className="grad-text" />, 3: <span className="grad-text" /> }} />
        </h1>
        <p className="mx-auto mt-5 max-w-[640px] text-[15.5px] leading-relaxed text-mut">
          {t("landing.heroDesc")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button className={btnPrimary + " px-8 py-3.5 text-[15.5px]"} onClick={() => nav("onboard")}>
            {t("landing.startFree")}
          </button>
          <button className={btnGhost + " px-6 py-3.5 text-[15px]"} onClick={() => scrollTo("pricing")}>
            {t("landing.seePricing")}
          </button>
        </div>
        <div className="mx-auto mt-9 flex max-w-[560px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] font-bold text-mut">
          <span>{t("landing.stats.fields")}</span><span className="text-wht/20">•</span>
          <span>{t("landing.stats.levels")}</span><span className="text-wht/20">•</span>
          <span>{t("landing.stats.companies")}</span><span className="text-wht/20">•</span>
          <span>{t("landing.stats.jd")}</span><span className="text-wht/20">•</span>
          <span>{t("landing.stats.offline")}</span>
        </div>
      </section>

      {/* features */}
      <section id="features" className="pb-14">
        <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          <Trans i18nKey="landing.featuresTitle" components={{ 1: <span className="grad-text" /> }} />
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-[14px] text-mut">{t("landing.featuresDesc")}</p>
        <div className="mx-auto mt-8 flex max-w-[900px] flex-wrap justify-center gap-4">
          {FEATURES.map(f => (
            <div key={f.titleKey} className={`${cardCls} w-full p-5 transition-transform hover:-translate-y-0.5 sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]`}>
              <span className="grid h-11 w-11 place-items-center rounded-xl grad-bg-soft text-[20px]">{f.icon}</span>
              <h3 className="mt-3 text-[15.5px] font-extrabold">{t(f.titleKey)}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mut">{t(f.bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="pb-14">
        <div className={`${cardCls} mx-auto grid max-w-[900px] grid-cols-1 gap-6 p-6 sm:grid-cols-3 sm:p-8`}>
          {STEPS.map(s => (
            <div key={s.n} className="flex gap-3.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl grad-bg text-[15px] font-extrabold text-white">{s.n}</span>
              <div>
                <h3 className="text-[14.5px] font-extrabold">{t(s.titleKey)}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-mut">{t(s.bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* midpage banner */}
      <AutoRotatingBanners position="midpage" />

      {/* testimonials */}
      <TestimonialsSection />

      {/* pricing */}
      <section id="pricing" className="pb-14">
        <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          <Trans i18nKey="landing.pricingTitle" components={{ 1: <span className="grad-text" /> }} />
        </h2>
        <p className="mx-auto mt-2 max-w-[480px] text-center text-[14px] text-mut">{t("landing.pricingDesc")}</p>
        <div className="mx-auto mt-8 flex max-w-[860px] flex-wrap justify-center gap-4">
          <div className={`${cardCls} w-full p-6 sm:w-[calc(50%-8px)]`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-extrabold">{t("landing.free")}</h3>
              <Chip tone="ok">{t("landing.forever")}</Chip>
            </div>
            <div className="mt-3 text-[13px] text-mut">{t("landing.freeDesc")}</div>
            <div className="mt-4 text-[34px] font-extrabold tracking-tight">{freePrice}<span className="text-[14px] font-bold text-mut">{t("landing.perMonth")}</span></div>
            <ul className="mt-5 space-y-2 text-[13.5px] text-ink">
              {(t("landing.freeFeatures", { returnObjects: true }) as string[]).map((f: string, i: number) => (
                <li key={i} className="before:content-['✓'] before:mr-2 before:text-ok">{f}</li>
              ))}
            </ul>
            <button className={btnGhost + " mt-6 w-full py-3"} onClick={() => nav("onboard")}>{t("landing.startFreeBtn")}</button>
          </div>
          <div className="grad-bg-soft relative w-full overflow-hidden rounded-2xl border border-acc1/40 p-6 shadow-[0_18px_50px_rgba(99,102,241,.25)] sm:w-[calc(50%-8px)]">
            <span className="absolute right-4 top-4"><Chip tone="co">{t("landing.popular")}</Chip></span>
            <h3 className="text-[16px] font-extrabold">{t("landing.pro")}</h3>
            <div className="mt-3 text-[13px] text-mut">{t("landing.proDesc")}</div>
            <div className="mt-4 text-[34px] font-extrabold tracking-tight">{proPrice}<span className="text-[14px] font-bold text-mut">{t("landing.perMonth")}</span></div>
            <ul className="mt-5 space-y-2 text-[13.5px] text-ink">
              {(t("landing.proFeatures", { returnObjects: true }) as string[]).map((f: string, i: number) => (
                <li key={i} className="before:content-['✓'] before:mr-2 before:text-ok">{f}</li>
              ))}
            </ul>
            <button className={btnPrimary + " mt-6 w-full py-3"} onClick={() => setUpgrade(true)}>Go Pro</button>
          </div>
        </div>
      </section>

      {/* recommended resources */}
      <RecommendedResources />

      {/* footer banner */}
      <AutoRotatingBanners position="footer" />

      {/* FAQ */}
      <section id="faq" className="pb-14">
        <h2 className="text-center text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          <Trans i18nKey="landing.faqTitle" components={{ 1: <span className="grad-text" /> }} />
        </h2>
        <div className="mx-auto mt-7 max-w-[680px] space-y-2.5">
          {FAQS.map(f => (
            <details key={f.qKey} className={`${cardCls} group p-4`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-bold [&::-webkit-details-marker]:hidden">
                {t(f.qKey)}
                <span className="text-acc3 transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-mut">{t(f.aKey)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* support / tip jar */}
      <SupportSection />

      {/* final CTA */}
      <section className="pb-10 text-center">
        <div className={`${cardCls} grad-bg-soft p-8 sm:p-10`}>
          <h2 className="text-[clamp(22px,3.6vw,32px)] font-extrabold tracking-tight"><Trans i18nKey="landing.ctaTitle" components={{ 1: <span className="grad-text" /> }} /></h2>
          <p className="mx-auto mt-2 max-w-[440px] text-[14px] text-mut">{t("landing.ctaDesc")}</p>
          <button className={btnPrimary + " mt-6 px-8 py-3.5 text-[15.5px]"} onClick={() => nav("onboard")}>
            {t("landing.startFree")}
          </button>
        </div>
      </section>

      {/* footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 py-6 text-[12.5px] text-mut">
        <span className="font-extrabold">{t("landing.footer.brand")}</span>
        <span className="flex flex-wrap gap-4">
          <button className="hover:text-ink" onClick={() => nav("onboard")}>{t("landing.footer.practice")}</button>
          <button className="hover:text-ink" onClick={() => scrollTo("pricing")}>{t("landing.footer.pricing")}</button>
          <button className="hover:text-ink" onClick={() => scrollTo("faq")}>{t("landing.footer.faq")}</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "terms"; nav("legal"); }}>{t("landing.footer.terms")}</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "privacy"; nav("legal"); }}>{t("landing.footer.privacy")}</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "refunds"; nav("legal"); }}>{t("landing.footer.refunds")}</button>
          <button className="hover:text-ink" onClick={() => { window.location.hash = "shipping"; nav("legal"); }}>{t("landing.footer.shipping")}</button>
        </span>
      </footer>

      {upgrade && <UpgradeModal onClose={() => setUpgrade(false)} reason="Go Pro — unlimited sessions, AI coaching and voice mode." />}
      {vitals.adminView && <PerfOverlay metrics={vitals} />}
    </div>
  );
}
