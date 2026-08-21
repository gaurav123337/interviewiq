import { useState } from "react";
import { getDeepDive } from "../../data/deepDive";
import { SYSTEM_DESIGN_CASES } from "../../data/systemDesignBank";
import { getPrereqExplanation } from "../../data/prerequisiteKnowledge";
import { explainSystemDesign, systemDesignChat } from "../../services/systemDesignTutor";
import { getGoal } from "../../services/goal";
import { aiAvailable } from "../../ai";
import { STORAGE_KEYS, storageGet, storageSet } from "../../services/storage";
import { toast } from "../../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Drawer } from "../ui";
import { CitationChip } from "../CitationChip";
import { GroundingNote } from "../GroundingNote";
import { loadCompleted, markCompleted, loadQuiz, saveQuiz, loadHistory, saveHistoryEntry, loadBookmarks, loadTimerPreset, saveTimerPreset, loadFlashcards, calculateStreak, exportProgress, CATEGORY_META } from "./utils";
import { CaseCard } from "./CaseCard";
import { DifficultyDots } from "./DifficultyDots";
import { WhiteboardPhase } from "./WhiteboardPhase";
import { DeepDiveBlock } from "./DeepDive";

export function CaseDrawer({ caseData: c, goal, isCompleted, isBookmarked, onClose, onMarkComplete, onToggleBookmark }: {
  caseData: SystemDesignCase;
  goal: ReturnType<typeof getGoal>;
  isCompleted: boolean;
  isBookmarked: boolean;
  onClose: () => void;
  onMarkComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatCitations, setChatCitations] = useState<{ title: string; content: string }[]>([]);

  /* offline reply — fully local, NO API calls. Synthesizes from case study data + RAG hits */
  const offlineReply = async (query: string): Promise<{ text: string; citations: { title: string; content: string }[] }> => {
    const hits = await lexicalSearch(`${c.title} ${query}`, 5).catch(() => []);
    let citations: { title: string; content: string }[] = [];
    if (hits.length) {
      const titles = await documentTitles().catch(() => new Map<number, string>());
      citations = hits.map(h => ({ title: titles.get(h.documentId) ?? "Knowledge base", content: h.content }));
    }
    const q = query.toLowerCase();
    const lines: string[] = [];
    lines.push(`**${c.icon} ${c.title}** — ${c.blurb}\n`);
    if (/overview|explain|architecture|how|walkthrough/.test(q)) {
      lines.push("**Architecture Overview:**");
      c.phases.forEach((p, i) => {
        lines.push(`\n**Phase ${i + 1}: ${p.phase}** (${p.duration})`);
        p.talkingPoints.forEach(tp => lines.push(`→ ${tp}`));
        if (p.numbers?.length) lines.push(`  📐 ${p.numbers.join(" · ")}`);
      });
    } else if (/trade.?off|vs|compare/.test(q)) {
      lines.push("**Key Trade-offs:**");
      lines.push("→ Performance vs consistency vs cost — always name the axis");
      lines.push(`→ During high-level design, discuss: ${c.phases[1]?.talkingPoints.slice(0, 2).join(" vs ")}`);
      lines.push("→ Start simple, add complexity only when scale demands it");
    } else if (/mistake|error|wrong|pitfall/.test(q)) {
      lines.push("**Common Mistakes:**");
      c.commonMistakes.forEach(m => lines.push(`⚠️ ${m}`));
    } else if (/scale|million|throughput|latency/.test(q)) {
      lines.push("**Scale & Numbers:**");
      c.keyNumbers.forEach(n => lines.push(`📐 ${n}`));
    } else if (/number|memorize|remember/.test(q)) {
      lines.push("**Numbers to Memorize:**");
      c.keyNumbers.forEach(n => lines.push(`🔢 ${n}`));
    } else if (/phase|step|whiteboard|interview/.test(q)) {
      lines.push("**Whiteboard Phases:**");
      c.phases.forEach((p, i) => {
        lines.push(`\n**${i + 1}. ${p.phase}** (${p.duration})`);
        p.talkingPoints.forEach(tp => lines.push(`   → ${tp}`));
      });
    } else {
      lines.push(c.blurb);
      lines.push(`\n**Prerequisites:** ${c.prerequisites.join(", ")}`);
      lines.push(`**Key numbers:** ${c.keyNumbers.join("; ")}`);
      lines.push("\n💡 Ask about architecture, trade-offs, mistakes, scale, or whiteboard phases.");
      lines.push("\n🌐 **Need more details?** For topics I don't cover yet, try searching online or switch to 🤖 AI mode (requires API key).",);
    }
    if (c.followUpTopics.length) lines.push(`\n**Related:** ${c.followUpTopics.join(" · ")}`);
    if (citations.length) {
      lines.push(`\n\n---\n📚 **From knowledge base:**`);
      citations.forEach(ct => lines.push(`• [${ct.title}] ${ct.content.slice(0, 200)}…`));
    }
    return { text: lines.join("\n"), citations };
  };

  const handleExplain = async () => {
    if (!goal && !aiAvailable()) {
      /* offline mode — no goal needed */
    } else if (!goal) { toast("Set a career goal in Roadmap first"); return; }
    setAiLoading(true);
    try {
      if (aiAvailable() && goal) {
        const reply = await explainSystemDesign(c.title, goal);
        setAiResult(reply);
      } else {
        const { text } = await offlineReply(`Explain the system design for "${c.title}" — architecture overview, key trade-offs, failure modes, and a 2-minute whiteboard summary.`);
        setAiResult(text);
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI unavailable"));
    } finally { setAiLoading(false); }
  };

  const handleChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChatInput("");
    const userMsg = { role: "user" as const, content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatBusy(true);
    setChatCitations([]);
    try {
      if (aiAvailable() && goal) {
        const history = [...chatMessages, userMsg];
        const reply = await systemDesignChat(c.title, goal, history);
        setChatMessages(prev => [...prev, { role: "assistant", content: reply.text }]);
        if (reply.citations?.length) setChatCitations(reply.citations.map(c => ({ title: c.title, content: c.content })));
      } else {
        const { text, citations } = await offlineReply(msg);
        setChatMessages(prev => [...prev, { role: "assistant", content: text }]);
        setChatCitations(citations);
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI unavailable"));
    } finally { setChatBusy(false); }
  };

  return (
    <Drawer onClose={onClose} title={`${c.icon} ${c.title}`} desc={`${c.blurb}`}>
      {/* Actions row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DifficultyDots level={c.difficulty} />
        <span className="text-[13px] font-bold text-mut">Difficulty {c.difficulty}/5</span>
        <Chip tone="cat">{c.category}</Chip>
        {isCompleted && <Chip tone="ok">✓ Completed</Chip>}
        {!isCompleted && (
          <button onClick={() => onMarkComplete(c.id)} className="rounded-lg border border-ok/50 bg-ok/15 px-3 py-1 text-[12px] font-bold text-ok transition-all hover:bg-ok/25">
            ✓ Mark as done
          </button>
        )}
        <button
          onClick={() => onToggleBookmark(c.id)}
          className={`rounded-lg border px-3 py-1 text-[12px] font-bold transition-all ${isBookmarked ? "border-amber-500/50 bg-amber-500/15 text-amber-400" : "border-line/15 bg-wht/5 text-mut hover:border-amber-500/50 hover:text-amber-400"}`}
        >
          {isBookmarked ? "🔖 Bookmarked" : "🏷️ Bookmark"}
        </button>
      </div>

      {c.keyNumbers.length > 0 && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">🔢 Numbers to Memorize</div>
          <ul className="space-y-1">
            {c.keyNumbers.map((n, i) => (
              <li key={i} className="flex gap-2 text-[13px]"><span className="flex-none text-acctxt font-mono">•</span><span className="text-ink">{n}</span></li>
            ))}
          </ul>
        </div>
      )}

      {c.prerequisites.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-mut">📚 Prerequisites — tap to learn</div>
          <div className="flex flex-wrap gap-1.5">
            {c.prerequisites.map(p => (
              <button
                key={p}
                onClick={() => {
                  const explanation = getPrereqExplanation(p, c.id);
                  if (explanation) {
                    const lines = [`📘 **${p}** — in the context of ${c.title}\n`];
                    lines.push(`🟢 **Beginner:**\n${explanation.beginner}\n`);
                    lines.push(`🟡 **Intermediate:**\n${explanation.intermediate}\n`);
                    lines.push(`🔴 **Advanced:**\n${explanation.advanced}\n`);
                    if (explanation.context) lines.push(`📌 **In this system:**\n${explanation.context}`);
                    const userMsg = { role: "user" as const, content: `Tell me about ${p} in the context of ${c.title}` };
                    const assistantMsg = { role: "assistant" as const, content: lines.join("\n") };
                    setChatMessages(prev => [...prev, userMsg, assistantMsg]);
                    setChatCitations([{ title: `${p} — ${c.title}`, content: explanation.context ?? explanation.beginner }]);
                  } else {
                    const q = `Explain ${p} from beginner to advanced in the context of ${c.title}. How is ${p} used in this system? What should I know for the interview?`;
                    setChatInput(q);
                    const userMsg = { role: "user" as const, content: q };
                    setChatMessages(prev => [...prev, userMsg]);
                    setChatBusy(true);
                    setChatCitations([]);
                    (async () => {
                      try {
                        if (aiAvailable() && goal) {
                          const history = [...chatMessages, userMsg];
                          const reply = await systemDesignChat(c.title, goal, history);
                          setChatMessages(prev => [...prev, { role: "assistant", content: reply.text }]);
                          if (reply.citations?.length) setChatCitations(reply.citations.map(ct => ({ title: ct.title, content: ct.content })));
                        } else {
                          const { text, citations } = await offlineReply(q);
                          setChatMessages(prev => [...prev, { role: "assistant", content: text }]);
                          setChatCitations(citations);
                        }
                      } catch (e) {
                        toast("✗ " + ((e as Error).message || "AI unavailable"));
                      } finally { setChatBusy(false); }
                    })();
                  }
                }}
                className="cursor-pointer rounded-full border border-acc1/25 bg-acc1/10 px-2.5 py-1 text-[12px] font-semibold text-acctxt transition-all hover:border-acc1/50 hover:bg-acc1/20 hover:shadow-[0_2px_8px_rgba(99,102,241,.2)]"
              >
                📘 {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">📋 Whiteboard Flow</div>
        <div className="space-y-3">
          {c.phases.map((phase, i) => <WhiteboardPhase key={i} phase={phase} index={i} />)}
        </div>
      </div>

      {c.commonMistakes.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common Mistakes</div>
          <ul className="space-y-1.5">
            {c.commonMistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px]"><span className="flex-none text-warn">•</span><span>{m}</span></li>
            ))}
          </ul>
        </div>
      )}

      {c.followUpTopics.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-mut">🔗 Related Topics</div>
          <div className="flex flex-wrap gap-1.5">
            {c.followUpTopics.map(t => (
              <span key={t} className="rounded-full border border-acc1/30 bg-acc1/10 px-2.5 py-1 text-[12px] font-bold text-acctxt">{t}</span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line/10 bg-deep/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-bold uppercase tracking-wider text-mut">✨ AI System Design Tutor</span>
            <div className="flex items-center gap-2">
              {!aiAvailable() && <span className="text-[10.5px] font-bold text-mut">📚 Offline RAG</span>}
              <button className={btnGhost + btnSm} onClick={handleExplain} disabled={aiLoading}>
                {aiLoading ? "Explaining…" : "Explain this design"}
              </button>
            </div>
          </div>
          {!aiAvailable() && <div className="mb-2"><GroundingNote minSim={ragTuningInfo().minSim} pool={ragTuningInfo().pool} /></div>}
          {aiResult && (
            <div className="mb-3 whitespace-pre-wrap rounded-lg border border-line/10 bg-wht/5 p-3 text-[13px] leading-relaxed text-ink">{aiResult}</div>
          )}
          {chatMessages.length > 0 && (
            <div className="mb-3 space-y-2">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  {m.role === "user" && <div className="mb-0.5 text-right text-[10px] font-bold text-mut">You asked:</div>}
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "grad-bg text-white" : "border border-line/10 bg-wht/10 text-ink"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          {chatCitations.length > 0 && (
            <div className="mb-2 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ok">📚 Grounded · {chatCitations.length} source(s) · term match</div>
              {chatCitations.map((ct, ci) => (
                <CitationChip key={ci} title={ct.title} content={ct.content} source="knowledge-base" />
              ))}
            </div>
          )}
          {chatBusy && <p className="mb-2 text-[12.5px] text-fnt">…thinking</p>}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); handleChat(); }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about this design…"
              className="min-w-0 flex-1 rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20" />
            <button type="submit" className={btnPrimary + btnSm} disabled={chatBusy || !chatInput.trim()}>Send</button>
          </form>
        </div>

      <DeepDiveBlock title={c.title} />
    </Drawer>
  );
}