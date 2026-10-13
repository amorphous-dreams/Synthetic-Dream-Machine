/**
 * held-nexus-root vectors — each names its control beside the property it witnesses.
 */
import { describe, expect, test } from "vitest";
import { carriageEntryActCid, signCarriageQuorum, signCarriageContract, verifyPresentedAdmit, type CarriageEntry } from "../src/carriage-registry.js";
import { heldNexusRoot, heldRootFor, heldRootRevision, NO_HELD_ROOT, readAdmitAtHeldRoot } from "../src/held-nexus-root.js";
import { presentedAdmitReader } from "../src/face-gate.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { NEXUS_DOC_DOMAIN } from "../src/domains.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import { carriageAct, pubOf, signerOf } from "./fixtures/carriage.js";

const subject = new Uint8Array(32).fill(41);

async function docOf(charter: SeatedCharter) {
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: charter.threshold, sealEpochCid: charter.head.epochCid,
    sealLineage: charter.chain,
    kahu: charter.keys.map((verifyingKey, i) => ({ displayName: `seat-${i}`, verifyingKey })),
  };
}

async function rootOf(charter: SeatedCharter, denyBoard: readonly CarriageEntry[] = []) {
  const doc = await docOf(charter);
  const root = heldNexusRoot({ nexus: charter.aid, charter: doc, denyBoard, antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) throw new Error(`fixture root absent: ${root.absent}`);
  return { root, doc };
}

async function admitAt(charter: SeatedCharter, nymSeed = subject) {
  return carriageAct(nymSeed, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid });
}

describe("heldNexusRoot binds a kept, seated charter", () => {
  test("H1 a seated charter filed under its genesis answers its head root; controls name each absence", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 501 });
    const doc = await docOf(charter);
    const result = heldNexusRoot({ nexus: charter.aid, charter: doc, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
    expect("absent" in result).toBe(false);
    if (!("absent" in result)) {
      expect(result.nexus).toBe(charter.chain[0]!.epochCid);
      expect(result.roster.sealEpochCid).toBe(charter.head.epochCid);
      expect(result.sealLineage).toEqual(charter.chain);
    }
    expect(heldNexusRoot({ nexus: charter.aid, charter: null, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() })).toEqual({ absent: "no-charter" });
    expect(heldNexusRoot({ nexus: "another-name", charter: doc, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() })).toEqual({ absent: "charter-names-another-nexus" });
    const foreignSeat = (await seatedCharter({ seats: 3, threshold: 2, seed: 510 })).keys[0]!;
    const unseated = { ...doc, kahu: doc.kahu.map((seat, i) => i === 0 ? { ...seat, verifyingKey: foreignSeat } : seat) };
    expect(heldNexusRoot({ nexus: charter.aid, charter: unseated, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() })).toEqual({ absent: "charter-unseated" });
    expect(heldNexusRoot({ nexus: charter.aid, charter: { ...doc, sealLineage: [] }, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() })).toEqual({ absent: "charter-unseated" });
  });
});

describe("readAdmitAtHeldRoot never takes a presenter's roster", () => {
  test("H2 null and undefined roots refuse; the control reads the same admit held at its root", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 502 });
    const { root } = await rootOf(charter);
    const admit = await admitAt(charter);
    const arm = { admit, lineage: [] };
    expect(await readAdmitAtHeldRoot(arm, null)).toEqual({ refusal: "no-held-root" });
    expect(await readAdmitAtHeldRoot(arm, undefined)).toEqual({ refusal: "no-held-root" });
    const answer = await readAdmitAtHeldRoot(arm, root);
    expect("verdict" in answer && answer.verdict.state).toBe("held");
    if ("verdict" in answer) {
      expect(answer.nexus).toBe(root.nexus);
      expect(answer.admitRef).toBe(carriageEntryActCid(admit));
      expect(answer.revision).toBe(root.revision);
    }
  });

  test("H3 presenter-chosen quorum keys reject at this root; control verifies held with the presenter's roster", async () => {
    const vesselCharter = await seatedCharter({ seats: 3, threshold: 2, seed: 503 });
    const presenterCharter = await seatedCharter({ seats: 3, threshold: 2, seed: 504 });
    const { root } = await rootOf(vesselCharter);
    const subjectKey = await pubOf(subject);
    const presentedAdmit = await signCarriageQuorum(
      { nym: subjectKey, action: "admit", parents: [], sealEpochCid: vesselCharter.head.epochCid },
      await Promise.all(presenterCharter.seeds.map(async (seed) => ({ signer: await pubOf(seed), sign: signerOf(seed) }))),
      await signCarriageContract(subjectKey, vesselCharter.head.epochCid, signerOf(subject)),
    );
    const arm = { admit: presentedAdmit, lineage: [] };
    const atVessel = await readAdmitAtHeldRoot(arm, root);
    expect("verdict" in atVessel && atVessel.verdict.state).toBe("rejected");
    const presenterRoot = (await rootOf(presenterCharter)).root;
    const ownRoster = await verifyPresentedAdmit({ admit: presentedAdmit, lineage: [], roster: { ...presenterRoot.roster, sealEpochCid: vesselCharter.head.epochCid }, denyBoard: [], antigen: [], antigenRoster: presenterRoot.antigenRoster, antigenVerifier: presenterRoot.antigenVerifier });
    expect(ownRoster.state).toBe("held");
  });
});

