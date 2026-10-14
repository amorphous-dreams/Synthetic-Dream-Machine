/**
 * seat-arming — the seal rite arms its heads behind the custody door, a SEAT holds its own key, and a chair's NEXT
 * key rests on a cold-key card alone.
 *
 * The rite's acts (`seat.arm-genesis`, `seat.arm-roll`, `seat.retire`, `seat.held`, `seal.sign`,
 * `seat.readback-stand-in`) run here through the act table, as a command reaches them. The vectors mint each
 * chair's cold card themselves, as the command does, and build and write each epoch the way the rite writes it.
 *
 *   A1  A GENESIS ARMS ITS SEATS. Each chair that stands takes a seat key of its own, a sealed row of its face,
 *       apart from every persona root; no next key rests on the vessel.  control: the same seat again keeps the keys
 *   A2  RED: EVERY REFUSAL LANDS BEFORE ANY KEY MINTS: a chair that holds a persona root, a seated key no row here
 *       holds, no chair standing, a rule past the roster.
 *   A3  A HEAD THE RITE ARMED ROLLS FROM ITS CARDS, AND ROLLS AGAIN. Each card's key becomes its chair's seat key, the
 *       seated hands sign through `seal.sign`, the lineage verifies, the closing keys retire once the charter moved.
 *   A4  A SEAT CHANGE: a chair that joins signs by possession; a chair that steps down drops, and its revealed key
 *       spends with the closing ones.
 *   A5  THE RETIREMENT'S LICENCE: a seated key and a key an open crossing names stay, by name; a spare row leaves; a
 *       key no row holds reads as done; a torn charter, primary or carried, refuses the whole act.
 *   A6  RED: THE CARDS READ BEFORE ANY ROW MOVES: a card the head never committed, two cards for one chair, fewer
 *       cards than the head's count, an unarmed head: each refuses by name and no row moves.
 *   A7  AT THE FLOOR every arming, the retirement, the roll's hand and the stand-in reading refuse `CustodyLocked`;
 *       `seat.held` answers.
 *   A8  ONE FACE'S PUBLIC HALVES: the reader opens that face's rows alone; a row that answers another key refuses.
 *   A9  RED: THE ROLL'S HAND SIGNS ONLY A LAWFUL ROLL OF THIS VESSEL'S SEATS: a key no row here holds, a successor
 *       short of one distinct digest per seat or under another rule, a roll revealing fewer seats than the head's
 *       count.                                                 control: the arming's own roll signs
 *   A10 AN ARMING SETTLES ITS FACES FIRST: a spare row of a touched face leaves, and every row a record needs stays.
 *   A11 A standing chair keeps only a key of its OWN face.
 *   A12 RED: A COPIED MARKER STANDS IN FOR NO READ-BACK. A root that carries the scratch marker over custody sealed
 *       under another passphrase reads no stand-in.   control: the marker beside custody under the test route does
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  NEXUS_DOC_DOMAIN, foundingRoster, genesisCharterEpoch, mintColdKey, rotateSealEpoch, sealLineageHead, sealRollBytes, verifySealLineage,
  type NexusCharterKahu, type SealEpoch,
} from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { seatCustody, unseatCustody, updateColdCustodyRow } from "../src/custody-seat.js";
import { foundCustody } from "../src/custody-session.js";
import { nexusCharterDocPath, readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, makeNodePersonaDeclarationStore } from "../src/node-vessel-identity.js";
import { listSeatKeys, seatKeyFile, seatKeysOfFace } from "../src/seat-key-store.js";
import { SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { vesselCustodyHomes } from "../src/vault-carriers.js";
import { larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { chairSeed, seatChairs } from "./seat-fixture.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(() => c.drop());
  return c;
}
const act = (name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> => runSealedAct(name, args, ctx);
const why = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof SealedActRefused ? `${e.reason}: ${e.message}` : (e as Error).constructor.name));
const hexOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const publicOf = async (seed: Uint8Array): Promise<string> => hexOf(await (await import("@noble/ed25519")).getPublicKeyAsync(seed));

interface Armed { kahu: NexusCharterKahu[]; seatedKeys: string[]; threshold: number; superseded: string[]; minted: string[] }
interface ArmedRoll { kahu: NexusCharterKahu[]; seatedKeys: string[]; threshold: number; signers: string[]; spent: string[]; minted: string[] }

/** Stand faces `faces` as persona roots that claim a chair each. Answers the roots' public keys. */
async function stand(faces: readonly number[]): Promise<string[]> {
  const store = await makeNodePersonaDeclarationStore();
  const roots: string[] = [];
  for (const face of faces) {
    roots.push((await generateOrLoadPersonaGroupRoot(face)).verifyingKey.toLowerCase());
    await store.set(face, { seat: true, chair: `Chair ${face}` });
  }
  return roots;
}
const stepDown = async (face: number): Promise<void> => { await (await makeNodePersonaDeclarationStore()).set(face, { seat: false }); };
const seatRows = (): number => listSeatKeys().length;

