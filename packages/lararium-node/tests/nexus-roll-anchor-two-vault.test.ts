/**
 * nexus-roll-anchor-two-vault — the roll anchor of a two-founder Nexus crosses its two vaults as a PARTIAL. Each
 * vault already holds the rolled head; the anchor names the closed epoch, its seats and the board's heads there, and
 * the OPENED roster's seats sign it, one in each vault. Each vault reads both rosters off its own verified lineage,
 * never off the file: the head opens, the epoch before it closes.
 *
 * This fixture rolls the 2-of-2 charter by hand, with chair keys each vault holds as its own seat rows, and writes the
 * same rolled doc on both: it pins the anchor door alone. The roll through the two-vault ceremony itself, followed by
 * this door, reads in `roll-circle-ceremony.test.ts` (W1). The admit that should carry lands first through the
 * two-vault contract door.
 *
 *   R1  A opens the anchor (A's successor seat signs); B judges it `ready`, cosigns and lands it; A lands it too. On
 *       both boards the admit made at the closed epoch presents at the new head, where before the anchor it did not.
 *   R2  RED: an open at a head that never rolled finds no closed roster; an anchor that names fewer board heads than
 *       the cosigner's board holds reads `stale`; one that names a head the cosigner cannot count reads
 *       `unavailable`; a partial its own vault cannot advance waits. No seat signs on any of them.
 *   R3  The store door's rows carry the same act, say the realm edge anchors stay owed, and a refusal answers under
 *       the row's own name; an open over a board that holds the counted anchor refuses before any seat signs.
 *   R5  RED: a roll waits on its prior anchor (operator ruling 2026-10-15): the check refuses by name while the head's
 *       own roll stands with no counted anchor on the board, passes at a genesis and once the anchor lands, and its
 *       store row answers under the row's own name; the custody door's two roll opens refuse the same way against
 *       the store their door lends, and a door that lends none leaves the ask to the command; no seat signs on any
 *       refusal.
 *   R6  The realm edge anchors cross as their own partials, one per realm (kapae#/rolls): the opener signs each realm
 *       board it keeps a quorum act for; a vault that holds no board for the realm reads `unavailable` and signs
 *       nothing; a board whose heads moved reads `stale`; the cosigner lands the anchor and the first vault lands the
 *       completed partial; the store rows answer per realm where they said the edge anchors stayed owed.
 *   R4  RED: the same anchor again (`replay`), a partial under another Nexus, a torn file and a kapae partial sign
 *       and land nothing.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

/** A count of every seat signature, so a refusal can show no seat signed. */
const signing = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../src/seat-key-store.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/seat-key-store.js")>();
  return { ...real, signAsSeat: async (key: string, image: Uint8Array): Promise<Uint8Array> => { signing.calls += 1; return real.signAsSeat(key, image); } };
});
import {
  foundingRoster, carriageDocUrl, materializeSharedLarDoc, rollAnchorsFromBoard, rollAnchorCid, presentationFromBoardDoc,
  nexusAidOf, nexusActPartial, KAPAE_ANTIGEN_DOMAIN, antigenActCid, type KapaeAntigenEntry,
  realmEdgeBoardDocUrl, edgeRollAnchorsFromBoard, edgeKapaeActsFromBoard, signEdgeKapae, writeEdgeKapae, ed25519SignerFromSeed,
} from "@lararium/mesh";
import {
  NexusContractError, runEdgeRollAnchorOpen, runEdgeRollAnchorPartial, runNexusContractOpen, runNexusContractPartial, runNexusRollAnchorOpen,
  runNexusRollAnchorPartial, runNexusRollPriorAnchorCheck,
} from "../src/commands/nexus-contract.js";
import { noteVesselRealm, readVesselEdgeBoard, vesselEdgeCharter } from "../src/edge-board.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { mintNexusLeaf } from "../src/nexus-leaf.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { storeDoorReactors } from "../src/store-door-verbs.js";
import { runSealedAct, SealedActRefused, type SealedActContext } from "../src/sealed-acts.js";
import { heldSeatKey } from "../src/seat-key-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { restEvery, restingRepo, type RestingRepo } from "./resting-repo.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { chairKey, chairSeed, seatChairs } from "./seat-fixture.js";
import { seedFaceAtom, wornAtomKey } from "./atom-fixture.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const drops: SeatedScratchCustody[] = [];
afterEach(async () => {
  await restEvery();
  for (const c of drops.splice(0).reverse()) await c.drop();
});

