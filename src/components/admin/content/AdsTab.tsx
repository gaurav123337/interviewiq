import { type Ad, fetchAds, saveAd, deleteAd } from '../../../services/contentService';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '../../../toast';
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from '../../ui';

export function AdsTab() {
  const [items, setItems] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchAds()); } catch { /* cache fallback */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = () => {
    setEditing({ id: "", title: "", description: "", sponsor: "", image_url: "", link_url: "", bg_color: "", text_color: "", position: "landing-pricing", start_date: null, end_date: null, published: true, auto_rotate: false, rotate_interval: 5, impressions: 0, clicks: 0 });
    setIsAdding(true);
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast("Title is required"); return; }
    setBusy(true);
    try {
      const saved = await saveAd(editing);
      const next = isAdding ? [...items, saved] : items.map(x => x.id === saved.id ? saved : x);
      setItems(next);
      setEditing(null); setIsAdding(false);
      toast("💾 Ad saved to database");
    } catch (e) { toast("✗ " + ((e as Error).message || "Save failed")); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    setBusy(true);
    try { await deleteAd(id); setItems(items.filter(x => x.id !== id)); toast("🗑️ Ad deleted"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Delete failed")); }
    setBusy(false);
  };

  const togglePublish = async (a: Ad) => {
    setBusy(true);
    try {
      const saved = await saveAd({ ...a, published: !a.published });
      setItems(items.map(x => x.id === saved.id ? saved : x));
    } catch (e) { toast("✗ " + ((e as Error).message || "Update failed")); }
    setBusy(false);
  };

  const POS: Record<string, string> = { "landing-hero": "🎯 Hero", "landing-pricing": "💰 Pricing", "landing-footer": "📄 Footer", "sidebar": "📌 Sidebar", "interstitial": "🔀 Interstitial" };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">📢 Advertisements</h3>
            <p className="mt-0.5 text-[12px] text-mut">Sponsored banners and affiliate ads. Data stored in Supabase — persists across devices.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add} disabled={busy}>+ Add ad</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className={`${cardCls} p-8 text-center text-mut`}>No ads yet. Click "Add ad" to create one.</div>
      ) : items.map(a => (
        <div key={a.id} className={`${cardCls} p-4 transition-all ${!a.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold">{a.title}</span>
                <Chip>{POS[a.position] ?? a.position}</Chip>
                {!a.published && <Chip>hidden</Chip>}
              </div>
              <p className="mt-1 max-w-[500px] text-[12px] leading-relaxed text-mut line-clamp-2">{a.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-fnt">
                {a.sponsor && <span>🏢 {a.sponsor}</span>}
                {a.link_url && <span className="text-acctxt">🔗 {a.link_url.slice(0, 40)}…</span>}
                {a.start_date && <span>📅 {a.start_date} → {a.end_date || "ongoing"}</span>}
                <span>👁️ {a.impressions} views</span>
                <span>🖱️ {a.clicks} clicks</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => void togglePublish(a)} disabled={busy}>{a.published ? "👁️" : "🚫"}</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...a }); setIsAdding(false); }} disabled={busy}>✏️</button>
              <button className={btnDanger + btnSm} onClick={() => void remove(a.id)} disabled={busy}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New ad" : "✏️ Edit ad"}>
          <div className="w-full max-w-[520px] p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Title</span>
                <input className="inp" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Sponsor</span>
                <input className="inp" value={editing.sponsor} onChange={e => setEditing({ ...editing, sponsor: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Link URL</span>
                <input className="inp" value={editing.link_url} onChange={e => setEditing({ ...editing, link_url: e.target.value })} placeholder="https://..." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Image URL</span>
                <input className="inp" value={editing.image_url} onChange={e => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Position</span>
                <select className="inp" value={editing.position} onChange={e => setEditing({ ...editing, position: e.target.value as Ad["position"] })}>
                  <option value="landing-hero">🎯 Hero</option>
                  <option value="landing-pricing">💰 Pricing</option>
                  <option value="landing-footer">📄 Footer</option>
                  <option value="sidebar">📌 Sidebar</option>
                  <option value="interstitial">🔀 Interstitial</option>
                  <option value="banner">🖼️ Banner</option>
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Start date</span>
                  <input type="date" className="inp" value={editing.start_date ?? ""} onChange={e => setEditing({ ...editing, start_date: e.target.value || null })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">End date</span>
                  <input type="date" className="inp" value={editing.end_date ?? ""} onChange={e => setEditing({ ...editing, end_date: e.target.value || null })} />
                </label>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Description</span>
              <textarea className="inp h-20 w-full resize-y" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Background color</span>
                <input className="inp" value={editing.bg_color} onChange={e => setEditing({ ...editing, bg_color: e.target.value })} placeholder="#667eea" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Text color</span>
                <input className="inp" value={editing.text_color} onChange={e => setEditing({ ...editing, text_color: e.target.value })} placeholder="#ffffff" />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                <input type="checkbox" checked={editing.auto_rotate} onChange={e => setEditing({ ...editing, auto_rotate: e.target.checked })} />
                Auto-rotate
              </label>
              {editing.auto_rotate && (
                <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                  Interval (sec)
                  <input type="number" min={2} max={30} className="inp w-16 py-1" value={editing.rotate_interval} onChange={e => setEditing({ ...editing, rotate_interval: Math.max(2, Number(e.target.value) || 5) })} />
                </label>
              )}
            </div>
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
/* ResourcesTab                                                        */
/* ------------------------------------------------------------------ */

