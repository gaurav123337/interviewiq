import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  loadSiteConfig,
  saveSiteConfig,
  resetSiteConfigCache,
  type SiteConfig,
} from "../../services/siteConfig";
import { toast } from "../../toast";
import { btnPrimary, btnGhost, cardCls } from "../ui";

export function SiteConfigSection() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"branding" | "visibility" | "header" | "footer" | "menus" | "hero" | "meta">("branding");

  useEffect(() => {
    void loadSiteConfig().then(setConfig);
  }, []);

  const update = (patch: Partial<SiteConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const ok = await saveSiteConfig(config);
    setSaving(false);
    if (ok) {
      resetSiteConfigCache();
      toast("Site config saved ✓");
    } else {
      toast("Failed to save — check Supabase connection");
    }
  };

  if (!config) {
    return <div className="py-8 text-center text-mut">Loading site config…</div>;
  }

  const tabs = [
    { id: "branding" as const, label: "Branding", icon: "🎨" },
    { id: "visibility" as const, label: "Visibility", icon: "👁️" },
    { id: "header" as const, label: "Header", icon: "🔝" },
    { id: "footer" as const, label: "Footer", icon: "🔻" },
    { id: "menus" as const, label: "Menus", icon: "☰" },
    { id: "hero" as const, label: "Hero", icon: "🏠" },
    { id: "meta" as const, label: "SEO/Meta", icon: "🔍" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[18px] font-extrabold">🎨 Site Configuration</h2>
        <span className="text-[12px] text-mut">Edit header, footer, menus, logo, and all visible text</span>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition-all ${
              activeTab === tab.id
                ? "grad-bg-soft border border-acc1/40 text-acctxt"
                : "border border-line/15 bg-wht/5 text-mut hover:bg-wht/10"
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Visibility tab — enable/disable menu items for all users */}
      {activeTab === "visibility" && (
        <MenuVisibilityTab />
      )}

      {/* Branding tab */}
      {activeTab === "branding" && (
        <div className={`${cardCls} space-y-4 p-5`}>
          <h3 className="text-[14px] font-extrabold">Logo & Brand</h3>
          <Field label="Logo Icon (emoji or URL)" value={config.logo.icon} onChange={v => update({ logo: { ...config.logo, icon: v } })} />
          <Field label="Brand Text" value={config.logo.text} onChange={v => update({ logo: { ...config.logo, text: v } })} />
          <Field label="Tagline" value={config.logo.tagline} onChange={v => update({ logo: { ...config.logo, tagline: v } })} />
        </div>
      )}

      {/* Header tab */}
      {activeTab === "header" && (
        <div className={`${cardCls} space-y-4 p-5`}>
          <h3 className="text-[14px] font-extrabold">Header Navigation</h3>
          <p className="text-[12px] text-mut">Primary tabs shown in the header. Drag to reorder (coming soon).</p>
          {config.header.primaryTabs.map((tab, i) => (
            <div key={i} className="flex items-center gap-2">
              <Field label="" value={tab.icon} onChange={v => {
                const tabs = [...config.header.primaryTabs];
                tabs[i] = { ...tabs[i], icon: v };
                update({ header: { ...config.header, primaryTabs: tabs } });
              }} small />
              <Field label="" value={tab.label} onChange={v => {
                const tabs = [...config.header.primaryTabs];
                tabs[i] = { ...tabs[i], label: v };
                update({ header: { ...config.header, primaryTabs: tabs } });
              }} />
              <button
                onClick={() => {
                  const tabs = config.header.primaryTabs.filter((_, j) => j !== i);
                  update({ header: { ...config.header, primaryTabs: tabs } });
                }}
                className="text-[14px] text-red-400 hover:text-red-300"
              >✕</button>
            </div>
          ))}
          <button
            onClick={() => update({ header: { ...config.header, primaryTabs: [...config.header.primaryTabs, { id: "new", label: "New Tab", icon: "🆕" }] } })}
            className="text-[13px] font-bold text-acctxt hover:underline"
          >+ Add tab</button>
          <div className="flex gap-4">
            <Toggle label="Theme toggle" checked={config.header.showThemeToggle} onChange={v => update({ header: { ...config.header, showThemeToggle: v } })} />
            <Toggle label="Feedback button" checked={config.header.showFeedbackButton} onChange={v => update({ header: { ...config.header, showFeedbackButton: v } })} />
            <Toggle label="Install button" checked={config.header.showInstallButton} onChange={v => update({ header: { ...config.header, showInstallButton: v } })} />
          </div>
        </div>
      )}

      {/* Footer tab */}
      {activeTab === "footer" && (
        <div className={`${cardCls} space-y-4 p-5`}>
          <h3 className="text-[14px] font-extrabold">Footer</h3>
          <Field label="Brand text" value={config.footer.brand} onChange={v => update({ footer: { ...config.footer, brand: v } })} />
          <Field label="Copyright" value={config.footer.copyright} onChange={v => update({ footer: { ...config.footer, copyright: v } })} />
          <p className="text-[12px] font-bold text-mut">Links:</p>
          {config.footer.links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Field label="" value={link.label} onChange={v => {
                const links = [...config.footer.links];
                links[i] = { ...links[i], label: v };
                update({ footer: { ...config.footer, links } });
              }} />
              <Field label="" value={link.href} onChange={v => {
                const links = [...config.footer.links];
                links[i] = { ...links[i], href: v };
                update({ footer: { ...config.footer, links } });
              }} />
            </div>
          ))}
        </div>
      )}

      {/* Menus tab */}
      {activeTab === "menus" && (
        <div className={`${cardCls} space-y-4 p-5`}>
          <h3 className="text-[14px] font-extrabold">More Menu & Mobile Tabs</h3>
          <p className="text-[12px] text-mut">Items in the ☰ menu and bottom mobile nav.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-[12px] font-bold">☰ More Menu</p>
              {config.menus.moreMenu.map((item, i) => (
                <div key={i} className="flex items-center gap-1 text-[12px]">
                  <span>{item.icon}</span>
                  <span className="text-fnt">{item.label}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-[12px] font-bold">📱 Mobile Bottom Nav</p>
              {config.menus.mobileTabs.map((item, i) => (
                <div key={i} className="flex items-center gap-1 text-[12px]">
                  <span>{item.icon}</span>
                  <span className="text-fnt">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero tab */}
      {activeTab === "hero" && (
        <div className={`${cardCls} space-y-4 p-5`}>
          <h3 className="text-[14px] font-extrabold">Hero Section</h3>
          <Field label="Badge text" value={config.hero.badge} onChange={v => update({ hero: { ...config.hero, badge: v } })} textarea />
          <Field label="Title" value={config.hero.title} onChange={v => update({ hero: { ...config.hero, title: v } })} textarea />
          <Field label="Description" value={config.hero.description} onChange={v => update({ hero: { ...config.hero, description: v } })} textarea />
          <Field label="CTA button text" value={config.hero.ctaText} onChange={v => update({ hero: { ...config.hero, ctaText: v } })} />
          <Field label="CTA link" value={config.hero.ctaLink} onChange={v => update({ hero: { ...config.hero, ctaLink: v } })} />
        </div>
      )}

      {/* Meta tab */}
      {activeTab === "meta" && (
        <div className={`${cardCls} space-y-4 p-5`}>
          <h3 className="text-[14px] font-extrabold">SEO & Meta Tags</h3>
          <Field label="Page title" value={config.meta.title} onChange={v => update({ meta: { ...config.meta, title: v } })} textarea />
          <Field label="Meta description" value={config.meta.description} onChange={v => update({ meta: { ...config.meta, description: v } })} textarea />
          <Field label="OG Image path" value={config.meta.ogImage} onChange={v => update({ meta: { ...config.meta, ogImage: v } })} />
          <Field label="Canonical URL" value={config.meta.canonical} onChange={v => update({ meta: { ...config.meta, canonical: v } })} />
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-2 pt-2">
        <button className={btnGhost} onClick={() => void loadSiteConfig().then(setConfig)}>Reset</button>
        <button className={btnPrimary} onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save config"}
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function Field({ label, value, onChange, textarea, small }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean; small?: boolean;
}) {
  const cls = `w-full rounded-xl border border-line/15 bg-wht/5 px-3 ${small ? "py-1.5 text-[12px]" : "py-2 text-[13px]"} text-ink placeholder:text-mut/50 focus:border-acc1/50 focus:outline-none`;
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[12px] font-bold text-mut">{label}</span>}
      {textarea ? (
        <textarea className={cls + " min-h-[60px] resize-y"} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value} onChange={e => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[13px]">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-acc1" />
      <span className="text-fnt">{label}</span>
    </label>
  );
}

/* ── Menu Visibility Tab ─────────────────────────────────────────── */

const ALL_MENU_ITEMS = [
  { id: "onboard", label: "Practice", icon: "🎯", section: "Primary" },
  { id: "planner", label: "Planner", icon: "🗓️", section: "Primary" },
  { id: "roadmap", label: "Roadmap", icon: "🧭", section: "Primary" },
  { id: "systemDesign", label: "System Design", icon: "🏗️", section: "Primary" },
  { id: "playground", label: "Code", icon: "💻", section: "Primary" },
  { id: "drill", label: "Drill", icon: "🎴", section: "More Menu" },
  { id: "bank", label: "Bank", icon: "📚", section: "More Menu" },
  { id: "jobs", label: "Jobs", icon: "💼", section: "More Menu" },
  { id: "learn", label: "Learn a Skill", icon: "🔍", section: "More Menu" },
  { id: "counselor", label: "Skill Counselor", icon: "🧑‍🏫", section: "More Menu" },
  { id: "articles", label: "Articles", icon: "📰", section: "More Menu" },
  { id: "resources", label: "Resources", icon: "🔗", section: "More Menu" },
  { id: "progress", label: "Progress", icon: "📈", section: "More Menu" },
  { id: "history", label: "History", icon: "🗂️", section: "More Menu" },
  { id: "settings", label: "Settings", icon: "⚙️", section: "More Menu" },
  { id: "account", label: "Account", icon: "👤", section: "More Menu" },
];

function MenuVisibilityTab() {
  const { t } = useTranslation();
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("iq.menuVisibility");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);

  const toggle = (id: string, visible: boolean) => {
    setVisibility(prev => ({ ...prev, [id]: visible }));
  };

  const save = async () => {
    setSaving(true);
    // Save to localStorage (works offline, no backend needed)
    localStorage.setItem("iq.menuVisibility", JSON.stringify(visibility));
    // Also try Supabase in the background (non-blocking)
    try {
      const { saveRemoteConfig } = await import("../../services/admin/config");
      await saveRemoteConfig({ menuVisibility: visibility } as any);
    } catch { /* Supabase optional */ }
    toast("Menu visibility saved ✓");
    setSaving(false);
  };

  const sections = [...new Set(ALL_MENU_ITEMS.map(m => m.section))];

  return (
    <div className={`${cardCls} space-y-4 p-5`}>
      <h3 className="text-[14px] font-extrabold">👁️ Menu Visibility</h3>
      <p className="text-[12px] text-mut">
        Enable or disable menu items for all users. Hidden items won't appear in the navigation.
        Changes apply immediately after saving.
      </p>
      {sections.map(section => (
        <div key={section}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">{section}</p>
          <div className="space-y-1.5">
            {ALL_MENU_ITEMS.filter(m => m.section === section).map(item => {
              const visible = visibility[item.id] !== false; // default: visible
              return (
                <label key={item.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                  visible ? "bg-wht/5" : "bg-red-500/5 opacity-50"
                }`}>
                  <span className="text-[16px] w-6 text-center">{item.icon}</span>
                  <span className="flex-1 text-[13px] font-bold text-ink">{item.label}</span>
                  <span className="text-[11px] text-mut">{item.id}</span>
                  <button
                    onClick={() => toggle(item.id, !visible)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      visible ? "bg-ok" : "bg-wht/20"
                    }`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      visible ? "left-[22px]" : "left-0.5"
                    }`} />
                  </button>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <button className={btnPrimary} onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save visibility"}
        </button>
      </div>
    </div>
  );
}
