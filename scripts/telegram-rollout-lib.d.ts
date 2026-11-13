export const TELEGRAM_PROJECT: string;
export const TELEGRAM_MIGRATION: string;
export function validateTelegramRollout(options: { project?: string; token?: string; apply?: boolean; confirmation?: string }): void;
export function telegramMigrationTransaction(sql: string): string;
export function assertTelegramPreserved(before: Record<string, unknown>, after: Record<string, unknown>): void;
