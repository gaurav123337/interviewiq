import { describe, expect, it } from "vitest";
import {
  applyAgentConfigPath,
  createApplyAgentContext,
  deriveBindingStateRoot,
  normalizeApplyAgentEndpoint,
  parseApplyAgentToken,
  resolveApplyAgentDataRoot,
  validateApplyAgentConfig,
} from "../../scripts/apply-agent-context.js";

const BINDING_ID = "65dfaf34-9194-4bc9-a717-ea3f9aa56fc2";
const SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TOKEN = `aiq1_${BINDING_ID}.${SECRET}`;
const ENDPOINT = "https://example.supabase.co/functions/v1/apply-agent";

describe("apply-agent token parsing", () => {
  it("parses the public binding id without weakening the 256-bit secret shape", () => {
    expect(parseApplyAgentToken(TOKEN)).toEqual({ token: TOKEN, bindingId: BINDING_ID, secret: SECRET });
  });

  it("rejects truncated, extra, or wrong-version tokens", () => {
    expect(parseApplyAgentToken(TOKEN.slice(0, -1))).toBeNull();
    expect(parseApplyAgentToken(`${TOKEN}x`)).toBeNull();
    expect(parseApplyAgentToken(TOKEN.replace("aiq1_", "aiq2_"))).toBeNull();
    expect(parseApplyAgentToken("Bearer " + TOKEN)).toBeNull();
  });
});

describe("apply-agent config validation", () => {
  it("accepts only endpoint + token identity, separate from candidate profile data", () => {
    expect(validateApplyAgentConfig({ version: 1, endpoint: ENDPOINT, token: TOKEN })).toEqual({
      version: 1,
      endpoint: ENDPOINT,
      token: TOKEN,
    });
    expect(() => validateApplyAgentConfig({ version: 1, endpoint: ENDPOINT, token: TOKEN, email: "candidate@example.com" }))
      .toThrow(/unsupported key: email/);
  });

  it("requires the exact function path and HTTPS except for loopback development", () => {
    expect(normalizeApplyAgentEndpoint("https://example.supabase.co")).toBe(ENDPOINT);
    expect(normalizeApplyAgentEndpoint("http://127.0.0.1:54321/functions/v1/apply-agent"))
      .toBe("http://127.0.0.1:54321/functions/v1/apply-agent");
    expect(() => normalizeApplyAgentEndpoint("http://example.com/functions/v1/apply-agent")).toThrow(/HTTPS/);
    expect(() => normalizeApplyAgentEndpoint("https://example.com/rest/v1")).toThrow(/functions\/v1\/apply-agent/);
    expect(() => normalizeApplyAgentEndpoint("https://user:pass@example.com/functions/v1/apply-agent")).toThrow(/credentials/);
  });
});

describe("OS user-data and binding-scoped state roots", () => {
  it("derives deterministic Windows paths outside the repository", () => {
    const root = resolveApplyAgentDataRoot({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local" },
      home: "C:\\Users\\Ada",
    });
    expect(root).toBe("C:\\Users\\Ada\\AppData\\Local\\InterviewIQ\\apply-agent");
    expect(applyAgentConfigPath(root, "win32")).toBe(`${root}\\binding.json`);
    expect(deriveBindingStateRoot(root, TOKEN, "win32")).toBe(`${root}\\state\\${BINDING_ID}`);
  });

  it("honors XDG_STATE_HOME and keeps separate bindings in separate roots", () => {
    const root = resolveApplyAgentDataRoot({ platform: "linux", env: { XDG_STATE_HOME: "/var/state/ada" }, home: "/home/ada" });
    expect(root).toBe("/var/state/ada/interviewiq/apply-agent");
    expect(deriveBindingStateRoot(root, BINDING_ID, "linux")).toBe(`/var/state/ada/interviewiq/apply-agent/state/${BINDING_ID}`);
    const other = "0ef06c0f-3508-4e5a-a2ce-8d17cdbf952e";
    expect(deriveBindingStateRoot(root, other, "linux")).not.toBe(deriveBindingStateRoot(root, BINDING_ID, "linux"));
  });

  it("returns a validated context without candidate identity", () => {
    expect(createApplyAgentContext({ version: 1, endpoint: ENDPOINT, token: TOKEN }, "/home/ada/state", "linux"))
      .toEqual({
        version: 1,
        endpoint: ENDPOINT,
        token: TOKEN,
        bindingId: BINDING_ID,
        dataRoot: "/home/ada/state",
        stateRoot: `/home/ada/state/state/${BINDING_ID}`,
      });
  });
});