/** Mint one cold card per seated key, in the sorted order the digests commit, as the command does. */
async function cardsFor(seatedKeys: readonly string[], threshold: number): Promise<{ seeds: Uint8Array[]; next: { digests: string[]; threshold: number } }> {
  const seeds: Uint8Array[] = [];
  const digests: string[] = [];
  for (let i = 0; i < new Set(seatedKeys.map((k) => k.toLowerCase())).size; i++) {
    const cold = await mintColdKey();
    seeds.push(cold.seed);
    digests.push(cold.digest);
  }
  return { seeds, next: { digests, threshold } };
}

/** Write the charter a genesis arming answered, as the rite writes it; answers the cards it committed. */
async function writeGenesis(): Promise<{ armed: Armed; genesis: SealEpoch; cards: Uint8Array[] }> {
  const armed = await act("seat.arm-genesis") as unknown as Armed;
  const { seeds, next } = await cardsFor(armed.seatedKeys, armed.threshold);
  const genesis = genesisCharterEpoch(armed.seatedKeys, armed.threshold, next);
  writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: armed.threshold, sealEpochCid: genesis.epochCid, sealLineage: [genesis], kahu: armed.kahu });
  return { armed, genesis, cards: seeds };
}
/** Roll the standing head as the rite rolls it, from `cards`: arm, sign through the door, write, retire. */
async function roll(cards: readonly Uint8Array[], threshold?: number): Promise<{ armed: ArmedRoll; epoch: SealEpoch; retired: string[]; cards: Uint8Array[] }> {
  const doc = readNexusDoc(larSealHome())!;
  const armed = await act("seat.arm-roll", { cards: cards.map(hexOf), ...(threshold === undefined ? {} : { threshold }) }) as unknown as ArmedRoll;
  const { seeds, next } = await cardsFor(armed.seatedKeys, armed.threshold);
  const hands = armed.signers.map((signer) => ({
    signer, sign: async (bytes: Uint8Array) => ((await act("seal.sign", { seat: signer, image: hexOf(bytes) })) as { sig: string }).sig,
  }));
  const closing = foundingRoster(doc);
  const rolled = await rotateSealEpoch(sealLineageHead(doc)!, { keys: armed.seatedKeys, threshold: armed.threshold }, next, hands, doc.sealLineage!.slice(0, -1),
    { keys: closing.keys, threshold: closing.threshold });
  if (!rolled.ok) throw new Error(`the roll refused: ${rolled.reason}`);
  const lineage = [...doc.sealLineage!, rolled.epoch];
  expect(verifySealLineage(lineage)).toBe(true);
  writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: armed.threshold, sealEpochCid: rolled.epoch.epochCid, sealLineage: lineage, kahu: armed.kahu });
  const { retired } = await act("seat.retire", { keys: armed.spent }) as { retired: string[] };
  return { armed, epoch: rolled.epoch, retired, cards: seeds };
}