const courier = <T>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;

interface Vault { readonly c: SeatedScratchCustody; readonly repo: RestingRepo }
async function vault(label: string): Promise<Vault> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0); await seedFaceAtom(0);
  return { c, repo: restingRepo(larDataDir()) };
}
const at = (v: Vault): void => { process.env["LAR_ROOT"] = v.c.root; };

/**
 * A 2-of-2 charter whose chairs rest one in each vault: A holds chair 0 (generation 0, and its successor at
 * generation 1), B holds chair 1 likewise. Both vaults file the genesis. `roll()` writes the rolled head on both.
 */
async function twoVaultCharter(A: Vault, B: Vault) {
  const old = [await chairKey(0), await chairKey(1)];
  const next = [await chairKey(0, 1), await chairKey(1, 1)];
  at(A); await seatChairs([0]); const { hands: aNext } = await seatChairs([0], { generation: 1 });
  at(B); await seatChairs([1]); const { hands: bNext } = await seatChairs([1], { generation: 1 });
  const genesis = heldCharter({ keys: old, threshold: 2, successors: { keys: next, threshold: 2 } });
  for (const v of [A, B]) { at(v); writeNexusDoc(larSealHome(), genesis.doc({ labels: ["Kahu A", "Kahu B"] })); }
  // The roll's signatures come by hand here; the two-vault roll circle gathers them in `roll-circle-ceremony.test.ts`.
  const rolled = await genesis.roll([...aNext, ...bNext]);
  const aid = nexusAidOf(genesis.doc())!;
  const roll = (): void => { for (const v of [A, B]) { at(v); writeNexusDoc(larSealHome(), rolled.doc({ labels: ["Kahu A", "Kahu B"] })); } };
  return { aid, old, next, roll };
}

/** A self-admit of A's leaf, landed on both boards through the two-vault contract door; answers the leaf nym. */
async function admitOnBoth(A: Vault, B: Vault, aid: string): Promise<string> {
  at(A);
  const leaf = await mintNexusLeaf(0, aid);
  const opened = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo });
  at(B);
  const done = await runNexusContractPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
  at(A);
  await runNexusContractPartial({ partial: courier(done.partial), sealHome: larSealHome(), repo: A.repo });
  return leaf.verifyingKey;
}

/** This vault's own board: its anchors, and whether `nym` presents at the head this vault holds. */
async function boardHere(v: Vault, nym: string): Promise<{ anchors: string[]; presents: boolean }> {
  at(v);
  const handle = await materializeSharedLarDoc(v.repo, carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() })), "board:carriage-contracts");
  const head = foundingRoster(readNexusDoc(larSealHome()));
  return { anchors: rollAnchorsFromBoard(handle.doc()).map(rollAnchorCid), presents: (await presentationFromBoardDoc(handle.doc(), nym, head)).presentation !== null };
}

const refusal = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof NexusContractError ? e.message : `${(e as Error).constructor.name}: ${(e as Error).message}`));

