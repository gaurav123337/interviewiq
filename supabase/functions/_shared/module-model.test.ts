import { assertEquals } from "jsr:@std/assert";
import { isModuleId, resolveModuleFromRows } from "./module-model.ts";

const defRow = () => ({ value: { key: "sk-default", base: "https://openrouter.ai/api/v1/", model: "default-model" } });
const modRow = (v: unknown) => ({ value: v });

Deno.test("module row wins over provider when it has its own model+key", () => {
  const r = resolveModuleFromRows(
    modRow({ key: "sk-module", base: "https://api.openai.com/v1/", model: "module-model" }),
    defRow()
  );
  assertEquals(r, { key: "sk-module", base: "https://api.openai.com/v1", model: "module-model", source: "module" });
});

Deno.test("model-only module row inherits key and base from the provider", () => {
  const r = resolveModuleFromRows(modRow({ model: "explainer-model" }), defRow());
  assertEquals(r, { key: "sk-default", base: "https://openrouter.ai/api/v1", model: "explainer-model", source: "module" });
});

Deno.test("absent module row falls back to the provider row", () => {
  const r = resolveModuleFromRows(null, defRow());
  assertEquals(r, { key: "sk-default", base: "https://openrouter.ai/api/v1", model: "default-model", source: "provider" });
});

Deno.test("empty module row behaves like absent", () => {
  const r = resolveModuleFromRows(modRow({}), defRow());
  assertEquals(r.source, "provider");
});

Deno.test("no provider row → none", () => {
  const r = resolveModuleFromRows(null, null);
  assertEquals(r, { key: "", base: "", model: "", source: "none" });
});

Deno.test("module ids are validated", () => {
  assertEquals(isModuleId("coach"), true);
  assertEquals(isModuleId("deepdive"), true);
  assertEquals(isModuleId("nope"), false);
});
