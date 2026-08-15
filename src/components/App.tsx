import { useEffect, useState } from "react";
import type { View } from "../types";
import { useApp } from "../store";
import { ToastHost } from "../toast";
import { FeedbackButton } from "./Feedback";
import { Onboarding } from "./Onboarding";
import { Interview } from "./Interview";
import { Results } from "./Results";
import { Planner } from "./Planner";
import { Roadmap } from "./Roadmap";
import { Drill } from "./Drill";
import { Bank } from "./Bank";
import { History } from "./History";
import { Progress } from "./Progress";
import { Settings } from "./Settings";
import { Account } from "./Account";
import { Playground } from "./Playground";
import { Admin } from "./Admin";
import { Landing } from "./Landing";
import { Team } from "./Team";
import { Jobs } from "./Jobs";
import { Resources } from "./Resources";
import { Legal } from "./Legal";
import { ShareView } from "./ShareView";
import { checkReminder, checkWeeklyDigest } from "../services/notifications";
import { getTheme, setTheme, type Theme } from "../services/theme";
import { getAdminState, refreshAdminData, subscribeAdmin, type AdminState } from "../services/admin";
import { setAdminUnlocked } from "../services/entitlements";
import { featureOn, markAnnouncementSeen, nextUnseenAnnouncement, type Announcement } from "../services/remoteConfig";
import { getCloudState, isCloudConfigured, subscribeCloud } from "../services/cloud";
import { refreshEntitlement } from "../services/entitlement";
import { Chip } from "./ui";

const PRIMARY_TABS: { id: View; label: string; icon: string }[] = [
  { id: "onboard", label: "Practice", icon: "🎯" },
  { id: "planner", label: "Planner", icon: "🗓️" },
  { id: "roadmap", label: "Roadmap", icon: "🧭" },
  { id: "playground", label: "Code", icon: "💻" }
];

/* secondary destinations live behind the ☰ menu so the nav stays to 4 core tabs */
const MORE_TABS: { id: View; label: string; icon: string }[] = [
  { id: "drill", label: "Drill", icon: "🎴" },
  { id: "bank", label: "Bank", icon: "📚" },
  { id: "jobs", label: "Jobs", icon: "💼" },
  { id: "resources", label: "Resources", icon: "🔗" },
  { id: "progress", label: "Progress", icon: "📈" },
  { id: "history", label: "History", icon: "🗂️" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "account", label: "Account", icon: "👤" }
];

interface BIP extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function App() {
  const { state, nav } = useApp();
  const [installEvt, setInstallEvt] = useState<BIP | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [menuOpen, setMenuOpen] = useState(false);
  const [admin, setAdmin] = useState<AdminState>(() => getAdminState());
  const [banner, setBanner] = useState<Announcement | null>(() => nextUnseenAnnouncement());
  const [cloud, setCloud] = useState(getCloudState());
  const [sharePayload] = useState<string | null>(() => new URLSearchParams(window.location.search).get("share"));

  /* keep the header avatar in sync with sign-in state */
  useEffect(() => subscribeCloud(setCloud), []);

  /* admin role re-check on sign-in / sign-out — the nav entry and the
     admin-unlock flag (all restrictions lifted) follow the account */
  useEffect(() => {
    const un = subscribeCloud(() => { void refreshAdminData().catch(() => {}); });
    return un;
  }, []);

  /* server-verified Pro — refresh the entitlement whenever the sign-in state
     changes (login, logout, sync) and once on boot, so grants/revokes from
     the admin billing dashboard apply without a redeploy */
  useEffect(() => {
    const ref = () => { void refreshEntitlement(); };
    ref();
    const un = subscribeCloud(() => { if (getCloudState().user) ref(); });
    const t = window.setTimeout(ref, 1500);
    return () => { un(); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  };

  /* daily practice reminder — checks on load, on focus, and every minute while open.
     checkReminder is idempotent (fires at most once per day) and needs no backend. */
  useEffect(() => {
    if (!("Notification" in window)) return;
    const check = () => {
      checkReminder({ sessions: state.sessions });
      checkWeeklyDigest({ sessions: state.sessions });
    };
    check();
    const id = setInterval(check, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state.sessions]);

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIP); };
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const install = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  };

