/* Explicit environment overrides must never accidentally select the live project. */
export interface CloudConfig {
  url: string;
  anonKey: string;
}

export function resolveCloudConfig(
  defaults: CloudConfig,
  urlOverride: string | undefined,
  keyOverride: string | undefined
): CloudConfig {
  if (urlOverride === undefined && keyOverride === undefined) return { ...defaults };
  if (urlOverride === undefined || keyOverride === undefined) {
    throw new Error("Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or neither.");
  }
  const url = urlOverride.trim();
  const anonKey = keyOverride.trim();
  if (!url && !anonKey) return { url: "", anonKey: "" };
  if (!url || !anonKey) throw new Error("Supabase overrides must both be populated or both explicitly empty.");

  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("VITE_SUPABASE_URL must be a valid project origin."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Supabase URL must be an HTTPS origin (HTTP is allowed only for local development).");
  }
  if (anonKey.startsWith("sb_secret_")) throw new Error("Only a public Supabase key belongs in frontend configuration.");
  if (anonKey.split(".").length === 3) {
    try {
      const payload = anonKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      if (JSON.parse(atob(payload)).role === "service_role") {
        throw new Error("Privileged Supabase keys must never be included in a frontend build.");
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Privileged")) throw error;
      throw new Error("The public Supabase JWT is malformed.");
    }
  }
  return { url: parsed.origin, anonKey };
}
