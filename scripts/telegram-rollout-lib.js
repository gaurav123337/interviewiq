/* Only the reviewed notification migration is eligible for this rollout. */
export const TELEGRAM_PROJECT = "ndrusywvceojsoirhkhl";
export const TELEGRAM_MIGRATION = "20261113183000_telegram_notify.sql";

export function validateTelegramRollout({ project, token, apply = false, confirmation }) {
  if (project !== TELEGRAM_PROJECT) throw new Error("Notification rollout requires the reviewed project");
  if (!/^sbp_[A-Za-z0-9]+$/.test(token ?? "")) throw new Error("A Supabase management personal access token is required");
  if (apply && confirmation !== `${project}:telegram-notify`) throw new Error("Explicit notification rollout confirmation required");
}

export function telegramMigrationTransaction(sql) {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("Notification migration is empty");
  return `begin; set local lock_timeout = '10s'; set local statement_timeout = '120s';\n${sql}\ncommit;`;
}

export function assertTelegramPreserved(before, after) {
  for (const key of ["notify_count", "result_count", "engine_mode"]) {
    if (before?.[key] !== after?.[key]) throw new Error(`Notification rollout changed ${key}; inspect before continuing`);
  }
}
