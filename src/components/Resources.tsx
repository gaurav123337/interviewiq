/* Resource library — the skill-counselor submission surface
   (docs/resource-safety-guard.md). Two paths, one guard:
     - "Save to my resources"  → instant personal save (still passes L0/L1;
       the L2 verdict shows as a soft warning if anything's off).
     - "Suggest to everyone"   → enters the review queue; an admin must
       approve it before it appears in the community library below.
   Every submission is vetted by the submit-resource edge function
   (resourceGuard + Safe Browsing/URLhaus reputation). */

import { useEffect, useMemo, useState } from "react";
import { getCloudState, subscribeCloud } from "../services/cloud";
import {
  approvedResources, deleteMyResource, myResources, reportResource, submitResource, voteResource,
  type ResourceMode, type ResourceRow
} from "../services/resources";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";

const CATEGORIES = ["frontend", "backend", "fullstack", "data", "design", "career", "general"];

export function Resources() {
  const [cloud, setCloud] = useState(getCloudState());
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("frontend");
  const [mode, setMode] = useState<ResourceMode>("personal");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<ResourceRow[]>([]);
  const [approved, setApproved] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => subscribeCloud(setCloud), []);

  const reload = async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([myResources(), approvedResources()]);
      setMine(m);
      setApproved(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const doSubmit = async () => {
    if (!cloud.user) { toast("✋ Sign in (Settings → Cloud sync) to save resources"); return; }
    if (!url.trim() || !title.trim()) { toast("Link and title are required"); return; }
    setBusy(true);
    try {
      const r = await submitResource({ url: url.trim(), title: title.trim(), description: description.trim(), mode, category });
      if (!r.ok) { toast("✗ " + (r.error ?? "Submission failed")); return; }
      toast(mode === "community" ? "📮 Sent for admin review — you'll see it app-wide if approved" : "✅ Saved to your resources");
      if (r.verdict?.status === "blocked" || r.verdict?.status === "suspect") {
        toast("⚠️ Guard flagged this link — see the warning on your saved item");
      }
      setUrl(""); setTitle(""); setDescription("");
      await reload();
    } finally { setBusy(false); }
  };

  const removeMine = async (id: string) => {
    const r = await deleteMyResource(id);
    if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't remove")); return; }
    setMine(m => m.filter(x => x.id !== id));
    toast("🗑️ Removed");
  };

  const flag = async (id: string) => {
    if (!cloud.user) { toast("✋ Sign in to report a resource"); return; }
    const r = await reportResource(id);
    if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't report")); return; }
    toast("🚩 Thanks — 3 flags auto-quarantine the link");
  };

  const vote = async (id: string, direction: 1 | -1) => {
    if (!cloud.user) { toast("✋ Sign in to vote"); return; }
    const r = await voteResource(id, direction);
    if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't vote")); return; }
    setApproved(a => a.map(x => x.id === id ? { ...x, votes: (x.votes ?? 0) + direction } : x));
    toast(direction === 1 ? "👍 Voted up" : "👎 Voted down");
  };

  const guardTone = (g: ResourceRow["guard"]) => {
    if (!g) return null;
    if (g.status === "blocked") return <Chip tone="bad">⛔ Guard blocked — {g.reasons?.[0] ?? "unsafe"}</Chip>;
    if (g.status === "suspect") return <Chip tone="warn">⚠️ Suspicious — {g.reasons?.[0] ?? "review"}</Chip>;
    if (g.status === "pending") return <Chip tone="warn">⏳ Safety review pending</Chip>;
    return <Chip tone="ok">✅ Guard checked</Chip>;
  };

  const communityBadge = (r: ResourceRow) => (
    <Chip tone="co">{r.mode === "community" ? "🤝 Community suggested" : "⭐ Saved by you"}</Chip>
  );

  const mineVisible = useMemo(() => mine.filter(r => r.mode === "personal"), [mine]);

  return (
    <div className="anim-view mx-auto max-w-[900px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🔗 Resources</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Learn from the <span className="grad-text">best links</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">
          Found a great tutorial, blog or course? Educate the app — save it privately, or suggest it to everyone
          (an admin approves it after the safety guard vets the link).
        </p>
      </div>

      {!cloud.user && (
        <div className="mx-auto mt-4 max-w-[560px] rounded-xl border border-acc1/30 bg-acc1/10 px-4 py-3 text-center text-[13px] text-ink">
          🔐 Sign in to save resources and submit suggestions. The community library is public.
        </div>
      )}

      {/* submit form */}
      <section className={`${cardCls} mt-6 p-6`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-extrabold">📮 Submit a resource</h2>
          <button className={btnGhost + btnSm} onClick={() => setShowForm(s => !s)}>{showForm ? "Hide form" : "Show form"}</button>
        </div>
        {showForm && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[14px] text-ink placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[14px] text-ink focus:border-acc1/80 focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Title — e.g. “React Server Components — the official docs”"
              className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[14px] text-ink placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Why is this worth learning? (1–2000 chars)"
              className="h-28 w-full resize-none rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[14px] text-ink placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button className={`${btnGhost + btnSm} ${mode === "personal" ? "ring-2 ring-acc1/50" : ""}`} onClick={() => setMode("personal")}>⭐ Save to my resources</button>
                <button className={`${btnGhost + btnSm} ${mode === "community" ? "ring-2 ring-acc1/50" : ""}`} onClick={() => setMode("community")}>🤝 Suggest to everyone</button>
              </div>
              <button className={btnPrimary + btnSm} onClick={doSubmit} disabled={busy}>
                {busy ? <><span className="spinner" />Vetting…</> : mode === "community" ? "Submit for review" : "Save"}
              </button>
            </div>
            <p className="text-[11.5px] text-mut">
              {mode === "community"
                ? "Every link passes the safety guard (SSRF-safe fetch, Safe Browsing + URLhaus reputation). An admin must approve it — nothing app-wide appears without that recorded decision."
                : "Instant save to your private list. The link still passes the same safety checks — anything flagged shows as a warning on your item."}
            </p>
          </div>
        )}
      </section>

      {/* my saved */}
      <section className={`${cardCls} mt-4 p-6`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">⭐ My saved resources ({mineVisible.length})</h2>
          <button className={btnGhost + btnSm} onClick={() => void reload()} disabled={loading}>Refresh</button>
        </div>
        {mineVisible.length === 0 ? (
          <p className="text-[13px] text-mut">Nothing saved yet — share a link from the form above.</p>
        ) : (
          <div className="space-y-2">
            {mineVisible.map(r => (
              <div key={r.id} className="flex flex-wrap items-start gap-2 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-acctxt hover:underline">{r.title}</a>
                    {guardTone(r.guard)}
                  </div>
                  {r.description && <p className="mt-1 text-[12.5px] text-mut">{r.description}</p>}
                  <p className="mt-1 truncate text-[11.5px] text-fnt">{r.url}</p>
                </div>
                <button className={btnDanger + btnSm} onClick={() => void removeMine(r.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* community library */}
      <section className={`${cardCls} mt-4 p-6`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">🤝 Community library ({approved.length})</h2>
          <button className={btnGhost + btnSm} onClick={() => void reload()} disabled={loading}>Refresh</button>
        </div>
        {loading && !approved.length ? (
          <p className="text-[13px] text-mut"><span className="spinner inline-block" /> Loading…</p>
        ) : approved.length === 0 ? (
          <p className="text-[13px] text-mut">
            No community resources yet — the first admin-approved suggestion lands here (each one passed the safety guard).
          </p>
        ) : (
          <div className="space-y-2">
            {approved.map(r => (
              <div key={r.id} className="flex flex-wrap items-start gap-2 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-acctxt hover:underline">{r.title}</a>
                    {communityBadge(r)}
                    <Chip>{r.category}</Chip>
                  </div>
                  {r.description && <p className="mt-1 text-[12.5px] text-mut">{r.description}</p>}
                  <p className="mt-1 text-[11.5px] text-fnt">
                    by {r.suggested_by ?? "a user"} · {new Date(r.created_at).toLocaleDateString()} · 👍 {r.votes ?? 0}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-1.5">
                  <button className={btnGhost + btnSm} onClick={() => void vote(r.id, 1)} title="This resource helped me">👍</button>
                  <button className={btnGhost + btnSm} onClick={() => void vote(r.id, -1)} title="Not useful">👎</button>
                  <button className={btnGhost + btnSm} onClick={() => void flag(r.id)} title="Report as unsafe — 3 flags auto-quarantine">🚩</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pb-4 pt-6 text-center text-[12px] text-fnt">
        Every link is vetted by the resource safety guard before it lands. Report anything suspicious — 3 flags auto-quarantine it.
      </div>
    </div>
  );
}