describe("held roots resolve epochs and revisions", () => {
  test("H4 head and ancestor epochs choose their root; absent epochs and other Nexuses choose none", async () => {
    const first = await seatedCharter({ seats: 3, threshold: 2, seed: 505 });
    const rolled = await first.roll();
    const firstRoot = (await rootOf(first)).root;
    const rolledRoot = (await rootOf(rolled)).root;
    expect(heldRootFor({ sealEpochCid: first.head.epochCid }, [firstRoot])).toBe(firstRoot);
    expect(heldRootFor({ sealEpochCid: first.head.epochCid }, [rolledRoot])).toBe(rolledRoot);
    expect(heldRootFor({ sealEpochCid: "unheld-epoch" }, [firstRoot, rolledRoot])).toBeNull();
    expect(heldRootFor(null, [firstRoot])).toBeNull();
    expect(heldRootFor({ sealEpochCid: "" }, [firstRoot])).toBeNull();
    const other = (await rootOf(await seatedCharter({ seats: 3, threshold: 2, seed: 506 }))).root;
    expect(heldRootFor({ sealEpochCid: first.head.epochCid }, [other])).toBeNull();
  });

  test("H5 revisions ignore act order and change with a deny, antigen act, or head", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 509 });
    const deny = await carriageAct(subject, "revoke", { kahu: charter.seeds, epoch: charter.head.epochCid });
    const antigenA = { actCid: "antigen-a" } as never, antigenB = { actCid: "antigen-b" } as never;
    const base = heldRootRevision(charter.head.epochCid, [], []);
    expect(heldRootRevision(charter.head.epochCid, [], [])).toBe(base);
    expect(heldRootRevision(charter.head.epochCid, [], [antigenA, antigenB])).toBe(heldRootRevision(charter.head.epochCid, [], [antigenB, antigenA]));
    const withDeny = heldRootRevision(charter.head.epochCid, [deny], []);
    const withAntigen = heldRootRevision(charter.head.epochCid, [], [antigenA, antigenB]);
    const nextHead = heldRootRevision(`${charter.head.epochCid}-next`, [], []);
    expect(new Set([base, withDeny, withAntigen, nextHead]).size).toBe(4);
    expect(base).toMatch(/^\S+$/);
    expect(base).not.toMatch(/[ |]/);
  });
});

describe("doors use the held-root verifier", () => {
  test("H6 a descending deny-board revoke denies through the door; control without the revoke holds", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 507 });
    const admit = await admitAt(charter);
    const revoke = await carriageAct(subject, "revoke", { kahu: charter.seeds, epoch: charter.head.epochCid, parents: [carriageEntryActCid(admit)] });
    const withRevoke = (await rootOf(charter, [admit, revoke])).root;
    const emptyBoard = (await rootOf(charter)).root;
    expect(await readAdmitAtHeldRoot({ admit, lineage: [] }, withRevoke)).toMatchObject({ verdict: { state: "denied" } });
    expect(await readAdmitAtHeldRoot({ admit, lineage: [] }, emptyBoard)).toMatchObject({ verdict: { state: "held" } });
  });

  test("H7 reader refusal shares its name; control returns the held-root reading", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 508 });
    const { root } = await rootOf(charter);
    const admit = await admitAt(charter);
    const arm = { admit, lineage: [] };
    expect(await presentedAdmitReader(() => null).read(arm)).toEqual({ refusal: NO_HELD_ROOT });
    expect(await presentedAdmitReader(() => root).read(arm)).toEqual(await readAdmitAtHeldRoot(arm, root));
  });
});
