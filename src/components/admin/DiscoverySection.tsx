/* DiscoverySection — Phase 4 Item D4. The admin gate for the discovery
   engine: "Discover from URL" (classify preview → pending seed), the seed
   approval queue (approval = crawl trigger), and the resource approval
   queue (nothing surfaces publicly without a recorded decision).
   Fail-closed, resource-safety-guard-aligned: approvals are explicit,
   never automatic; no-license rows are marked for a licensing decision. */

import { useEffect, useState } from "react";
import {
  addManualSeed, classifyUrlPreview, decideResource, decideSeed,
  discoveryCredits, listDiscoveredResources, listDiscoverySeeds,
  type DiscoveredResourceRow, type DiscoveryCredits, type DiscoverySeed, type SeedKind
} from "../../services/discovery";
import { toast } from "../../toast";
import { btnOk, btnGhost, btnDanger, btnSm, cardCls, Chip } from "../ui";

const KIND_ICON: Record<SeedKind, string> = {
  "github-topic": "🐙",
  "github-repo": "📦",
  "github-search": "🔎",
  "json": "🧾",
  "sitemap": "🗺️",
  "html": "🌐"
};

type StatusFilter = "" | "pending" | "approved" | "rejected";

function LicenseChip({ license, review }: { license: string; review?: boolean }) {
  if (review || license === "no-license" || license === "unknown") {
    return <Chip tone="warn">⚠ {review ? "needs license review" : license}</Chip>;
  }
  return <Chip tone="ok">📜 {license}</Chip>;
}

function AttributionChips({ a }: { a: DiscoveredResourceRow["attribution"] }) {
  const bits: string[] = [];
  if (a.owner && a.repo) bits.push(`${a.owner}/${a.repo}`);
  if (a.topic) bits.push(`topic: ${a.topic}`);
  if (!bits.length && a.url) bits.push(a.url);
  if (!bits.length) return null;
  return <span className="truncate text-[11.5px] text-fnt">{bits.join(" · ")}</span>;
}

