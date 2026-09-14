/**
 * allow-all-ring-ordering.test.ts — WHICH DOOR DOES A PERMISSIVE SLOT OPEN?
 *
 * The self-slot fork (federation-gate.ts, `carryContractShareDecision`'s SURFACED FORK) warns that lighting
 * the INNER capability ring re-introduces an allow-all leak of the private planes. These vectors measure that
 * warning at BOTH candidate joints and pin which one actually leaks:
 *
 *   · the INNER ring (`identityShareDecision`'s `identity` param) — the composition runs the fed gate FIRST
 *     and `if (!fedAllows) return false` is absolute, so a permissive inner ring CANNOT widen the surface. It
 *     degenerates to the fed-gate verdict, exactly as `identity = null` does. Proven here over a private-own
 *     doc to a gated cross-operator peer: DENIED, and the slot never even gets asked.
 *   · the OUTER ring (the `FederationGate` position) — NOTHING runs ahead of it. A permissive gate substituted
 *     there DOES leak a private-own plane to the relay. Proven here too, asserting the leak, so the tree
 *     carries a test naming WHERE the hazard lives and not only where it does not.
 *
 * The AND-ORDERING IS THE INVARIANT: outer-first, deny-absolute, inner-narrowing-only. A refactor that
 * inverted the two lines (`identity` consulted before / instead of the fed verdict) would silently convert the
 * inner ring from a narrowing ring into a widening one. These vectors go red on that inversion.
 *
 * ANTI-INERTNESS: every denial here is accompanied by a positive CONTROL over the SAME permissive ring across
 * a federatable doc (the ring answers `true` and IS consulted), plus call counters on both the gate and the
 * slot. So a vacuous pass — an inert ring, a short-circuit that never ran the gate — cannot masquerade as a
 * denial.
 *
 * Gate: lar:///ha.ka.ba/lararium/mesh/federation-gate
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, stringifyAutomergeUrl, type BinaryDocumentId, type DocumentId } from "@automerge/automerge-repo";
import { randomBytes } from "node:crypto";
import {
  DeterministicFederationGate, identityShareDecision, carryContractShareDecision,
  type FederationGate, type IdentityRing,
} from "../src/federation-gate.js";
import { crossroadsDocUrl } from "../src/deterministic-doc.js";
import type { IdentitySlot } from "../src/identity-slot.js";

const NX = "1122334455667788990011223344556677889900112233445566778899001122";
const BAG = "lar:///ha.ka.ba/bags/test/allow-all-ring-ordering";
const CROSS_PEER = "cross-operator-relay-peer";

const docIdOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

/** A federatable-own plane — deterministic from the Nexus pubkey, so the fed gate ALLOWS it. */
const CROSSROADS = docIdOf(crossroadsDocUrl(NX));
/** A private-own plane — the private planes carry RANDOM automerge ids, never the deterministic set. */
const PRIVATE_OWN = docIdOf(stringifyAutomergeUrl({ documentId: new Uint8Array(randomBytes(16)) as BinaryDocumentId }));

/** A slot whose `verifyCapability` answers TRUE UNCONDITIONALLY — the over-broad self-slot the fork feared. */
function allowAllSlot(): { slot: IdentitySlot; asks: string[] } {
  const asks: string[] = [];
  const slot: IdentitySlot = {
    did: "did:web:example/vessels/allow-all",
    deriveActorId:      async () => "00000000-0000-4000-8000-000000000000",
    verifyCapability:   async (docUrl) => { asks.push(docUrl); return true; },   // unconditional grant
    delegateCapability: async () => null,
    verifyDelegation:   async () => false,
  };
  return { slot, asks };
}

/** The permissive INNER ring: an allow-all slot over a resolver that maps EVERY doc to a bag (never null). */
function allowAllRing(): { ring: IdentityRing; asks: string[] } {
  const { slot, asks } = allowAllSlot();
  return { ring: { slot, bagUrlForDoc: () => BAG }, asks };   // resolves every doc → no deny from the mapping
}

/** A fed gate that counts its consults, so a denial can be proven to have RUN the gate. */
function countingGate(inner: FederationGate): { gate: FederationGate; consults: DocumentId[] } {
  const consults: DocumentId[] = [];
  return {
    gate: { mayFederate: (documentId, peerId) => { consults.push(documentId); return inner.mayFederate(documentId, peerId); } },
    consults,
  };
}

const relayPeers = new Set<string>([CROSS_PEER]);

