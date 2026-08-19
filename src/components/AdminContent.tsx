/* AdminContent — CMS for testimonials, ads, resources, and tip jar.
   All data is stored in Supabase (database) with localStorage cache.
   Accessed via the Admin dashboard → "Content" tab. */

import { useState, useEffect, useCallback } from "react";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from "./ui";
import {
  type Testimonial, type Ad, type Resource, type TipConfig,
  fetchTestimonials, saveTestimonial, deleteTestimonial,
  fetchAds, saveAd, deleteAd,
  fetchResources, saveResource, deleteResource,
  fetchTips, saveTips,
} from "../services/contentService";

/* ------------------------------------------------------------------ */
/* TestimonialsTab                                                     */
/* ------------------------------------------------------------------ */

function TestimonialsTab() {
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
    setEditing({ id: "", name: "", role: "", company: "", avatar: "👤", rating: 5, text: "", published: true, sort_order: items.length });
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
            <div className="grid grid-cols-2 gap-3">
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

function AdsTab() {
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
    setEditing({ id: "", title: "", description: "", sponsor: "", image_url: "", link_url: "", position: "landing-pricing", start_date: null, end_date: null, published: true, impressions: 0, clicks: 0 });
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
            <div className="grid grid-cols-2 gap-3">
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
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
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

function ResourcesTab() {
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
            <div className="grid grid-cols-2 gap-3">
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

function TipsTab() {
  const [config, setConfig] = useState<TipConfig>({ id: "default", amounts: [5, 15, 30], labels: ["☕ Coffee", "🍕 Lunch", "🎉 Celebration"], descriptions: ["Buy me a coffee", "Buy me lunch", "Celebrating a new offer?"], stripe_link: "", buymeacoffee_link: "", enabled: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTips().then(t => { setConfig(t); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const updateAmount = (idx: number, val: number) => {
    const next = { ...config, amounts: [...config.amounts] };
    next.amounts[idx] = Math.max(1, val);
    setConfig(next);
  };
  const updateLabel = (idx: number, val: string) => {
    const next = { ...config, labels: [...config.labels] };
    next.labels[idx] = val;
    setConfig(next);
  };
  const updateDesc = (idx: number, val: string) => {
    const next = { ...config, descriptions: [...config.descriptions] };
    next.descriptions[idx] = val;
    setConfig(next);
  };
  const addTier = () => setConfig({ ...config, amounts: [...config.amounts, 50], labels: [...config.labels, "🎁 Gift"], descriptions: [...config.descriptions, "Buy me a gift"] });
  const removeTier = (idx: number) => {
    if (config.amounts.length <= 1) { toast("Need at least one tier"); return; }
    setConfig({ ...config, amounts: config.amounts.filter((_, i) => i !== idx), labels: config.labels.filter((_, i) => i !== idx), descriptions: config.descriptions.filter((_, i) => i !== idx) });
  };

  const saveConfig = async () => {
    setBusy(true);
    try { await saveTips(config); toast("💾 Tip jar config saved to database"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Save failed")); }
    setBusy(false);
  };

  if (loading) return <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">❤️ Tip Jar Settings</h3>
            <p className="mt-0.5 text-[12px] text-mut">Configure the support section. Data stored in Supabase.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={() => void saveConfig()} disabled={busy}>💾 Save config</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[13px] font-extrabold">💰 Tip tiers</h4>
          <button className={btnOk + btnSm} onClick={addTier}>+ Add tier</button>
        </div>
        <div className="space-y-3">
          {config.amounts.map((amt, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line/10 bg-deep/40 p-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-acc1/10 text-[16px]">{config.labels[i]?.split(" ")[0] ?? "💰"}</span>
              <label className="text-[12px] font-bold text-mut">$</label>
              <input type="number" min={1} className="inp w-20 py-1.5 text-center" value={amt} onChange={e => updateAmount(i, Number(e.target.value) || 5)} />
              <input className="inp flex-1 py-1.5" value={config.labels[i] ?? ""} onChange={e => updateLabel(i, e.target.value)} placeholder="☕ Coffee" />
              <input className="inp flex-1 py-1.5" value={config.descriptions[i] ?? ""} onChange={e => updateDesc(i, e.target.value)} placeholder="Buy me a coffee" />
              <button className={btnDanger + btnSm} onClick={() => removeTier(i)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h4 className="text-[13px] font-extrabold mb-3">🔗 Payment links</h4>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Stripe payment link</span>
            <input className="inp" value={config.stripe_link} onChange={e => setConfig({ ...config, stripe_link: e.target.value })} placeholder="https://buy.stripe.com/..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Buy Me a Coffee link</span>
            <input className="inp" value={config.buymeacoffee_link} onChange={e => setConfig({ ...config, buymeacoffee_link: e.target.value })} placeholder="https://buymeacoffee.com/..." />
          </label>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
            <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
            Show tip jar on landing page
          </label>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h4 className="text-[13px] font-extrabold mb-3">👀 Preview</h4>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {config.amounts.map((amt, i) => (
            <div key={i} className="rounded-xl border border-line/20 bg-wht/10 px-5 py-3 text-center">
              <div className="text-[20px]">{config.labels[i]?.split(" ")[0] ?? "💰"}</div>
              <div className="mt-1 text-[13px] font-extrabold">${amt}</div>
              <div className="text-[11px] text-mut">{config.descriptions[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main export — Content section for the Admin dashboard                */
/* ------------------------------------------------------------------ */

type ContentTab = "testimonials" | "ads" | "resources" | "tips";

const TABS: { id: ContentTab; label: string; icon: string }[] = [
  { id: "testimonials", label: "Testimonials", icon: "⭐" },
  { id: "ads", label: "Ads", icon: "📢" },
  { id: "resources", label: "Resources", icon: "📖" },
  { id: "tips", label: "Tip Jar", icon: "❤️" },
];

export function ContentSection() {
  const [tab, setTab] = useState<ContentTab>("testimonials");

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-xl border border-line/15 bg-deep/60 p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-all ${tab === t.id ? "bg-acc1/20 text-acctxt border border-acc1/40" : "text-mut hover:bg-wht/10 hover:text-ink"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "testimonials" && <TestimonialsTab />}
      {tab === "ads" && <AdsTab />}
      {tab === "resources" && <ResourcesTab />}
      {tab === "tips" && <TipsTab />}
    </div>
  );
}