describe("a two-founder Nexus anchors its roll across its two vaults", () => {
  test("R1 — A opens the anchor, B cosigns and lands it, A lands it; the admit carries to the new head on both", async () => {
    const A = await vault("anc-a"), B = await vault("anc-b");
    const { aid, next, roll } = await twoVaultCharter(A, B);
    const nym = await admitOnBoth(A, B, aid);
    roll();
    // CONTROL: rolled, with no anchor, the admit made at the closed epoch presents nowhere.
    expect(await boardHere(A, nym)).toEqual({ anchors: [], presents: false });
    expect(await boardHere(B, nym)).toEqual({ anchors: [], presents: false });

    at(A);
    expect(heldSeatKey(next[1]!)).toBeNull();
    const opened = await runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo });
    expect(opened.verdict).toBe("ready");
    expect(opened.signed).toEqual([next[0]]);
    expect(opened.landed).toBeNull();
    expect(opened.partial.aid).toBe(aid);
    expect(opened.partial.act.family).toBe("roll-anchor");

    at(B);
    expect(heldSeatKey(next[0]!)).toBeNull();
    const cosigned = await runNexusRollAnchorPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    expect(cosigned.signed).toEqual([...next].sort());
    expect(cosigned.landed?.parents.length).toBe(1);
    expect(await boardHere(B, nym)).toEqual({ anchors: [cosigned.landed!.anchorCid], presents: true });

    at(A);
    const landed = await runNexusRollAnchorPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo });
    expect(landed.verdict).toBe("complete");
    expect(landed.landed?.anchorCid).toBe(cosigned.landed?.anchorCid);
    expect(await boardHere(A, nym)).toEqual({ anchors: [cosigned.landed!.anchorCid], presents: true });
  });

  test("R2 — an anchor whose board heads differ reads stale or unavailable, and nothing signs", async () => {
    const A = await vault("anc-sa"), B = await vault("anc-sb");
    const { aid, roll } = await twoVaultCharter(A, B);
    at(A);
    // Before the roll the head closes no epoch: an open finds no closed roster and signs nothing.
    const before = signing.calls;
    expect(await refusal(runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo }))).toMatch(/closes no epoch/);
    expect(signing.calls).toBe(before);
    // An admit lands on B's board alone at the genesis epoch: A never carried the completed partial home.
    const leaf = await mintNexusLeaf(0, aid);
    const admit = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo });
    at(B);
    expect((await runNexusContractPartial({ partial: courier(admit.partial), sealHome: larSealHome(), repo: B.repo })).verdict).toBe("complete");
    roll();

    at(A);
    // A's anchor cites A's empty board; its own vault cannot advance it.
    const blind = await runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo });
    expect(blind.verdict).toBe("ready");
    expect(blind.partial.act.family === "roll-anchor" && blind.partial.act.anchor.parents).toEqual([]);
    expect(await refusal(runNexusRollAnchorPartial({ partial: courier(blind.partial), sealHome: larSealHome(), repo: A.repo }))).toMatch(/waits on a seat this vessel does not hold/);
    // B's board holds a head the blind anchor never names: stale, and B's seat never signs.
    at(B);
    const mid = signing.calls;
    expect(await refusal(runNexusRollAnchorPartial({ partial: courier(blind.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads stale/);
    expect(signing.calls).toBe(mid);
    expect((await boardHere(B, leaf.verifyingKey)).anchors).toEqual([]);
    // B's own anchor cites the admit, which A cannot count: unavailable on A, and A's seat never signs.
    const named = await runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: B.repo });
    expect(named.partial.act.family === "roll-anchor" && named.partial.act.anchor.parents.length).toBe(1);
    at(A);
    const late = signing.calls;
    expect(await refusal(runNexusRollAnchorPartial({ partial: courier(named.partial), sealHome: larSealHome(), repo: A.repo }))).toMatch(/reads unavailable/);
    expect(signing.calls).toBe(late);
    expect((await boardHere(A, leaf.verifyingKey)).anchors).toEqual([]);
  });

  test("R4 — a replay, a foreign Nexus, a torn file and another family sign and land nothing", async () => {
    const A = await vault("anc-ra"), B = await vault("anc-rb");
    const { aid, roll } = await twoVaultCharter(A, B);
    roll();
    at(A);
    const opened = await runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo });
    at(B);
    const done = await runNexusRollAnchorPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(done.verdict).toBe("complete");
    const before = signing.calls;
    at(B);
    expect(await refusal(runNexusRollAnchorPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads replay/);
    expect(await refusal(runNexusRollAnchorPartial({ partial: courier(done.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads replay/);
    const foreign = { ...courier(opened.partial), aid: `nexus-${"cd".repeat(32)}` };
    expect(await refusal(runNexusRollAnchorPartial({ partial: foreign, sealHome: larSealHome(), repo: B.repo }))).toMatch(/holds no charter/);
    expect(await refusal(runNexusRollAnchorPartial({ partial: { ...courier(opened.partial), extra: 1 }, sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads as no roll-anchor partial/);
    const ban = { kind: KAPAE_ANTIGEN_DOMAIN, nym: "ab".repeat(32), action: "kapae", actCid: "", parents: [], sealEpochCid: "x",
      signatures: [{ signer: "ab".repeat(32), sig: "cd".repeat(64) }] } as KapaeAntigenEntry;
    const kapae = nexusActPartial(aid, { family: "kapae", entry: { ...ban, actCid: antigenActCid(ban) } });
    expect(await refusal(runNexusRollAnchorPartial({ partial: courier(kapae), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads as no roll-anchor partial/);
    expect(signing.calls).toBe(before);
    expect((await boardHere(B, "ab".repeat(32))).anchors.length).toBe(1);
  });

  test("R3 — the store door's rows open, cosign and land the anchor, and a refusal answers by the row's name", async () => {
    const A = await vault("anc-da"), B = await vault("anc-db");
    const { roll } = await twoVaultCharter(A, B);
    roll();
    const rows = (v: Vault) => { at(v); return storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo: v.repo }); };
    const opened = await rows(A)["nexus-roll-anchor-open"]({}, {} as never);
    expect(opened["verdict"]).toBe("ready");
    const cosigned = await rows(B)["nexus-roll-anchor-partial"]({ partial: courier(opened["partial"]) }, {} as never);
    expect(cosigned["verdict"]).toBe("complete");
    const again = await rows(B)["nexus-roll-anchor-partial"]({ partial: courier(opened["partial"]) }, {} as never);
    expect(again["refusal"]).toBe("nexus-roll-anchor-partial-refused");
    expect(String(again["refused"])).toMatch(/reads replay/);
    // No realm edge board holds a quorum act here, so no edge anchor stands owed.
    expect(cosigned["edgeAnchors"]).toEqual([]);
    const landed = await rows(A)["nexus-roll-anchor-partial"]({ partial: courier(cosigned["partial"]) }, {} as never);
    expect(landed["verdict"]).toBe("complete");
    // A board that holds the counted anchor opens no second one, and no seat signs.
    const before = signing.calls;
    const twice = await rows(A)["nexus-roll-anchor-open"]({}, {} as never);
    expect(String(twice["refused"])).toMatch(/already holds a counted anchor for this roll/);
    expect(signing.calls).toBe(before);
  });

  test("R5 — a roll waits on its prior anchor: the check refuses by name until the head's anchor lands", async () => {
    const A = await vault("anc-pa"), B = await vault("anc-pb");
    const { aid, roll } = await twoVaultCharter(A, B);
    const check = (v: Vault) => { at(v); return runNexusRollPriorAnchorCheck({ sealHome: larSealHome(), repo: v.repo, aid }); };
    const before = signing.calls;
    // CONTROL: a genesis closes no roll, so nothing waits and the first roll opens.
    expect((await check(A)).state).toBe("no-prior-roll");
    roll();
    // The head rolled and no anchor stands on either board: a next roll refuses by name on both vaults.
    for (const v of [A, B]) {
      expect(await refusal(check(v))).toMatch(/prior-roll-unanchored.*no counted anchor/);
    }
    expect(signing.calls).toBe(before);
    // The store row answers under its own name.
    at(A);
    const row = await storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo: A.repo })["nexus-roll-prior-anchor"]({ aid }, {} as never);
    expect(row["refusal"]).toBe("nexus-roll-prior-anchor-refused");
    expect(String(row["refused"])).toMatch(/prior-roll-unanchored/);
    // The custody door's roll opens ask the same check against the store their door lends, before any card reads.
    const lent: SealedActContext = {
      kelHead: null, personaSelves: null, walk: null, backup: null, hosting: { withRepo: (act) => act(A.repo), rolled: async () => {} },
    };
    const card = "0b".repeat(32);
    const door = (name: string, args: Record<string, unknown>, ctx: SealedActContext): Promise<string> => runSealedAct(name, args, ctx)
      .then(() => "ran", (e: unknown) => (e instanceof SealedActRefused ? `${e.reason}: ${e.message}` : `${(e as Error).constructor.name}: ${(e as Error).message}`));
    expect(await door("seat.arm-roll", { cards: [card, card] }, lent)).toMatch(/^act-refused: .*prior-roll-unanchored/);
    expect(await door("roll-circle.open", { aid, face: 0, next: "0c".repeat(32), threshold: 2 }, lent)).toMatch(/^act-refused: .*prior-roll-unanchored/);
    // CONTROL: a door that lends no store reads no board, so its refusal comes from the cards, never the anchor.
    expect(await door("seat.arm-roll", { cards: [card, card] }, { ...lent, hosting: null })).not.toMatch(/prior-roll-unanchored/);
    expect(signing.calls).toBe(before);

    // The anchor crosses and lands on both vaults; the wait ends there.
    at(A);
    const opened = await runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo });
    at(B);
    const cosigned = await runNexusRollAnchorPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect((await check(B)).state).toBe("anchored");
    expect(await refusal(check(A))).toMatch(/prior-roll-unanchored/);
    at(A);
    await runNexusRollAnchorPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo });
    const done = await check(A);
    expect(done.state).toBe("anchored");
    expect(done.anchorCid).toBe(cosigned.landed?.anchorCid);
  });

  const REALM = "ab".repeat(32);
  /** A quorum act at the genesis epoch on the realm's edge board, signed by both founders' genesis seats by hand
   *  (no door signs it whole across two vaults), written to each vault's replica as sync would carry it. */
  async function raiseAt(vaults: readonly Vault[], aid: string, edgeByte: number): Promise<string> {
    const signers = await Promise.all([0, 1].map(async (face) => ({ signer: await chairKey(face), sign: ed25519SignerFromSeed(chairSeed(face)) })));
    let actCid = "";
    for (const v of vaults) {
      at(v);
      const vesselKey = await wornAtomKey();
      const genesisEpoch = readNexusDoc(larSealHome())!.sealLineage![0]!.epochCid;
      const act = await signEdgeKapae({ edgeId: edgeByte.toString(16).padStart(2, "0").repeat(32), raised: true, hand: "quorum", parents: [], epochCid: genesisEpoch }, signers);
      actCid = act.actCid;
      const board = await materializeSharedLarDoc(v.repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
      board.change((d) => writeEdgeKapae(d, act));
      await noteVesselRealm(v.repo, vesselKey, REALM, aid);
      // A vessel that reads the board at its head keeps the counted act in its own ledger.
      await readVesselEdgeBoard({ repo: v.repo, scope: REALM, kind: "realm", boardUrl: realmEdgeBoardDocUrl(REALM), label: "board:edge-kapae", vesselKey,
        authorityFor: () => ({ quorum: true }), charter: vesselEdgeCharter(REALM, larSealHome(), aid) });
      await v.repo.flush();
    }
    return actCid;
  }
  const edgeAnchorsAt = async (v: Vault): Promise<string[]> => {
    at(v);
    const board = await materializeSharedLarDoc(v.repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    return edgeRollAnchorsFromBoard(board.doc()).map((a) => a.parents.join(","));
  };

  test("R6 — a realm's edge anchor crosses as its own partial: A opens one for each realm it keeps, B cosigns where it holds the board, and both land it", async () => {
    const A = await vault("anc-ea"), B = await vault("anc-eb");
    const { aid, next, roll } = await twoVaultCharter(A, B);
    // The first act reaches A (which keeps it in its ledger at the genesis head) before the roll; B has not met the realm.
    const first = await raiseAt([A], aid, 7);
    roll();

    at(A);
    const opened = await runEdgeRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo, aid });
    expect(opened.map((o) => [o.realm, o.verdict, o.signed, o.landed])).toEqual([[REALM, "ready", [next[0]], null]]);
    expect(opened[0]!.partial.act.family === "edge-roll-anchor" && opened[0]!.partial.act.anchor.parents).toEqual([first]);
    expect(await edgeAnchorsAt(A)).toEqual([]);

    // B holds no board for the realm: unavailable, no seat signs, nothing lands.
    at(B);
    const before = signing.calls;
    expect(await refusal(runEdgeRollAnchorPartial({ partial: courier(opened[0]!.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/unavailable.*no edge board/);
    expect(signing.calls).toBe(before);
    expect(await edgeAnchorsAt(B)).toEqual([]);

    // B meets the realm's board, and it holds a second head the anchor never cited: stale, and no seat signs.
    await raiseAt([B], aid, 7);
    const second = await raiseAt([B], aid, 9);
    at(B);
    expect(await refusal(runEdgeRollAnchorPartial({ partial: courier(opened[0]!.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/stale/);
    expect(signing.calls).toBe(before);

    // The second act reaches A too; A opens again, citing both heads, and B cosigns and lands.
    await raiseAt([A], aid, 9);
    at(A);
    const reopened = await runEdgeRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo, aid });
    expect(reopened[0]!.partial.act.family === "edge-roll-anchor" && reopened[0]!.partial.act.anchor.parents).toEqual([first, second].sort());
    at(B);
    const cosigned = await runEdgeRollAnchorPartial({ partial: courier(reopened[0]!.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    expect(cosigned.signed).toEqual([...next].sort());
    expect(cosigned.landed?.parents).toEqual([first, second].sort());
    expect(await edgeAnchorsAt(B)).toEqual([[first, second].sort().join(",")]);

    at(A);
    const landed = await runEdgeRollAnchorPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo });
    expect(landed.verdict).toBe("complete");
    expect(landed.landed?.anchorCid).toBe(cosigned.landed?.anchorCid);
    expect(await edgeAnchorsAt(A)).toEqual([[first, second].sort().join(",")]);
    // The same completed partial again reads replay on the vault that landed it.
    expect(await refusal(runEdgeRollAnchorPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo }))).toMatch(/replay/);
  });

  test("R7 — the store rows open the edge partials as a list and route a partial by its family; the answers name each realm", async () => {
    const A = await vault("anc-fa"), B = await vault("anc-fb");
    const { aid, roll } = await twoVaultCharter(A, B);
    const first = await raiseAt([A, B], aid, 7);
    roll();
    const rows = (v: Vault) => { at(v); return storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo: v.repo }); };
    const carriage = await rows(A)["nexus-roll-anchor-open"]({}, {} as never);
    // The carriage partial answers as it stood, and says which realms still owe an anchor.
    expect(carriage["verdict"]).toBe("ready");
    const edge = await rows(A)["nexus-roll-anchor-edge-open"]({}, {} as never) as { partials: Array<{ realm: string; verdict: string }> };
    expect(edge.partials.map((p) => [p.realm, p.verdict])).toEqual([[REALM, "ready"]]);
    const step = await rows(B)["nexus-roll-anchor-partial"]({ partial: courier((edge.partials[0] as any).partial) }, {} as never);
    expect(step["verdict"]).toBe("complete");
    expect(step["edgeAnchors"]).toEqual([{ realm: REALM, state: "anchored", anchorCid: (step["landed"] as any).anchorCid }]);
    // The carriage step on B reports the realm as anchored there, and A's own standing still owes it.
    const cosigned = await rows(B)["nexus-roll-anchor-partial"]({ partial: courier(carriage["partial"]) }, {} as never);
    expect(cosigned["edgeAnchors"]).toEqual([{ realm: REALM, state: "anchored", anchorCid: (step["landed"] as any).anchorCid }]);
    const owed = await rows(A)["nexus-roll-anchor-partial"]({ partial: courier(cosigned["partial"]) }, {} as never);
    expect(owed["edgeAnchors"]).toEqual([{ realm: REALM, state: "owed" }]);
    expect(first).toHaveLength(64);
  });
});
