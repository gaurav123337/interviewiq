import { type RemoteConfig } from "../../../services/remoteConfig";
import { cardCls, NumField, Switch } from "../../ui";

interface RagRetrievalCardProps {
  config: RemoteConfig;
  setConfig: (c: RemoteConfig) => void;
}

export function RagRetrievalCard({ config, setConfig }: RagRetrievalCardProps) {
  const setRag = (k: keyof NonNullable<RemoteConfig["rag"]>, v: number) =>
    setConfig({ ...config, rag: { ...config.rag, [k]: v } });
  const setRagDigest = (k: keyof NonNullable<NonNullable<RemoteConfig["rag"]>["digest"]>, v: number | string | boolean) =>
    setConfig({ ...config, rag: { ...config.rag, digest: { ...config.rag?.digest, [k]: v } } });

  return (
    <>
      {/* RAG retrieval */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🗄️ RAG retrieval</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          How strictly the tutor/coach ground answers in the knowledge base. A higher similarity cutoff means
          fewer (but safer) citations — answers then come from general knowledge and say so. The candidate pool is
          how many vector hits the hybrid re-ranker considers. The hard floor is the similarity at which a chunk is
          cited even with zero shared concepts — the escape hatch when the concept gate is too strict.
          Clients pick these up on next sync.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label={`Grounding similarity cutoff (0.30–0.80) — current ${config.rag?.minSim ?? 0.45}`}
            value={config.rag?.minSim ?? 0.45} step={0.01}
            onChange={v => setRag("minSim", Math.max(0.1, Math.min(0.95, v)))}
          />
          <NumField
            label={`Vector candidate pool (4–50) — current ${config.rag?.candidatePool ?? 24}`}
            value={config.rag?.candidatePool ?? 24} step={1}
            onChange={v => setRag("candidatePool", Math.max(2, Math.min(50, Math.round(v))))}
          />
          <NumField
            label={`Hard floor, concept-free cite (0.80–0.95) — current ${config.rag?.hardFloor ?? 0.85}`}
            value={config.rag?.hardFloor ?? 0.85} step={0.01}
            onChange={v => setRag("hardFloor", Math.max(0.7, Math.min(0.99, v)))}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-fnt">
          💡 Preview the effect on real retrieval events in <span className="font-bold">Quality → 🛰️ RAG health</span> before publishing.
        </p>
      </div>

      {/* RAG digest alerts */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🔔 RAG digest alerts</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Every week the RAG health tab evaluates the last 7 days against these thresholds. A breach shows an
          in-app alert banner; if a delivery webhook is set (Slack incoming webhook or an email bridge), it is
          also delivered once per week. Published like the rest of the config.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label={`Alert when grounded rate below (%) — current ${config.rag?.digest?.minGroundedRate ?? 60}`}
            value={config.rag?.digest?.minGroundedRate ?? 60} step={1}
            onChange={v => setRagDigest("minGroundedRate", Math.max(0, Math.min(100, Math.round(v))))}
          />
          <NumField
            label={`Alert when empty-hit rate above (%) — current ${config.rag?.digest?.maxEmptyRate ?? 40}`}
            value={config.rag?.digest?.maxEmptyRate ?? 40} step={1}
            onChange={v => setRagDigest("maxEmptyRate", Math.max(0, Math.min(100, Math.round(v))))}
          />
          <NumField
            label={`Alert when gate rejects above — current ${config.rag?.digest?.maxGateRejects ?? 10}`}
            value={config.rag?.digest?.maxGateRejects ?? 10} step={1}
            onChange={v => setRagDigest("maxGateRejects", Math.max(0, Math.round(v)))}
          />
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[12px] font-bold text-mut">
            Delivery webhook URL (Slack / email bridge) — {config.rag?.digest?.webhook ? "set" : "not set"}
          </span>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={config.rag?.digest?.webhook ?? ""}
            onChange={e => setRagDigest("webhook", e.target.value)}
            className="inp w-full"
          />
        </label>
        <p className="mt-2 text-[11.5px] text-fnt">
          💡 Leave the webhook empty for in-app alerts only — the banner shows whenever an alert fires.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
            <Switch
              checked={config.rag?.digest?.sendWeekly ?? false}
              onChange={v => setRagDigest("sendWeekly", v)}
            />
            Send the full weekly digest (not just breaches) once per week
          </label>
          <span className="text-[11px] text-mut">— delivered to the webhook each Monday with metrics, top queries and top documents.</span>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[12px] font-bold text-mut">
            Digest recipients (emails the bridge should mail) — {config.rag?.digest?.email ? "set" : "not set"}
          </span>
          <input
            type="text"
            placeholder="ops@company.com, you@company.com"
            value={config.rag?.digest?.email ?? ""}
            onChange={e => setRagDigest("email", e.target.value)}
            className="inp w-full"
          />
        </label>
        <p className="mt-1 text-[11.5px] text-fnt">
          Passed to the bridge as <span className="font-mono">to</span> — point the webhook at an email bridge (e.g. Zapier → Gmail) to receive the digest by mail.
        </p>
        <div className="mt-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
              <Switch
                checked={config.rag?.digest?.nativeEmail ?? false}
                onChange={v => setRagDigest("nativeEmail", v)}
              />
              📧 Native email — send via the <span className="font-mono">send-rag-digest</span> Edge Function (no webhook)
            </label>
          </div>
          {config.rag?.digest?.nativeEmail && (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-bold text-mut">From address — {config.rag?.digest?.from ? "set" : "default InterviewIQ <digest@interviewiq.app>"}</span>
                <input
                  type="text"
                  placeholder="InterviewIQ <digest@interviewiq.app>"
                  value={config.rag?.digest?.from ?? ""}
                  onChange={e => setRagDigest("from", e.target.value)}
                  className="inp w-full"
                />
              </label>
              <p className="text-[11px] text-fnt">
                🔒 No secrets are stored in the browser — this digest is sent with your admin session and the
                <span className="font-mono"> RESEND_API_KEY</span> function secret (Supabase → Edge Functions → send-rag-digest → Secrets).
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
