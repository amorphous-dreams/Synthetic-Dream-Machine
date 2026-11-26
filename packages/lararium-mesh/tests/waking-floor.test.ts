/**
 * What a vessel stands as when its archive will not open.
 *
 * The starred tests carry the two rulings. A hearth whose archive holds shut must still STAND — refusing
 * turns a power cut into an outage — and it must stand as the class that is faceless BY LAW, not as a
 * hearth with its faces quietly missing.
 */
import { describe, expect, test, vi } from "vitest";

import { charterHandLineage } from "../src/charter-hand-lineage.js";
import { quorumLeaseEpoch, signQuorumLease } from "../src/quorum-lease.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import { personaSlotCeiling, raiseStands, standAs, standingClass } from "../src/vessel-standing.js";
import { sha256HexBytesSync } from "../src/crypto.js";
import { assembleFloorRelease, foldFloorReleases, openFloorReleaseBody, type FloorRelease } from "../src/floor-release.js";
import { clearFloorPick } from "../src/clear-recipe.js";

describe("★ every node stands first as a Herm ★", () => {
  test("★ a hearth whose archive holds shut STANDS — at the floor, never refusing ★", () => {
    // Refusing converts an ordinary restart into an outage. The seal exists against a stolen disk, never
    // to gate a power cut.
    expect(standAs("hearth", false)).toBe("herm");
  });

  test("★ standing at the floor is FACELESS BY LAW, not a hearth missing its faces ★", () => {
    // The class carries the guarantee structurally: no dial raises a Herm's ceiling, so a vessel at the
    // floor cannot stand a persona root even by mistake.
    const cls = standAs("hearth", false);
    expect(personaSlotCeiling(cls)).toBe(0);
    expect(personaSlotCeiling(cls, 99)).toBe(0);
  });

  test("an open archive stands the class that was asked for — the operator lit the fire", () => {
    expect(standAs("hearth", true)).toBe("hearth");
    expect(standAs("leaf", true)).toBe("leaf");
  });

  test("a Herm stands as asked whatever the archive says — nothing about it waits on a raise", () => {
    expect(standAs("herm", false)).toBe("herm");
    expect(standAs("herm", true)).toBe("herm");
  });
});

describe("★ one floor, not two kinds of Herm ★", () => {
  test("★ an unraised crossroads and a shut hearth stand in the SAME state ★", () => {
    // Naming them apart froze a difference that does not survive contact: any vessel at the floor may be
    // raised when someone who can raise it arrives.
    expect(standAs("herm", false)).toBe(standAs("hearth", false));
  });
});

describe("★ the raise rides the LEASE EPOCH the house already rolls — no clock, no second mechanism ★", () => {
  const raise = (boundEpoch: number, nexus = "nx1") => ({ byNym: "kai", nexus, boundEpoch });
  const at = (effective: number, nexus = "nx1") => ({ nexus, effective });

  test("★ a raise stands until its Nexus rolls PAST the epoch it bound to ★", () => {
    expect(raiseStands(raise(7), at(7))).toBe(true);   // issued at the current epoch — stands
    expect(raiseStands(raise(7), at(6))).toBe(true);   // the Nexus has not caught up yet
  });

  test("★ it ends by NON-RENEWAL — expiry without any duration anyone must agree on ★", () => {
    // Nothing lowered the raise. The Nexus rolled its lease and the grant simply stopped being current,
    // exactly as `device-delegation` goes stale against the same max-register.
    expect(raiseStands(raise(7), at(8))).toBe(false);
  });

  test("★ a replayed raise self-revokes once the epoch has rolled ★", () => {
    expect(raiseStands(raise(1), at(9))).toBe(false);
  });

  test("★ an epoch means NOTHING outside the Nexus that rolls it ★", () => {
    // A vessel standing in two Nexuses holds two epochs, and neither answers for the other.
    expect(raiseStands(raise(7, "nx1"), at(7, "nx2"))).toBe(false);
  });

  test("the vessel falls BACK to its floor, not to some third state", () => {
    expect(standingClass("herm", raise(7), at(7))).toBe("hearth");
    expect(standingClass("herm", raise(7), at(8))).toBe("herm");
  });

  test("no raise, or no epoch read, stands at the floor", () => {
    expect(raiseStands(null, at(7))).toBe(false);
    expect(raiseStands(raise(7), null)).toBe(false);
  });

  test("a raise reads the signed lease fold at its fence", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 7 });
    const hand = charterHandLineage(charter.chain)!;
    const signers = (await charter.signers()).slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign }));
    const fence = quorumLeaseEpoch("realm", [JSON.stringify(await signQuorumLease({ resource: "realm", epoch: 1, lineage: hand.lineage }, signers))], hand.lineage);
    expect(fence).toBe(1);
    expect(raiseStands(raise(1), at(fence))).toBe(true);
    expect(raiseStands(raise(0), at(fence))).toBe(false);
    expect(quorumLeaseEpoch("realm", [], null)).toBe(0);
  });
});

