// No real sends, credentials, remote imports, or Deno.serve side effects.
import {
  createTelegramNotifyHandler, notifyTimeZone, TELEGRAM_MAX_BODY_BYTES,
  type BindingResult, type NotifyMetadata, type TelegramNotifyDeps,
} from "../_shared/telegramNotify.ts";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const TOKEN = "123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd";
const OTHER_TOKEN = "987654:ABCDEFGHIJKLMNOPQRSTUVWX_wxyz";
const USER = "22222222-2222-4222-8222-222222222222";
const initial = (): NotifyMetadata => ({
  chat_id: "123456789", has_token: true, time_zone: "UTC", delivery_tested_at: null,
  updated_at: "2026-11-01T00:00:00Z", revision: 0,
});
function fixture(config: NotifyMetadata | null = initial()) {
  const state = {
    config, token: config ? TOKEN : null as string | null, sends: 0, jwtCalls: 0, accessCalls: 0,
    writes: [] as string[], users: [] as string[], verify: true, entitled: true, claims: 0,
    response: () => Promise.resolve(new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }))),
  };
  const deps: TelegramNotifyDeps = {
    legacySecret: "legacy-test-secret",
    async legacyOwner() { return USER; },
    async verifyJwt(token) { state.jwtCalls++; return state.verify && token === "verified-jwt" ? USER : null; },
    async hasAccess() { state.accessCalls++; return state.entitled; },
    async binding(user, operation, args): Promise<BindingResult> {
      state.users.push(user);
      if (operation === "read") return { ok: true, config: state.config, bot_token: state.token };
      if (args.revision !== (state.config?.revision ?? null)) return { ok: false, reason: "stale_binding" };
      if (operation === "claim") {
        if (++state.claims > 5) return { ok: false, reason: "rate_limited" };
        return { ok: true };
      }
      state.writes.push(operation);
      const nextRevision = (state.config?.revision ?? 0) + 1;
      if (operation === "unbind") {
        state.token = null;
        state.config = { chat_id: null, has_token: false, time_zone: "UTC", delivery_tested_at: null, updated_at: "2026-11-13T12:00:00Z", revision: nextRevision };
      } else {
        if (operation === "save") state.token = args.botToken as string;
        state.config = {
          chat_id: operation === "save" ? args.chatId as string : state.config!.chat_id,
          has_token: true, time_zone: operation === "save" ? args.timeZone as string : state.config!.time_zone,
          delivery_tested_at: "2026-11-13T12:00:00Z", updated_at: "2026-11-13T12:00:00Z", revision: nextRevision,
        };
      }
      return { ok: true, config: state.config };
    },
    async fetch(url, options) {
      state.sends++;
      equal(new URL(String(url)).origin, "https://api.telegram.org");
      assert(new URL(String(url)).pathname.endsWith("/sendMessage"));
      equal(options?.redirect, "error");
      equal(options?.method, "POST");
      assert(options?.signal instanceof AbortSignal);
      const body = JSON.parse(options?.body as string);
      assert(body.text.length <= 4096 && !body.text.includes(TOKEN));
      return await state.response();
    },
  };
  const handler = createTelegramNotifyHandler(deps);
  async function request(body?: unknown, headers: Record<string, string> = {}) {
    const response = await handler(new Request("https://edge.example/send-notify-test", {
      method: "POST", headers: { authorization: "Bearer verified-jwt", ...headers },
      ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    }));
    equal(response.headers.get("cache-control"), "no-store");
    const text = await response.text();
    assert(!text.includes(TOKEN) && !text.includes(OTHER_TOKEN) && !text.includes("bot_token"));
    return { status: response.status, body: JSON.parse(text) };
  }
  return { state, deps, handler, request };
}
const save = (revision: number | null = 0) => ({ operation: "save", chatId: "-100123456789", botToken: OTHER_TOKEN, timeZone: "Asia/Kolkata", revision });

Deno.test("save sends candidate before mutation and returns tested secret-free metadata", async () => {
  const f = fixture();
  f.state.response = () => {
    equal(f.state.writes, []);
    equal(f.state.token, TOKEN);
    return Promise.resolve(new Response('{"ok":true,"result":{"message_id":7}}'));
  };
  const result = await f.request(save());
  equal(result.status, 200);
  equal(result.body.sent, true);
  equal(result.body.message_id, 7);
  equal(result.body.config.revision, 1);
  assert(result.body.config.delivery_tested_at);
  equal(f.state.writes, ["save"]);
  equal(f.state.token, OTHER_TOKEN);
  equal(f.state.jwtCalls, 2);
  equal(f.state.accessCalls, 2);
  assert(f.state.users.every(user => user === USER));
});

Deno.test("failed Telegram response preserves old binding and never marks it tested", async () => {
  for (const response of [new Response('{"ok":false,"description":"secret"}'), new Response('{"ok":true}', { status: 500 }), new Response('{"ok":"true"}')]) {
    const f = fixture();
    f.state.response = () => Promise.resolve(response);
    const result = await f.request(save());
    equal(result.status, 502);
    equal(result.body.reason, "telegram_rejected");
    equal(f.state.writes, []);
    equal(f.state.token, TOKEN);
    equal(f.state.config, initial());
  }
});

