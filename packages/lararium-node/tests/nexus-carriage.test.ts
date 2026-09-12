/**
 * nexus-membership.test.ts — the nexus-doc MEMBER-vs-STRANGER consult (the carry-split's member gate).
 *
 * Proven:
 *   · the PROVABLE-MEMBER FLOOR — a cross-operator whose resolved nym seats in the charter roster reads MEMBER,
 *     every other cross-operator reads STRANGER (the conservative kahu-as-member-floor; see the surfaced fork),
 *   · nym resolution reuses the antigen's proven bridge (`identifier.slice(-64)`, lowercased); an
 *     unauthenticated / malformed peer resolves to no nym → NOT a member,
 *   · FAIL CLOSED: no charter on disk → empty member set → NOBODY reads member (every cross-operator STRANGER),
 *   · refresh swaps the whole set when the charter seats.
 */
import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, genesisSealEpochCid, type NexusDoc } from "@lararium/mesh";
import { makeNexusMembership } from "../src/nexus-carriage.js";
import { writeNexusDoc } from "../src/nexus-doc.js";

// Three founding kahu — fixed seeds → deterministic keys. The seated keys ARE the member floor.
const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
// A non-kahu operator — a valid identity carrying no charter seat → a STRANGER under the kahu floor.
const STRANGER_SEED = new Uint8Array(32).fill(7);

async function seatedCharter(keys: string[]): Promise<NexusDoc> {
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: 2,
    sealEpochCid: genesisSealEpochCid(keys, 2),
    kahu: [
      { displayName: "Kahu Alpha", verifyingKey: keys[0]! },
      { displayName: "Kahu Beta",        verifyingKey: keys[1]! },
      { displayName: "Kahu Gamma",        verifyingKey: keys[2]! },
    ],
  };
}

describe("the provable-member floor — a seated-kahu peer reads MEMBER, all else STRANGER", () => {
  let bags: string;
  beforeEach(() => { bags = mkdtempSync(join(tmpdir(), "lares-nexus-membership-")); });
  afterEach(() => { rmSync(bags, { recursive: true, force: true }); });

  test("a cross-operator whose nym seats in the charter reads MEMBER; a non-kahu reads STRANGER", async () => {
    const keys     = await Promise.all(SEEDS.map(pubOf));
    const stranger = await pubOf(STRANGER_SEED);
    writeNexusDoc(bags, await seatedCharter(keys));

    const peerMap = new Map<string, string>([
      ["peer-kahu",      `keyhive-prefix:${keys[0]!}`],           // Identifier suffix = a seated kahu key → MEMBER
      ["peer-kahu-upper", `X:${keys[1]!.toUpperCase()}`],          // case-folded on resolve → still MEMBER
      ["peer-stranger",  `prefix:${stranger}`],                   // valid identity, no seat → STRANGER
      ["peer-malformed", "short-not-64-hex"],                     // no nym → STRANGER
    ]);
    const { membership } = makeNexusMembership({ sealHome: bags, peerIdentifierMap: peerMap });

    expect(membership.holdsCarriagePeer("peer-kahu")).toBe(true);
    expect(membership.holdsCarriagePeer("peer-kahu-upper")).toBe(true);
    expect(membership.holdsCarriagePeer("peer-stranger")).toBe(false);
    expect(membership.holdsCarriagePeer("peer-malformed")).toBe(false);
    expect(membership.holdsCarriagePeer("peer-absent")).toBe(false);   // unauthenticated → not named → STRANGER
  });

  test("FAIL CLOSED — no charter on disk → empty member set → every cross-operator STRANGER", async () => {
    const keys    = await Promise.all(SEEDS.map(pubOf));
    const peerMap = new Map<string, string>([["peer-kahu", `prefix:${keys[0]!}`]]);
    const { membership } = makeNexusMembership({ sealHome: bags, peerIdentifierMap: peerMap });   // bags empty
    expect(membership.holdsCarriagePeer("peer-kahu")).toBe(false);
  });

  test("refresh swaps the member set when the charter seats", async () => {
    const keys    = await Promise.all(SEEDS.map(pubOf));
    const peerMap = new Map<string, string>([["peer-kahu", `prefix:${keys[0]!}`]]);
    const holder  = makeNexusMembership({ sealHome: bags, peerIdentifierMap: peerMap });
    expect(holder.membership.holdsCarriagePeer("peer-kahu")).toBe(false);   // unseated → STRANGER

    writeNexusDoc(bags, await seatedCharter(keys));
    holder.refresh();
    expect(holder.membership.holdsCarriagePeer("peer-kahu")).toBe(true);    // seated → MEMBER
  });
});

