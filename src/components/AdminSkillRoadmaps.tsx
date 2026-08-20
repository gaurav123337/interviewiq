/* AdminSkillRoadmaps — CMS for skill roadmaps (admin-only).
   CRUD for roadmaps + resources with quality scoring and publish workflow.
   Data stored in Supabase with localStorage cache. */

import { useState, useEffect, useCallback } from "react";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from "./ui";
import {
  getAllRoadmaps,
  type SkillRoadmap,
  type SkillRoadmapResource,
} from "../services/skillRoadmapService";
import { getSupabaseClient } from "../services/cloud";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const BANDS: SkillRoadmap["band"][] = ["junior", "mid", "senior", "staff", "principal", "cto"];
const BAND_LABELS: Record<string, string> = {
  junior: "Foundation", mid: "Core", senior: "Senior", staff: "Staff", principal: "Principal", cto: "CTO",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "📝 Draft", reviewed: "👁️ Reviewed", published: "✅ Published", archived: "📦 Archived",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "default", reviewed: "co", published: "ok", archived: "warn",
};
const RESOURCE_KINDS: SkillRoadmapResource["kind"][] = ["docs", "course", "video", "book", "interactive", "article"];

function dots(d: number): string {
  return "●".repeat(d) + "○".repeat(3 - d);
}

