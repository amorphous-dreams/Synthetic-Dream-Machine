/**
 * offering-scope — the Offering Antigen scope ruling: a signed Offering act names its Nexus (the AID its charter's
 * signed inception mints) beside the epoch that authorized it, and a receiver folds it only inside its own scope,
 * at an epoch its own lineage holds, under that epoch's quorum.
 *
 *   S1  RED: the same quorum's act under another scope stays foreign evidence; the audit names it; CONTROL: under
 *       this scope it folds `held`.
 *   S2  An act the genesis quorum signed still folds after the charter rolls (its epoch stands in the lineage);
 *       RED: an act naming the rolled epoch but signed by the closed seats counts for nothing.
 *   S3  RED: a receiver whose lineage lacks the act's epoch reads `unavailable`, never `held` and never silence.
 *   S4  RED: a scope moved after signing breaks the act's identity, and a lineage that fails the roll law folds nothing.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed } from "../src/ed25519-door.js";
import { sha256BytesSync, utf8Bytes } from "../src/crypto.js";
import {
  auditOfferingAntigen, foldOfferingAntigenVerdicts, offeringReaderOfLineage, signOfferingKapae, type OfferingKapaeEntry,
} from "../src/offering-antigen.js";
import { bookSeat, heldCharter } from "./charter-fixture.js";

const seed = (name: string): Uint8Array => sha256BytesSync(utf8Bytes(`offering-scope|${name}`));
const key = (name: string): string => bookSeat(seed(name));
const hand = (name: string) => ({ signer: key(name), sign: ed25519SignerFromSeed(seed(name)) });
const OFFERING = "bafyOfferingScope";

/** A 2-of-2 charter over A0, B0 that rolls to A1, B1. */
async function charter() {
  const genesis = heldCharter({ keys: [key("A0"), key("B0")], threshold: 2, successors: { keys: [key("A1"), key("B1")], threshold: 2 } });
  const rolled = await genesis.roll([hand("A1"), hand("B1")]);
  return { aid: genesis.head.epochCid, genesis, rolled };
}

const ban = (scope: string, epoch: string, signers: readonly string[]): Promise<OfferingKapaeEntry> =>
  signOfferingKapae({ scope, pluginsCid: OFFERING, action: "kapae", parents: [], sealEpochCid: epoch }, signers.map(hand));

describe("an Offering act folds only inside its own scope and lineage", () => {
  test("S1 — RED: another scope stays foreign evidence; CONTROL: this scope folds held", async () => {
    const { aid, genesis } = await charter();
    const reader = offeringReaderOfLineage(genesis.chain);
    expect(reader.scope).toBe(aid);
    const foreign = await ban(`nexus-${"cd".repeat(32)}`, genesis.head.epochCid, ["A0", "B0"]);
    expect(await foldOfferingAntigenVerdicts([foreign], reader)).toEqual(new Map());
    expect((await auditOfferingAntigen([foreign], reader)).get(OFFERING)?.foreignActCids).toEqual([foreign.actCid]);
    const own = await ban(aid, genesis.head.epochCid, ["A0", "B0"]);
    expect(await foldOfferingAntigenVerdicts([foreign, own], reader)).toEqual(new Map([[OFFERING, "held"]]));
  });

  test("S2 — the genesis quorum's act still folds after the roll; the closed seats sign no rolled epoch", async () => {
    const { aid, genesis, rolled } = await charter();
    const reader = offeringReaderOfLineage(rolled.chain);
    const old = await ban(aid, genesis.head.epochCid, ["A0", "B0"]);
    expect(await foldOfferingAntigenVerdicts([old], reader)).toEqual(new Map([[OFFERING, "held"]]));
    const borrowed = await ban(aid, rolled.head.epochCid, ["A0", "B0"]);
    expect(await foldOfferingAntigenVerdicts([borrowed], reader)).toEqual(new Map());
    // CONTROL: the rolled seats' own act at the rolled epoch folds.
    expect(await foldOfferingAntigenVerdicts([await ban(aid, rolled.head.epochCid, ["A1", "B1"])], reader)).toEqual(new Map([[OFFERING, "held"]]));
  });

  test("S3 — RED: a lineage that lacks the act's epoch reads unavailable", async () => {
    const { aid, genesis, rolled } = await charter();
    const behind = offeringReaderOfLineage(genesis.chain);
    const fresh = await ban(aid, rolled.head.epochCid, ["A1", "B1"]);
    expect(await foldOfferingAntigenVerdicts([fresh], behind)).toEqual(new Map([[OFFERING, "unavailable"]]));
  });

  test("S4 — RED: a moved scope breaks the act; a lineage that fails the law folds nothing", async () => {
    const { aid, genesis, rolled } = await charter();
    const reader = offeringReaderOfLineage(genesis.chain);
    const act = await ban(`nexus-${"cd".repeat(32)}`, genesis.head.epochCid, ["A0", "B0"]);
    const moved = { ...act, scope: aid };
    expect(await foldOfferingAntigenVerdicts([moved], reader)).toEqual(new Map());
    expect((await auditOfferingAntigen([moved], reader)).get(OFFERING)?.rejectedActCids).toEqual([act.actCid]);
    // A lineage whose roll lost its signatures reads every epoch unseen.
    const torn = [rolled.chain[0]!, { ...rolled.chain[1]!, roll: { ...rolled.chain[1]!.roll!, signatures: [] } }];
    const own = await ban(aid, genesis.head.epochCid, ["A0", "B0"]);
    expect(await foldOfferingAntigenVerdicts([own], offeringReaderOfLineage(torn))).toEqual(new Map([[OFFERING, "unavailable"]]));
  });
});
