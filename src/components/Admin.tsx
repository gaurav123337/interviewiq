import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LevelId } from "../types";
import { COMPANIES, FIELDS, LEVELS, companyById } from "../data";
import { codingProblemById } from "../data/coding";
import { COMPANY_FREQ, problemsForCompany } from "../data/codingCompanies";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { getTeamsState, selectTeam, subscribeTeams, type TeamsState } from "../services/teams";
import { chat, aiAvailable } from "../ai";
import { draftIssues, findDuplicates, triageLevel, type DuplicateMatch } from "../services/duplicates";
import {
  adminCoachGaps, adminCodingQuality, adminFeedbackFeed, adminQuestionQuality, adminRagHealth,
  mergeQuality, ragHealthSummary, touchQuestion,
  type CodingQualityRow, type CoachGapRow, type FeedbackFeedRow, type QualityRow, type RagHealthRow
} from "../services/quality";
import { getAdminState, subscribeAdmin } from "../services/admin";
import { cleanTextToQuestions } from "../services/cleaner";
import { parseQuestionBatch } from "../services/import";
import { extractFileText } from "../services/pdf";
import {
  adminListUsers, adminMetrics, adminMissCandidates, batchDeleteQuestions, batchSetQuestionsPublished,
  createAnnouncement, createPdfDocument, createQuestion, deleteAnnouncement, deletePdfDocument,
  deleteQuestion, grantAdmin, insertPdfChunks, listAdmins, listPdfDocuments, listQuestionAudit,
  revokeAdmin, saveRemoteConfig, setAnnouncementPublished, setPdfChunkCount, setQuestionPublished,
  updateQuestion, type AdminMetrics, type AdminUserRow, type AuditEntry, type MissCandidate, type PdfDocumentRow
} from "../services/admin";
import { chunkText, embed, sectionChunkText } from "../services/embeddings";
import {
  deleteScraperSource, getScraperSchedule, listScraperSources, runScraperNow, saveScraperSchedule,
  saveScraperSource, setScraperSourceEnabled, type RunResult, type ScraperSourceRow
} from "../services/scraper";
import { getAnnouncements, getPublishedQuestions, getRemoteConfig, type RemoteConfig } from "../services/remoteConfig";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, btnSoft, cardCls, Chip, Modal, Seg, Switch } from "./ui";

type Section = "overview" | "users" | "announcements" | "questions" | "review" | "import" | "scraper" | "config" | "activity" | "quality" | "teams";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📈" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "questions", label: "Question bank", icon: "📚" },
  { id: "review", label: "Review inbox", icon: "🛂" },
  { id: "import", label: "Auto-fill", icon: "⚡" },
  { id: "scraper", label: "Scraper", icon: "🕷️" },
  { id: "config", label: "Product config", icon: "🎛️" },
  { id: "activity", label: "Activity", icon: "🧾" },
  { id: "quality", label: "Quality", icon: "🔎" },
  { id: "teams", label: "Teams", icon: "🏢" }
];

