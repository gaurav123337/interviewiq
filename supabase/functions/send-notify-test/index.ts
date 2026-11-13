import { serviceClient } from "../_shared/serviceClient.ts";
import { createTelegramNotifyHandler, type BindingResult } from "../_shared/telegramNotify.ts";

const client = serviceClient();
Deno.serve(createTelegramNotifyHandler({
  legacySecret: Deno.env.get("NOTIFY_TEST_SECRET") ?? "",
  async verifyJwt(token) {
    const { data, error } = await client.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async legacyOwner() {
    const { data, error } = await client.rpc("apply_legacy_user_id");
    return !error && typeof data === "string" ? data : null;
  },
  async hasAccess(userId) {
    const { data, error } = await client.rpc("has_auto_apply_access", { p_user: userId });
    return !error && data === true;
  },
  async binding(userId, operation, args) {
    const { data, error } = await client.rpc("notify_binding_action", {
      p_user: userId, p_operation: operation, p_args: args,
    });
    if (error || !data || typeof data !== "object" || typeof data.ok !== "boolean") {
      throw new Error("notification_storage_unavailable");
    }
    return data as BindingResult;
  },
  fetch: globalThis.fetch,
}));
