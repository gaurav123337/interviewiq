import { useState } from 'react';
import { TestimonialsTab, AdsTab, ResourcesTab, TipsTab, BannersTab, AnalyticsTab } from './admin/content';

type ContentTab = "testimonials" | "ads" | "resources" | "tips" | "banners" | "analytics";

const TABS: { id: ContentTab; label: string; icon: string }[] = [
  { id: "testimonials", label: "Testimonials", icon: "⭐" },
  { id: "ads", label: "Ads", icon: "📢" },
  { id: "banners", label: "Banners", icon: "🖼️" },
  { id: "resources", label: "Resources", icon: "📖" },
  { id: "tips", label: "Tip Jar", icon: "❤️" },
  { id: "analytics", label: "Analytics", icon: "📊" },
];

export function ContentSection() {
  const [tab, setTab] = useState<ContentTab>("testimonials");

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap justify-center gap-1 rounded-xl border border-line/15 bg-deep/60 p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-all ${tab === t.id ? "bg-acc1/20 text-acctxt border border-acc1/40" : "text-mut hover:bg-wht/10 hover:text-ink"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "testimonials" && <TestimonialsTab />}
      {tab === "ads" && <AdsTab />}
      {tab === "banners" && <BannersTab />}
      {tab === "resources" && <ResourcesTab />}
      {tab === "tips" && <TipsTab />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}
