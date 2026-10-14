/**
 * seal-ceremony — a persona root signs what the standing ceremony state licenses, and the growth rite's two rows
 * rest sealed.
 *
 * THE ROLL (through the custody door's `seal.sign`):
 *   L1  CONTROL: the roll the standing head licenses signs, and the signature verifies under the root's key.
 *   L2  RED: A WELL-FORMED ROLL THE STANDING STATE DOES NOT LICENSE REFUSES AT THE DOOR, each by its own name: a
 *       roll from another epoch than the standing head; a roll that seats another key-set, or another threshold,
 *       than the head pre-committed; a roll whose signing root holds no seat in it; a roll from an unarmed head;
 *       a roll with no charter standing, an unsealed one, a torn one; a roll that pre-commits the reserve's
 *       key-set; a roll that seats a key the Ed25519 door refuses. The parent commit's row signed every one of
 *       them for any caller that spelled it canonically.
 *   L3  RED: no other image signs: a crossing record, a roll with a field beside its five, a roll out of its
 *       canonical spelling.
 * THE CROSSING (the rite's own acts):
 *   C1  the rite walks: open, (the chain moves), bind, sign as the outgoing and incoming hands, witness, seal. Both
 *       rows rest sealed and spell no key, signature or note; the sealed record verifies; the pending row leaves.
 *   C2  RED: A HAND MARKS ONLY THE CROSSING THAT STANDS, AS WHAT IT HOLDS THERE. No crossing, an unbound one, a
 *       hand in neither set (it may witness, never sign), a keyholder (it may sign, never witness), a root this
 *       vessel does not hold: each refuses, and the pending row keeps its bytes.
 *   C3  RED: the order holds: a second open refuses; a bind before the chain moved refuses; a second bind refuses;
 *       a seal short of either quorum refuses, and the pending row stands with nothing committed.
 *   C4  PREPARED WITHOUT COMMIT RESUMES; COMMITTED WITHOUT REMOVAL RESUMES; COMMIT WITHOUT PREPARE READS CLEAN. A
 *       seal that committed its record and stopped before it removed the pending row seals again to ONE kept
 *       record and no pending row; kept records with no pending row read as a clean state that opens anew.
 *   C5  RED: a wrong key, another shape and a locked seat refuse each row by name, and nothing lands over them.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  NEXUS_DOC_DOMAIN, RESERVE_TRANSITION_DOMAIN, canonicalJsonBytes, ed25519SignerFromSeed, genesisCharterEpoch, hex, mintCharterEpoch, readVkCarrier,
  rotateSealEpoch, sealKeySetHash, sealLineageHead, sealRollBytes, verifyEd25519,
  type NexusDoc, type SealEpoch,
} from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { readCustodyRow, writeCustodyRow } from "../src/custody-seat.js";
import { nexusCharterDocPath, readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed } from "../src/node-vessel-identity.js";
import { verifyReserveTransition, type ReserveTransition } from "../src/reserve-transition.js";
import { TRANSITIONS_FILE, TRANSITION_PENDING_FILE, boundCore, dropPendingCrossing, keepCrossingMark, readCrossing, sealCrossing } from "../src/seal-ceremony.js";
import { provisionCharterReserve } from "../src/seal-reserve-store.js";
import { SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

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

/** Stand persona roots 0..n-1; answer their public keys. */
async function roots(n: number): Promise<string[]> {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push((await generateOrLoadPersonaGroupRoot(i)).verifyingKey);
  return keys;
}
/** Write a charter whose chain holds `lineage`, seated by `keys` at `threshold`. */
function charter(keys: readonly string[], threshold: number, lineage: SealEpoch[] | null): NexusDoc {
  const doc: NexusDoc = lineage
    ? { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: lineage.at(-1)!.epochCid, sealLineage: lineage, kahu: keys.map((verifyingKey, i) => ({ displayName: `Chair ${i}`, verifyingKey })) }
    : { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: null, kahu: keys.map((verifyingKey, i) => ({ displayName: `Chair ${i}`, verifyingKey })) };
  writeNexusDoc(larSealHome(), doc);
  return doc;
}
/**
 * A LAWFUL successor epoch after `prev`: the seated roots at `indexes` reveal the key-set `prev` pre-committed, sign
 * the roll with their own seeds, and pre-commit the same set again. The rite reads a head only off a lineage that
 * verifies, so a test chain moves by real rolls.
 */
