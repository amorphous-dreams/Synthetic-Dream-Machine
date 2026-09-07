/**
 * veil-on-the-roster — THE ROSTER CARRIES THE VEIL, NEVER THE RAW DEVICE KEY.
 *
 * Canon (persona-circle#the-vault): "A vessel joins each handle-group under a PER-HANDLE PSEUDONYMOUS
 * CREDENTIAL, never its raw device key… no roster carries a key that appears on another." The dyad veil
 * exists, mints at every ceremony, and answers exactly this description — these vectors assert the
 * PersonaGroup sentinel's CGKA roster reads the veil-keyed agent and never the vessel's Individual.
 *
 * Real Keyhive, no mocks. The veil-keyed identity is a full provider stood from the derived seed —
 * the same mechanics the cgka-enumeration bench proves for any cross-provider admission.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import { deriveDyadVeil, hexToBytes } from "@lararium/mesh";

const VESSEL_SEED = new Uint8Array(32).fill(7);

describe("the PersonaGroup roster under the veil", () => {
  // DECLARED RED — measured 2026-09-06: the roster reads two seats and neither is the veil; the raw
  // Individual sits where canon forbids it, because the vessel-keyed provider CREATES the sentinel
  // (the creator is a CGKA member by construction) and nothing stands a veil-keyed agent at all.
  // THE CURE'S MEASURED SHAPE: the group is BORN under a veil-keyed provider (seed derivable from the
  // vessel seed per group — deriveDyadVeil); the vessel holds no direct membership and operates AS the
  // veil at runtime — a per-group second identity at boot (ceremony + bootDaemonKeyhive + the daemon
  // behavior all move together). THE PROBE RAN (creator-self-eviction.probe.test.ts, 2026-09-07):
  // self-eviction REFUSED ("Redelagation error", keyhive's own refusal — a creator cannot leave its
  // roster), so the two-identity boot stands CONFIRMED as the arc's true size, not a worst case.
  // Wake condition: the two-identity boot lands, this unskips, both assertions green. Until then the raw vesselIdentifierHex on every group roster is the standing
  // cross-group correlator the veil exists to remove.
  test.skip("★ THE ROSTER CARRIES THE VEIL, NEVER THE RAW DEVICE KEY ★", async () => {
    // The founding shape as the ceremony runs it today: the vessel-keyed provider creates the
    // sentinel and seats itself. The ruled shape: the group is born under (or joined by) the
    // veil-keyed agent, and the raw Individual never lands on the CGKA roster.
    const vesselKh = new KeyhiveProvider();
    await vesselKh.init({ seed: VESSEL_SEED, eventStore: new InMemoryEventStore() });
    const vesselId = await vesselKh.vesselIdentifierHex();

    const { docIdHex } = await vesselKh.createSentinelDoc("lar:///ha.ka.ba/lares/api/persona-group-sentinel/veil-roster");

    const veil = await deriveDyadVeil(VESSEL_SEED, docIdHex);
    const veilKh = new KeyhiveProvider();
    await veilKh.init({ seed: hexToBytes(veil.signingKey), eventStore: new InMemoryEventStore() });
    const veilId = await veilKh.vesselIdentifierHex();

    const members = await vesselKh.sentinelCgkaMembers(docIdHex);
    expect(members, "the veil-keyed agent holds the seat").toContain(veilId);
    expect(members, "the raw device Individual never rides the roster").not.toContain(vesselId);
  });
});
