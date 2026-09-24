/** Orchestrator for L5 resource re-validation (resource-safety-guard §3 L5).
 *  Run directly:
 *    SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *      node scripts/revalidate-resources.js [--dry-run] [--limit 200]
 *  Importing the module is side-effect-free (is-main guard). */
export declare function main(): Promise<void>;