async function successor(prev: SealEpoch, keys: readonly string[], threshold: number, indexes: readonly number[]): Promise<SealEpoch> {
  const signers = await Promise.all(indexes.map(async (i) => {
    const seed = await loadPersonaGroupRootSeed(i);
    return { signer: keys[i]!, sign: ed25519SignerFromSeed(seed) };
  }));
  const rolled = await rotateSealEpoch(prev, { keys, threshold }, sealKeySetHash(keys, threshold), signers);
  if (!rolled.ok) throw new Error(`the fixture's roll refused: ${rolled.reason}`);
  return rolled.epoch;
}
const rollImage = (parts: { prevEpochCid: string; keys: readonly string[]; threshold: number; nextKeyCommit?: string }): string =>
  hex(sealRollBytes({ nextKeyCommit: "", ...parts }));
const pendingPath = (): string => join(larSealHome(), TRANSITION_PENDING_FILE);
const keptPath = (): string => join(larSealHome(), TRANSITIONS_FILE);

describe("a roll signs only under the charter that licenses it", () => {
  test("L1/L2 — the licensed roll signs; every well-formed roll the standing state does not license refuses by name", async () => {
    await custody("ceremony-l");
    const [k0, k1, k2] = await roots(3) as [string, string, string];
    const committed = [k0, k1];                                                     // the key-set the genesis head pre-commits, 2-of-2
    const genesis = genesisCharterEpoch([k0], 1, sealKeySetHash(committed, 2));
    charter([k0], 1, [genesis]);
    const sign = (image: string, handleIndex = 0): Promise<Record<string, unknown>> => act("seal.sign", { handleIndex, image });

    // L1 CONTROL: the roll this head licenses signs, for each seated root, and the signature verifies.
    const licensed = rollImage({ prevEpochCid: genesis.epochCid, keys: committed, threshold: 2, nextKeyCommit: "cd".repeat(32) });
    for (const [index, key] of [[0, k0], [1, k1]] as const) {
      const signed = await sign(licensed, index) as { signer: string; sig: string };
      expect(signed.signer).toBe(key);
      expect(verifyEd25519(signed.sig, Uint8Array.from(Buffer.from(licensed, "hex")), key)).toBe(true);
    }

    // L2 RED: each of these spells a whole, canonical roll. None stands licensed, and none signs.
    expect(await why(sign(rollImage({ prevEpochCid: "epoch-" + "ab".repeat(32), keys: committed, threshold: 2 })))).toMatch(/^act-refused: the roll steps from another epoch/);
    expect(await why(sign(rollImage({ prevEpochCid: genesis.epochCid, keys: [k0, k2], threshold: 2 })))).toMatch(/^act-refused: the roll seats another key-set/);
    expect(await why(sign(rollImage({ prevEpochCid: genesis.epochCid, keys: [k0], threshold: 1 })))).toMatch(/^act-refused: the roll seats another key-set/);
    expect(await why(sign(rollImage({ prevEpochCid: genesis.epochCid, keys: committed, threshold: 1 })))).toMatch(/^act-refused: the roll seats another key-set/);
    expect(await why(sign(licensed, 2))).toMatch(/^act-refused: the root at h2 holds no seat/);
    expect(await why(sign(licensed, 7))).toMatch(/^act-refused: this vessel holds no persona root at h7/);

    // A roll that pre-commits the charter reserve's key-set refuses: no verb reveals it, and the chain would freeze.
    const reserveCommit = "9e".repeat(32);
    await provisionCharterReserve({ bytes: { x: 1, ys: new Uint8Array(32).fill(4) }, custodian: "mine", recoveryEpoch: 1 }, {
      reserveEpoch: 1, nextKeyCommit: reserveCommit, threshold: 2, kahuCount: 3, guardianA: "a", guardianB: "b", mineShareSealed: true, issuedAt: "a-synthetic-stamp",
    });
    expect(((await act("reserve.state"))["state"] as { nextKeyCommit: string }).nextKeyCommit).toBe(reserveCommit);   // the reserve stands
    expect(await why(sign(rollImage({ prevEpochCid: genesis.epochCid, keys: committed, threshold: 2, nextKeyCommit: reserveCommit })))).toMatch(/^act-refused: the roll pre-commits the charter reserve's key-set/);
    expect(await why(sign(licensed))).toBe("ran");                                  // CONTROL: another commitment still signs

    // A head that pre-committed nothing licenses no roll.
    const unarmed = genesisCharterEpoch([k0], 1, "");
    charter([k0], 1, [unarmed]);
    expect(await why(sign(rollImage({ prevEpochCid: unarmed.epochCid, keys: [k0], threshold: 1 })))).toMatch(/^act-refused: the standing head pre-committed no next key-set/);

    // A committed set that holds a key the Ed25519 door refuses licenses no roll, though it hashes true.
    const weak = "00".repeat(32);
    const weakHead = genesisCharterEpoch([k0], 1, sealKeySetHash([k0, weak], 1));
    charter([k0], 1, [weakHead]);
    expect(await why(sign(rollImage({ prevEpochCid: weakHead.epochCid, keys: [k0, weak], threshold: 1 })))).toMatch(/^act-refused: the roll seats a key the Ed25519 door refuses/);

    // A CHARTER THAT PARSES AND CARRIES A LINEAGE THAT DOES NOT VERIFY LICENSES NOTHING: a head forged onto the
    // chain with no roll, and a true head that does not bind the chairs the charter seats.
    const forged = mintCharterEpoch({ keySetHash: sealKeySetHash(committed, 2), nextKeyCommit: sealKeySetHash(committed, 2), prevEpochCid: genesis.epochCid });
    charter(committed, 2, [genesis, forged]);
    expect(await why(sign(rollImage({ prevEpochCid: forged.epochCid, keys: committed, threshold: 2 })))).toMatch(/^act-refused: the charter's seal lineage does not verify/);
    charter([k0, k2], 1, [genesis]);                                                // the true genesis, under chairs it never bound
    expect(await why(sign(licensed))).toMatch(/^act-refused: the charter's seal lineage does not verify/);
    charter([k0], 1, [genesis]);
    expect(await why(sign(licensed))).toBe("ran");                                  // CONTROL: the true charter licenses its roll again

    // An unsealed charter, a torn one and none at all each license nothing.
    charter([k0], 1, null);
    expect(await why(sign(licensed))).toMatch(/^act-refused: the charter stands UNSEALED/);
    writeFileSync(nexusCharterDocPath(larSealHome()), "a charter that stands and will not read");
    expect(await why(sign(licensed))).toMatch(/^act-refused: the charter stands but reads TORN/);
  });

  test("L3 — no other image signs: a crossing record, a roll with a sixth field, a roll out of its canonical spelling", async () => {
    await custody("ceremony-l3");
    const [k0] = await roots(1) as [string];
    const genesis = genesisCharterEpoch([k0], 1, sealKeySetHash([k0], 1));
    charter([k0], 1, [genesis]);
    const roll = sealRollBytes({ prevEpochCid: genesis.epochCid, keys: [k0], threshold: 1, nextKeyCommit: "" });
    expect(await why(act("seal.sign", { handleIndex: 0, image: hex(roll) }))).toBe("ran");            // CONTROL
    const text = new TextDecoder().decode(roll);
    const images: Array<[string, Uint8Array]> = [
      ["a crossing record", canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN, fromEpochCid: genesis.epochCid, toEpochCid: "b", oldKeySetHash: "c", newKeySetHash: "d", rite: "e" })],
      ["a roll with a sixth field", canonicalJsonBytes({ ...(JSON.parse(text) as Record<string, unknown>), note: "also sign this" })],
      ["a roll out of its canonical spelling", new TextEncoder().encode(text.replace("{", "{ "))],
      ["a roll with bytes after it", Uint8Array.from([...roll, 0x20])],
      ["a roll whose keys read upper-case", new TextEncoder().encode(text.replace(k0, k0.toUpperCase()))],
      ["bytes that spell no record", new TextEncoder().encode("a synthetic image to sign")],
    ];
    for (const [name, image] of images) expect(await why(act("seal.sign", { handleIndex: 0, image: hex(image) })), name).toMatch(/^act-refused: this door signs a charter roll/);
  });
});

describe("the growth rite's rows", () => {
  /** A sealed charter of three chairs at 2-of-3, and four held roots (the fourth holds no chair). */
  async function founded(label: string): Promise<{ c: SeatedScratchCustody; keys: string[]; genesis: SealEpoch }> {
    const c = await custody(label);
    const keys = await roots(4);
    const genesis = genesisCharterEpoch(keys.slice(0, 3), 2, sealKeySetHash(keys.slice(0, 3), 2));
    charter(keys.slice(0, 3), 2, [genesis]);
    return { c, keys, genesis };
  }
  /** Move the chain one epoch on by a lawful roll, seating `keys` at `threshold`. */
  async function moveChain(keys: readonly string[], threshold: number): Promise<SealEpoch> {
    const doc = readNexusDoc(larSealHome())!;
    const next = await successor(sealLineageHead(doc)!, keys, threshold, [0, 1]);
    charter(keys, threshold, [...doc.sealLineage!, next]);
    return next;
  }

  test("C1 — the rite walks, both rows rest sealed, and the sealed record verifies", async () => {
    const { keys, genesis } = await founded("ceremony-c1");
    expect(await act("crossing.state")).toEqual({ kept: 0, open: null });
    expect(await act("crossing.open")).toEqual({ fromEpochCid: genesis.epochCid, oldHands: 3 });
    const sealedPending = readFileSync(pendingPath());
    expect(readVkCarrier(sealedPending)).toBe("sealed");
    for (const key of keys.slice(0, 3)) expect(sealedPending.includes(Buffer.from(key)), "a seated key").toBe(false);
    // The chain moves: the same three chairs, re-keyed to a new head (h0, h1 and h2 sit in both sets).
    const next = await moveChain(keys.slice(0, 3), 2);
    expect(await act("crossing.bind")).toEqual({ toEpochCid: next.epochCid });
    expect(await act("crossing.sign", { handleIndex: 0 })).toEqual({ as: keys[0], old: true, new: true });
    expect(await act("crossing.sign", { handleIndex: 1 })).toEqual({ as: keys[1], old: true, new: true });
    expect(await act("crossing.sign", { handleIndex: 1 })).toEqual({ as: keys[1], old: true, new: true });   // a hand that signs again counts once
    const note = "watched the rite at the hearth, script in hand";
    expect(await act("crossing.witness", { handleIndex: 3, note })).toEqual({ by: keys[3] });
    expect(await act("crossing.state")).toEqual({ kept: 0, open: { fromEpochCid: genesis.epochCid, toEpochCid: next.epochCid, oldSigs: 2, newSigs: 2, witnesses: 1 } });
    const sealed = await act("crossing.seal") as { transitionCid: string; independentWitnesses: number; resumed: boolean };
    expect(sealed).toMatchObject({ independentWitnesses: 1, resumed: false });
    expect(existsSync(pendingPath())).toBe(false);
    const keptBytes = readFileSync(keptPath());
    expect(readVkCarrier(keptBytes)).toBe("sealed");
    for (const secret of [keys[0]!, note, sealed.transitionCid]) expect(keptBytes.includes(Buffer.from(secret)), secret.slice(0, 12)).toBe(false);
    const kept = JSON.parse(new TextDecoder().decode((await readCustodyRow("seal", TRANSITIONS_FILE))!)) as ReserveTransition[];
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ transitionCid: sealed.transitionCid, fromEpochCid: genesis.epochCid, toEpochCid: next.epochCid });
    expect(await verifyReserveTransition(kept[0]!, { oldKeys: keys.slice(0, 3), oldThreshold: 2, newKeys: keys.slice(0, 3), newThreshold: 2 })).toEqual({ ok: true, independentWitnesses: 1 });
    expect(await act("crossing.state")).toEqual({ kept: 1, open: null });
  });

  test("C2 — a hand marks only the crossing that stands, as what it holds there", async () => {
    const { keys } = await founded("ceremony-c2");
    // No crossing stands: no hand marks anything.
    expect(await why(act("crossing.sign", { handleIndex: 0 }))).toMatch(/^act-refused: no bound crossing stands/);
    expect(await why(act("crossing.witness", { handleIndex: 3, note: "x" }))).toMatch(/^act-refused: no bound crossing stands/);
    expect(await why(act("crossing.seal"))).toMatch(/^act-refused: no bound crossing stands/);
    expect(await why(act("crossing.bind"))).toMatch(/^act-refused: no crossing stands open/);
    await act("crossing.open");
    // Open and unbound: the byte-image stands open, so no hand signs it yet.
    expect(await why(act("crossing.sign", { handleIndex: 0 }))).toMatch(/^act-refused: no bound crossing stands/);
    await moveChain(keys.slice(0, 3), 2);
    await act("crossing.bind");
    const bound = readFileSync(pendingPath());
    expect(await why(act("crossing.sign", { handleIndex: 3 }))).toMatch(/^act-refused: this hand sits in neither set/);
    expect(await why(act("crossing.witness", { handleIndex: 0, note: "I held a chair" }))).toMatch(/^act-refused: a keyholder attests as a party/);
    expect(await why(act("crossing.sign", { handleIndex: 9 }))).toMatch(/^act-refused: this vessel holds no persona root at h9/);
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
    await writeCustodyRow("seal", TRANSITION_PENDING_FILE, new TextEncoder().encode(JSON.stringify(moved)));
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
    const { keys } = await founded("ceremony-c3");
    await act("crossing.open");
    expect(await why(act("crossing.open"))).toMatch(/^act-refused: a crossing already stands open/);
    expect(await why(act("crossing.bind"))).toMatch(/^act-refused: the chain has not moved/);
    await moveChain(keys.slice(0, 3), 2);
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
    const { keys } = await founded("ceremony-c4");
    await act("crossing.open");
    await moveChain(keys.slice(0, 3), 2);
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
    await moveChain(keys.slice(0, 3), 2);
    await act("crossing.bind");
    await act("crossing.sign", { handleIndex: 0 });
    await act("crossing.sign", { handleIndex: 2 });
    expect((await sealCrossing()).resumed).toBe(false);
    expect(await act("crossing.state")).toEqual({ kept: 2, open: null });            // the second record lands beside the first
    // A kept record whose cid does not recompute over its own fields reads malformed: the row holds records, never claims.
    const kept = JSON.parse(new TextDecoder().decode((await readCustodyRow("seal", TRANSITIONS_FILE))!)) as ReserveTransition[];
    await writeCustodyRow("seal", TRANSITIONS_FILE, new TextEncoder().encode(JSON.stringify([kept[0], { ...kept[1]!, rite: "another-rite" }])));
    expect(await act("crossing.state").catch((e: unknown) => e)).toMatchObject({ home: "seal", file: TRANSITIONS_FILE, reading: "malformed" });
  });

  test("C5 — a wrong key, another shape and a locked seat refuse each row by name", async () => {
    const b = await custody("ceremony-c5-b");
    const a = await custody("ceremony-c5-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    const walk = async (): Promise<void> => {
      const keys = await roots(3);
      charter(keys, 2, [genesisCharterEpoch(keys, 2, sealKeySetHash(keys, 2))]);
      await act("crossing.open");
      const doc = readNexusDoc(larSealHome())!;
      charter(keys, 2, [...doc.sealLineage!, await successor(sealLineageHead(doc)!, keys, 2, [0, 1])]);
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
    expect(own.equals(readFileSync(foreignPending))).toBe(false);                    // two keys, two encodings
    copyFileSync(foreignPending, pendingPath());                                     // a pending row another vessel sealed
    const foreign = readFileSync(pendingPath());
    for (const step of [act("crossing.state"), act("crossing.open"), act("crossing.sign", { handleIndex: 0 }), act("crossing.seal")]) {
      expect(await why(step)).toBe("CustodyRowUnavailable");
    }
    expect(readFileSync(pendingPath()).equals(foreign)).toBe(true);
    writeFileSync(pendingPath(), own);
    // Another shape under the right key refuses `malformed`: a far side half bound, a field beside the row's own, bare JSON.
    const whole = JSON.parse(new TextDecoder().decode((await readCustodyRow("seal", TRANSITION_PENDING_FILE))!)) as Record<string, unknown>;
    const { newKeys: _dropped, ...halfBound } = whole;
    for (const shape of [halfBound, { ...whole, extra: 1 }, { ...whole, oldSigs: [{ signer: "x", sig: "y" }] }, { ...whole, oldThreshold: 0 }, [whole]]) {
      writeFileSync(pendingPath(), own);
      await writeCustodyRow("seal", TRANSITION_PENDING_FILE, new TextEncoder().encode(JSON.stringify(shape)));
      const refused = await act("crossing.state").catch((e: unknown) => e);
      expect(refused, JSON.stringify(shape).slice(0, 50)).toBeInstanceOf(CustodyRowUnavailable);
      expect(refused).toMatchObject({ home: "seal", file: TRANSITION_PENDING_FILE, reading: "malformed" });
      expect(await why(act("crossing.seal"))).toBe("CustodyRowUnavailable");
    }
    writeFileSync(pendingPath(), own);
    // A kept row that does not read whole refuses the seal before it commits beside it.
    await writeCustodyRow("seal", TRANSITIONS_FILE, new TextEncoder().encode(JSON.stringify([{ transitionCid: "rtr-not-a-record" }])));
    expect(await act("crossing.seal").catch((e: unknown) => e)).toMatchObject({ home: "seal", file: TRANSITIONS_FILE, reading: "malformed" });
    expect(readFileSync(pendingPath()).equals(own)).toBe(true);                      // the pending row stands
    // The floor reads neither row.
    await a.holder.lock();
    for (const step of [act("crossing.state"), act("crossing.open"), act("crossing.sign", { handleIndex: 0 }), act("crossing.seal"), act("seal.sign", { handleIndex: 0, image: "ab" })]) {
      expect(await step.catch((e: unknown) => e)).toBeInstanceOf(CustodyLocked);
    }
  });
});
