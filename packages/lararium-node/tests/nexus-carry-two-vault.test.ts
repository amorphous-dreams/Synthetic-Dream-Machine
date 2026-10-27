/**
 * nexus-carry-two-vault — a CARRY of a two-founder Nexus crosses its two vaults as a PARTIAL with the place's floor pin claim (W16).
 *
 *   K1  CONTROL/POSITIVE: A opens the carry (nothing lands, no pin is exposed); B judges it ready, cosigns and lands the act, the
 *       claim and the KEL rows in ONE write; A lands the completed partial too. Both boards count the carry and file the claim; the
 *       herm takes the bundle and its own replica relays the claim.
 *   K2  RED: a partial below the quorum files no pin (A's board holds neither act nor claim); a carry with no claim, a forged claim,
 *       another place's claim and a seal the claim's head does not seat each refuse and the board keeps its count (CONTROL: the honest
 *       partial still lands afterwards).
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
import { mintColdKey, seatFingerprint, cidV1Sha256, foldCarrierSet, carriageEntriesFromBoard, carriageDocUrl, materializeSharedLarDoc,
  foundingRoster, placeFloorPinsFromBoard, placeKelRowsFromBoard, filePlaceFloorPins, hearthPinIndex, FLOW_SOCKET_ROUTE, type CofoundOffer } from "@lararium/mesh";
import { charterHomeFor, carriedCharterHome } from "../src/carried-set.js";
import { NexusContractError, runNexusCarryFor, runNexusContractOpen, runNexusContractPartial } from "../src/commands/nexus-contract.js";
import { takeCarryBundle, type CarryBundle } from "../src/carry-bundle.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
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
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
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

/** How many entries this vault's own board holds for the joint Nexus. */
async function boardCount(v: Vault, aid: string): Promise<number> {
  at(v);
  const home = charterHomeFor(larSealHome(), aid)!;
  const handle = await materializeSharedLarDoc(v.repo, carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:carriage-contracts");
  return carriageEntriesFromBoard(handle.doc()).length;
}

const refusal = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof NexusContractError ? e.message : `${(e as Error).constructor.name}: ${(e as Error).message}`));


/** The herm: a third vault holding the joint charter and its own vessel key; its carry-for seals and claims at the joint Nexus. */
async function hermSeal(h: Vault, aid: string, charterDoc: Parameters<typeof writeNexusDoc>[1]) {
  at(h);
  writeNexusDoc(carriedCharterHome(larSealHome(), aid), charterDoc);
  return runNexusCarryFor({ sealHome: larSealHome(), aid });
}
const claimFile = (seal: Awaited<ReturnType<typeof runNexusCarryFor>>, over: Record<string, unknown> = {}): string =>
  JSON.stringify({ floorPin: seal.floorPin, placeKel: seal.placeKel, ...over });

