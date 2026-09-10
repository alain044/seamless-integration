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
 * Guards a failure mode the UI hides: i18next falls back to English for any key
 * a locale does not define, so a missing translation is invisible in tests and
 * in review — it just silently renders English. Comparing every locale's key
 * set against `en` turns "someone forgot to translate this" into a failure.
 */

type Json = Record<string, unknown>;

const LOCALES: Record<string, Json> = { en, fr, es, pt, ar, zh, sw, rw };

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

/** {{name}} / {{ count }} placeholders, so a translation cannot drop one. */
const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

const enKeys = flatten(en as unknown as Json);
const locales = Object.entries(LOCALES).map(
  ([name, value]) => [name, flatten(value as Json)] as const,
);

describe("i18n locale consistency", () => {
  it("parses every locale", () => {
    expect(enKeys.size).toBeGreaterThan(200);
    expect(locales).toHaveLength(8);
  });

  it("every locale defines exactly the same keys as English", () => {
    const problems: string[] = [];
    for (const [name, keys] of locales) {
      if (name === "en") continue;
      const missing = [...enKeys.keys()].filter((k) => !keys.has(k));
      const extra = [...keys.keys()].filter((k) => !enKeys.has(k));
      if (missing.length) problems.push(`${name}: missing ${missing.length} → ${missing.slice(0, 8).join(", ")}`);
      if (extra.length) problems.push(`${name}: extra ${extra.length} → ${extra.slice(0, 8).join(", ")}`);
    }
    expect(problems).toEqual([]);
  });

  it("no locale ships a blank string", () => {
    const blanks: string[] = [];
    for (const [name, keys] of locales) {
      for (const [key, value] of keys) {
        if (value.trim() === "") blanks.push(`${name}.${key}`);
      }
    }
    expect(blanks).toEqual([]);
  });

  it("keeps interpolation placeholders intact across locales", () => {
    const mismatched: string[] = [];
    for (const [name, keys] of locales) {
      if (name === "en") continue;
      for (const [key, english] of enKeys) {
        const translated = keys.get(key);
        if (translated === undefined) continue;
        const want = placeholders(english).join(",");
        const got = placeholders(translated).join(",");
        if (want !== got) mismatched.push(`${name}.${key}: expected [${want}] got [${got}]`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});
