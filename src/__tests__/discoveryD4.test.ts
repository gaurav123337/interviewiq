import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestClient } from "../services/cloud";
import {
  addManualSeed, classifyUrlPreview, communityDiscovered,
  decideResource, decideSeed, discoveryCredits, listDiscoveredResources, listDiscoverySeeds,
  resourceFilterClauses
} from "../services/discovery";
import { attributionLabel, publishedFor, setPublishedQuestions, type PublishedQuestion } from "../services/remoteConfig";

type Row = Record<string, unknown>;

/* Configurable fake — mirrors scraper-svc.test.ts's makeClient, plus a
   per-table error switch and insert-error injection for the 23505 path. */
function makeClient(opts: {
  readError?: boolean;
  insertError?: { message: string; code?: string };
  seedRows?: Row[];
  resourceRows?: Row[];
  publicRows?: Row[];
} = {}) {
  const calls: string[] = [];
  const tables: Record<string, Row[]> = {
    discovery_seeds: opts.seedRows ?? [],
    discovered_resources: opts.resourceRows ?? [],
    discovered_resources_public: opts.publicRows ?? []
  };
  const chain = (table: string) => {
    const c = {
      select: (cols: string) => { calls.push(`select:${table}:${cols}`); return c; },
      order: (col: string) => { calls.push(`order:${col}`); return c; },
      limit: (n: number) => { calls.push(`limit:${n}`); return c; },
      eq: (k: string, v: unknown) => { calls.push(`eq:${k}=${String(v)}`); return c; },
      insert: (r: unknown) => { calls.push(`insert:${JSON.stringify(r).slice(0, 400)}`); return c; },
      update: (r: unknown) => { calls.push(`update:${JSON.stringify(r).slice(0, 300)}`); return c; },
      then: (resolve: (v: unknown) => void) => {
        if (opts.insertError && calls.some(x => x.startsWith("insert:"))) {
          resolve({ data: null, error: opts.insertError });
          return;
        }
        if (opts.readError) { resolve({ data: null, error: { message: "missing table" } }); return; }
        resolve({ data: tables[table] ?? [], error: null });
      },
      catch: () => c
    };
    return c;
  };
  const client = {
    from: (t: string) => { calls.push(`from:${t}`); return chain(t); },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }
  };
  return { client, calls, tables };
}

let fake: ReturnType<typeof makeClient> | null = null;

beforeEach(() => {
  fake = makeClient();
  setTestClient(fake.client as never);
});

afterEach(() => {
  setTestClient(null);
  vi.unstubAllGlobals();
});

const SEED_ROW: Row = {
  id: 1, url: "https://github.com/topics/interview-questions", kind: "github-topic",
  origin: "manual", origin_detail: "Admin Discover-from-URL", status: "pending",
  skill: null, note: "", created_at: "2026-09-24T00:00:00Z", decided_at: null
};

describe("classifyUrlPreview (D4 — the crawler's own classifier)", () => {
  it("previews a github topic seed with the crawl plan", () => {
    const r = classifyUrlPreview("https://github.com/topics/two-pointer/");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.kind).toBe("github-topic");
    expect(r.preview.url).toBe("https://github.com/topics/two-pointer"); // canonicalized (trailing slash gone)
    expect(r.preview.plan[0]?.action).toBe("github-topic-listing");
    expect(r.preview.licenseCheck).toBe(true);
  });

  it("rejects garbage with a friendly error", () => {
    const r = classifyUrlPreview("not a url");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("valid http(s) URL");
  });
});

describe("discovery seeds queue", () => {
  it("lists seeds newest-first and maps snake_case rows", async () => {
    fake = makeClient({ seedRows: [SEED_ROW] });
    setTestClient(fake.client as never);
    const seeds = await listDiscoverySeeds("pending");
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({ id: 1, kind: "github-topic", origin: "manual", status: "pending", skill: null });
    expect(fake.calls.some(c => c === "eq:status=pending")).toBe(true);
  });

  it("returns [] (not a crash) when the table is missing", async () => {
    fake = makeClient({ readError: true });
    setTestClient(fake.client as never);
    expect(await listDiscoverySeeds()).toEqual([]);
  });

  it("addManualSeed inserts a canonicalized pending seed with kind from the classifier", async () => {
    const res = await addManualSeed("https://github.com/topics/dynamic-programming/?utm_source=x");
    expect(res.ok).toBe(true);
    const ins = fake!.calls.find(c => c.startsWith("insert:"))!;
    expect(ins).toContain('"url":"https://github.com/topics/dynamic-programming"');
    expect(ins).toContain('"kind":"github-topic"');
    expect(ins).toContain('"origin":"manual"');
    expect(ins).toContain('"status":"pending"');
  });

  it("maps the unique-url violation to a friendly message", async () => {
    fake = makeClient({ insertError: { message: "duplicate key", code: "23505" } });
    setTestClient(fake.client as never);
    const res = await addManualSeed("https://github.com/topics/dynamic-programming");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("already in the queue");
  });

  it("decideSeed writes status + note + decided_at", async () => {
    const res = await decideSeed(7, "rejected", "spammy aggregator");
    expect(res.ok).toBe(true);
    const up = fake!.calls.find(c => c.startsWith("update:"))!;
    expect(up).toContain('"status":"rejected"');
    expect(up).toContain("spammy aggregator");
    expect(up).toContain("decided_at");
    expect(fake!.calls.some(c => c === "eq:id=7")).toBe(true);
  });
});

