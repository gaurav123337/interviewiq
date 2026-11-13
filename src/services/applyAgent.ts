import { getCloudState, getSupabaseClient } from "./cloud";

export interface ApplyAgentBinding {
  binding_id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface PairingCode {
  id: string;
  code: string;
  expires_at: string;
}

async function control(operation: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (!getCloudState().user) throw new Error("Sign in to manage your personal agent");
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.functions.invoke("apply-agent", { body: { operation, ...extra } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(String(data?.error ?? "Personal agent service unavailable"));
  return data as Record<string, unknown>;
}

export async function createPairingCode(): Promise<PairingCode> {
  return (await control("pair.create")).pairing as PairingCode;
}

export async function listAgentBindings(): Promise<ApplyAgentBinding[]> {
  return ((await control("bindings.list")).bindings as ApplyAgentBinding[]) ?? [];
}

export async function revokeAgentBinding(id: string): Promise<void> {
  await control("bindings.revoke", { binding_id: id });
}

/** Probe only the own-row RPC; a missing migration never falls back to admin. */
export async function personalApplyReady(): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("my_apply_action", { p_action: "results.list", p_args: { limit: 1 } });
  if (error) throw new Error("Personal application data is unavailable until the tenant migration is applied.");
}
