/** Orchestrator for the skill-gap auto-discovery (D5). Run directly:
 *    SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *      node scripts/discover-skills.js [--dry-run] [--max-total 20] [--list-gaps]
 *  Importing the module is side-effect-free (is-main guard). */
export declare function main(): Promise<void>;
