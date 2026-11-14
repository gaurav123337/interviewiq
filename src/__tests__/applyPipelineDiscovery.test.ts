/// <reference types="node" />
// Only synthetic public feeds are used; no portal, candidate credential or browser session is accessed.
import { describe, it, expect, vi } from "vitest";
import { discoveryBoardPlan, planDiscoveryBoards, boardCandidateFromPosting, parseDiscoveryJobs } from "../../scripts/apply-pipeline-discovery-lib.js";
import { discoverPipelineJobs } from "../../scripts/apply-pipeline-discovery.js";

describe("private keyless ATS discovery", () => {
  it("plans only known keyless HTTPS API boards", () => {
    const board = { id: "a", url: "https://boards.greenhouse.io/example" };
    expect(discoveryBoardPlan(board)?.endpoint).toBe("https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true");
    for (const url of ["http://boards.greenhouse.io/example", "https://localhost/careers", "https://127.0.0.1/jobs", "https://boards.greenhouse.io.evil.test/a", "https://user:token@jobs.ashbyhq.com/a", "https://jobs.lever.co:8080/a"]) {
      expect(discoveryBoardPlan({ id: "a", url })).toBeNull();
    }
    expect(planDiscoveryBoards([board, board])).toHaveLength(1);
  });
  it("recognizes boards from real job URLs without inventing a website", () => {
    expect(boardCandidateFromPosting({ jobUrl: "https://jobs.ashbyhq.com/example/posting-123", company: "Example" })).toEqual({ url: "https://jobs.ashbyhq.com/example", label: "Example", type: "ashby" });
    expect(boardCandidateFromPosting({ jobUrl: "https://unknown.test/jobs/123" })).toBeNull();
  });
  it("bounds and sanitizes job snapshots and excludes foreign-company URLs", () => {
    const plan = discoveryBoardPlan({ id: "a", url: "https://boards.greenhouse.io/example" })!;
    const jobs = parseDiscoveryJobs(plan, { jobs: [
      { id: 1, title: "Frontend Engineer", content: "<p>Requires React</p>", absolute_url: "https://boards.greenhouse.io/example/jobs/1?token=secret", location: { name: "Remote" } },
      { id: 2, title: "Other company", absolute_url: "https://boards.greenhouse.io/other/jobs/2" },
      { id: 3, title: "Credential URL", absolute_url: "https://token:secret@boards.greenhouse.io/example/jobs/3" },
    ] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ description: "Requires React", jobUrl: "https://boards.greenhouse.io/example/jobs/1", company: "example", skills: [] });
    expect(jobs[0]).not.toHaveProperty("postedAt");
  });
  it("discovers privately, then ingests only parsed postings without forwarding credentials", async () => {
    const action = vi.fn(async (name: string) => {
      if (name === "boards.list") return { boards: [] };
      if (name === "jobs.list") return { jobs: [{ jobUrl: "https://jobs.ashbyhq.com/example/123", company: "Example" }] };
      if (name === "boards.discover") return { board: { id: "a", url: "https://jobs.ashbyhq.com/example", status: "pending" } };
      if (name === "jobs.ingest") return { ingested: 1 };
      throw new Error("Unexpected operation");
    });
    const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      return new Response(JSON.stringify({ jobs: [{ id: "123", title: "Engineer", company: "Example", descriptionPlain: "React", jobUrl: "https://jobs.ashbyhq.com/example/123", location: "Remote" }] }));
    }) as typeof fetch;
    expect(await discoverPipelineJobs({ action, fetchFn })).toEqual({ collected: 1, unavailable: 0 });
    expect(action.mock.calls.map(call => call[0])).toEqual(["boards.list", "jobs.list", "boards.discover", "jobs.ingest"]);
  });
  it("does not do work after cancellation or guess when a feed rejects the request", async () => {
    const controller = new AbortController(); controller.abort();
    const action = vi.fn();
    expect(await discoverPipelineJobs({ action, signal: controller.signal })).toEqual({ collected: 0, unavailable: 0 });
    expect(action).not.toHaveBeenCalled();
    const read = async (name: string) => name === "boards.list" ? { boards: [{ id: "a", url: "https://jobs.lever.co/example" }] } : { jobs: [] };
    expect(await discoverPipelineJobs({ action: read, fetchFn: vi.fn(async () => new Response("", { status: 403 })) as typeof fetch })).toEqual({ collected: 0, unavailable: 1 });
  });
});
