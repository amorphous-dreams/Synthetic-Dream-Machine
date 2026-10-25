/**
 * seal-ceremony — a SEAT signs what the standing ceremony state licenses, and the growth rite's two rows rest
 * in the clear. A chair's key rests as a seat row of its own (`seat-fixture` stores them), apart from every persona root.
 *
 * THE ROLL (through the custody door's `seal.sign`):
 *   L1  CONTROL: the roll the standing head licenses signs, and the signature verifies under the seat's key.
 *   L2  RED: A WELL-FORMED ROLL THE STANDING STATE DOES NOT LICENSE REFUSES AT THE DOOR, each by its own name: a
 *       roll from another epoch than the standing head; a roll that seats another key-set, or another threshold,
 *       than the head pre-committed, where this vessel holds no set the head committed; a roll whose signing seat
 *       sits in neither set; a key this vessel holds no seat row for; a persona root, which holds no seat row;
 *       a roll from an unarmed head;
 *       a roll with no charter standing, an unsealed one, a torn one; a roll that seats a key the Ed25519 door
 *       refuses. The parent commit's row signed every one of
 *       them for any caller that spelled it canonically.
 *   L3  RED: no other image signs: a crossing record, a roll with a field beside its five, a roll out of its
 *       canonical spelling.
 * THE CROSSING (the rite's own acts):
 *   C1  the rite walks: open, (the chain moves), bind, sign as the outgoing and incoming hands, witness, seal. Both
 *       rows rest as public JSON with no vessel key; the record verifies; the pending row leaves.
 *   C2  RED: A HAND MARKS ONLY THE CROSSING THAT STANDS, AS WHAT IT HOLDS THERE. No crossing, an unbound one, a
 *       face that holds no seat key in either set (it may witness, never sign), a face that holds one (it may
 *       sign, never witness), a face whose root this vessel does not hold: each refuses, and the pending row keeps
 *       its bytes. A face that held its chair across the roll holds one key in each set, and both sign.
 *   C3  RED: the order holds: a second open refuses; a bind before the chain moved refuses; a second bind refuses;
 *       a seal short of either quorum refuses, and the pending row stands with nothing committed.
 *   C4  PREPARED WITHOUT COMMIT RESUMES; COMMITTED WITHOUT REMOVAL RESUMES; COMMIT WITHOUT PREPARE READS CLEAN. A
 *       seal that committed its record and stopped before it removed the pending row seals again to ONE kept
 *       record and no pending row; kept records with no pending row read as a clean state that opens anew.
 *   C5  RED: another shape refuses each row by name; a locked seat still reads public rows.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  NEXUS_DOC_DOMAIN, RESERVE_TRANSITION_DOMAIN, canonicalJsonBytes, charterInceptionBytes, charterInceptionImage, genesisOfInception, verifySealLineage, ed25519SignerFromSeed, hex, mintCharterEpoch, readVkCarrier,
  rotateSealEpoch, sealKeySetHash, sealLineageHead, sealRollBytes, seatNextDigest, verifyEd25519,
  type NexusDoc, type SealEpoch,
} from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { nexusCharterDocPath, readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { verifyReserveTransition, type ReserveTransition } from "../src/reserve-transition.js";
import { TRANSITIONS_FILE, TRANSITION_PENDING_FILE, boundCore, dropPendingCrossing, keepCrossingMark, readCrossing, sealCrossing } from "../src/seal-ceremony.js";
import { SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { seatChairs, type SeatHand } from "./seat-fixture.js";
import { bookedGenesis } from "../../lararium-mesh/tests/charter-fixture.js";
import { fixtureKey } from "./fixture-keys.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(() => c.drop());
  return c;
}

/** Why an act refused: `<reason>: <message>` for the door's own refusals, the error's class otherwise. */
const why = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof SealedActRefused ? `${e.reason}: ${e.message}` : (e as Error).constructor.name));
const act = (name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> => runSealedAct(name, args, ctx);

/** Seat keys for faces 0..n-1 at `generation`, stored as this vessel's rows; answer their public keys. */
async function seats(n: number, generation = 0): Promise<string[]> {
  return [...(await seatChairs(Array.from({ length: n }, (_, i) => i), { generation })).keys];
}
/** The hands of faces 0..n-1 at `generation`, signing by hand outside every door. */
async function handsOf(n: number, generation: number): Promise<readonly SeatHand[]> {
  return (await seatChairs(Array.from({ length: n }, (_, i) => i), { generation })).hands;
}
/** Write a charter whose chain holds `lineage`, seated by `keys` at `threshold`. */
function charter(keys: readonly string[], threshold: number, lineage: SealEpoch[] | null): NexusDoc {
  const doc: NexusDoc = lineage
    ? { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: lineage.at(-1)!.epochCid, sealLineage: lineage, kahu: keys.map((verifyingKey, i) => ({ chairLabel: `Chair ${i}`, verifyingKey })) }
    : { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: null, kahu: keys.map((verifyingKey, i) => ({ chairLabel: `Chair ${i}`, verifyingKey })) };
  writeNexusDoc(larSealHome(), doc);
  return doc;
}
/**
 * A LAWFUL successor epoch after `prev`: the seats at `indexes` of generation `generation` reveal the key-set `prev`
 * pre-committed, sign the roll by hand, and pre-commit the next generation's set. The rite reads a head only off a
 * lineage that verifies, so a test chain moves by real rolls.
 */
async function successor(prev: SealEpoch, generation: number, n: number, threshold: number, indexes: readonly number[]): Promise<SealEpoch> {
  const keys = await seats(n, generation);
  const hands = await handsOf(n, generation);
  const signers = indexes.map((i) => hands[i]!);
  // A roll off the genesis reveals the genesis seats (the generation before), under the same threshold.
  const closing = prev.predecessors.length === 0 ? { keys: await seats(n, generation - 1), threshold } : undefined;
  const rolled = await rotateSealEpoch(prev, { keys, threshold }, await commitOf(keys, await seats(n, generation + 1), threshold), signers, earlierOf(prev), closing);
  if (!rolled.ok) throw new Error(`the fixture's roll refused: ${rolled.reason}`);
  return rolled.epoch;
}
/** The commitment a head makes to `successors`: successor i of key i, one digest per seat in the sorted order of `keys`. */
async function commitOf(keys: readonly string[], successors: readonly string[], threshold: number): Promise<{ digests: string[]; threshold: number }> {
  const pairs = keys.map((key, i) => ({ key: key.toLowerCase(), next: successors[i]! })).sort((a, b) => a.key.localeCompare(b.key));
  return { digests: pairs.map((p) => seatNextDigest(p.next.toLowerCase())), threshold };
}
const flat = (next: { digests: string[]; threshold: number }): { nextKeyDigests: string[]; nextThreshold: number } => ({ nextKeyDigests: next.digests, nextThreshold: next.threshold });
/** The epochs of the standing lineage before `head`: the roll law reads them for re-seated keys and re-spent digests. */
function earlierOf(head: SealEpoch): SealEpoch[] {
  const lineage = readNexusDoc(larSealHome())?.sealLineage ?? [];
  const at = lineage.findIndex((e) => e.epochCid === head.epochCid);
  return at > 0 ? lineage.slice(0, at) : [];
}
const rollImage = (parts: { predecessor: string; keys: readonly string[]; threshold: number; next: { digests: string[]; threshold: number } }): string =>
  hex(sealRollBytes({ predecessor: parts.predecessor, keys: parts.keys, threshold: parts.threshold, ...flat(parts.next) }));
const pendingPath = (): string => join(larSealHome(), TRANSITION_PENDING_FILE);
const keptPath = (): string => join(larSealHome(), TRANSITIONS_FILE);

describe("a roll signs only under the charter that licenses it", () => {
  test("L1/L2 — the licensed roll signs; every well-formed roll the standing state does not license refuses by name", async () => {
    await custody("ceremony-l");
    const [k0, k1, k2] = await seats(3);
    const root = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey.toLowerCase();
    // The genesis seats faces 0 and 1 at 2-of-2 and commits their generation-1 keys, one digest per seat.
    const [n0, n1] = await seats(2, 1);
    const genesis = bookedGenesis([k0!, k1!], 2, await commitOf([k0!, k1!], [n0!, n1!], 2));
    charter([k0!, k1!], 2, [genesis]);
    const sign = (image: string, verifyingKey: string = n0!): Promise<Record<string, unknown>> => act("seal.sign", { seat: verifyingKey, image });
    const following = await commitOf([n0!, n1!], await seats(2, 2), 2);
    const licensed = rollImage({ predecessor: genesis.epochCid, keys: [n0!, n1!], threshold: 2, next: following });

    // L1 CONTROL: the roll this head licenses signs, for each seated seat, and the signature verifies.
    for (const key of [n0!, n1!]) {
      const signed = await sign(licensed, key) as { signer: string; sig: string };
      expect(signed.signer).toBe(key);
      expect(verifyEd25519(signed.sig, Uint8Array.from(Buffer.from(licensed, "hex")), key)).toBe(true);
    }

    // L2 RED: each of these spells a whole, canonical roll. None stands licensed, and none signs.
    expect(await why(sign(rollImage({ predecessor: "epoch-" + "ab".repeat(32), keys: [n0!, n1!], threshold: 2, next: following })))).toMatch(/^act-refused: the roll steps from another epoch/);
    expect(await why(sign(rollImage({ predecessor: genesis.epochCid, keys: [n0!, k2!], threshold: 2, next: await commitOf([n0!, k2!], await seats(2, 3), 2) }))))
      .toMatch(/^act-refused: the roll reveals fewer of the seats the standing head committed/);                    // one of two committed seats
    expect(await why(sign(licensed, k2!))).toMatch(/^act-refused: that seat sits outside the roll's key-set/);
    expect(await why(sign(licensed, "7".repeat(64)))).toMatch(/^act-refused: this vessel holds no seat key under that public key/);
    expect(await why(sign(licensed, root))).toMatch(/^act-refused: this vessel holds no seat key under that public key/);   // A PERSONA ROOT SIGNS NO ROLL
    expect(await why(act("seal.sign", { handleIndex: 0, image: licensed }))).toMatch(/^bad-args/);                   // a hand names a seat, never a face
    expect(await why(sign(rollImage({ predecessor: genesis.epochCid, keys: [n0!, n1!], threshold: 2, next: { digests: following.digests.slice(1), threshold: 2 } }))))
      .toMatch(/^act-refused: the roll re-arms its seats short of one distinct digest each/);
    const stranger = hex(await (await import("@noble/ed25519")).getPublicKeyAsync(new Uint8Array(32).fill(66)));
    expect(await why(sign(rollImage({ predecessor: genesis.epochCid, keys: [n0!, n1!, stranger], threshold: 2, next: { digests: [...following.digests, "ee".repeat(32)], threshold: 2 } }))))
      .toMatch(/^act-refused: the roll seats a key that rests in no seat row on this vessel/);

    // A head that pre-committed nothing licenses no roll.
    const unarmed = bookedGenesis([k0!, k1!], 2);
    charter([k0!, k1!], 2, [unarmed]);
    expect(await why(sign(rollImage({ predecessor: unarmed.epochCid, keys: [n0!, n1!], threshold: 2, next: following })))).toMatch(/^act-refused: the standing head pre-committed no next keys/);

    // A roll that seats a key the Ed25519 door refuses licenses nothing, whatever it reveals.
    charter([k0!, k1!], 2, [genesis]);
    expect(await why(sign(rollImage({ predecessor: genesis.epochCid, keys: [n0!, "00".repeat(32)], threshold: 1, next: { digests: ["11".repeat(32), "22".repeat(32)], threshold: 1 } }))))
      .toMatch(/^act-refused: the roll seats a key the Ed25519 door refuses/);

    // A CHARTER THAT PARSES AND CARRIES A LINEAGE THAT DOES NOT VERIFY LICENSES NOTHING: a head forged onto the
    // chain with no roll, and a true head that does not bind the chairs the charter seats.
    const forged = mintCharterEpoch({ keySetHash: sealKeySetHash([n0!, n1!], 2), nextKeyDigests: following.digests, nextThreshold: 2, predecessors: [genesis.epochCid] });
    charter([n0!, n1!], 2, [genesis, forged]);
    expect(await why(sign(rollImage({ predecessor: forged.epochCid, keys: [n0!, n1!], threshold: 2, next: following })))).toMatch(/^act-refused: the charter's seal lineage does not verify/);
    charter([k0!, k2!], 2, [genesis]);                                                 // the true genesis, under chairs it never bound
    expect(await why(sign(licensed))).toMatch(/^act-refused: the charter's seal lineage does not verify/);
    charter([k0!, k1!], 2, [genesis]);
    expect(await why(sign(licensed))).toBe("ran");                                     // CONTROL: the true charter licenses its roll again

    // An unsealed charter, a torn one and none at all each license nothing.
    charter([k0!, k1!], 2, null);
    expect(await why(sign(licensed))).toMatch(/^act-refused: the charter stands UNSEALED/);
    writeFileSync(nexusCharterDocPath(larSealHome()), "a charter that stands and will not read");
    expect(await why(sign(licensed))).toMatch(/^act-refused: the charter stands but reads TORN/);
  });

  test("L3 — no other image signs: a crossing record, a roll with a seventh field, a roll out of its canonical spelling", async () => {
    await custody("ceremony-l3");
    const [k0] = await seats(1);
    const [n0] = await seats(1, 1);
    const genesis = bookedGenesis([k0!], 1, await commitOf([k0!], [n0!], 1));
    charter([k0!], 1, [genesis]);
    const roll = sealRollBytes({ predecessor: genesis.epochCid, keys: [n0!], threshold: 1, ...flat(await commitOf([n0!], await seats(1, 2), 1)) });
    expect(await why(act("seal.sign", { seat: n0, image: hex(roll) }))).toBe("ran");          // CONTROL
    const text = new TextDecoder().decode(roll);
    const images: Array<[string, Uint8Array]> = [
      ["a crossing record", canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN, fromEpochCid: genesis.epochCid, toEpochCid: "b", oldKeySetHash: "c", newKeySetHash: "d", rite: "e" })],
      ["a roll with a seventh field", canonicalJsonBytes({ ...(JSON.parse(text) as Record<string, unknown>), note: "also sign this" })],
      ["a roll out of its canonical spelling", new TextEncoder().encode(text.replace("{", "{ "))],
      ["a roll with bytes after it", Uint8Array.from([...roll, 0x20])],
      ["a roll whose keys read upper-case", new TextEncoder().encode(text.replace(n0!, n0!.toUpperCase()))],
      ["bytes that spell no record", new TextEncoder().encode("a synthetic image to sign")],
    ];
    for (const [name, image] of images) expect(await why(act("seal.sign", { seat: n0, image: hex(image) })), name).toMatch(/^act-refused: this door signs a charter roll/);
  });
});

describe("an inception signs only where its image licenses it", () => {
  test("I1 — a seed's seats sign their own armed inception; a foreign seat, an unarmed image, a joint shape off two of two, a reused successor and another image each refuse by name", async () => {
    await custody("ceremony-i");
    const [k0, k1] = await seats(2);
    const [n0, n1] = await seats(2, 1);
    const next = await commitOf([k0!, k1!], [n0!, n1!], 2);
    const incept = (image: ReturnType<typeof charterInceptionImage>, key: string = k0!) =>
      act("seal.incept", { seat: key, image: hex(charterInceptionBytes(image)) });
    // I1 CONTROL: every held seat signs the armed seed image, and the genesis reads as a charter.
    const image = charterInceptionImage([k0!, k1!], 2, next);
    const signatures = await Promise.all([k0!, k1!].map(async (k) => ({ signer: k, sig: (await incept(image, k))["sig"] as string })));
    const genesis = genesisOfInception(image, signatures);
    expect(verifySealLineage([genesis])).toBe(true);
    // RED vectors: each spells a whole, canonical inception the door licenses no signature for.
    const foreign = fixtureKey(0x5c);
    expect(await why(incept(charterInceptionImage([k0!, foreign], 2, await commitOf([k0!, foreign], [n0!, n1!], 2))))).toMatch(/^act-refused: a household seed seats only keys this vessel holds/);
    expect(await why(incept(charterInceptionImage([k0!, k1!], 2)))).toMatch(/^act-refused: the inception commits no successor/);
    // A joint founding signs only for an offer this vessel recorded and judged; none stands, so none signs.
    expect(await why(incept(charterInceptionImage([k0!, foreign], 2, await commitOf([k0!, foreign], [n0!, n1!], 2), { offer: "ab".repeat(32), cadence: "cd".repeat(32) })))).toMatch(/^act-refused: this vessel holds no judged offer for that joint founding/);
    expect(await why(incept(image, (await seats(3))[2]!))).toMatch(/^act-refused: that seat sits outside the inception's key-set/);
    const notCanonical = Buffer.from(JSON.stringify(image, null, 1)).toString("hex");
    expect(await why(act("seal.incept", { seat: k0!, image: notCanonical }))).toMatch(/^act-refused: this door signs a charter inception in its canonical spelling/);
    // REUSED SUCCESSOR: once a charter holding these successors stands here, no inception may commit them again.
    charter([k0!, k1!], 2, [genesis]);
    expect(await why(incept(image))).toMatch(/^act-refused: the inception commits a successor a charter this vessel holds already committed/);
    const fresh = charterInceptionImage([k0!, k1!], 2, await commitOf([k0!, k1!], await seats(2, 3), 2));
    expect((await incept(fresh))["signer"]).toBe(k0!);   // CONTROL: fresh successors sign
    // A carried charter that reads torn hides what it committed: nothing incepts until it is repaired.
    const tornHome = join(larSealHome(), "carried", `nexus-${"cd".repeat(32)}`);
    mkdirSync(dirname(nexusCharterDocPath(tornHome)), { recursive: true });
    writeFileSync(nexusCharterDocPath(tornHome), "a torn charter", "utf8");
    expect(await why(incept(fresh))).toMatch(/^act-refused: a charter this vessel holds reads TORN/);
  });
});

describe("the growth rite's rows", () => {
  /**
   * A sealed charter of three chairs at 2-of-3 over faces 0-2's generation-0 seat keys, committing their
   * generation-1 keys; four held roots (the fourth face holds no chair and witnesses).
   */
  async function founded(label: string): Promise<{ c: SeatedScratchCustody; keys: string[]; witness: string; genesis: SealEpoch }> {
    const c = await custody(label);
    const keys = await seats(3);
    for (let i = 0; i < 4; i++) await generateOrLoadPersonaGroupRoot(i);
    const witness = (await generateOrLoadPersonaGroupRoot(3)).verifyingKey.toLowerCase();
    const genesis = bookedGenesis(keys, 2, await commitOf(keys, await seats(3, 1), 2));
    charter(keys, 2, [genesis]);
    generation = 0;
    return { c, keys, witness, genesis };
  }
  let generation = 0;
  /** Move the chain one epoch on by a lawful roll: the next generation's three chairs, at 2-of-3. */
  async function moveChain(): Promise<{ next: SealEpoch; keys: string[] }> {
    const doc = readNexusDoc(larSealHome())!;
    generation += 1;
    const next = await successor(sealLineageHead(doc)!, generation, 3, 2, [0, 1]);
    const keys = await seats(3, generation);
    charter(keys, 2, [...doc.sealLineage!, next]);
    return { next, keys };
  }

  test("C1 — the rite walks, both rows rest as plain JSON, and the record verifies", async () => {
    const { keys, witness, genesis } = await founded("ceremony-c1");
    expect(await act("crossing.state")).toEqual({ kept: 0, open: null });
    expect(await act("crossing.open")).toEqual({ fromEpochCid: genesis.epochCid, oldHands: 3 });
    const plainPending = readFileSync(pendingPath());
    const opened = JSON.parse(plainPending.toString("utf8")) as { fromEpochCid: string; oldKeys: string[] };
    expect(opened.fromEpochCid).toBe(genesis.epochCid);
    expect(opened.oldKeys).toEqual(expect.arrayContaining(keys));
    expect(readVkCarrier(plainPending)).toBe("bare");
    // The chain moves: the same three chairs, each on its committed next key (faces 0-2 hold a key in each set).
    const { next, keys: rolled } = await moveChain();
    const both = (i: number): string[] => [keys[i]!, rolled[i]!].sort();
    expect(await act("crossing.bind")).toEqual({ toEpochCid: next.epochCid });
    expect(await act("crossing.sign", { handleIndex: 0 })).toEqual({ as: both(0), old: true, new: true });
    expect(await act("crossing.sign", { handleIndex: 1 })).toEqual({ as: both(1), old: true, new: true });
    expect(await act("crossing.sign", { handleIndex: 1 })).toEqual({ as: both(1), old: true, new: true });   // a hand that signs again counts once
    const note = "watched the rite at the hearth, script in hand";
    expect(await act("crossing.witness", { handleIndex: 3, note })).toEqual({ by: witness });
    expect(await act("crossing.state")).toEqual({ kept: 0, open: { fromEpochCid: genesis.epochCid, toEpochCid: next.epochCid, oldSigs: 2, newSigs: 2, witnesses: 1 } });
    const sealed = await act("crossing.seal") as { transitionCid: string; independentWitnesses: number; resumed: boolean; retired: number };
    // THE OUTGOING KEYS RETIRE AT THE SEAL: their marks rest in the record, and the charter seats them no more.
    expect(sealed).toMatchObject({ independentWitnesses: 1, resumed: false, retired: 3 });
    expect(await act("seat.held", { keys })).toEqual({ held: [] });
    expect(await act("seat.held", { keys: rolled })).toEqual({ held: rolled });      // CONTROL: the seated keys stay
    expect(existsSync(pendingPath())).toBe(false);
    const keptBytes = readFileSync(keptPath());
    expect(readVkCarrier(keptBytes)).toBe("bare");
    const kept = JSON.parse(keptBytes.toString("utf8")) as ReserveTransition[];
    expect(keptBytes.includes(Buffer.from(sealed.transitionCid))).toBe(true);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ transitionCid: sealed.transitionCid, fromEpochCid: genesis.epochCid, toEpochCid: next.epochCid });
    expect(await verifyReserveTransition(kept[0]!, { oldKeys: keys, oldThreshold: 2, newKeys: rolled, newThreshold: 2 })).toEqual({ ok: true, independentWitnesses: 1 });
    expect(await act("crossing.state")).toEqual({ kept: 1, open: null });
  });

  test("C2 — a hand marks only the crossing that stands, as what it holds there", async () => {
    await founded("ceremony-c2");
    // No crossing stands: no hand marks anything.
    expect(await why(act("crossing.sign", { handleIndex: 0 }))).toMatch(/^act-refused: no bound crossing stands/);
    expect(await why(act("crossing.witness", { handleIndex: 3, note: "x" }))).toMatch(/^act-refused: no bound crossing stands/);
    expect(await why(act("crossing.seal"))).toMatch(/^act-refused: no bound crossing stands/);
    expect(await why(act("crossing.bind"))).toMatch(/^act-refused: no crossing stands open/);
    await act("crossing.open");
    // Open and unbound: the byte-image stands open, so no hand signs it yet.
    expect(await why(act("crossing.sign", { handleIndex: 0 }))).toMatch(/^act-refused: no bound crossing stands/);
    await moveChain();
    await act("crossing.bind");
    const bound = readFileSync(pendingPath());
    expect(await why(act("crossing.sign", { handleIndex: 3 }))).toMatch(/^act-refused: the face at h3 holds no seat key in either set/);
    expect(await why(act("crossing.witness", { handleIndex: 0, note: "I held a chair" }))).toMatch(/^act-refused: a keyholder attests as a party/);
    expect(await why(act("crossing.sign", { handleIndex: 9 }))).toMatch(/^act-refused: the face at h9 holds no seat key in either set/);
    expect(await why(act("crossing.witness", { handleIndex: 9, note: "x" }))).toMatch(/^act-refused: this vessel holds no persona root at h9/);
    expect(await why(act("crossing.witness", { handleIndex: 3 }))).toMatch(/^bad-args/);              // a witness mark carries a note
    expect(await why(act("crossing.sign", { handleIndex: 0, image: "ab" }))).toMatch(/^bad-args/);    // no hand takes an image
    expect(readFileSync(pendingPath()).equals(bound)).toBe(true);                    // nothing a refusal touched moved
    expect(await why(act("crossing.sign", { handleIndex: 0 }))).toBe("ran");         // CONTROL
    expect(readFileSync(pendingPath()).equals(bound)).toBe(false);
    // A MARK LANDS ON THE CROSSING IT WAS MADE FOR, OR NOWHERE. A mark reads the crossing, makes its signature,
    // then writes; another hand replaces the pending row between the two. The write half runs here by itself,
    // over the core the mark read, after the row moved: it refuses, and the moved crossing takes nothing.
    const read = (await readCrossing()).pending!;
    const core = boundCore(read)!;
    const moved = { ...read, rite: "lar:///a-synthetic/other-rite", oldSigs: [], newSigs: [] };
    writeFileSync(pendingPath(), JSON.stringify(moved));
    const late = await keepCrossingMark(core, (p) => ({ next: { ...p, witnesses: [] }, value: "kept" })).catch((e: unknown) => e);
    expect(String((late as Error).message)).toMatch(/the crossing moved under this mark/);
    expect(await act("crossing.state")).toMatchObject({ open: { oldSigs: 0, newSigs: 0 } });
    // A seal's removal holds the same fence: the pending row leaves only while it holds the crossing that sealed.
    const { reserveTransitionCidOf } = await import("../src/reserve-transition.js");
    expect(await dropPendingCrossing(reserveTransitionCidOf(core))).toBe(false);    // the row holds another crossing: it stays
    expect(await act("crossing.state")).toMatchObject({ open: { oldSigs: 0 } });
    expect(await dropPendingCrossing(reserveTransitionCidOf(boundCore(moved as never)!))).toBe(true);   // CONTROL: its own crossing leaves
    expect(await act("crossing.state")).toMatchObject({ open: null });
  });

  test("C3 — the order holds, and a crossing short of a quorum refuses to seal", async () => {
    await founded("ceremony-c3");
    await act("crossing.open");
    expect(await why(act("crossing.open"))).toMatch(/^act-refused: a crossing already stands open/);
    expect(await why(act("crossing.bind"))).toMatch(/^act-refused: the chain has not moved/);
    await moveChain();
    await act("crossing.bind");
    expect(await why(act("crossing.bind"))).toMatch(/^act-refused: the crossing is already bound/);
    await act("crossing.sign", { handleIndex: 0 });                                  // one hand of a 2-of-3
    const short = readFileSync(pendingPath());
    expect(await why(act("crossing.seal"))).toMatch(/^act-refused: crossing REFUSED \(fail-closed\): the outgoing quorum does not hold/);
    expect(readFileSync(pendingPath()).equals(short)).toBe(true);                    // the pending crossing stands
    expect(existsSync(keptPath())).toBe(false);                                      // nothing committed
    await act("crossing.sign", { handleIndex: 1 });
    expect(await why(act("crossing.seal"))).toBe("ran");                             // CONTROL: with the quorum, it seals
  });

  test("C4 — a seal that committed and stopped resumes to one kept record; kept records with no pending row read clean", async () => {
    await founded("ceremony-c4");
    await act("crossing.open");
    await moveChain();
    await act("crossing.bind");
    await act("crossing.sign", { handleIndex: 0 });
    await act("crossing.sign", { handleIndex: 1 });
    // PREPARED WITHOUT COMMIT: the rite stops before its seal. The pending row stands and still seals.
    expect(await readCrossing()).toMatchObject({ kept: 0 });
    const prepared = readFileSync(pendingPath());
    const first = await sealCrossing();
    expect(first.resumed).toBe(false);
    // COMMITTED WITHOUT REMOVAL: the record rests in `transitions.json`, and the pending row came back as the
    // process that died would have left it. The same seal keeps ONE record and removes the pending row.
    writeFileSync(pendingPath(), prepared);
    expect(await act("crossing.state")).toMatchObject({ kept: 1, open: { oldSigs: 2 } });
    const again = await sealCrossing();
    expect(again).toMatchObject({ transitionCid: first.transitionCid, resumed: true });
    expect(await act("crossing.state")).toEqual({ kept: 1, open: null });
    // COMMIT WITHOUT PREPARE READS CLEAN: one kept record, no pending row, and a new crossing opens from the head.
    expect(await why(act("crossing.open"))).toBe("ran");
    await moveChain();
    await act("crossing.bind");
    await act("crossing.sign", { handleIndex: 0 });
    await act("crossing.sign", { handleIndex: 2 });
    expect((await sealCrossing()).resumed).toBe(false);
    expect(await act("crossing.state")).toEqual({ kept: 2, open: null });            // the second record lands beside the first
    // A kept record whose cid does not recompute over its own fields reads malformed: the row holds records, never claims.
    const kept = JSON.parse(readFileSync(keptPath(), "utf8")) as ReserveTransition[];
    writeFileSync(keptPath(), JSON.stringify([kept[0], { ...kept[1]!, rite: "another-rite" }]));
    expect(await act("crossing.state").catch((e: unknown) => e)).toMatchObject({ home: "seal", file: TRANSITIONS_FILE, reading: "malformed" });
  });

  test("C5 — public rows read without a key; malformed rows refuse by name", async () => {
    const b = await custody("ceremony-c5-b");
    const a = await custody("ceremony-c5-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    const walk = async (): Promise<void> => {
      const keys = await seats(3);
      charter(keys, 2, [bookedGenesis(keys, 2, await commitOf(keys, await seats(3, 1), 2))]);
      await act("crossing.open");
      const doc = readNexusDoc(larSealHome())!;
      charter(await seats(3, 1), 2, [...doc.sealLineage!, await successor(sealLineageHead(doc)!, 1, 3, 2, [0, 1])]);
      await act("crossing.bind");
      await act("crossing.sign", { handleIndex: 0 });
      await act("crossing.sign", { handleIndex: 1 });
    };
    as(b);
    await walk();
    const foreignPending = pendingPath();
    as(a);
    await walk();
    const own = readFileSync(pendingPath());
    // Public rows carry no vessel's seal: two vessels that walk the same crossing rest the same bytes, and either reads the other's.
    expect(own.equals(readFileSync(foreignPending))).toBe(true);
    copyFileSync(foreignPending, pendingPath());                                     // a pending row another vessel wrote
    const foreign = readFileSync(pendingPath());
    expect((await act("crossing.state"))["open"]).not.toBeNull();
    expect(readFileSync(pendingPath()).equals(foreign)).toBe(true);
    writeFileSync(pendingPath(), own);
    // Another shape under the right key refuses `malformed`: a far side half bound, a field beside the row's own, bare JSON.
    const whole = JSON.parse(readFileSync(pendingPath(), "utf8")) as Record<string, unknown>;
    const { newKeys: _dropped, ...halfBound } = whole;
    for (const shape of [halfBound, { ...whole, extra: 1 }, { ...whole, oldSigs: [{ signer: "x", sig: "y" }] }, { ...whole, oldThreshold: 0 }, [whole]]) {
      writeFileSync(pendingPath(), own);
      writeFileSync(pendingPath(), JSON.stringify(shape));
      const refused = await act("crossing.state").catch((e: unknown) => e);
      expect(refused, JSON.stringify(shape).slice(0, 50)).toBeInstanceOf(CustodyRowUnavailable);
      expect(refused).toMatchObject({ home: "seal", file: TRANSITION_PENDING_FILE, reading: "malformed" });
      expect(await why(act("crossing.seal"))).toBe("CustodyRowUnavailable");
    }
    writeFileSync(pendingPath(), own);
    // A kept row that does not read whole refuses the seal before it commits beside it.
    writeFileSync(keptPath(), JSON.stringify([{ transitionCid: "rtr-not-a-record" }]));
    expect(await act("crossing.seal").catch((e: unknown) => e)).toMatchObject({ home: "seal", file: TRANSITIONS_FILE, reading: "malformed" });
    expect(readFileSync(pendingPath()).equals(own)).toBe(true);                      // the pending row stands
    // The floor reads both public rows, but a seat signature still needs its key.
    writeFileSync(keptPath(), "[]");
    await a.holder.lock();
    expect((await act("crossing.state"))["open"]).not.toBeNull();
    expect(JSON.parse(readFileSync(pendingPath(), "utf8"))).toMatchObject(whole);
    expect(await act("seal.sign", { seat: "ab".repeat(32), image: "ab" }).catch((e: unknown) => e)).toBeInstanceOf(CustodyLocked);
  });
});
