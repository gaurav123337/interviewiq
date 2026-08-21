import { type Testimonial, fetchTestimonials, saveTestimonial, deleteTestimonial } from '../../../services/contentService';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '../../../toast';
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from '../../ui';

export function TestimonialsTab() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchTestimonials()); } catch { /* cache fallback */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = () => {
    setEditing({ id: "", name: "", role: "", company: "", avatar: "👤", rating: 5, text: "", variant: "all", published: true, sort_order: items.length });
    setIsAdding(true);
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.text.trim()) { toast("Name and testimonial text are required"); return; }
    setBusy(true);
    try {
      const saved = await saveTestimonial(editing);
      const next = isAdding ? [...items, saved] : items.map(x => x.id === saved.id ? saved : x);
      setItems(next);
      setEditing(null); setIsAdding(false);
      toast("💾 Testimonial saved to database");
    } catch (e) { toast("✗ " + ((e as Error).message || "Save failed")); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    setBusy(true);
    try {
      await deleteTestimonial(id);
      setItems(items.filter(x => x.id !== id));
      toast("🗑️ Testimonial deleted");
    } catch (e) { toast("✗ " + ((e as Error).message || "Delete failed")); }
    setBusy(false);
  };

  const togglePublish = async (t: Testimonial) => {
    setBusy(true);
    try {
      const saved = await saveTestimonial({ ...t, published: !t.published });
      setItems(items.map(x => x.id === saved.id ? saved : x));
    } catch (e) { toast("✗ " + ((e as Error).message || "Update failed")); }
    setBusy(false);
  };

  const move = async (t: Testimonial, dir: -1 | 1) => {
    const idx = items.findIndex(x => x.id === t.id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    const a = { ...items[idx], sort_order: items[swap].sort_order };
    const b = { ...items[swap], sort_order: items[idx].sort_order };
    setBusy(true);
    try {
      await Promise.all([saveTestimonial(a), saveTestimonial(b)]);
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
            <h3 className="text-[15px] font-extrabold">⭐ Testimonials</h3>
            <p className="mt-0.5 text-[12px] text-mut">Manage customer reviews shown on the landing page. Data stored in Supabase — persists across devices.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add} disabled={busy}>+ Add testimonial</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading from database…</div>
      ) : items.length === 0 ? (
        <div className={`${cardCls} p-8 text-center text-mut`}>No testimonials yet. Click "Add testimonial" to create one.</div>
      ) : items.map((t, i) => (
        <div key={t.id} className={`${cardCls} p-4 transition-all ${!t.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-acc1/15 text-[18px]">{t.avatar}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold">{t.name || "(no name)"}</span>
                  {t.highlight && <Chip tone="ok">{t.highlight}</Chip>}
                  {t.variant && t.variant !== 'all' && <Chip tone="co">A/B: {t.variant}</Chip>}
                  {!t.published && <Chip>hidden</Chip>}
                </div>
                <div className="text-[11px] text-mut">{t.role} · {t.company} · {t.rating}★</div>
                <p className="mt-1 max-w-[500px] text-[12px] leading-relaxed text-mut line-clamp-2">"{t.text}"</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => void move(t, -1)} disabled={i === 0 || busy} title="Move up">↑</button>
              <button className={btnGhost + btnSm} onClick={() => void move(t, 1)} disabled={i === items.length - 1 || busy} title="Move down">↓</button>
              <button className={btnGhost + btnSm} onClick={() => void togglePublish(t)} disabled={busy} title={t.published ? "Hide" : "Show"}>{t.published ? "👁️" : "🚫"}</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...t }); setIsAdding(false); }} disabled={busy} title="Edit">✏️</button>
              <button className={btnDanger + btnSm} onClick={() => void remove(t.id)} disabled={busy} title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New testimonial" : "✏️ Edit testimonial"}>
          <div className="w-full max-w-[520px] p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Name</span>
                <input className="inp" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Priya M." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Role</span>
                <input className="inp" value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} placeholder="Frontend Engineer" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Company</span>
                <input className="inp" value={editing.company} onChange={e => setEditing({ ...editing, company: e.target.value })} placeholder="Google" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Avatar (emoji)</span>
                <input className="inp" value={editing.avatar} onChange={e => setEditing({ ...editing, avatar: e.target.value })} placeholder="👩‍💻" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Rating (1-5)</span>
                <input type="number" min={1} max={5} className="inp" value={editing.rating} onChange={e => setEditing({ ...editing, rating: Math.max(1, Math.min(5, Number(e.target.value) || 5)) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Highlight (optional)</span>
                <input className="inp" value={editing.highlight ?? ""} onChange={e => setEditing({ ...editing, highlight: e.target.value || undefined })} placeholder="Landed Google L4" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">A/B Test Variant</span>
                <select className="inp" value={editing.variant} onChange={e => setEditing({ ...editing, variant: e.target.value as Testimonial['variant'] })}>
                  <option value="all">All users</option>
                  <option value="A">Variant A only</option>
                  <option value="B">Variant B only</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Testimonial text</span>
              <textarea className="inp h-24 w-full resize-y" value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} placeholder="What did they say about InterviewIQ?" />
            </label>
            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                <input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
                Published (visible on landing page)
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
/* AdsTab                                                              */
/* ------------------------------------------------------------------ */

