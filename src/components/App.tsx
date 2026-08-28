import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { View } from "../types";
import { useApp } from "../store";
import { ToastHost } from "../toast";
import { FeedbackButton } from "./Feedback";
import { FloatingCoach } from "./FloatingCoach";
import { CoachTopicProvider } from "../contexts/CoachContext";
import { checkReminder, checkWeeklyDigest } from "../services/notifications";
import { getTheme, setTheme, type Theme } from "../services/theme";
import { getAdminState, refreshAdminData, subscribeAdmin, type AdminState } from "../services/admin";
import { setAdminUnlocked } from "../services/entitlements";
import { featureOn, menuVisible, markAnnouncementSeen, nextUnseenAnnouncement, type Announcement } from "../services/remoteConfig";
import { getCloudState, isCloudConfigured, subscribeCloud } from "../services/cloud";
import { refreshEntitlement } from "../services/entitlement";
import { ErrorBoundary } from "./ErrorBoundary";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Chip } from "./ui";
import { initExtensionGuard } from "../services/extensionGuard";

/* ------------------------------------------------------------------ */
/* Lazy-loaded page components — split into separate chunks so the     */
/* initial bundle only ships the shell (header, nav, coach, toast).   */
/* ------------------------------------------------------------------ */
const Landing          = lazy(() => import("./Landing").then(m => ({ default: m.Landing })));          
const Onboarding       = lazy(() => import("./Onboarding").then(m => ({ default: m.Onboarding })));   
const Interview        = lazy(() => import("./Interview").then(m => ({ default: m.Interview })));     
const Results          = lazy(() => import("./Results").then(m => ({ default: m.Results })));         
const Planner          = lazy(() => import("./Planner").then(m => ({ default: m.Planner })));         
const Roadmap          = lazy(() => import("./Roadmap").then(m => ({ default: m.Roadmap })));         
const Drill            = lazy(() => import("./Drill").then(m => ({ default: m.Drill })));             
const Bank             = lazy(() => import("./Bank").then(m => ({ default: m.Bank })));               
const History          = lazy(() => import("./History").then(m => ({ default: m.History })));         
const Progress         = lazy(() => import("./Progress").then(m => ({ default: m.Progress })));       
const Settings         = lazy(() => import("./Settings").then(m => ({ default: m.Settings })));       
const Account          = lazy(() => import("./Account").then(m => ({ default: m.Account })));         
const Playground       = lazy(() => import("./Playground").then(m => ({ default: m.Playground })));   
const Admin            = lazy(() => import("./Admin").then(m => ({ default: m.Admin })));             
const Team             = lazy(() => import("./Team").then(m => ({ default: m.Team })));               
const Jobs             = lazy(() => import("./Jobs").then(m => ({ default: m.Jobs })));               
const Resources        = lazy(() => import("./Resources").then(m => ({ default: m.Resources })));     
const Counselor        = lazy(() => import("./Counselor").then(m => ({ default: m.Counselor })));     
const SkillExplorer    = lazy(() => import("./SkillExplorer").then(m => ({ default: m.SkillExplorer })));
const SkillDetail      = lazy(() => import("./SkillDetail").then(m => ({ default: m.SkillDetail }))); 
const SystemDesign     = lazy(() => import("./SystemDesign").then(m => ({ default: m.SystemDesign })));
const Articles         = lazy(() => import("./Articles").then(m => ({ default: m.Articles })));
const Legal            = lazy(() => import("./Legal").then(m => ({ default: m.Legal })));             
const ShareView        = lazy(() => import("./ShareView").then(m => ({ default: m.ShareView })));

const PRIMARY_TABS: { id: View; label: string; icon: string }[] = [
  { id: "onboard", label: "Practice", icon: "🎯" },
  { id: "planner", label: "Planner", icon: "🗓️" },
  { id: "roadmap", label: "Roadmap", icon: "🧭" },
  { id: "systemDesign", label: "System Design", icon: "🏗️" },
  { id: "playground", label: "Code", icon: "💻" }
];

/* secondary destinations live behind the ☰ menu so the nav stays to 5 core tabs (Practice, Planner, Roadmap, System Design, Code) */
const MORE_TABS: { id: View; label: string; icon: string }[] = [
  { id: "drill", label: "Drill", icon: "🎴" },
  { id: "bank", label: "Bank", icon: "📚" },
  { id: "jobs", label: "Jobs", icon: "💼" },
  { id: "learn", label: "Learn a Skill", icon: "🔍" },
  { id: "counselor", label: "Skill Counselor", icon: "🧑‍🏫" },
  { id: "articles", label: "Articles", icon: "📰" },
  { id: "resources", label: "Resources", icon: "🔗" },
  { id: "progress", label: "Progress", icon: "📈" },
  { id: "history", label: "History", icon: "🗂️" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "account", label: "Account", icon: "👤" }
];

