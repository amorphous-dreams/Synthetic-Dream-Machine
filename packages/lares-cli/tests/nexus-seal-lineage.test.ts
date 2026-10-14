/**
 * nexus-seal-lineage — the CLI ceremony for the PRE-ROTATED charter-epoch chain (#68), driven end-to-end
 * through a REAL persona vault + the bags/nexus charter DOC on disk.
 *
 * Proven:
 *   · seat gives each chair that stands a SEAT key of its own (never a persona root), prints each chair's NEXT key
 *     as a cold-key card (read back on a staged root by stand-in), and establishes the GENESIS epoch (null prev,
 *     no roll) that commits one digest per chair,
 *   · seat FAILS CLOSED against re-seating a chain that has already ROTATED past genesis,
 *   · rotate takes each chair's card back, adopts each revealed key as that chair's seat key, has the seated hands
 *     SIGN the roll, APPENDS a hash-linked successor, rolls again, and retires the closing keys,
 *   · an arming flag typed at the door refuses by name; a head whose digests no card answers REFUSES the rotate
 *     and writes NOTHING (the chain stays at genesis) — the fail-closed floor,
 *   · succession: a chair that joins signs by possession, a chair that steps down drops.
 *
 * The reveal-verify SEMANTICS (accept/refuse on the digest, the pre-rotation guard) are exhaustively proven
 * at the mesh layer (wax-stamp.test); this file proves the CLI WIRING over a genuine vault + disk.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import { dispatch } from "../src/bin/lares.js";
import { sealRite, type SealRite } from "./seal-rite-fixture.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome, larDataDir } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, readNexusDoc, nexusCharterDocPath,
  heldSeatKey, listSeatKeys, writeNexusDoc,
} from "@lararium/node";
import {
  renameOwnPersona, declarePersonaHandle, standForKahuSeat, sealKeySetHash, sealLineageHead, verifySealLineage, genesisCharterEpoch,
} from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
};
const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });

describe("lares nexus seal — the pre-rotated chain ceremony (CLI, real vault + disk)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-nexuschain-"));
    setEnv("LAR_ROOT", root);                       // isolates bags + vault-state + petname store under one tree
    vi.spyOn(console, "log").mockImplementation(() => {});    // the ceremony prints; keep the test output clean
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });
  // The seat reads the persona roster under the vessel key, so each test stands on a founded custody.
  // A founding derives a key from its route and every seat seals a row, so a test here takes seconds under a
  // loaded suite: the room below belongs to that work, and no assertion reads a clock.
  let custody: ScratchCustody;
  beforeEach(async () => { vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 }); custody = await seatScratchCustody(); });
  // One rite per charter: it carries each chair's cold-key card from the seat to the roll, as a person does.
  let rite: SealRite;
  beforeEach(() => { rite = sealRite(); });
  const code = async (ran: Promise<{ code: number }>): Promise<number> => (await ran).code;
  afterEach(async () => { await custody.drop(); });

  /** Seed the three founding kahu into the vault and return their verifying keys. Each persona carries a
   *  private label AND declares the Handle its chair names, then stands for the seat — the seal joins on the
   *  DECLARED Handle, so the label here deliberately reads nothing like it. */
  async function seatVault(): Promise<string[]> {
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    const keys: string[] = [];
    for (let i = 0; i < KAHU.length; i++) {
      const rt = await generateOrLoadPersonaGroupRoot(i);
      await renameOwnPersona(petnames, i, `compartment-${i}`);
      await declarePersonaHandle(declarations, i, KAHU[i]!);
      await standForKahuSeat(declarations, i, true, KAHU[i]!);
      keys.push(rt.verifyingKey);
    }
    return keys;
  }

  test("seat establishes the genesis epoch + a live quorum over SEAT keys, each chair's next key armed", async () => {
    const roots = (await seatVault()).map((k) => k.toLowerCase());

    const rc = await code(rite.seat());
    expect(rc).toBe(0);

    const doc = readNexusDoc(larSealHome());
    expect(doc?.sealLineage?.length).toBe(1);
    const head = sealLineageHead(doc)!;
    expect(head.prevEpochCid).toBeNull();
    expect(head.roll).toBeUndefined();
    expect(head.nextKeyDigests).toHaveLength(3);          // rotation armed by the rite itself: one cold digest per chair
    expect(head.nextThreshold).toBe(2);
    expect(doc?.sealEpochCid).toBe(head.epochCid);      // the antigen roots on the head
    // A SEAT HOLDS ITS OWN KEY: the chairs seat keys this vessel holds as seat rows, and no persona root.
    const seated = doc!.kahu.map((k) => k.verifyingKey!.toLowerCase());
    expect(head.keySetHash).toBe(sealKeySetHash(seated, 2));
    for (const key of seated) expect(roots).not.toContain(key);
    expect(seated.every((key) => heldSeatKey(key) !== null)).toBe(true);
    expect(listSeatKeys()).toHaveLength(3);                // each chair's seat key alone: its next key rests on its card
  });

  test("the seat→rotate round-trip: a head the rite armed rolls, and rolls again; the closing keys leave", async () => {
    await seatVault();
    await code(rite.seat());
    const genesisDoc = readNexusDoc(larSealHome())!;
    const genesis = sealLineageHead(genesisDoc)!;
    const genesisKeys = genesisDoc.kahu.map((k) => k.verifyingKey!.toLowerCase());

    expect(await code(rite.rotate())).toBe(0);
    const doc = readNexusDoc(larSealHome());
    expect(doc?.sealLineage?.length).toBe(2);
    const head = sealLineageHead(doc)!;
    expect(head.prevEpochCid).toBe(genesis.epochCid);     // hash-linked to genesis
    // The committed hands SIGNED the roll: they ARE the seated set, fresh keys apart from the genesis's.
    const rolled = doc!.kahu.map((k) => k.verifyingKey!.toLowerCase());
    expect(head.roll!.signatures.map((s) => s.signer).sort()).toEqual([...rolled].sort());
    for (const key of rolled) expect(genesisKeys).not.toContain(key);
    expect(verifySealLineage(doc!.sealLineage!)).toBe(true);
    expect(doc?.sealEpochCid).toBe(head.epochCid);      // the antigen re-roots on the new head
    // The closing keys retired once the charter moved: each chair holds its seated key and its next one.
    expect(genesisKeys.some((key) => heldSeatKey(key) !== null)).toBe(false);
    expect(listSeatKeys()).toHaveLength(3);

    expect(await code(rite.rotate())).toBe(0);                    // and again
    expect(verifySealLineage(readNexusDoc(larSealHome())!.sealLineage!)).toBe(true);
    expect(readNexusDoc(larSealHome())?.sealLineage?.length).toBe(3);

    // re-seat now REFUSES (the chain has rotated past genesis) — never a silent re-genesis.
    const reseat = await code(rite.seat());
    expect(reseat).not.toBe(0);
    expect(readNexusDoc(larSealHome())?.sealLineage?.length).toBe(3);   // unchanged
  });

  /**
   * A TORN CHARTER MUST NOT READ AS AN ABSENT ONE.
   *
   * `readNexusDoc` answers `null` for BOTH "no charter stands here" and "a charter stands and reads torn" —
   * a correct contract for the roster callers, who fold null to the inert empty roster and guess nothing.
   * `sealSeat` folds the same null into `emptyFoundingCharterDoc()`, a SCAFFOLD carrying no `sealLineage`
   * field at all — and the re-seat guard reads `doc.sealLineage && doc.sealLineage.length > 1`, which
   * short-circuits on `undefined`.
   *
   * So a chain that HAS rotated, whose doc reads back torn, walks straight through the one guard written to
   * stop it: a silent re-genesis that strands every antigen entry rooted on the rotated head. The absent
   * case must still seat — that is a fresh founding, and refusing it would break the first ceremony a
   * vessel ever runs. Only the TORN case refuses.
   */
  test("★ a rotated chain whose charter reads TORN refuses the re-seat — null means absent OR torn, and they differ ★", async () => {
    await seatVault();
    await code(rite.seat());
    await code(rite.rotate());
    expect(readNexusDoc(larSealHome())?.sealLineage?.length, "the fixture failed to rotate").toBe(2);

    // TEAR the charter: the file stands, its fenced blocks no longer compose. `readNexusDoc` reads null.
    const charter = nexusCharterDocPath(larSealHome());
    const whole = readFileSync(charter, "utf8");
    writeFileSync(charter, whole.replace(/```/g, "`` "), "utf8");
    expect(readNexusDoc(larSealHome()), "the tear did not actually tear the doc").toBeNull();

    const reseat = await code(rite.seat());
    expect(reseat, "a torn charter re-seated as though no charter stood").not.toBe(0);
  });

  test("CONTROL — an ABSENT charter still seats: a fresh founding must never be refused", async () => {
    await seatVault();
    // No charter written at all — the first ceremony a vessel runs.
    expect(readNexusDoc(larSealHome())).toBeNull();
    expect(await code(rite.seat())).toBe(0);
  });

  test("RED: an arming flag typed at the door refuses by name, and nothing gets written or minted", async () => {
    await seatVault();
    // The rite arms itself, so the nexus door reads no arming flag: the front door refuses it before any act.
    for (const verb of ["seat", "rotate"]) {
      expect(await dispatch(["nexus", "seal", verb, "--next-key-commit", "f".repeat(64)])).not.toBe(0);
    }
    expect(readNexusDoc(larSealHome())).toBeNull();
    expect(listSeatKeys()).toEqual([]);
    expect(await code(rite.seat())).toBe(0);                        // CONTROL
  });

  test("RED: a LIVE root prints no card into a JSON answer or a pipe: the seat refuses and writes nothing", async () => {
    await seatVault();
    rmSync(join(root, ".lar-test-scratch"), { force: true });                     // a live root: no staged marker
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { chunks.push(String(chunk)); return true; });
    let code: number;
    try { code = await cmdNexus(args(["seal", "seat"])); } finally { write.mockRestore(); }
    expect(code).not.toBe(0);
    expect(chunks.join("")).toMatch(/prints each chair's cold-key card on the terminal and asks it back there; run it without --json/);
    expect(chunks.join("")).not.toMatch(/[0-9a-f]{4}(-[0-9a-f]{4}){17}/);       // no card code rode any chunk
    expect(readNexusDoc(larSealHome())).toBeNull();
    expect(listSeatKeys()).toEqual([]);                                             // the keys the arming minted retired
  });

  test("a rotate from a head that commits a set this vessel does not hold REFUSES and writes nothing", async () => {
    await seatVault();
    await code(rite.seat());
    // The head commits STRANGER digests, which no card of this seat answers.
    const doc = readNexusDoc(larSealHome())!;
    const seated = doc.kahu.map((k) => k.verifyingKey!);
    const stranger = genesisCharterEpoch(seated, 2, { digests: ["f".repeat(64), "e".repeat(64), "d".repeat(64)], threshold: 2 });
    writeNexusDoc(larSealHome(), { ...doc, sealEpochCid: stranger.epochCid, sealLineage: [stranger] });
    const rows = listSeatKeys().length;

    expect(await code(rite.rotate())).not.toBe(0);                // fail-closed: no card answers the head
    const after = readNexusDoc(larSealHome());
    expect(after?.sealLineage?.length).toBe(1);            // nothing written — still at genesis
    expect(sealLineageHead(after)!.prevEpochCid).toBeNull();
    expect(listSeatKeys()).toHaveLength(rows);             // and no key minted
  });

  test("the `commit` sub-verb names nothing: a head commits per seat, and no digest gets typed by hand", async () => {
    expect(await cmdNexus(args(["seal", "commit"], { keys: `${"a".repeat(64)},${"b".repeat(64)}`, threshold: "2" }))).not.toBe(0);
  });

  test("★ SUCCESSION rides ROTATE — the roster becomes exactly what stands, and the committed hands sign it ★", async () => {
    // Three stand and seal a genesis. Then a fourth persona stands: the rotation seats four chairs, the fourth
    // on a fresh key of its own that signs by possession, beside the three keys the head committed.
    await seatVault();
    expect(await code(rite.seat({ threshold: "2" }))).toBe(0);
    const genesis = readNexusDoc(larSealHome())!;

    const petnames     = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    await generateOrLoadPersonaGroupRoot(3);
    await renameOwnPersona(petnames, 3, "compartment-3");
    await declarePersonaHandle(declarations, 3, "Kahu Delta");
    await standForKahuSeat(declarations, 3, true, "Kahu Delta");
    expect(await code(rite.rotate({ threshold: "3" }))).toBe(0);

    const doc = readNexusDoc(larSealHome());
    expect(doc!.kahu.map((k) => k.displayName).sort()).toEqual([...KAHU, "Kahu Delta"].sort());
    expect(doc!.threshold).toBe(3);
    expect(doc!.sealLineage!.length).toBe(2);
    expect(verifySealLineage(doc!.sealLineage!)).toBe(true);
    // The three continuing chairs seat the keys their cards revealed; the fourth signed by possession.
    const rolled = sealLineageHead(doc)!;
    expect(rolled.roll!.signatures).toHaveLength(4);
    expect(rolled.nextKeyDigests).toHaveLength(4);                                   // the rolled head re-arms all four
    expect(genesis.kahu.every((k) => !rolled.roll!.keys.includes(k.verifyingKey!.toLowerCase()))).toBe(true);

    // A chair that steps down drops at the next roll, and the committed hands still sign.
    await standForKahuSeat(declarations, 1, false);
    expect(await code(rite.rotate({ threshold: "2" }))).toBe(0);
    const after = readNexusDoc(larSealHome())!;
    expect(after.kahu.map((k) => k.displayName).sort()).toEqual(["Kahu Alpha", "Kahu Delta", "Kahu Gamma"]);
    expect(verifySealLineage(after.sealLineage!)).toBe(true);
  });
});
