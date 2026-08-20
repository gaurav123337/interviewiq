/* SkillExplorer — full-page "Learn a Skill" entry point.
   Search bar with instant results, browse by band/tag, and quick access
   to skill detail pages. */

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import { getAllRoadmaps, type SkillRoadmap, type SearchResult } from "../services/skillRoadmapService";
import { btnGhost, btnSm, cardCls, Chip } from "./ui";

const BANDS: SkillRoadmap["band"][] = ["junior", "mid", "senior", "staff", "principal", "cto"];
const BAND_LABELS: Record<string, string> = {
  junior: "Foundation", mid: "Core", senior: "Senior", staff: "Staff", principal: "Principal", cto: "CTO",
};
const POPULAR_SLUGS = ["java", "react", "system-design", "python", "kubernetes"];

function dots(d: number): string {
  return "●".repeat(d) + "○".repeat(3 - d);
}

export function SkillExplorer() {
  const { nav } = useApp();
  const [query, setQuery] = useState("");
  const [allRoadmaps, setAllRoadmaps] = useState<SkillRoadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBand, setSelectedBand] = useState<string>("all");

  useEffect(() => {
    void getAllRoadmaps().then(r => { setAllRoadmaps(r); setLoading(false); });
  }, []);

  const displayResults = useMemo<SearchResult[]>(() => {
    if (allRoadmaps.length === 0) return [];
    const q = query.toLowerCase().trim();

    if (!q) {
      return allRoadmaps
        .filter(r => selectedBand === "all" || r.band === selectedBand)
        .map(roadmap => ({ roadmap, matchScore: 50, matchType: "name" as const }));
    }

    // Synchronous search — searchRoadmaps just filters an array
    const filtered = allRoadmaps.filter(r => selectedBand === "all" || r.band === selectedBand);
    return filtered
      .map(roadmap => {
        let matchScore = 0;
        let matchType: SearchResult["matchType"] = "name";

        if (roadmap.slug === q) {
          matchScore = 100; matchType = "exact";
        } else if (roadmap.name.toLowerCase() === q) {
          matchScore = 95; matchType = "name";
        } else if (roadmap.name.toLowerCase().includes(q)) {
          matchScore = 80; matchType = "name";
        } else if (roadmap.aliases.some(a => a.toLowerCase() === q || a.toLowerCase().includes(q))) {
          matchScore = 60; matchType = "alias";
        } else if (roadmap.tags.some(t => t.toLowerCase().includes(q))) {
          matchScore = 40; matchType = "tag";
        } else if (roadmap.description.toLowerCase().includes(q)) {
          matchScore = 20; matchType = "description";
        }

        return { roadmap, matchScore, matchType };
      })
      .filter(r => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [query, allRoadmaps, selectedBand]);

  const popular = allRoadmaps.filter(r => POPULAR_SLUGS.includes(r.slug));

  return (
    <div className="anim-view mx-auto max-w-[980px]">
      {/* Header */}
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🔍 Learn a Skill</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">
          Your <span className="grad-text">learning roadmap</span>.
        </h1>
        <p className="mx-auto mt-2 max-w-[600px] text-[14.5px] text-mut">
          Pick a skill and get a clear, curated roadmap with prerequisites, ordered steps, and quality-checked resources.
        </p>
      </div>

      {/* Search */}
      <div className="mx-auto mt-6 max-w-[600px]">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to learn? (e.g. Java, React, System Design…)"
            className="w-full rounded-2xl border border-line/25 bg-deep/60 px-5 py-3.5 pl-12 text-[15px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px]">🔍</span>
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-0.5 text-[11px] text-mut hover:bg-wht/10"
              onClick={() => setQuery("")}
            >
              ✕ clear
            </button>
          )}
        </div>
      </div>

      {/* Popular skills (when no search) */}
      {!query && (
        <div className="mx-auto mt-4 flex max-w-[600px] flex-wrap justify-center gap-2">
          <span className="text-[12px] font-bold text-mut">Popular:</span>
          {popular.map(r => (
            <button
              key={r.slug}
              className="rounded-full border border-acc1/30 bg-acc1/10 px-3 py-1 text-[12.5px] font-bold text-acctxt transition-colors hover:bg-acc1/25"
              onClick={() => { localStorage.setItem("iq.learnSlug", r.slug); nav("learn-detail"); }}
            >
              {r.icon} {r.name}
            </button>
          ))}
        </div>
      )}

      {/* Band filter */}
      <div className="mx-auto mt-4 flex max-w-[800px] flex-wrap justify-center gap-2">
        <button
          className={`${btnGhost + btnSm} ${selectedBand === "all" ? "ring-2 ring-acc1/50" : ""}`}
          onClick={() => setSelectedBand("all")}
        >
          All
        </button>
        {BANDS.map(b => (
          <button
            key={b}
            className={`${btnGhost + btnSm} ${selectedBand === b ? "ring-2 ring-acc1/50" : ""}`}
            onClick={() => setSelectedBand(b)}
          >
            {BAND_LABELS[b]}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-mut">
            <span className="spinner inline-block" /> Loading roadmaps…
          </div>
        ) : displayResults.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <div className="mb-3 text-[42px]">🔍</div>
            <p className="text-[14px] text-mut">No roadmaps found{query ? ` for "${query}"` : ""}</p>
            <p className="mt-1 text-[12px] text-fnt">Try a different search or browse all skills</p>
          </div>
        ) : (
          displayResults.map(({ roadmap: r }) => (
            <button
              key={r.id}
              className={`${cardCls} p-5 text-left transition-all hover:border-acc1/40 hover:bg-wht/[.06] group`}
              onClick={() => { localStorage.setItem("iq.learnSlug", r.slug); nav("learn-detail"); }}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-acc1/10 text-[22px] group-hover:bg-acc1/20 transition-colors">{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-extrabold">{r.name}</span>
                    <span className="text-[12px] text-fnt">{dots(r.difficulty)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-mut line-clamp-2">{r.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip>{BAND_LABELS[r.band]}</Chip>
                    <Chip>~{r.estimatedHours}h</Chip>
                    <Chip>{r.resources.length} resources</Chip>
                    {r.tier === "pro" && <Chip tone="warn">🔒 Pro</Chip>}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="pb-8 pt-6 text-center text-[12px] text-fnt">
        {allRoadmaps.length} skill roadmaps available · Quality-checked by our team
      </div>
    </div>
  );
}
