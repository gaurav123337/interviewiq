import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fulfillLiveStatic, isLiveMutationRequest } from "./virtual-tester-live-lib.js";
import { requestPolicy, LIVE_SITES } from "./virtual-tester-lib.js";

it("classifies only the exact read-only search POST without permitting backend traffic", () => {
  const search = "https://ndrusywvceojsoirhkhl.supabase.co/rest/v1/rpc/search_pdf_chunks_lex";
  assert.equal(isLiveMutationRequest(search, "POST"), false);
  assert.equal(requestPolicy(search, "POST", LIVE_SITES[0], "live"), "deny");
  for (const [url, method] of [[search, "DELETE"], [search.replace("supabase.co", "supabase.co.evil.test"), "POST"],
    [search.replace("search_pdf_chunks_lex", "my_apply_pipeline_action"), "POST"],
    [search.replace("search_pdf_chunks_lex", "admin_request_run"), "GET"],
    ["https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/apply-agent", "POST"],
    ["https://ndrusywvceojsoirhkhl.supabase.co/rest/v1/profiles", "POST"]]) {
    assert.equal(isLiveMutationRequest(url, method), true);
  }
});

// No browser or network: exercise the same handler used by the live fixture.
const path = "/interviewiq/assets/app.js";
const rawUrl = `https://synthetic-user:synthetic-password@example.invalid${path}?token=synthetic-token#synthetic-fragment`;
function stubRoute({ status = 200, failures = [] } = {}) {
  const calls = [];
  const record = name => {
    calls.push(name);
    if (failures.includes(name)) throw new Error(`Synthetic ${name} failure: ${rawUrl}; Authorization: Bearer synthetic-secret`);
  };
  const response = { status: () => { record("status"); return status; }, dispose: async () => { record("dispose"); } };
  const route = {
    request: () => ({ url: () => rawUrl }),
    fetch: async options => {
      assert.deepEqual(options, { maxRedirects: 0, maxRetries: 0, timeout: 25_000 });
      record("fetch");
      return response;
    },
    fulfill: async options => { assert.equal(options.response, response); record("fulfill"); },
    abort: async reason => { assert.equal(reason, "blockedbyclient"); record("abort"); },
    continue: async () => { record("continue"); },
    fallback: async () => { record("fallback"); }
  };
  return { route, calls };
}

describe("live static request handling", () => {
  it("fetches once without redirects or retries, fulfills and disposes success", async () => {
    const { route, calls } = stubRoute();
    const errors = [];
    await fulfillLiveStatic(route, errors);
    assert.deepEqual(calls, ["fetch", "status", "fulfill", "dispose"]);
    assert.deepEqual(errors, []);
  });

  it("labels transport exceptions without logging their URL, credentials or message", async () => {
    const { route, calls } = stubRoute({ failures: ["fetch"] });
    const errors = [];
    await fulfillLiveStatic(route, errors);
    assert.deepEqual(calls, ["fetch", "abort"]);
    assert.deepEqual(errors, [`Required asset transport failure: ${path}`]);
  });

  it("records actual HTTP errors separately, disposes and aborts without fulfilling", async () => {
    for (const status of [400, 404, 500, 503]) {
      const { route, calls } = stubRoute({ status });
      const errors = [];
      await fulfillLiveStatic(route, errors);
      assert.deepEqual(calls, ["fetch", "status", "dispose", "abort"]);
      assert.deepEqual(errors, [`Required asset HTTP ${status}: ${path}`]);
    }
  });

  it("rejects every 3xx response rather than following or fulfilling redirects", async () => {
    for (const status of [300, 301, 302, 303, 304, 307, 308, 399]) {
      const { route, calls } = stubRoute({ status });
      const errors = [];
      await fulfillLiveStatic(route, errors);
      assert.deepEqual(calls, ["fetch", "status", "dispose", "abort"]);
      assert.deepEqual(errors, [`Redirect rejected on approved static path: ${path}`]);
    }
  });

  it("disposes and aborts response/fulfillment failures without mislabeling transport", async () => {
    for (const [failure, stage] of [["status", "response"], ["fulfill", "fulfill"]]) {
      const { route, calls } = stubRoute({ failures: [failure] });
      const errors = [];
      await fulfillLiveStatic(route, errors);
      assert.deepEqual(calls, failure === "status" ? ["fetch", "status", "dispose", "abort"] : ["fetch", "status", "fulfill", "dispose", "abort"]);
      assert.deepEqual(errors, [`Required asset ${stage} failure: ${path}`]);
    }
  });

  it("reports disposal failure after success without aborting an already fulfilled route", async () => {
    const { route, calls } = stubRoute({ failures: ["dispose"] });
    const errors = [];
    await fulfillLiveStatic(route, errors);
    assert.deepEqual(calls, ["fetch", "status", "fulfill", "dispose"]);
    assert.deepEqual(errors, [`Required asset dispose failure: ${path}`]);
  });

  it("attempts both cleanup operations and preserves the HTTP failure if either throws", async () => {
    for (const failures of [["dispose"], ["abort"], ["dispose", "abort"]]) {
      const { route, calls } = stubRoute({ status: 503, failures });
      const errors = [];
      await fulfillLiveStatic(route, errors);
      assert.deepEqual(calls, ["fetch", "status", "dispose", "abort"]);
      assert.deepEqual(errors, [`Required asset HTTP 503: ${path}`, ...failures.map(stage => `Required asset ${stage} failure: ${path}`)]);
    }
  });
});
