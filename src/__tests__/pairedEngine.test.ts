/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runtime: vi.fn(), spawn: vi.fn(), acquire: vi.fn(), loadAi: vi.fn(),
  mkdir: vi.fn(), write: vi.fn(), unlink: vi.fn(), sweep: vi.fn(), listProcesses: vi.fn(), killTree: vi.fn(),
}));
vi.mock("../../scripts/apply-agent-runtime.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../scripts/apply-agent-runtime.js")>(),
  getApplyAgentRuntimeContext: mocks.runtime,
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs")>(),
  mkdirSync: mocks.mkdir, writeFileSync: mocks.write, unlinkSync: mocks.unlink,
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn, spawnSync: mocks.spawn }));
vi.mock("../../scripts/apply-browser.js", () => ({
  acquireApplyContext: mocks.acquire,
  applyBrowserPaths: () => ({ profileDir: "mock-scoped-browser", signinProfileDir: "mock-scoped-signin" }),
  cloneApplyProfileForSignin: vi.fn(), isRemoteEndpoint: vi.fn(), mergeSigninProfileBack: vi.fn(),
  releaseSigninCloneOwnership: vi.fn(), signinCloneOwnedByLiveRun: vi.fn(), readLocalCdpEndpoint: vi.fn(),
}));
vi.mock("../../scripts/apply-kit-node.js", () => ({
  loadAi: mocks.loadAi, buildKit: vi.fn(), judgeFit: vi.fn(), mapUnknownFields: vi.fn(),
  weekKeyForMap: vi.fn(), aiHealButton: vi.fn(), vlmExtractFields: vi.fn(), templateResume: vi.fn(),
}));
vi.mock("../../scripts/engine-lifecycle.js", () => ({
  sweepEngineProcesses: mocks.sweep, listEngineProcesses: mocks.listProcesses, killTree: mocks.killTree,
}));