// ── THE WIRE KEY BINDS TO THE NYM THROUGH THE CONTRACT EDGE ──────────────────────────────────────────────
// A contracted operator authenticates at the wire by its VESSEL key while the board names its PERSONA-ROOT
// nym. The persona root signs a device edge naming the vessel key (the contract credential the face carries);
// the gate proves it and keeps the nym beside the identifier; the consult reads that nym ahead of the raw key.
import { buildDeviceDelegation } from "@lararium/mesh";
import { contractNymOf } from "../src/nexus-carriage.js";

describe("the membership consult binds the wire key to the nym through the contract edge", () => {
  let bags: string;
  beforeEach(() => { bags = mkdtempSync(join(tmpdir(), "lares-nexus-contract-edge-")); });
  afterEach(() => { rmSync(bags, { recursive: true, force: true }); });

  const VESSEL_SEED = new Uint8Array(32).fill(11);
  const OTHER_VESSEL_SEED = new Uint8Array(32).fill(12);
  const NOW = Date.parse("2026-09-12T12:00:00Z");
  const edgeFor = async (rootSeed: Uint8Array, vesselKey: string) => buildDeviceDelegation({
    personaRootSeed: rootSeed, deviceVerifyingKey: vesselKey, hearthTrueName: "",
    issuedAt: "2026-09-12T11:00:00Z", expiresAt: "2026-09-13T11:00:00Z", boundEpoch: 0,
  });

  test("contractNymOf — the edge the contracted root signed over THIS vessel key answers the nym", async () => {
    const keys      = await Promise.all(SEEDS.map(pubOf));
    const vesselKey = await pubOf(VESSEL_SEED);
    const edge      = await edgeFor(SEEDS[0]!, vesselKey);
    expect(await contractNymOf(edge, `prefix:${vesselKey}`, NOW)).toBe(keys[0]);
  });

  test("CONTROL — an edge naming ANOTHER vessel key, a tampered signature, an expired edge: no nym", async () => {
    const vesselKey = await pubOf(VESSEL_SEED);
    const otherKey  = await pubOf(OTHER_VESSEL_SEED);
    const edge      = await edgeFor(SEEDS[0]!, vesselKey);
    expect(await contractNymOf(edge, `prefix:${otherKey}`, NOW)).toBeNull();                       // names another vessel
    const flipped   = edge.signature.slice(0, -2) + (edge.signature.endsWith("00") ? "01" : "00");
    expect(edge.signature).not.toBe(flipped);                                                        // the bytes MOVED
    expect(await contractNymOf({ ...edge, signature: flipped }, `prefix:${vesselKey}`, NOW)).toBeNull();
    expect(await contractNymOf(edge, `prefix:${vesselKey}`, Date.parse("2027-01-01T00:00:00Z"))).toBeNull();
  });

  test("a peer whose vessel key the contracted nym's edge names reads MEMBER; an unbound vessel key reads STRANGER; a kahu peer unchanged", async () => {
    const keys      = await Promise.all(SEEDS.map(pubOf));
    const vesselKey = await pubOf(VESSEL_SEED);
    const otherKey  = await pubOf(OTHER_VESSEL_SEED);
    writeNexusDoc(bags, await seatedCharter(keys));   // the seated kahu ARE contracted members (the strict subset)
    const edge = await edgeFor(SEEDS[0]!, vesselKey);
    const nym  = await contractNymOf(edge, `prefix:${vesselKey}`, NOW);
    expect(nym).toBe(keys[0]);

    const peerMap = new Map<string, string>([
      ["peer-contract", `prefix:${vesselKey}`],   // the wire key — a vessel, not the nym
      ["peer-unbound",  `prefix:${otherKey}`],    // a vessel key no contracted edge names
      ["peer-kahu",     `prefix:${keys[1]!}`],    // the nym itself at the wire (today's path)
    ]);
    const contractNyms = new Map<string, string>([["peer-contract", nym!]]);
    const { membership } = makeNexusMembership({ sealHome: bags, peerIdentifierMap: peerMap, peerContractNymMap: contractNyms });
    expect(membership.holdsCarriagePeer("peer-contract")).toBe(true);    // THE RED
    expect(membership.holdsCarriagePeer("peer-unbound")).toBe(false);    // CONTROL: byte-identical to today
    expect(membership.holdsCarriagePeer("peer-kahu")).toBe(true);        // CONTROL: the raw-nym path unchanged
    // CONTROL: the same peer map with NO contract nym keyed reads exactly as today.
    const today = makeNexusMembership({ sealHome: bags, peerIdentifierMap: peerMap });
    expect(today.membership.holdsCarriagePeer("peer-contract")).toBe(false);
  });
});
