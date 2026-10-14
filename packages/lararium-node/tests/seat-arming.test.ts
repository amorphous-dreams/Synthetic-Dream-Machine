/**
 * seat-arming — the seal rite arms its heads behind the custody door, and a SEAT holds its own key.
 *
 * The rite's acts (`seat.arm-genesis`, `seat.arm-roll`, `seat.retire`, `seat.held`, `seal.sign`) run here through
 * the act table, as a command reaches them; the epochs the arming answers get built and written the way the rite
 * writes them, so the vectors walk a head from its genesis through its rolls.
 *
 *   A1  A GENESIS ARMS ITSELF. Each chair that stands takes a seat key of its own and a NEXT key, both sealed rows
 *       of its face, apart from every persona root; the digest the arming answers commits that next set.
 *                                                          control: the same seat again answers the same genesis
 *   A2  RED: EVERY REFUSAL LANDS BEFORE ANY KEY MINTS. A chair that holds a persona root as its key, a charter that
 *       seats a key no row here holds, a roster nobody stands for, a rule past the roster: each refuses by name,
 *       and no seat row lands.
 *   A3  A HEAD THE RITE ARMED ROLLS, AND ROLLS AGAIN. The roll seats the committed set (found among the faces'
 *       rows by its digest), the committed hands sign through `seal.sign`, the lineage verifies, and the rolled
 *       head arms its own successor.                       control: the closing keys retire once the charter moved
 *   A4  A SEAT CHANGE RIDES THE REVEAL. A chair that joins seats a fresh key and signs by possession; a chair that
 *       left drops; the committed hands sign; the roll verifies whole.
 *   A5  THE RETIREMENT'S LICENCE. A seated key, a committed next key and a key an open crossing names each stay,
 *       by name; a superseded key leaves; a key no row holds reads as done; a torn charter refuses the whole act.
 *   A6  RED: a head that commits a set this vessel does not hold refuses `reveal-unheld`; an unarmed head refuses.
 *   A7  AT THE FLOOR every arming, the retirement and the roll's hand refuse `CustodyLocked`; `seat.held` reads row
 *       names and answers.
 *   A8  ONE FACE'S PUBLIC HALVES: the reader opens that face's rows alone, and a row whose secret answers another
 *       key than its name refuses by name.
 *   A9  RED: THE ROLL'S HAND SIGNS ONLY WHAT THIS VESSEL'S ARMING HOLDS: a seat change that seats a key no row here
 *       holds, or a roll whose forward commitment names a set no row here holds, signs nothing.
 *                                                          control: the arming's own roll signs (A3)
 *   A10 RED: THE RETIREMENT REFUSES WHERE A RECORD READS UNWHOLE (a carried charter that stands torn, a standing
 *       commitment this vessel cannot name), and an ARMING SETTLES its faces first: the rows a stopped arming
 *       minted leave, and every row a record needs stays.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  NEXUS_DOC_DOMAIN, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, sealLineageHead, sealRollBytes, verifySealLineage,
  type NexusCharterKahu, type NexusDoc, type SealEpoch, type SealKeySet,
} from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { nexusCharterDocPath, readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, makeNodePersonaDeclarationStore } from "../src/node-vessel-identity.js";
import { committedNextSeats } from "../src/seal-ceremony.js";
import { listSeatKeys, seatKeyFile, seatKeysOfFace } from "../src/seat-key-store.js";
import { updateColdCustodyRow } from "../src/custody-seat.js";
import { SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
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

interface Armed { kahu: NexusCharterKahu[]; seatedKeys: string[]; threshold: number; nextKeyCommit: string; superseded: string[]; minted: string[] }
interface ArmedRoll { kahu: NexusCharterKahu[]; seatedKeys: string[]; threshold: number; revealed: SealKeySet | null; signers: string[]; nextKeyCommit: string; spent: string[]; minted: string[] }

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
/** Step face `face` down: its seat claim leaves. */
async function stepDown(face: number): Promise<void> {
  await (await makeNodePersonaDeclarationStore()).set(face, { seat: false });
}
const seatRows = (): number => listSeatKeys().length;

