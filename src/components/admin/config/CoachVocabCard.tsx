import { useState } from "react";
import { type RemoteConfig } from "../../../services/remoteConfig";
import { toast } from "../../../toast";
import { cardCls, btnGhost, btnSm } from "../../ui";

interface CoachVocabCardProps {
  config: RemoteConfig;
  setConfig: (c: RemoteConfig) => void;
}

export function CoachVocabCard({ config, setConfig }: CoachVocabCardProps) {
  const [vocabJson, setVocabJson] = useState<string>(() => JSON.stringify(config.coachVocab ?? {}, null, 2));

  return (
    <div className={`${cardCls} p-5`}>
      <h2 className="mb-1 text-[16px] font-extrabold">🧠 Coach vocabulary</h2>
      <p className="mb-3 text-[12.5px] text-mut">
        Teach the offline tutor new concepts and misconception corrections without a deploy. JSON:
        <span className="font-mono"> {"{"} families: {"{"} family: ["word", "…"] {"}"}, misconceptions: [{"{"} re: "regex", correction: "…" {"}"}] {"}"} </span>
        Family words make answers match (e.g. <span className="font-mono">micro-frontend</span> ≈ splitting); misconception
        regexes settle debates (e.g. <span className="font-mono">"graphql is always better"</span>). Clients apply these on next sync.
      </p>
      <textarea
        value={vocabJson}
        onChange={e => setVocabJson(e.target.value)}
        rows={8}
        spellCheck={false}
        className="inp w-full resize-y font-mono text-[12px] leading-relaxed"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          className={btnGhost + btnSm}
          onClick={() => {
            try {
              const parsed = JSON.parse(vocabJson || "{}") as Record<string, unknown>;
              if (parsed.families !== undefined && (typeof parsed.families !== "object" || Array.isArray(parsed.families))) throw new Error("families must be an object of arrays");
              if (parsed.misconceptions !== undefined && !Array.isArray(parsed.misconceptions)) throw new Error("misconceptions must be an array");
              setConfig({ ...config, coachVocab: (parsed.families || parsed.misconceptions) ? parsed as RemoteConfig["coachVocab"] : undefined });
              toast("✅ Vocabulary staged — hit \u201cPublish config to all clients\u201d to ship it");
            } catch (e) {
              toast("✗ Invalid JSON: " + ((e as Error).message || "parse error"));
            }
          }}
        >
          💾 Validate & stage
        </button>
        {config.coachVocab && (
          <span className="text-[11.5px] text-fnt">
            Staged: {Object.keys(config.coachVocab.families ?? {}).length} famil{(Object.keys(config.coachVocab.families ?? {}).length === 1 ? "y" : "ies")} · {(config.coachVocab.misconceptions ?? []).length} correction{(config.coachVocab.misconceptions ?? []).length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
