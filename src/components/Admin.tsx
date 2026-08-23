import { Suspense, lazy, useEffect, useState } from "react";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { getTeamsState, subscribeTeams, type TeamsState } from "../services/teams";
import { getAdminState, subscribeAdmin, adminMetrics, adminListUsers, listAdmins, type AdminMetrics, type AdminUserRow } from "../services/admin";
import { getAnnouncements, getPublishedQuestions, getRemoteConfig, type RemoteConfig } from "../services/remoteConfig";
import { toast } from "../toast";

/* ------------------------------------------------------------------ */
/* Lazy-loaded admin sections — only bundled when the tab is opened    */
/* ------------------------------------------------------------------ */

const OverviewSection = lazy(() => import("./admin/OverviewSection").then(m => ({ default: m.OverviewSection })));
const UsersSection = lazy(() => import("./admin/UsersSection").then(m => ({ default: m.UsersSection })));
const AnnouncementsSection = lazy(() => import("./admin/AnnouncementsSection").then(m => ({ default: m.AnnouncementsSection })));
const QuestionsSection = lazy(() => import("./admin/QuestionsSection").then(m => ({ default: m.QuestionsSection })));
const ReviewInbox = lazy(() => import("./admin/ReviewInbox").then(m => ({ default: m.ReviewInbox })));
const AutoFill = lazy(() => import("./admin/ImportSection").then(m => ({ default: m.AutoFill })));
const ScraperSection = lazy(() => import("./admin/ScraperSection").then(m => ({ default: m.ScraperSection })));
const ConfigSection = lazy(() => import("./admin/ConfigSection").then(m => ({ default: m.ConfigSection })));
const ActivitySection = lazy(() => import("./admin/ActivitySection").then(m => ({ default: m.ActivitySection })));
const QualitySection = lazy(() => import("./admin/QualitySection").then(m => ({ default: m.QualitySection })));
const TeamsSection = lazy(() => import("./admin/TeamsSection").then(m => ({ default: m.TeamsSection })));
const SecuritySection = lazy(() => import("./admin/SecuritySection").then(m => ({ default: m.SecuritySection })));
const SecretsSection = lazy(() => import("./admin/SecretsSection").then(m => ({ default: m.SecretsSection })));
const ResourcesSection = lazy(() => import("./admin/ResourcesSection").then(m => ({ default: m.ResourcesSection })));
const TrendsSection = lazy(() => import("./admin/TrendsSection").then(m => ({ default: m.TrendsSection })));
const ContentSection = lazy(() => import("./AdminContent").then(m => ({ default: m.ContentSection })));
const AdminSkillRoadmaps = lazy(() => import("./AdminSkillRoadmaps").then(m => ({ default: m.AdminSkillRoadmaps })));
const BillingSection = lazy(() => import("./admin/BillingSection").then(m => ({ default: m.BillingSection })));
const AICostSection = lazy(() => import("./admin/AICostSection").then(m => ({ default: m.AICostSection })));
const ContentCuration = lazy(() => import("./admin/ContentCuration").then(m => ({ default: m.ContentCuration })));


type Section = "overview" | "users" | "announcements" | "questions" | "review" | "import" | "scraper" | "config" | "activity" | "quality" | "billing" | "teams" | "security" | "secrets" | "resources" | "trends" | "content" | "skillRoadmaps" | "aiCosts" | "contentCuration";

