import { useEffect, useState } from "react";
import { useApp } from "../store";
import { POLICY_META, type PolicyId } from "../data/policies";
import { getPolicyDoc } from "../services/policies";
import { cardCls, Chip } from "./ui";

/* Tiny markdown-ish renderer for the policy bodies:
   "## " headings, "- " bullet blocks, **bold** inline, paragraphs. */
function renderBlock(block: string): React.ReactNode {
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  if (lines[0].startsWith("## ")) {
    return <h2 className="mt-6 text-[17px] font-extrabold tracking-tight first:mt-0">{lines[0].slice(3)}</h2>;
  }
  if (lines.every(l => l.startsWith("- "))) {
    return (
      <ul className="mt-2 space-y-1.5 pl-1">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-fnt before:mt-[7px] before:h-[5px] before:w-[5px] before:flex-none before:rounded-full before:bg-acc3/70">
            <span>{inline(l.slice(2))}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-2 text-[13.5px] leading-relaxed text-fnt">{inline(lines.join(" "))}</p>;
}

function inline(text: string): React.ReactNode {
  const parts = text.split("**");
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-extrabold text-ink">{p}</strong> : <span key={i}>{p}</span>));
}

export function Legal() {
  const { nav } = useApp();
  const fromHash = (): PolicyId => {
    const h = window.location.hash.replace("#", "") as PolicyId;
    return POLICY_META.some(m => m.id === h) ? h : "terms";
  };
  const [docId, setDocId] = useState<PolicyId>(fromHash);

  useEffect(() => {
    const onHash = () => setDocId(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: PolicyId) => {
    window.location.hash = id;
    setDocId(id);
    window.scrollTo({ top: 0 });
  };

  const meta = POLICY_META.find(m => m.id === docId)!;
  const body = getPolicyDoc(docId);
  const blocks = body.split(/\n{2,}/);

  return (
    <div className="anim-view mx-auto w-full max-w-[820px]">
      {/* header + doc switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-acc3">Legal</span>
          <h1 className="mt-1 text-[clamp(22px,4vw,30px)] font-extrabold tracking-tight">
            {meta.icon} {meta.title}
          </h1>
          <p className="mt-1 text-[12.5px] text-mut">{meta.blurb} · Updated {meta.updatedAt}</p>
        </div>
        <button className="rounded-xl border border-line/15 bg-wht/10 px-3.5 py-1.5 text-[12.5px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink" onClick={() => nav("landing")}>
          ← Back to home
        </button>
      </div>

      {/* compliance banner — these pages satisfy payment-provider requirements */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-2.5 text-[12px] text-fnt">
        <span className="font-extrabold text-ok">✓</span>
        <span>All four required pages are published — Terms, Privacy, Refund &amp; Cancellation, and Shipping. This satisfies the payment-provider requirement for accepting payments (including international cards).</span>
      </div>

      {/* doc tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {POLICY_META.map(m => (
          <button
            key={m.id}
            onClick={() => pick(m.id)}
            className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-all ${docId === m.id ? "grad-bg-soft border border-acc1/40 text-acctxt" : "border border-line/15 bg-wht/10 text-mut hover:bg-wht/20 hover:text-ink"}`}
          >
            {m.icon} {m.title}
          </button>
        ))}
      </div>

      {/* document */}
      <div className={`${cardCls} mt-4 p-6 sm:p-8`}>
        {blocks.map((b, i) => <div key={i}>{renderBlock(b)}</div>)}
        <div className="mt-8 border-t border-line/10 pt-4 text-[11.5px] text-mut">
          <Chip tone="ok">EFFECTIVE {meta.updatedAt}</Chip>
          <span className="ml-2">© {new Date().getFullYear()} InterviewIQ. Questions? <span className="font-bold text-ink">gaurav.123337@gmail.com</span></span>
        </div>
      </div>
    </div>
  );
}