const bindingId = "65dfaf34-9194-4bc9-a717-ea3f9aa56fc2";
const context = Object.freeze({
  mode: "paired" as const, bindingId,
  token: `aiq1_${bindingId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
  endpoint: "https://example.supabase.co/functions/v1/apply-agent",
  configPath: path.join(os.tmpdir(), "paired-engine-binding.json"),
  stateRoot: path.join(os.tmpdir(), "paired-engine-test-no-artifacts", bindingId),
  profilePath: path.join(os.tmpdir(), "candidate-profile.json"),
});
const originalArgv = process.argv;
const fetchMock = vi.fn();
const scriptsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts");
const driverSource = readFileSync(path.join(scriptsRoot, "auto-apply-jobs.js"), "utf8");
const discoverySource = readFileSync(path.join(scriptsRoot, "discover-job-sites.js"), "utf8");
const catalog = [
  { host: "board-one.test", jobs_url: "https://board-one.test/jobs", label: "One", status: "active" },
  { host: "board-two.test", jobs_url: "https://board-two.test/jobs", label: "Two", status: "active" },
];
function response(data: unknown = catalog, status = 200) {
  return { ok: status === 200, status, json: async () => ({ ok: status === 200, action: "sites.list", data }) };
}
async function driver() {
  // @ts-expect-error The guarded Node CLI module has no TypeScript declaration.
  return import("../../scripts/auto-apply-jobs.js");
}
async function db() {
  // @ts-expect-error The Node transport module has no TypeScript declaration.
  return import("../../scripts/job-sites-db.js");
}
function child(code: number = 0) {
  const proc = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(),
  });
  queueMicrotask(() => proc.emit("exit", code));
  return proc;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.runtime.mockReturnValue(context);
  mocks.spawn.mockImplementation(() => child());
  mocks.acquire.mockRejectedValue(new Error("A test must never launch a browser"));
  fetchMock.mockReset().mockResolvedValue(response());
  vi.stubGlobal("fetch", fetchMock);
  process.argv = [originalArgv[0], "test-engine-not-an-entrypoint", "--all", "--max", "2", "--dry-run", "--headless"];
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("paired engine authorization", () => {
  it("imports without autorunning and authenticates every mode probe through the paired endpoint", async () => {
    const engine = await driver();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
    await expect(engine.readApplyMode()).resolves.toEqual({ mode: "local", provider: null, endpoint: null });
    await engine.readApplyMode();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe(context.endpoint);
      expect(init.headers.Authorization).toBe(`Bearer ${context.token}`);
      expect(init.redirect).toBe("error");
      expect(JSON.parse(init.body)).toEqual({ operation: "agent.action", action: "sites.list", args: {} });
    }
  });

  it.each([401, 403, 500])("fails closed on HTTP %s without owner RPC or builtin fallback", async (status) => {
    fetchMock.mockResolvedValue(response(null, status));
    const engine = await driver();
    await expect(engine.main()).rejects.toMatchObject({
      code: status === 500 ? "PAIRED_AUTH_UNAVAILABLE" : "PAIRED_AUTH_REJECTED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(context.endpoint);
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("does not recover a network failure with legacy credentials", async () => {
    vi.stubEnv("SUPA_KEY", "must-not-be-used");
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect((await driver()).readApplyMode()).rejects.toMatchObject({ code: "PAIRED_AUTH_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(context.endpoint);
  });

  it.each([
    { ok: true, action: "results.list", data: [] },
    { ok: true, action: "sites.list" },
    { ok: true, action: "sites.list", data: {} },
  ])("rejects an invalid catalog envelope %#", async (body) => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body });
    await expect((await driver()).readApplyMode()).rejects.toMatchObject({ code: "PAIRED_AUTH_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects submission authorization before touching any browser control", async () => {
    fetchMock.mockResolvedValue(response(null, 403));
    await expect((await driver()).trySubmit({}, "generic", { autoSubmit: true }))
      .rejects.toMatchObject({ code: "PAIRED_AUTH_REJECTED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("refuses owner-global transport methods before fetch", async () => {
    const transport = await db();
    expect(() => transport.loadLocalCreds()).toThrow(/unavailable in paired mode/);
    await expect(transport.getApplyConfig()).rejects.toMatchObject({ code: "PAIRED_UNAVAILABLE" });
    await expect(transport.upsertJobSite({ host: "unapproved.test" })).rejects.toMatchObject({ code: "PAIRED_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid runtime selection before driver artifact or remote IO", async () => {
    mocks.runtime.mockImplementationOnce(() => { throw new Error("missing paired binding"); });
    await expect(driver()).rejects.toThrow("missing paired binding");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
});

describe("paired --all routing", () => {
  it("runs scoped children sequentially without a parent/global browser", async () => {
    let active = 0, peak = 0;
    mocks.spawn.mockImplementation(() => {
      active++; peak = Math.max(peak, active);
      const proc = child();
      proc.on("exit", () => active--);
      return proc;
    });
    vi.stubEnv("SUPA_KEY", "owner-secret");
    vi.stubEnv("INTERVIEWIQ_APPLY_AGENT_TOKEN", "stale-bearer");
    await (await driver()).main();
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    expect(peak).toBe(1);
    for (const [index, [exe, args, options]] of mocks.spawn.mock.calls.entries()) {
      expect(exe).toBe(process.execPath);
      expect(args).toEqual([
        expect.stringMatching(/auto-apply-jobs\.js$/), "--url", catalog[index].jobs_url, "--max", "2",
        "--agent-config", context.configPath, "--profile", context.profilePath, "--headless", "--dry-run",
      ]);
      expect(args.join(" ")).not.toContain(context.token);
      expect(options.env).toMatchObject({
        INTERVIEWIQ_APPLY_AGENT_CONFIG: context.configPath,
        INTERVIEWIQ_APPLY_PROFILE: context.profilePath,
        INTERVIEWIQ_APPLY_EXPECTED_BINDING_ID: bindingId,
      });
      expect(options.env.SUPA_KEY).toBeUndefined();
      expect(options.env.INTERVIEWIQ_APPLY_AGENT_TOKEN).toBeUndefined();
      expect(options.env.FREEBUFF_SHARED_CDP_EP).toBeUndefined();
    }
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.sweep).not.toHaveBeenCalled();
    expect(mocks.listProcesses).not.toHaveBeenCalled();
    expect(mocks.killTree).not.toHaveBeenCalled();
    expect(mocks.loadAi).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([url]) => url === context.endpoint)).toBe(true);
  });

  it("does not use builtin sites when the paired catalog is empty", async () => {
    fetchMock.mockResolvedValue(response([]));
    await (await driver()).main();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("stops before the next site when entitlement is revoked between children", async () => {
    fetchMock
      .mockResolvedValueOnce(response()).mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response()).mockResolvedValueOnce(response())
      .mockResolvedValue(response(null, 403));
    await expect((await driver()).main()).rejects.toMatchObject({ code: "PAIRED_AUTH_REJECTED" });
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
  });

  it("stops on child failure instead of continuing with another browser", async () => {
    mocks.spawn.mockImplementation(() => child(1));
    await expect((await driver()).main()).rejects.toThrow(/paired site .* failed/);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.sweep).not.toHaveBeenCalled();
  });
});

describe("paired discovery and static safety guards", () => {
  it.each(["--discover", "--watch", "--listen", "--sessions"])("refuses %s before remote or artifact IO", async (flag) => {
    process.argv = [originalArgv[0], "test-engine-not-an-entrypoint", flag];
    await expect((await driver()).main()).rejects.toThrow(/unavailable in paired mode/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("keeps runtime selection and refusal before entrypoint IO", () => {
    expect(driverSource.indexOf("const AGENT_CONTEXT = getApplyAgentRuntimeContext()")).toBeLessThan(driverSource.indexOf("= applyBrowserPaths()"));
    const main = driverSource.slice(driverSource.indexOf("export async function main()"));
    expect(main.indexOf("PAIRED && args.discover")).toBeLessThan(main.indexOf("await readApplyMode()"));
    expect(main.indexOf("await readApplyMode()")).toBeLessThan(main.indexOf("mkdirSync(REPORTS_DIR"));
    const discoveryMain = discoverySource.slice(discoverySource.indexOf("export async function main()"));
    const refusal = discoveryMain.indexOf('AGENT_CONTEXT.mode === "paired"');
    expect(refusal).toBeGreaterThanOrEqual(0);
    expect(discoveryMain).toMatch(/export async function main\(\)\s*\{\s*if \(AGENT_CONTEXT.mode === "paired"\)\s*\{\s*throw new Error/);
    for (const io of ["await loadAi(", "await listJobSites(", "await aiCandidates(", "await ddgCandidates(", "await import(", "launchPersistentContext(", "await listEngineProcesses("]) {
      expect(discoveryMain.indexOf(io)).toBeGreaterThan(refusal);
    }
    const submit = driverSource.slice(driverSource.indexOf("export async function trySubmit("), driverSource.indexOf("/* ------------------------------- main"));
    expect(submit.match(/if \(PAIRED\) await readApplyMode\(\);/g)).toHaveLength(4);
    expect(submit).toMatch(/if \(PAIRED\) await readApplyMode\(\);\s*await clickButton\(target, btn/);
    expect(submit).toMatch(/if \(PAIRED\) await readApplyMode\(\);\s*await clickButton\(target, healed/);
    expect(submit).toMatch(/if \(PAIRED\) await readApplyMode\(\);\s*const clicked = await page.evaluate/);
    for (const source of [driverSource, discoverySource]) {
      expect(source).toContain('path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)');
    }
  });

  it("propagates runtime helpers through all legacy listener/discovery children", () => {
    const listener = driverSource.slice(driverSource.indexOf("async function telegramCommandLoop()"), driverSource.indexOf("let lastBeat = 0;"));
    const children = listener.split("\n").filter((line) => /\bspawn(?:View)?\(process\.execPath/.test(line));
    expect(children).toHaveLength(3);
    for (const line of children) {
      expect(line).toContain("...applyAgentChildArgs(AGENT_CONTEXT)");
      expect(line).toContain("applyAgentChildEnv(AGENT_CONTEXT)");
    }
    const discoveries = driverSource.split("\n").filter((line) => /spawnSync\(process\.execPath.*discover-job-sites/.test(line));
    expect(discoveries).toHaveLength(2);
    for (const line of discoveries) {
      expect(line).toContain("...applyAgentChildArgs(AGENT_CONTEXT)");
      expect(line).toContain("applyAgentChildEnv(AGENT_CONTEXT)");
    }
    expect(listener).toMatch(/async function telegramCommandLoop\(\)\s*\{\s*if \(PAIRED\) throw/);
    expect(driverSource).toMatch(/if \(!PAIRED\) \{\s*try \{\s*const \{ listEngineProcesses, killTree \}/);
  });
});