interface NavItem { id: Section; label: string; icon: string; }
interface NavGroup { label: string; icon: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  { label: "Analytics", icon: "\u{1F4CA}", items: [
    { id: "overview", label: "Overview", icon: "\u{1F4C8}" },
    { id: "activity", label: "Activity", icon: "\u{1F9FE}" },
    { id: "trends", label: "Trends", icon: "\u{1F4C9}" },
    { id: "aiCosts", label: "AI Costs", icon: "\u{1F916}" },
  ]},
  { label: "Content", icon: "\u{1F4DA}", items: [
    { id: "questions", label: "Question Bank", icon: "\u2753" },
    { id: "review", label: "Review Inbox", icon: "\u{1F6C2}" },
    { id: "scraper", label: "Scraper", icon: "\u{1F577}\uFE0F" },
    { id: "contentCuration", label: "Content Pipeline", icon: "\u{1F4DD}" },
    { id: "content", label: "Content CMS", icon: "\u270D\uFE0F" },
    { id: "skillRoadmaps", label: "Skill Roadmaps", icon: "\u{1F6E4}\uFE0F" },
    { id: "import", label: "Auto-fill", icon: "\u26A1" },
  ]},
  { label: "People", icon: "\u{1F465}", items: [
    { id: "users", label: "Users", icon: "\u{1F464}" },
    { id: "teams", label: "Teams", icon: "\u{1F3E2}" },
    { id: "announcements", label: "Announcements", icon: "\u{1F4E3}" },
    { id: "resources", label: "Resources", icon: "\u{1F517}" },
  ]},
  { label: "System", icon: "\u2699\uFE0F", items: [
    { id: "config", label: "Product Config", icon: "\u{1F39B}\uFE0F" },
    { id: "quality", label: "Quality", icon: "\u{1F50E}" },
    { id: "billing", label: "Billing", icon: "\u{1F4B0}" },
    { id: "security", label: "Security", icon: "\u{1F510}" },
    { id: "secrets", label: "Secrets", icon: "\u{1F511}" },
  ]},
];

