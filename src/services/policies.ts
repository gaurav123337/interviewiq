/* Public legal policies — the Terms / Privacy / Refund / Shipping pages
   that payment providers require on a merchant site (a prerequisite for
   enabling international payments). Admin-published overrides live in
   app_config → "policies"; anything unpublished falls back to the baked-in
   templates in src/data/policies.ts. */

import { CONFIG } from "../config";
import { POLICY_DEFAULTS, type PolicyId } from "../data/policies";
import { getRemoteConfig } from "./remoteConfig";
import { getSupabaseClient } from "./cloud";

/** The deployed origin, used to fill {{url}} in templates. */
const appUrl = (): string =>
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://gaurav123337.github.io/interviewiq";

/** Fill template placeholders ({{company}}, {{url}}, {{email}}). */
function fillPlaceholders(body: string): string {
  return body
    .replace(/\{\{company\}\}/g, CONFIG.productName)
    .replace(/\{\{url\}\}/g, appUrl())
    .replace(/\{\{email\}\}/g, CONFIG.supportEmail);
}

/** Final document text for a policy id: admin-published override wins,
    otherwise the baked-in template; placeholders always filled. */
export function getPolicyDoc(id: PolicyId): string {
  const remote = getRemoteConfig().policies?.[id];
  return fillPlaceholders(remote && remote.trim() ? remote : POLICY_DEFAULTS[id]);
}

/** All four documents, ready to render. */
export function getPolicyDocs(): { id: PolicyId; body: string }[] {
  return (Object.keys(POLICY_DEFAULTS) as PolicyId[]).map(id => ({ id, body: getPolicyDoc(id) }));
}

/** Admin-published overrides from the cloud (public-read). */
export async function getPublishedPolicies(): Promise<Partial<Record<PolicyId, string>>> {
  const client = await getSupabaseClient();
  if (!client) return {};
  const { data, error } = await client.from("app_config").select("value").eq("key", "policies").maybeSingle();
  if (error || !data) return {};
  const v = data.value as Partial<Record<PolicyId, string>>;
  return v ?? {};
}

/** Publish overrides for all four documents (RLS enforces is_admin). */
export async function publishPolicies(docs: Record<PolicyId, string>): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_config").upsert(
    { key: "policies", value: docs, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}
