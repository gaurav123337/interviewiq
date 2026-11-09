import { describe, expect, it } from "vitest";
import { resolveCloudConfig } from "../services/cloudConfig";

const defaults = { url: "https://production.example.com", anonKey: "sb_publishable_default" };

describe("explicit Supabase configuration", () => {
  it("preserves defaults only when neither override exists", () => {
    expect(resolveCloudConfig(defaults, undefined, undefined)).toEqual(defaults);
  });
  it("disables cloud when both overrides are explicitly empty", () => {
    expect(resolveCloudConfig(defaults, " ", "")).toEqual({ url: "", anonKey: "" });
  });
  it.each([[undefined, "public"], ["https://test.example.com", undefined], ["", "public"], ["https://test.example.com", ""]])(
    "does not fall back for an incomplete pair", (url, key) => {
      expect(() => resolveCloudConfig(defaults, url, key)).toThrow();
    }
  );
  it.each(["not a URL", "http://example.com", "https://user:pass@example.com", "https://example.com/rest", "https://example.com?key=x", "https://example.com#x"]) (
    "rejects unsafe project origins: %s", url => {
      expect(() => resolveCloudConfig(defaults, url, "public")).toThrow();
    }
  );
  it.each(["https://virtual-tester.invalid", "http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"])(
    "accepts an explicit public-key origin: %s", url => {
      expect(resolveCloudConfig(defaults, url + "/", "sb_publishable_fixture")).toEqual({ url, anonKey: "sb_publishable_fixture" });
    }
  );
  it("rejects secret and service-role keys without printing their values", () => {
    const jwt = `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    for (const key of ["sb_secret_do_not_print", jwt]) {
      expect(() => resolveCloudConfig(defaults, "https://test.example.com", key)).toThrow(/frontend|Privileged/);
    }
  });
});
