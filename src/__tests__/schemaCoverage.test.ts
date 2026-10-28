import { describe, expect, it } from "vitest";

/* Drift guard for the hand-applied SQL in supabase/.

   There is no auto-migrate on deploy: the database schema exists only because
   setup scripts or a developer applied the relevant SQL. This guard checks the
   SQL files that the setup scripts actually manage:
   bootstrap files, the ordered `setup-live.js` schema batch, and cron SQL. It
   verifies those references exist, that setup-live's batch is rerunnable, and
   that its files respect table dependencies. Other SQL files are standalone
   SQL-editor operations or migrations and are not implicitly part of setup-live.
   `scripts/setup-live.js` is applied manually (Supabase SQL editor or the script);
   nothing here runs SQL.

   Files are read through Vite's import.meta.glob(?raw) rather than node:fs,
   matching src/__tests__/rag-corpus-gen.test.ts: the project's TS types exclude
   node (@types/node is not installed), and the globs are resolved at build time so
   the test also works from any cwd. */

const sqlFiles = import.meta.glob<string>("../../supabase/**/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
});

const setupScripts = import.meta.glob<string>("../../scripts/*.{js,mjs}", {
  query: "?raw",
  eager: true,
  import: "default",
});

const relPath = (path: string) => path.slice(path.lastIndexOf("supabase/") + "supabase/".length);
const basename = (path: string) => path.split("/").pop() as string;

const sqlByPath = new Map<string, string>();
for (const [path, sql] of Object.entries(sqlFiles)) sqlByPath.set(relPath(path), sql);

/* Line numbers must point at the original file, so comments are blanked in place
   (same length, newlines kept). A commented-out `-- create table foo (...)` in a
   "how to roll this back" note therefore cannot pass as a real statement. */
function blankSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (line) => " ".repeat(line.length));
}

/* Scripts are scanned for the quoted "file.sql" literals in their apply lists. A
   prose mention is not wiring (scripts/takedown-lib.js explains what
   discovery.sql does without ever running it), so comments and string contents
   are handled separately: comments are stripped, quoted literals are collected. */