export function DiscoverySection() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof classifyUrlPreview> | null>(null);
  const [seeds, setSeeds] = useState<DiscoverySeed[]>([]);
  const [resources, setResources] = useState<DiscoveredResourceRow[]>([]);
  const [credits, setCredits] = useState<DiscoveryCredits>({ sources: [], total: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"seeds" | "resources">("seeds");

  const load = async () => {
    setBusy(true);
    try {
      const [s, r, cr] = await Promise.all([
        listDiscoverySeeds(statusFilter || undefined),
        listDiscoveredResources(statusFilter ? { status: statusFilter } : {}),
        discoveryCredits()
      ]);
      setSeeds(s); setResources(r); setCredits(cr);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load discovery data"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const onDecideSeed = async (s: DiscoverySeed, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      const res = await decideSeed(s.id, decision);
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't update")); return; }
      toast(decision === "approved"
        ? "✅ Seed approved — the next crawler run will crawl it"
        : "🚫 Seed rejected");
      await load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't update"));
    } finally {
      setBusy(false);
    }
  };

  const onDecideResource = async (r: DiscoveredResourceRow, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      const res = await decideResource(r.id, decision, r.meta);
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't update")); return; }
      toast(decision === "approved"
        ? "✅ Approved — now visible on Sources & credits"
        : "🚫 Rejected");
      await load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't update"));
    } finally {
      setBusy(false);
    }
  };

  const submitSeed = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    try {
      const res = await addManualSeed(u);
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't queue the URL")); return; }
      toast("🔎 Queued as pending — approve it below to schedule the crawl");
      setUrl(""); setPreview(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------- Discover from URL ---------------- */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🔎 Discover from URL</h2>
        <p className="mt-0.5 max-w-[720px] text-[12.5px] text-mut">
          Queue a page for the discovery crawler. The preview runs the crawler's own classifier — what you
          see is what it will do. Nothing is crawled until you approve the seed below: <span className="font-bold">the approval gate is the crawl trigger</span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              const t = e.target.value.trim();
              setPreview(t ? classifyUrlPreview(t) : null);
            }}
            placeholder="https://github.com/topics/interview-questions"
            className="min-w-[280px] flex-1 rounded-lg border border-line/15 bg-deep/80 px-3 py-1.5 text-[13px] text-ink placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
          />
          <button className={btnOk + btnSm} disabled={busy || !url.trim()} onClick={() => void submitSeed()}>Queue seed</button>
        </div>
        {preview && (
          preview.ok ? (
            <div className="mt-3 rounded-xl border border-line/10 bg-deep/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="lvl">{KIND_ICON[preview.preview.kind]} {preview.preview.kind}</Chip>
                <span className="text-[12px] text-fnt">{preview.preview.url}</span>
                <Chip>attribution from {preview.preview.attributionSource}</Chip>
                {preview.preview.licenseCheck && <Chip tone="warn">license-checked</Chip>}
              </div>
              <ul className="mt-2 space-y-1 text-[12px] text-mut">
                {preview.preview.plan.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="font-mono text-acc3">{s.action}</span><span>{s.note}</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-warn">✗ {preview.error}</p>
          )
        )}
      </div>

      {/* ---------------- approval queues ---------------- */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold">🗂️ Discovery approval queue</h2>
            <p className="mt-0.5 text-[12.5px] text-mut">Seeds the crawler may start from · resources it found</p>
          </div>
          <div className="flex gap-2">
            <button className={tab === "seeds" ? btnOk + btnSm : btnGhost + btnSm} onClick={() => setTab("seeds")}>Seeds ({seeds.length})</button>
            <button className={tab === "resources" ? btnOk + btnSm : btnGhost + btnSm} onClick={() => setTab("resources")}>Resources ({resources.length})</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", ""] as const).map(s => (
            <button key={s || "all"} className={statusFilter === s ? btnOk + btnSm : btnGhost + btnSm} onClick={() => setStatusFilter(s)}>
              {s || "All"}
            </button>
          ))}
        </div>

        {busy ? (
          <p className="mt-4 text-[13px] text-mut">Loading…</p>
        ) : tab === "seeds" ? (
          <div className="mt-4 space-y-2">
            {seeds.length === 0 && <p className="text-[13px] text-mut">No {statusFilter || ""} seeds. Queue one above — nothing crawls until approved.</p>}
            {seeds.map(s => (
              <div key={s.id} className="rounded-xl border border-line/10 bg-deep/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="lvl">{KIND_ICON[s.kind]} {s.kind}</Chip>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate font-bold text-acctxt hover:underline">{s.url}</a>
                      <Chip>{s.status}</Chip>
                      {s.skill && <Chip tone="cat">🛠 {s.skill}</Chip>}
                      {s.origin === "skill-auto" && <Chip tone="warn">auto (D5)</Chip>}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-fnt">{s.originDetail} · {new Date(s.createdAt).toLocaleString()}{s.note ? ` · ${s.note}` : ""}</p>
                  </div>
                  {s.status === "pending" && (
                    <div className="flex flex-none gap-2">
                      <button className={btnOk + btnSm} disabled={busy} onClick={() => void onDecideSeed(s, "approved")}>✓ Approve</button>
                      <button className={btnDanger + btnSm} disabled={busy} onClick={() => void onDecideSeed(s, "rejected")}>✕ Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {resources.length === 0 && <p className="text-[13px] text-mut">No {statusFilter || ""} resources yet — approve seeds and run the crawler.</p>}
            {resources.map(r => (
              <div key={r.id} className="rounded-xl border border-line/10 bg-deep/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate font-bold text-acctxt hover:underline">{r.title}</a>
                      <Chip>{r.kind}</Chip>
                      <LicenseChip license={r.license} review={r.needsLicenseReview} />
                      {r.status === "approved" && <Chip tone="ok">public</Chip>}
                    </div>
                    <AttributionChips a={r.attribution} />
                    <p className="mt-0.5 text-[11.5px] text-fnt">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex flex-none gap-2">
                      <button className={btnOk + btnSm} disabled={busy} onClick={() => void onDecideResource(r, "approved")}>✓ Approve</button>
                      <button className={btnDanger + btnSm} disabled={busy} onClick={() => void onDecideResource(r, "rejected")}>✕ Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- credits summary ---------------- */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🤝 Credits</h2>
        <p className="mt-0.5 text-[12.5px] text-mut">Attribution shown on the public "Sources & credits" page ({credits.total} approved resource(s))</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {credits.sources.length === 0 && <p className="text-[13px] text-mut">No approved resources yet.</p>}
          {credits.sources.slice(0, 12).map(s => (
            <Chip key={`${s.source}|${s.url}`}>via {s.owner ? `${s.owner}/${s.repo}` : s.source} · {s.count}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
