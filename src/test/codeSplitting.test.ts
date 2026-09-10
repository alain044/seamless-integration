import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the route-level code splitting in src/App.tsx.
 *
 * Every page is reached through lazy(() => import(...)). If someone adds a
 * plain `import Expenses from "./pages/Expenses"`, Rollup pulls that page — and
 * whatever heavy library it uses — back into the entry bundle. Nothing fails:
 * the tests still pass and `vite build` still succeeds, it just quietly emits a
 * much larger entry chunk. Only a source scan can catch that.
 */

const ROOT = process.cwd();
const APP_SOURCE = readFileSync(join(ROOT, "src/App.tsx"), "utf8");

const pageFiles = readdirSync(join(ROOT, "src/pages")).filter((f) => f.endsWith(".tsx"));
const pageNames = pageFiles.map((f) => f.replace(/\.tsx$/, ""));

const lazyPages = [...APP_SOURCE.matchAll(/lazy\(\(\)\s*=>\s*import\(\s*["']\.\/pages\/([A-Za-z0-9_]+)["']\s*\)\)/g)].map(
  (m) => m[1],
);

const staticPages = [...APP_SOURCE.matchAll(/^\s*import\s+[A-Za-z0-9_]+\s+from\s+["']\.\/pages\/[^"']+["']/gm)].map(
  (m) => m[0].trim(),
);

describe("route code splitting", () => {
  it("finds the pages on disk", () => {
    expect(pageNames.length).toBeGreaterThan(20);
  });

  it("loads every page in src/pages through lazy()", () => {
    const missing = pageNames.filter((name) => !lazyPages.includes(name));
    expect(missing).toEqual([]);
  });

  it("does not statically import any page, which would undo the split", () => {
    expect(staticPages).toEqual([]);
  });

  it("keeps the dashboard shell out of the entry bundle too", () => {
    expect(APP_SOURCE).toMatch(/lazy\(\(\)\s*=>\s*import\(\s*["']@\/components\/layout\/AppLayout["']\s*\)\)/);
  });
});