describe("discovered resources queue", () => {
  const RESOURCE_ROW: Row = {
    id: 11, url: "https://github.com/foo/bar/blob/main/README.md", title: "bar README",
    kind: "resource", attribution: { source: "github", owner: "foo", repo: "bar" },
    license: "no-license", status: "pending", seed_id: 1,
    meta: { needs_license_review: true }, created_at: "2026-09-24T01:00:00Z", decided_at: null
  };

  it("maps rows incl. needsLicenseReview from meta", async () => {
    fake = makeClient({ resourceRows: [RESOURCE_ROW] });
    setTestClient(fake.client as never);
    const rows = await listDiscoveredResources({ status: "pending" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 11, license: "no-license", needsLicenseReview: true });
    expect(rows[0].attribution.owner).toBe("foo");
  });

  it("resourceFilterClauses maps the license-review filter onto a meta query", () => {
    expect(resourceFilterClauses({ status: "pending", needsLicenseReview: true })).toEqual([
      { key: "eq", args: ["status", "pending"] },
      { key: "eq", args: ["meta->>needs_license_review", "true"] }
    ]);
    expect(resourceFilterClauses({})).toEqual([]);
  });

  it("decideResource merges the note into meta without losing existing keys", async () => {
    const res = await decideResource(11, "approved", { needs_license_review: true }, "owner confirmed MIT in issue #5");
    expect(res.ok).toBe(true);
    const up = fake!.calls.find(c => c.startsWith("update:"))!;
    expect(up).toContain('"status":"approved"');
    expect(up).toContain('"needs_license_review":true');   // existing meta preserved
    expect(up).toContain("decision_note");                 // note merged in
    expect(up).toContain("decided_at");
  });

  it("returns [] on missing table", async () => {
    fake = makeClient({ readError: true });
    setTestClient(fake.client as never);
    expect(await listDiscoveredResources()).toEqual([]);
  });
});

describe("discoveryCredits (public credits feed)", () => {
  it("aggregates approved resources by source+url with counts", async () => {
    fake = makeClient({
      publicRows: [
        { attribution: { source: "github", owner: "foo", repo: "bar" }, license: "MIT" },
        { attribution: { source: "github", owner: "foo", repo: "bar" }, license: "MIT" },
        { attribution: { source: "github", owner: "baz", repo: "qux" }, license: "no-license" }
      ]
    });
    setTestClient(fake.client as never);
    const cr = await discoveryCredits();
    expect(cr.total).toBe(3);
    expect(cr.sources).toHaveLength(2);
    expect(cr.sources[0]).toMatchObject({ owner: "foo", repo: "bar", count: 2, license: "MIT" }); // sorted by count desc
    expect(cr.sources[1].count).toBe(1);
  });

  it("reads the public view, not the admin table", async () => {
    await discoveryCredits();
    expect(fake!.calls.some(c => c.startsWith("from:discovered_resources_public"))).toBe(true);
  });

  it("degrades to empty on any error", async () => {
    fake = makeClient({ readError: true });
    setTestClient(fake.client as never);
    expect(await discoveryCredits()).toEqual({ sources: [], total: 0 });
    expect(await communityDiscovered()).toEqual([]);
  });
});

describe("attribution labels (D4 credits chips)", () => {
  it("prefers owner/repo, then source, then the source_url host", () => {
    expect(attributionLabel({ meta: { attribution: { owner: "foo", repo: "bar" } }, sourceUrl: "https://x.dev/a" }))
      .toEqual({ via: "foo/bar", url: "https://x.dev/a" });
    expect(attributionLabel({ meta: { attribution: { source: "github" } }, sourceUrl: null }))
      .toEqual({ via: "github", url: null });
    expect(attributionLabel({ meta: null, sourceUrl: "https://docs.example.com/guide" }))
      .toEqual({ via: "docs.example.com", url: "https://docs.example.com/guide" });
    expect(attributionLabel({ meta: null, sourceUrl: null })).toBeNull();
  });

  it("publishedFor passes via/viaUrl through to bank items", () => {
    const q: PublishedQuestion = {
      id: 3, fieldId: "backend", level: "senior", question: "Q?", answer: "A", keyPoints: [],
      published: true, updatedAt: null, addedAt: null, skills: [], status: "active",
      meta: { attribution: { owner: "foo", repo: "bar" } }, sourceUrl: "https://github.com/foo/bar"
    };
    setPublishedQuestions([q]);
    const items = publishedFor("backend", "senior");
    expect(items[0]).toMatchObject({ via: "foo/bar", viaUrl: "https://github.com/foo/bar" });
  });
});

describe("D4 components are importable", () => {
  it("DiscoverySection exports and is a function", async () => {
    const mod = await import("../components/admin/DiscoverySection");
    expect(typeof mod.DiscoverySection).toBe("function");
  });

  it("SourcesPage exports and is a function", async () => {
    const mod = await import("../components/SourcesPage");
    expect(typeof mod.SourcesPage).toBe("function");
  });
});
