/* AdminContent — CMS for testimonials, ads, resources, and tip jar.
   All data is stored in localStorage and can be published to remote config.
   Accessed via the Admin dashboard → "Content" tab. */

import { useState } from "react";
import { storageGet, storageSet, STORAGE_KEYS } from "../services/storage";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from "./ui";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  rating: number;
  text: string;
  highlight?: string;
  published: boolean;
  order: number;
}

interface Ad {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  position: "landing-hero" | "landing-pricing" | "landing-footer" | "sidebar" | "interstitial";
  startDate: string;
  endDate: string;
  published: boolean;
  impressions: number;
  clicks: number;
  sponsor: string;
}

interface Resource {
  id: string;
  title: string;
  author: string;
  type: "book" | "course" | "tool";
  description: string;
  affiliateUrl: string;
  icon: string;
  price: string;
  badge?: string;
  published: boolean;
  order: number;
  clicks: number;
}

interface TipConfig {
  amounts: number[];
  labels: string[];
  descriptions: string[];
  stripeLink: string;
  buymeacoffeeLink: string;
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Default data                                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: "t1", name: "Priya M.", role: "Frontend Engineer", company: "Google", avatar: "👩‍💻", rating: 5, text: "InterviewIQ was my daily practice tool for 3 months. The system design flashcards helped me nail the architecture round. Got my dream offer!", highlight: "Landed Google L4", published: true, order: 0 },
  { id: "t2", name: "James K.", role: "Senior Backend Dev", company: "Amazon", avatar: "👨‍💼", rating: 5, text: "The AI coach explained distributed systems better than any course I've taken. The offline mode meant I could practice on my commute.", highlight: "Amazon SDE2 offer", published: true, order: 1 },
  { id: "t3", name: "Ananya R.", role: "Full Stack Developer", company: "Microsoft", avatar: "👩‍🔬", rating: 5, text: "What sets this apart is the career roadmap. It identified my weak spots and built a plan. My interviewer even commented on how well-prepared I was.", highlight: "Microsoft L62", published: true, order: 2 },
  { id: "t4", name: "Marcus L.", role: "ML Engineer", company: "Meta", avatar: "🧑‍💻", rating: 4, text: "The system design hub with 15 case studies is gold. I used it daily for a month. The spaced repetition flashcards made numbers stick.", highlight: "Meta E5 offer", published: true, order: 3 },
  { id: "t5", name: "Sarah T.", role: "DevOps Engineer", company: "Netflix", avatar: "👩‍🏫", rating: 5, text: "I was skeptical about AI interview prep, but the grounded citations won me over. Every answer has a source. No hallucinated nonsense.", highlight: "Netflix Senior", published: true, order: 4 },
  { id: "t6", name: "Rohit P.", role: "Backend Developer", company: "Stripe", avatar: "🧑‍🎓", rating: 5, text: "The mock interview mode with timed questions was a game-changer. I practiced 50+ sessions. The analytics showed exactly where I improved.", highlight: "Stripe L3 → L4", published: true, order: 5 },
];

const DEFAULT_ADS: Ad[] = [
  { id: "ad1", title: "Educative — Grokking System Design", description: "Interactive course with 40+ system design problems and solutions.", imageUrl: "", linkUrl: "https://www.educative.io/courses/grokking-the-system-design-interview", position: "landing-pricing", startDate: "2026-01-01", endDate: "2026-12-31", published: true, impressions: 0, clicks: 0, sponsor: "Educative" },
];

