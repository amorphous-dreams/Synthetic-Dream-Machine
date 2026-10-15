/**
 * R3 — the CAS layer where a verified blob DESCRIPTOR meets actual bytes. `bootSetIds` /
 * `bootSetPluginCids` name the fixed floor an island's own blobs carry; `verifyCasBytes` fails
 * closed BY NAME when a selected CID's bytes never arrived or arrived corrupt — never silently
 * as an empty or trimmed set (golden-path-p2-recipe.md REFINEMENTS #7).
 */
import { describe, test, expect } from "vitest";
import { bootSetIds, bootSetPluginCids, verifyCasBytes, type CasBlobLike } from "../src/cas.js";
import { ENGINE_CORE_ID } from "../src/base-doc.js";

const GRAMMAR_ID = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
const SHADOWS_ID = "lararium-boot-shadows";

const ISLAND_BLOBS: Record<string, CasBlobLike> = {
  core:    { id: ENGINE_CORE_ID, sha256: "aa".repeat(32), mimeType: "application/javascript" },
  grammar: { id: GRAMMAR_ID,     sha256: "bb".repeat(32), mimeType: "application/json" },
  shadows: { id: SHADOWS_ID,     sha256: "cc".repeat(32), mimeType: "application/json" },
};

describe("★ bootSetIds — the fixed floor's id namespace ★", () => {
  test("names every blob id the island doc carries, including the engine core", () => {
    expect(bootSetIds(ISLAND_BLOBS)).toEqual(new Set([ENGINE_CORE_ID, GRAMMAR_ID, SHADOWS_ID]));
  });

  test("CONTROL — an absent/undefined blobs map names an empty set, never a throw", () => {
    expect(bootSetIds(undefined)).toEqual(new Set());
  });
});

describe("★ bootSetPluginCids — the floor's plugin-tiddler CIDs (grammar + shadows, never the engine) ★", () => {
  test("excludes the engine core and non-JSON blobs", () => {
    expect(new Set(bootSetPluginCids(ISLAND_BLOBS))).toEqual(new Set(["bb".repeat(32), "cc".repeat(32)]));
  });
});

describe("★ verifyCasBytes — descriptors meet bytes, fail-closed by name ★", () => {
  const CID_A = "aa".repeat(32);
  const CID_B = "bb".repeat(32);
  const BYTES_A = new Uint8Array(32).fill(0xaa);
  const identityHash = (b: Uint8Array) => Buffer.from(b).toString("hex");

  test("CONTROL — every named cid resolves and rehashes clean", () => {
    const store = new Map<string, Uint8Array>([[CID_A, BYTES_A]]);
    const read = (cid: string) => store.get(cid) ?? null;
    expect(verifyCasBytes([CID_A], read, identityHash)).toEqual({ ok: true });
  });

  test("★ MISSING BYTES fail closed by name — a cid this CAS cannot resolve at all ★", () => {
    const result = verifyCasBytes([CID_B], () => null, identityHash);
    expect(result).toEqual({ ok: false, failure: { code: "missing-bytes", cid: CID_B } });
  });

  test("★ CORRUPT BYTES fail closed by name — bytes present under a cid that does not rehash to it ★", () => {
    const wrongBytes = new Uint8Array([1, 2, 3]);
    const result = verifyCasBytes([CID_A], () => wrongBytes, identityHash);
    expect(result).toEqual({ ok: false, failure: { code: "corrupt-bytes", cid: CID_A, computed: identityHash(wrongBytes) } });
  });

  test("the first failing cid in order wins — never silently continues past a refusal", () => {
    const store = new Map<string, Uint8Array>([[CID_A, BYTES_A]]);
    const result = verifyCasBytes([CID_A, CID_B], (cid) => store.get(cid) ?? null, identityHash);
    expect(result).toEqual({ ok: false, failure: { code: "missing-bytes", cid: CID_B } });
  });
});
