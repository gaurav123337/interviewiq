import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LevelId } from "../types";
import { FIELDS, LEVELS } from "../data";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { getAdminState, subscribeAdmin } from "../services/admin";
import {
  adminListUsers, adminMetrics, createAnnouncement, createQuestion, deleteAnnouncement,
  deleteQuestion, grantAdmin, listAdmins, revokeAdmin, saveRemoteConfig, setAnnouncementPublished,
  setQuestionPublished, type AdminMetrics, type AdminUserRow
} from "../services/admin";
import { getAnnouncements, getPublishedQuestions, getRemoteConfig, type RemoteConfig } from "../services/remoteConfig";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, Modal, Seg, Switch } from "./ui";

type Section = "overview" | "users" | "announcements" | "questions" | "config";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📈" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "questions", label: "Question bank", icon: "📚" },
  { id: "config", label: "Product config", icon: "🎛️" }
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
        {section === "config" && <ConfigSection config={config} setConfig={setConfig} busy={busy} setBusy={setBusy} />}
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
/* Product config — feature flags, AI capabilities, quotas             */
/* ------------------------------------------------------------------ */

function ConfigSection({ config, setConfig, busy, setBusy }: {
  config: RemoteConfig; setConfig: (c: RemoteConfig) => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const setFeature = (f: keyof NonNullable<RemoteConfig["features"]>, v: boolean) =>
    setConfig({ ...config, features: { ...config.features, [f]: v } });
  const setAi = (k: keyof NonNullable<RemoteConfig["ai"]>, v: number | string | boolean) =>
    setConfig({ ...config, ai: { ...config.ai, [k]: v } });
  const setLimit = (k: keyof NonNullable<RemoteConfig["limits"]>, v: number) =>
    setConfig({ ...config, limits: { ...config.limits, [k]: v } });

  const publish = async () => {
    setBusy(true);
    try {
      await saveRemoteConfig({ features: config.features, ai: config.ai, limits: config.limits });
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumField label="Max tokens" value={config.ai.maxTokens ?? 700} onChange={v => setAi("maxTokens", v)} />
            <NumField label="Temperature (0–2)" value={config.ai.temperature ?? 0.6} step={0.1} onChange={v => setAi("temperature", v)} />
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Suggested model</span>
              <input value={config.ai.model ?? ""} onChange={e => setAi("model", e.target.value)} placeholder="gpt-4o-mini" className="inp w-full" />
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