const DEFAULT_RESOURCES: Resource[] = [
  { id: "r1", title: "System Design Interview", author: "Alex Xu", type: "book", description: "The go-to book for system design prep. Clear diagrams, real-world examples, and step-by-step walkthroughs.", affiliateUrl: "https://www.amazon.com/dp/1736049127", icon: "📖", price: "$25", badge: "Best Seller", published: true, order: 0, clicks: 0 },
  { id: "r2", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", type: "book", description: "Deep dive into distributed systems, databases, and streaming. Essential for senior+ roles.", affiliateUrl: "https://www.amazon.com/dp/1449373321", icon: "📖", price: "$40", badge: "Must Read", published: true, order: 1, clicks: 0 },
  { id: "r3", title: "Grokking the System Design Interview", author: "Educative", type: "course", description: "Interactive course with 40+ system design problems and solutions.", affiliateUrl: "https://www.educative.io/courses/grokking-the-system-design-interview", icon: "🎓", price: "$79", published: true, order: 2, clicks: 0 },
  { id: "r4", title: "LeetCode Premium", author: "LeetCode", type: "tool", description: "Premium coding practice with company-tagged questions and hints.", affiliateUrl: "https://leetcode.com/subscription/", icon: "💻", price: "$35/mo", badge: "Popular", published: true, order: 3, clicks: 0 },
  { id: "r5", title: "ByteByteGo Newsletter", author: "Alex Xu", type: "course", description: "Weekly system design concepts with visual explanations. Free and paid tiers.", affiliateUrl: "https://blog.bytebytego.com/", icon: "📧", price: "Free", badge: "Free", published: true, order: 4, clicks: 0 },
  { id: "r6", title: "Roadmap.sh", author: "Community", type: "tool", description: "Free learning roadmaps for every tech role. Great for career planning.", affiliateUrl: "https://roadmap.sh/", icon: "🗺️", price: "Free", badge: "Free", published: true, order: 5, clicks: 0 },
];

const DEFAULT_TIPS: TipConfig = {
  amounts: [5, 15, 30],
  labels: ["☕ Coffee", "🍕 Lunch", "🎉 Celebration"],
  descriptions: ["Buy me a coffee", "Buy me lunch", "Celebrating a new offer?"],
  stripeLink: "",
  buymeacoffeeLink: "",
  enabled: true,
};

/* ------------------------------------------------------------------ */
/* Load / Save helpers                                                 */
/* ------------------------------------------------------------------ */

function load<T>(key: string, fallback: T): T {
  return storageGet<T>(key, fallback);
}

function save(key: string, value: unknown): void {
  storageSet(key, value);
}

/* ------------------------------------------------------------------ */
/* TestimonialsTab                                                     */
/* ------------------------------------------------------------------ */

function TestimonialsTab() {
  const [items, setItems] = useState<Testimonial[]>(() => load(STORAGE_KEYS.adminTestimonials, DEFAULT_TESTIMONIALS));
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const persist = (next: Testimonial[]) => { setItems(next); save(STORAGE_KEYS.adminTestimonials, next); };

  const add = () => {
    const t: Testimonial = { id: "t" + Date.now(), name: "", role: "", company: "", avatar: "👤", rating: 5, text: "", published: true, order: items.length };
    setEditing(t);
    setIsAdding(true);
  };

  const saveItem = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.text.trim()) { toast("Name and testimonial text are required"); return; }
    const next = isAdding ? [...items, editing] : items.map(x => x.id === editing.id ? editing : x);
    persist(next);
    setEditing(null);
    setIsAdding(false);
    toast("💾 Testimonial saved");
  };

  const remove = (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    persist(items.filter(x => x.id !== id));
    toast("🗑️ Testimonial deleted");
  };

  const togglePublish = (id: string) => {
    persist(items.map(x => x.id === id ? { ...x, published: !x.published } : x));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    next.forEach((x, i) => x.order = i);
    persist(next);
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">⭐ Testimonials</h3>
            <p className="mt-0.5 text-[12px] text-mut">Manage customer reviews shown on the landing page. Toggle visibility, reorder, or add new ones.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add}>+ Add testimonial</button>
        </div>
      </div>

      {items.map((t, i) => (
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
              <button className={btnGhost + btnSm} onClick={() => move(t.id, -1)} disabled={i === 0} title="Move up">↑</button>
              <button className={btnGhost + btnSm} onClick={() => move(t.id, 1)} disabled={i === items.length - 1} title="Move down">↓</button>
              <button className={btnGhost + btnSm} onClick={() => togglePublish(t.id)} title={t.published ? "Hide" : "Show"}>{t.published ? "👁️" : "🚫"}</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...t }); setIsAdding(false); }} title="Edit">✏️</button>
              <button className={btnDanger + btnSm} onClick={() => remove(t.id)} title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New testimonial" : "✏️ Edit testimonial"}>
          <div className="w-full max-w-[520px] p-6">
            <h3 className="text-[16px] font-extrabold">{isAdding ? "➕ New testimonial" : "✏️ Edit testimonial"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
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
                <button className={btnPrimary + btnSm} onClick={saveItem}>💾 Save</button>
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
  const [items, setItems] = useState<Ad[]>(() => load(STORAGE_KEYS.adminAds, DEFAULT_ADS));
  const [editing, setEditing] = useState<Ad | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const persist = (next: Ad[]) => { setItems(next); save(STORAGE_KEYS.adminAds, next); };

  const add = () => {
    const a: Ad = { id: "ad" + Date.now(), title: "", description: "", imageUrl: "", linkUrl: "", position: "landing-pricing", startDate: "", endDate: "", published: true, impressions: 0, clicks: 0, sponsor: "" };
    setEditing(a);
    setIsAdding(true);
  };

  const saveItem = () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast("Title is required"); return; }
    const next = isAdding ? [...items, editing] : items.map(x => x.id === editing.id ? editing : x);
    persist(next);
    setEditing(null);
    setIsAdding(false);
    toast("💾 Ad saved");
  };

  const remove = (id: string) => {
    if (!confirm("Delete this ad?")) return;
    persist(items.filter(x => x.id !== id));
    toast("🗑️ Ad deleted");
  };

  const togglePublish = (id: string) => {
    persist(items.map(x => x.id === id ? { ...x, published: !x.published } : x));
  };

  const POSITION_LABELS: Record<string, string> = {
    "landing-hero": "🎯 Hero section",
    "landing-pricing": "💰 Pricing section",
    "landing-footer": "📄 Footer section",
    "sidebar": "📌 Sidebar",
    "interstitial": "🔀 Interstitial (between views)"
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">📢 Advertisements</h3>
            <p className="mt-0.5 text-[12px] text-mut">Manage sponsored banners and affiliate ads. Position them on the landing page or between views.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add}>+ Add ad</button>
        </div>
      </div>

      {items.map(a => (
        <div key={a.id} className={`${cardCls} p-4 transition-all ${!a.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold">{a.title || "(no title)"}</span>
                <Chip>{POSITION_LABELS[a.position] ?? a.position}</Chip>
                {!a.published && <Chip>hidden</Chip>}
              </div>
              <p className="mt-1 max-w-[500px] text-[12px] leading-relaxed text-mut line-clamp-2">{a.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-fnt">
                {a.sponsor && <span>🏢 {a.sponsor}</span>}
                {a.linkUrl && <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="text-acctxt hover:underline">{a.linkUrl.slice(0, 40)}…</a>}
                {a.startDate && <span>📅 {a.startDate} → {a.endDate || "ongoing"}</span>}
                <span>👁️ {a.impressions} views</span>
                <span>🖱️ {a.clicks} clicks</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => togglePublish(a.id)} title={a.published ? "Hide" : "Show"}>{a.published ? "👁️" : "🚫"}</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...a }); setIsAdding(false); }} title="Edit">✏️</button>
              <button className={btnDanger + btnSm} onClick={() => remove(a.id)} title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New ad" : "✏️ Edit ad"}>
          <div className="w-full max-w-[520px] p-6">
            <h3 className="text-[16px] font-extrabold">{isAdding ? "➕ New ad" : "✏️ Edit ad"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Title</span>
                <input className="inp" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Educative — System Design" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Sponsor name</span>
                <input className="inp" value={editing.sponsor} onChange={e => setEditing({ ...editing, sponsor: e.target.value })} placeholder="Educative" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Link URL</span>
                <input className="inp" value={editing.linkUrl} onChange={e => setEditing({ ...editing, linkUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Image URL (optional)</span>
                <input className="inp" value={editing.imageUrl} onChange={e => setEditing({ ...editing, imageUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Position</span>
                <select className="inp" value={editing.position} onChange={e => setEditing({ ...editing, position: e.target.value as Ad["position"] })}>
                  <option value="landing-hero">🎯 Hero section</option>
                  <option value="landing-pricing">💰 Pricing section</option>
                  <option value="landing-footer">📄 Footer section</option>
                  <option value="sidebar">📌 Sidebar</option>
                  <option value="interstitial">🔀 Interstitial</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Start date</span>
                  <input type="date" className="inp" value={editing.startDate} onChange={e => setEditing({ ...editing, startDate: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">End date</span>
                  <input type="date" className="inp" value={editing.endDate} onChange={e => setEditing({ ...editing, endDate: e.target.value })} />
                </label>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Description</span>
              <textarea className="inp h-20 w-full resize-y" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Ad description..." />
            </label>
            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                <input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
                Published (visible on site)
              </label>
              <div className="flex gap-2">
                <button className={btnGhost + btnSm} onClick={() => { setEditing(null); setIsAdding(false); }}>Cancel</button>
                <button className={btnPrimary + btnSm} onClick={saveItem}>💾 Save</button>
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
  const [items, setItems] = useState<Resource[]>(() => load(STORAGE_KEYS.adminResources, DEFAULT_RESOURCES));
  const [editing, setEditing] = useState<Resource | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const persist = (next: Resource[]) => { setItems(next); save(STORAGE_KEYS.adminResources, next); };

  const add = () => {
    const r: Resource = { id: "r" + Date.now(), title: "", author: "", type: "book", description: "", affiliateUrl: "", icon: "📖", price: "", published: true, order: items.length, clicks: 0 };
    setEditing(r);
    setIsAdding(true);
  };

  const saveItem = () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast("Title is required"); return; }
    const next = isAdding ? [...items, editing] : items.map(x => x.id === editing.id ? editing : x);
    persist(next);
    setEditing(null);
    setIsAdding(false);
    toast("💾 Resource saved");
  };

  const remove = (id: string) => {
    if (!confirm("Delete this resource?")) return;
    persist(items.filter(x => x.id !== id));
    toast("🗑️ Resource deleted");
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    next.forEach((x, i) => x.order = i);
    persist(next);
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">📖 Recommended Resources</h3>
            <p className="mt-0.5 text-[12px] text-mut">Manage affiliate links shown on the landing page. Track clicks and earnings.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add}>+ Add resource</button>
        </div>
      </div>

      {items.map((r, i) => (
        <div key={r.id} className={`${cardCls} p-4 transition-all ${!r.published ? "opacity-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-acc1/10 text-[18px]">{r.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold">{r.title || "(no title)"}</span>
                  {r.badge && <Chip tone="lvl">{r.badge}</Chip>}
                  {!r.published && <Chip>hidden</Chip>}
                </div>
                <div className="text-[11px] text-mut">{r.author} · {r.type} · {r.price}</div>
                <p className="mt-1 max-w-[500px] text-[12px] leading-relaxed text-mut line-clamp-2">{r.description}</p>
                <div className="mt-1 flex gap-3 text-[11px] text-fnt">
                  <a href={r.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-acctxt hover:underline">🔗 {r.affiliateUrl.slice(0, 40)}…</a>
                  <span>🖱️ {r.clicks} clicks</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => move(r.id, -1)} disabled={i === 0}>↑</button>
              <button className={btnGhost + btnSm} onClick={() => move(r.id, 1)} disabled={i === items.length - 1}>↓</button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...r }); setIsAdding(false); }}>✏️</button>
              <button className={btnDanger + btnSm} onClick={() => remove(r.id)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <Modal onClose={() => { setEditing(null); setIsAdding(false); }} title={isAdding ? "➕ New resource" : "✏️ Edit resource"}>
          <div className="w-full max-w-[520px] p-6">
            <h3 className="text-[16px] font-extrabold">{isAdding ? "➕ New resource" : "✏️ Edit resource"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Title</span>
                <input className="inp" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="System Design Interview" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Author</span>
                <input className="inp" value={editing.author} onChange={e => setEditing({ ...editing, author: e.target.value })} placeholder="Alex Xu" />
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
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Badge (optional)</span>
                <input className="inp" value={editing.badge ?? ""} onChange={e => setEditing({ ...editing, badge: e.target.value || undefined })} placeholder="Best Seller" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Icon (emoji)</span>
                <input className="inp" value={editing.icon} onChange={e => setEditing({ ...editing, icon: e.target.value })} placeholder="📖" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Affiliate URL</span>
              <input className="inp" value={editing.affiliateUrl} onChange={e => setEditing({ ...editing, affiliateUrl: e.target.value })} placeholder="https://www.amazon.com/dp/..." />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Description</span>
              <textarea className="inp h-20 w-full resize-y" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Why should users check this out?" />
            </label>
            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                <input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
                Published (visible on landing page)
              </label>
              <div className="flex gap-2">
                <button className={btnGhost + btnSm} onClick={() => { setEditing(null); setIsAdding(false); }}>Cancel</button>
                <button className={btnPrimary + btnSm} onClick={saveItem}>💾 Save</button>
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
  const [config, setConfig] = useState<TipConfig>(() => load(STORAGE_KEYS.adminTips, DEFAULT_TIPS));

  const persist = (next: TipConfig) => { setConfig(next); save(STORAGE_KEYS.adminTips, next); };

  const updateAmount = (idx: number, val: number) => {
    const next = { ...config, amounts: [...config.amounts] };
    next.amounts[idx] = Math.max(1, val);
    persist(next);
  };

  const updateLabel = (idx: number, val: string) => {
    const next = { ...config, labels: [...config.labels] };
    next.labels[idx] = val;
    persist(next);
  };

  const updateDesc = (idx: number, val: string) => {
    const next = { ...config, descriptions: [...config.descriptions] };
    next.descriptions[idx] = val;
    persist(next);
  };

  const addTier = () => {
    const next = { ...config, amounts: [...config.amounts, 50], labels: [...config.labels, "🎁 Gift"], descriptions: [...config.descriptions, "Buy me a gift"] };
    persist(next);
  };

  const removeTier = (idx: number) => {
    if (config.amounts.length <= 1) { toast("Need at least one tier"); return; }
    const next = { ...config, amounts: config.amounts.filter((_, i) => i !== idx), labels: config.labels.filter((_, i) => i !== idx), descriptions: config.descriptions.filter((_, i) => i !== idx) };
    persist(next);
  };

  const saveConfig = () => {
    save(STORAGE_KEYS.adminTips, config);
    toast("💾 Tip jar config saved");
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">❤️ Tip Jar Settings</h3>
            <p className="mt-0.5 text-[12px] text-mut">Configure the support/tip jar section on the landing page.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={saveConfig}>💾 Save config</button>
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
              <button className={btnDanger + btnSm} onClick={() => removeTier(i)} title="Remove tier">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h4 className="text-[13px] font-extrabold mb-3">🔗 Payment links</h4>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Stripe payment link</span>
            <input className="inp" value={config.stripeLink} onChange={e => setConfig({ ...config, stripeLink: e.target.value })} placeholder="https://buy.stripe.com/..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Buy Me a Coffee link</span>
            <input className="inp" value={config.buymeacoffeeLink} onChange={e => setConfig({ ...config, buymeacoffeeLink: e.target.value })} placeholder="https://buymeacoffee.com/..." />
          </label>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
            <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
            Show tip jar on landing page
          </label>
        </div>
      </div>

      {/* Preview */}
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