function stripJsComments(js: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < js.length; i += 1) {
    const ch = js[i];
    const next = js[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < js.length && js[i] !== "\n") {
        out += " ";
        i += 1;
      }
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      while (i < js.length && !(js[i] === "*" && js[i + 1] === "/")) {
        out += js[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

const appliedNames = new Set<string>();
for (const raw of Object.values(setupScripts)) {
  for (const match of stripJsComments(raw).matchAll(/["'`]([A-Za-z0-9_./-]+\.sql)["'`]/g)) {
    // Basenames too: setup-admin.js names "../supabase/admin.sql", which must
    // still count as wiring supabase/admin.sql.
    appliedNames.add(match[1]);
    appliedNames.add(basename(match[1]));
  }
}

const isApplied = (rel: string) => appliedNames.has(rel) || appliedNames.has(basename(rel));

/* The ordered batch that builds the feature schema (setup-live.js). Parsed rather
   than duplicated so the test cannot drift from the script it is checking. */
const schemaOrder = (() => {
  const src = setupScripts["../../scripts/setup-live.js"];
  if (!src) return [] as string[];
  const block = src.match(/const SCHEMA_FILES = \[([\s\S]*?)\n\];/);
  if (!block) return [] as string[];
  return [...block[1].matchAll(/"([^"]+\.sql)"/g)].map((m) => m[1]);
})();

const CREATE_TABLE =
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gi;

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function publicTablesIn(sql: string): { table: string; line: number }[] {
  const text = blankSqlComments(sql);
  const found: { table: string; line: number }[] = [];
  CREATE_TABLE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CREATE_TABLE.exec(text)) !== null) {
    const schema = (match[1] ?? "public").toLowerCase();
    // auth./storage./extensions. tables are Supabase-owned; only public ones are
    // ours to create on a fresh project.
    if (schema !== "public") continue;
    found.push({ table: match[2].toLowerCase(), line: lineOf(text, match.index) });
  }
  return found;
}

/* Span ranges of `do $$ … $$;` blocks, so a policy created inside a block that
   tests pg_policies (or swallows duplicate_object) counts as guarded: those are
   idempotent without a separate DROP. */
function doBlocks(lower: string): { start: number; end: number; body: string }[] {
  const blocks: { start: number; end: number; body: string }[] = [];
  const opener = /\bdo\s+\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(lower)) !== null) {
    const close = lower.indexOf("$$", match.index + match[0].length);
    if (close === -1) break;
    blocks.push({ start: match.index, end: close, body: lower.slice(match.index, close) });
  }
  return blocks;
}

interface Violation {
  file: string;
  line: number;
  message: string;
}

function idempotencyViolations(rel: string, sql: string): Violation[] {
  const text = blankSqlComments(sql);
  const lower = text.toLowerCase();
  const blocks = doBlocks(lower);
  const found: Violation[] = [];
  const add = (index: number, message: string) =>
    found.push({ file: `supabase/${rel}`, line: lineOf(text, index), message });

  for (const m of text.matchAll(/\bcreate\s+table\s+(?!if\s+not\s+exists)/gi))
    add(m.index, "create table without IF NOT EXISTS");

  for (const m of text.matchAll(/\bcreate\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists)/gi))
    add(m.index, "create index without IF NOT EXISTS");

  for (const m of text.matchAll(/\bcreate\s+type\s+/gi))
    // Postgres has no `create type if not exists`, so a domain/enum must live in a
    // DO block that catches duplicate_object; none exist today.
    add(m.index, "create type cannot be re-run (no IF NOT EXISTS form)");

  for (const m of text.matchAll(/\bcreate\s+view\s+(?!if\s+not\s+exists)/gi))
    add(m.index, "create view without OR REPLACE / IF NOT EXISTS");

  for (const m of text.matchAll(/\balter\s+publication\s+\w+\s+add\s+table\b/gi))
    add(m.index, "alter publication add table throws 42710 on a second run");

  for (const m of text.matchAll(
    /\balter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(?:public\.)?[a-z0-9_]+\s+add\s+column\s+(?!if\s+not\s+exists)/gi,
  ))
    add(m.index, "add column without IF NOT EXISTS");

  for (const m of text.matchAll(/create\s+policy\s+(?:"([^"]+)"|([a-z0-9_]+))\s+on\s+/gi)) {
    const name = (m[1] ?? m[2]).toLowerCase();
    const before = lower.slice(0, m.index);
    const dropped =
      before.includes(`drop policy if exists "${name}"`) ||
      before.includes(`drop policy if exists ${name} `);
    const guarded = blocks.some(
      (b) =>
        m.index > b.start &&
        m.index < b.end &&
        (b.body.includes("pg_policies") || b.body.includes("duplicate_object")),
    );
    if (!dropped && !guarded)
      add(m.index, `create policy "${name}" without a preceding drop policy if exists`);
  }

  for (const m of text.matchAll(/create\s+(?:or\s+replace\s+)?trigger\s+(?:"([^"]+)"|([a-z0-9_]+))/gi)) {
    const name = (m[1] ?? m[2]).toLowerCase();
    const before = lower.slice(0, m.index);
    const dropped =
      before.includes(`drop trigger if exists "${name}"`) ||
      before.includes(`drop trigger if exists ${name} `);
    if (!dropped) add(m.index, `create trigger "${name}" without a preceding drop trigger if exists`);
  }

  return found;
}

const allPaths = [...sqlByPath.keys()].sort();

