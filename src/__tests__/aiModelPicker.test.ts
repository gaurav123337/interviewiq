// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

/* the scan functions need a signed-in session for the edge fetch — mock the
   cloud seam (pure functions in this file never touch it) */
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(async () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) }
  })),
  getCloudState: () => ({ user: { email: "owner@example.com" } })
}));

import {
  autoPick,
  buildModelOptions,
  describeTask,
  providerLabelFromBase,
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

describe("providerLabelFromBase", () => {
  it("names the provider host from the saved base URL", () => {
    expect(providerLabelFromBase("https://www.getunikey.ai/v1")).toBe("getunikey.ai");
    expect(providerLabelFromBase("https://agentrouter.org/")).toBe("agentrouter.org");
    expect(providerLabelFromBase("http://localhost:8137/v1")).toBe("localhost");
    expect(providerLabelFromBase("https://api.openai.com/v1")).toBe("api.openai.com");
  });

  it("never returns empty — falls back to the raw input", () => {
    expect(providerLabelFromBase("")).toBe("unknown provider");
    expect(providerLabelFromBase("not-a-url")).toBe("not-a-url");
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

describe("scanProviderModels (no-listing fallback)", () => {
  /* agentrouter-style gateways serve no JSON /models — discovery must survive
     on probe verdicts alone (owner-reported 2026-09-26) */
  it("builds the report purely from probe verdicts when listing fails", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (init?.method === "POST" && url.includes("/functions/v1/ai-chat")) {
        return new Response(JSON.stringify({
          verdicts: [
            { model: "google/gemini-3.1-flash-lite", status: "ok", httpStatus: 200, latencyMs: 640, sample: "OK" },
            { model: "gpt-4o-mini", status: "failed", httpStatus: 401, latencyMs: 210, sample: "unauthorized client detected" }
          ],
          probed: 2,
          listedCount: 0,
          listError: "HTTP 401"
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ models: [] }), { status: 200 }); // listing empty → throws
    }));
    const { scanProviderModels } = await import("../services/aiModelPicker");
    const r = await scanProviderModels(true);
    expect(r.options.map(o => o.id)).toEqual(["google/gemini-3.1-flash-lite"]);
    expect(r.rejected).toEqual([{ model: "gpt-4o-mini", httpStatus: 401, note: "unauthorized client detected" }]);
    expect(r.scanned).toBe(2);
    expect(calls.some(c => c.startsWith("POST"))).toBe(true); // the probe still ran
  });

  it("throws an actionable error when there is no list AND nothing answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === "POST" && url.includes("/functions/v1/ai-chat")) {
        return new Response(JSON.stringify({
          verdicts: [{ model: "gpt-4o-mini", status: "failed", httpStatus: 401, latencyMs: 200, sample: "unauthorized" }],
          probed: 1, listedCount: 0, listError: "HTTP 401"
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    }));
    const { scanProviderModels } = await import("../services/aiModelPicker");
    await expect(scanProviderModels(true)).rejects.toThrow(/none of the common chat models answered/i);
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