  const view = state.view;
  const go = (id: View) => { setMenuOpen(false); nav(id); };
  /* legal pages open in the shared "legal" view; the hash picks the document */
  const openPolicy = (id: string) => { window.location.hash = id; nav("legal"); };

  /* share view overrides all other content */
  if (sharePayload) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-12 pt-6">
          <ShareView payload={sharePayload} />
        </main>
      </div>
    );
  }
  /* feature flags + admin role shape the nav */
  const flagForTab = (id: string): "roadmap" | "playground" | null =>
    id === "roadmap" ? "roadmap" : id === "playground" ? "playground" : null;
  const primaryTabs = PRIMARY_TABS.filter(t => { const f = flagForTab(t.id); return f ? featureOn(f) : true; });
  const moreTabs = [
    ...MORE_TABS.filter(t => (t.id !== "drill" || featureOn("drill")) && (t.id !== "jobs" || featureOn("jobs"))),
    ...(isCloudConfigured() ? [{ id: "team" as View, label: "Team", icon: "🏢" }] : []),
    ...(admin.isAdmin ? [{ id: "admin" as View, label: "Admin", icon: "🛡️" }] : [])
  ];
  const moreActive = moreTabs.some(t => t.id === view);

  useEffect(() => subscribeAdmin(s => { setAdmin(s); setBanner(nextUnseenAnnouncement()); setAdminUnlocked(s.isAdmin); }), []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* header */}
      <header className="no-print sticky top-0 z-50 border-b border-line/10 bg-night/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center gap-3 px-4">
          <button className="flex items-center gap-2.5" onClick={() => nav("landing")}>
            <span className="grid h-9 w-9 place-items-center rounded-xl grad-bg text-[18px] shadow-[0_6px_18px_rgba(99,102,241,.45)]">🎙️</span>
            <span className="text-[17px] font-extrabold tracking-tight">Interview<span className="grad-text">IQ</span></span>
          </button>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {primaryTabs.map(t => (
              <TabBtn key={t.id} icon={t.icon} label={t.label} active={view === t.id} onClick={() => go(t.id)} />
            ))}
          </nav>
          {/* secondary tabs in a hamburger (desktop) */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="More"
              aria-expanded={menuOpen}
              title="More"
              className={`grid h-9 w-9 place-items-center rounded-xl border text-[16px] transition-all ${menuOpen || moreActive ? "border-acc1/50 bg-acc1/15 text-acctxt" : "border-line/15 bg-wht/10 hover:bg-wht/20"}`}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            <div className={`absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-line/10 bg-deep/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl transition-all duration-200 ease-out ${menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-2 opacity-0"}`}>
              <MoreMenu current={view} tabs={moreTabs} onPick={go} />
            </div>
          </div>
          <span className="flex-1" />
          {!online && <span className="hidden rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-[11.5px] font-bold text-warn sm:inline">Offline — cached</span>}
          <button
            onClick={() => go("account")}
            title={cloud.user ? `Account — ${cloud.user.email}` : "Account"}
            aria-label="Account"
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-line/15 bg-wht/10 text-[13px] font-extrabold transition-all hover:bg-wht/20"
          >
            {cloud.user ? (cloud.user.email ?? "?").charAt(0).toUpperCase() : "👤"}
            {cloud.user && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-deep bg-ok" />}
          </button>
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line/15 bg-wht/10 text-[16px] transition-all hover:bg-wht/20"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span className="hidden sm:inline-flex"><FeedbackButton /></span>
          {installEvt && (
            <button
              onClick={install}
              className="hidden rounded-xl border border-acc1/50 bg-acc1/15 px-3.5 py-1.5 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/30 sm:inline-flex"
            >
              ⬇ Install app
            </button>
          )}
        </div>
      </header>

      {/* main */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-6 md:pb-12">
        {view === "landing" && <Landing />}
        {view === "onboard" && <Onboarding />}
        {view === "interview" && <Interview />}
        {view === "results" && <Results />}
        {view === "planner" && <Planner />}
        {view === "roadmap" && <Roadmap />}
        {view === "drill" && <Drill />}
        {view === "bank" && <Bank />}
        {view === "history" && <History />}
        {view === "progress" && <Progress />}        { view === "settings" && <Settings /> }
        { view === "account" && <Account /> }
        { view === "playground" && <Playground /> }
        {view === "admin" && <Admin />}
        {view === "team" && <Team />}
        {view === "legal" && <Legal />}
        {view === "jobs" && <Jobs />}
        {view === "resources" && <Resources />}
      </main>

      {/* app-wide footer — branding + the four legal pages on every view
          (the landing page has its own richer footer) */}
      {view !== "landing" && (
        <footer className="no-print border-t border-line/10 px-4 pb-24 pt-6 md:pb-8">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 text-[12px] text-mut">
            <span className="font-extrabold">Interview<span className="grad-text">IQ</span> — AI Interview Coach</span>
            <span className="flex flex-wrap gap-4">
              <button className="hover:text-ink" onClick={() => openPolicy("terms")}>Terms</button>
              <button className="hover:text-ink" onClick={() => openPolicy("privacy")}>Privacy</button>
              <button className="hover:text-ink" onClick={() => openPolicy("refunds")}>Refunds</button>
              <button className="hover:text-ink" onClick={() => openPolicy("shipping")}>Shipping</button>
              <a href="https://github.com/gaurav123337/interviewiq" target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
            </span>
          </div>
        </footer>
      )}

      {/* product announcement banner */}
      {banner && (
        <div className="no-print fixed inset-x-0 top-[60px] z-40 px-3">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 rounded-xl border border-acc1/40 bg-panel/95 px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-xl">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg grad-bg text-[15px]">📣</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-extrabold">{banner.badge && <Chip tone="co">{banner.badge}</Chip>} {banner.title}</span>
              </div>
              <p className="truncate text-[12.5px] text-mut">{banner.body}</p>
            </div>
            <button
              className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line/15 bg-wht/10 text-[13px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink"
              onClick={() => { markAnnouncementSeen(banner.id); setBanner(null); }}
              aria-label="Dismiss announcement"
            >✕</button>
          </div>
        </div>
      )}

      {/* tap-outside backdrop for the ☰ menu (fades in/out) */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${menuOpen ? "opacity-100" : "pointer-events-none invisible opacity-0"}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />

      {/* bottom nav (mobile) — 4 core tabs + ☰ for the rest */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-line/10 bg-deep/95 backdrop-blur-xl md:hidden">
        <div className={`absolute inset-x-0 bottom-full mb-2 px-3 transition-all duration-200 ease-out ${menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0"}`}>
          <div className="rounded-2xl border border-line/10 bg-deep/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,.5)]">
            <MoreMenu current={view} tabs={moreTabs} onPick={go} />
          </div>
        </div>
        <div className="mx-auto flex max-w-[1200px] items-stretch justify-around px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {primaryTabs.map(t => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${view === t.id ? "text-acc3" : "text-fnt"}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-lg text-[16px] ${view === t.id ? "bg-acc1/20" : ""}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More"
            aria-expanded={menuOpen}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${menuOpen || moreActive ? "text-acc3" : "text-fnt"}`}
          >
            <span className={`grid h-7 w-7 place-items-center rounded-lg text-[16px] ${menuOpen || moreActive ? "bg-acc1/20" : ""}`}>{menuOpen ? "✕" : "☰"}</span>
            More
          </button>
        </div>
      </nav>

      <ToastHost />
    </div>
  );
}

function MoreMenu({ current, tabs, onPick }: { current: View; tabs: { id: View; label: string; icon: string }[]; onPick: (id: View) => void }) {
  return (
    <div className="grid gap-0.5 p-1">
      {tabs.map(t => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold transition-all ${active ? "grad-bg-soft border border-acc1/40 text-acctxt" : "text-fnt hover:bg-wht/10 hover:text-ink"}`}
          >
            <span className="text-[15px]">{t.icon}</span>
            <span className="flex-1 text-left">{t.label}</span>
            {active && <span className="text-[10px] font-extrabold text-acc3">●</span>}
          </button>
        );
      })}
    </div>
  );
}

function TabBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-bold transition-all ${active ? "grad-bg-soft border border-acc1/40 text-acctxt" : "text-mut hover:bg-wht/10 hover:text-ink"}`}
    >
      <span>{icon}</span>{label}
    </button>
  );
}
