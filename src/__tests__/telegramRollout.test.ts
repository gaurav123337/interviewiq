// The rollout driver is not executed here; pure guards pin its production scope.
import { describe, expect, it } from "vitest";
import { TELEGRAM_PROJECT, TELEGRAM_MIGRATION, validateTelegramRollout, telegramMigrationTransaction, assertTelegramPreserved } from "../../scripts/telegram-rollout-lib.js";

const token = "sbp_syntheticcredential";
describe("targeted Telegram rollout guards", () => {
  it("permits metadata reads for the reviewed project only", () => {
    expect(() => validateTelegramRollout({ project: TELEGRAM_PROJECT, token })).not.toThrow();
    expect(() => validateTelegramRollout({ project: "anotherproject", token })).toThrow(/reviewed project/);
    expect(() => validateTelegramRollout({ project: TELEGRAM_PROJECT, token: "project-service-key" })).toThrow(/management/);
  });
  it("requires exact independent live confirmation", () => {
    expect(() => validateTelegramRollout({ project: TELEGRAM_PROJECT, token, apply: true })).toThrow(/confirmation/);
    expect(() => validateTelegramRollout({ project: TELEGRAM_PROJECT, token, apply: true, confirmation: `${TELEGRAM_PROJECT}:expand` })).toThrow(/confirmation/);
    expect(() => validateTelegramRollout({ project: TELEGRAM_PROJECT, token, apply: true, confirmation: `${TELEGRAM_PROJECT}:telegram-notify` })).not.toThrow();
  });
  it("names only the notification migration and wraps it in a bounded transaction", () => {
    expect(TELEGRAM_MIGRATION).toBe("20261113183000_telegram_notify.sql");
    const transaction = telegramMigrationTransaction("select 1;");
    expect(transaction).toMatch(/^begin;/);
    expect(transaction).toContain("set local lock_timeout");
    expect(transaction).toMatch(/commit;$/);
    expect(() => telegramMigrationTransaction(" ")).toThrow(/empty/);
  });
  it("detects row loss or an engine-mode change", () => {
    const before = { notify_count: "1", result_count: "1911", engine_mode: "off" };
    expect(() => assertTelegramPreserved(before, { ...before })).not.toThrow();
    for (const changed of [{ notify_count: "0" }, { result_count: "1" }, { engine_mode: "local" }]) {
      expect(() => assertTelegramPreserved(before, { ...before, ...changed })).toThrow(/changed/);
    }
  });
});