/** Write the charter a genesis arming answered, as the rite writes it. */
async function writeGenesis(): Promise<{ armed: Armed; genesis: SealEpoch }> {
  const armed = await act("seat.arm-genesis") as unknown as Armed;
  const genesis = genesisCharterEpoch(armed.seatedKeys, armed.threshold, armed.nextKeyCommit);
  writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: armed.threshold, sealEpochCid: genesis.epochCid, sealLineage: [genesis], kahu: armed.kahu });
  return { armed, genesis };
}
/** Roll the standing head as the rite rolls it: arm, sign through the door, write, retire the closing keys. */
async function roll(threshold?: number): Promise<{ armed: ArmedRoll; epoch: SealEpoch; retired: string[] }> {
  const doc = readNexusDoc(larSealHome())!;
  const armed = await act("seat.arm-roll", threshold === undefined ? {} : { threshold }) as unknown as ArmedRoll;
  const hands = armed.signers.map((signer) => ({
    signer, sign: async (bytes: Uint8Array) => ((await act("seal.sign", { seat: signer, image: Buffer.from(bytes).toString("hex") })) as { sig: string }).sig,
  }));
  const seat = armed.revealed ? { keys: armed.seatedKeys, threshold: armed.threshold, revealed: armed.revealed } : { keys: armed.seatedKeys, threshold: armed.threshold };
  const rolled = await rotateSealEpoch(sealLineageHead(doc)!, seat, armed.nextKeyCommit, hands);
  if (!rolled.ok) throw new Error(`the roll refused: ${rolled.reason}`);
  const lineage = [...doc.sealLineage!, rolled.epoch];
  expect(verifySealLineage(lineage)).toBe(true);
  writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: armed.threshold, sealEpochCid: rolled.epoch.epochCid, sealLineage: lineage, kahu: armed.kahu });
  const { retired } = await act("seat.retire", { keys: armed.spent }) as { retired: string[] };
  return { armed, epoch: rolled.epoch, retired };
}

