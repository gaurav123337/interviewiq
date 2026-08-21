import { type Banner, fetchBanners, saveBanner, deleteBanner } from '../../../services/contentService';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '../../../toast';
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from '../../ui';

export function BannersTab() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchBanners()); } catch { /* cache */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = () => {
    setEditing({ id: "", title: "", subtitle: "", cta_text: "Learn more", cta_url: "", image_url: "", bg_gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", text_color: "#ffffff", position: "hero", published: true, impressions: 0, clicks: 0 });
    setIsAdding(true);
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast("Title is required"); return; }
    setBusy(true);
    try {
      const saved = await saveBanner(editing);
      const next = isAdding ? [...items, saved] : items.map(x => x.id === saved.id ? saved : x);
      setItems(next);
      setEditing(null); setIsAdding(false);
      toast("💾 Banner saved");
    } catch (e) { toast("✗ " + ((e as Error).message || "Save failed")); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    setBusy(true);
    try { await deleteBanner(id); setItems(items.filter(x => x.id !== id)); toast("🗑️ Banner deleted"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Delete failed")); }
    setBusy(false);
  };

  const togglePublish = async (b: Banner) => {
    setBusy(true);
    try {
      const saved = await saveBanner({ ...b, published: !b.published });
      setItems(items.map(x => x.id === saved.id ? saved : x));
    } catch (e) { toast("✗ " + ((e as Error).message || "Update failed")); }
    setBusy(false);
  };

  const handleImageUpload = (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditing({ ...editing, image_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const POS: Record<string, string> = { "hero": "🎯 Hero", "midpage": "📄 Mid-page", "footer": "📄 Footer", "popup": "🔀 Popup" };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">🖼️ Banners</h3>
            <p className="mt-0.5 text-[12px] text-mut">Visual promotional banners with image upload. Supports gradients, images, and CTA buttons.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add} disabled={busy}>+ Add banner</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className={`${cardCls} p-8 text-center text-mut`}>No banners yet.</div>
      ) : items.map(b => (
        <div key={b.id} className={`${cardCls} p-4 transition-all ${!b.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold">{b.title}</span>
                <Chip>{POS[b.position] ?? b.position}</Chip>
                {!b.published && <Chip>hidden</Chip>}
              </div>
              {b.subtitle && <p className="mt-1 text-[12px] text-mut">{b.subtitle}</p>}
              {/* Banner preview: gradient + image thumbnail */}
              <div
                className="mt-2 h-16 w-full max-w-[280px] overflow-hidden rounded-lg border border-line/20 relative"
                style={{ background: b.bg_gradient, color: b.text_color }}
              >
                {b.image_url && (
                  <div className="absolute inset-0 z-0">
                    <img src={b.image_url} alt="" className="h-full w-full object-cover opacity-30" />
                  </div>
                )}
                <div className="relative z-10 flex h-full flex-col items-center justify-center px-3">
                  <span className="text-[11px] font-extrabold leading-tight truncate w-full text-center">{b.title}</span>
                  {b.cta_text && <span className="mt-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[8px] font-bold">{b.cta_text}</span>}
                </div>
              </div>
              <div className="mt-1.5 flex gap-3 text-[11px] text-fnt">
                {b.cta_text && <span>🔘 {b.cta_text}</span>}
                <span>👁️ {b.impressions}</span>
                <span>🖱️ {b.clicks}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => void togglePublish(b)} disabled={busy}>{b.published ? "👁️" : "🚫"}</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...b }); setIsAdding(false); }} disabled={busy}>✏️</button>
              <button className={btnDanger + btnSm} onClick={() => void remove(b.id)} disabled={busy}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New banner" : "✏️ Edit banner"}>
          <div className="w-full max-w-[520px] p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Title</span>
                <input className="inp" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Subtitle</span>
                <input className="inp" value={editing.subtitle} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">CTA text</span>
                <input className="inp" value={editing.cta_text} onChange={e => setEditing({ ...editing, cta_text: e.target.value })} placeholder="Learn more" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">CTA URL</span>
                <input className="inp" value={editing.cta_url} onChange={e => setEditing({ ...editing, cta_url: e.target.value })} placeholder="https://..." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Position</span>
                <select className="inp" value={editing.position} onChange={e => setEditing({ ...editing, position: e.target.value as Banner["position"] })}>
                  <option value="hero">🎯 Hero</option>
                  <option value="midpage">📄 Mid-page</option>
                  <option value="footer">📄 Footer</option>
                  <option value="popup">🔀 Popup</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Text color</span>
                <input className="inp" value={editing.text_color} onChange={e => setEditing({ ...editing, text_color: e.target.value })} placeholder="#ffffff" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Background gradient</span>
              <input className="inp" value={editing.bg_gradient} onChange={e => setEditing({ ...editing, bg_gradient: e.target.value })} placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Image URL (or upload below)</span>
              <input className="inp" value={editing.image_url} onChange={e => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://... or data:image/..." />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Upload image</span>
              <input type="file" accept="image/*" className="inp" onChange={handleImageUpload} />
            </label>
            {editing.image_url && (
              <div className="mt-3 h-24 w-full overflow-hidden rounded-lg border border-line/20">
                <img src={editing.image_url} alt="Preview" className="h-full w-full object-cover" />
              </div>
            )}
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
/* AnalyticsTab — analytics dashboard with charts                       */
/* ------------------------------------------------------------------ */