const FEATURE_LABELS: Record<string, string> = {
  paywall: "Freemium paywall (quotas + upsells)",
  roadmap: "Career roadmap",
  playground: "Code playground",
  jd: "Job-description tailoring",
  drill: "Drill mode"
};

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
    <div className="anim-view mx-auto max-w-[1100px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🛡️ Admin</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Product <span className="grad-text">command center</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">Users, metrics, releases, question-bank updates and feature toggles — published instantly to every client.</p>
      </div>

      <div className="mt-6 flex justify-center">
        <Seg options={SECTIONS.map(s => ({ value: s.id, label: `${s.icon} ${s.label}` }))} value={section} onChange={v => setSection(v as Section)} />
      </div>

      <div className="mt-6">
        {section === "overview" && <Overview metrics={metrics} loading={loading} />}
        {section === "users" && <Users users={users} admins={admins} busy={busy} setBusy={setBusy} onChanged={load} />}
        {section === "announcements" && (
          <Announcements list={announcements} busy={busy} setBusy={setBusy} onChanged={async () => { setAnnouncements(getAnnouncements()); }} />
        )}
        {section === "questions" && (
          <Questions list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "review" && (
          <ReviewInbox list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "import" && (
          <AutoFill busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "scraper" && <ScraperSection busy={busy} setBusy={setBusy} />}
        {section === "config" && <ConfigSection config={config} setConfig={setConfig} busy={busy} setBusy={setBusy} />}
        {section === "activity" && <Activity busy={busy} setBusy={setBusy} />}
        {section === "quality" && <QualitySection busy={busy} setBusy={setBusy} />}
        {section === "teams" && <AdminTeams teamState={teamState} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview — business KPIs                                            */
/* ------------------------------------------------------------------ */

function Overview({ metrics, loading }: { metrics: AdminMetrics | null; loading: boolean }) {
  if (loading && !metrics) {
    return <div className="text-center text-mut"><span className="spinner inline-block" /> Loading metrics…</div>;
  }
  const m = metrics ?? {
    totalUsers: 0, newThisWeek: 0, activeToday: 0, active7d: 0, proUsers: 0,
    totalSessions: 0, sessions7d: 0, aiCalls7d: 0, events7d: 0
  };
  const cards = [
    { label: "Total users", value: m.totalUsers, icon: "👥", sub: `${m.newThisWeek} new this week` },
    { label: "Active today", value: m.activeToday, icon: "⚡", sub: `${m.active7d} active in 7 days` },
    { label: "Pro users", value: m.proUsers, icon: "💎", sub: m.totalUsers ? `${Math.round((m.proUsers / m.totalUsers) * 100)}% conversion` : "no users yet" },
    { label: "Sessions (7d)", value: m.sessions7d, icon: "🎯", sub: `${m.totalSessions} all time` },
    { label: "AI calls (7d)", value: m.aiCalls7d, icon: "✨", sub: `${m.events7d} events tracked` },
    { label: "Engagement", value: m.totalUsers ? Math.round((m.active7d / m.totalUsers) * 100) + "%" : "—", icon: "📈", sub: "active 7d / total" }
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map(c => (
        <div key={c.label} className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-mut">{c.label}</span>
            <span className="text-[18px]">{c.icon}</span>
          </div>
          <div className="mt-1.5 text-[26px] font-extrabold tabular-nums">{c.value}</div>
          <div className="mt-0.5 text-[12px] text-fnt">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Users — directory + status + plans + admin grant                    */
/* ------------------------------------------------------------------ */

function Users({ users, admins, busy, setBusy, onChanged }: {
  users: AdminUserRow[]; admins: string[]; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [grantEmail, setGrantEmail] = useState("");

  const doGrant = async () => {
    if (!grantEmail.trim()) { toast("Enter an email"); return; }
    setBusy(true);
    try { await grantAdmin(grantEmail); toast("✅ Admin granted"); setGrantEmail(""); await onChanged(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const doRevoke = async (email: string) => {
    setBusy(true);
    try { await revokeAdmin(email); toast("Admin revoked"); await onChanged(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const status = (u: AdminUserRow): { label: string; tone: "ok" | "warn" | "default" } => {
    if (!u.last_seen) return { label: "Never", tone: "default" };
    const age = Date.now() - new Date(u.last_seen).getTime();
    if (age < 86_400_000) return { label: "Active today", tone: "ok" };
    if (age < 7 * 86_400_000) return { label: "Active 7d", tone: "warn" };
    return { label: "Inactive", tone: "default" };
  };

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/10 p-5">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">👥 Users ({users.length})</h2>
          <p className="text-[12.5px] text-mut">Everyone who signed in and synced. Status reflects their last heartbeat.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={grantEmail} onChange={e => setGrantEmail(e.target.value)}
            placeholder="admin@example.com"
            className="rounded-xl border border-line/15 bg-deep/80 px-3.5 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
          />
          <button className={btnPrimary + btnSm} onClick={doGrant} disabled={busy}>Grant admin</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
              <th className="px-5 py-3 font-bold">User</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-3 py-3 font-bold">Plan</th>
              <th className="px-3 py-3 font-bold">Streak</th>
              <th className="px-3 py-3 font-bold">Sessions</th>
              <th className="px-3 py-3 font-bold">AI calls</th>
              <th className="px-3 py-3 font-bold">Joined</th>
              <th className="px-5 py-3 font-bold">Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-mut">No signed-in users yet — when someone creates an account and syncs, they appear here.</td></tr>
            )}
            {users.map(u => {
              const st = status(u);
              const isAdmin = admins.includes(u.email.toLowerCase());
              return (
                <tr key={u.id} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-5 py-3">
                    <div className="font-bold">{u.email || "—"}</div>
                    <div className="text-[11.5px] text-fnt">last seen {u.last_seen ? new Date(u.last_seen).toLocaleString() : "—"}</div>
                  </td>
                  <td className="px-3 py-3"><Chip tone={st.tone}>{st.label}</Chip></td>
                  <td className="px-3 py-3">
                    <Chip tone={u.tier === "pro" ? "co" : "default"}>{u.tier === "pro" ? "💎 Pro" : "Free"}</Chip>
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums">{u.streak}</td>
                  <td className="px-3 py-3 tabular-nums">{u.sessions_count}</td>
                  <td className="px-3 py-3 tabular-nums">{u.ai_calls}</td>
                  <td className="px-3 py-3 tabular-nums">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {isAdmin ? (
                      <button className={btnDanger + btnSm} onClick={() => doRevoke(u.email)} disabled={busy}>Revoke</button>
                    ) : (
                      <span className="text-fnt">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Announcements — release notes CRUD                                  */
/* ------------------------------------------------------------------ */

function Announcements({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getAnnouncements>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [badge, setBadge] = useState("NEW");
  const [body, setBody] = useState("");

  const publish = async () => {
    if (!title.trim() || !body.trim()) { toast("Title and body are required"); return; }
    setBusy(true);
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), badge: badge.trim() || undefined });
      toast("📣 Announcement published — clients see it on next load");
      setTitle(""); setBody("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">✍️ New announcement</h2>
        <p className="mb-4 text-[12.5px] text-mut">Shows as a dismissible banner under the header for every user.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={'Title — e.g. "New: Interview Roadmap"'} className="inp" />
            <input value={badge} onChange={e => setBadge(e.target.value)} placeholder="Badge (NEW)" className="inp" />
          </div>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="What's new? Keep it to one or two sentences." className="inp w-full resize-y" />
          <button className={btnPrimary + btnSm} onClick={publish} disabled={busy}>Publish</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📣 Live announcements ({list.length})</h2>
        <div className="mt-3 space-y-2.5">
          {list.length === 0 && <p className="text-[13px] text-mut">Nothing published yet.</p>}
          {list.map(a => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.badge && <Chip tone="co">{a.badge}</Chip>}
                  <span className="text-[14px] font-bold">{a.title}</span>
                  <Chip tone={a.published ? "ok" : "default"}>{a.published ? "LIVE" : "DRAFT"}</Chip>
                </div>
                <p className="mt-1 text-[13px] text-mut">{a.body}</p>
                <div className="mt-1 text-[11.5px] text-fnt">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnGhost + btnSm} onClick={async () => { setBusy(true); try { await setAnnouncementPublished(a.id, !a.published); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>
                  {a.published ? "Unpublish" : "Publish"}
                </button>
                <button className={btnDanger + btnSm} onClick={async () => { setBusy(true); try { await deleteAnnouncement(a.id); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Question bank — publish admin-curated questions                     */
/* ------------------------------------------------------------------ */

function Questions({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getPublishedQuestions>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [fieldId, setFieldId] = useState(FIELDS[0]?.id ?? "");
  const [level, setLevel] = useState<LevelId>("senior");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const publish = async () => {
    if (!question.trim()) { toast("Question is required"); return; }
    setBusy(true);
    try {
      await createQuestion({
        fieldId, level, question: question.trim(), answer: answer.trim(),
        keyPoints: keyPoints.split(/[,\n]/).map(k => k.trim()).filter(Boolean)
      });
      toast("📚 Question published — appears in sessions and the bank");
      setQuestion(""); setAnswer(""); setKeyPoints("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">✍️ Add a question</h2>
        <p className="mb-4 text-[12.5px] text-mut">Published questions merge into sessions for that field+level and appear in the Question Bank.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={fieldId} onChange={e => setFieldId(e.target.value)} className="inp">
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
            </select>
            <select value={level} onChange={e => setLevel(e.target.value as LevelId)} className="inp">
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
            </select>
          </div>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Interview question…" className="inp w-full" />
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder="Model answer…" className="inp w-full resize-y" />
          <input value={keyPoints} onChange={e => setKeyPoints(e.target.value)} placeholder="Key points, comma-separated (drives scoring)" className="inp w-full" />
          <button className={btnPrimary + btnSm} onClick={publish} disabled={busy}>Publish question</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📚 Published questions ({list.length})</h2>
        <div className="mt-3 space-y-2.5">
          {list.length === 0 && <p className="text-[13px] text-mut">Nothing published yet.</p>}
          {list.map(q => (
            <div key={q.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="lvl">{LEVELS.find(l => l.id === q.level)?.icon} {LEVELS.find(l => l.id === q.level)?.name}</Chip>
                  <Chip tone="cat">{FIELDS.find(f => f.id === q.fieldId)?.name ?? q.fieldId}</Chip>
                  <Chip tone={q.published ? "ok" : "default"}>{q.published ? "LIVE" : "DRAFT"}</Chip>
                </div>
                <div className="mt-1.5 text-[14px] font-bold">{q.question}</div>
                {q.answer && <p className="mt-1 text-[13px] text-mut line-clamp-2">{q.answer}</p>}
                {q.keyPoints.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{q.keyPoints.slice(0, 5).map(k => <Chip key={k}>{k}</Chip>)}</div>}
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnGhost + btnSm} onClick={async () => { setBusy(true); try { await setQuestionPublished(q.id, !q.published); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>
                  {q.published ? "Unpublish" : "Publish"}
                </button>
                <button className={btnDanger + btnSm} onClick={() => setConfirmDel(q.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDel !== null && (
        <Modal onClose={() => setConfirmDel(null)} title="Delete this question?" desc="It will disappear from every client on next sync.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className={btnDanger} onClick={async () => {
              setBusy(true);
              try { await deleteQuestion(confirmDel); await onChanged(); toast("Question deleted"); }
              catch (e) { toast("✗ " + (e as Error).message); }
              finally { setBusy(false); setConfirmDel(null); }
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review inbox — batch review of scraped/imported drafts              */
/* ------------------------------------------------------------------ */

interface DraftEdit {
  fieldId: string;
  level: LevelId;
  question: string;
  answer: string;
  keyPoints: string[];
}

function ReviewInbox({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getPublishedQuestions>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const drafts = list.filter(q => !q.published);
  /* auto-triage: heuristic issues + near-duplicate detection against the whole bank */
  const triage = useMemo(() => {
    const bank = list.map(q => q.question);
    const map: Record<number, { issues: string[]; level: "ready" | "needs-work" | "review-first"; dups: DuplicateMatch[] }> = {};
    for (const d of drafts) {
      const issues = draftIssues(d);
      const dups = findDuplicates(d.question, bank.filter(q => q !== d.question));
      map[d.id] = { issues, level: triageLevel(issues), dups };
    }
    return map;
  }, [list, drafts]);
  const sortedDrafts = [...drafts].sort((a, b) => {
    const p = { "review-first": 0, "needs-work": 1, ready: 2 };
    return (p[triage[a.id]?.level ?? "ready"] - p[triage[b.id]?.level ?? "ready"]) || a.id - b.id;
  });
  const [aiTriage, setAiTriage] = useState<Record<number, { score: number; note: string }>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [edits, setEdits] = useState<Record<number, DraftEdit>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [candidates, setCandidates] = useState<MissCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [addedQ, setAddedQ] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCandLoading(true);
    void adminMissCandidates().then(setCandidates).catch(() => setCandidates([])).finally(() => setCandLoading(false));
  }, []);

  const addCandidate = async (c: MissCandidate) => {
    setBusy(true);
    try {
      await createQuestion({
        fieldId: c.field_id, level: c.level as LevelId, question: c.question,
        answer: "", keyPoints: [], published: false
      });
      setAddedQ(s => new Set(s).add(c.question));
      toast(`📚 Added "${c.question.slice(0, 40)}…" to the drafts`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const addAllCandidates = async () => {
    const pending = candidates.filter(c => !addedQ.has(c.question));
    if (!pending.length) return;
    setBusy(true);
    try {
      for (const c of pending) {
        await createQuestion({
          fieldId: c.field_id, level: c.level as LevelId, question: c.question,
          answer: "", keyPoints: [], published: false
        });
      }
      setAddedQ(s => new Set([...s, ...pending.map(c => c.question)]));
      toast(`📚 Added ${pending.length} missed-question draft(s)`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* re-seed the editors whenever the list refreshes (post-save, section re-entry) */
  useEffect(() => {
    setEdits(Object.fromEntries(drafts.map(q => [q.id, {
      fieldId: q.fieldId, level: q.level, question: q.question, answer: q.answer, keyPoints: q.keyPoints
    }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const edit = (id: number, patch: Partial<DraftEdit>) =>
    setEdits({ ...edits, [id]: { ...(edits[id] ?? {}), ...patch } });

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () =>
    setSelected(selected.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)));

  const saveOne = async (id: number) => {
    const e = edits[id];
    if (!e || !e.question.trim()) { toast("Question is required"); return; }
    setBusy(true);
    try {
      await updateQuestion(id, {
        fieldId: e.fieldId, level: e.level, question: e.question.trim(),
        answer: e.answer.trim(), keyPoints: e.keyPoints.filter(k => k.trim())
      });
      toast("Saved");
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const publishOne = async (id: number) => {
    setBusy(true);
    try { await setQuestionPublished(id, true); toast("Published — live for all users"); await onChanged(); }
    catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const deleteOne = async (id: number) => {
    setBusy(true);
    try { await deleteQuestion(id); toast("Deleted"); await onChanged(); }
    catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const publishSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      await batchSetQuestionsPublished(ids, true);
      toast(`🚀 Published ${ids.length} question(s) — live for all users`);
      setSelected(new Set());
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const aiTriageAll = async () => {
    const pending = sortedDrafts.filter(d => !aiTriage[d.id]);
    if (!pending.length) return;
    setAiBusy(true);
    const out: Record<number, { score: number; note: string }> = {};
    for (const d of pending) {
      try {
        const raw = await chat([
          { role: "system", content: "You are a senior interview-question editor. Score each draft 0-10 for clarity, answer completeness and key-point quality. Reply with ONLY `N — short reason`." },
          { role: "user", content: `Question: ${d.question}\nModel answer: ${d.answer || "(missing)"}\nKey points: ${d.keyPoints.join(", ") || "(none)"}` }
        ], { temperature: 0.2, maxTokens: 60 });
        const m = raw.trim().match(/^(\d{1,2})\s*[-—:.]\s*(.+)$/s);
        const score = Math.max(0, Math.min(10, Number(m?.[1] ?? 5)));
        out[d.id] = { score, note: (m?.[2] ?? raw).slice(0, 160) };
      } catch { out[d.id] = { score: 5, note: "AI unavailable" }; }
    }
    setAiTriage(t => ({ ...t, ...out }));
    setAiBusy(false);
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      await batchDeleteQuestions(ids);
      toast(`Deleted ${ids.length} question(s)`);
      setSelected(new Set());
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* harvest candidates — real user misses, one click to draft */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">📊 Harvest candidates ({candidates.length})</h2>
            <p className="text-[12.5px] text-mut">
              Questions real users scored ≤2 on (from session analytics, ≥2 attempts). One click turns a
              systemic weak spot into a draft you can review below.
            </p>
          </div>
          {candidates.length > 0 && (
            <button className={btnPrimary + btnSm} onClick={addAllCandidates} disabled={busy || candidates.every(c => addedQ.has(c.question))}>
              ➕ Add all as drafts
            </button>
          )}
        </div>
        {candLoading && <p className="mt-3 text-[12.5px] text-fnt"><span className="spinner" /> Aggregating session answers…</p>}
        {!candLoading && candidates.length === 0 && (
          <p className="mt-3 text-[13px] text-mut">No candidates yet — they appear once users complete sessions (each answer is scored server-side).</p>
        )}
        {candidates.length > 0 && (
          <div className="mt-3 space-y-2">
            {candidates.map(c => {
              const added = addedQ.has(c.question);
              return (
                <div key={c.question} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="lvl">{LEVELS.find(l => l.id === c.level)?.icon} {LEVELS.find(l => l.id === c.level)?.name ?? c.level}</Chip>
                      <Chip tone="cat">{FIELDS.find(f => f.id === c.field_id)?.name ?? c.field_id}</Chip>
                      <Chip tone="bad">{c.misses} missed</Chip>
                      <Chip>{c.miss_rate}% miss rate</Chip>
                      <Chip tone="warn">avg {c.avg_score}/5</Chip>
                    </div>
                    <div className="mt-1.5 text-[13.5px] font-bold">{c.question}</div>
                    <div className="text-[11.5px] text-fnt">{c.attempts} attempt(s)</div>
                  </div>
                  <button className={btnGhost + btnSm} onClick={() => addCandidate(c)} disabled={busy || added}>
                    {added ? "✓ Added" : "➕ Draft"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">🛂 Review inbox ({drafts.length})</h2>
            <p className="text-[12.5px] text-mut">
              Drafts from the weekly scraper, bulk import and PDF/AI cleaning. Edit inline, then
              publish in one click — published questions go live for every user on next sync.
            </p>
          </div>
          {drafts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {aiAvailable() && (
                <button className={btnSoft + btnSm} onClick={aiTriageAll} disabled={aiBusy || busy}>
                  {aiBusy ? <><span className="spinner" /> Scoring…</> : `✨ AI-triage (${sortedDrafts.filter(d => !aiTriage[d.id]).length})`}
                </button>
              )}
              <button className={btnGhost + btnSm} onClick={toggleAll} disabled={busy}>
                {selected.size === drafts.length && drafts.length > 0 ? "Deselect all" : `Select all (${drafts.length})`}
              </button>
              <button className={btnPrimary + btnSm} onClick={publishSelected} disabled={busy || selected.size === 0}>
                🚀 Publish {selected.size || ""}
              </button>
              <button className={btnDanger + btnSm} onClick={deleteSelected} disabled={busy || selected.size === 0}>
                🗑 Delete {selected.size || ""}
              </button>
            </div>
          )}
        </div>
      </div>

      {drafts.length === 0 && (
        <div className={`${cardCls} p-10 text-center`}>
          <div className="text-[30px]">✅</div>
          <p className="mt-2 text-[14px] font-bold">Nothing to review</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-mut">
            Drafts appear here when the weekly scraper runs, or when you import via Auto-fill.
          </p>
        </div>
      )}

      {sortedDrafts.map(d => {
        const e = edits[d.id];
        if (!e) return null;
        const sel = selected.has(d.id);
        const t = triage[d.id];
        const ai = aiTriage[d.id];
        return (
          <div key={d.id} className={`${cardCls} p-5 ${sel ? "ring-2 ring-acc1/60" : ""}`}>
            <div className="mb-3 flex items-start gap-3">
              <input type="checkbox" checked={sel} onChange={() => toggle(d.id)} className="mt-1 h-4 w-4 accent-acc1" />
              <div className="flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t && (
                    <Chip tone={t.level === "ready" ? "ok" : t.level === "needs-work" ? "warn" : "bad"}>
                      {t.level === "ready" ? "🟢 ready" : t.level === "needs-work" ? "🟡 needs work" : "🔴 review first"}
                    </Chip>
                  )}
                  {t && t.issues.map((iss, i) => <Chip key={i} tone="warn">{iss}</Chip>)}
                  {t && t.dups.map((dup, i) => (
                    <Chip key={"dup" + i} tone="co">🔁 ~{Math.round(dup.sim * 100)}% dup</Chip>
                  ))}
                  {ai && (
                    <Chip tone={ai.score >= 7 ? "ok" : ai.score >= 4 ? "warn" : "bad"}>
                      ✨ {ai.score}/10
                    </Chip>
                  )}
                </div>
                {ai?.note && ai.note !== "AI unavailable" && <p className="text-[11.5px] text-fnt">✨ {ai.note}</p>}
                {t && t.dups.length > 0 && (
                  <p className="text-[11.5px] text-fnt">
                    Matches existing: {t.dups[0].text.slice(0, 90)}{t.dups[0].text.length > 90 ? "…" : ""}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <select value={e.fieldId} onChange={ev => edit(d.id, { fieldId: ev.target.value })} className="inp">
                    {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                  </select>
                  <select value={e.level} onChange={ev => edit(d.id, { level: ev.target.value as LevelId })} className="inp">
                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                  </select>
                </div>
                <textarea value={e.question} onChange={ev => edit(d.id, { question: ev.target.value })} rows={2} className="inp w-full resize-y text-[13.5px] font-bold" />
                <textarea value={e.answer} onChange={ev => edit(d.id, { answer: ev.target.value })} rows={3} placeholder="Model answer…" className="inp w-full resize-y" />
                <input
                  value={e.keyPoints.join(", ")}
                  onChange={ev => edit(d.id, { keyPoints: ev.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
                  placeholder="Key points, comma-separated"
                  className="inp w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className={btnGhost + btnSm} onClick={() => saveOne(d.id)} disabled={busy}>💾 Save</button>
              <button className={btnPrimary + btnSm} onClick={() => publishOne(d.id)} disabled={busy}>🚀 Publish</button>
              <button className={btnDanger + btnSm} onClick={() => deleteOne(d.id)} disabled={busy}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scraper — sources, schedule and run-now (all admin-configurable)     */
/* ------------------------------------------------------------------ */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; /* index 0 = ISO day 1 */

function ScraperSection({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [sources, setSources] = useState<ScraperSourceRow[]>([]);
  const [days, setDays] = useState<number[]>([1]);
  const [loading, setLoading] = useState(true);
  const [runReport, setRunReport] = useState<RunResult[] | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  /* add-source form */
  const [fUrl, setFUrl] = useState("");
  const [fType, setFType] = useState<ScraperSourceRow["type"]>("markdown");
  const [fField, setFField] = useState(FIELDS[0]?.id ?? "frontend");
  const [fLevel, setFLevel] = useState("mid");
  const [fMax, setFMax] = useState(20);

  const load = () => {
    setLoading(true);
    void Promise.all([listScraperSources(), getScraperSchedule()])
      .then(([s, d]) => { setSources(s); setDays(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleDay = (iso: number) => {
    setDays(ds => (ds.includes(iso) ? ds.filter(d => d !== iso) : [...ds, iso].sort()));
  };

  const saveSchedule = async () => {
    setBusy(true);
    try { await saveScraperSchedule(days); toast("🗓️ Schedule saved — the cron checks it daily"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const addSource = async () => {
    if (!fUrl.trim().startsWith("http")) { toast("Enter a valid source URL"); return; }
    setBusy(true);
    try {
      await saveScraperSource({ url: fUrl.trim(), type: fType, fieldId: fField, level: fLevel, maxItems: fMax });
      toast("➕ Source added — it will be scraped on the next scheduled run");
      setFUrl("");
      await load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const toggleSource = async (s: ScraperSourceRow, enabled: boolean) => {
    setBusy(true);
    try { await setScraperSourceEnabled(s.id, enabled); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const removeSource = async (id: string) => {
    setBusy(true);
    try { await deleteScraperSource(id); toast("Source removed"); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const runNow = async () => {
    const enabled = sources.filter(s => s.enabled);
    if (!enabled.length) { toast("Enable at least one source first"); return; }
    setRunBusy(true); setRunReport(null);
    try {
      const report = await runScraperNow(sources);
      setRunReport(report);
      const ok = report.filter(r => !r.error);
      const added = report.reduce((n, r) => n + r.inserted, 0);
      toast(`🕷️ Ran ${ok.length}/${report.length} source(s) — ${added} draft(s) landed in the Review inbox`);
    } catch (e) { toast("✗ " + ((e as Error).message || "Run failed")); }
    finally { setRunBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* schedule */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">🗓️ Schedule</h2>
            <p className="text-[12.5px] text-mut">
              Which days the weekly scraper runs (03:00 UTC). The GitHub Actions workflow runs daily
              and skips days not selected here — no repo edits needed to change cadence.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, i) => {
              const iso = i + 1;
              const on = days.includes(iso);
              return (
                <button
                  key={name}
                  onClick={() => toggleDay(iso)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${on ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut hover:bg-wht/10"}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <button className={btnPrimary + btnSm} onClick={saveSchedule} disabled={busy}>💾 Save schedule</button>
        </div>
      </div>

      {/* run now */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">▶ Run now</h2>
            <p className="text-[12.5px] text-mut">
              Fetches every enabled source from this browser and upserts new questions as drafts —
              same pipeline as the cron, no waiting. Sources that block cross-origin fetches still
              run on the scheduled server-side job.
            </p>
          </div>
          <button className={btnOk + btnSm} onClick={runNow} disabled={runBusy || busy}>
            {runBusy ? <><span className="spinner" /> Scraping…</> : `🕷️ Run now (${sources.filter(s => s.enabled).length} sources)`}
          </button>
        </div>
        {runReport && runReport.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {runReport.map(r => (
              <div key={r.sourceId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-wht/5 px-3 py-2 text-[12.5px]">
                <span className="font-bold">{r.sourceId}</span>
                <span className="min-w-[120px] flex-1 truncate text-fnt">{r.url}</span>
                {r.error
                  ? <span className="font-bold text-warn">✗ {r.error}</span>
                  : <span className="font-bold text-ok">✓ +{r.inserted} drafts (from {r.extracted} extracted)</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* sources */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🕷️ Sources ({sources.length})</h2>
        <p className="mb-4 text-[12.5px] text-mut">
          Everything scraped lands in the Review inbox as a draft. Sources are read from here by the
          cron too — <span className="font-mono">content/sources.json</span> in the repo is only the offline fallback.
        </p>
        {loading && <p className="text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
        {!loading && sources.length === 0 && <p className="text-[13px] text-mut">No sources yet — add your first one below.</p>}
        <div className="space-y-2">
          {sources.map(s => (
            <div key={s.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={s.enabled ? "ok" : "default"}>{s.enabled ? "ON" : "OFF"}</Chip>
                  <Chip tone="cat">{FIELDS.find(f => f.id === s.fieldId)?.name ?? s.fieldId}</Chip>
                  <Chip tone="lvl">{LEVELS.find(l => l.id === s.level)?.name ?? s.level}</Chip>
                  <span className="text-[11.5px] font-bold text-fnt">{s.type}</span>
                  <span className="text-[11.5px] text-fnt">max {s.maxItems}</span>
                </div>
                <div className="mt-1 truncate text-[13px] font-bold">{s.url}</div>
                {s.note && <div className="text-[11.5px] text-mut">{s.note}</div>}
              </div>
              <div className="flex flex-none items-center gap-2">
                <Switch checked={s.enabled} onChange={v => toggleSource(s, v)} />
                <button className={btnDanger + btnSm} onClick={() => removeSource(s.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* add source */}
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/40 p-4">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">➕ Add a source</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_130px_130px_110px_90px]">
            <input value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…/README.md" className="inp" />
            <select value={fType} onChange={e => setFType(e.target.value as ScraperSourceRow["type"])} className="inp">
              <option value="markdown">markdown</option>
              <option value="json">json</option>
              <option value="html">html</option>
            </select>
            <select value={fField} onChange={e => setFField(e.target.value)} className="inp">
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={fLevel} onChange={e => setFLevel(e.target.value)} className="inp">
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input type="number" min={1} value={fMax} onChange={e => setFMax(Number(e.target.value))} className="inp" title="Max items per run" />
          </div>
          <button className={`${btnPrimary + btnSm} mt-3`} onClick={addSource} disabled={busy}>Add source</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity — question-bank change history + rollback                  */
/* ------------------------------------------------------------------ */

function Activity({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void listQuestionAudit().then(setAudit).catch(() => setAudit([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const restoreUpdate = async (e: AuditEntry) => {
    const before = e.diff.before;
    if (!before || e.question_id == null) { toast("Nothing to restore"); return; }
    setBusy(true);
    try {
      await updateQuestion(e.question_id, {
        fieldId: before.field_id, level: before.level as LevelId,
        question: before.question, answer: before.answer, keyPoints: before.key_points ?? []
      });
      toast("↩ Restored the previous version");
      load();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const restoreDelete = async (e: AuditEntry) => {
    const row = e.diff.row;
    if (!row || !row.question) { toast("Nothing to restore"); return; }
    setBusy(true);
    try {
      await createQuestion({
        fieldId: row.field_id ?? "general", level: (row.level ?? "mid") as LevelId,
        question: row.question, answer: row.answer ?? "", keyPoints: row.key_points ?? [], published: false
      });
      toast("↩ Restored as a draft — publish it to bring it back live");
      load();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🧾 Question-bank activity ({audit.length})</h2>
          <p className="text-[12.5px] text-mut">
            Every create, edit, publish and delete — including weekly scraper imports. Restore an edit
            or bring back a deleted question from here.
          </p>
        </div>
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>
      {loading && <p className="mt-4 text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
      {!loading && audit.length === 0 && <p className="mt-4 text-[13px] text-mut">No changes logged yet — bank edits appear here as they happen.</p>}
      {!loading && audit.length > 0 && (
        <div className="mt-4 space-y-2">
          {audit.map(e => (
            <div key={e.id} className="rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={e.action === "create" ? "ok" : e.action === "update" ? "warn" : "bad"}>
                  {e.action === "create" ? "＋ create" : e.action === "update" ? "✏️ update" : "🗑 delete"}
                </Chip>
                {e.field_id && <Chip tone="cat">{FIELDS.find(f => f.id === e.field_id)?.name ?? e.field_id}</Chip>}
                {e.level && <Chip tone="lvl">{LEVELS.find(l => l.id === e.level)?.name ?? e.level}</Chip>}
                <span className="min-w-[160px] flex-1 truncate text-[13px] font-bold">{e.question}</span>
                <span className="text-[11.5px] text-fnt">{e.actor === "system" ? "🤖 scraper" : e.actor}</span>
                <span className="text-[11.5px] text-fnt">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              {(e.action === "update" || e.action === "delete") && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-[11.5px] font-bold text-acc3">
                      {e.action === "delete" ? "View deleted content" : "View before → after"}
                    </summary>
                    <div className="mt-1.5 space-y-1.5 rounded-lg bg-deep/50 p-2.5 text-[12px]">
                      {e.action === "delete" && e.diff.row && (
                        <p className="whitespace-pre-wrap text-mut">
                          <span className="font-bold text-ink">{e.diff.row.question}</span>
                          {e.diff.row.answer ? `\n${e.diff.row.answer}` : ""}
                          {e.diff.row.key_points?.length ? `\nKey points: ${e.diff.row.key_points.join(", ")}` : ""}
                        </p>
                      )}
                      {e.action === "update" && e.diff.before && e.diff.after && (
                        <>
                          <p className="text-mut"><span className="font-bold text-warn">BEFORE:</span> {e.diff.before.question} — {e.diff.before.answer?.slice(0, 80) ?? ""}</p>
                          <p className="text-mut"><span className="font-bold text-ok">AFTER:</span> {e.diff.after.question} — {e.diff.after.answer?.slice(0, 80) ?? ""}</p>
                        </>
                      )}
                    </div>
                  </details>
                  <button className={btnGhost + btnSm} onClick={() => (e.action === "delete" ? restoreDelete(e) : restoreUpdate(e))} disabled={busy}>
                    ↩ Restore
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-fill — PDF / bulk import / AI cleaning pipeline                */
/* ------------------------------------------------------------------ */

function AutoFill({ busy, setBusy, onChanged }: {
  busy: boolean; setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [candidates, setCandidates] = useState<ReturnType<typeof parseQuestionBatch>["ok"]>([]);
  const [batchText, setBatchText] = useState("");
  const [batchResult, setBatchResult] = useState<ReturnType<typeof parseQuestionBatch> | null>(null);
  const [busy2, setBusy2] = useState(false);
  const [docs, setDocs] = useState<PdfDocumentRow[]>([]);
  const [ragBusy, setRagBusy] = useState(false);

  useEffect(() => {
    void listPdfDocuments().then(setDocs).catch(() => {});
  }, []);

  const reloadDocs = async () => {
    try { setDocs(await listPdfDocuments()); } catch { /* ignore */ }
  };

  const indexRag = async () => {
    if (!rawText.trim()) { toast("Import a file first"); return; }
    if (!aiAvailable()) { toast("Add an AI key in Settings — indexing needs one"); return; }
    /* skip identical re-uploads — no point re-embedding unchanged content */
    const dup = docs.find(d => d.title === (fileName || "Imported document") && d.char_count === rawText.length);
    if (dup) { toast(`⏭️ "${dup.title}" was already indexed — no changes to embed`); return; }
    setRagBusy(true);
    try {
      /* heading-aware chunking keeps Q&A pairs together; plain text falls back */
      const sectioned = sectionChunkText(rawText);
      const chunks = sectioned.length ? sectioned : chunkText(rawText);
      if (!chunks.length) { toast("Nothing to index — the extracted text is empty"); return; }
      toast(`🧠 Embedding ${chunks.length} chunk(s)…`);
      const vectors = await embed(chunks.map(c => c.content));
      const docId = await createPdfDocument({ title: fileName || "Imported document", source: "pdf-import", charCount: rawText.length });
      await insertPdfChunks(chunks.map((c, i) => ({
        documentId: docId, index: c.index, content: c.content, tokens: c.tokens, embedding: vectors[i]
      })));
      await setPdfChunkCount(docId, chunks.length);
      await reloadDocs();
      toast(`🧠 Indexed ${chunks.length} chunk(s) — the AI tutor is now grounded in this document`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Indexing failed"));
    } finally { setRagBusy(false); }
  };

  const removeDoc = async (id: number) => {
    setRagBusy(true);
    try { await deletePdfDocument(id); await reloadDocs(); toast("Document removed from the knowledge base"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setRagBusy(false); }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setBusy2(true);
    try {
      const text = await extractFileText(f);
      setRawText(text);
      setCandidates([]);
      toast(`📄 Extracted ${text.length.toLocaleString()} chars from ${f.name}`);
    } catch (e) {
      toast("✗ Couldn't read file: " + ((e as Error).message || "unsupported"));
    } finally { setBusy2(false); }
  };

  const clean = async () => {
    if (!rawText.trim()) { toast("Import a file first"); return; }
    if (!aiAvailable()) { toast("Add an AI key in Settings — AI cleaning needs one"); return; }
    setBusy2(true);
    try {
      const out = await cleanTextToQuestions(rawText);
      setCandidates(out);
      toast(`✨ AI extracted ${out.length} candidate question(s) — review below`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI cleaning failed"));
    } finally { setBusy2(false); }
  };

  const importCandidates = async () => {
    if (!candidates.length) return;
    setBusy(true);
    try {
      for (const c of candidates) {
        await createQuestion({ fieldId: c.fieldId, level: c.level, question: c.question, answer: c.answer, keyPoints: c.keyPoints, published: false });
      }
      toast(`📚 Saved ${candidates.length} draft(s) — review in Question bank`);
      setCandidates([]);
      setRawText(""); setFileName("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Import failed")); }
    finally { setBusy(false); }
  };

  const runBatch = async () => {
    const res = parseQuestionBatch(batchText);
    setBatchResult(res);
    if (!res.ok.length) { toast("No valid questions parsed — check the format"); return; }
    setBusy(true);
    try {
      for (const q of res.ok) {
        await createQuestion({ fieldId: q.fieldId, level: q.level, question: q.question, answer: q.answer, keyPoints: q.keyPoints, published: false });
      }
      toast(`📚 Imported ${res.ok.length} draft(s) — review in Question bank`);
      setBatchText(""); setBatchResult(null);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Import failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* PDF / text import */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">📄 Import a document (PDF or TXT)</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Extract the text on-device (nothing is uploaded), then let the AI agent turn it into structured
          question drafts for your review.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btnGhost} cursor-pointer`}>
            📂 {fileName || "Choose PDF / TXT…"}
            <input type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={e => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {rawText && <button className={btnPrimary + btnSm} onClick={clean} disabled={busy || busy2}>✨ Clean with AI</button>}
          {rawText && <span className="text-[12px] text-mut">{rawText.length.toLocaleString()} chars</span>}
        </div>
        {rawText && (
          <div className="mt-3 rounded-lg border border-line/10 bg-deep/40 p-3">
            <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-mut">Extracted preview</div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-mut line-clamp-4">{rawText.slice(0, 900)}</p>
          </div>
        )}
        {candidates.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">AI candidates ({candidates.length})</div>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <div key={i} className="rounded-lg border border-line/10 bg-wht/5 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <Chip tone="lvl">{c.level}</Chip>
                    <Chip tone="cat">{FIELDS.find(f => f.id === c.fieldId)?.name ?? c.fieldId}</Chip>
                  </div>
                  <div className="mt-1 text-[13px] font-bold">{c.question}</div>
                  {c.answer && <p className="mt-1 text-[12.5px] text-mut line-clamp-2">{c.answer}</p>}
                </div>
              ))}
            </div>
            <button className={`${btnPrimary + btnSm} mt-3`} onClick={importCandidates} disabled={busy}>
              📚 Save {candidates.length} as drafts
            </button>
          </div>
        )}
        {rawText && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/10 pt-3">
            <button className={btnPrimary + btnSm} onClick={indexRag} disabled={busy || busy2 || ragBusy}>
              {ragBusy ? <><span className="spinner" /> Embedding…</> : "🧠 Index for RAG"}
            </button>
            <span className="text-[12px] text-mut">Chunks the extracted text into vectors — the AI tutor answers get grounded in this document.</span>
          </div>
        )}
        {!aiAvailable() && (
          <p className="mt-3 text-[12.5px] text-warn">⚠️ AI cleaning + RAG indexing need an API key — add one in Settings to use the ✨ agent. You can still paste raw text below.</p>
        )}
      </div>

      {/* RAG knowledge base */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🧠 Knowledge base ({docs.length})</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Indexed documents are public product knowledge — every signed-in user's AI tutor can
          retrieve and cite them. Delete a document to remove its chunks.
        </p>
        {docs.length === 0 && <p className="text-[13px] text-mut">Nothing indexed yet — import a PDF/TXT above and hit “Index for RAG”.</p>}
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">📄 {d.title}</div>
                <div className="text-[11.5px] text-fnt">
                  {d.chunk_count} chunk(s) · {(d.char_count / 1000).toFixed(1)}k chars · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <button className={btnDanger + btnSm} onClick={() => removeDoc(d.id)} disabled={ragBusy}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk paste import */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">⚡ Bulk import (paste)</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Paste JSON <code className="rounded bg-wht/10 px-1">{'[{ fieldId, level, question, answer, keyPoints }]'}</code> or
          pipe-separated lines <code className="rounded bg-wht/10 px-1">field|level|question|answer|keyPoints</code>. Saved as drafts.
        </p>
        <textarea
          value={batchText}
          onChange={e => setBatchText(e.target.value)}
          rows={7}
          placeholder={`frontend|senior|How do you handle state at scale?|Keep state as close to the UI as it needs to be…|state management, trade-offs\nbackend|mid|Design a rate limiter|…`}
          className="inp w-full resize-y font-mono text-[12.5px]"
        />
        {batchResult && (
          <div className="mt-2 text-[12.5px]">
            <span className="font-bold text-ok">{batchResult.ok.length} valid</span>
            {batchResult.skipped.length > 0 && (
              <span className="text-warn"> · {batchResult.skipped.length} skipped ({batchResult.skipped.slice(0, 3).map(s => s.reason).join("; ")})</span>
            )}
          </div>
        )}
        <button className={`${btnPrimary + btnSm} mt-3`} onClick={runBatch} disabled={busy || !batchText.trim()}>
          📚 Parse & save as drafts
        </button>
      </div>

      {/* Weekly scraper note */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🕷️ Weekly scraper</h2>
        <p className="text-[12.5px] text-mut">
          Configure sources, the run schedule, and trigger a manual scrape from the dedicated
          <span className="font-bold text-ink"> 🕷️ Scraper tab</span> — no repo edits needed. Everything lands here as a
          DRAFT for review.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product config — feature flags, AI capabilities, quotas             */
/* ------------------------------------------------------------------ */

/* Audit trail for company-frequency publishes — drives the weekly digest.
   Kept in the admin's local storage (no schema change); each publish records
   the diff against the previous snapshot plus the new snapshot. */
const FREQ_AUDIT_KEY = "iq.adminFreqAudit";
interface FreqChange { company: string; problem: string; to: number }
interface FreqAuditEntry { at: number; changes: FreqChange[]; snapshot: Record<string, Partial<Record<string, number>>> }

function getFreqAudit(): FreqAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(FREQ_AUDIT_KEY) || "[]") as FreqAuditEntry[]; } catch { return []; }
}
function saveFreqAudit(a: FreqAuditEntry[]): void {
  localStorage.setItem(FREQ_AUDIT_KEY, JSON.stringify(a));
}

function ConfigSection({ config, setConfig, busy, setBusy }: {
  config: RemoteConfig; setConfig: (c: RemoteConfig) => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const setFeature = (f: keyof NonNullable<RemoteConfig["features"]>, v: boolean) =>
    setConfig({ ...config, features: { ...config.features, [f]: v } });
  const setAi = (k: keyof NonNullable<RemoteConfig["ai"]>, v: number | string | boolean) =>
    setConfig({ ...config, ai: { ...config.ai, [k]: v } });
  const setLimit = (k: keyof NonNullable<RemoteConfig["limits"]>, v: number) =>
    setConfig({ ...config, limits: { ...config.limits, [k]: v } });
  /* coach vocabulary JSON editor (families + misconceptions) */
  const [vocabJson, setVocabJson] = useState<string>(() => JSON.stringify(config.coachVocab ?? {}, null, 2));
  /* company question-frequency editor + publish audit (weekly digest) */
  const [freqCo, setFreqCo] = useState<string | null>(null);
  const freqCompanies = COMPANIES.filter(c => c.id !== "general");
  const setFreq = (pid: string, v: number) => {
    if (!freqCo) return;
    const next = { ...(config.companyFreq ?? {}) };
    const co = { ...(next[freqCo] ?? {}) };
    if (v === 0) delete co[pid];
    else co[pid] = v as 1 | 2 | 3;
    next[freqCo] = co;
    setConfig({ ...config, companyFreq: next });
  };
  const [audit, setAudit] = useState<FreqAuditEntry[]>(() => getFreqAudit());
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    adminListUsers()
      .then(rows => { if (on) setActiveWeek(rows.filter(r => r.last_seen && Date.now() - new Date(r.last_seen).getTime() < 7 * 86_400_000).length); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const publish = async () => {
    setBusy(true);
    try {
      await saveRemoteConfig({
        features: config.features, ai: config.ai, limits: config.limits,
        companyFreq: config.companyFreq ?? {}, coachVocab: config.coachVocab
      });
      /* record what changed since the last publish for the weekly digest */
      const prev = audit[0]?.snapshot ?? {};
      const next = config.companyFreq ?? {};
      const changes: FreqChange[] = [];
      for (const [co, entries] of Object.entries(next)) {
        for (const [pid, raw] of Object.entries(entries)) {
          const to = raw as number;
          if (prev[co]?.[pid] !== to) changes.push({ company: co, problem: pid, to });
        }
      }
      for (const [co, entries] of Object.entries(prev)) {
        for (const pid of Object.keys(entries)) {
          if (!next[co]?.[pid]) changes.push({ company: co, problem: pid, to: 0 });
        }
      }
      const entry: FreqAuditEntry = { at: Date.now(), changes, snapshot: JSON.parse(JSON.stringify(next)) };
      const nextAudit = [entry, ...audit].slice(0, 50);
      saveFreqAudit(nextAudit);
      setAudit(nextAudit);
      toast("🎛️ Config published — clients pick it up on next sync");
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🚩 Feature flags</h2>
        <p className="mb-3 text-[12.5px] text-mut">Turn product areas on/off without shipping code. Clients hide the nav entry when a feature is off.</p>
        <div className="space-y-1">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map(f => (
            <OptRow key={f} title={FEATURE_LABELS[f]} sub={config.features[f as keyof NonNullable<RemoteConfig["features"]>] === false ? "Off" : "On"}>
              <Switch checked={config.features[f as keyof NonNullable<RemoteConfig["features"]>] !== false} onChange={v => setFeature(f as keyof NonNullable<RemoteConfig["features"]>, v)} />
            </OptRow>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">✨ AI capabilities</h2>
        <p className="mb-3 text-[12.5px] text-mut">Server-side defaults the product team controls. Users can still override model/base URL locally.</p>
        <div className="space-y-3">
          <OptRow title="AI coaching enabled" sub="Master switch for generative feedback, hints and the tutor">
            <Switch checked={config.ai.enabled !== false} onChange={v => setAi("enabled", v)} />
          </OptRow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label="Max tokens" value={config.ai.maxTokens ?? 700} onChange={v => setAi("maxTokens", v)} />
            <NumField label="Temperature (0–2)" value={config.ai.temperature ?? 0.6} step={0.1} onChange={v => setAi("temperature", v)} />
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Suggested model</span>
              <input value={config.ai.model ?? ""} onChange={e => setAi("model", e.target.value)} placeholder="gpt-4o-mini" className="inp w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Embeddings model (RAG)</span>
              <input value={config.ai.embeddingsModel ?? ""} onChange={e => setAi("embeddingsModel", e.target.value)} placeholder="text-embedding-3-small" className="inp w-full" />
            </label>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🎟️ Free quotas</h2>
        <p className="mb-3 text-[12.5px] text-mut">Applied when the paywall is on. Existing sessionsLeft/aiCallsLeft meters read these live.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField label="Free sessions / month" value={config.limits.sessionsPerMonth ?? 3} onChange={v => setLimit("sessionsPerMonth", v)} />
          <NumField label="Free AI calls / day" value={config.limits.aiPerDay ?? 5} onChange={v => setLimit("aiPerDay", v)} />
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📬 Weekly digest</h2>
        <p className="mb-3 text-[12.5px] text-mut">What changed in the company-frequency rankings over the last 7 days, and how many users are active (they pick up config on their next sync).</p>
        {(() => {
          const week = audit.filter(e => Date.now() - e.at < 7 * 86_400_000);
          const all = week.flatMap(e => e.changes.map(c => ({ ...c, at: e.at })));
          return (
            <div className="text-[12.5px]">
              <div className="mb-2 flex flex-wrap gap-2">
                <Chip tone="co">{all.length} change{all.length === 1 ? "" : "s"} this week</Chip>
                <Chip tone="lvl">👥 {activeWeek ?? "…"} user{activeWeek === 1 ? "" : "s"} active this week</Chip>
              </div>
              {all.length === 0 ? (
                <p className="text-mut">No frequency changes published in the last 7 days.</p>
              ) : (
                <ul className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
                  {all.slice(0, 20).map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-deep/40 px-2.5 py-1">
                      <span className="font-semibold">{companyById(c.company).icon} {companyById(c.company).name} · {c.problem}</span>
                      <span className="text-[11px] font-bold text-acctxt">{c.to === 0 ? "↩ reset to default" : `→ 🔥${c.to}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🔥 Company question frequency</h2>
        <p className="mb-3 text-[12.5px] text-mut">Rank how often each company asks a problem (1 occasional · 2 common · 3 very common). Published overrides merge on top of the baked-in table — no deploy needed, clients pick it up on next sync.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {freqCompanies.map(c => (
            <button
              key={c.id}
              onClick={() => setFreqCo(freqCo === c.id ? null : c.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${freqCo === c.id ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        {freqCo && (
          <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {problemsForCompany(freqCo).map(p => {
              const base = COMPANY_FREQ[freqCo]?.[p.id] ?? 1;
              const cur = config.companyFreq?.[freqCo]?.[p.id];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-2.5 py-1.5 text-[12px]">
                  <span className="flex-1 truncate font-semibold">{p.title}</span>
                  <span className={`text-[10px] font-extrabold uppercase ${p.difficulty === 1 ? "text-ok" : p.difficulty === 2 ? "text-warn" : "text-bad"}`}>
                    {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                  </span>
                  <span className="text-[10px] font-bold text-mut">base 🔥{base}</span>
                  <select
                    value={cur ?? 0}
                    onChange={e => setFreq(p.id, Number(e.target.value))}
                    className="rounded-lg border border-line/15 bg-deep px-1.5 py-1 text-[11px] font-bold text-ink outline-none"
                  >
                    <option value={0}>Default ({base})</option>
                    <option value={1}>1 · Occasional</option>
                    <option value={2}>2 · Common</option>
                    <option value={3}>3 · Very common</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* coach vocabulary — concept families + misconception corrections the
          offline tutor uses; published to every client like the frequency table */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🧠 Coach vocabulary</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Teach the offline tutor new concepts and misconception corrections without a deploy. JSON:
          <span className="font-mono"> {"{"} families: {"{"} family: ["word", "…"] {"}"}, misconceptions: [{"{"} re: "regex", correction: "…" {"}"}] {"}"} </span>
          Family words make answers match (e.g. <span className="font-mono">micro-frontend</span> ≈ splitting); misconception
          regexes settle debates (e.g. <span className="font-mono">"graphql is always better"</span>). Clients apply these on next sync.
        </p>
        <textarea
          value={vocabJson}
          onChange={e => setVocabJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className="inp w-full resize-y font-mono text-[12px] leading-relaxed"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            className={btnGhost + btnSm}
            onClick={() => {
              try {
                const parsed = JSON.parse(vocabJson || "{}") as Record<string, unknown>;
                if (parsed.families !== undefined && (typeof parsed.families !== "object" || Array.isArray(parsed.families))) throw new Error("families must be an object of arrays");
                if (parsed.misconceptions !== undefined && !Array.isArray(parsed.misconceptions)) throw new Error("misconceptions must be an array");
                setConfig({ ...config, coachVocab: (parsed.families || parsed.misconceptions) ? parsed as RemoteConfig["coachVocab"] : undefined });
                toast("✅ Vocabulary staged — hit “Publish config to all clients” to ship it");
              } catch (e) {
                toast("✗ Invalid JSON: " + ((e as Error).message || "parse error"));
              }
            }}
          >
            💾 Validate & stage
          </button>
          {config.coachVocab && (
            <span className="text-[11.5px] text-fnt">
              Staged: {Object.keys(config.coachVocab.families ?? {}).length} famil{(Object.keys(config.coachVocab.families ?? {}).length === 1 ? "y" : "ies")} · {(config.coachVocab.misconceptions ?? []).length} correction{(config.coachVocab.misconceptions ?? []).length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button className={btnPrimary} onClick={publish} disabled={busy}>
          {busy ? <><span className="spinner" /> Publishing…</> : "🚀 Publish config to all clients"}
        </button>
      </div>
    </div>
  );
}

function NumField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-mut">{label}</span>
      <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="inp w-full" />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Admin teams — team analytics section                                */
/* ------------------------------------------------------------------ */

function AdminTeams({ teamState }: { teamState: TeamsState }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  if (!teamState.teams.length) {
    return (
      <div className={`${cardCls} flex flex-col items-center px-6 py-10 text-center`}>
        <div className="text-[36px]">🏢</div>
        <h2 className="mt-2 text-base font-extrabold">No teams yet</h2>
        <p className="mx-auto mt-1 max-w-[400px] text-[13px] text-mut">
          Teams are created from the 🏢 Team view (More menu) by signed-in users — once any exists, their analytics show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {teamState.teams.map(t => (
        <div key={t.teamId} className={`${cardCls} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-3 p-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[15.5px] font-extrabold">
                {t.name}
                {t.role === "owner" ? <span className="rounded-full border border-co/40 bg-co/15 px-2 py-0.5 text-[10px] font-bold text-co">OWNER</span> : <span className="text-[12px] text-mut">· {t.role}</span>}
              </div>
              <div className="mt-1 text-[12.5px] text-mut">{t.members}/{t.seats} seats used</div>
            </div>
            <button
              onClick={() => { selectTeam(t.teamId); setExpandedTeam(expandedTeam === t.teamId ? null : t.teamId); }}
              className="rounded-lg border border-line/20 px-3 py-1.5 text-[12.5px] font-bold text-mut hover:bg-wht/10"
            >
              {expandedTeam === t.teamId ? "△ Collapse" : "▽ View members"}
            </button>
          </div>
          {/* seat utilization bar */}
          <div className="border-t border-line/10 bg-wht/[.03] px-5 py-3">
            <div className="flex items-center justify-between text-[12px] text-mut">
              <span>Seat utilization</span>
              <span>{Math.round((t.members / Math.max(1, t.seats)) * 100)}%</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-wht/10">
              <div className={`h-full rounded-full ${t.members === t.seats ? "grad-bg" : "grad-bg-soft"}`}
                style={{ width: `${Math.min(100, (t.members / Math.max(1, t.seats)) * 100)}%` }} />
            </div>
          </div>
          {expandedTeam === t.teamId && (
            <div className="border-t border-line/10 px-5 py-3">
              <h4 className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">Members</h4>
              {teamState.roster.length === 0 && <p className="text-[12px] text-mut">Loading…</p>}
              {teamState.roster.map(m => (
                <div key={m.userId ?? m.invitedEmail ?? m.email} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <span className="h-2 w-2 rounded-full bg-ok" />
                  <span className="flex-1 font-bold">{m.email ?? m.invitedEmail ?? "—"}</span>
                  <span className="text-mut">{m.status}</span>
                  {m.status === "active" && <span className="text-[11px] text-ok">active</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OptRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 py-3 last:border-0">
      <div>
        <div className="text-[14px] font-bold">{title}</div>
        <div className="text-[12px] text-fnt">{sub}</div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quality Center — scoreboard, calibration, staleness, feedback       */

const QUALITY_TABS = [
  { value: "scoreboard", label: "📊 Scoreboard" },
  { value: "calibration", label: "🎚️ Calibration" },
  { value: "staleness", label: "⏳ Staleness" },
  { value: "feedback", label: "💬 Feedback" },
  { value: "coding", label: "💻 Coding" },
  { value: "coach", label: "🎯 Coach gaps" },
  { value: "rag", label: "🛰️ RAG health" }
] as const;

function QualityBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-ok" : score >= 60 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-[7px] w-[92px] overflow-hidden rounded-full bg-wht/15" title={`${score}/100`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: Math.max(4, score) + "%" }} />
    </div>
  );
}

function QualitySection({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [feed, setFeed] = useState<FeedbackFeedRow[]>([]);
  const [coding, setCoding] = useState<CodingQualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof QUALITY_TABS)[number]["value"]>("scoreboard");
  const [cutoff, setCutoff] = useState(90);
  const [refreshed, setRefreshed] = useState<Set<string>>(new Set());
  const [coachGaps, setCoachGaps] = useState<CoachGapRow[]>([]);
  const [ragRows, setRagRows] = useState<RagHealthRow[]>([]);
  /* coach-gap alerts — topics debated enough to warrant a deep-dive guide */
  const [gapMin, setGapMin] = useState(5);
  const gapAlerts = coachGaps.filter(g => g.discussions >= gapMin);
  const draftGuide = (topic: string) => {
    const t = `Deep-dive guide: ${topic}

Concepts to cover:
- 
- 

Key points interviewers look for:
- 
- 

Common traps:
- 
- 

Practice questions:
- 
`;
    navigator.clipboard.writeText(t).then(() => toast("📋 Guide template copied — paste it into the deep-dive bank"), () => toast("✗ Clipboard blocked — copy manually"));
  };

  const bank = getPublishedQuestions();
  const merged = useMemo(
    () => mergeQuality(rows, bank.map(b => ({ question: b.question, updatedAt: b.updatedAt }))),
    [rows, bank]
  );
  const stale = merged
    .filter(m => m.staleDays != null && m.staleDays > cutoff)
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));

  const load = () => {
    setLoading(true);
    void Promise.all([adminQuestionQuality(), adminFeedbackFeed(50), adminCodingQuality(), adminCoachGaps(), adminRagHealth()])
      .then(([q, f, c, g, r]) => { setRows(q); setFeed(f); setCoding(c); setCoachGaps(g); setRagRows(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const touch = async (question: string) => {
    const q = bank.find(b => b.question === question);
    if (!q) return;
    setBusy(true);
    try {
      await touchQuestion(q.id);
      setRefreshed(s => new Set(s).add(question));
      toast("✓ Marked reviewed — staleness clock restarted");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* calibration bands — pass rate 0-20 / 20-40 / … / 80-100 */
  const confident = merged.filter(m => m.attempts >= 5);
  const tooEasy = confident.filter(m => m.passRate > 90);
  const tooHard = confident.filter(m => m.passRate < 30);
  const bins = [0, 20, 40, 60, 80].map(low => {
    const items = merged.filter(m => m.passRate >= low && m.passRate < low + 20);
    return { low, count: items.length };
  });
  const maxBin = Math.max(1, ...bins.map(b => b.count));

  const bandTone = { healthy: "ok", watch: "warn", fix: "bad" } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🔎 Content quality center</h2>
          <p className="text-[12.5px] text-mut">
            Every question that real users answered, scored on performance, difficulty, feedback and freshness.
            The composite score (0-100) is: avg score · pass-rate band · 👍/👎/🚩 · days since review.
          </p>
        </div>
        <Seg
          options={QUALITY_TABS.map(t => t.value === "coach" && gapAlerts.length > 0 ? { ...t, label: `${t.label} · ${gapAlerts.length}` } : t)}
          value={tab}
          onChange={v => setTab(v)}
        />
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>

      {loading && rows.length === 0 && <p className="text-center text-mut"><span className="spinner inline-block" /> Crunching session data…</p>}

      {tab === "scoreboard" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <h3 className="text-[15px] font-extrabold">📊 Scoreboard ({merged.length} questions with data)</h3>
            <p className="text-[12.5px] text-mut">Worst first. Low-attempt rows are low-confidence — check before acting.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Question</th>
                  <th className="px-3 py-3 font-bold">Field · level</th>
                  <th className="px-3 py-3 font-bold">Attempts</th>
                  <th className="px-3 py-3 font-bold">Avg</th>
                  <th className="px-3 py-3 font-bold">Miss</th>
                  <th className="px-3 py-3 font-bold">Pass</th>
                  <th className="px-3 py-3 font-bold">Feedback</th>
                  <th className="px-3 py-3 font-bold">Stale</th>
                  <th className="px-3 py-3 font-bold">Quality</th>
                  <th className="px-5 py-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {merged.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-10 text-center text-mut">No scored sessions yet — complete an interview and come back.</td></tr>
                )}
                {merged.map(m => (
                  <tr key={m.question} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                    <td className="max-w-[300px] px-5 py-3">
                      <div className="truncate font-bold">{m.question}</div>
                      <div className="text-[11.5px] text-fnt">
                        {m.attempts < 5 ? "⚠️ low confidence" : `last ${m.lastSeen ? new Date(m.lastSeen).toLocaleDateString() : "—"}`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Chip tone="cat">{FIELDS.find(f => f.id === m.fieldId)?.name ?? m.fieldId}</Chip>
                      <span className="ml-1 text-[11.5px] text-fnt">{LEVELS.find(l => l.id === m.level)?.name ?? m.level}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.attempts}</td>
                    <td className="px-3 py-3 font-bold tabular-nums">{m.avgScore}/5</td>
                    <td className="px-3 py-3 tabular-nums text-bad">{m.missRate}%</td>
                    <td className="px-3 py-3 tabular-nums text-ok">{m.passRate}%</td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className="text-ok">👍{m.ups}</span> <span className="text-bad">👎{m.downs}</span> <span className="text-warn">🚩{m.flags}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.staleDays == null ? "—" : m.staleDays + "d"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <QualityBar score={m.score} />
                        <Chip tone={bandTone[m.band]}>{m.score}</Chip>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {bank.some(b => b.question === m.question) && !refreshed.has(m.question) ? (
                        <button className={btnGhost + btnSm} onClick={() => touch(m.question)} disabled={busy}>✓ Reviewed</button>
                      ) : bank.some(b => b.question === m.question) ? (
                        <Chip tone="ok">✓ fresh</Chip>
                      ) : (
                        <span className="text-[11.5px] text-fnt" title="Curated question shipped in code — versioned with the app">in code</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "calibration" && (
        <div className="space-y-4">
          <div className={`${cardCls} p-5`}>
            <h3 className="text-[15px] font-extrabold">🎚️ Difficulty calibration ({confident.length} questions with ≥5 attempts)</h3>
            <p className="text-[12.5px] text-mut">
              Pass rate = % of answers scored ≥3/5. The healthy band is 30-90%: under 30% the question is
              too hard or badly worded; over 90% it's too easy to be worth the user's time.
            </p>
            <div className="mt-4 flex h-[140px] items-end gap-3">
              {bins.map(b => (
                <div key={b.low} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[11px] font-bold tabular-nums text-fnt">{b.count}</div>
                  <div
                    className={`w-full max-w-[80px] rounded-t-lg ${b.low === 40 || b.low === 60 ? "bg-ok/70" : b.low === 20 || b.low === 80 ? "bg-warn/60" : "bg-bad/60"}`}
                    style={{ height: Math.max(4, (b.count / maxBin) * 100) + "px" }}
                  />
                  <div className="text-[10.5px] font-bold text-mut">{b.low}–{b.low + 20}%</div>
                </div>
              ))}
            </div>
          </div>
          {tooEasy.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="mb-2 text-[15px] font-extrabold text-ok">✅ Too easy (&gt;90% pass) — consider leveling up or replacing</h3>
              <ul className="space-y-1.5">
                {tooEasy.map(m => <li key={m.question} className="text-[13px] text-mut">• {m.question} <span className="text-fnt">({m.passRate}% · {m.attempts} attempts)</span></li>)}
              </ul>
            </div>
          )}
          {tooHard.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="mb-2 text-[15px] font-extrabold text-bad">🔴 Too hard or unclear (&lt;30% pass) — review wording & model answer</h3>
              <ul className="space-y-1.5">
                {tooHard.map(m => <li key={m.question} className="text-[13px] text-mut">• {m.question} <span className="text-fnt">({m.passRate}% · {m.attempts} attempts)</span></li>)}
              </ul>
            </div>
          )}
          {confident.length === 0 && <p className="text-center text-mut">Not enough data yet — outliers appear once questions have ≥5 attempts.</p>}
        </div>
      )}

      {tab === "staleness" && (
        <div className={`${cardCls} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h3 className="text-[15px] font-extrabold">⏳ Staleness queue ({stale.length})</h3>
              <p className="text-[12.5px] text-mut">
                Questions not edited or marked reviewed for {cutoff}+ days. Interview topics churn — refresh
                anything the market has moved past. (Curated code questions aren't listed; they ship with the app.)
              </p>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-mut">
              Stale after
              <select value={cutoff} onChange={e => setCutoff(Number(e.target.value))} className="inp w-[90px]">
                {[60, 90, 120, 180, 270, 365].map(d => <option key={d} value={d}>{d}d</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 space-y-2">
            {stale.length === 0 && <p className="py-6 text-center text-[13px] text-mut">Nothing stale — the bank is healthy. 🎉</p>}
            {stale.map(m => (
              <div key={m.question} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{m.question}</div>
                  <div className="text-[11.5px] text-fnt">
                    {m.staleDays}d since last edit · avg {m.avgScore}/5 · {m.attempts} attempts
                  </div>
                </div>
                <Chip tone={(m.staleDays ?? 0) > 270 ? "bad" : (m.staleDays ?? 0) > 180 ? "warn" : "default"}>{(m.staleDays ?? 0)}d</Chip>
                <button className={btnGhost + btnSm} onClick={() => touch(m.question)} disabled={busy || refreshed.has(m.question)}>
                  {refreshed.has(m.question) ? "✓ done" : "✓ Reviewed"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[15px] font-extrabold">💬 Recent answer feedback ({feed.length})</h3>
          <p className="mb-3 text-[12.5px] text-mut">👍/👎/🚩 from every user, signed in or not — the most direct quality signal there is.</p>
          <div className="space-y-2">
            {feed.length === 0 && <p className="py-6 text-center text-[13px] text-mut">No feedback yet — it appears as users rate answers in the app.</p>}
            {feed.map((f, i) => (
              <div key={i} className="flex flex-wrap items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                <span className="text-[16px]">{f.kind === "up" ? "👍" : f.kind === "down" ? "👎" : "🚩"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">{f.question}</div>
                  {f.reason && <div className="mt-0.5 text-[12.5px] text-warn">“{f.reason}”</div>}
                  <div className="mt-0.5 text-[11.5px] text-fnt">
                    {f.fieldId && <>{FIELDS.find(x => x.id === f.fieldId)?.name ?? f.fieldId} · </>}
                    {f.level && <>{LEVELS.find(l => l.id === f.level)?.name ?? f.level} · </>}
                    {new Date(f.createdAt).toLocaleString()}
                  </div>
                </div>
                <Chip tone={f.kind === "up" ? "ok" : f.kind === "down" ? "bad" : "warn"}>{f.kind}</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "coding" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <h3 className="text-[15px] font-extrabold">💻 Coding scoreboard ({coding.length} problems with attempts)</h3>
            <p className="text-[12.5px] text-mut">
              Pass rate per playground problem from real full-suite runs. Under 30% pass = too hard or broken prompt;
              over 90% = too easy. Problems are versioned with the app — a bad one is fixed in the next release.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Problem</th>
                  <th className="px-3 py-3 font-bold">Kind</th>
                  <th className="px-3 py-3 font-bold">Attempts</th>
                  <th className="px-3 py-3 font-bold">Passed</th>
                  <th className="px-3 py-3 font-bold">Pass rate</th>
                  <th className="px-3 py-3 font-bold">Flag</th>
                  <th className="px-5 py-3 font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {coding.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-mut">No coding attempts yet — users solve problems in the 💻 Playground and the scoreboard fills in.</td></tr>
                )}
                {coding
                  .slice()
                  .sort((a, b) => a.passRate - b.passRate || b.attempts - a.attempts)
                  .map(c => {
                    const p = codingProblemById(c.problemId);
                    const label = p ? `${p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"} ${p.title}` : c.problemId;
                    const tone = c.attempts >= 5 && c.passRate < 30 ? "bad" : c.attempts >= 5 && c.passRate > 90 ? "warn" : "ok";
                    const note = c.attempts >= 5 && c.passRate < 30 ? "too hard / broken" : c.attempts >= 5 && c.passRate > 90 ? "too easy" : "healthy";
                    return (
                      <tr key={c.problemId} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                        <td className="px-5 py-3 font-bold">{label}</td>
                        <td className="px-3 py-3">{p ? (p.kind === "fn" ? "function" : p.kind === "ui" ? "UI component" : "CLI algorithm") : "—"}</td>
                        <td className="px-3 py-3 tabular-nums">{c.attempts}</td>
                        <td className="px-3 py-3 tabular-nums">{c.passes}</td>
                        <td className={`px-3 py-3 font-bold tabular-nums ${c.passRate < 30 ? "text-bad" : c.passRate > 90 ? "text-warn" : "text-ok"}`}>{c.passRate}%</td>
                        <td className="px-3 py-3"><Chip tone={tone}>{note}</Chip></td>
                        <td className="px-5 py-3 text-[12.5px] text-fnt">{c.lastSeen ? new Date(c.lastSeen).toLocaleDateString() : "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "coach" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-extrabold">🎯 Coach gaps ({coachGaps.length} topics debated)</h3>
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                Alert at
                <input
                  type="number" min={1} value={gapMin}
                  onChange={e => setGapMin(Math.max(1, Number(e.target.value) || 5))}
                  className="inp w-16 py-1 text-center"
                />
                discussions
              </label>
            </div>
            <p className="mt-1 text-[12.5px] text-mut">
              Weak coding topics users saved from AI-coach discussions (queued as coach_discussion events).
              Topics at or above the alert threshold get flagged for a deep-dive guide.
            </p>
            {gapAlerts.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[12px] font-extrabold uppercase tracking-wider text-bad">🚨 Guide opportunities ({gapAlerts.length})</div>
                {gapAlerts.map(g => (
                  <div key={g.topic} className="flex flex-wrap items-center gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px]">
                    <span className="flex-1 font-bold">{g.topic}</span>
                    <Chip tone="bad">{g.discussions} discussions · {g.users} users</Chip>
                    <button className={btnGhost + btnSm} onClick={() => draftGuide(g.topic)}>✍️ Draft guide</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Topic</th>
                  <th className="px-3 py-3 font-bold">Discussions</th>
                  <th className="px-3 py-3 font-bold">Users</th>
                  <th className="px-5 py-3 font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {coachGaps.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-mut">No coach discussions saved yet — users save chats in the 🤖 AI Coach and the gaps fill in.</td></tr>
                )}
                {coachGaps.map(g => (
                  <tr key={g.topic} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                    <td className="px-5 py-3 font-bold">{g.topic}</td>
                    <td className="px-3 py-3 tabular-nums">{g.discussions}</td>
                    <td className="px-3 py-3 tabular-nums">{g.users}</td>
                    <td className="px-5 py-3 text-[12.5px] text-fnt">{g.lastSeen ? new Date(g.lastSeen).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "rag" && (
        <div className={`${cardCls} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h3 className="text-[15px] font-extrabold">🛰️ RAG health — is the knowledge base answering?</h3>
              <p className="mt-1 text-[12.5px] text-mut">
                Every tutor/coach retrieval queues a rag_event. A low grounded rate or high empty rate means
                users' questions aren't in the uploaded PDFs — time to add documents or improve chunking.
              </p>
            </div>
          </div>
          {(() => {
            const s = ragHealthSummary(ragRows);
            if (!s.total) {
              return <p className="py-6 text-center text-[13px] text-mut">No retrieval events yet — they appear once signed-in users ask the tutor or API coach anything.</p>;
            }
            const signal = (label: string, value: string, tone: "ok" | "warn" | "bad") => (
              <div className="rounded-xl border border-line/10 bg-wht/5 p-4 text-center">
                <div className={`text-[24px] font-extrabold tabular-nums ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad"}`}>{value}</div>
                <div className="mt-0.5 text-[11.5px] font-bold text-mut">{label}</div>
              </div>
            );
            return (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {signal("Retrievals (window)", String(s.total), "ok")}
                  {signal("Grounded rate", s.groundedRate + "%", s.groundedRate >= 60 ? "ok" : s.groundedRate >= 30 ? "warn" : "bad")}
                  {signal("Empty hits", s.emptyRate + "%", s.emptyRate <= 20 ? "ok" : s.emptyRate <= 40 ? "warn" : "bad")}
                  {signal("Avg top similarity", s.avgTopSim.toFixed(2), s.avgTopSim >= 0.55 ? "ok" : s.avgTopSim >= 0.4 ? "warn" : "bad")}
                </div>
                <div className="mt-4 max-h-[360px] space-y-1.5 overflow-y-auto">
                  {ragRows.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                      <span className="min-w-[160px] flex-1 truncate font-bold">{r.query}</span>
                      <Chip tone={r.grounded ? "ok" : "default"}>{r.grounded ? "📚 grounded" : "🧠 general"}</Chip>
                      <Chip>{r.hits} hit{r.hits === 1 ? "" : "s"}</Chip>
                      <Chip>sim {r.topSim.toFixed(2)}</Chip>
                      <span className="text-[11px] text-fnt">{new Date(r.at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
