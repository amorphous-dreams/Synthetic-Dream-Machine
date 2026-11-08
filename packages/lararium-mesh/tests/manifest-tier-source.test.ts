/**
 * manifest-tier-source — the production DeclaredTierSource over bag manifests and the per-tiddler cascade
 * (cap-tier#/the-keystone; bag-manifest.ts).
 *
 *   M1 — a doc resolves to its bag's manifest tier, met with every present per-tiddler refinement
 *   M2 — an absent refinement adds nothing; a present torn refinement reads VEIL
 *   M3 — fail closed by name: an unresolved doc, a missing manifest, a manifest naming another bag, an incomplete
 *        cascade each refuse (`DeclaredTierRefusal`), never answer the inert null
 *   M4 — the inert null stands only for a plane the binding names explicitly as no bag
 *   M5 — through the predicate, each refusal withholds the crossing
 *   CONTROL — a PUBLIC bag with no refinements reads PUBLIC and crosses to the world
 */
import { describe, expect, test } from "vitest";
import {
  makeManifestTierSource, DeclaredTierRefusal, bagManifestFromMeta, makeTierFloorSource, tightenShare,
  type DocBagBinding, type BagManifest,
} from "../src/index.js";

const yes = (): boolean => true;
const no = (): boolean => false;
const manifests: Record<string, BagManifest> = {
  shelf:   bagManifestFromMeta("shelf", { "cap-tier": "public" }),
  circle:  bagManifestFromMeta("circle", { "cap-tier": "personagroup" }),
  torn:    bagManifestFromMeta("torn", { "cap-tier": "wide-open" }),
  liar:    bagManifestFromMeta("someone-else", { "cap-tier": "public" }),
};
const tiddlers: Record<string, readonly unknown[]> = {
  shelf: [undefined, undefined], circle: [undefined], torn: [],
  "shelf-veiled": [undefined, "veil"], "shelf-torn-row": ["not-a-tier"], liar: [],
};
manifests["shelf-veiled"] = bagManifestFromMeta("shelf-veiled", { "cap-tier": "public" });
manifests["shelf-torn-row"] = bagManifestFromMeta("shelf-torn-row", { "cap-tier": "public" });
const bindings: Record<string, DocBagBinding> = {
  d_shelf: { kind: "bag", bag: "shelf" }, d_circle: { kind: "bag", bag: "circle" }, d_torn: { kind: "bag", bag: "torn" },
  d_veiled: { kind: "bag", bag: "shelf-veiled" }, d_tornrow: { kind: "bag", bag: "shelf-torn-row" },
  d_liar: { kind: "bag", bag: "liar" }, d_nomanifest: { kind: "bag", bag: "ghost" }, d_nocascade: { kind: "bag", bag: "half" },
  d_system: { kind: "non-bag", tier: "public" },
};
manifests["half"] = bagManifestFromMeta("half", { "cap-tier": "public" });
const source = makeManifestTierSource({
  bagOfDoc: (d) => bindings[d] ?? null,
  manifestOf: (b) => manifests[b] ?? null,
  tiddlerTiersOf: (b) => tiddlers[b] ?? null,
});

describe("the manifest tier source", () => {
  test("M1 — the bag's manifest tier, met with the per-tiddler cascade", () => {
    expect(source.declaredTierForDoc("d_circle")).toBe("personagroup");
    expect(source.declaredTierForDoc("d_veiled")).toBe("veil");
  });

  test("M2 — an absent refinement adds nothing; a present torn one reads VEIL", () => {
    expect(source.declaredTierForDoc("d_shelf")).toBe("public");
    expect(source.declaredTierForDoc("d_tornrow")).toBe("veil");
    expect(source.declaredTierForDoc("d_torn")).toBe("veil"); // a torn manifest tier fail-closes in the parse
  });

  test("M3 — fail closed by name, never the inert null", () => {
    const refusal = (d: string): string => {
      try { source.declaredTierForDoc(d); } catch (e) { if (e instanceof DeclaredTierRefusal) return e.reason; throw e; }
      return "answered";
    };
    expect(refusal("d_unknown")).toBe("declared-tier-unresolved");
    expect(refusal("d_nomanifest")).toBe("declared-tier-manifest-unread");
    expect(refusal("d_liar")).toBe("declared-tier-manifest-mismatch");
    expect(refusal("d_nocascade")).toBe("declared-tier-cascade-incomplete");
  });

  test("M4 — a plane bound explicitly as no bag answers the tier it declares, never the inert null", () => {
    expect(source.declaredTierForDoc("d_system")).toBe("public");
  });

  test("M5 — through the predicate, each refusal withholds the crossing", () => {
    const ring = { declared: source, floor: makeTierFloorSource({ federatable: yes, sealed: no, secrets: no }) };
    for (const d of ["d_unknown", "d_nomanifest", "d_liar", "d_nocascade", "d_veiled"]) {
      expect(tightenShare(true, d, "fleet", ring), d).toBe(false);
    }
  });

  test("CONTROL — a PUBLIC bag crosses to the world", () => {
    const ring = { declared: source, floor: makeTierFloorSource({ federatable: yes, sealed: no, secrets: no }) };
    expect(tightenShare(true, "d_shelf", "world", ring)).toBe(true);
    expect(tightenShare(true, "d_circle", "fleet", ring)).toBe(true);
    expect(tightenShare(true, "d_circle", "world", ring)).toBe(false);
  });
});