function newRoadmap(sortOrder: number): SkillRoadmap {
  return {
    id: "", skillId: "", name: "", icon: "📚", band: "mid", difficulty: 2,
    description: "", why: "", slug: "", tags: [], aliases: [],
    prerequisites: [], learningPath: [], resources: [],
    estimatedHours: 20, qualityStatus: "draft", tier: "free",
    published: false, sortOrder, views: 0, starts: 0, completions: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function AdminSkillRoadmaps() {
  const [items, setItems] = useState<SkillRoadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SkillRoadmap | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const roadmaps = await getAllRoadmaps();
      setItems(roadmaps);
    } catch { /* cache fallback */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter === "all" ? items : items.filter(r => r.qualityStatus === filter);

  const add = () => {
    setEditing(newRoadmap(items.length));
    setIsAdding(true);
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.slug.trim()) {
      toast("Name and slug are required");
      return;
    }
    setBusy(true);
    try {
      const client = await getSupabaseClient();
      if (!client) { toast("✗ Cloud not configured"); setBusy(false); return; }

      const row = {
        skill_id: editing.skillId || editing.slug,
        name: editing.name,
        icon: editing.icon,
        band: editing.band,
        difficulty: editing.difficulty,
        description: editing.description,
        why: editing.why,
        slug: editing.slug,
        tags: editing.tags,
        aliases: editing.aliases,
        prerequisites: editing.prerequisites,
        learning_path: editing.learningPath,
        resources: editing.resources,
        estimated_hours: editing.estimatedHours,
        quality_status: editing.qualityStatus,
        tier: editing.tier,
        published: editing.published,
        sort_order: editing.sortOrder,
      };

      if (editing.id) {
        const { error } = await client.from("skill_roadmaps").update(row).eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await client.from("skill_roadmaps").insert(row).select().single();
        if (error) throw new Error(error.message);
        editing.id = data.id;
      }

      toast("💾 Roadmap saved to database");
      setEditing(null);
      setIsAdding(false);
      void load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Save failed"));
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this roadmap?")) return;
    setBusy(true);
    try {
      const client = await getSupabaseClient();
      if (!client) return;
      const { error } = await client.from("skill_roadmaps").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setItems(items.filter(x => x.id !== id));
      toast("🗑️ Roadmap deleted");
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Delete failed"));
    }
    setBusy(false);
  };

  const togglePublish = async (r: SkillRoadmap) => {
    setBusy(true);
    try {
      const client = await getSupabaseClient();
      if (!client) return;
      const newStatus = r.published ? false : true;
      const { error } = await client.from("skill_roadmaps").update({ published: newStatus }).eq("id", r.id);
      if (error) throw new Error(error.message);
      setItems(items.map(x => x.id === r.id ? { ...x, published: newStatus } : x));
      toast(newStatus ? "✅ Published" : "⏸️ Unpublished");
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Update failed"));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-extrabold">🛤️ Skill Roadmaps</h3>
            <p className="mt-0.5 text-[12px] text-mut">
              Manage learning roadmaps shown in the Skill Explorer. Data stored in Supabase.
            </p>
          </div>
          <button className={btnPrimary + btnSm} onClick={add} disabled={busy}>+ Add roadmap</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["all", "draft", "reviewed", "published", "archived"].map(f => (
            <button
              key={f}
              className={`${btnGhost + btnSm} ${filter === f ? "ring-2 ring-acc1/50" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : STATUS_LABELS[f]} ({f === "all" ? items.length : items.filter(r => r.qualityStatus === f).length})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} p-8 text-center text-mut`}>No roadmaps yet. Click "Add roadmap" to create one.</div>
      ) : filtered.map(r => (
        <div key={r.id} className={`${cardCls} p-4 transition-all ${!r.published ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[18px]">{r.icon}</span>
                <span className="text-[14px] font-extrabold">{r.name || "(no name)"}</span>
                <Chip>{BAND_LABELS[r.band] ?? r.band}</Chip>
                <span className="text-[12px] text-fnt">{dots(r.difficulty)}</span>
                <Chip tone={STATUS_COLORS[r.qualityStatus] as "default" | "ok" | "co" | "warn"}>
                  {STATUS_LABELS[r.qualityStatus]}
                </Chip>
                <Chip tone={r.tier === "pro" ? "warn" : "ok"}>{r.tier}</Chip>
                {r.published && <Chip tone="ok">live</Chip>}
              </div>
              <p className="mt-1 max-w-[500px] text-[12px] leading-relaxed text-mut line-clamp-2">{r.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-fnt">
                <span>Slug: {r.slug}</span>
                <span>~{r.estimatedHours}h</span>
                <span>{r.resources.length} resources</span>
                <span>{r.prerequisites.length} prereqs</span>
                <span>👁️ {r.views}</span>
                <span>▶️ {r.starts}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btnGhost + btnSm} onClick={() => void togglePublish(r)} disabled={busy} title={r.published ? "Unpublish" : "Publish"}>
                {r.published ? "⏸️" : "✅"}
              </button>
              <button className={btnGhost + btnSm} onClick={() => { setEditing({ ...r }); setIsAdding(false); }} disabled={busy} title="Edit">✏️</button>
              <button className={btnDanger + btnSm} onClick={() => void remove(r.id)} disabled={busy} title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <RoadmapEditor
          roadmap={editing}
          isAdding={isAdding}
          busy={busy}
          onSave={() => void saveItem()}
          onCancel={() => { setEditing(null); setIsAdding(false); }}
          onChange={setEditing}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Roadmap Editor Modal                                                */
/* ------------------------------------------------------------------ */

function RoadmapEditor({ roadmap, isAdding, busy, onSave, onCancel, onChange }: {
  roadmap: SkillRoadmap;
  isAdding: boolean;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onChange: (r: SkillRoadmap) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [prereqInput, setPrereqInput] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [resInput, setResInput] = useState({ title: "", url: "", kind: "docs" as SkillRoadmapResource["kind"], free: true, publishedYear: 2025, qualityScore: 50 });

  const addTag = () => {
    if (!tagInput.trim()) return;
    onChange({ ...roadmap, tags: [...roadmap.tags, tagInput.trim()] });
    setTagInput("");
  };
  const addAlias = () => {
    if (!aliasInput.trim()) return;
    onChange({ ...roadmap, aliases: [...roadmap.aliases, aliasInput.trim()] });
    setAliasInput("");
  };
  const addPrereq = () => {
    if (!prereqInput.trim()) return;
    onChange({ ...roadmap, prerequisites: [...roadmap.prerequisites, prereqInput.trim()] });
    setPrereqInput("");
  };
  const addPathStep = () => {
    if (!pathInput.trim()) return;
    onChange({ ...roadmap, learningPath: [...roadmap.learningPath, pathInput.trim()] });
    setPathInput("");
  };
  const addResource = () => {
    if (!resInput.title.trim() || !resInput.url.trim()) return;
    onChange({ ...roadmap, resources: [...roadmap.resources, { ...resInput }] });
    setResInput({ title: "", url: "", kind: "docs", free: true, publishedYear: 2025, qualityScore: 50 });
  };
  const removeResource = (idx: number) => {
    onChange({ ...roadmap, resources: roadmap.resources.filter((_, i) => i !== idx) });
  };

  return (
    <Modal onClose={onCancel} title={isAdding ? "➕ New roadmap" : "✏️ Edit roadmap"}>
      <div className="w-full max-w-[600px] max-h-[80vh] overflow-y-auto p-6 space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Name *</span>
            <input className="inp" value={roadmap.name} onChange={e => onChange({ ...roadmap, name: e.target.value })} placeholder="Java" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Slug *</span>
            <input className="inp" value={roadmap.slug} onChange={e => onChange({ ...roadmap, slug: e.target.value })} placeholder="java" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Icon</span>
            <input className="inp" value={roadmap.icon} onChange={e => onChange({ ...roadmap, icon: e.target.value })} placeholder="☕" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Band</span>
            <select className="inp" value={roadmap.band} onChange={e => onChange({ ...roadmap, band: e.target.value as SkillRoadmap["band"] })}>
              {BANDS.map(b => <option key={b} value={b}>{BAND_LABELS[b]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Difficulty (1-3)</span>
            <input type="number" min={1} max={3} className="inp" value={roadmap.difficulty} onChange={e => onChange({ ...roadmap, difficulty: Math.max(1, Math.min(3, Number(e.target.value) || 2)) as 1 | 2 | 3 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Est. Hours</span>
            <input type="number" min={1} className="inp" value={roadmap.estimatedHours} onChange={e => onChange({ ...roadmap, estimatedHours: Math.max(1, Number(e.target.value) || 20) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Tier</span>
            <select className="inp" value={roadmap.tier} onChange={e => onChange({ ...roadmap, tier: e.target.value as "free" | "pro" })}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Quality Status</span>
            <select className="inp" value={roadmap.qualityStatus} onChange={e => onChange({ ...roadmap, qualityStatus: e.target.value as SkillRoadmap["qualityStatus"] })}>
              <option value="draft">📝 Draft</option>
              <option value="reviewed">👁️ Reviewed</option>
              <option value="published">✅ Published</option>
              <option value="archived">📦 Archived</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Description</span>
          <textarea className="inp h-16 w-full resize-y" value={roadmap.description} onChange={e => onChange({ ...roadmap, description: e.target.value })} placeholder="Short description shown in cards" />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Why learn this?</span>
          <textarea className="inp h-16 w-full resize-y" value={roadmap.why} onChange={e => onChange({ ...roadmap, why: e.target.value })} placeholder="Detailed motivation for learning this skill" />
        </label>

        {/* Tags */}
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Tags</span>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {roadmap.tags.map((t, i) => (
              <Chip key={i} tone="default">{t} <button className="ml-1 text-bad" onClick={() => onChange({ ...roadmap, tags: roadmap.tags.filter((_, j) => j !== i) })}>×</button></Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="inp flex-1" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="backend, enterprise…" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
            <button className={btnOk + btnSm} onClick={addTag}>Add</button>
          </div>
        </div>

        {/* Aliases */}
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Search Aliases</span>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {roadmap.aliases.map((a, i) => (
              <Chip key={i}>{a} <button className="ml-1 text-bad" onClick={() => onChange({ ...roadmap, aliases: roadmap.aliases.filter((_, j) => j !== i) })}>×</button></Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="inp flex-1" value={aliasInput} onChange={e => setAliasInput(e.target.value)} placeholder="jdk, jvm…" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAlias())} />
            <button className={btnOk + btnSm} onClick={addAlias}>Add</button>
          </div>
        </div>

        {/* Prerequisites */}
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Prerequisites (skill IDs)</span>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {roadmap.prerequisites.map((p, i) => (
              <Chip key={i} tone="warn">{p} <button className="ml-1 text-bad" onClick={() => onChange({ ...roadmap, prerequisites: roadmap.prerequisites.filter((_, j) => j !== i) })}>×</button></Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="inp flex-1" value={prereqInput} onChange={e => setPrereqInput(e.target.value)} placeholder="data-structures, sql…" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPrereq())} />
            <button className={btnOk + btnSm} onClick={addPrereq}>Add</button>
          </div>
        </div>

        {/* Learning Path */}
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Learning Path (ordered steps)</span>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {roadmap.learningPath.map((s, i) => (
              <Chip key={i} tone="co">{i + 1}. {s} <button className="ml-1 text-bad" onClick={() => onChange({ ...roadmap, learningPath: roadmap.learningPath.filter((_, j) => j !== i) })}>×</button></Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="inp flex-1" value={pathInput} onChange={e => setPathInput(e.target.value)} placeholder="java-basics, collections…" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPathStep())} />
            <button className={btnOk + btnSm} onClick={addPathStep}>Add</button>
          </div>
        </div>

        {/* Resources */}
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Resources</span>
          {roadmap.resources.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {roadmap.resources.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-line/10 bg-wht/5 px-3 py-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate font-semibold text-acctxt">{r.title}</span>
                  <span className="text-fnt">{r.kind}</span>
                  {r.free ? <Chip tone="ok">free</Chip> : <Chip tone="warn">paid</Chip>}
                  <span title={`quality ${r.qualityScore}/100`} className={`font-bold ${r.qualityScore >= 85 ? "text-ok" : r.qualityScore >= 55 ? "text-fnt" : "text-warn"}`}>{r.qualityScore}</span>
                  <button className="text-bad" onClick={() => removeResource(i)}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className="inp" value={resInput.title} onChange={e => setResInput({ ...resInput, title: e.target.value })} placeholder="Resource title" />
            <input className="inp" value={resInput.url} onChange={e => setResInput({ ...resInput, url: e.target.value })} placeholder="https://…" />
            <select className="inp" value={resInput.kind} onChange={e => setResInput({ ...resInput, kind: e.target.value as SkillRoadmapResource["kind"] })}>
              {RESOURCE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-[12px] text-mut">
                <input type="checkbox" checked={resInput.free} onChange={e => setResInput({ ...resInput, free: e.target.checked })} /> free
              </label>
              <input type="number" className="inp w-16" value={resInput.qualityScore} onChange={e => setResInput({ ...resInput, qualityScore: Math.max(0, Math.min(100, Number(e.target.value) || 50)) })} placeholder="score" title="Quality score 0-100" />
            </div>
          </div>
          <button className={btnOk + btnSm + " mt-2"} onClick={addResource}>+ Add resource</button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-line/10">
          <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
            <input type="checkbox" checked={roadmap.published} onChange={e => onChange({ ...roadmap, published: e.target.checked })} />
            Published
          </label>
          <div className="flex gap-2">
            <button className={btnGhost + btnSm} onClick={onCancel}>Cancel</button>
            <button className={btnPrimary + btnSm} onClick={onSave} disabled={busy}>💾 Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
