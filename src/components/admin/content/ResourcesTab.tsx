import { type Resource, fetchResources, saveResource, deleteResource } from '../../../services/contentService';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '../../../toast';
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from '../../ui';

export function ResourcesTab() {
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchResources()); } catch { /* cache fallback */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = () => {
    setEditing({ id: "", title: "", author: "", type: "book", description: "", affiliate_url: "", icon: "📖", price: "", published: true, sort_order: items.length, clicks: 0 });
    setIsAdding(true);
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast("Title is required"); return; }
    setBusy(true);
    try {
      const saved = await saveResource(editing);
      const next = isAdding ? [...items, saved] : items.map(x => x.id === saved.id ? saved : x);
      setItems(next);
      setEditing(null); setIsAdding(false);
      toast("💾 Resource saved to database");
    } catch (e) { toast("✗ " + ((e as Error).message || "Save failed")); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    setBusy(true);
    try { await deleteResource(id); setItems(items.filter(x => x.id !== id)); toast("🗑️ Resource deleted"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Delete failed")); }
    setBusy(false);
  };

  const move = async (r: Resource, dir: -1 | 1) => {
    const idx = items.findIndex(x => x.id === r.id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    const a = { ...items[idx], sort_order: items[swap].sort_order };
    const b = { ...items[swap], sort_order: items[idx].sort_order };
    setBusy(true);
    try {
      await Promise.all([saveResource(a), saveResource(b)]);
      const next = [...items];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      setItems(next);
    } catch (e) { toast("✗ " + ((e as Error).message || "Reorder failed")); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">📖 Recommended Resources</h3>
            <p className="mt-0.5 text-[12px] text-mut">Affiliate links shown on the landing page. Data stored in Supabase.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add} disabled={busy}>+ Add resource</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className={`${cardCls} p-8 text-center text-mut`}>No resources yet.</div>
      ) : items.map((r, i) => (
        <div key={r.id} className={`${cardCls} p-4 transition-all ${!r.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-acc1/10 text-[18px]">{r.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold">{r.title}</span>
                  {r.badge && <Chip tone="lvl">{r.badge}</Chip>}
                  {!r.published && <Chip>hidden</Chip>}
                </div>
                <div className="text-[11px] text-mut">{r.author} · {r.type} · {r.price}</div>
                <p className="mt-1 max-w-[500px] text-[12px] leading-relaxed text-mut line-clamp-2">{r.description}</p>
                <div className="mt-1 flex gap-3 text-[11px] text-fnt">
                  <span className="text-acctxt">🔗 {r.affiliate_url.slice(0, 40)}…</span>
                  <span>🖱️ {r.clicks} clicks</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => void move(r, -1)} disabled={i === 0 || busy}>↑</button>
              <button className={btnGhost + btnSm} onClick={() => void move(r, 1)} disabled={i === items.length - 1 || busy}>↓</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...r }); setIsAdding(false); }} disabled={busy}>✏️</button>
              <button className={btnDanger + btnSm} onClick={() => void remove(r.id)} disabled={busy}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New resource" : "✏️ Edit resource"}>
          <div className="w-full max-w-[520px] p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Title</span>
                <input className="inp" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Author</span>
                <input className="inp" value={editing.author} onChange={e => setEditing({ ...editing, author: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Type</span>
                <select className="inp" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as Resource["type"] })}>
                  <option value="book">📖 Book</option>
                  <option value="course">🎓 Course</option>
                  <option value="tool">💻 Tool</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Price</span>
                <input className="inp" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} placeholder="$25" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Badge</span>
                <input className="inp" value={editing.badge ?? ""} onChange={e => setEditing({ ...editing, badge: e.target.value || undefined })} placeholder="Best Seller" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Icon</span>
                <input className="inp" value={editing.icon} onChange={e => setEditing({ ...editing, icon: e.target.value })} placeholder="📖" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Affiliate URL</span>
              <input className="inp" value={editing.affiliate_url} onChange={e => setEditing({ ...editing, affiliate_url: e.target.value })} placeholder="https://www.amazon.com/dp/..." />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Description</span>
              <textarea className="inp h-20 w-full resize-y" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                <input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
                Published
              </label>
              <div className="flex gap-2">
                <button className={btnGhost + btnSm} onClick={() => { setEditing(null); setIsAdding(false); }}>Cancel</button>
                <button className={btnPrimary + btnSm} onClick={() => void saveItem()} disabled={busy}>💾 Save</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TipsTab                                                             */
/* ------------------------------------------------------------------ */

