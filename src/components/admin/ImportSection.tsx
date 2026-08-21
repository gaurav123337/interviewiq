import { useEffect, useState } from "react";
import { FIELDS } from "../../data";
import { aiAvailable } from "../../ai";
import { cleanTextToQuestions } from "../../services/cleaner";
import { parseQuestionBatch } from "../../services/import";
import { extractFileText } from "../../services/pdf";
import {
  createPdfDocument, createQuestion, deletePdfDocument, listPdfDocuments,
  updatePdfDocument, type PdfDocumentRow
} from "../../services/admin";
import { prepareChunks, reindexDocument } from "../../services/indexer";
import { toast } from "../../toast";
import { cardCls, btnPrimary, btnGhost, btnDanger, btnSm, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* Auto-fill — PDF / bulk import / AI cleaning pipeline                */
/* ------------------------------------------------------------------ */

export function AutoFill({ busy, setBusy, onChanged }: {
  busy: boolean; setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [candidates, setCandidates] = useState<ReturnType<typeof parseQuestionBatch>["ok"]>([]);
  const [batchText, setBatchText] = useState("");
  const [batchResult, setBatchResult] = useState<ReturnType<typeof parseQuestionBatch> | null>(null);
  const [busy2, setBusy2] = useState(false);
  const [docs, setDocs] = useState<PdfDocumentRow[]>([]);
  const [ragBusy, setRagBusy] = useState(false);

  useEffect(() => {
    void listPdfDocuments().then(setDocs).catch(() => {});
  }, []);

  const reloadDocs = async () => {
    try { setDocs(await listPdfDocuments()); } catch { /* ignore */ }
  };

  const indexRag = async () => {
    if (!rawText.trim()) { toast("Import a file first"); return; }
    if (!aiAvailable()) { toast("Add an AI key in Settings — indexing needs one"); return; }
    setRagBusy(true);
    try {
      if (!prepareChunks(rawText).length) { toast("Nothing to index — the extracted text is empty"); return; }
      const title = fileName || "Imported document";
      const existing = docs.find(d => d.title === title);
      const docId = existing ? existing.id : await createPdfDocument({ title, source: "pdf-import", charCount: rawText.length });
      /* incremental re-embed: unchanged chunks keep their vectors, only new/
         changed chunks are embedded — a small edit to a big PDF is cheap */
      const r = await reindexDocument(docId, rawText);
      if (existing && r.changed === 0) {
        toast(`⏭️ "${existing.title}" is unchanged — nothing to re-embed`);
        return;
      }
      if (!existing) await updatePdfDocument(docId, { charCount: rawText.length });
      await reloadDocs();
      toast(`🧠 Indexed ${r.reused + r.fresh} chunk(s) (${r.fresh} fresh embed${r.fresh === 1 ? "" : "s"}${existing ? `, reused ${r.reused}` : ""}) — the AI tutor is now grounded in this document`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Indexing failed"));
    } finally { setRagBusy(false); }
  };

  const removeDoc = async (id: number) => {
    setRagBusy(true);
    try { await deletePdfDocument(id); await reloadDocs(); toast("Document removed from the knowledge base"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setRagBusy(false); }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setBusy2(true);
    try {
      const text = await extractFileText(f);
      setRawText(text);
      setCandidates([]);
      toast(`📄 Extracted ${text.length.toLocaleString()} chars from ${f.name}`);
    } catch (e) {
      toast("✗ Couldn't read file: " + ((e as Error).message || "unsupported"));
    } finally { setBusy2(false); }
  };

  const clean = async () => {
    if (!rawText.trim()) { toast("Import a file first"); return; }
    if (!aiAvailable()) { toast("Add an AI key in Settings — AI cleaning needs one"); return; }
    setBusy2(true);
    try {
      const out = await cleanTextToQuestions(rawText);
      setCandidates(out);
      toast(`✨ AI extracted ${out.length} candidate question(s) — review below`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI cleaning failed"));
    } finally { setBusy2(false); }
  };

  const importCandidates = async () => {
    if (!candidates.length) return;
    setBusy(true);
    try {
      for (const c of candidates) {
        await createQuestion({ fieldId: c.fieldId, level: c.level, question: c.question, answer: c.answer, keyPoints: c.keyPoints, published: false });
      }
      toast(`📚 Saved ${candidates.length} draft(s) — review in Question bank`);
      setCandidates([]);
      setRawText(""); setFileName("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Import failed")); }
    finally { setBusy(false); }
  };

  const runBatch = async () => {
    const res = parseQuestionBatch(batchText);
    setBatchResult(res);
    if (!res.ok.length) { toast("No valid questions parsed — check the format"); return; }
    setBusy(true);
    try {
      for (const q of res.ok) {
        await createQuestion({ fieldId: q.fieldId, level: q.level, question: q.question, answer: q.answer, keyPoints: q.keyPoints, published: false });
      }
      toast(`📚 Imported ${res.ok.length} draft(s) — review in Question bank`);
      setBatchText(""); setBatchResult(null);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Import failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* PDF / text import */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">📄 Import a document (PDF or TXT)</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Extract the text on-device (nothing is uploaded), then let the AI agent turn it into structured
          question drafts for your review.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btnGhost} cursor-pointer`}>
            📂 {fileName || "Choose PDF / TXT…"}
            <input type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={e => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {rawText && <button className={btnPrimary + btnSm} onClick={clean} disabled={busy || busy2}>✨ Clean with AI</button>}
          {rawText && <span className="text-[12px] text-mut">{rawText.length.toLocaleString()} chars</span>}
        </div>
        {rawText && (
          <div className="mt-3 rounded-lg border border-line/10 bg-deep/40 p-3">
            <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-mut">Extracted preview</div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-mut line-clamp-4">{rawText.slice(0, 900)}</p>
          </div>
        )}
        {candidates.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">AI candidates ({candidates.length})</div>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <div key={i} className="rounded-lg border border-line/10 bg-wht/5 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <Chip tone="lvl">{c.level}</Chip>
                    <Chip tone="cat">{FIELDS.find(f => f.id === c.fieldId)?.name ?? c.fieldId}</Chip>
                  </div>
                  <div className="mt-1 text-[13px] font-bold">{c.question}</div>
                  {c.answer && <p className="mt-1 text-[12.5px] text-mut line-clamp-2">{c.answer}</p>}
                </div>
              ))}
            </div>
            <button className={`${btnPrimary + btnSm} mt-3`} onClick={importCandidates} disabled={busy}>
              📚 Save {candidates.length} as drafts
            </button>
          </div>
        )}
        {rawText && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/10 pt-3">
            <button className={btnPrimary + btnSm} onClick={indexRag} disabled={busy || busy2 || ragBusy}>
              {ragBusy ? <><span className="spinner" /> Embedding…</> : "🧠 Index for RAG"}
            </button>
            <span className="text-[12px] text-mut">Chunks the extracted text into vectors — the AI tutor answers get grounded in this document.</span>
          </div>
        )}
        {!aiAvailable() && (
          <p className="mt-3 text-[12.5px] text-warn">⚠️ AI cleaning + RAG indexing need an API key — add one in Settings to use the ✨ agent. You can still paste raw text below.</p>
        )}
      </div>

      {/* RAG knowledge base */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🧠 Knowledge base ({docs.length})</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Indexed documents are public product knowledge — every signed-in user's AI tutor can
          retrieve and cite them. Delete a document to remove its chunks.
        </p>
        {docs.length === 0 && <p className="text-[13px] text-mut">Nothing indexed yet — import a PDF/TXT above and hit “Index for RAG”.</p>}
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">📄 {d.title}</div>
                <div className="text-[11.5px] text-fnt">
                  {d.chunk_count} chunk(s) · {(d.char_count / 1000).toFixed(1)}k chars · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <button className={btnDanger + btnSm} onClick={() => removeDoc(d.id)} disabled={ragBusy}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk paste import */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">⚡ Bulk import (paste)</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Paste JSON <code className="rounded bg-wht/10 px-1">{'[{ fieldId, level, question, answer, keyPoints }]'}</code> or
          pipe-separated lines <code className="rounded bg-wht/10 px-1">field|level|question|answer|keyPoints</code>. Saved as drafts.
        </p>
        <textarea
          value={batchText}
          onChange={e => setBatchText(e.target.value)}
          rows={7}
          placeholder={`frontend|senior|How do you handle state at scale?|Keep state as close to the UI as it needs to be…|state management, trade-offs\nbackend|mid|Design a rate limiter|…`}
          className="inp w-full resize-y font-mono text-[12.5px]"
        />
        {batchResult && (
          <div className="mt-2 text-[12.5px]">
            <span className="font-bold text-ok">{batchResult.ok.length} valid</span>
            {batchResult.skipped.length > 0 && (
              <span className="text-warn"> · {batchResult.skipped.length} skipped ({batchResult.skipped.slice(0, 3).map(s => s.reason).join("; ")})</span>
            )}
          </div>
        )}
        <button className={`${btnPrimary + btnSm} mt-3`} onClick={runBatch} disabled={busy || !batchText.trim()}>
          📚 Parse & save as drafts
        </button>
      </div>

      {/* Weekly scraper note */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🕷️ Weekly scraper</h2>
        <p className="text-[12.5px] text-mut">
          Configure sources, the run schedule, and trigger a manual scrape from the dedicated
          <span className="font-bold text-ink"> 🕷️ Scraper tab</span> — no repo edits needed. Everything lands here as a
          DRAFT for review.
        </p>
      </div>
    </div>
  );
}

