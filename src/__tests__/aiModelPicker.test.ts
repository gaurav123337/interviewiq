// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  autoPick,
  buildModelOptions,
  describeTask,
  rankFor,
  type ProbeVerdict
} from "../services/aiModelPicker";
import type { AiModel } from "../services/aiModels";

const model = (id: string, tags: string[] = [], isThinking = false): AiModel => ({
  id, name: id, owner: "x", isThinking, tags
});

const verdict = (m: string, status: "ok" | "failed", latencyMs = 900, extra: Partial<ProbeVerdict> = {}): ProbeVerdict => ({
  model: m, status, httpStatus: status === "ok" ? 200 : 403, latencyMs, sample: "", ...extra
});

describe("describeTask", () => {
  it("describes each family by the task it handles optimally", () => {
    expect(describeTask("BAAI/bge-m3", ["embeddings"])).toMatch(/semantic search/);
    expect(describeTask("x/image-2", [])).toMatch(/Image generation/);
    expect(describeTask("kwaivgi/kling-v3.0-pro", [])).toMatch(/Video generation/);
    expect(describeTask("m/vision-x", ["vision"])).toMatch(/images/);
    expect(describeTask("codestral-latest", ["code"])).toMatch(/code generation/i);
    expect(describeTask("deepseek-r1", ["thinking"])).toMatch(/reasoning/i);
    expect(describeTask("deepseek/deepseek-v4-flash", ["fast"])).toMatch(/Fast and inexpensive/);
    expect(describeTask("claude-opus-4-8", [])).toMatch(/Flagship quality/);
    expect(describeTask("some-unknown-thing", [])).toMatch(/General-purpose chat/);
  });
});

describe("rankFor (auto-pick preference)", () => {
  it("prefers fast/cheap non-thinking models over flagships", () => {
    const flash = rankFor({ id: "deepseek/deepseek-v4-flash", tags: ["fast"], latencyMs: 800 });
    const opus = rankFor({ id: "claude-opus-4-8", tags: [], latencyMs: 800 });
    expect(flash).toBeLessThan(opus);
  });

  it("effectively excludes non-chat families", () => {
    expect(rankFor({ id: "qwen/qwen-image-3", tags: [], latencyMs: 800 })).toBeGreaterThan(200);
    expect(rankFor({ id: "x-ai/grok-4.3", tags: [], latencyMs: 800 })).toBeLessThan(200);
  });

  it("breaks ties with probe latency", () => {
    expect(rankFor({ id: "a/flash", tags: [], latencyMs: 500 })).toBeLessThan(
      rankFor({ id: "a/flash", tags: [], latencyMs: 4000 })
    );
  });
});

describe("buildModelOptions", () => {
  const listed = [
    model("deepseek/deepseek-v4-flash", ["fast"]),
    model("claude-opus-4-8", []),
    model("BAAI/bge-m3", ["embeddings"]),
    model("z-ai/glm-5.2", []) // probed and DEAD
  ];
  const verdicts: ProbeVerdict[] = [
    verdict("deepseek/deepseek-v4-flash", "ok", 1400),
    verdict("claude-opus-4-8", "ok", 6000),
    verdict("BAAI/bge-m3", "ok", 300),
    verdict("z-ai/glm-5.2", "failed", 30000, { sample: "origin unreachable" })
  ];

  it("merges listing + verdicts into ranked options with a BEST flag", () => {
    const r = buildModelOptions(listed, verdicts);
    expect(r.options.map(o => o.id)).toEqual(["deepseek/deepseek-v4-flash", "claude-opus-4-8", "BAAI/bge-m3"]);
    expect(r.options[0].recommended).toBe(true);
    expect(r.options[1].recommended).toBeUndefined();
    expect(r.scanned).toBe(4);
  });

  it("carries a plain-language task description per option", () => {
    const r = buildModelOptions(listed, verdicts);
    expect(r.options[0].task).toMatch(/Fast and inexpensive/);
  });

  it("reports dead models as rejections", () => {
    const r = buildModelOptions(listed, verdicts);
    expect(r.rejected).toEqual([{ model: "z-ai/glm-5.2", httpStatus: 403, note: "origin unreachable" }]);
  });

  it("composes quota intel into the rejection note", () => {
    const r = buildModelOptions(listed, [
      verdict("claude-opus-4-8", "failed", 900, { sample: "预扣费额度失败", quota: "needs ~200.1 credits/call, 174.06 available" })
    ]);
    expect(r.rejected[0].note).toContain("needs ~200.1 credits/call");
  });

  it("never suggests a model that was not probed", () => {
    const r = buildModelOptions(listed, [verdict("deepseek/deepseek-v4-flash", "ok")]);
    expect(r.options.map(o => o.id)).toEqual(["deepseek/deepseek-v4-flash"]);
  });
});

describe("autoPick", () => {
  it("returns the top-ranked working option", () => {
    const r = buildModelOptions(
      [model("claude-opus-4-8", []), model("a/flash", ["fast"])],
      [verdict("claude-opus-4-8", "ok"), verdict("a/flash", "ok")]
    );
    expect(autoPick(r)?.id).toBe("a/flash");
  });

  it("returns null when nothing works (auto-apply must stand down)", () => {
    expect(autoPick({ options: [], rejected: [], scanned: 3 })).toBeNull();
  });
});
