/**
 * held-root-key-line — the gate reads an admitted nym's key LINE: it stands a presenter under the line's head, a
 * kapae on any key of the line closes the admit, and a line that forks reads denied.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import { describe, expect, test } from "vitest";
import { heldNexusRoot, readAdmitAtHeldRoot } from "../src/held-nexus-root.js";
import { makeMultiSigQuorumVerifier, signAntigenEntry, type KapaeAntigenEntry } from "../src/kapae-antigen.js";
import { signNexusKeyHandOver, type NexusKeyHandOver } from "../src/nexus-key-line.js";
import { verifyRaiseGrant, signRaiseGrant, type RaiseChallenge } from "../src/raise-challenge.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import { carriageAct, kahuSigners, pubOf, signerOf } from "./fixtures/carriage.js";

const ADMITTED = new Uint8Array(32).fill(61);
const NEXT = new Uint8Array(32).fill(62);
const THIRD = new Uint8Array(32).fill(63);

async function rootOf(charter: SeatedCharter, handOvers: readonly NexusKeyHandOver[] = [], antigen: readonly KapaeAntigenEntry[] = []) {
  const doc = await charter.doc({ labels: charter.keys.map((_, i) => `seat-${i}`) });
  const root = heldNexusRoot({ nexus: charter.aid, charter: doc, denyBoard: [], antigen, antigenVerifier: makeMultiSigQuorumVerifier(), handOvers });
  if ("absent" in root) throw new Error(`fixture root absent: ${root.absent}`);
  return root;
}
const handOver = async (charter: SeatedCharter, from: Uint8Array, to: Uint8Array) =>
  signNexusKeyHandOver({ nexus: charter.aid, from: await pubOf(from), to: await pubOf(to) }, signerOf(from), signerOf(to));
const kapaeOn = async (charter: SeatedCharter, nym: string) =>
  signAntigenEntry({ nym, action: "kapae", parents: [], sealEpochCid: charter.head.epochCid }, await kahuSigners(charter.seeds));

describe("the gate reads the admitted nym's key line", () => {
  test("G1 no hand-over: the head reads as the admitted nym itself (CONTROL)", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 701 });
    const admit = await carriageAct(ADMITTED, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid });
    const read = await readAdmitAtHeldRoot({ admit, lineage: [] }, await rootOf(charter));
    expect("verdict" in read && read.verdict.state).toBe("held");
    expect("head" in read && read.head).toBe(await pubOf(ADMITTED));
  });

  test("G2 a hand-over moves the head and leaves the admitted nym as the relation's name", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 702 });
    const admit = await carriageAct(ADMITTED, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid });
    const root = await rootOf(charter, [await handOver(charter, ADMITTED, NEXT)]);
    const read = await readAdmitAtHeldRoot({ admit, lineage: [] }, root);
    expect("verdict" in read && read.verdict.state).toBe("held");
    expect("verdict" in read && read.verdict.nym).toBe(await pubOf(ADMITTED));
    expect("head" in read && read.head).toBe(await pubOf(NEXT));
  });

  test("G3 a line that forks reads denied by name, whatever else holds", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 703 });
    const admit = await carriageAct(ADMITTED, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid });
    const root = await rootOf(charter, [await handOver(charter, ADMITTED, NEXT), await handOver(charter, ADMITTED, THIRD)]);
    const read = await readAdmitAtHeldRoot({ admit, lineage: [] }, root);
    expect("verdict" in read && read.verdict).toMatchObject({ state: "denied", reason: "key-line-forked" });
    expect("head" in read && read.head).toBe("");
  });

  test("G4 the antigen follows the hand-over: a kapae on the head, and a kapae on the admitted nym, each close the admit", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 704 });
    const admit = await carriageAct(ADMITTED, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid });
    const line = [await handOver(charter, ADMITTED, NEXT)];
    const onHead = await readAdmitAtHeldRoot({ admit, lineage: [] }, await rootOf(charter, line, [await kapaeOn(charter, await pubOf(NEXT))]));
    expect("verdict" in onHead && onHead.verdict).toMatchObject({ state: "denied", reason: "kapae-held" });
    const onAdmitted = await readAdmitAtHeldRoot({ admit, lineage: [] }, await rootOf(charter, line, [await kapaeOn(charter, await pubOf(ADMITTED))]));
    expect("verdict" in onAdmitted && onAdmitted.verdict).toMatchObject({ state: "denied", reason: "kapae-held" });
    // CONTROL: a kapae on a key off the line closes nothing.
    const offLine = await readAdmitAtHeldRoot({ admit, lineage: [] }, await rootOf(charter, line, [await kapaeOn(charter, await pubOf(THIRD))]));
    expect("verdict" in offLine && offLine.verdict.state).toBe("held");
  });

  test("G5 the root's revision moves with a hand-over the board carries", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 705 });
    const bare = await rootOf(charter);
    const moved = await rootOf(charter, [await handOver(charter, ADMITTED, NEXT)]);
    expect(moved.revision).not.toBe(bare.revision);
  });

  test("G6 a raise answers under the line's head alone, and its caps name the admitted nym", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 706 });
    const admit = await carriageAct(ADMITTED, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid });
    const root = await rootOf(charter, [await handOver(charter, ADMITTED, NEXT)]);
    const live: RaiseChallenge = { vesselId: "v".repeat(64), nexus: root.nexus, nonce: "5".repeat(64), epoch: 0 } as RaiseChallenge;
    const verify = async (nym: string, bytes: Uint8Array, sig: string) => (await import("../src/ed25519-door.js")).verifyEd25519(sig, bytes, nym);
    const byHead = await signRaiseGrant({ challenge: live, byNym: await pubOf(NEXT), presentedAdmit: { admit, lineage: [] }, sign: signerOf(NEXT) });
    const raised = await verifyRaiseGrant({ grant: byHead, live, readings: [root], verify });
    expect(raised).toMatchObject({ ok: true, caps: { byNym: await pubOf(ADMITTED) } });
    const byOld = await signRaiseGrant({ challenge: live, byNym: await pubOf(ADMITTED), presentedAdmit: { admit, lineage: [] }, sign: signerOf(ADMITTED) });
    expect(await verifyRaiseGrant({ grant: byOld, live, readings: [root], verify })).toMatchObject({ ok: false });
  });
});