Deno.test("timeout, redirect rejection, malformed/oversized Telegram JSON are secret-free", async () => {
  for (const response of [
    () => Promise.reject(new Error(`Failed https://api.telegram.org/bot${TOKEN}/sendMessage`)),
    () => Promise.resolve(new Response("not JSON")),
    () => Promise.resolve(new Response("x".repeat(16_385))),
  ]) {
    const f = fixture();
    f.state.response = response;
    const result = await f.request(save());
    equal(result.status, 503);
    equal(result.body.reason, "telegram_unavailable");
    equal(f.state.writes, []);
  }
});

Deno.test("blank/missing candidate token reuses stored token and UTC defaults", async () => {
  for (const botToken of ["", "  ", undefined]) {
    const f = fixture();
    const result = await f.request({ operation: "save", chatId: "123", botToken, revision: 0 });
    equal(result.status, 200);
    equal(result.body.config.time_zone, "UTC");
    equal(f.state.token, TOKEN);
  }
});

Deno.test("first save requires null revision and blank token cannot invent a binding", async () => {
  const f = fixture(null);
  equal((await f.request(save(0))).status, 409);
  equal((await f.request({ ...save(null), botToken: "" })).status, 400);
  equal(f.state.sends, 0);
  const result = await f.request(save(null));
  equal(result.status, 200);
  equal(result.body.config.revision, 1);
});

Deno.test("empty object, absent body and whitespace preserve backward-compatible test", async () => {
  for (const body of [{}, undefined, "  "]) {
    const f = fixture();
    const result = await f.request(body);
    equal(result.status, 200);
    equal(f.state.writes, ["test"]);
    equal(f.state.token, TOKEN);
  }
});

Deno.test("test uses stored binding only; explicit operation requires revision", async () => {
  const f = fixture();
  equal((await f.request({ operation: "test" })).status, 400);
  equal((await f.request({ operation: "test", revision: 0, botToken: OTHER_TOKEN })).status, 400);
  const result = await f.request({ operation: "test", revision: 0 });
  equal(result.status, 200);
  equal(result.body.config.delivery_tested_at, "2026-11-13T12:00:00Z");
  equal(f.state.token, TOKEN);
});

Deno.test("verified legacy secret is test-only and preserves gateway bearer compatibility", async () => {
  for (const operation of ["save", "unbind"]) {
    const f = fixture();
    equal((await f.request(operation === "save" ? save() : { operation, revision: 0 }, { authorization: "", "x-apply-secret": "legacy-test-secret" })).status, 401);
    equal(f.state.sends, 0);
  }
  const f = fixture();
  equal((await f.request({}, { authorization: "Bearer gateway-anon-token", "x-apply-secret": "legacy-test-secret" })).status, 200);
  assert(f.state.users.every(user => user === USER));
  equal((await f.request({}, { authorization: "Bearer invalid" })).status, 401);
  equal((await f.request({}, { authorization: "", "x-apply-secret": "bad" })).status, 401);
  equal((await f.request({}, { authorization: "", "x-apply-secret": "legacy-test-secret" })).status, 200);
});

Deno.test("legacy owner mapping is reverified after sending", async () => {
  const f = fixture();
  let ownerCalls = 0;
  f.deps.legacyOwner = async () => ++ownerCalls === 1 ? USER : null;
  const result = await f.request({}, { authorization: "", "x-apply-secret": "legacy-test-secret" });
  equal(result.status, 401);
  equal(result.body.sent, true);
  equal(f.state.writes, []);
});

Deno.test("unsigned, expired access and revoked JWT fail closed", async () => {
  const f = fixture();
  equal((await f.request(save(), { authorization: "" })).status, 401);
  f.state.entitled = false;
  equal((await f.request(save())).status, 403);
  equal((await f.request({ operation: "test", revision: 0 })).status, 403);
  equal(f.state.sends, 0);
});

Deno.test("expired signed-in account can unbind without sending or checking entitlement", async () => {
  const f = fixture();
  f.state.entitled = false;
  const result = await f.request({ operation: "unbind", revision: 0 });
  equal(result.status, 200);
  equal(result.body.sent, false);
  equal(result.body.disconnected, true);
  equal(result.body.config.has_token, false);
  equal(result.body.config.revision, 1);
  equal(f.state.accessCalls, 0);
  equal(f.state.sends, 0);
});

Deno.test("stale revision rejected before sending and unbind creates absent tombstone", async () => {
  const f = fixture();
  equal((await f.request(save(99))).status, 409);
  equal((await f.request({ operation: "test", revision: null })).status, 409);
  equal((await f.request({ operation: "unbind", revision: 99 })).status, 409);
  equal(f.state.sends, 0);
  const absent = fixture(null);
  equal((await absent.request({ operation: "unbind", revision: null })).body.config.revision, 1);
  equal((await absent.request(save(null))).status, 409);
});

