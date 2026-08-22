import { useEffect, useState } from 'react';
import { getDeepDive } from '../../data/deepDive';
import { aiAvailable } from '../../ai';
import { documentTitles, ragTuningInfo } from '../../services/rag';
import { type RoadmapTopic } from '../../services/roadmap';
import type { TutorMsg } from '../../services/tutor';
import { GroundingNote } from '../GroundingNote';
import { CitationChip } from '../CitationChip';
import { btnGhost, btnPrimary, btnSm, Drawer } from '../ui';

export function LearnModal({ topic, aiLoading, chat, chatBusy, proGated, onClose, onExplain, onAsk, onUpgrade, topics, onRelated }: {
  topic: RoadmapTopic | null;
  aiLoading: boolean;
  chat: TutorMsg[];
  chatBusy: boolean;
  proGated: boolean;
  onClose: () => void;
  onExplain: () => void;
  onAsk: (t: RoadmapTopic, text: string) => void;
  onUpgrade: () => void;
  topics: RoadmapTopic[];
  onRelated: (t: RoadmapTopic) => void;
}) {
  const [ask, setAsk] = useState("");
  /* indexed-document count for the grounding note (one public read per mount) */
  const [kbDocs, setKbDocs] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    documentTitles().then(m => { if (on) setKbDocs(m.size); }).catch(() => { if (on) setKbDocs(null); });
    return () => { on = false; };
  }, []);
  const tuning = ragTuningInfo();
  if (!topic) return null;
  const dd = getDeepDive(topic.label);
  const related = (dd.related ?? [])
    .map(label => topics.find(t => t.label.toLowerCase() === label.toLowerCase()))
    .filter((t): t is RoadmapTopic => !!t);
  return (
    <Drawer onClose={onClose} title={`📖 ${topic.label}`} desc={topic.practice ? `Practice topic · ${topic.priority} priority` : `Learning topic · ${topic.priority} priority`}>
      <p className="mb-4 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{topic.info.primer}</p>

      {/* curated concepts */}
      {dd.concepts.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-acc3">Core concepts</div>
          <div className="space-y-1.5">
            {dd.concepts.map(c => (
              <div key={c.name} className="rounded-lg border border-line/10 bg-wht/5 px-3 py-2">
                <div className="text-[13px] font-bold">{c.name}</div>
                <div className="text-[12.5px] leading-relaxed text-mut">{c.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* key points to mention */}
      {dd.points.length > 0 && (
        <div className="mb-4 rounded-xl border border-ok/25 bg-ok/10 p-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-ok">✅ Say this in your answer</div>
          <ul className="space-y-1.5 text-[13px] leading-relaxed">
            {dd.points.map(p => <li key={p} className="flex gap-2"><span className="flex-none text-ok">✓</span><span>{p}</span></li>)}
          </ul>
        </div>
      )}

      {/* common traps */}
      {dd.traps.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common traps</div>
          <ul className="space-y-1.5 text-[13px] leading-relaxed">
            {dd.traps.map(t => <li key={t} className="flex gap-2"><span className="flex-none text-warn">⚠</span><span>{t}</span></li>)}
          </ul>
        </div>
      )}

      {/* interview Q&A */}
      {dd.qa.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-acc3">🎯 Interview Q&A</div>
          <div className="space-y-2">
            {dd.qa.map((qa, i) => (
              <details key={i} className="group rounded-lg border border-line/15 bg-wht/5">
                <summary className="cursor-pointer px-3 py-2 text-[13px] font-bold text-acctxt">Q{i + 1}. {qa.q}</summary>
                <div className="border-t border-line/10 px-3 py-2 text-[12.5px] leading-relaxed text-mut">{qa.a}</div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* related topics */}
      {related.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-mut">🔗 Related topics</div>
          <div className="flex flex-wrap gap-2">
            {related.map(t => (
              <button key={t.id} onClick={() => onRelated(t)} className="rounded-full border border-acc1/40 bg-acc1/15 px-3 py-1 text-[12.5px] font-bold text-acctxt transition-colors hover:bg-acc1/30">
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* architecture case studies (system design topics) */}
      {(() => {
        const archs = (dd as { architectures?: { name: string; blurb: string; components: string[]; tradeoffs: string[]; scaleNotes: string; failureModes: string[]; followUpQa: { q: string; a: string }[] }[] }).architectures;
        if (!archs?.length) return null;
        return (
          <div className="mb-4">
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-acc3">🏗️ Architecture Case Studies</div>
            <div className="space-y-3">
              {archs.map(arch => (
                <details key={arch.name} className="group rounded-xl border border-line/15 bg-wht/5">
                  <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-bold text-acctxt">
                    {arch.name}
                  </summary>
                  <div className="border-t border-line/10 px-4 py-3 space-y-3">
                    <p className="text-[13px] text-ink leading-relaxed">{arch.blurb}</p>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Components</div>
                      {arch.components.map((c, i) => (
                        <div key={i} className="mt-1 font-mono text-[12px] text-fnt bg-deep/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{c}</div>
                      ))}
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-warn">⚖️ Trade-offs</div>
                      <ul className="mt-1 space-y-1">
                        {arch.tradeoffs.map((t, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px]">
                            <span className="flex-none text-warn">•</span><span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg border border-acc1/25 bg-acc1/10 px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">📐 Scale Notes</div>
                      <p className="mt-1 text-[12.5px] text-ink">{arch.scaleNotes}</p>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-bad">💥 Failure Modes</div>
                      <ul className="mt-1 space-y-1">
                        {arch.failureModes.map((f, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px]">
                            <span className="flex-none text-bad">•</span><span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {arch.followUpQa.length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">🎯 Follow-up Questions</div>
                        <div className="mt-1 space-y-2">
                          {arch.followUpQa.map((qa, i) => (
                            <details key={i} className="group rounded-lg border border-line/15 bg-deep/50">
                              <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-acctxt">
                                Q{i + 1}. {qa.q}
                              </summary>
                              <div className="border-t border-line/10 px-3 py-2 text-[12px] leading-relaxed text-mut">
                                {qa.a}
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        );
      })()}

      {topic.practice && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-acc3">Practice question</div>
          <p className="mb-2 text-[13.5px] font-bold leading-snug">{topic.practice.q}</p>
          <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-mut">Model answer</div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{topic.practice.a}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {topic.info.links.map(l => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-lg border border-acc1/40 bg-acc1/15 px-3 py-1.5 text-[12.5px] font-bold text-acctxt hover:bg-acc1/30">
            ↗ {l.label}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-line/10 bg-deep/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-mut">✨ AI tutor</span>
          {aiAvailable() && (
            <button className={btnGhost + btnSm} onClick={onExplain} disabled={aiLoading}>Explain it to me</button>
          )}
        </div>
        <div className="mb-2">
          <GroundingNote minSim={tuning.minSim} pool={tuning.pool} docs={kbDocs} />
        </div>
        {aiLoading && <p className="text-[13.5px] text-ink"><span className="spinner" />Explaining…</p>}

        {/* conversation thread */}
        {chat.length > 0 && (
          <div className="mb-3 max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
            {chat.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "grad-bg text-white" : "border border-line/10 bg-wht/10 text-ink"}`}>
                  {m.content}
                </div>
                {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                  <div className="mt-1 max-w-[90%] space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ok">
                      📚 Grounded · {m.citations!.length} source{m.citations!.length > 1 ? "s" : ""}
                    </div>
                    {m.citations!.map((c, ci) => (
                      <CitationChip key={ci} title={c.title} content={c.content} />
                    ))}
                  </div>
                )}
                {m.role === "assistant" && m.checked && !m.grounded && (m.citations?.length ?? 0) === 0 && (
                  <div className="mt-1 max-w-[90%]">
                    <span className="rounded-full border border-line/15 bg-deep/60 px-2 py-0.5 text-[10px] font-bold text-fnt" title="Retrieval ran but found no strong knowledge-base match">
                      🧠 General knowledge — no knowledge-base match
                    </span>
                  </div>
                )}
              </div>
            ))}
            {chatBusy && <p className="text-[12.5px] text-fnt"><span className="spinner" />Thinking…</p>}
          </div>
        )}

        {proGated ? (
          <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-[12.5px] text-warn">
            🔒 The AI tutor chat is a Pro feature — <button className="font-bold underline" onClick={onUpgrade}>upgrade</button> to ask follow-up questions about any topic.
          </div>
        ) : aiAvailable() ? (
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              const text = ask.trim();
              if (!text || chatBusy) return;
              onAsk(topic, text);
              setAsk("");
            }}
          >
            <input
              value={ask}
              onChange={e => setAsk(e.target.value)}
              placeholder="Ask a follow-up about this topic…"
              className="min-w-0 flex-1 rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
            />
            <button type="submit" className={btnPrimary + btnSm} disabled={chatBusy || !ask.trim()}>Send</button>
          </form>
        ) : (
          <p className="text-[12.5px] text-fnt">Add an AI key in Settings for generative explanations — the primer above works fully offline.</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
    </Drawer>
  );
}
