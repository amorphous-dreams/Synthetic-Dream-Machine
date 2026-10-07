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

/** The frozen set: 46 names, sha256 over their sorted `EXPORT=string` rows. A move here re-keys live
 *  signatures and seals — it never reads as a refactor; only a deliberate retirement re-measures it. */
const FROZEN_COUNT = 46;
const FROZEN_WELD = "0368360e590dc3503e07527496f8d0e9737c0e1bbc6029b688007f78bf70f367";

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

  /** The NAME LAW: a separation is a well-formed name under the root — lowercase kebab segments, nothing
   *  else. A frozen string keeps its opaque `/v1` tail; a new one carries no suffix at all. */
  const NAME = new RegExp(`^${ROOT.replace(/[/.]/g, "\\$&")}[a-z0-9-]+(/[a-z0-9-]+)*$`);

  test("every separation mints under the registry root as a well-formed name", () => {
    for (const [k, v] of named) expect(v, k).toMatch(NAME);
  });

  test("a version tail appears only on the FROZEN strings, and only as the one opaque `/v1`", () => {
    const tailed = named.filter(([, v]) => /\/v\d+$/.test(v));
    for (const [k, v] of tailed) expect(v.endsWith("/v1"), `${k} carries a counter other than the frozen /v1`).toBe(true);
    // Every frozen string signs or derives live material, so the set may only shrink. A new domain that
    // grew a tail would raise this count; a new domain mints bare.
    expect(tailed.length).toBeLessThanOrEqual(FROZEN_COUNT);
  });

  test("a NEW domain mints bare — the auth proof carries no version suffix", () => {
    expect(domains.AUTH_PROOF_DOMAIN).toBe(`${DOMAIN_ROOT}/auth-proof`);
    expect(domains.AUTH_PROOF_DOMAIN).not.toMatch(/\/v\d+$/);
  });

  test("WELD: the frozen strings hold byte-identical through the helper split", async () => {
    const { createHash } = await import("node:crypto");
    const frozenRows = named.filter(([, v]) => v.endsWith("/v1")).map(([k, v]) => `${k}=${v}`).sort();
    expect(frozenRows.length).toBe(FROZEN_COUNT);
    expect(createHash("sha256").update(frozenRows.join("\n")).digest("hex")).toBe(FROZEN_WELD);
  });

  test("CONTROL: the name law refuses a malformed address", () => {
    expect(`${ROOT}Bad_Name`).not.toMatch(NAME);
    expect(`${ROOT}trailing/`).not.toMatch(NAME);
    expect("lar:///elsewhere/auth-proof").not.toMatch(NAME);
  });

  /** The TABLE derives from the declarations: every `mint`/`frozen` call lands in `ALL_DOMAINS`, in the
   *  order the registry declares it, so no declaration can be forgotten from the table. */
  test("ALL_DOMAINS holds every declared separation, in declaration order", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(import.meta.dirname, "..", "src", "domains.ts"), "utf8");
    const declared = [...src.matchAll(/^export const (\w+) = (?:mint|frozen)\("[a-z0-9-]+"\);/gm)].map((m) => m[1]!);
    expect(declared.length).toBe(named.length);
    expect(domains.ALL_DOMAINS).toEqual(declared.map((k) => (domains as Record<string, unknown>)[k]));
  });

  test("CONTROL: ALL_DOMAINS and the exported separations name one set", () => {
    expect(new Set(domains.ALL_DOMAINS)).toEqual(new Set(named.map(([, v]) => v)));
    expect(domains.ALL_DOMAINS.length).toBe(named.length);
  });

  /** CONTROL: the seed-wrap info the browser imports reads as one of these, not a string of its own. */
  test("the seed-wrap info is a registry name", () => {
    expect(named.some(([k]) => k === "SEED_WRAP_PRF_INFO")).toBe(true);
  });
});
