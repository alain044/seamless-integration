import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the "Testing" table in README.md against drifting from src/test/.
 *
 * The table is documentation, so nothing checks it: a new suite can land
 * without ever being listed, and a removed one can linger in the table
 * indefinitely. That had already happened here — the table listed five files
 * while eight existed, which is precisely how a reader ends up believing the
 * suite covers less than it does. This is the same class of registry drift
 * that edgeFunctions.test.ts guards for the function registry, and like that
 * one it can only be caught by reading both sources.
 *
 * Only the Testing section is parsed, so a passing mention of a suite
 * elsewhere in the README does not count as documenting its failure mode.
 */

const ROOT = process.cwd();
const README = readFileSync(join(ROOT, "README.md"), "utf8");

const suitesOnDisk = readdirSync(join(ROOT, "src/test"))
  .filter((f) => /\.(test|spec)\.tsx?$/.test(f))
  .sort();

const testingSection = README.split(/^## Testing$/m)[1]?.split(/^## /m)[0] ?? "";
const documented = [...testingSection.matchAll(/`(src\/test\/[^`]+)`/g)]
  .map((m) => m[1].replace("src/test/", ""))
  .sort();

describe("README testing table", () => {
  it("actually parsed both the suites and the table", () => {
    expect(suitesOnDisk.length).toBeGreaterThan(5);
    expect(documented.length).toBeGreaterThan(5);
  });

  it("documents every suite in src/test/", () => {
    const undocumented = suitesOnDisk.filter((f) => !documented.includes(f));
    expect(undocumented).toEqual([]);
  });

  it("does not list a suite that no longer exists", () => {
    const stale = documented.filter((f) => !suitesOnDisk.includes(f));
    expect(stale).toEqual([]);
  });
});
