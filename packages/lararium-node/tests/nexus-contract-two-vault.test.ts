/**
 * nexus-contract-two-vault — an admit or revoke of a two-founder Nexus crosses its two vaults as a PARTIAL, judged
 * before every signature, and lands on each vault's own board once both seats signed. Each vault stands under its
 * own scratch root, custody and Repo; the joint Nexus founds through the cofound door, and every file crosses as
 * JSON text.
 *
 *   V1  THE SELF-CONTRACT: A opens an admit of its own per-Nexus leaf (A's seat signs, A's leaf consents); B judges it
 *       `ready`, cosigns with B's seat and lands it (`complete`); A lands the completed partial too. Both boards read
 *       A's leaf a member, and neither vault ever held the other's seat.
 *   V2  RED: nothing signs or lands on a partial the judge refuses: the same act again (`replay`), a revoke A opened
 *       before its own board held the admit (`stale`), a partial under another Nexus, a torn file, a partial its own
 *       vault cannot advance, and a carry; the board B holds keeps its count through every refusal.
 *   V3  RED: the board moves while B's seat signs (a handshake inside the signer lands another act for the same
 *       nym first): the act B just cosigned reads stale at the write, and nothing lands.
 *   V6  RED: the board moves while A's seat signs an open (the handshake lands the completed admit first): the
 *       revoke A signed reads stale on A's own judge, and no partial leaves.
 *   V4  RED: an admit whose supplied contract-in does not verify refuses before any seat signs.
 *   V5  The store door's rows carry the same act (the path `lares nexus contract --out` and `--partial` take), and
 *       a refusal answers under the row's own name.
 * A 2-of-3 control and the whole-quorum and no-seat open refusals wait on a fixture that seats such a roster beside
 * a joint Nexus (train N step 5's add-a-chair roll); the cofound door founds two of two.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

/** A handshake inside every seat signature: a vector may run one step before the next signature completes. */
const signing = vi.hoisted(() => ({ calls: 0, before: null as null | (() => Promise<void>) }));
vi.mock("../src/seat-key-store.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/seat-key-store.js")>();
  return {
    ...real,
    signAsSeat: async (key: string, image: Uint8Array): Promise<Uint8Array> => {
      signing.calls += 1;
      const before = signing.before;
      signing.before = null;
      if (before) await before();
      return real.signAsSeat(key, image);
    },
  };
});
import { mintColdKey, seatFingerprint, cidV1Sha256, foldCarriageDetails, carriageEntriesFromBoard, carriageDocUrl, materializeSharedLarDoc,
  holdsCarriage, foundingRoster, KAPAE_ANTIGEN_DOMAIN, antigenActCid, nexusActPartial, type CofoundOffer, type KapaeAntigenEntry } from "@lararium/mesh";
import { charterHomeFor } from "../src/carried-set.js";
import { NexusContractError, runNexusContractOpen, runNexusContractPartial } from "../src/commands/nexus-contract.js";
import { takeAdmitBundle } from "../src/admit-bundle.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { mintNexusLeaf } from "../src/nexus-leaf.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { storeDoorReactors } from "../src/store-door-verbs.js";
import { heldSeatKey } from "../src/seat-key-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { restEvery, restingRepo, type RestingRepo } from "./resting-repo.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
const drops: SeatedScratchCustody[] = [];
afterEach(async () => {
  await restEvery();
  for (const c of drops.splice(0).reverse()) await c.drop();
});

const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";
const courier = <T>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
const act = (name: string, args: Record<string, unknown>) => runSealedAct(name, args, ctx);
const nextDigest = async (): Promise<string> => { const k = await mintColdKey(); k.seed.fill(0); return k.digest; };

interface Vault { readonly c: SeatedScratchCustody; readonly repo: RestingRepo }
async function vault(label: string): Promise<Vault> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  return { c, repo: restingRepo(larDataDir()) };
}
const at = (v: Vault): void => { process.env["LAR_ROOT"] = v.c.root; };

