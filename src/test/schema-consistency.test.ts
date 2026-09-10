import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards a failure mode that TypeScript cannot see: supabase-js parses the
 * select() string at runtime, so naming a column that does not exist fails
 * silently in the browser (PostgREST returns an error that call sites often
 * destructure only `{ data }` from). Comparing the select() lists against the
 * generated types turns that silent runtime failure into a build-time one.
 */

const ROOT = process.cwd();
const TYPES_PATH = join(ROOT, "src/integrations/supabase/types.ts");

const parseTables = (types: string): Record<string, Set<string>> => {
  const start = types.indexOf("Tables: {");
  expect(start, "generated types should contain a Tables section").toBeGreaterThan(-1);

  const viewsIdx = types.indexOf("Views: {");
  const section = types.slice(start, viewsIdx === -1 ? undefined : viewsIdx);

  const tables: Record<string, Set<string>> = {};
  const tableRe = /^ {6}([a-z_0-9]+): \{\r?\n {8}Row: \{\r?\n([\s\S]*?)^ {8}\}/gm;
  let table: RegExpExecArray | null;
  while ((table = tableRe.exec(section)) !== null) {
    const cols = new Set<string>();
    const colRe = /^ {10}([a-z_0-9]+):/gm;
    let col: RegExpExecArray | null;
    while ((col = colRe.exec(table[2])) !== null) cols.add(col[1]);
    tables[table[1]] = cols;
  }
  return tables;
};

const collectCalls = (): { table: string; columns: string[] }[] => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(full)) files.push(full);
    }
  };
  walk(join(ROOT, "src"));

  const callRe = /\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)\s*\.select\(\s*['"]([^'"]*)['"]/g;
  const calls: { table: string; columns: string[] }[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    let call: RegExpExecArray | null;
    while ((call = callRe.exec(text)) !== null) {
      const columns = call[2]
        .split(",")
        // Drop "*", embedded resources like `organizations(name, type)` and
        // aliases like `briefing:audio_briefings(*)` — none are plain columns.
        .filter((raw) => {
          const col = raw.trim();
          return col && col !== "*" && !/[():]/.test(col);
        })
        .map((raw) => raw.trim());
      calls.push({ table: call[1], columns });
    }
  }
  return calls;
};

const tables = parseTables(readFileSync(TYPES_PATH, "utf8"));
const calls = collectCalls();

describe("supabase select() vs generated types", () => {
  it("parses the generated schema", () => {
    expect(Object.keys(tables).length).toBeGreaterThan(20);
    expect(tables.budgets).toBeDefined();
  });

  it("actually scans the codebase (guards against a silently empty sweep)", () => {
    expect(calls.length).toBeGreaterThan(30);
    expect(calls.reduce((n, c) => n + c.columns.length, 0)).toBeGreaterThan(100);
  });

  it("only selects columns that exist in each table's Row type", () => {
    const bad: string[] = [];
    for (const { table, columns } of calls) {
      if (!tables[table]) {
        bad.push(`${table}: unknown table`);
        continue;
      }
      for (const col of columns) {
        if (!tables[table].has(col)) bad.push(`${table}.${col}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("reads budget limits from limit_amount, which is the column that exists", () => {
    expect(tables.budgets.has("limit_amount")).toBe(true);
    expect(tables.budgets.has("amount")).toBe(false);

    const budgetCalls = calls.filter((c) => c.table === "budgets" && c.columns.length > 0);
    expect(budgetCalls.length).toBeGreaterThan(0);
    for (const { columns } of budgetCalls) {
      expect(columns).not.toContain("amount");
    }
  });
});
