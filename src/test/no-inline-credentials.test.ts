import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Keeps credentials out of the schema history.
 *
 * Migrations are append-only. Once a literal lands in one and that migration is
 * applied, the value is frozen both in the repository and in the project's
 * migration log: it cannot be rotated without a further migration, and it is
 * readable by everyone with repo access. The right home for a value the
 * database needs at run time is Vault — see
 * 20260609120000_integrity_cron_vault_key.sql, which moved the integrity-cron
 * key there for exactly this reason.
 *
 * Unlike the other source-scan guards here this one carries an exemption list,
 * mirroring i18n-untranslated.test.ts and for the same class of reason: one
 * migration predates the rule and is already applied to the project, so
 * rewriting it would make the repository disagree with what the database
 * actually executed. Exemptions name a file, never a pattern, so a second
 * literal in a new file still fails.
 */

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");

/** A JWT: three base64url segments. Matches anon and service_role keys alike. */
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

const ALREADY_APPLIED: Record<string, string> = {
  "20260606213011_9df6771b-8257-4d35-b6ea-7c690e08e513.sql":
    "Scheduled the hourly sweep with the publishable key inline; superseded by " +
    "20260609120000_integrity_cron_vault_key.sql, which reads it from Vault.",
};

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const read = (name: string) => readFileSync(join(MIGRATIONS, name), "utf8");
const literals = (name: string) => read(name).match(JWT) ?? [];

const offenders = files
  .filter((f) => !(f in ALREADY_APPLIED))
  .flatMap((f) => literals(f).map(() => f));

describe("migrations carry no inline credentials", () => {
  it("actually scans the migrations on disk", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("has no JWT literal outside the documented exemption", () => {
    expect(offenders).toEqual([]);
  });

  it("keeps the exemption honest — it still names a real file holding a real literal", () => {
    for (const [name, reason] of Object.entries(ALREADY_APPLIED)) {
      expect(files, `stale exemption: ${name}`).toContain(name);
      expect(
        literals(name).length,
        `${name} no longer holds a literal, so drop its exemption. Reason was: ${reason}`,
      ).toBeGreaterThan(0);
    }
  });
});