/** Found one joint Nexus across A and B through the cofound door; answers its AID and both seats. */
async function jointNexus(A: Vault, B: Vault): Promise<{ aid: string; aSeat: string; bSeat: string }> {
  at(A);
  const opened = await act("cofound.open", { face: 0, next: await nextDigest(), charterLaw: LAW, manifest: MANIFEST }) as { offer: CofoundOffer };
  at(B);
  const joined = await act("cofound.join", { face: 0, offer: courier(opened.offer), heard: seatFingerprint(opened.offer.seat), next: await nextDigest() }) as { join: { seat: string } };
  at(A);
  const sealed = await act("cofound.seal", { join: courier(joined.join), heard: seatFingerprint(joined.join.seat) }) as { inception: unknown; charter: { aid: string } };
  at(B);
  await act("cofound.accept", { inception: courier(sealed.inception) });
  return { aid: sealed.charter.aid, aSeat: opened.offer.seat, bSeat: joined.join.seat };
}

/** Whether `nym` stands a member on this vault's own board for the joint Nexus. */
async function memberHere(v: Vault, aid: string, nym: string): Promise<boolean> {
  at(v);
  const home = charterHomeFor(larSealHome(), aid)!;
  const roster = foundingRoster(readNexusDoc(home));
  const handle = await materializeSharedLarDoc(v.repo, carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:carriage-contracts");
  return holdsCarriage(nym, (await foldCarriageDetails(carriageEntriesFromBoard(handle.doc()), roster)).members);
}

/** How many entries this vault's own board holds for the joint Nexus. */
async function boardCount(v: Vault, aid: string): Promise<number> {
  at(v);
  const home = charterHomeFor(larSealHome(), aid)!;
  const handle = await materializeSharedLarDoc(v.repo, carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:carriage-contracts");
  return carriageEntriesFromBoard(handle.doc()).length;
}

const refusal = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof NexusContractError ? e.message : `${(e as Error).constructor.name}: ${(e as Error).message}`));

