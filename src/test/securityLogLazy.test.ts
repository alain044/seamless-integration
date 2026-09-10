import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards a bundle-splitting invariant that nothing else can fail on.
 *
 * `src/lib/securityLog.ts` is meant to stay out of the main bundle, so every
 * call site imports it with a dynamic import(). If one site switches to a static
 * `import { logSecurityEvent } from '@/lib/securityLog'`, Rollup can no longer
 * split the module out — Vite emits a warning and the build still succeeds, so
 * the regression would land silently. The unit suite passes either way.
 *
 * Only a source scan can catch this, which is the same approach (and for the
 * same reason) as schema-consistency.test.ts.
 */

const ROOT = process.cwd();

const sourceFiles = (): string[] => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(full)) files.push(full);
    }
  };
  walk(join(ROOT, "src"));
  // Test files reference these paths as string literals, not as imports.
  return files.filter((f) => !f.replace(/\\/g, "/").includes("/src/test/"));
};

const files = sourceFiles();
const textOf = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => file.slice(ROOT.length + 1).replace(/\\/g, "/");

const STATIC_IMPORT = /^\s*import\s[\s\S]{0,200}?from\s+['"][^'"]*lib\/securityLog['"]/m;
const DYNAMIC_IMPORT = /import\(\s*['"][^'"]*lib\/securityLog['"]\s*\)/g;

const staticImporters = files.filter((f) => STATIC_IMPORT.test(textOf(f)));
const dynamicSites = files.flatMap((f) => {
  const hits = textOf(f).match(DYNAMIC_IMPORT) ?? [];
  return hits.map(() => rel(f));
});

describe("securityLog stays lazy-loaded", () => {
  it("actually scans the source tree", () => {
    expect(files.length).toBeGreaterThan(80);
  });

  it("is reached through dynamic imports, so the sweep is not silently empty", () => {
    // AuthPage (several paths) and AdminGuard.
    expect(dynamicSites.length).toBeGreaterThanOrEqual(2);
    expect(dynamicSites.some((f) => f.endsWith("AdminGuard.tsx"))).toBe(true);
    expect(dynamicSites.some((f) => f.endsWith("AuthPage.tsx"))).toBe(true);
  });

  it("is never imported statically anywhere in src/", () => {
    expect(staticImporters).toEqual([]);
  });
});
