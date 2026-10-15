/**
 * persona-kel-fold.test — the one reader every KEL source folds through: VERIFY, THEN FOLD.
 *
 * A board any relay peer or sibling writes, a herm's drops and a chain a caller hands all fold the same way: at each
 * seat of the lineage only the events that verify against the head may compete, so junk never enters the pick.
 *
 * Proven, each red beside its control:
 *   · RED (D1): a junk veto naming the lawful rotation re-admits no device that rotation revoked;
 *   · RED (D1b): a junk rotation planted at head+1 BEFORE the lawful one lands wins nothing: the revoked edge stays
 *     refused and the rotator's own edge stands — whatever the board's write order;
 *   · RED: a veto signed by the standing op-key never kills a HARDENED rotation (a thief of the op-key vetoes nothing);
 *   · RED (M1): two quorum-signed rotations at one seat surface as a FORK in either write order, and the gate denies
 *     under it rather than let order settle duplicity;
 *   · RED: a revoked leaf booting fresh off the junk-planted board stands revoked, never under the old head;
 *   · CONTROL: a lawful rotation still revokes the edge it left out, junk or no junk; a lawful veto still kills the
 *     provisional it names.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { sha256HexSync } from "../src/crypto.js";
import {
  enrolmentDigestOf, personaEventCidOf, foldPersonaContests, mintVeto, verifyEdgeAgainstPersonaKel, type PersonaKelEvent,
} from "../src/persona-kel.js";
import { writePersonaKelEvent, personaKelChainForPrefix, personaKelFoldForPrefix } from "../src/persona-kel-board.js";
import { attestAndRotate } from "../src/recovery-keel-core.js";
import { rollEnrolments } from "../src/persona-group-secret.js";
import {
  SEEDS, pubOf, didOf, signerOf, founded, enrol, rotatedKeeping, provisionalKeeping, leafOf, memoryRelay, standLeaf,
  until, shutdown,
} from "./fixtures/sibling-fleet.js";

/** A veto no standing key signed, naming `target`: its cid recomputes, its signature is zeros. */
function junkVetoOf(inception: PersonaKelEvent, target: PersonaKelEvent): PersonaKelEvent {
  const core = {
    seq: target.seq, prefix: inception.prefix, opKeyDid: inception.opKeyDid, recoverySetHash: inception.recoverySetHash,
    nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: target.prevEventCid, provisional: false,
    vetoOfCid: target.eventCid, enrolmentDigest: enrolmentDigestOf([]),
  };
  return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [], vetoSig: "00".repeat(64) };
}

/** A rotation no quorum signed, to a key of the planter's own: its cid recomputes. */
function junkRotationOf(prev: PersonaKelEvent, n: number): PersonaKelEvent {
  const core = {
    seq: prev.seq + 1, prefix: prev.prefix, opKeyDid: `0x${sha256HexSync(`junk-${n}`)}`, recoverySetHash: prev.recoverySetHash,
    nextRecoverySetHash: prev.nextRecoverySetHash, prevEventCid: prev.eventCid, provisional: false, vetoOfCid: null,
    enrolmentDigest: enrolmentDigestOf([]),
  };
  return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
}

/** A board written in exactly `events`' order (Automerge op order). */
function boardOf(events: readonly PersonaKelEvent[]) {
  let doc = A.from<{ tiddlers: Record<string, unknown> }>({ tiddlers: {} });
  doc = A.change(doc, (d) => { for (const e of events) writePersonaKelEvent(d as never, e); });
  return doc as never;
}

/** The KEL rotated from the inception to `op` keeping `keep` — a lawful quorum-signed successor at seq 1. */
async function rotatedTo(op: Uint8Array, keep: readonly Uint8Array[]): Promise<PersonaKelEvent[]> {
  const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const devices = await Promise.all(keep.map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
  const enrolments = await rollEnrolments({ prefix: inception.prefix, opSeed: op, devices });
  const rot = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(op), guardianRecoveryKeys, recoveryThreshold, guardianSigners, enrolments });
  if (!rot.ok) throw new Error(rot.reason);
  return [inception, rot.event];
}