/** Suspense fallback shown while a route chunk loads. */
function RouteSpinner() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-mut">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-acc1 border-t-transparent" />
        <span className="text-[13px] font-bold">Loading…</span>
      </div>
    </div>
  );
}

interface BIP extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function App() {
  useTranslation();
  const { state, nav } = useApp();
  const [installEvt, setInstallEvt] = useState<BIP | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [menuOpen, setMenuOpen] = useState(false);
  const [admin, setAdmin] = useState<AdminState>(() => getAdminState());
  const [banner, setBanner] = useState<Announcement | null>(() => nextUnseenAnnouncement());
  const [cloud, setCloud] = useState(getCloudState());
  const [sharePayload] = useState<string | null>(() => new URLSearchParams(window.location.search).get("share"));
  const [swUpdateReady, setSwUpdateReady] = useState(false);

  /* listen for service worker updates — auto-reload after a short delay
     so the user always sees the latest version without manual action */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "SW_UPDATE_READY") {
        setSwUpdateReady(true);
        navigator.serviceWorker?.controller?.postMessage({ type: "SKIP_WAITING" });
        setTimeout(() => window.location.reload(), 800);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  const applySwUpdate = () => {
    navigator.serviceWorker?.controller?.postMessage({ type: "SKIP_WAITING" });
    setSwUpdateReady(false);
    window.location.reload();
  };

  /* detect browser extensions that hijack module imports */
  useEffect(() => { initExtensionGuard(); }, []);

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
  }, []);  const install = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  };

  /* Handle browser back/forward buttons via hashchange */
  useEffect(() => {
    const PATH_TO_VIEW: Record<string, View> = {
      "": "landing", practice: "onboard", interview: "interview", results: "results",
      drill: "drill", bank: "bank", history: "history", settings: "settings",
      planner: "planner", roadmap: "roadmap", playground: "playground", admin: "admin",
      progress: "progress", team: "team", account: "account", legal: "legal",
      jobs: "jobs", articles: "articles", resources: "resources", counselor: "counselor",
      "system-design": "systemDesign", learn: "learn",
    };
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\//, "").replace(/\?.*$/, "");
      const targetView = PATH_TO_VIEW[hash];
      if (targetView && targetView !== state.view) {
        nav(targetView);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [state.view, nav]);


  const view = state.view;
  const go = (id: View) => { setMenuOpen(false); nav(id); };
  /* legal pages open in the shared "legal" view; the hash picks the document */
  const openPolicy = (id: string) => { window.location.hash = id; nav("legal"); };

  /* share view overrides all other content */
  if (sharePayload) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-12 pt-6">
          <Suspense fallback={<RouteSpinner />}>
            <ShareView payload={sharePayload} />
          </Suspense>
        </main>
      </div>
    );
  }
  /* feature flags + admin role shape the nav */
  const flagForTab = (id: string): "roadmap" | "playground" | null =>
    id === "roadmap" ? "roadmap" : id === "playground" ? "playground" : null;
  const primaryTabs = PRIMARY_TABS.filter(t => {
    if (!menuVisible(t.id)) return false;
    const f = flagForTab(t.id);
    return f ? featureOn(f) : true;
  });
  const moreTabs = [
    ...MORE_TABS.filter(t => menuVisible(t.id) && (t.id !== "drill" || featureOn("drill")) && (t.id !== "jobs" || featureOn("jobs"))),
    ...(isCloudConfigured() ? [{ id: "team" as View, label: "Team", icon: "🏢" }] : []),
    ...(admin.isAdmin ? [{ id: "admin" as View, label: "Admin", icon: "🛡️" }] : [])
  ];
  const moreActive = moreTabs.some(t => t.id === view);

  /* mobile bottom nav — India-first journey: practice → match → learn → more.
     The three most-used destinations (Practice, the Jobs match feed, and the
     Skill Counselor) live on the bar; everything else is one tap away. */
  const mobileTabs = [
    { id: "onboard" as View, label: "Practice", icon: "🎯" },
    ...(featureOn("jobs") ? [{ id: "jobs" as View, label: "Jobs", icon: "💼" }] : []),
    { id: "counselor" as View, label: "Counselor", icon: "🧑‍🏫" },
    { id: "systemDesign" as View, label: "Sys Design", icon: "🏗️" }
  ];

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
            title={cloud.user ? `Account — ${cloud.user.email}` : "Sign in / Sign up"}
            aria-label="Account"
            className={`relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[13px] font-bold transition-all active:scale-95 ${
              cloud.user
                ? "border-line/15 bg-wht/10 hover:bg-wht/20"
                : "border-acctxt/40 bg-acctxt/10 text-acctxt hover:bg-acctxt/20"
            }`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-deep/30 text-[12px] font-extrabold">
              {cloud.user ? (cloud.user.email ?? "?").charAt(0).toUpperCase() : "👤"}
            </span>
            <span className="hidden sm:inline">{cloud.user ? (cloud.user.email ?? "Account").split("@")[0] : "Sign in"}</span>
            {cloud.user && <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-deep bg-ok" />}
          </button>
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line/15 bg-wht/10 text-[16px] transition-all hover:bg-wht/20 active:scale-95"
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

      {/* main — each route lazily loaded in its own chunk */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-6 md:pb-12">
        <ErrorBoundary section="page">
          <Suspense fallback={<RouteSpinner />}>
          {view === "landing" && <Landing />}
          {view === "onboard" && <Onboarding />}
          {view === "interview" && <Interview />}
          {view === "results" && <Results />}
          {view === "planner" && <Planner />}
          {view === "roadmap" && <Roadmap />}
          {view === "drill" && <Drill />}
          {view === "bank" && <Bank />}
          {view === "history" && <History />}
          {view === "progress" && <Progress />}
          {view === "settings" && <Settings />}
          {view === "account" && <Account />}
          {view === "playground" && <Playground />}
          {view === "admin" && <Admin />}
          {view === "team" && <Team />}
          {view === "legal" && <Legal />}
          {view === "jobs" && <Jobs />}
          {view === "articles" && <Articles />}
          {view === "resources" && <Resources />}
          {view === "counselor" && <Counselor />}
          {view === "learn" && <SkillExplorer />}
          {view === "learn-detail" && <SkillDetail />}
          {view === "systemDesign" && <SystemDesign />}
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* app-wide footer — branding + the four legal pages on every view
          (the landing page has its own richer footer) */}
      {view !== "landing" && (
        <footer className="no-print border-t border-line/10 px-4 pb-24 pt-6 md:pb-8">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 text-[12px] text-mut sm:flex-row sm:justify-between">
            <span className="font-extrabold">Interview<span className="grad-text">IQ</span> — AI Interview Coach</span>
            <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <button className="transition-colors hover:text-ink" onClick={() => openPolicy("terms")}>Terms</button>
              <button className="transition-colors hover:text-ink" onClick={() => openPolicy("privacy")}>Privacy</button>
              <button className="transition-colors hover:text-ink" onClick={() => openPolicy("refunds")}>Refunds</button>
              <button className="transition-colors hover:text-ink" onClick={() => openPolicy("shipping")}>Shipping</button>
            </span>
          </div>
        </footer>
      )}

      {/* service worker update banner */}
      {swUpdateReady && (
        <div className="no-print fixed inset-x-0 top-[60px] z-40 px-3">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 rounded-xl border border-ok/40 bg-ok/15 px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-xl">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-ok/30 text-[15px]">🔄</span>
            <div className="min-w-0 flex-1">
              <span className="text-[13.5px] font-extrabold">New version available!</span>
              <p className="text-[12.5px] text-mut">Click refresh to get the latest features and improvements.</p>
            </div>
            <button
              onClick={applySwUpdate}
              className="rounded-xl border border-ok/50 bg-ok/20 px-3.5 py-1.5 text-[13px] font-bold text-ok transition-all hover:bg-ok/30"
            >
              🔄 Refresh
            </button>
            <button
              className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line/15 bg-wht/10 text-[13px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink"
              onClick={() => setSwUpdateReady(false)}
              aria-label="Dismiss"
            >✕</button>
          </div>
        </div>
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
        <div className="mx-auto flex max-w-[1200px] items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileTabs.map(t => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold ${view === t.id ? "text-acc3" : "text-fnt"}`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-xl text-[20px] ${view === t.id ? "bg-acc1/20" : ""}`}>{t.icon}</span>
              <span className="leading-none">{t.label}</span>
            </button>
          ))}
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More"
            aria-expanded={menuOpen}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold ${menuOpen || moreActive ? "text-acc3" : "text-fnt"}`}
          >
            <span className={`grid h-9 w-9 place-items-center rounded-xl text-[20px] ${menuOpen || moreActive ? "bg-acc1/20" : ""}`}>{menuOpen ? "✕" : "☰"}</span>
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      <ToastHost />

      {/* global floating AI coach (context-aware) */}
      <CoachTopicProvider>
        <ErrorBoundary section="AI coach">
          <FloatingCoach />
        </ErrorBoundary>
      </CoachTopicProvider>
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