function AdminSidebar({ section, setSection, collapsed, setCollapsed }: {
  section: Section; setSection: (s: Section) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(NAV_GROUPS.map(g => g.label)));
  const toggleGroup = (label: string) => {
    setOpenGroups(prev => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n; });
  };

  return (
    <aside className={`flex flex-col border-r border-line/10 bg-deep/60 transition-all duration-200 ${collapsed ? "w-[52px]" : "w-[220px]"} shrink-0 overflow-y-auto`}>
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-b border-line/10 text-[14px] text-mut hover:text-ink transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? "\u00BB" : "\u00AB"}
      </button>
      <nav className="flex-1 py-2">
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups.has(group.label);
          const hasActive = group.items.some(i => i.id === section);
          return (
            <div key={group.label} className="mb-1">
              <button onClick={() => !collapsed && toggleGroup(group.label)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${collapsed ? "justify-center" : ""} ${hasActive ? "text-acc" : "text-mut hover:text-ink"}`}
                title={collapsed ? group.label : undefined}>
                <span className="text-[13px]">{group.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <span className="text-[10px] opacity-50">{isOpen ? "\u25BE" : "\u25B8"}</span>
                  </>
                )}
              </button>
              {isOpen && !collapsed && (
                <div className="ml-1">
                  {group.items.map(item => (
                    <button key={item.id} onClick={() => setSection(item.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-all ${section === item.id ? "bg-acc/15 font-bold text-acc" : "text-ink/80 hover:bg-panel3 hover:text-ink"}`}>
                      <span className="text-[14px] w-5 text-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {collapsed && (
                <div className="flex flex-col items-center gap-0.5">
                  {group.items.map(item => (
                    <button key={item.id} onClick={() => setSection(item.id)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[15px] transition-all ${section === item.id ? "bg-acc/20 text-acc" : "text-ink/70 hover:bg-panel3 hover:text-ink"}`}
                      title={item.label}>{item.icon}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/** Suspense fallback for lazy-loaded admin sections */
function SectionSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="mb-3 text-[28px] animate-pulse">⏳</div>
        <p className="text-[13px] text-mut">Loading section…</p>
      </div>
    </div>
  );
}

export function Admin() {
  const [admin, setAdmin] = useState(getAdminState());
  const [cloud, setCloud] = useState(getCloudState());
  const [teamState, setTeamState] = useState<TeamsState>(() => getTeamsState());
  const [section, setSection] = useState<Section>("overview");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [announcements, setAnnouncements] = useState(getAnnouncements());
  const [questions, setQuestions] = useState(getPublishedQuestions());
  const [config, setConfig] = useState<RemoteConfig>(() => getRemoteConfig());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => subscribeAdmin(setAdmin), []);
  useEffect(() => subscribeCloud(setCloud), []);
  useEffect(() => subscribeTeams(setTeamState), []);

  const load = async () => {
    setLoading(true);
    try {
      const [m, u, a] = await Promise.all([adminMetrics(), adminListUsers(), listAdmins()]);
      setMetrics(m); setUsers(u); setAdmins(a);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load admin data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (admin.isAdmin) void load(); }, [admin.isAdmin]);
  useEffect(() => { setAnnouncements(getAnnouncements()); }, [section]);
  useEffect(() => { setQuestions(getPublishedQuestions()); }, [section]);

  if (!admin.ready) {
    return (
      <div className="anim-view mx-auto max-w-[760px] pt-16 text-center">
        <div className="mb-4 text-[44px]">🛡️</div>
        <h1 className="text-2xl font-extrabold">Checking admin access…</h1>
      </div>
    );
  }

  if (!admin.isAdmin) {
    return (
      <div className="anim-view mx-auto max-w-[560px] pt-16 text-center">
        <div className="mb-4 text-[44px]">🔒</div>
        <h1 className="text-2xl font-extrabold">Admin only</h1>
        <p className="mx-auto mt-2 max-w-[420px] text-[14.5px] text-mut">
          {cloud.user
            ? <>You're signed in as <span className="font-bold text-ink">{cloud.user.email}</span>, but that account isn't on the admin allow-list.</>
            : "Sign in with an admin account to open the dashboard."}
        </p>
        {!cloud.user && (
          <p className="mx-auto mt-4 max-w-[420px] rounded-xl border border-line/10 bg-wht/5 px-4 py-3 text-[12.5px] text-mut">
            💡 Sign in via <span className="font-bold text-ink">Settings → Cloud sync</span> with an allow-listed admin email, then come back here.
          </p>
        )}
      </div>
    );
  }

  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === section));
  const activeItem = activeGroup?.items.find(i => i.id === section);

  return (
    <div className="anim-view flex h-[calc(100vh-52px)] overflow-hidden">
      <AdminSidebar section={section} setSection={setSection} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-line/10 bg-deep/80 backdrop-blur-sm px-6 py-3">
          <div className="flex items-center gap-2 text-[12px] text-mut">
            <span>🛡️ Admin</span>
            {activeGroup && (
              <>
                <span className="opacity-40">/</span>
                <span>{activeGroup.icon} {activeGroup.label}</span>
              </>
            )}
            {activeItem && (
              <>
                <span className="opacity-40">/</span>
                <span className="font-bold text-ink">{activeItem.icon} {activeItem.label}</span>
              </>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-[1100px] px-6 py-6">
          <Suspense fallback={<SectionSkeleton />}>
            {section === "overview" && <OverviewSection metrics={metrics} loading={loading} onOpenSecrets={() => setSection("secrets")} />}
            {section === "users" && <UsersSection users={users} admins={admins} busy={busy} setBusy={setBusy} onChanged={load} />}
        {section === "announcements" && (
          <AnnouncementsSection list={announcements} busy={busy} setBusy={setBusy} onChanged={async () => { setAnnouncements(getAnnouncements()); }} />
        )}
        {section === "questions" && (
          <QuestionsSection list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "review" && (
          <ReviewInbox list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "import" && (
          <AutoFill busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "scraper" && <ScraperSection busy={busy} setBusy={setBusy} />}
        {section === "config" && <ConfigSection config={config} setConfig={setConfig} busy={busy} setBusy={setBusy} />}
        {section === "activity" && <ActivitySection busy={busy} setBusy={setBusy} />}
        {section === "billing" && <BillingSection />}
        {section === "quality" && (
          <QualitySection
            busy={busy}
            setBusy={setBusy}
            onApplyHardFloor={v => {
              setConfig(c => ({ ...c, rag: { ...c.rag, hardFloor: v } }));
              setSection("config");
              toast(`🎚️ Hard floor staged at ${v.toFixed(2)} — hit “Publish config to all clients” to ship it`);
            }}
            onStageTuning={(minSim, hardFloor) => {
              setConfig(c => ({ ...c, rag: { ...c.rag, minSim, hardFloor } }));
              toast(`🎚️ Playground pick staged — cutoff ${minSim.toFixed(2)}, hard floor ${hardFloor.toFixed(2)}. Publish config to ship it.`);
            }}
          />
        )}
        {section === "teams" && <TeamsSection teamState={teamState} />}
        {section === "security" && <SecuritySection />}
        {section === "secrets" && <SecretsSection />}
        {section === "resources" && <ResourcesSection />}
        {section === "trends" && <TrendsSection />}
        {section === "content" && <ContentSection />}
        {section === "aiCosts" && <AICostSection busy={busy} setBusy={setBusy} />}
        {section === "contentCuration" && <ContentCuration busy={busy} setBusy={setBusy} />}
            {section === "skillRoadmaps" && <AdminSkillRoadmaps />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}