describe("a two-founder Nexus contracts across its two vaults", () => {
  test("V1 — A's self-contract: A opens, B judges and cosigns and lands, A lands the completed act", async () => {
    const A = await vault("two-a"), B = await vault("two-b");
    const { aid, aSeat, bSeat } = await jointNexus(A, B);
    at(A);
    expect(heldSeatKey(bSeat)).toBeNull();
    const leaf = await mintNexusLeaf(0, aid);
    const opened = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });
    expect(opened.verdict).toBe("ready");
    expect(opened.signed).toEqual([aSeat]);
    // The admit SIGNS the opening hearth's gate pin and canon list (face-proof#/the-gate-exchange, step 5).
    const aGate = (await loadVesselVerifyingKey()).toLowerCase();
    const signedCarriage = opened.partial.act.family === "admit" ? opened.partial.act.entry.carriage : undefined;
    expect(signedCarriage?.gatePin).toBe(aGate);
    expect(opened.landed).toBeNull();
    expect(await memberHere(A, aid, leaf.verifyingKey)).toBe(false);

    at(B);
    expect(heldSeatKey(aSeat)).toBeNull();
    const cosigned = await runNexusContractPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    expect(cosigned.signed).toEqual([aSeat, bSeat].sort());
    expect(cosigned.landed?.memberHeld).toBe(true);
    expect(cosigned.landed?.contractIn).toBe("supplied");
    // B lands A's act, so B's bundle names the pin the admit signed, never B's own gate key.
    const bGate = (await loadVesselVerifyingKey()).toLowerCase();
    expect(bGate).not.toBe(aGate);
    expect(cosigned.landed?.bundle?.gatePubKey).toBe(aGate);

    at(A);
    const landed = await runNexusContractPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo });
    expect(landed.verdict).toBe("complete");
    expect(landed.landed?.evidenceCid).toBe(cosigned.landed?.evidenceCid);
    expect(await memberHere(A, aid, leaf.verifyingKey)).toBe(true);
    expect(await memberHere(B, aid, leaf.verifyingKey)).toBe(true);

    // The bundle B landed takes on A, and hands out the canon list the quorum signed.
    at(A);
    const taken = await takeAdmitBundle({ sealHome: larSealHome(), raw: JSON.stringify(cosigned.landed!.bundle) });
    expect(taken.gatePubKey).toBe(aGate);
    expect(taken.canon).toEqual(signedCarriage?.canon);
  });

  test("V2 — nothing signs or lands where the judge refuses", async () => {
    const A = await vault("two-ra"), B = await vault("two-rb");
    const { aid } = await jointNexus(A, B);
    at(A);
    const leaf = await mintNexusLeaf(0, aid);
    const opened = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });
    // A holds one seat of two: its own partial waits on B's, and A's door says so rather than signing twice.
    expect(await refusal(runNexusContractPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: A.repo }))).toMatch(/waits on a seat this vessel does not hold/);
    // A revoke A opens now cites A's board, where the admit has not landed.
    const revoke = await runNexusContractOpen({ action: "revoke", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });

    at(B);
    const cosigned = await runNexusContractPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    const held = await boardCount(B, aid);
    at(B);
    // The same act again reads replay on B, and nothing signs.
    expect(await refusal(runNexusContractPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads replay/);
    expect(await refusal(runNexusContractPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads replay/);
    // The revoke A opened before its board held the admit names a line B's board moved past: stale, and the member stands.
    expect(await refusal(runNexusContractPartial({ partial: courier(revoke.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads stale/);
    expect(await memberHere(B, aid, leaf.verifyingKey)).toBe(true);
    // A partial under a Nexus B never carried refuses before any read of a board.
    const foreign = { ...courier(opened.partial), aid: `nexus-${"cd".repeat(32)}` };
    expect(await refusal(runNexusContractPartial({ partial: foreign, sealHome: larSealHome(), repo: B.repo }))).toMatch(/holds no charter/);
    // A torn file reads as no partial.
    expect(await refusal(runNexusContractPartial({ partial: { ...courier(opened.partial), extra: 1 }, sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads as no admit or revoke partial/);
    // A kapae partial reads well at its own family, and the contract door still takes it as no admit or revoke.
    const ban = { kind: KAPAE_ANTIGEN_DOMAIN, nym: leaf.verifyingKey, action: "kapae", actCid: "", parents: [], sealEpochCid: opened.partial.act.family === "admit" ? opened.partial.act.entry.sealEpochCid : "",
      signatures: [{ signer: "ab".repeat(32), sig: "cd".repeat(64) }] } as KapaeAntigenEntry;
    const kapae = nexusActPartial(aid, { family: "kapae", entry: { ...ban, actCid: antigenActCid(ban) } });
    expect(await refusal(runNexusContractPartial({ partial: courier(kapae), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads as no admit or revoke partial/);
    // A carry crosses no vaults as a partial.
    expect(await refusal(runNexusContractOpen({ action: "carry", nym: leaf.verifyingKey, carrierSig: "00".repeat(64), sealHome: larSealHome(), repo: B.repo, aid }))).toMatch(/crosses no vaults/);
    expect(await boardCount(B, aid)).toBe(held);
  });

  test("V3 — a board that moves while B's seat signs takes no stale act", async () => {
    const A = await vault("two-ma"), B = await vault("two-mb");
    const { aid } = await jointNexus(A, B);
    at(A);
    const leaf = await mintNexusLeaf(0, aid);
    // Both acts cite A's empty line for the nym.
    const admit = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });
    const revoke = await runNexusContractOpen({ action: "revoke", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });
    at(B);
    // CONTROL: the revoke reads ready on B's board as it stands before the handshake.
    // HANDSHAKE: B's seat signs the revoke only after the admit lands on B's board.
    signing.before = async () => {
      const first = await runNexusContractPartial({ partial: courier(admit.partial), sealHome: larSealHome(), repo: B.repo });
      expect(first.landed?.memberHeld).toBe(true);
    };
    expect(await refusal(runNexusContractPartial({ partial: courier(revoke.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads stale on this vessel at the write/);
    expect(signing.before).toBeNull();
    expect(await boardCount(B, aid)).toBe(1);
    expect(await memberHere(B, aid, leaf.verifyingKey)).toBe(true);
  });

  test("V6 — an open whose board moves while its seat signs hands back no stale partial", async () => {
    const A = await vault("two-oa"), B = await vault("two-ob");
    const { aid } = await jointNexus(A, B);
    at(A);
    const leaf = await mintNexusLeaf(0, aid);
    const admit = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });
    at(B);
    const done = await runNexusContractPartial({ partial: courier(admit.partial), sealHome: larSealHome(), repo: B.repo });
    expect(done.verdict).toBe("complete");
    at(A);
    expect(await boardCount(A, aid)).toBe(0);
    // HANDSHAKE: A's seat signs the revoke only after the completed admit lands on A's board.
    signing.before = async () => {
      const landed = await runNexusContractPartial({ partial: courier(done.partial), sealHome: larSealHome(), repo: A.repo });
      expect(landed.landed?.memberHeld).toBe(true);
    };
    at(A);
    expect(await refusal(runNexusContractOpen({ action: "revoke", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid }))).toMatch(/the partial this vessel signed reads stale here/);
    expect(signing.before).toBeNull();
    // CONTROL: opened now, the revoke cites the admit and reads ready.
    at(A);
    expect((await runNexusContractOpen({ action: "revoke", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid })).verdict).toBe("ready");
  });

  test("V4 — an admit whose contract-in does not verify refuses before any seat signs", async () => {
    const A = await vault("two-ca"), B = await vault("two-cb");
    const { aid } = await jointNexus(A, B);
    at(A);
    const leaf = await mintNexusLeaf(0, aid);
    const before = signing.calls;
    expect(await refusal(runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, contractSig: "ab".repeat(64), sealHome: larSealHome(), repo: A.repo, aid })))
      .toMatch(/the supplied contract-in does not verify/);
    expect(signing.calls).toBe(before);
    // CONTROL: the leaf's own consent opens, and A's one seat signs once.
    const opened = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });
    expect(opened.verdict).toBe("ready");
    expect(signing.calls).toBe(before + 1);
  });

  test("V5 — the store door's rows open, cosign and land the act, and a refusal answers by the row's name", async () => {
    const A = await vault("two-da"), B = await vault("two-db");
    const { aid } = await jointNexus(A, B);
    const rows = (v: Vault) => { at(v); return storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo: v.repo }); };
    at(A);
    const leaf = await mintNexusLeaf(0, aid);
    const opened = await rows(A)["nexus-contract-open"]({ action: "admit", nym: leaf.verifyingKey, aid }, {} as never);
    expect(opened["verdict"]).toBe("ready");
    const cosigned = await rows(B)["nexus-contract-partial"]({ partial: courier(opened["partial"]) }, {} as never);
    expect(cosigned["verdict"]).toBe("complete");
    expect((cosigned["landed"] as { memberHeld: boolean }).memberHeld).toBe(true);
    const again = await rows(B)["nexus-contract-partial"]({ partial: courier(opened["partial"]) }, {} as never);
    expect(again["refusal"]).toBe("nexus-contract-partial-refused");
    expect(String(again["refused"])).toMatch(/reads replay/);
    const landed = await rows(A)["nexus-contract-partial"]({ partial: courier(cosigned["partial"]) }, {} as never);
    expect(landed["verdict"]).toBe("complete");
    expect(await memberHere(A, aid, leaf.verifyingKey)).toBe(true);
  });
});
