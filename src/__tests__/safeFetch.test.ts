/* SSRF-safe fetch corpus (docs/app-security.md G1 + §11) — the pure URL/host
   validation from supabase/functions/_shared/safeFetch.ts, exercised against
   a must-block set of attack payloads. Runs in the app's vitest suite; the
   same rules run server-side inside safeFetch before any byte is fetched. */

import { describe, it, expect } from "vitest";
import {
  checkUrl,
  isBlockedHost,
  isIpv4Literal,
  isPrivateIpv4,
  isPrivateIpv6,
  normalizeHost,
  parseIpv4
} from "../../supabase/functions/_shared/safeFetch";

describe("normalizeHost", () => {
  it("strips ports, brackets, trailing dots and lowercases", () => {
    expect(normalizeHost("Example.COM:443")).toBe("example.com");
    expect(normalizeHost("example.com.")).toBe("example.com");
    expect(normalizeHost("[::1]")).toBe("::1");
    expect(normalizeHost("Foo.Bar:8080")).toBe("foo.bar");
  });
});

describe("IPv4 classification", () => {
  it("parses literals", () => {
    expect(isIpv4Literal("8.8.8.8")).toBe(true);
    expect(isIpv4Literal("999.1.1.1")).toBe(false);
    expect(isIpv4Literal("example.com")).toBe(false);
    expect(parseIpv4("10.0.0.1")).toEqual([10, 0, 0, 1]);
  });
  it("flags private/reserved ranges", () => {
    expect(isPrivateIpv4(10, 1, 2, 3)).toBe(true);        // 10/8
    expect(isPrivateIpv4(172, 16, 0, 1)).toBe(true);      // 172.16/12
    expect(isPrivateIpv4(172, 31, 255, 1)).toBe(true);
    expect(isPrivateIpv4(172, 32, 0, 1)).toBe(false);
    expect(isPrivateIpv4(192, 168, 1, 1)).toBe(true);     // 192.168/16
    expect(isPrivateIpv4(127, 0, 0, 1)).toBe(true);       // loopback
    expect(isPrivateIpv4(169, 254, 169, 254)).toBe(true); // cloud metadata
    expect(isPrivateIpv4(100, 64, 0, 1)).toBe(true);      // CGNAT
    expect(isPrivateIpv4(0, 0, 0, 0)).toBe(true);
    expect(isPrivateIpv4(224, 0, 0, 1)).toBe(true);       // multicast
    expect(isPrivateIpv4(240, 0, 0, 1)).toBe(true);       // reserved
    expect(isPrivateIpv4(8, 8, 8, 8)).toBe(false);        // public
    expect(isPrivateIpv4(1, 1, 1, 1)).toBe(false);
  });
});

describe("IPv6 classification", () => {
  it("flags loopback, ULA, link-local, multicast, mapped-private", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("::")).toBe(true);
    expect(isPrivateIpv6("fc00::1")).toBe(true);
    expect(isPrivateIpv6("fd12:3456::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("ff02::1")).toBe(true);
    expect(isPrivateIpv6("2001:db8::1")).toBe(true);
    expect(isPrivateIpv6("::ffff:10.0.0.1")).toBe(true);   // mapped private v4
    expect(isPrivateIpv6("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIpv6("::ffff:8.8.8.8")).toBe(false);   // mapped public v4
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false); // public
  });
});

describe("isBlockedHost", () => {
  it("rejects IP literals, local and metadata names, private suffixes", () => {
    expect(isBlockedHost("127.0.0.1").ok).toBe(false);
    expect(isBlockedHost("10.1.2.3").ok).toBe(false);
    expect(isBlockedHost("169.254.169.254").ok).toBe(false);
    expect(isBlockedHost("localhost").ok).toBe(false);
    expect(isBlockedHost("metadata.google.internal").ok).toBe(false);
    expect(isBlockedHost("metadata").ok).toBe(false);
    expect(isBlockedHost("db.internal").ok).toBe(false);
    expect(isBlockedHost("printer.local").ok).toBe(false);
    expect(isBlockedHost("mail.localhost").ok).toBe(false);
    expect(isBlockedHost("example.com").ok).toBe(true);
    expect(isBlockedHost("boards-api.greenhouse.io").ok).toBe(true);
  });
});

describe("checkUrl — must-block corpus (SSRF payloads)", () => {
  const BLOCKED: { url: string; why: string }[] = [
    { url: "http://169.254.169.254/latest/meta-data/", why: "cloud metadata IP" },
    { url: "https://169.254.169.254/latest/meta-data/iam/security-credentials/", why: "metadata over https" },
    { url: "http://127.0.0.1:3000/admin", why: "loopback" },
    { url: "http://localhost:5432", why: "localhost" },
    { url: "https://metadata.google.internal/", why: "metadata hostname" },
    { url: "http://10.0.0.1/", why: "private 10/8" },
    { url: "http://192.168.1.1/", why: "private 192.168/16" },
    { url: "http://172.16.0.1/", why: "private 172.16/12" },
    { url: "http://[::1]/", why: "ipv6 loopback" },
    { url: "http://[::ffff:10.0.0.1]/", why: "mapped private v4" },
    { url: "file:///etc/passwd", why: "non-http scheme" },
    { url: "javascript:alert(1)", why: "javascript scheme" },
    { url: "data:text/html,<script>1</script>", why: "data scheme" },
    { url: "https://user:pass@example.com/", why: "credentials in URL" },
    { url: "http://example.com/", why: "http scheme (https-only default)" }
  ];
  it.each(BLOCKED)("rejects $why ($url)", ({ url }) => {
    const r = checkUrl(url);
    expect(r.ok).toBe(false);
  });

  it("allows https public hosts", () => {
    expect(checkUrl("https://boards-api.greenhouse.io/v1/boards/lyft/jobs").ok).toBe(true);
    expect(checkUrl("https://api.ashbyhq.com/posting-api/job-board/linear").ok).toBe(true);
    expect(checkUrl("https://weworkremotely.com/jobs.rss").ok).toBe(true);
    expect(checkUrl("https://sub.example.com/a/b?q=1#frag").ok).toBe(true);
  });

  it("allows http only when allowHttp is set", () => {
    expect(checkUrl("http://example.com/", { allowHttp: true }).ok).toBe(true);
  });

  it("rejects malformed URLs and empty hosts", () => {
    expect(checkUrl("not a url").ok).toBe(false);
    expect(checkUrl("").ok).toBe(false);
    expect(checkUrl("https://").ok).toBe(false);
  });
});