describe("the rite arms its heads behind the door", () => {
  test("A1 — a genesis arms itself: each chair a seat key and a next key of its own; the same seat again answers the same genesis", async () => {
    await custody("arm-a1");
    const roots = await stand([0, 1, 2]);
    const { armed, genesis } = await writeGenesis();
    expect(armed.kahu.map((k) => k.displayName)).toEqual(["Chair 0", "Chair 1", "Chair 2"]);
    expect(armed.threshold).toBe(2);                                                 // a majority of three
    expect(armed.seatedKeys).toHaveLength(3);
    for (const key of armed.seatedKeys) expect(roots, "a seat key never equals a root").not.toContain(key);
    // Each face holds two rows: its seat key and its next key, and the digest commits the next set.
    expect(seatRows()).toBe(6);
    for (const [face, key] of armed.seatedKeys.entries()) expect(await seatKeysOfFace(face)).toContain(key);
    const next = await committedNextSeats(armed.seatedKeys, 2, armed.nextKeyCommit);
    expect(next).not.toBeNull();
    expect(sealKeySetHash(next!, 2)).toBe(armed.nextKeyCommit);
    for (const key of next!) { expect(armed.seatedKeys).not.toContain(key); expect(roots).not.toContain(key); }
    expect(await act("seat.held", { keys: [...armed.seatedKeys, ...roots] })).toEqual({ held: armed.seatedKeys });
    // CONTROL: the same seat again keeps every key and the commitment, so the genesis it answers stands identical.
    const again = await act("seat.arm-genesis") as unknown as Armed;
    expect(again.seatedKeys).toEqual(armed.seatedKeys);
    expect(genesisCharterEpoch(again.seatedKeys, again.threshold, again.nextKeyCommit).epochCid).toBe(genesis.epochCid);
    expect(again.minted).toEqual([]);
    expect(seatRows()).toBe(6);
  });

  test("A2 — every refusal lands before any key mints", async () => {
    await custody("arm-a2");
    // No chair stands.
    expect(await why(act("seat.arm-genesis"))).toMatch(/^act-refused: no persona stands for a chair/);
    const roots = await stand([0, 1]);
    expect(await why(act("seat.arm-genesis", { threshold: 3 }))).toMatch(/^act-refused: --threshold 3 sits past the 2 chairs that stood/);
    // A chair nobody stands for keeps its key, and that key reads as a persona root: the seat refuses by that name.
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [{ displayName: "Kept", verifyingKey: roots[1]! }] });
    expect(await why(act("seat.arm-genesis"))).toMatch(/^act-refused: a chair holds the persona root at h1 as its key/);
    // A chair whose key rests in no row here belongs to another vault: the seat refuses by fingerprint.
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [{ displayName: "Theirs", verifyingKey: "3d".repeat(32) }] });
    expect(await why(act("seat.arm-genesis"))).toMatch(/^act-refused: the charter standing here seats 1 chair\(s\) this vessel did not found/);
    expect(seatRows()).toBe(0);                                                      // no refusal minted a row
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [] });
    expect(await why(act("seat.arm-genesis"))).toBe("ran");                          // CONTROL
    expect(seatRows()).toBe(4);
  });

  test("A3 — a head the rite armed rolls, and rolls again; the closing keys retire once the charter moved", async () => {
    await custody("arm-a3");
    await stand([0, 1, 2]);
    const { armed: genesisArmed } = await writeGenesis();
    const committed = await committedNextSeats(genesisArmed.seatedKeys, 2, genesisArmed.nextKeyCommit);
    const first = await roll();
    expect(first.armed.revealed).toBeNull();                                         // the same chairs: the seated set IS the reveal
    expect(first.armed.seatedKeys).toEqual(committed);
    expect([...first.retired].sort()).toEqual([...genesisArmed.seatedKeys].sort());
    expect(await act("seat.held", { keys: genesisArmed.seatedKeys })).toEqual({ held: [] });
    expect(seatRows()).toBe(6);                                                      // each face: its seated key and its next one
    const second = await roll();
    expect(second.armed.spent).toEqual(first.armed.seatedKeys);
    expect(readNexusDoc(larSealHome())!.sealLineage).toHaveLength(3);
    expect(seatRows()).toBe(6);
  });

  test("A4 — a seat change rides the reveal: a chair joins by possession, a chair that left drops", async () => {
    await custody("arm-a4");
    await stand([0, 1, 2]);
    const { armed: g } = await writeGenesis();
    const committed = (await committedNextSeats(g.seatedKeys, 2, g.nextKeyCommit))!;
    await stand([3]);                                                                // a fourth chair stands
    const grown = await roll();
    expect(grown.armed.revealed).toEqual({ keys: committed, threshold: 2 });
    expect(grown.armed.kahu.map((k) => k.displayName)).toEqual(["Chair 0", "Chair 1", "Chair 2", "Chair 3"]);
    expect(grown.armed.seatedKeys.slice(0, 3)).toEqual(committed);
    expect(grown.armed.threshold).toBe(2);                                           // the charter's own rule still fits
    await stepDown(1);                                                               // chair 1 steps down
    const shrunk = await roll();
    expect(shrunk.armed.kahu.map((k) => k.displayName)).toEqual(["Chair 0", "Chair 2", "Chair 3"]);
    expect(shrunk.armed.revealed).not.toBeNull();
    // The face that stepped down held a committed key the roll left unseated: it spends with the closing keys.
    expect(shrunk.retired).toHaveLength(5);
    expect(seatRows()).toBe(6);                                                      // three chairs: a seated key and a next key each
    expect(readNexusDoc(larSealHome())!.sealLineage).toHaveLength(3);
  });

  test("A5 — the retirement's licence: seated, committed and crossing keys stay; a superseded key leaves", async () => {
    await custody("arm-a5");
    await stand([0, 1, 2]);
    const { armed: g } = await writeGenesis();
    const committed = (await committedNextSeats(g.seatedKeys, 2, g.nextKeyCommit))!;
    const spare = (await seatChairs([0], { family: "spare" })).keys[0]!;            // a row no charter seats
    const said = await act("seat.retire", { keys: [g.seatedKeys[0]!, committed[0]!, spare, "4e".repeat(32)] }) as { retired: string[]; kept: unknown[] };
    expect(said).toEqual({ retired: [spare], kept: [{ key: g.seatedKeys[0], why: "seated" }, { key: committed[0], why: "committed" }] });
    // An open crossing keeps the outgoing keys after the roll, until its seal.
    await act("crossing.open");
    const { retired } = await roll();
    expect(retired).toEqual([]);
    const again = await act("seat.retire", { keys: g.seatedKeys }) as { kept: Array<{ why: string }> };
    expect(again.kept.map((k) => k.why)).toEqual(["crossing-open", "crossing-open", "crossing-open"]);
    // A torn charter refuses the whole act: nothing tells a seated key from a spent one there.
    writeFileSync(nexusCharterDocPath(larSealHome()), "a charter that stands and will not read");
    expect(await why(act("seat.retire", { keys: g.seatedKeys }))).toMatch(/^act-refused: the charter stands but reads TORN/);
  });

  test("A6 — a head that commits a set this vessel does not hold refuses; an unarmed head refuses", async () => {
    await custody("arm-a6");
    await stand([0]);
    const { armed } = await writeGenesis();
    const elsewhere = genesisCharterEpoch(armed.seatedKeys, 1, sealKeySetHash(["5a".repeat(32)], 1));
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: elsewhere.epochCid, sealLineage: [elsewhere], kahu: armed.kahu });
    const before = seatRows();
    expect(await why(act("seat.arm-roll"))).toMatch(/^act-refused: this vessel holds no key-set the standing head pre-committed/);
    const unarmed = genesisCharterEpoch(armed.seatedKeys, 1, "");
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: unarmed.epochCid, sealLineage: [unarmed], kahu: armed.kahu });
    expect(await why(act("seat.arm-roll"))).toMatch(/^act-refused: rotation unarmed/);
    expect(seatRows()).toBe(before);                                                 // neither refusal minted a row
  });

  test("A7 — at the floor the armings, the retirement and the roll's hand refuse; the held reading answers", async () => {
    const c = await custody("arm-a7");
    await stand([0]);
    const { armed } = await writeGenesis();
    await c.holder.lock();
    const steps = [() => act("seat.arm-genesis"), () => act("seat.arm-roll"), () => act("seat.retire", { keys: armed.seatedKeys }),
      () => act("seal.sign", { seat: armed.seatedKeys[0], image: "ab" })];
    for (const step of steps) expect(await step().catch((e: unknown) => e)).toBeInstanceOf(CustodyLocked);
    expect(await act("seat.held", { keys: armed.seatedKeys })).toEqual({ held: armed.seatedKeys });
  });

  test("A8 — one face's public halves: that face's rows alone; a row that answers another key refuses by name", async () => {
    await custody("arm-a8");
    const zero = await seatChairs([0, 0], { family: "a8" });                        // two calls, one face: the same key
    const one = (await seatChairs([1], { family: "a8" })).keys[0]!;
    expect(await seatKeysOfFace(0)).toEqual([zero.keys[0]]);
    expect(await seatKeysOfFace(1)).toEqual([one]);
    // A row copied under another face's name fails its own seal: the name rides the sealed bytes.
    const rows = readdirSync(larIdentityDir()).filter((f) => f.startsWith("seat-key-h0-"));
    copyFileSync(join(larIdentityDir(), rows[0]!), join(larIdentityDir(), `seat-key-h2-${"0".repeat(32)}.bin`));
    expect(await seatKeysOfFace(2).catch((e: unknown) => e)).toMatchObject({ reading: "key-fails" });
    // A row sealed whole under a name that commits to ANOTHER key opens, and its secret answers the wrong key.
    await updateColdCustodyRow("identity", seatKeyFile(one, 3), () => ({ plaintext: chairSeed(0, 0, "a8"), value: undefined }));
    expect(await seatKeysOfFace(3).catch((e: unknown) => e)).toBeInstanceOf(CustodyRowUnavailable);
    expect(await seatKeysOfFace(3).catch((e: unknown) => e)).toMatchObject({ reading: "names-another-key" });
  });

  test("A9 — the roll's hand signs only what this vessel's arming holds", async () => {
    await custody("arm-a9");
    await stand([0, 1, 2]);
    const { armed: g, genesis } = await writeGenesis();
    const committed = (await committedNextSeats(g.seatedKeys, 2, g.nextKeyCommit))!;
    const following = (await seatChairs([0, 1, 2], { family: "a9-next" })).keys;
    const image = (keys: readonly string[], next: string): string =>
      Buffer.from(sealRollBytes({ prevEpochCid: genesis.epochCid, keys, threshold: 2, nextKeyCommit: next })).toString("hex");
    const stranger = Buffer.from(await (await import("@noble/ed25519")).getPublicKeyAsync(new Uint8Array(32).fill(77))).toString("hex");
    // A seat change that adds a key no row here holds: the committed hands sign none of it.
    expect(await why(act("seal.sign", { seat: committed[0], image: image([...committed, stranger], sealKeySetHash(following, 2)) })))
      .toMatch(/^act-refused: the roll seats a key that rests in no seat row on this vessel/);
    // A roll whose forward commitment names a set no row here holds: refused, though it seats the committed set.
    expect(await why(act("seal.sign", { seat: committed[0], image: image(committed, sealKeySetHash(["5b".repeat(32), "6c".repeat(32), "7d".repeat(32)], 2)) })))
      .toMatch(/^act-refused: the roll's forward commitment names no key-set this vessel's arming holds/);
    // A roll whose forward set names the closing keys, which rest here and which the roll spends: refused.
    expect(await why(act("seal.sign", { seat: committed[0], image: image(committed, sealKeySetHash(g.seatedKeys, 2)) })))
      .toMatch(/^act-refused: the roll's forward commitment names no key-set this vessel's arming holds/);
    expect(await why(act("seal.sign", { seat: committed[0], image: image(committed, sealKeySetHash(following, 2)) }))).toBe("ran");   // CONTROL
  });

  test("A10 — the retirement refuses where a record reads unwhole; an arming settles its faces first", async () => {
    await custody("arm-a10");
    await stand([0, 1, 2]);
    const { armed: g } = await writeGenesis();
    // A stopped arming's rows (a spare row on face 0) leave at the next arming; every needed row stays.
    const spare = (await seatChairs([0], { family: "a10-spare" })).keys[0]!;
    expect(seatRows()).toBe(7);
    await act("seat.arm-genesis");                                                   // the same seat again
    expect(await act("seat.held", { keys: [spare] })).toEqual({ held: [] });
    expect(seatRows()).toBe(6);
    // A carried charter whose seat this vessel holds commits a next key that rests here: an arming that settles
    // the same face leaves both standing.
    const [carriedSeat, carriedNext] = (await seatChairs([0, 0], { family: "a10-carried" }).then(() => Promise.all([
      seatChairs([0], { family: "a10-carried-seat" }), seatChairs([0], { family: "a10-carried-next" }),
    ]))).map((c) => c.keys[0]!) as [string, string];
    const carriedGenesis = genesisCharterEpoch([carriedSeat], 1, sealKeySetHash([carriedNext], 1));
    writeNexusDoc(join(larSealHome(), "carried", carriedGenesis.epochCid), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: carriedGenesis.epochCid, sealLineage: [carriedGenesis], kahu: [{ displayName: "Carried", verifyingKey: carriedSeat }] });
    await act("seat.arm-genesis");
    expect(await act("seat.held", { keys: [carriedSeat, carriedNext] })).toEqual({ held: [carriedSeat, carriedNext] });
    rmSync(join(larSealHome(), "carried"), { recursive: true, force: true });
    // A carried charter that stands and reads torn: nothing retires.
    mkdirSync(join(larSealHome(), "carried", "epoch0-" + "ab".repeat(32)), { recursive: true });
    writeFileSync(nexusCharterDocPath(join(larSealHome(), "carried", "epoch0-" + "ab".repeat(32))), "a carried charter that will not read");
    expect(await why(act("seat.retire", { keys: g.seatedKeys }))).toMatch(/^act-refused: a carried charter stands and reads TORN/);
    rmSync(join(larSealHome(), "carried"), { recursive: true, force: true });
    // A standing commitment this vessel cannot name protects every row: nothing retires.
    const doc = readNexusDoc(larSealHome())!;
    const elsewhere = genesisCharterEpoch(g.seatedKeys, 2, sealKeySetHash(["5a".repeat(32)], 1));
    writeNexusDoc(larSealHome(), { ...doc, sealEpochCid: elsewhere.epochCid, sealLineage: [elsewhere] });
    const spare2 = (await seatChairs([1], { family: "a10-spare" })).keys[0]!;
    expect(await why(act("seat.retire", { keys: [spare2] }))).toMatch(/^act-refused: the standing head commits a next key-set this vessel cannot name/);
    expect(await act("seat.held", { keys: [spare2] })).toEqual({ held: [spare2] });
  });

  test("A11 — a standing chair keeps only a key of its OWN face; a key another face holds gives way to a fresh one", async () => {
    await custody("arm-a11");
    await stand([0]);
    const borrowed = (await seatChairs([1], { family: "a11" })).keys[0]!;           // a seat row of face 1
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: null, kahu: [{ displayName: "Chair 0", verifyingKey: borrowed }] });
    const armed = await act("seat.arm-genesis") as unknown as Armed;
    expect(armed.seatedKeys).toHaveLength(1);
    expect(armed.seatedKeys[0]).not.toBe(borrowed);                                  // face 0's chair takes a key of its own
    expect(armed.superseded).toContain(borrowed);
  });
});
