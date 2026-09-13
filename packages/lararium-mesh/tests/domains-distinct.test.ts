/**
 * domains-distinct — EVERY SEPARATION NAMES ITSELF ONCE.
 *
 * The crypto spine holds that the HKDF infos and signing domains ARE the separation between derivations:
 * two seals sharing one string derive into each other on the first reset. `domains.ts` mints every one;
 * this witness reads the registry whole and refuses a collision or a string minted off the root.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/pattern-integrity-rhymes
 */
import { describe, expect, test } from "vitest";
import * as domains from "../src/domains.js";
import { DOMAIN_ROOT } from "../src/domains.js";

const ROOT = `${DOMAIN_ROOT}/`;

describe("the domain registry", () => {
  const named = Object.entries(domains).filter(([k, v]) => typeof v === "string" && /_(INFO|DOMAIN)$/.test(k) && k !== "DOMAIN_ROOT") as [string, string][];

  test("carries more than a handful of separations", () => {
    expect(named.length).toBeGreaterThan(10);
  });

  test("every separation reads distinct", () => {
    const seen = new Map<string, string>();
    for (const [k, v] of named) {
      expect(seen.has(v), `${k} shares its string with ${seen.get(v)}`).toBe(false);
      seen.set(v, k);
    }
  });

  test("every separation mints under the registry root, versioned", () => {
    for (const [k, v] of named) expect(v, k).toMatch(new RegExp(`^${ROOT.replace(/[/.]/g, "\\$&")}[a-z0-9-]+/v\\d+$`));
  });

  /** CONTROL: the seed-wrap info the browser imports reads as one of these, not a string of its own. */
  test("the seed-wrap info is a registry name", () => {
    expect(named.some(([k]) => k === "SEED_WRAP_PRF_INFO")).toBe(true);
  });
});