describe("persona-kel fold — verify, then fold: junk never enters the pick", () => {
  test("RED (D1): a junk veto naming the lawful rotation re-admits no device that rotation revoked; CONTROL: the lawful board refuses it", async () => {
    const [inception, rot] = await rotatedKeeping([SEEDS.deviceX]) as [PersonaKelEvent, PersonaKelEvent];   // Y revoked
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const lawful = personaKelChainForPrefix(boardOf([inception, rot]), inception.prefix)!;
    expect((await verifyEdgeAgainstPersonaKel(ey.edge, lawful, { expectedEpoch: 0 })).ok, "CONTROL: the rotation revokes Y").toBe(false);
    const planted = personaKelChainForPrefix(boardOf([inception, rot, junkVetoOf(inception, rot)]), inception.prefix)!;
    expect(planted.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
    const atk = await verifyEdgeAgainstPersonaKel(ey.edge, [inception, rot, junkVetoOf(inception, rot)], { expectedEpoch: 0 });
    expect(atk.ok, "the junk veto rolls nothing back").toBe(false);
    expect(atk.headOpKey).toBe(await didOf(SEEDS.opB));
    expect(atk.unreadable).toMatch(/veto is unsigned|does not verify against the standing op-key/);
  });

  test("RED (D1b): a junk rotation planted at head+1 before the lawful one lands wins nothing, in either board order", async () => {
    const [inception, rot] = await rotatedKeeping([SEEDS.deviceX]) as [PersonaKelEvent, PersonaKelEvent];
    const junk = junkRotationOf(inception, 0);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);   // revoked by rot
    const ex = await enrol(SEEDS.opB, SEEDS.deviceX, inception.prefix);   // the rotator's own edge, under the new head
    for (const order of [[inception, junk, rot], [inception, rot, junk]]) {
      const chain = personaKelChainForPrefix(boardOf(order), inception.prefix)!;
      expect(chain.map((e) => e.eventCid), "the lawful rotation holds the seat").toEqual([inception.eventCid, rot.eventCid]);
      expect((await verifyEdgeAgainstPersonaKel(ey.edge, order, { expectedEpoch: 0 })).ok, "the revoked edge stays refused").toBe(false);
      expect((await verifyEdgeAgainstPersonaKel(ex.edge, order, { expectedEpoch: 0 })).ok, "the new head's edge stands").toBe(true);
      expect(personaKelFoldForPrefix(boardOf(order), inception.prefix)!.setAside.map((x) => x.event.eventCid)).toEqual([junk.eventCid]);
    }
  });

  test("RED: a veto the standing op-key signs never kills a HARDENED rotation; CONTROL: it kills the provisional it names", async () => {
    const [inception, rot] = await rotatedKeeping([SEEDS.deviceX]) as [PersonaKelEvent, PersonaKelEvent];
    const thief = await mintVeto({ contested: rot, standing: inception, sign: signerOf(SEEDS.opA) });   // signed, lawful bytes
    const fold = foldPersonaContests([inception, rot, thief]);
    expect(fold.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
    expect(fold.setAside[0]!.reason).toMatch(/hardened rotation/);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    expect((await verifyEdgeAgainstPersonaKel(ey.edge, [inception, rot, thief], { expectedEpoch: 0 })).ok).toBe(false);
    expect((await verifyEdgeAgainstPersonaKel(ey.edge, personaKelChainForPrefix(boardOf([inception, rot, thief]), inception.prefix)!, { expectedEpoch: 0 })).ok, "through the board").toBe(false);
    const { provisional, veto } = await provisionalKeeping([SEEDS.deviceX]);
    expect(foldPersonaContests([inception, provisional, veto]).kel.map((e) => e.eventCid)).toEqual([inception.eventCid, veto.eventCid]);
  });

  test("RED (M1): two quorum-signed rotations at one seat surface as a FORK in either order, and the gate denies under it", async () => {
    const b = await rotatedTo(SEEDS.opB, [SEEDS.deviceX]);
    const c = await rotatedTo(SEEDS.opC, [SEEDS.deviceX]);
    const inception = b[0]!;
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const exB = await enrol(SEEDS.opB, SEEDS.deviceX, inception.prefix);
    for (const order of [[inception, b[1]!, c[1]!], [inception, c[1]!, b[1]!]]) {
      const fold = foldPersonaContests(order);
      expect(fold.kel.map((e) => e.eventCid), "the lineage stops before the fork").toEqual([inception.eventCid]);
      expect(fold.fork?.events.map((e) => e.eventCid).sort()).toEqual([b[1]!.eventCid, c[1]!.eventCid].sort());
      for (const edge of [ex.edge, exB.edge]) {
        const v = await verifyEdgeAgainstPersonaKel(edge, order, { expectedEpoch: 0 });
        expect(v.ok, "a fork admits no edge").toBe(false);
        expect(v.fork).toMatch(/forks at seq 1/);
      }
      // The board hands both tips after the lineage, so a reader that walks the chain whole refuses it.
      expect(personaKelChainForPrefix(boardOf(order), inception.prefix)!.map((e) => e.seq)).toEqual([0, 1, 1]);
    }
    // CONTROL: one lawful rotation alone admits its own edge.
    expect((await verifyEdgeAgainstPersonaKel(exB.edge, b, { expectedEpoch: 0 })).ok).toBe(true);
  });

  test("RED (D1c): a revoked leaf booting fresh off the junk-planted board stands revoked, never under the old head", async () => {
    const [inception, rot] = await rotatedKeeping([SEEDS.deviceX]) as [PersonaKelEvent, PersonaKelEvent];
    const planted = [inception, rot, junkVetoOf(inception, rot)];
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, planted), memoryRelay(), { drops: null });
    try {
      await until(() => y.refusals.some((r) => r.suspect === "self" && r.cause === "revoked"), "y to read itself revoked");
      expect(y.adapter.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
      expect(y.adapter.status().self).toBe("revoked");
    } finally { await shutdown(y); }
  });
});
