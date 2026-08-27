import { useEffect, useRef, useState } from "react";
import type { LevelId } from "../../types";
import { FIELDS, LEVELS } from "../../data";
import { chat, aiAvailable } from "../../ai";
import { draftIssues, findDuplicates, triageLevel, type DuplicateMatch } from "../../services/duplicates";
import { batchDeleteQuestions, batchSetQuestionsPublished, createQuestion, deleteQuestion, setQuestionPublished, updateQuestion, adminMissCandidates, type MissCandidate } from "../../services/admin";
import { getPublishedQuestions } from "../../services/remoteConfig";
import { toast } from "../../toast";
import { cardCls, btnPrimary, btnGhost, btnDanger, btnSm, btnSoft, Chip } from "../ui";
import { VirtualList } from "../ui/VirtualList";

/* ------------------------------------------------------------------ */
/* Review inbox — batch review of scraped/imported drafts              */
/* ------------------------------------------------------------------ */

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

export function ReviewInbox({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getPublishedQuestions>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const drafts = list.filter(q => !q.published);
  /* auto-triage: heuristic issues + near-duplicate detection (lazy — only runs once) */
  const [triage, setTriage] = useState<Record<number, { issues: string[]; level: "ready" | "needs-work" | "review-first"; dups: DuplicateMatch[] }>>({});
  const [triageProgress, setTriageProgress] = useState(0); // 0-100
  const triageBatchSize = 10;
  const triageBatchRef = useRef(0);
  const abortRef = useRef(false);

  /* Paginated triage: process 10 drafts at a time with UI updates between batches */
  useEffect(() => {
    if (drafts.length === 0) return;
    abortRef.current = false;
    triageBatchRef.current = 0;
    setTriageProgress(0);

    const bank = list.map(q => q.question).slice(-500);
    const map: Record<number, { issues: string[]; level: "ready" | "needs-work" | "review-first"; dups: DuplicateMatch[] }> = {};

    const processBatch = () => {
      if (abortRef.current) return;
      const start = triageBatchRef.current;
      const end = Math.min(start + triageBatchSize, drafts.length);

      for (let i = start; i < end; i++) {
        const d = drafts[i];
        const issues = draftIssues(d);
        const dups = findDuplicates(d.question, bank.filter(q => q !== d.question));
        map[d.id] = { issues, level: triageLevel(issues), dups };
      }

      triageBatchRef.current = end;
      setTriage({ ...map });
      setTriageProgress(Math.round((end / drafts.length) * 100));

      if (end < drafts.length) {
        // Yield to browser for rendering, then process next batch
        setTimeout(processBatch, 0);
      }
    };

    // Start after first paint
    requestAnimationFrame(() => processBatch());

    return () => { abortRef.current = true; };
  }, [list, drafts]);
  const [sortedDrafts, setSortedDrafts] = useState<typeof drafts>([]);
  // Initialize + re-sort when triage or drafts change (but preserve manual reorder)
  const [manualOrder, setManualOrder] = useState(false);
  useEffect(() => {
    if (manualOrder) return;
    const sorted = [...drafts].sort((a, b) => {
      const p = { "review-first": 0, "needs-work": 1, ready: 2 };
      return (p[triage[a.id]?.level ?? "ready"] - p[triage[b.id]?.level ?? "ready"]) || a.id - b.id;
    });
    setSortedDrafts(sorted);
  }, [drafts, triage, manualOrder]);
  const [aiTriage, setAiTriage] = useState<Record<number, { score: number; note: string }>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [edits, setEdits] = useState<Record<number, DraftEdit>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [candidates, setCandidates] = useState<MissCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [addedQ, setAddedQ] = useState<Set<string>>(new Set());
  const [expandedDrafts, setExpandedDrafts] = useState<Set<number>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (sortedDrafts.length === 0) return;

      const idx = focusedIdx;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIdx(i => Math.min(i + 1, sortedDrafts.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIdx(i => Math.max(i - 1, 0));
          break;
        case "Enter": {
          // Publish focused draft
          e.preventDefault();
          if (idx >= 0 && idx < sortedDrafts.length) {
            publishOne(sortedDrafts[idx].id);
            setFocusedIdx(i => Math.min(i, sortedDrafts.length - 2));
          }
          break;
        }
        case "Delete":
        case "Backspace": {
          // Delete focused draft
          e.preventDefault();
          if (idx >= 0 && idx < sortedDrafts.length) {
            deleteOne(sortedDrafts[idx].id);
            setFocusedIdx(i => Math.min(i, sortedDrafts.length - 2));
          }
          break;
        }
        case " ": {
          // Toggle select
          e.preventDefault();
          if (idx >= 0 && idx < sortedDrafts.length) {
            toggle(sortedDrafts[idx].id);
          }
          break;
        }
        case "e":
        case "E": {
          // Toggle expand
          e.preventDefault();
          if (idx >= 0 && idx < sortedDrafts.length) {
            toggleExpand(sortedDrafts[idx].id);
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sortedDrafts, focusedIdx]);

  /* ── Drag-and-drop reorder ── */
  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    // Reorder sortedDrafts by moving item from dragIdx to idx
    const item = sortedDrafts[dragIdx];
    const newDrafts = [...sortedDrafts];
    newDrafts.splice(dragIdx, 1);
    newDrafts.splice(idx, 0, item);
    setSortedDrafts(newDrafts);
    setManualOrder(true);
    setDragIdx(null);
  };
  const onDragEnd = () => setDragIdx(null);

  const toggleExpand = (id: number) => {
    setExpandedDrafts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setCandLoading(true);
    void adminMissCandidates().then(setCandidates).catch(() => setCandidates([])).finally(() => setCandLoading(false));
  }, []);

  const addCandidate = async (c: MissCandidate) => {
    setBusy(true);
    try {
      await createQuestion({
        fieldId: c.field_id, level: c.level as LevelId, question: c.question,
        answer: "", keyPoints: [], published: false
      });
      setAddedQ(s => new Set(s).add(c.question));
      toast(`📚 Added "${c.question.slice(0, 40)}…" to the drafts`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const addAllCandidates = async () => {
    const pending = candidates.filter(c => !addedQ.has(c.question));
    if (!pending.length) return;
    setBusy(true);
    try {
      for (const c of pending) {
        await createQuestion({
          fieldId: c.field_id, level: c.level as LevelId, question: c.question,
          answer: "", keyPoints: [], published: false
        });
      }
      setAddedQ(s => new Set([...s, ...pending.map(c => c.question)]));
      toast(`📚 Added ${pending.length} missed-question draft(s)`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

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

  const aiTriageAll = async () => {
    const pending = sortedDrafts.filter(d => !aiTriage[d.id]);
    if (!pending.length) return;
    setAiBusy(true);
    const out: Record<number, { score: number; note: string }> = {};
    for (const d of pending) {
      try {
        const raw = await chat([
          { role: "system", content: "You are a senior interview-question editor. Score each draft 0-10 for clarity, answer completeness and key-point quality. Reply with ONLY `N — short reason`." },
          { role: "user", content: `Question: ${d.question}\nModel answer: ${d.answer || "(missing)"}\nKey points: ${d.keyPoints.join(", ") || "(none)"}` }
        ], { temperature: 0.2, maxTokens: 60 });
        const m = raw.trim().match(/^(\d{1,2})\s*[-—:.]\s*(.+)$/s);
        const score = Math.max(0, Math.min(10, Number(m?.[1] ?? 5)));
        out[d.id] = { score, note: (m?.[2] ?? raw).slice(0, 160) };
      } catch { out[d.id] = { score: 5, note: "AI unavailable" }; }
    }
    setAiTriage(t => ({ ...t, ...out }));
    setAiBusy(false);
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
      {/* harvest candidates — real user misses, one click to draft */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">📊 Harvest candidates ({candidates.length})</h2>
            <p className="text-[12.5px] text-mut">
              Questions real users scored ≤2 on (from session analytics, ≥2 attempts). One click turns a
              systemic weak spot into a draft you can review below.
            </p>
          </div>
          {candidates.length > 0 && (
            <button className={btnPrimary + btnSm} onClick={addAllCandidates} disabled={busy || candidates.every(c => addedQ.has(c.question))}>
              ➕ Add all as drafts
            </button>
          )}
        </div>
        {candLoading && <p className="mt-3 text-[12.5px] text-fnt"><span className="spinner" /> Aggregating session answers…</p>}
        {!candLoading && candidates.length === 0 && (
          <p className="mt-3 text-[13px] text-mut">No candidates yet — they appear once users complete sessions (each answer is scored server-side).</p>
        )}
        {candidates.length > 0 && (
          <div className="mt-3 space-y-2">
            {candidates.map(c => {
              const added = addedQ.has(c.question);
              return (
                <div key={c.question} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="lvl">{LEVELS.find(l => l.id === c.level)?.icon} {LEVELS.find(l => l.id === c.level)?.name ?? c.level}</Chip>
                      <Chip tone="cat">{FIELDS.find(f => f.id === c.field_id)?.name ?? c.field_id}</Chip>
                      <Chip tone="bad">{c.misses} missed</Chip>
                      <Chip>{c.miss_rate}% miss rate</Chip>
                      <Chip tone="warn">avg {c.avg_score}/5</Chip>
                    </div>
                    <div className="mt-1.5 text-[13.5px] font-bold">{c.question}</div>
                    <div className="text-[11.5px] text-fnt">{c.attempts} attempt(s)</div>
                  </div>
                  <button className={btnGhost + btnSm} onClick={() => addCandidate(c)} disabled={busy || added}>
                    {added ? "✓ Added" : "➕ Draft"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              {aiAvailable() && (
                <button className={btnSoft + btnSm} onClick={aiTriageAll} disabled={aiBusy || busy}>
                  {aiBusy ? <><span className="spinner" /> Scoring…</> : `✨ AI-triage (${sortedDrafts.filter(d => !aiTriage[d.id]).length})`}
                </button>
              )}
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
        {/* Triage progress bar */}
        {triageProgress > 0 && triageProgress < 100 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-mut font-bold">🔍 Analyzing drafts…</span>
              <span className="text-[11px] text-acc font-bold">{triageProgress}% ({triageBatchRef.current}/{drafts.length})</span>
            </div>
            <div className="h-1.5 rounded-full bg-panel2 overflow-hidden">
              <div
                className="h-full rounded-full bg-acc transition-all duration-200"
                style={{ width: `${triageProgress}%` }}
              />
            </div>
          </div>
        )}
        {triageProgress === 100 && drafts.length > 20 && (
          <p className="mt-2 text-[11px] text-ok font-bold">✅ Triage complete — {Object.keys(triage).length} drafts analyzed</p>
        )}
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

      {drafts.length === 0 ? null : (
        sortedDrafts.length > 50 ? (
          /* Virtualized rendering for large lists */
          <VirtualList
            items={sortedDrafts}
            estimateHeight={260}
            overscan={3}
            className="max-h-[70vh] space-y-3 pr-1"
            renderItem={(d) => {
              const e = edits[d.id];
              if (!e) return null;
              const idx = sortedDrafts.indexOf(d);
              return (
                <DraftCard
                  d={d} e={e} sel={selected.has(d.id)} t={triage[d.id]} ai={aiTriage[d.id]}
                  expanded={expandedDrafts.has(d.id)} busy={busy} focused={focusedIdx === idx}
                  onToggle={() => toggle(d.id)} onExpand={() => toggleExpand(d.id)}
                  onEdit={(patch) => edit(d.id, patch)}
                  onSave={() => saveOne(d.id)} onPublish={() => publishOne(d.id)} onDelete={() => deleteOne(d.id)}
                  onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)}
                  onDrop={onDrop(idx)} onDragEnd={onDragEnd}
                />
              );
            }}
          />
        ) : (
          /* Normal rendering for smaller lists */
          sortedDrafts.map((d, idx) => {
            const e = edits[d.id];
            if (!e) return null;
            return (
              <DraftCard
                key={d.id}
                d={d} e={e} sel={selected.has(d.id)} t={triage[d.id]} ai={aiTriage[d.id]}
                expanded={expandedDrafts.has(d.id)} busy={busy} focused={focusedIdx === idx}
                onToggle={() => toggle(d.id)} onExpand={() => toggleExpand(d.id)}
                onEdit={(patch) => edit(d.id, patch)}
                onSave={() => saveOne(d.id)} onPublish={() => publishOne(d.id)} onDelete={() => deleteOne(d.id)}
                onDragStart={onDragStart(idx)} onDragOver={onDragOver(idx)}
                onDrop={onDrop(idx)} onDragEnd={onDragEnd}
              />
            );
          })
        )
      )}
    </div>
  );
}

/* ── Draft card component (shared by virtualized and normal rendering) ── */
function DraftCard({ d, e, sel, t, ai, expanded, busy, focused, onToggle, onExpand, onEdit, onSave, onPublish, onDelete, onDragStart, onDragOver, onDrop, onDragEnd }: {
  d: { id: number; fieldId: string; level: string; question: string; answer: string; keyPoints: string[] };
  e: { fieldId: string; level: string; question: string; answer: string; keyPoints: string[] };
  sel: boolean; t?: { issues: string[]; level: string; dups: { text: string; sim: number }[] };
  ai?: { score: number; note: string }; expanded: boolean; busy: boolean; focused?: boolean;
  onToggle: () => void; onExpand: () => void; onEdit: (patch: Record<string, unknown>) => void;
  onSave: () => void; onPublish: () => void; onDelete: () => void;
  onDragStart?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void; onDragEnd?: () => void;
}) {
  const currentLevel = LEVELS.find(l => l.id === e.level);
  const currentField = FIELDS.find(f => f.id === e.fieldId);
  return (
    <div
      className={`${cardCls} p-5 ${sel ? "ring-2 ring-acc1/60" : ""} ${focused ? "ring-2 ring-acc1" : ""} transition-shadow`}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="mb-3 flex items-start gap-3">
        <input type="checkbox" checked={sel} onChange={onToggle} className="mt-1 h-4 w-4 accent-acc1" />
        {/* Drag handle */}
        {onDragStart && (
          <div className="mt-1 cursor-grab text-mut hover:text-ink text-[14px] select-none" title="Drag to reorder">⠿</div>
        )}
        <div className="flex-1 space-y-2.5">
          {/* ── Inline-editable tags ── */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Level chip — click to cycle or select */}
            <select
              value={e.level}
              onChange={ev => onEdit({ level: ev.target.value })}
              className="rounded-lg border border-line/20 bg-panel3 px-2 py-0.5 text-[11.5px] font-bold text-ink appearance-none cursor-pointer hover:border-acc1/50 transition-colors"
              title="Click to change level"
            >
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
            </select>
            {/* Field chip — click to select */}
            <select
              value={e.fieldId}
              onChange={ev => onEdit({ fieldId: ev.target.value })}
              className="rounded-lg border border-line/20 bg-panel3 px-2 py-0.5 text-[11.5px] font-bold text-ink appearance-none cursor-pointer hover:border-acc1/50 transition-colors"
              title="Click to change field"
            >
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
            </select>
            {t && (
              <Chip tone={t.level === "ready" ? "ok" : t.level === "needs-work" ? "warn" : "bad"}>
                {t.level === "ready" ? "🟢 ready" : t.level === "needs-work" ? "🟡 needs work" : "🔴 review first"}
              </Chip>
            )}
            {t && t.issues.map((iss, i) => <Chip key={i} tone="warn">{iss}</Chip>)}
            {t && t.dups.map((dup, i) => (
              <Chip key={"dup" + i} tone="co">🔁 ~{Math.round(dup.sim * 100)}% dup</Chip>
            ))}
            {ai && (
              <Chip tone={ai.score >= 7 ? "ok" : ai.score >= 4 ? "warn" : "bad"}>✨ {ai.score}/10</Chip>
            )}
            {/* Tag change indicator */}
            {(e.level !== d.level || e.fieldId !== d.fieldId) && (
              <span className="text-[10px] font-bold text-warn">modified</span>
            )}
          </div>
          {ai?.note && ai.note !== "AI unavailable" && <p className="text-[11.5px] text-fnt">✨ {ai.note}</p>}
          {t && t.dups.length > 0 && (
            <p className="text-[11.5px] text-fnt">Matches existing: {t.dups[0].text.slice(0, 90)}{t.dups[0].text.length > 90 ? "…" : ""}</p>
          )}
          <div className="text-[14px] font-bold leading-snug">{d.question}</div>
          {d.answer && (
            <div className="rounded-lg bg-panel2/50 px-3 py-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-mut">Model Answer</div>
              <p className={`text-[12.5px] text-ink leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{d.answer}</p>
              {d.answer.length > 200 && !expanded && (
                <button onClick={onExpand} className="mt-1 text-[11px] font-bold text-acc hover:underline">Show full answer…</button>
              )}
            </div>
          )}
          {d.keyPoints.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-mut">Key Points ({d.keyPoints.length})</div>
              <div className="flex flex-wrap gap-1.5">{d.keyPoints.map((kp, i) => <Chip key={i}>{kp}</Chip>)}</div>
            </div>
          )}
          {!d.answer && d.keyPoints.length === 0 && (
            <p className="text-[11.5px] text-warn italic">⚠️ No answer or key points — needs review</p>
          )}
          <button onClick={onExpand} className="text-[11.5px] font-bold text-acc hover:underline">
            {expanded ? "▼ Collapse editor" : "▶ Expand to edit"}
          </button>
          {expanded && (
            <div className="space-y-2.5 border-t border-line/10 pt-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <select value={e.fieldId} onChange={ev => onEdit({ fieldId: ev.target.value })} className="inp">
                  {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                </select>
                <select value={e.level} onChange={ev => onEdit({ level: ev.target.value })} className="inp">
                  {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                </select>
              </div>
              <textarea value={e.question} onChange={ev => onEdit({ question: ev.target.value })} rows={2} className="inp w-full resize-y text-[13.5px] font-bold" />
              <textarea value={e.answer} onChange={ev => onEdit({ answer: ev.target.value })} rows={3} placeholder="Model answer…" className="inp w-full resize-y" />
              <input value={e.keyPoints.join(", ")} onChange={ev => onEdit({ keyPoints: ev.target.value.split(",").map(k => k.trim()).filter(Boolean) })} placeholder="Key points, comma-separated" className="inp w-full" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-mut">
          <span>Enter=publish</span>
          <span>·</span>
          <span>Del=delete</span>
          <span>·</span>
          <span>↑↓=navigate</span>
          <span>·</span>
          <span>Space=select</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost + btnSm} onClick={onSave} disabled={busy}>💾 Save</button>
          <button className={btnPrimary + btnSm} onClick={onPublish} disabled={busy}>🚀 Publish</button>
          <button className={btnDanger + btnSm} onClick={onDelete} disabled={busy}>Delete</button>
        </div>
      </div>
    </div>
  );
}
