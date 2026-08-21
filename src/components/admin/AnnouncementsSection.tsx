/* AnnouncementsSection — extracted from Admin.tsx */

import { useState } from "react";
import { createAnnouncement, deleteAnnouncement, setAnnouncementPublished } from "../../services/admin";
import { getAnnouncements } from "../../services/remoteConfig";
import { toast } from "../../toast";
import { btnPrimary, btnSm, btnGhost, btnDanger, cardCls, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* Announcements — release notes CRUD                                  */
/* ------------------------------------------------------------------ */

export function AnnouncementsSection({ list, busy, setBusy, onChanged }: {
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
