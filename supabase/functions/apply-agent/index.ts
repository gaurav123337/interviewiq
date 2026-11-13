import { handleApplyAgent } from "./handler.ts";

// Always register the function server when Supabase imports this entry point.
Deno.serve(req => handleApplyAgent(req));