describe("★ the clear floor a waking vessel mounts ~ the newest release it carries, never accepted here ★", () => {
  const GENESIS = "9".repeat(64);
  const manifests = new Map<string, Uint8Array>();
  const manifestN = (n: number): Uint8Array => { const b = new TextEncoder().encode(`clear floor manifest ${n}`); manifests.set(sha256HexBytesSync(b), b); return b; };
  async function release(c: SeatedCharter, manifestBytes: Uint8Array, prior: string | null = null): Promise<FloorRelease> {
    const body = openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior, manifest: sha256HexBytesSync(manifestBytes) });
    const [steward] = await c.signers([0]);
    return assembleFloorRelease({ body, lineage: c.chain, manifestBytes, steward: steward!, approvers: [...await c.signers()] });
  }
  const carried = (c: SeatedCharter, releases: readonly FloorRelease[]) => foldFloorReleases({
    rows: releases.map((r) => ({ keyCid: r.cid, record: JSON.parse(JSON.stringify(r)) as unknown })), nexus: c.aid,
    manifestBytesOf: (cid) => manifests.get(cid) ?? null,
  });

  test("no board, and a board no release counts on, each mount genesis", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    expect(clearFloorPick({ genesis: GENESIS, carriedHead: null })).toEqual({ cid: GENESIS, stamp: "genesis", head: null });
    const orphan = await release(c, manifestN(1), "7".repeat(64));
    const standing = await carried(c, [orphan]);
    expect(standing.standing).toBe("absent");
    expect(clearFloorPick({ genesis: GENESIS, carriedHead: standing })).toEqual({ cid: GENESIS, stamp: "genesis", head: null });
    expect(clearFloorPick({ genesis: null, carriedHead: standing })).toEqual({ cid: null, stamp: "genesis", head: null });
  });

  test("★ one counted head mounts stamped carried-unaccepted, and the stamp names the head release's CID ★", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const first = await release(c, manifestN(2));
    const second = await release(c, manifestN(3), first.cid);
    expect(clearFloorPick({ genesis: GENESIS, carriedHead: await carried(c, [first]) }))
      .toEqual({ cid: first.body.manifest, stamp: "carried-unaccepted", head: first.cid });
    expect(clearFloorPick({ genesis: GENESIS, carriedHead: await carried(c, [first, second]) }))
      .toEqual({ cid: second.body.manifest, stamp: "carried-unaccepted", head: second.cid });
  });

  test("★ two heads standing mount genesis: the pick never chooses a side of a fork ★", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const first = await release(c, manifestN(4));
    const left = await release(c, manifestN(5), first.cid);
    const right = await release(c, manifestN(6), first.cid);
    const standing = await carried(c, [first, left, right]);
    expect(standing.standing).toBe("unsettled");
    expect(clearFloorPick({ genesis: GENESIS, carriedHead: standing })).toMatchObject({ cid: GENESIS, stamp: "genesis", head: null });
  });

  test("★ the pick takes no clock: one argument, and the same answer at any wall time or under a smuggled one ★", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const standing = await carried(c, [await release(c, manifestN(7))]);
    expect(clearFloorPick.length).toBe(1);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const early = clearFloorPick({ genesis: GENESIS, carriedHead: standing });
      vi.setSystemTime(Date.UTC(2100, 0, 1));
      const late = clearFloorPick({ genesis: GENESIS, carriedHead: standing });
      const smuggled = clearFloorPick({ genesis: GENESIS, carriedHead: standing, now: 1, asOf: "2100-01-01" } as Parameters<typeof clearFloorPick>[0]);
      expect(late).toEqual(early);
      expect(smuggled).toEqual(early);
      expect(Object.keys(early).sort()).toEqual(["cid", "head", "stamp"]);
    } finally { vi.useRealTimers(); }
  });
});
