import { Suspense, lazy, useEffect, useState } from "react";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { getTeamsState, subscribeTeams, type TeamsState } from "../services/teams";
import { getAdminState, subscribeAdmin, adminMetrics, adminListUsers, listAdmins, type AdminMetrics, type AdminUserRow } from "../services/admin";
import { getAnnouncements, getPublishedQuestions, getRemoteConfig, type RemoteConfig } from "../services/remoteConfig";
import { toast } from "../toast";
import { Seg } from "./ui";

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

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📈" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "billing", label: "Billing", icon: "💰" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "questions", label: "Question bank", icon: "📚" },
  { id: "review", label: "Review inbox", icon: "🛂" },
  { id: "import", label: "Auto-fill", icon: "⚡" },
  { id: "scraper", label: "Scraper", icon: "🕷️" },
  { id: "config", label: "Product config", icon: "🎛️" },
  { id: "activity", label: "Activity", icon: "🧾" },
  { id: "quality", label: "Quality", icon: "🔎" },
  { id: "teams", label: "Teams", icon: "🏢" },
  { id: "security", label: "Security", icon: "🔐" },
  { id: "secrets", label: "Secrets", icon: "🔑" },
  { id: "resources", label: "Resources", icon: "🔗" },
  { id: "trends", label: "Trends", icon: "📈" },
  { id: "content", label: "Content CMS", icon: "✍️" },
  { id: "skillRoadmaps", label: "Skill Roadmaps", icon: "🛤️" },
  { id: "aiCosts", label: "AI Costs", icon: "🤖" },
  { id: "contentCuration", label: "Content Pipeline", icon: "📝" }
];

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

  return (
    <div className="anim-view mx-auto max-w-[1100px] overflow-x-hidden">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🛡️ Admin</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Product <span className="grad-text">command center</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">Users, metrics, releases, question-bank updates and feature toggles — published instantly to every client.</p>
      </div>

      <div className="mt-6 flex justify-center">
        <Seg options={SECTIONS.map(s => ({ value: s.id, label: `${s.icon} ${s.label}` }))} value={section} onChange={v => setSection(v as Section)} />
      </div>

      <div className="mt-6">
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
    </div>
  );
}