async function boardOf(v: Vault, aid: string) {
  at(v);
  const home = charterHomeFor(larSealHome(), aid)!;
  const handle = await materializeSharedLarDoc(v.repo, carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:carriage-contracts");
  return { doc: handle.doc(), roster: foundingRoster(readNexusDoc(home)) };
}
const filedFrom = async (v: Vault, aid: string): Promise<string[]> => {
  const { doc, roster } = await boardOf(v, aid);
  return [...filePlaceFloorPins(hearthPinIndex(), placeFloorPinsFromBoard(doc), {
    nexusHex: Buffer.from(aid, "utf8").toString("hex"), route: FLOW_SOCKET_ROUTE, kelRows: placeKelRowsFromBoard(doc),
    standing: { via: "carrier", carriers: await foldCarrierSet(carriageEntriesFromBoard(doc), roster) },
  }).filed];
};

describe("a two-founder Nexus carries a place across its two vaults", () => {
  test("K1 — the partial files no pin short of the quorum; B lands act and claim atomically; the herm relays it", async () => {
    const A = await vault("carry-a"), B = await vault("carry-b"), H = await vault("carry-h");
    const { aid } = await jointNexus(A, B);
    at(A);
    const charterDoc = readNexusDoc(charterHomeFor(larSealHome(), aid)!)!;
    const seal = await hermSeal(H, aid, charterDoc);
    expect(seal.floorPin).not.toBeNull();

    at(A);
    const opened = await runNexusContractOpen({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, floorPin: claimFile(seal), sealHome: larSealHome(), repo: A.repo, aid });
    expect(opened.verdict).toBe("ready");
    expect(opened.partial.act.family).toBe("carry");
    expect(opened.landed).toBeNull();
    // BELOW QUORUM: A's board holds neither the act nor the claim, and no reader files a pin off it.
    expect(await boardCount(A, aid)).toBe(0);
    expect(placeFloorPinsFromBoard((await boardOf(A, aid)).doc)).toEqual([]);
    expect(await filedFrom(A, aid)).toEqual([]);

    at(B);
    const cosigned = await runNexusContractPartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    expect(cosigned.landed?.carrierHeld).toBe(true);
    // ONE write: the counted act, its claim and the KEL rows that fold to the claim's head, and the board files the pin.
    const onB = (await boardOf(B, aid)).doc;
    expect(carriageEntriesFromBoard(onB)).toHaveLength(1);
    expect(placeFloorPinsFromBoard(onB)).toHaveLength(1);
    expect(placeKelRowsFromBoard(onB).length).toBeGreaterThan(0);
    expect(await filedFrom(B, aid)).toEqual([seal.nym]);

    at(A);
    const landed = await runNexusContractPartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo });
    expect(landed.verdict).toBe("complete");
    expect(await filedFrom(A, aid)).toEqual([seal.nym]);

    // THE HERM takes the bundle B landed and its own replica carries the claim opaque: a reader folds it off the herm's board.
    at(H);
    const taken = await takeCarryBundle({ sealHome: larSealHome(), repo: H.repo, raw: JSON.stringify(cosigned.landed!.carryBundle as CarryBundle), ownVesselKey: seal.nym });
    expect(taken.floorPins).toEqual([seal.floorPin!.aid]);
    expect(await filedFrom(H, aid)).toEqual([seal.nym]);
  });

  test("K2 — a carry with no claim, a forged claim, another place's claim or a foreign seal refuses, and the board keeps its count", async () => {
    const A = await vault("carry-ra"), B = await vault("carry-rb"), H = await vault("carry-rh"), S = await vault("carry-rs");
    const { aid } = await jointNexus(A, B);
    at(A);
    const charterDoc = readNexusDoc(charterHomeFor(larSealHome(), aid)!)!;
    const seal = await hermSeal(H, aid, charterDoc);
    const stranger = await hermSeal(S, aid, charterDoc);
    const forged = { ...seal.floorPin!, sig: seal.floorPin!.sig.replace(/^./, (c) => (c === "0" ? "1" : "0")) };
    at(A);
    const open = (floorPin: string | undefined, extra: Record<string, unknown> = {}) => runNexusContractOpen({
      action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, ...(floorPin ? { floorPin } : {}), sealHome: larSealHome(), repo: A.repo, aid, ...extra,
    });
    expect(await refusal(open(undefined))).toMatch(/lands with the place's floor pin claim/);
    expect(await refusal(open(claimFile(seal, { floorPin: forged })))).toMatch(/does not read for this place/);
    expect(await refusal(open(claimFile(seal, { floorPin: stranger.floorPin, placeKel: stranger.placeKel })))).toMatch(/does not read for this place/);
    expect(await refusal(open(claimFile(seal, { placeKel: [] })))).toMatch(/KEL rows|does not read/);
    // A carrier seal the claim's head does not seat: the stranger's seal under the herm's nym and claim.
    expect(await refusal(runNexusContractOpen({ action: "carry", nym: seal.nym, carrierSig: stranger.carrierSig, floorPin: claimFile(seal), sealHome: larSealHome(), repo: A.repo, aid })))
      .toMatch(/carrier seal|does not verify/);
    expect(await boardCount(A, aid)).toBe(0);
    // CONTROL: the honest claim and seal open, ready.
    expect((await open(claimFile(seal))).verdict).toBe("ready");
  });
});