// ── THE VECTOR THE FORK FEARED — a permissive INNER ring over a private-own plane ──────────────
describe("the INNER ring cannot widen — an allow-all slot is DENIED a private-own plane", () => {
  test("identityShareDecision DENIES, and the slot is NEVER consulted (the outer deny is absolute)", async () => {
    const { ring, asks } = allowAllRing();
    const { gate, consults } = countingGate(new DeterministicFederationGate(NX));

    const verdict = await identityShareDecision(relayPeers, gate, ring, CROSS_PEER, PRIVATE_OWN);

    expect(verdict).toBe(false);                       // the permissive ring leaks NOTHING at this joint
    expect(consults).toEqual([PRIVATE_OWN]);           // the gate RAN — the false is a verdict, not inertness
    expect(asks).toEqual([]);                          // short-circuited: `if (!fedAllows) return false`
  });

  test("carryContractShareDecision (the fn carrying the fork comment) DENIES the same way", async () => {
    const { ring, asks } = allowAllRing();
    const { gate, consults } = countingGate(new DeterministicFederationGate(NX));

    const verdict = await carryContractShareDecision(relayPeers, gate, null, ring, CROSS_PEER, PRIVATE_OWN);

    expect(verdict).toBe(false);
    expect(consults).toEqual([PRIVATE_OWN]);
    expect(asks).toEqual([]);
  });

  test("CONTROL — the SAME permissive ring IS live: over a FEDERATABLE plane it answers and ALLOWS", async () => {
    const { ring, asks } = allowAllRing();
    const { gate, consults } = countingGate(new DeterministicFederationGate(NX));

    const verdict = await identityShareDecision(relayPeers, gate, ring, CROSS_PEER, CROSSROADS);

    expect(verdict).toBe(true);
    expect(consults).toEqual([CROSSROADS]);            // the gate ran here too
    expect(asks).toEqual([BAG]);                       // and the ring WAS consulted — it is not inert
  });

  test("CONTROL — a DENYING inner ring still narrows a federatable plane (the ring direction holds)", async () => {
    // The mirror of the above: the inner ring may only ever TAKE AWAY a doc the fed gate allowed.
    const ring: IdentityRing = {
      slot: { ...allowAllSlot().slot, verifyCapability: async () => false },
      bagUrlForDoc: () => BAG,
    };
    expect(await identityShareDecision(relayPeers, new DeterministicFederationGate(NX), ring, CROSS_PEER, CROSSROADS)).toBe(false);
  });

  test("the permissive ring's verdict EQUALS the null-ring verdict, doc for doc (the degeneration)", async () => {
    const fedGate = new DeterministicFederationGate(NX);
    for (const doc of [CROSSROADS, PRIVATE_OWN]) {
      const withRing = await identityShareDecision(relayPeers, fedGate, allowAllRing().ring, CROSS_PEER, doc);
      const withNull = await identityShareDecision(relayPeers, fedGate, null, CROSS_PEER, doc);
      expect(withRing).toBe(withNull);
    }
  });
});

// ── THE COMPANION VECTOR — the joint that IS dangerous ─────────────────────────────────────────
describe("the OUTER ring DOES leak — a permissive gate substituted for DeterministicFederationGate", () => {
  /** A permissive slot standing in the FEDERATION GATE position: nothing runs ahead of it. */
  const permissiveOuterGate: FederationGate = { mayFederate: () => true };

  test("a private-own plane CROSSES to a gated cross-operator peer — the hazard lives HERE", async () => {
    const { gate, consults } = countingGate(permissiveOuterGate);

    const verdict = await identityShareDecision(relayPeers, gate, null, CROSS_PEER, PRIVATE_OWN);

    expect(verdict).toBe(true);                        // THE LEAK — asserted, so the joint is named
    expect(consults).toEqual([PRIVATE_OWN]);           // and it leaked BECAUSE this gate answered
  });

  test("it leaks even with a DENYING inner ring absent — and the deny ring is the only thing that can stop it", async () => {
    const denying: IdentityRing = {
      slot: { ...allowAllSlot().slot, verifyCapability: async () => false },
      bagUrlForDoc: () => BAG,
    };
    // Permissive OUTER + no inner ring → leak.
    expect(await carryContractShareDecision(relayPeers, permissiveOuterGate, null, null, CROSS_PEER, PRIVATE_OWN)).toBe(true);
    // Permissive OUTER + a denying inner ring → the inner ring narrows it back. The rings are NOT interchangeable:
    // a permissive substitution is safe at the inner position and catastrophic at the outer one.
    expect(await carryContractShareDecision(relayPeers, permissiveOuterGate, null, denying, CROSS_PEER, PRIVATE_OWN)).toBe(false);
  });

  test("CONTROL — the REAL DeterministicFederationGate in that same position denies the same doc", async () => {
    expect(await identityShareDecision(relayPeers, new DeterministicFederationGate(NX), null, CROSS_PEER, PRIVATE_OWN)).toBe(false);
  });
});

// ── WHY THE ORDERING CARRIES THE SAFETY — the inversion, written out and measured ──────────────
describe("the AND-ordering is the load-bearing part, not the ring's own answer", () => {
  /**
   * The composition a refactor could arrive at by accident: the inner ring consulted for an ALLOW ahead of
   * (or beside) the fed verdict, so its `true` SHORT-CIRCUITS instead of narrowing. Written here rather than
   * mutated into the source, so the hazard of the inversion stays pinned without the shipped fn ever holding
   * it. If `identityShareDecision` is ever refactored into this shape, the DENY vectors above go red.
   */
  async function invertedOrdering(
    fedGate: FederationGate, identity: IdentityRing | null, peerId: string, documentId: DocumentId,
  ): Promise<boolean> {
    if (identity) {
      const bagUrl = identity.bagUrlForDoc(documentId);
      if (bagUrl && await identity.slot.verifyCapability(bagUrl, identity.ability ?? "read")) return true;   // OR, not AND
    }
    return fedGate.mayFederate(documentId, peerId as never);
  }

  test("under the INVERTED ordering the SAME permissive ring LEAKS the private-own plane", async () => {
    const fedGate = new DeterministicFederationGate(NX);
    // The shipped, outer-first composition denies…
    expect(await identityShareDecision(relayPeers, fedGate, allowAllRing().ring, CROSS_PEER, PRIVATE_OWN)).toBe(false);
    // …and the inverted one, over the identical inputs, hands the private plane to the relay.
    expect(await invertedOrdering(fedGate, allowAllRing().ring, CROSS_PEER, PRIVATE_OWN)).toBe(true);
  });
});