Deno.test("concurrent unbind while Telegram awaits cannot be resurrected by save", async () => {
  const f = fixture();
  f.state.response = async () => {
    equal((await f.request({ operation: "unbind", revision: 0 })).status, 200);
    return new Response('{"ok":true}');
  };
  const result = await f.request(save());
  equal(result.status, 409);
  equal(result.body.reason, "stale_binding");
  equal(result.body.sent, true);
  assert(result.body.message.includes("accepted"));
  equal(f.state.writes, ["unbind"]);
  equal(f.state.token, null);
});

Deno.test("post-await JWT identity and access revocation prevent every mutation", async () => {
  for (const change of ["jwt", "access", "owner"]) {
    const f = fixture();
    f.state.response = () => {
      if (change === "jwt") f.state.verify = false;
      if (change === "access") f.state.entitled = false;
      if (change === "owner") f.deps.verifyJwt = async () => "another-owner";
      return Promise.resolve(new Response('{"ok":true}'));
    };
    const result = await f.request(save());
    equal(result.status, change === "access" ? 403 : 401);
    equal(result.body.sent, true);
    equal(f.state.writes, []);
  }
});

Deno.test("post-send storage failure reports accepted delivery honestly without raw errors", async () => {
  const f = fixture();
  const binding = f.deps.binding;
  f.deps.binding = (user, op, args) => op === "save" ? Promise.reject(new Error(TOKEN)) : binding(user, op, args);
  const result = await f.request(save());
  equal(result.status, 503);
  equal(result.body.sent, true);
  assert(result.body.message.includes("accepted"));
  equal(f.state.writes, []);
});

Deno.test("rate claim limits attempts per owner without writes on rejection", async () => {
  const f = fixture();
  f.state.response = () => Promise.resolve(new Response('{"ok":false}'));
  for (let i = 0; i < 5; i++) equal((await f.request(save())).status, 502);
  equal((await f.request(save())).status, 429);
  equal(f.state.sends, 5);
  equal(f.state.writes, []);
});

Deno.test("untrusted fields, malformed JSON, bounds, types and timezone fail before sending", async () => {
  for (const body of [
    "{", "null", "[]", { ...save(), userId: USER }, { ...save(), delivery_tested_at: "forged" },
    { ...save(), revision: -1 }, { ...save(), revision: 0.5 }, { ...save(), revision: "0" },
    { ...save(), revision: Number.MAX_SAFE_INTEGER + 1 }, { ...save(), chatId: "0" },
    { ...save(), chatId: "1/evil" }, { ...save(), botToken: "123456:../../evil" },
    { ...save(), botToken: TOKEN + "?redirect=https://evil.example" }, { ...save(), botToken: 123 },
    { ...save(), timeZone: "Not/A_Zone" }, { ...save(), timeZone: "" }, { ...save(), timeZone: 123 },
    " ".repeat(TELEGRAM_MAX_BODY_BYTES + 1),
  ]) {
    const f = fixture();
    equal((await f.request(body)).status, 400);
    equal(f.state.sends, 0);
    equal(f.state.writes, []);
  }
  equal(notifyTimeZone(), "UTC");
  const f = fixture();
  equal((await f.request(save(), { "content-length": "999999" })).status, 400);
});

Deno.test("two concurrent first saves send but only the first completion persists", async () => {
  const f = fixture(null);
  const completions: Array<(response: Response) => void> = [];
  let entered!: () => void;
  const bothEntered = new Promise<void>(resolve => { entered = resolve; });
  f.state.response = () => new Promise<Response>(resolve => {
    completions.push(resolve);
    if (completions.length === 2) entered();
  });
  const first = f.request(save(null));
  const second = f.request({ ...save(null), chatId: "456" });
  await bothEntered;
  completions[0](new Response('{"ok":true}'));
  equal((await first).status, 200);
  completions[1](new Response('{"ok":true}'));
  const stale = await second;
  equal(stale.status, 409);
  equal(stale.body.sent, true);
  equal(stale.body.reason, "stale_binding");
  equal(f.state.config?.chat_id, "-100123456789");
  equal(f.state.writes, ["save"]);
});

Deno.test("concurrent first save cannot resurrect absent-row cleanup", async () => {
  const f = fixture(null);
  f.state.response = async () => {
    equal((await f.request({ operation: "unbind", revision: null })).status, 200);
    return new Response('{"ok":true}');
  };
  const result = await f.request(save(null));
  equal(result.status, 409);
  equal(result.body.sent, true);
  equal(f.state.config?.revision, 1);
  equal(f.state.config?.has_token, false);
  equal(f.state.writes, ["unbind"]);
});

Deno.test("origin and method denied before authentication; metadata projection strips extras", async () => {
  const f = fixture();
  equal((await f.request(save(), { origin: "https://evil.example" })).status, 403);
  equal((await f.handler(new Request("https://edge.example/", { method: "GET" }))).status, 405);
  equal(f.state.jwtCalls, 0);
  f.state.config = { ...initial(), bot_token: TOKEN } as NotifyMetadata;
  const result = await f.request({ operation: "unbind", revision: 0 });
  equal(result.status, 200);
  assert(!("bot_token" in result.body.config));
});
