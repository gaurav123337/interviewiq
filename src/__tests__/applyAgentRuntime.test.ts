/// <reference types="node" />

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyAgentChildArgs,
  applyAgentChildEnv,
  getApplyAgentRuntimeContext,
} from "../../scripts/apply-agent-runtime.js";

const BINDING_ID = "65dfaf34-9194-4bc9-a717-ea3f9aa56fc2";
const TOKEN = `aiq1_${BINDING_ID}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
const ENDPOINT = "https://example.supabase.co/functions/v1/apply-agent";
const roots: string[] = [];

function fixture() {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "interviewiq-agent-runtime-"));
  roots.push(sandbox);
  const root = path.join(sandbox, "repo");
  const home = path.join(sandbox, "home");
  const configPath = path.join(sandbox, "external-binding.json");
  mkdirSync(root, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ version: 1, endpoint: ENDPOINT, token: TOKEN }));
  return { root, home, configPath };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("getApplyAgentRuntimeContext", () => {
  it("selects an explicit external config and returns binding-scoped runtime state", () => {
    const { root, home, configPath } = fixture();
    const context = getApplyAgentRuntimeContext({
      argv: ["node", "engine", "--agent-config", configPath, "--profile", "candidate.json"],
      env: {},
      repoRoot: root,
      home,
      platform: "linux",
    });
    expect(context).toMatchObject({
      mode: "paired",
      configPath,
      endpoint: ENDPOINT,
      token: TOKEN,
      bindingId: BINDING_ID,
      profilePath: path.join(root, "candidate.json"),
    });
    expect(context.mode === "paired" && context.stateRoot.replaceAll("\\", "/"))
      .toMatch(new RegExp(`/home/\\.local/state/interviewiq/apply-agent/state/${BINDING_ID}$`));
  });

  it("uses the environment config before the default external config", () => {
    const { root, home, configPath } = fixture();
    const context = getApplyAgentRuntimeContext({
      argv: ["node", "engine"],
      env: { INTERVIEWIQ_APPLY_AGENT_CONFIG: configPath },
      repoRoot: root,
      home,
      platform: "linux",
    });
    expect(context.mode).toBe("paired");
    expect(context.mode === "paired" && context.configPath).toBe(configPath);
  });

  it("fails closed when default config is absent or explicit config is malformed", () => {
    const { root, home, configPath } = fixture();
    expect(() => getApplyAgentRuntimeContext({ argv: ["node", "engine"], env: {}, repoRoot: root, home, platform: "linux" }))
      .toThrow(/config not found/);
    writeFileSync(configPath, "not json");
    expect(() => getApplyAgentRuntimeContext({
      argv: ["node", "engine", "--agent-config", configPath], env: {}, repoRoot: root, home, platform: "linux",
    })).toThrow(/not valid JSON/);
  });

  it("rejects configs inside the repository and binding changes in child processes", () => {
    const { root, home, configPath } = fixture();
    const inRepoConfig = path.join(root, "binding.json");
    writeFileSync(inRepoConfig, JSON.stringify({ version: 1, endpoint: ENDPOINT, token: TOKEN }));
    expect(() => getApplyAgentRuntimeContext({
      argv: ["node", "engine", "--agent-config", inRepoConfig], env: {}, repoRoot: root, home, platform: "linux",
    })).toThrow(/outside the repository/);
    expect(() => getApplyAgentRuntimeContext({
      argv: ["node", "engine", "--agent-config", configPath],
      env: { INTERVIEWIQ_APPLY_EXPECTED_BINDING_ID: "0ef06c0f-3508-4e5a-a2ce-8d17cdbf952e" },
      repoRoot: root,
      home,
      platform: "linux",
    })).toThrow(/binding changed/);
  });

  it("enters legacy mode only through an explicit flag or exact env opt-in", () => {
    const { root, home } = fixture();
    expect(getApplyAgentRuntimeContext({
      argv: ["node", "engine", "--legacy-owner"], env: {}, repoRoot: root, home, platform: "linux",
    })).toEqual({ mode: "legacy", profilePath: path.join(root, "apply-profile.json") });
    expect(getApplyAgentRuntimeContext({
      argv: ["node", "engine"], env: { INTERVIEWIQ_LEGACY_OWNER: "1" }, repoRoot: root, home, platform: "linux",
    }).mode).toBe("legacy");
    expect(() => getApplyAgentRuntimeContext({
      argv: ["node", "engine"], env: { INTERVIEWIQ_LEGACY_OWNER: "true" }, repoRoot: root, home, platform: "linux",
    })).toThrow(/config not found/);
  });
});

describe("child propagation", () => {
  it("keeps the bearer token out of command-line arguments", () => {
    const { root, home, configPath } = fixture();
    const context = getApplyAgentRuntimeContext({
      argv: ["node", "engine", "--agent-config", configPath], env: {}, repoRoot: root, home, platform: "linux",
    });
    const args = applyAgentChildArgs(context);
    expect(args).toEqual(["--agent-config", configPath, "--profile", path.join(root, "apply-profile.json")]);
    expect(args.join(" ")).not.toContain(TOKEN);
    const env = applyAgentChildEnv(context, {
      KEEP: "yes",
      INTERVIEWIQ_LEGACY_OWNER: "1",
      INTERVIEWIQ_APPLY_AGENT_TOKEN: "stale-secret",
      SUPA_KEY: "project-secret",
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
      SERVICE_ROLE_KEY: "legacy-service-secret",
      SUPABASE_ACCESS_TOKEN: "management-token",
      FREEBUFF_SHARED_CDP_EP: "ws://global-browser",
      FREEBUFF_APPLY_LOG_FILE: "/tmp/global.log",
    });
    expect(env).toMatchObject({
      KEEP: "yes",
      INTERVIEWIQ_APPLY_AGENT_CONFIG: configPath,
      INTERVIEWIQ_APPLY_EXPECTED_BINDING_ID: BINDING_ID,
      INTERVIEWIQ_APPLY_PROFILE: path.join(root, "apply-profile.json"),
    });
    expect(env.INTERVIEWIQ_APPLY_AGENT_TOKEN).toBeUndefined();
    expect(env.SUPA_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.SUPABASE_ACCESS_TOKEN).toBeUndefined();
    expect(env.FREEBUFF_SHARED_CDP_EP).toBeUndefined();
    expect(env.FREEBUFF_APPLY_LOG_FILE).toBeUndefined();
    expect(env.INTERVIEWIQ_LEGACY_OWNER).toBeUndefined();
  });

  it("propagates explicit legacy mode without paired credentials", () => {
    const context = { mode: "legacy" as const, profilePath: "/tmp/profile.json" };
    expect(applyAgentChildArgs(context)).toEqual(["--legacy-owner", "--profile", "/tmp/profile.json"]);
    const env = applyAgentChildEnv(context, { INTERVIEWIQ_APPLY_AGENT_TOKEN: TOKEN, INTERVIEWIQ_APPLY_AGENT_CONFIG: "/tmp/binding" });
    expect(env.INTERVIEWIQ_LEGACY_OWNER).toBe("1");
    expect(env.INTERVIEWIQ_APPLY_EXPECTED_BINDING_ID).toBeUndefined();
    expect(env.INTERVIEWIQ_APPLY_AGENT_TOKEN).toBeUndefined();
    expect(env.INTERVIEWIQ_APPLY_AGENT_CONFIG).toBeUndefined();
  });
});