describe("schema coverage", () => {
  it("found the SQL files and the apply list", () => {
    // A glob/root change that silently matched nothing would make every check
    // below vacuous, so assert the net caught files first.
    expect(allPaths.length).toBeGreaterThan(50);
    expect(appliedNames.size).toBeGreaterThan(0);
    expect(schemaOrder.length).toBeGreaterThan(0);
  });

  it("setup scripts reference every SQL file they manage", () => {
    // Most files under supabase/ are standalone SQL-editor operations, not part
    // of setup-live. Only its schema batch, the two bootstrap prerequisites,
    // and its cron files are automated by setup scripts.
    const managedFiles = [
      ...schemaOrder,
      "admin.sql",
      "schema.sql",
      ...allPaths.filter((rel) => rel.endsWith("-cron.sql")),
    ];
    const missingOnDisk = managedFiles.filter((rel) => !sqlByPath.has(rel));
    const unwired = managedFiles.filter((rel) => !isApplied(rel));

    expect(missingOnDisk, "A setup script names a SQL file that does not exist").toEqual([]);
    expect(
      unwired,
      "These setup-managed files are not named by an apply script. A comment that " +
        "merely mentions the file name does not count.",
    ).toEqual([]);
  });

  it("setup-live's schema batch lists existing non-cron files once", () => {
    const duplicates = schemaOrder.filter((file, i) => schemaOrder.indexOf(file) !== i);
    const missingOnDisk = schemaOrder.filter((file) => !sqlByPath.has(file));
    const cronFiles = schemaOrder.filter((file) => file.endsWith("-cron.sql"));

    expect(duplicates, "SCHEMA_FILES lists a file twice").toEqual([]);
    expect(missingOnDisk, "SCHEMA_FILES names a file that does not exist").toEqual([]);
    expect(cronFiles, "Cron schedules must run in setup-live's cron phase").toEqual([]);
  });

  it("every setup-live schema file is safe to apply twice", () => {
    const violations = schemaOrder.flatMap((rel) => idempotencyViolations(rel, sqlByPath.get(rel) ?? ""));
    expect(
      violations.map((v) => `${v.file}:${v.line} ${v.message}`),
      "setup-live.js is re-run (and re-run rotates secrets), so each file in its " +
        "schema batch must tolerate being applied to a database it already touched. " +
        "Guard each statement: create table/index if not exists, drop policy/trigger " +
        "if exists before create, add column if not exists.",
    ).toEqual([]);
  });

  it("a file runs after the file that creates the tables it touches", () => {
    // Tables created before the batch (admin.sql and schema.sql are prerequisites
    // applied by their own scripts), available at index -1.
    const prerequisiteTables = new Set<string>();
    for (const rel of ["admin.sql", "schema.sql"]) {
      for (const { table } of publicTablesIn(sqlByPath.get(rel) ?? "")) prerequisiteTables.add(table);
    }
    const createdAt = new Map<string, number>();
    schemaOrder.forEach((file, index) => {
      for (const { table } of publicTablesIn(sqlByPath.get(file) ?? "")) {
        if (!createdAt.has(table)) createdAt.set(table, index);
      }
    });
    const availableAt = (table: string) =>
      prerequisiteTables.has(table) ? -1 : (createdAt.get(table) ?? Number.POSITIVE_INFINITY);

    const violations: string[] = [];
    schemaOrder.forEach((file, index) => {
      const text = blankSqlComments(sqlByPath.get(file) ?? "").toLowerCase();
      const touched = new Map<number, string>();
      for (const m of text.matchAll(/create\s+policy\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/g))
        touched.set(m.index, m[1]);
      for (const m of text.matchAll(/create\s+trigger\s+(?:"[^"]+"|[a-z0-9_]+)\s+[\s\S]{0,120}?\bexecute\s+function[\s\S]{0,40}?\bon\s+public\.([a-z0-9_]+)/g))
        touched.set(m.index, m[1]);
      for (const m of text.matchAll(/alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?public\.([a-z0-9_]+)/g))
        touched.set(m.index, m[1]);
      // Foreign keys and indexes are resolved when the statement runs, so the
      // referenced table has to exist by then too.
      for (const m of text.matchAll(/references\s+public\.([a-z0-9_]+)/g)) touched.set(m.index, m[1]);
      for (const m of text.matchAll(
        /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[a-z0-9_]+\s+on\s+(?:public\.)?([a-z0-9_]+)/g,
      ))
        touched.set(m.index, m[1]);
      for (const [position, table] of touched) {
        if (availableAt(table) > index) {
          violations.push(
            `supabase/${file}:${lineOf(text, position)} touches public.${table}, but it is created by ` +
              `${schemaOrder[availableAt(table)] ?? "no setup file"} later in SCHEMA_FILES`,
          );
        }
      }
    });

    expect(violations).toEqual([]);
  });
});
