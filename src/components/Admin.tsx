import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LevelId } from "../types";
import { FIELDS, LEVELS } from "../data";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { aiAvailable } from "../ai";
import { getAdminState, subscribeAdmin } from "../services/admin";
import { cleanTextToQuestions } from "../services/cleaner";
import { parseQuestionBatch } from "../services/import";
import { extractFileText } from "../services/pdf";
import {
  adminListUsers, adminMetrics, batchDeleteQuestions, batchSetQuestionsPublished,
  createAnnouncement, createPdfDocument, createQuestion, deleteAnnouncement, deletePdfDocument,
  deleteQuestion, grantAdmin, insertPdfChunks, listAdmins, listPdfDocuments, revokeAdmin,
  saveRemoteConfig, setAnnouncementPublished, setPdfChunkCount, setQuestionPublished,
  updateQuestion, type AdminMetrics, type AdminUserRow, type PdfDocumentRow
} from "../services/admin";
import { chunkText, embed } from "../services/embeddings";
import { getAnnouncements, getPublishedQuestions, getRemoteConfig, type RemoteConfig } from "../services/remoteConfig";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, Modal, Seg, Switch } from "./ui";

type Section = "overview" | "users" | "announcements" | "questions" | "review" | "import" | "config";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📈" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "questions", label: "Question bank", icon: "📚" },
  { id: "review", label: "Review inbox", icon: "🛂" },
  { id: "import", label: "Auto-fill", icon: "⚡" },
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
        {section === "review" && (
          <ReviewInbox list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "import" && (
          <AutoFill busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
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
  const [edits, setEdits] = useState<Record<number, DraftEdit>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

      {drafts.map(d => {
        const e = edits[d.id];
        if (!e) return null;
        const sel = selected.has(d.id);
        return (
          <div key={d.id} className={`${cardCls} p-5 ${sel ? "ring-2 ring-acc1/60" : ""}`}>
            <div className="mb-3 flex items-start gap-3">
              <input type="checkbox" checked={sel} onChange={() => toggle(d.id)} className="mt-1 h-4 w-4 accent-acc1" />
              <div className="flex-1 space-y-2.5">
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
    setRagBusy(true);
    try {
      const chunks = chunkText(rawText);
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
          The repo ships a scheduled scraper (<span className="font-mono">.github/workflows/scrape-weekly.yml</span>) that runs
          every Monday. Configure sources in <span className="font-mono">content/sources.json</span> (URL, type, field/level,
          enabled) — every item lands here as a DRAFT for review. Run it anytime from the repo's Actions tab.
        </p>
      </div>
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
