/* Renders a shareable interview result card from a URL-encoded payload.
   The payload is a compact base64url JSON blob: no backend needed. */

import { btnGhost, btnPrimary, btnSm, cardCls } from "./ui";

interface ShareCat {
  label: string;
  pct: number;
}

interface SharePayload {
  id: string;
  date: string;
  meta: { field: string; company: string; level: string; mode: string };
  agg: { score: number; pct: number; grade: string };
  cats: ShareCat[];
}

export function decodeSharePayload(payload: string): SharePayload | null {
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as SharePayload;
  } catch {
    return null;
  }
}

export function encodeSharePayload(p: SharePayload): string {
  const json = JSON.stringify(p);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function ShareView({ payload }: { payload: string }) {
  const data = decodeSharePayload(payload);
  if (!data) {
    return (
      <div className="anim-view mx-auto max-w-[560px] pt-12 text-center">
        <div className={`${cardCls} px-6 py-14`}>
          <div className="mb-4 text-[48px]">❌</div>
          <h2 className="text-lg font-extrabold">Invalid share link</h2>
          <p className="mx-auto mt-2 max-w-[380px] text-sm text-mut">
            This share link doesn't contain valid result data. It may be corrupted or too old.
          </p>
        </div>
      </div>
    );
  }

  const { meta, agg, cats, date } = data;
  const pct = agg.pct;
  const gradeTone = agg.grade === "A" || agg.grade === "B" ? "ok" : agg.grade === "C" ? "warn" : "bad";
  const topCat = cats.slice().sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="anim-view mx-auto max-w-[640px]">
      <div className="overflow-hidden rounded-[22px] border border-line/10 bg-gradient-to-b from-panel to-panel2 p-7 text-center card-shadow">
        <div className="text-[48px]">🎯</div>

        <h1 className="mt-2 text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          <span className="grad-text">InterviewIQ</span> Result
        </h1>

        <div className="mx-auto mt-4 grid h-[100px] w-[100px] place-items-center rounded-full grad-bg shadow-[0_8px_28px_rgba(99,102,241,.35)]">
          <div className="text-center">
            <div className="text-[28px] font-extrabold leading-none text-white">{(pct * 100).toFixed(0)}%</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">Score</div>
          </div>
        </div>

        <div className={`mx-auto mt-3 w-fit rounded-full border px-4 py-1 text-sm font-extrabold ${
          gradeTone === "ok" ? "border-ok/40 bg-ok/10 text-ok" : gradeTone === "warn" ? "border-warn/40 bg-warn/10 text-warn" : "border-bad/40 bg-bad/10 text-bad"
        }`}>Grade {agg.grade}</div>

        <p className="mt-2 text-[14px] text-mut">
          {meta.company} · {meta.field} · {meta.level} · {meta.mode}
        </p>
        <p className="text-[12.5px] text-fnt">{date}</p>

        {/* stat grid */}
        <div className="mx-auto mt-5 grid max-w-[400px] grid-cols-2 gap-3">
          <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5">
            <div className="text-[20px] font-extrabold leading-tight">{agg.score.toFixed(1)}</div>
            <div className="text-[11.5px] font-semibold text-mut">Avg / 5</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5">
            <div className="text-[20px] font-extrabold leading-tight">{topCat ? (topCat.pct * 100).toFixed(0) + "%" : "—"}</div>
            <div className="text-[11.5px] font-semibold text-mut">Best: {topCat?.label ?? ""}</div>
          </div>
        </div>

        {/* category bars */}
        {cats.length > 0 && (
          <div className="mx-auto mt-5 max-w-[400px] space-y-2.5">
            {cats.map(c => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-[12.5px] font-semibold">
                  <span className="text-mut">{c.label}</span>
                  <span className="text-ink">{(c.pct * 100).toFixed(0)}%</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-wht/10">
                  <div className="h-full rounded-full grad-bg transition-all" style={{ width: `${Math.max(3, c.pct * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2.5 no-print">
          <button className={btnPrimary + btnSm} onClick={() => window.location.href = "/"}>
            Start your own interview →
          </button>
          <button className={btnGhost + btnSm} onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: "InterviewIQ result", url: window.location.href });
              else { await navigator.clipboard.writeText(window.location.href); alert("Link copied!"); }
            } catch { /* cancelled */ }
          }}>
            Share this result
          </button>
        </div>
      </div>
    </div>
  );
}