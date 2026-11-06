/**
 * share-tighten — the ONE tighten predicate every allowing return passes through (cap-tier#/the-keystone;
 * reach-plane#/the-vault-reads-as-a-bag).
 *
 *   T1 — a structural deny stays deny, whatever the tier reads (a tier never resurrects a doc)
 *   T2 — in-process stays allowed after the structural checks: the tier never gates the house's own island
 *   T3 — a same-face sibling reads as a vessel crossing (audience `fleet`): a VEIL doc withholds from it
 *   T4 — the holder-set chain per audience: PERSONAGROUP needs fleet, CONTRACT fleet or contracted, PUBLIC anyone,
 *        VEIL in-process only
 *   T5 — a secrets registry that cannot read refuses every crossing (`SecretsRegistryRefusal` reads as deny), and so
 *        does any reading that throws, a declared source that refuses, or a crossing that names no document
 *   T6 — a known secrets plane on the public shelf, declaring PUBLIC, still never reaches the world
 *   CONTROL — an authorized crossing allows: PUBLIC to the world, CONTRACT to a contracted peer
 */
import { describe, expect, test } from "vitest";
import {
  makeTierFloorSource, tightenShare, audiencePermits, SecretsRegistryRefusal,
  type CapTier, type CapTierRing, type ShareAudience,
} from "../src/index.js";

const no = (): boolean => false;
const yes = (): boolean => true;
const ring = (declared: CapTier | null, floor: { federatable?: (d: string) => boolean; sealed?: (d: string) => boolean; secrets?: (d: string) => boolean } = {}): CapTierRing => ({
  declared: { declaredTierForDoc: () => declared },
  floor: makeTierFloorSource({ federatable: floor.federatable ?? yes, sealed: floor.sealed ?? no, secrets: floor.secrets ?? no }),
});
const vessels: readonly ShareAudience[] = ["fleet", "contract", "world"];

describe("the one tighten predicate", () => {
  test("T1 — a structural deny stays deny", () => {
    for (const audience of ["in-process", ...vessels] as const) {
      expect(tightenShare(false, "doc", audience, ring("public"))).toBe(false);
    }
  });

  test("T2 — in-process stays allowed after the structural checks, even over a refusing registry", () => {
    const refusing = (): boolean => { throw new SecretsRegistryRefusal("secrets-registry-unread", "not bound"); };
    expect(tightenShare(true, "doc", "in-process", ring("veil"))).toBe(true);
    expect(tightenShare(true, "doc", "in-process", ring(null, { secrets: refusing }))).toBe(true);
    expect(tightenShare(true, undefined, "in-process", ring("veil"))).toBe(true);
  });

  test("T3 — a same-face sibling crosses a vessel boundary: VEIL withholds from it", () => {
    expect(tightenShare(true, "doc", "fleet", ring("veil"))).toBe(false);
    expect(tightenShare(true, "doc", "fleet", ring(null, { federatable: no }))).toBe(false); // floor VEIL
  });

  test("T4 — the holder-set chain per audience", () => {
    const want: Record<CapTier, Record<ShareAudience, boolean>> = {
      veil:         { "in-process": true, fleet: false, contract: false, world: false },
      personagroup: { "in-process": true, fleet: true,  contract: false, world: false },
      contract:     { "in-process": true, fleet: true,  contract: true,  world: false },
      public:       { "in-process": true, fleet: true,  contract: true,  world: true  },
    };
    for (const tier of Object.keys(want) as CapTier[]) {
      for (const audience of Object.keys(want[tier]) as ShareAudience[]) {
        expect(audiencePermits(tier, audience), `${tier} → ${audience}`).toBe(want[tier][audience]);
        expect(tightenShare(true, "doc", audience, ring(tier)), `${tier} → ${audience}`).toBe(want[tier][audience]);
      }
    }
  });

  test("T5 — a reading that cannot answer refuses every vessel crossing", () => {
    const refusing = (): boolean => { throw new SecretsRegistryRefusal("secrets-registry-unreadable", "torn"); };
    const torn = (): boolean => { throw new Error("torn reading"); };
    const declaredRefuses: CapTierRing = { declared: { declaredTierForDoc: () => { throw new Error("declared-tier-unresolved"); } }, floor: ring(null).floor };
    for (const audience of vessels) {
      expect(tightenShare(true, "doc", audience, ring("public", { secrets: refusing }))).toBe(false);
      expect(tightenShare(true, "doc", audience, ring("public", { federatable: torn }))).toBe(false);
      expect(tightenShare(true, "doc", audience, declaredRefuses)).toBe(false);
      expect(tightenShare(true, undefined, audience, ring("public"))).toBe(false);
    }
  });

  test("T6 — a known secrets plane on the public shelf never reaches the world", () => {
    const secrets = (d: string): boolean => d === "vault";
    expect(tightenShare(true, "vault", "world", ring("public", { secrets }))).toBe(false);
    expect(tightenShare(true, "vault", "world", ring(null, { secrets }))).toBe(false);
    expect(tightenShare(true, "vault", "contract", ring(null, { secrets }))).toBe(true);
  });

  test("CONTROL — an authorized crossing allows", () => {
    expect(tightenShare(true, "doc", "world", ring("public"))).toBe(true);
    expect(tightenShare(true, "doc", "contract", ring("contract"))).toBe(true);
    expect(tightenShare(true, "doc", "fleet", ring(null, { federatable: no, sealed: yes }))).toBe(true); // floor CONTRACT
  });
});
