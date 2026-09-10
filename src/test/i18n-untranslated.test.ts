import { describe, it, expect } from "vitest";
import en from "@/i18n/locales/en";
import fr from "@/i18n/locales/fr";
import es from "@/i18n/locales/es";
import pt from "@/i18n/locales/pt";
import ar from "@/i18n/locales/ar";
import zh from "@/i18n/locales/zh";
import sw from "@/i18n/locales/sw";
import rw from "@/i18n/locales/rw";

/**
 * Catches "translator left it in English".
 *
 * The key-parity test in i18n-consistency.test.ts only proves a key *exists*.
 * A locale can define every key and still ship the English sentence as its
 * value, which no other check can see. This one flags values byte-identical to
 * English.
 *
 * Exemptions are per locale on purpose, not per key: French and Spanish share
 * several word forms with English, but pt/sw/rw share none here, so if a real
 * English string is ever pasted into those it still fails.
 */

type Json = Record<string, unknown>;

const LOCALES: Record<string, Json> = { fr, es, pt, ar, zh, sw, rw };

const flatten = (value: Json, prefix = ""): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      for (const [k, v] of flatten(child as Json, path)) out.set(k, v);
    } else {
      out.set(path, String(child));
    }
  }
  return out;
};

/** Identical in every language, for reasons that have nothing to do with translation. */
const UNIVERSAL_IDENTICAL = new Set([
  // Language names in the selector: an endonym is correct in every locale
  // ("Français", "中文", "العربية" — never translated per locale).
  "translation.language.en",
  "translation.language.fr",
  "translation.language.es",
  "translation.language.pt",
  "translation.language.ar",
  "translation.language.zh",
  "translation.language.sw",
  "translation.language.rw",
  // Brand name.
  "translation.auth.title",
  // Initialism kept as-is in most markets (ar renders it as "صندوق متداول",
  // which is also correct).
  "translation.portfolio.etf",
]);

/** locale → key paths that are *correctly* identical to the English string. */
const EXPECTED_IDENTICAL: Record<string, string[]> = {
  // French shares these word forms with English. These are translated, just
  // identically — note pt/spell them out differently, which is also correct.
  fr: [
    "translation.nav.budgets",
    "translation.nav.notifications",
    "translation.nav.finance",
    "translation.org.description",
    "translation.org.types.microfinance",
    "translation.tasks.fields.description",
    "translation.tasks.categories.budget",
    "translation.tasks.categories.audit",
    "translation.common.condition",
    "translation.common.type",
    "translation.settings.notifications",
    "translation.expenses.date",
    "translation.expenses.type",
    "translation.budgets.title",
    "translation.portfolio.crypto",
    "translation.market.condition",
    "translation.notifications.title",
  ],
  // Same situation: Spanish "General", "No" and "Error" are the Spanish words.
  es: [
    "translation.tasks.categories.general",
    "translation.common.no",
    "translation.common.error",
  ],
  //
  // JUDGMENT CALLS, not verified by a native speaker:
  // an email address is ASCII in every language, so both locales keep the
  // English example. fr/es/pt/rw/sw instead use a localized local-part. Either
  // is defensible; flagging for a native reviewer rather than inventing one.
  ar: ["translation.auth.emailPlaceholder"],
  zh: ["translation.auth.emailPlaceholder"],
};

const enKeys = flatten(en as unknown as Json);

describe("no locale ships raw English copy", () => {
  const localeKeys = Object.entries(LOCALES).map(
    ([name, value]) => [name, flatten(value as Json)] as const,
  );

  it("reports every key left in English", () => {
    const leftovers: string[] = [];
    for (const [name, keys] of localeKeys) {
      const allowed = new Set(EXPECTED_IDENTICAL[name] ?? []);
      for (const [key, english] of enKeys) {
        if (UNIVERSAL_IDENTICAL.has(key) || allowed.has(key)) continue;
        const translated = keys.get(key);
        if (translated !== undefined && translated === english) {
          leftovers.push(`${name}.${key} = "${english}"`);
        }
      }
    }
    expect(leftovers).toEqual([]);
  });

  it("keeps the exemption lists honest — every entry still exists in en.ts", () => {
    for (const key of UNIVERSAL_IDENTICAL) {
      expect(enKeys.has(key), `stale universal exemption: ${key}`).toBe(true);
    }
    for (const [name, paths] of Object.entries(EXPECTED_IDENTICAL)) {
      const keys = LOCALES[name] ? flatten(LOCALES[name] as Json) : undefined;
      expect(keys, `${name} is not a known locale`).toBeDefined();
      for (const path of paths) {
        expect(enKeys.has(path), `stale exemption ${name}: ${path}`).toBe(true);
        expect(keys!.has(path), `${name} has no key ${path}`).toBe(true);
      }
    }
  });
});