describe("the rite arms its heads behind the door", () => {
  test("A1 — a genesis arms its seats: each chair a seat key of its own, and no next key rests here", async () => {
    await custody("arm-a1");
    const roots = await stand([0, 1, 2]);
    const { armed } = await writeGenesis();
    expect(armed.kahu.map((k) => k.chairLabel)).toEqual(["Chair 0", "Chair 1", "Chair 2"]);
    expect(armed.threshold).toBe(2);
    for (const key of armed.seatedKeys) expect(roots, "a seat key never equals a root").not.toContain(key);
    expect(seatRows()).toBe(3);                                                      // the seat keys alone: the next keys rest on cards
    for (const [face, key] of armed.seatedKeys.entries()) expect(await seatKeysOfFace(face)).toEqual([key]);
    expect(await act("seat.held", { keys: [...armed.seatedKeys, ...roots] })).toEqual({ held: armed.seatedKeys });
    const again = await act("seat.arm-genesis") as unknown as Armed;                 // CONTROL: the same seat keeps the keys
    expect(again.seatedKeys).toEqual(armed.seatedKeys);
    expect(again.minted).toEqual([]);
    expect(seatRows()).toBe(3);
  });

  test("A2 — every refusal lands before any key mints", async () => {
    await custody("arm-a2");
    expect(await why(act("seat.arm-genesis"))).toMatch(/^act-refused: no persona stands for a chair/);
    const roots = await stand([0, 1]);
    expect(await why(act("seat.arm-genesis", { threshold: 3 }))).toMatch(/^act-refused: --threshold 3 sits past the 2 chairs that stood/);
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [{ chairLabel: "Kept", verifyingKey: roots[1]! }] });
    expect(await why(act("seat.arm-genesis"))).toMatch(/^act-refused: a chair holds the persona root at h1 as its key/);
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [{ chairLabel: "Theirs", verifyingKey: "3d".repeat(32) }] });
    expect(await why(act("seat.arm-genesis"))).toMatch(/^act-refused: the charter standing here seats 1 chair\(s\) this vessel did not found/);
    expect(seatRows()).toBe(0);
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [] });
    expect(await why(act("seat.arm-genesis"))).toBe("ran");                          // CONTROL
    expect(seatRows()).toBe(2);
  });

  test("A3 — a head rolls from its cards, and rolls again; each card's key becomes its chair's seat key", async () => {
    await custody("arm-a3");
    await stand([0, 1, 2]);
    const { armed: g, cards } = await writeGenesis();
    const revealed = await Promise.all(cards.map(publicOf));
    const first = await roll(cards);
    expect([...first.armed.seatedKeys].sort()).toEqual([...revealed].sort());          // each card's key, seated
    expect([...first.armed.minted].sort()).toEqual([...revealed].sort());             // adopted as rows here
    expect([...first.retired].sort()).toEqual([...g.seatedKeys].sort());              // the closing keys left
    expect(seatRows()).toBe(3);
    const second = await roll(first.cards);
    expect([...second.armed.spent].sort()).toEqual([...first.armed.seatedKeys].sort());
    expect(readNexusDoc(larSealHome())!.sealLineage).toHaveLength(3);
    expect(seatRows()).toBe(3);
  });

  test("A4 — a seat change: a chair joins by possession, a chair that left drops and its revealed key spends", async () => {
    await custody("arm-a4");
    await stand([0, 1, 2]);
    const { cards } = await writeGenesis();
    await stand([3]);
    const grown = await roll(cards);
    expect(grown.armed.kahu.map((k) => k.chairLabel)).toEqual(["Chair 0", "Chair 1", "Chair 2", "Chair 3"]);
    expect(grown.armed.minted).toHaveLength(4);                                       // three adopted, one minted by possession
    await stepDown(1);
    const shrunk = await roll(grown.cards);
    expect(shrunk.armed.kahu.map((k) => k.chairLabel)).toEqual(["Chair 0", "Chair 2", "Chair 3"]);
    expect(shrunk.retired).toHaveLength(5);                                           // four closing keys and the leaving chair's revealed key
    expect(seatRows()).toBe(3);
  });

  test("A5 — the retirement's licence", async () => {
    await custody("arm-a5");
    await stand([0, 1, 2]);
    const { armed: g, cards } = await writeGenesis();
    const spare = (await seatChairs([0], { family: "spare" })).keys[0]!;
    expect(await act("seat.retire", { keys: [g.seatedKeys[0]!, spare, "4e".repeat(32)] }))
      .toEqual({ retired: [spare], kept: [{ key: g.seatedKeys[0], why: "seated" }] });
    await act("crossing.open");
    const { retired } = await roll(cards);
    expect(retired).toEqual([]);                                                      // an open crossing keeps the outgoing keys
    const again = await act("seat.retire", { keys: g.seatedKeys }) as { kept: Array<{ why: string }> };
    expect(again.kept.map((k) => k.why)).toEqual(["crossing-open", "crossing-open", "crossing-open"]);
    const carried = join(larSealHome(), "carried", "nexus-" + "ab".repeat(32));
    mkdirSync(carried, { recursive: true });
    writeFileSync(nexusCharterDocPath(carried), "a carried charter that will not read");
    expect(await why(act("seat.retire", { keys: g.seatedKeys }))).toMatch(/^act-refused: a carried charter stands and reads TORN/);
    rmSync(join(larSealHome(), "carried"), { recursive: true, force: true });
    writeFileSync(nexusCharterDocPath(larSealHome()), "a charter that stands and will not read");
    expect(await why(act("seat.retire", { keys: g.seatedKeys }))).toMatch(/^act-refused: the charter stands but reads TORN/);
  });

  test("A6 — the cards read before any row moves", async () => {
    await custody("arm-a6");
    await stand([0, 1, 2]);
    const { cards, armed } = await writeGenesis();
    const rows = seatRows();
    const stranger = new Uint8Array(32).fill(9);
    expect(await why(act("seat.arm-roll", { cards: [hexOf(stranger), hexOf(cards[0]!)] }))).toMatch(/^act-refused: a card answers no digest the standing head committed/);
    expect(await why(act("seat.arm-roll", { cards: [hexOf(cards[0]!), hexOf(cards[0]!)] }))).toMatch(/^act-refused: two cards answer one chair's digest/);
    expect(await why(act("seat.arm-roll", { cards: [hexOf(cards[0]!)] }))).toMatch(/^act-refused: the head committed 3 chair\(s\) and a roll reveals 2 of them — 1 card\(s\) answered/);
    expect(seatRows()).toBe(rows);                                                    // no refusal moved a row
    const unarmed = genesisCharterEpoch(armed.seatedKeys, armed.threshold);
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: armed.threshold, sealEpochCid: unarmed.epochCid, sealLineage: [unarmed], kahu: armed.kahu });
    expect(await why(act("seat.arm-roll", { cards: cards.map(hexOf) }))).toMatch(/^act-refused: rotation unarmed/);
    expect(seatRows()).toBe(rows);
  });

  test("A7 — at the floor the armings, the retirement, the roll's hand and the stand-in refuse; the held reading answers", async () => {
    const c = await custody("arm-a7");
    await stand([0]);
    const { armed, cards } = await writeGenesis();
    await c.holder.lock();
    const steps = [() => act("seat.arm-genesis"), () => act("seat.arm-roll", { cards: cards.map(hexOf) }), () => act("seat.retire", { keys: armed.seatedKeys }),
      () => act("seal.sign", { seat: armed.seatedKeys[0], image: "ab" })];
    for (const step of steps) expect(await step().catch((e: unknown) => e)).toBeInstanceOf(CustodyLocked);
    writeFileSync(join(c.root, ".lar-test-scratch"), "");
    expect(await act("seat.readback-stand-in").catch((e: unknown) => e)).toBeInstanceOf(CustodyLocked);
    expect(await act("seat.held", { keys: armed.seatedKeys })).toEqual({ held: armed.seatedKeys });
  });

  test("A8 — one face's public halves: that face's rows alone; a row that answers another key refuses by name", async () => {
    await custody("arm-a8");
    const zero = await seatChairs([0, 0], { family: "a8" });
    const one = (await seatChairs([1], { family: "a8" })).keys[0]!;
    expect(await seatKeysOfFace(0)).toEqual([zero.keys[0]]);
    expect(await seatKeysOfFace(1)).toEqual([one]);
    const rows = readdirSync(larIdentityDir()).filter((f) => f.startsWith("seat-key-h0-"));
    copyFileSync(join(larIdentityDir(), rows[0]!), join(larIdentityDir(), `seat-key-h2-${"0".repeat(32)}.bin`));
    expect(await seatKeysOfFace(2).catch((e: unknown) => e)).toMatchObject({ reading: "key-fails" });
    await updateColdCustodyRow("identity", seatKeyFile(one, 3), () => ({ plaintext: chairSeed(0, 0, "a8"), value: undefined }));
    expect(await seatKeysOfFace(3).catch((e: unknown) => e)).toBeInstanceOf(CustodyRowUnavailable);
    expect(await seatKeysOfFace(3).catch((e: unknown) => e)).toMatchObject({ reading: "names-another-key" });
  });

  test("A9 — the roll's hand signs only a lawful roll of this vessel's seats", async () => {
    await custody("arm-a9");
    await stand([0, 1, 2]);
    const { genesis, cards } = await writeGenesis();
    const armed = await act("seat.arm-roll", { cards: cards.map(hexOf) }) as unknown as ArmedRoll;
    const { next } = await cardsFor(armed.seatedKeys, armed.threshold);
    const image = (keys: readonly string[], digests: readonly string[], threshold = 2, nextThreshold = threshold): string =>
      hexOf(sealRollBytes({ prevEpochCid: genesis.epochCid, keys, threshold, nextKeyDigests: digests, nextThreshold }));
    const stranger = await publicOf(new Uint8Array(32).fill(77));
    const seat = armed.seatedKeys[0]!;
    expect(await why(act("seal.sign", { seat, image: image([...armed.seatedKeys, stranger], [...next.digests, "aa".repeat(32)]) })))
      .toMatch(/^act-refused: the roll seats a key that rests in no seat row on this vessel/);
    expect(await why(act("seal.sign", { seat, image: image(armed.seatedKeys, next.digests.slice(1)) })))
      .toMatch(/^act-refused: the roll re-arms its seats short of one distinct digest each/);
    expect(await why(act("seal.sign", { seat, image: image(armed.seatedKeys, next.digests, 2, 1) })))
      .toMatch(/^act-refused: the roll re-arms its seats short of one distinct digest each/);           // a successor under another rule
    const fresh = (await seatChairs([0], { family: "a9-fresh" })).keys[0]!;
    expect(await why(act("seal.sign", { seat: fresh, image: image([fresh], [next.digests[0]!], 1) })))
      .toMatch(/^act-refused: the roll reveals fewer of the seats the standing head committed/);
    expect(await why(act("seal.sign", { seat, image: image(armed.seatedKeys, next.digests) }))).toBe("ran");   // CONTROL
  });

  test("A10 — an arming settles its faces first: a spare row leaves, every needed row stays", async () => {
    await custody("arm-a10");
    await stand([0, 1, 2]);
    await writeGenesis();
    const spare = (await seatChairs([0], { family: "a10-spare" })).keys[0]!;
    expect(seatRows()).toBe(4);
    await act("seat.arm-genesis");
    expect(await act("seat.held", { keys: [spare] })).toEqual({ held: [] });
    expect(seatRows()).toBe(3);
  });

  test("A11 — a standing chair keeps only a key of its OWN face", async () => {
    await custody("arm-a11");
    await stand([0]);
    const borrowed = (await seatChairs([1], { family: "a11" })).keys[0]!;
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [{ chairLabel: "Chair 0", verifyingKey: borrowed }] });
    const armed = await act("seat.arm-genesis") as unknown as Armed;
    expect(armed.seatedKeys[0]).not.toBe(borrowed);
    expect(armed.superseded).toContain(borrowed);
  });

  test("A12 — a copied marker stands in for no read-back; the marker beside the test route does", async () => {
    const c = await custody("arm-a12");                                               // custody under another passphrase
    expect(await act("seat.readback-stand-in")).toEqual({ standIn: false });          // no marker
    writeFileSync(join(c.root, ".lar-test-scratch"), "");
    expect(await act("seat.readback-stand-in")).toEqual({ standIn: false });          // RED: a copied marker alone
    // CONTROL: a root staged as a harness stages one, custody founded under the published test route.
    const root = mkdtempSync(join(tmpdir(), "lar-custody-staged-"));
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    const homes = vesselCustodyHomes();
    mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
    const io = new FsCustodyIo(homes);
    const founded = await foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: "test-founding-passphrase" }] }] });
    const holder = makeCustodyHolder({ io, homes });
    await holder.adopt(founded.vk);
    seatCustody(holder);
    try {
      writeFileSync(join(root, ".lar-test-scratch"), "");
      expect(await act("seat.readback-stand-in")).toEqual({ standIn: true });
    } finally {
      await holder.lock();
      unseatCustody(holder);
      process.env["LAR_ROOT"] = prior;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
