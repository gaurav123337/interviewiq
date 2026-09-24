/* SourcesPage — the public "Sources & credits" page (Phase 4 Item D4).
   Renders the aggregated, APPROVED-only attribution feed from the discovery
   engine (discovered_resources_public view) plus the static provenance notes.
   All strings render as escaped plain text (resource-safety-guard L0/L5);
   every external link is rel="noopener noreferrer". */

import { useEffect, useState } from "react";
import { useApp } from "../store";
import { discoveryCredits, type DiscoveryCredits } from "../services/discovery";
import { cardCls, Chip } from "./ui";

export function SourcesPage() {
  const { nav } = useApp();
  const [credits, setCredits] = useState<DiscoveryCredits>({ sources: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void discoveryCredits()
      .then(setCredits)
      .catch(() => setCredits({ sources: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="anim-view mx-auto w-full max-w-[820px] space-y-4">
      <div className={`${cardCls} p-6`}>
        <h1 className="text-[22px] font-extrabold tracking-tight">🤝 Sources & credits</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-fnt">
          InterviewIQ stands on the work of open communities. Every community-discovered link below was
          reviewed by a human before it appeared here, and its origin is attributed to the source it came from.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="lvl">{credits.total} attributed link{credits.total === 1 ? "" : "s"}</Chip>
          <Chip tone="lvl">{credits.sources.length} source{credits.sources.length === 1 ? "" : "s"}</Chip>
        </div>
      </div>

      <div className={`${cardCls} p-6`}>
        <h2 className="text-[16px] font-extrabold">Community-discovered resources</h2>
        {loading ? (
          <p className="mt-2 text-[13px] text-mut">Loading…</p>
        ) : credits.sources.length === 0 ? (
          <p className="mt-2 text-[13px] text-mut">No attributed resources yet — approved finds appear here automatically.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {credits.sources.map(s => (
              <li key={`${s.source}|${s.url}`} className="rounded-xl border border-line/10 bg-wht/[.03] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold text-ink">
                    {s.owner && s.repo ? `${s.owner}/${s.repo}` : s.source}
                  </span>
                  <Chip tone="cat">{s.kind}</Chip>
                  {s.topic && <Chip>topic: {s.topic}</Chip>}
                  {s.license && s.license !== "unknown" && s.license !== "no-license" ? (
                    <Chip tone="ok">📜 {s.license}</Chip>
                  ) : (
                    <Chip tone="warn">license unverified</Chip>
                  )}
                  {s.count > 1 && <Chip tone="lvl">{s.count} link{s.count === 1 ? "" : "s"}</Chip>}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="ml-auto truncate text-[11.5px] text-acc hover:underline">
                      {s.url} ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${cardCls} p-6`}>
        <h2 className="text-[16px] font-extrabold">How content is sourced</h2>
        <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-fnt">
          <li className="flex gap-2">
            <span className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-acc3/70" />
            <span><span className="font-bold text-ink">Static core bank</span> — original questions written by the InterviewIQ team.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-acc3/70" />
            <span><span className="font-bold text-ink">Scraped drafts</span> — public pages are parsed for titles/topics only (metadata, never verbatim bodies); AI-cleaned answers are original.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-acc3/70" />
            <span><span className="font-bold text-ink">Community discoveries</span> — links found by the discovery crawler, surfaced only after admin review, attributed to their source and license.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-acc3/70" />
            <span><span className="font-bold text-ink">Takedowns</span> — rightsholders can request removal; taken-down content is suppressed from every pipeline. See the <button className="font-bold text-acc hover:underline" onClick={() => { window.location.hash = "terms"; nav("legal"); }}>Terms</button>.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
