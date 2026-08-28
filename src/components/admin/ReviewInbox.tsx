import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelId } from "../../types";
import { FIELDS, LEVELS } from "../../data";
import { chat, aiAvailable } from "../../ai";
import { type DuplicateMatch } from "../../services/duplicates";
import { batchDeleteQuestions, batchSetQuestionsPublished, createQuestion, deleteQuestion, setQuestionPublished, updateQuestion, adminMissCandidates, type MissCandidate } from "../../services/admin";
import { getPublishedQuestions } from "../../services/remoteConfig";
import { toast } from "../../toast";
import { pushUndo, popUndo, peekUndo, onUndoChange, getUndoHistory, clearUndo } from "../../services/undoStack";
import { cardCls, btnPrimary, btnGhost, btnDanger, btnSm, btnSoft, Chip } from "../ui";

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
  const drafts = useMemo(() => list.filter(q => !q.published), [list]);
  /* auto-triage: heuristic issues + near-duplicate detection — runs in Web Worker */
  const [triage, setTriage] = useState<Record<number, { issues: string[]; level: "ready" | "needs-work" | "review-first"; dups: DuplicateMatch[] }>>({});
  const [triageProgress, setTriageProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const triageRef = useRef(triage);
  triageRef.current = triage;

  /* Page-aware triage: derive sorted list with useMemo (no state, no cascade) */
  const [manualOrder, setManualOrder] = useState(false);
  const [manualDrafts, setManualDrafts] = useState<typeof drafts | null>(null);
  const sortedDrafts = useMemo(() => {
    if (manualOrder && manualDrafts) return manualDrafts;
    return [...drafts].sort((a, b) => {
      const p = { "review-first": 0, "needs-work": 1, ready: 2 };
      return (p[triage[a.id]?.level ?? "ready"] - p[triage[b.id]?.level ?? "ready"]) || a.id - b.id;
    });
  }, [drafts, triage, manualOrder, manualDrafts]);
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  /* Search + filter — derived with useMemo, no cascade */
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterTriage, setFilterTriage] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [bulkField, setBulkField] = useState("");
  const [bulkLevel, setBulkLevel] = useState("");
  /* CSV preview state */
  const [csvPreview, setCsvPreview] = useState<null | {
    rows: { question: string; answer: string; keyPoints: string[]; fieldId: string; level: LevelId }[];
    skipped: Set<number>;
    fileName: string;
  }>(null);
  /* Undo history panel */
  const [showUndoHistory, setShowUndoHistory] = useState(false);
  const [undoSearch, setUndoSearch] = useState("");
  const filteredDrafts = useMemo(() => {
    let out = sortedDrafts;
    const q = search.toLowerCase().trim();
    if (q) out = out.filter(d => d.question.toLowerCase().includes(q) || d.answer.toLowerCase().includes(q));
    if (filterField) out = out.filter(d => d.fieldId === filterField);
    if (filterLevel) out = out.filter(d => d.level === filterLevel);
    if (filterTriage) out = out.filter(d => (triage[d.id]?.level ?? "ready") === filterTriage);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      out = out.filter(d => {
        const item = list.find(l => l.id === d.id);
        const ts = item?.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        return ts >= from;
      });
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000; // include full day
      out = out.filter(d => {
        const item = list.find(l => l.id === d.id);
        const ts = item?.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        return ts > 0 ? ts <= to : true;
      });
    }
    return out;
  }, [sortedDrafts, search, filterField, filterLevel, filterTriage, filterDateFrom, filterDateTo, triage, list]);
  const hasFilters = search || filterField || filterLevel || filterTriage || filterDateFrom || filterDateTo;
  const clearFilters = () => { setSearch(""); setFilterField(""); setFilterLevel(""); setFilterTriage(""); setFilterDateFrom(""); setFilterDateTo(""); };
  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, filterField, filterLevel, filterTriage, filterDateFrom, filterDateTo, drafts.length]);

  /* Web Worker triage: all duplicate detection runs off main thread */
  useEffect(() => {
    if (drafts.length === 0) return;
    setTriageProgress(0);

    // Only triage drafts not yet computed (use ref to avoid stale closure)
    const visibleDrafts = sortedDrafts.slice(page * pageSize, (page + 1) * pageSize);
    const toTriage = visibleDrafts.filter(d => !triageRef.current[d.id]);
    if (toTriage.length === 0) return;

    const bank = list.map(q => q.question).slice(-500);

    // Use Vite-compatible worker creation — runs off main thread, no blocking
    const w = new Worker(
      new URL("../../services/triageWorker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = w;

    // Use ref in handler to avoid stale closure
    let progressTimer: ReturnType<typeof setTimeout> | null = null;
    w.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.type === "progress") {
        // Debounce progress — only update UI at most once per 200ms to prevent cascade
        if (progressTimer) return;
        progressTimer = setTimeout(() => { progressTimer = null; }, 200);
        setTriageProgress(Math.round((msg.done / msg.total) * 100));
      } else if (msg.type === "result") {
        // Merge all results at once — single state update, no cascade
        setTriage(prev => ({ ...prev, ...msg.triage }));
        setTriageProgress(100);
      }
    };

    w.postMessage({ type: "triage", drafts: toTriage, bank });

    return () => {
      if (progressTimer) clearTimeout(progressTimer);
      w.terminate();
      workerRef.current = null;
    };
  }, [page, pageSize]);

  /* ── CSV export/import ── */
  const exportCsv = () => {
    const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const header = ["question","answer","keyPoints","field","level"].join(",");
    const rows = filteredDrafts.map(d => {
      const field = FIELDS.find(f => f.id === d.fieldId)?.name ?? d.fieldId;
      const level = LEVELS.find(l => l.id === d.level)?.name ?? d.level;
      return [esc(d.question), esc(d.answer), esc(d.keyPoints.join("; ")), esc(field), esc(level)].join(",");
    }).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `interviewiq-drafts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast(`📥 Exported ${filteredDrafts.length} draft(s) as CSV`);
  };
  const parseCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast("CSV must have a header row + data rows"); return; }
    const header = lines[0].toLowerCase();
    if (!header.includes("question")) { toast("CSV must have a 'question' column"); return; }
    const cols = header.split(",").map(c => c.trim().replace(/["\s]/g, ""));
    const qIdx = cols.findIndex(c => c === "question");
    const aIdx = cols.findIndex(c => c === "answer");
    const kIdx = cols.findIndex(c => c.includes("keypoint") || c.includes("key_point"));
    const fIdx = cols.findIndex(c => c === "field" || c === "fieldid" || c === "field_id");
    const lIdx = cols.findIndex(c => c === "level");
    const parseCsvRow = (row: string) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of row) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { cells.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      cells.push(current.trim());
      return cells;
    };
    const rows: { question: string; answer: string; keyPoints: string[]; fieldId: string; level: LevelId }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvRow(lines[i]);
      const q = cells[qIdx]?.trim();
      if (!q) continue;
      const fieldRaw = fIdx >= 0 ? cells[fIdx]?.trim() : "";
      const fieldId = FIELDS.find(f => f.name.toLowerCase() === fieldRaw?.toLowerCase() || f.id === fieldRaw)?.id ?? FIELDS[0]?.id ?? "";
      const levelRaw = lIdx >= 0 ? cells[lIdx]?.trim() : "";
      const level = LEVELS.find(l => l.name.toLowerCase() === levelRaw?.toLowerCase() || l.id === levelRaw)?.id as LevelId ?? "mid" as LevelId;
      rows.push({
        question: q,
        answer: aIdx >= 0 ? cells[aIdx]?.trim() ?? "" : "",
        keyPoints: kIdx >= 0 ? cells[kIdx]?.split(/[;|]/).map(k => k.trim()).filter(Boolean) : [],
        fieldId, level
      });
    }
    setCsvPreview({ rows, skipped: new Set(), fileName: file.name });
  };
  const importCsv = (file: File) => { void parseCsvFile(file); };
  const confirmCsvImport = async () => {
    if (!csvPreview) return;
    const toImport = csvPreview.rows.filter((_, i) => !csvPreview.skipped.has(i));
    if (!toImport.length) { toast("No rows to import"); return; }
    setBusy(true);
    let imported = 0;
    for (const row of toImport) {
      try {
        await createQuestion({ fieldId: row.fieldId, level: row.level, question: row.question, answer: row.answer, keyPoints: row.keyPoints, published: false });
        imported++;
      } catch { /* skip duplicates */ }
    }
    if (imported > 0) {
      await onChanged();
      toast(`📥 Imported ${imported} draft(s)`);
    } else {
      toast("No new questions imported — all may be duplicates");
    }
    setCsvPreview(null);
    setBusy(false);
  };
  const toggleCsvSkip = (idx: number) => {
    if (!csvPreview) return;
    const next = new Set(csvPreview.skipped);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setCsvPreview({ ...csvPreview, skipped: next });
  };
  const downloadTemplate = () => {
    const csv = "question,answer,keyPoints,field,level\n\"What is a closure?\",\"A closure is...\",\"scope; functions\",\"Backend Engineer\",\"Senior\"\n\"Explain REST\",\"REST is...\",\"HTTP; stateless\",\"Full-Stack Engineer\",\"Mid-Level\"";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "interviewiq-csv-template.csv";
    a.click(); URL.revokeObjectURL(url);
    toast("📥 Template downloaded — fill in your questions and import");
  };
  const applyBulkTags = async () => {
    if (selected.size === 0 || (!bulkField && !bulkLevel)) return;
    // Snapshot current tags for undo
    const snapshot = [...selected].map(id => {
      const d = list.find(q => q.id === id);
      return d ? { id, fieldId: d.fieldId, level: d.level } : null;
    }).filter(Boolean) as { id: number; fieldId: string; level: string }[];
    setBusy(true);
    try {
      for (const id of selected) {
        const patch: Record<string, unknown> = {};
        if (bulkField) patch.fieldId = bulkField;
        if (bulkLevel) patch.level = bulkLevel;
        await updateQuestion(id, patch);
      }
      pushUndo({
        label: `Tagged ${selected.size} draft(s)`,
        undo: async () => {
          for (const s of snapshot) await updateQuestion(s.id, { fieldId: s.fieldId, level: s.level as LevelId });
        }
      });
      toast(`🏷 Updated ${selected.size} draft(s) — Ctrl+Z to undo`);
      setSelected(new Set());
      setBulkField("");
      setBulkLevel("");
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };
  /* Drag-and-drop CSV import on the entire section */
  const onDropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) { void parseCsvFile(file); }
    else if (file) toast("Please drop a .csv file");
  };

  /* ── Undo support ── */
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => onUndoChange(() => setCanUndo(!!peekUndo())), []);
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        const entry = peekUndo();
        if (entry) {
          e.preventDefault();
          const ok = await popUndo();
          if (ok) toast(`↩ Undone: ${entry.label}`);
          await onChanged();
        }
        return;
      }
      // Global shortcuts work everywhere
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (search || hasFilters) {
          clearFilters();
          searchRef.current?.blur();
          return;
        }
        if (expandedDrafts.size > 0) { setExpandedDrafts(new Set()); return; }
      }
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
  }, [sortedDrafts, focusedIdx, search, hasFilters, expandedDrafts]);

  /* ── Drag-and-drop reorder ── */
  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (_idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const item = sortedDrafts[dragIdx];
    const newDrafts = [...sortedDrafts];
    newDrafts.splice(dragIdx, 1);
    newDrafts.splice(idx, 0, item);
    setManualDrafts(newDrafts);
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
    setSelected(selected.size === filteredDrafts.length ? new Set() : new Set(filteredDrafts.map(d => d.id)));

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
    // Snapshot current state for undo
    const snapshot = ids.map(id => {
      const d = list.find(q => q.id === id);
      return d ? { id, published: d.published } : null;
    }).filter(Boolean) as { id: number; published: boolean }[];
    setBusy(true);
    try {
      await batchSetQuestionsPublished(ids, true);
      pushUndo({
        label: `Published ${ids.length} question(s)`,
        undo: async () => { await batchSetQuestionsPublished(snapshot.map(s => s.id), false); }
      });
      toast(`🚀 Published ${ids.length} question(s) — Ctrl+Z to undo`);
      setSelected(new Set());
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const aiTriageAll = async () => {
    const pending = sortedDrafts.filter(d => !aiTriage[d.id]);
    if (!pending.length) return;
    setAiBusy(true);
    setAiProgress({ done: 0, total: pending.length });
    const BATCH = 5;
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(async d => {
        try {
          const raw = await chat([
            { role: "system", content: "You are a senior interview-question editor. Score each draft 0-10 for clarity, answer completeness and key-point quality. Reply with ONLY `N — short reason`." },
            { role: "user", content: `Question: ${d.question}\nModel answer: ${d.answer || "(missing)"}\nKey points: ${d.keyPoints.join(", ") || "(none)"}` }
          ], { temperature: 0.2, maxTokens: 60 });
          const m = raw.trim().match(/^(\d{1,2})\s*[-—:.]\s*(.+)$/s);
          const score = Math.max(0, Math.min(10, Number(m?.[1] ?? 5)));
          return { id: d.id, score, note: (m?.[2] ?? raw).slice(0, 160) };
        } catch { return { id: d.id, score: 5, note: "AI unavailable" as string }; }
      }));
      const out: Record<number, { score: number; note: string }> = {};
      for (const r of results) {
        if (r.status === "fulfilled") out[r.value.id] = r.value;
      }
      setAiTriage(t => ({ ...t, ...out }));
      setAiProgress({ done: Math.min(i + BATCH, pending.length), total: pending.length });
      // Yield to browser between batches — 50ms avoids violation thresholds
      if (i + BATCH < pending.length) await new Promise(r => setTimeout(r, 50));
    }
    setAiBusy(false);
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    // Snapshot full question data for undo (re-create on undo)
    const snapshot = ids.map(id => {
      const d = list.find(q => q.id === id);
      return d ? { ...d } : null;
    }).filter(Boolean) as typeof list;
    setBusy(true);
    try {
      await batchDeleteQuestions(ids);
      pushUndo({
        label: `Deleted ${ids.length} question(s)`,
        undo: async () => {
          for (const q of snapshot) {
            await createQuestion({ fieldId: q.fieldId, level: q.level as LevelId, question: q.question, answer: q.answer, keyPoints: q.keyPoints, published: q.published });
          }
        }
      });
      toast(`🗑 Deleted ${ids.length} question(s) — Ctrl+Z to undo`);
      setSelected(new Set());
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div
      ref={dropRef}
      className="space-y-4 relative"
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOver(true); }}
      onDragLeave={e => { if (e.currentTarget === dropRef.current && !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={onDropHandler}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-acc/10 backdrop-blur-sm pointer-events-none">
          <div className="rounded-2xl border-2 border-dashed border-acc bg-panel1/95 px-12 py-8 text-center shadow-2xl">
            <div className="text-[40px]">📥</div>
            <p className="mt-2 text-[16px] font-extrabold text-acc">Drop CSV to import</p>
            <p className="mt-1 text-[12px] text-mut">Questions will be added as drafts</p>
          </div>
        </div>
      )}
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
                <div className="flex items-center gap-2">
                  <button className={btnSoft + btnSm} onClick={aiTriageAll} disabled={aiBusy || busy}
                    title="AI-triage: Use AI to score each draft for quality, relevance, and difficulty level"
                  >
                    {aiBusy ? <><span className="spinner" /> Scoring…</> : `✨ AI-triage (${sortedDrafts.filter(d => !aiTriage[d.id]).length})`}
                  </button>
                  {aiBusy && aiProgress.total > 0 && (
                    <span className="text-[11px] text-acc font-bold">{aiProgress.done}/{aiProgress.total}</span>
                  )}
                </div>
              )}
              <button className={btnGhost + btnSm} onClick={toggleAll} disabled={busy}
                title="Select or deselect all visible drafts"
              >
                {selected.size === filteredDrafts.length && filteredDrafts.length > 0 ? "Deselect all" : `Select all (${filteredDrafts.length})`}
              </button>
              <button className={btnPrimary + btnSm} onClick={publishSelected} disabled={busy || selected.size === 0}
                title="Publish: Move selected drafts to the Question Bank for users"
              >
                🚀 Publish {selected.size || ""}
              </button>
              <button className={btnDanger + btnSm} onClick={deleteSelected} disabled={busy || selected.size === 0}
                title="Delete: Permanently remove selected drafts"
              >
                🗑 Delete {selected.size || ""}
              </button>
              {canUndo && (
                <button className={btnSoft + btnSm} onClick={async () => {
                  const entry = peekUndo();
                  if (entry) { await popUndo(); toast(`↩ Undone: ${entry.label}`); await onChanged(); }
                }} disabled={busy}
                  title="Undo: Reverse the last action (publish, delete, or tag)"
                >
                  ↩ Undo
                </button>
              )}
              <button className={btnGhost + btnSm} onClick={() => setShowUndoHistory(true)}
                title="History: View all recent operations with one-click undo"
              >
                📋 History
              </button>
            </div>
          )}
          {/* Bulk tag editing bar — shows when items are selected */}
          {selected.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-acc1/30 bg-acc1/5 px-3 py-2">
              <span className="text-[11px] font-bold text-acc1">🏷 Bulk edit ({selected.size} selected):</span>
              <select value={bulkField} onChange={ev => setBulkField(ev.target.value)} className="inp text-[11px]">
                <option value="">Keep field</option>
                {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
              </select>
              <select value={bulkLevel} onChange={ev => setBulkLevel(ev.target.value)} className="inp text-[11px]">
                <option value="">Keep level</option>
                {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
              </select>
              <button className={btnPrimary + btnSm} onClick={applyBulkTags} disabled={busy || (!bulkField && !bulkLevel)}>
                ✓ Apply to {selected.size}
              </button>
            </div>
          )}
        </div>
        {/* Triage progress bar */}
        {triageProgress > 0 && triageProgress < 100 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-mut font-bold">🔍 Analyzing drafts…</span>
              <span className="text-[11px] text-acc font-bold">{triageProgress}% — page {page + 1}</span>
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
        {/* Search + filters */}
        {drafts.length > 5 && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={searchRef}
                value={search}
                onChange={ev => setSearch(ev.target.value)}
                placeholder="🔍 Search questions… (press /)"
                className="inp flex-1 min-w-[180px]"
              />
              <select value={filterField} onChange={ev => setFilterField(ev.target.value)} className="inp text-[11px]">
                <option value="">All fields</option>
                {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
              </select>
              <select value={filterLevel} onChange={ev => setFilterLevel(ev.target.value)} className="inp text-[11px]">
                <option value="">All levels</option>
                {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
              </select>
              <select value={filterTriage} onChange={ev => setFilterTriage(ev.target.value)} className="inp text-[11px]">
                <option value="">All triage</option>
                <option value="ready">🟢 Ready</option>
                <option value="needs-work">🟡 Needs work</option>
                <option value="review-first">🔴 Review first</option>
              </select>
              {hasFilters && (
                <button className={btnGhost + btnSm} onClick={clearFilters}>Clear</button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-mut font-bold">From:</label>
              <input type="date" value={filterDateFrom} onChange={ev => setFilterDateFrom(ev.target.value)} className="inp text-[11px] w-[140px]" />
              <label className="text-[11px] text-mut font-bold">To:</label>
              <input type="date" value={filterDateTo} onChange={ev => setFilterDateTo(ev.target.value)} className="inp text-[11px] w-[140px]" />
              <div className="flex-1" />
              <button className={btnGhost + btnSm} onClick={exportCsv} disabled={filteredDrafts.length === 0}>📥 Export CSV</button>
              <button className={btnGhost + btnSm} onClick={() => csvInputRef.current?.click()}>📤 Import CSV</button>
              <button className={btnGhost + btnSm} onClick={downloadTemplate}>📄 Template</button>
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={ev => { const f = ev.target.files?.[0]; if (f) importCsv(f); ev.target.value = ""; }} />
            </div>
          </div>
        )}
        {hasFilters && (
          <p className="mt-2 text-[11px] text-mut font-bold">Showing {filteredDrafts.length} of {sortedDrafts.length} drafts {search && <span className="text-acc">· "{search}"</span>}</p>
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

      {/* Pagination */}
      {filteredDrafts.length > 0 && (
        <div className="flex items-center justify-between gap-2 py-3">
          <button className={btnGhost + btnSm} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={ev => { setPageSize(Number(ev.target.value)); setPage(0); }} className="rounded-lg border border-line/20 bg-panel3 px-2 py-1 text-[11px] font-bold">
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <span className="text-[12px] text-mut font-bold">Page {page + 1} of {Math.ceil(filteredDrafts.length / pageSize)} ({filteredDrafts.length} total)</span>
          </div>
          <button className={btnGhost + btnSm} onClick={() => setPage(p => Math.min(Math.ceil(filteredDrafts.length / pageSize) - 1, p + 1))} disabled={(page + 1) * pageSize >= filteredDrafts.length}>Next →</button>
        </div>
      )}

      {filteredDrafts.slice(page * pageSize, (page + 1) * pageSize).map((d, i) => {
        const e = edits[d.id];
        if (!e) return null;
        const idx = page * pageSize + i;
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
      })}

      {/* ── CSV Preview Modal ─────────────────────────────────────────── */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCsvPreview(null)}>
          <div className="mx-4 flex max-h-[85vh] w-full max-w-[800px] flex-col rounded-2xl border border-line/15 bg-panel1 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line/10 px-5 py-4">
              <div>
                <h3 className="text-[15px] font-extrabold">📥 Preview CSV Import</h3>
                <p className="text-[12px] text-mut">{csvPreview.fileName} — {csvPreview.rows.length} rows found, {csvPreview.rows.length - csvPreview.skipped.size} will be imported</p>
              </div>
              <button onClick={() => setCsvPreview(null)} className="rounded-lg p-1.5 text-mut hover:bg-wht/10 text-[18px]">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2">
                {csvPreview.rows.map((row, idx) => {
                  const skipped = csvPreview.skipped.has(idx);
                  const field = FIELDS.find(f => f.id === row.fieldId);
                  const level = LEVELS.find(l => l.id === row.level);
                  return (
                    <div key={idx} className={`flex items-start gap-3 rounded-xl border p-3.5 transition-opacity ${skipped ? "border-line/5 bg-wht/2 opacity-50" : "border-line/10 bg-wht/5"}`}>
                      <input type="checkbox" checked={!skipped} onChange={() => toggleCsvSkip(idx)} className="mt-1 h-4 w-4 accent-acc1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {field && <Chip tone="cat">{field.icon} {field.name}</Chip>}
                          {level && <Chip tone="lvl">{level.icon} {level.name}</Chip>}
                          {skipped && <Chip tone="bad">Skipped</Chip>}
                        </div>
                        <div className="mt-1.5 text-[13.5px] font-bold leading-snug">{row.question}</div>
                        {row.answer && <p className="mt-1 text-[12px] text-fnt line-clamp-2">{row.answer}</p>}
                        {row.keyPoints.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">{row.keyPoints.slice(0, 5).map((kp, i) => <Chip key={i}>{kp}</Chip>)}{row.keyPoints.length > 5 && <Chip>+{row.keyPoints.length - 5} more</Chip>}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-line/10 px-5 py-4">
              <button className={btnGhost + btnSm} onClick={() => setCsvPreview(null)}>Cancel</button>
              <div className="flex items-center gap-2">
                <button className={btnGhost + btnSm} onClick={() => setCsvPreview({ ...csvPreview, skipped: new Set() })}>Select all</button>
                <button className={btnGhost + btnSm} onClick={() => setCsvPreview({ ...csvPreview, skipped: new Set(csvPreview.rows.map((_, i) => i)) })}>Skip all</button>
                <button className={btnPrimary + btnSm} onClick={confirmCsvImport} disabled={busy || csvPreview.rows.length === csvPreview.skipped.size}>
                  📥 Import {csvPreview.rows.length - csvPreview.skipped.size} row(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo History Panel ────────────────────────────────────────── */}
      {showUndoHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUndoHistory(false)}>
          <div className="mx-4 flex max-h-[70vh] w-full max-w-[500px] flex-col rounded-2xl border border-line/15 bg-panel1 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line/10 px-5 py-4">
              <div>
                <h3 className="text-[15px] font-extrabold">↩ Undo History</h3>
                <p className="text-[12px] text-mut">Last 20 operations — click to undo</p>
              </div>
              <div className="flex items-center gap-2">
                <button className={btnDanger + btnSm} onClick={() => { clearUndo(); setShowUndoHistory(false); toast("🗑 History cleared"); }}>Clear all</button>
                <button onClick={() => setShowUndoHistory(false)} className="rounded-lg p-1.5 text-mut hover:bg-wht/10 text-[18px]">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {getUndoHistory().length === 0 ? (
                <p className="text-center text-[13px] text-mut">No operations recorded yet</p>
              ) : (
                <>
                  <input
                    value={undoSearch}
                    onChange={ev => setUndoSearch(ev.target.value)}
                    placeholder="🔍 Search operations…"
                    className="inp mb-3"
                    autoFocus
                  />
                  {(() => {
                    const filtered = [...getUndoHistory()].reverse().filter(e =>
                      !undoSearch || e.label.toLowerCase().includes(undoSearch.toLowerCase())
                    );
                    if (filtered.length === 0) return <p className="text-center text-[13px] text-mut">No matching operations</p>;
                    return (
                      <div className="space-y-2">
                        {filtered.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px]">{idx === 0 ? "🟢" : "⚪"}</span>
                              <span className="text-[13px] font-bold">{entry.label}</span>
                            </div>
                            <button className={btnSoft + btnSm} onClick={async () => {
                              const ok = await popUndo();
                              if (ok) toast(`↩ Undone: ${entry.label}`);
                              await onChanged();
                              setUndoSearch("");
                            }}>↩ Undo</button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom pagination */}
      {filteredDrafts.length > pageSize && (
        <div className="flex items-center justify-center gap-2 py-3">
          <button className={btnGhost + btnSm} onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page === 0}>← Prev</button>
          <span className="text-[12px] text-mut font-bold">Page {page + 1} of {Math.ceil(filteredDrafts.length / pageSize)}</span>
          <button className={btnGhost + btnSm} onClick={() => { setPage(p => Math.min(Math.ceil(filteredDrafts.length / pageSize) - 1, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={(page + 1) * pageSize >= filteredDrafts.length}>Next →</button>
        </div>
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
