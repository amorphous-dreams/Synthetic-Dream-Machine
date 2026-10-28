/**
 * V1 THE ROSTER COMMITS A ROOT. Mint writes the root before its public roster line; roster readers open no root row. Control: the seed opens to that public key.
 * V2 ORPHANS STAND UNHELD. Readers ignore an orphan and the next mint adopts its own bytes. Control: its roster line then commits it.
 * V3 MISSING AND MISNAMED ROOTS REFUSE. A roster line cannot mint over a missing or different root. Control: intact committed roots open.
 * V4 ABSENT FACE ROWS HOLD NOTHING. Each map and selector gives its empty answer. Control: a written row opens whole.
 * V5 SEALED ROWS THAT DO NOT OPEN REFUSE EVERY DOOR. Tampered, truncated, and bare bytes move no further. Control: intact rows work.
 * V6 OPEN ROWS WITH ANOTHER SHAPE REFUSE EVERY DOOR. Control: well-shaped rows round-trip.
 * V7 THE FLOOR CLOSES EVERY DOOR, the vessel key's mint among them. Control: an existing vessel key loads at the floor.
 * V8 THE VESSEL MINT ARMS THE KEL. It lands the key and its armed inception, which names that key and commits the
 *    digest of a cold next key, with no clock and no version; no next-key seed stands on disk. Control: a second call reads both files unchanged.
 * V9 A MOUNT REQUIRES A HELD ROOT. Control: a held root mounts at the unlock's choice, a command never reads that choice, and a cleared choice leaves two unlocked faces unmounted.
 * V10 THREE MAPS SEAL AND ROUND-TRIP. Control: entries sort and absent clears leave a readable row.
 * V11 TAMPER PROBE RETIRES THE SEATED KEY. Control: the new tree key opens every row whole.
 * V12 TWO HOLDERS SHARE ONE TREE. Control: both pet-name updates and the raced root mint remain whole.
 * V13 FACE ONE OPENS WITH FACE ZERO UNTOUCHED. Control: corrupting zero leaves one readable from the roster.
 * V14 A NO-OP ROOT MINT WRITES NOTHING. Control: the first mint lands both root and roster.
 * V15 TWO VESSEL-KEY MINTS RACE AND ONE COMMITS. Both acts answer one key and the inception names it; a mint over an inception whose key went missing writes a fresh one. Control: a standing key ends a later mint with no byte moved.
 * V16 AN ORPHAN'S NAME READS CANONICAL. A root file spelled `h01` names no orphan. Control: `h1` does.
 * V17 TWO ACTS MEET AT THE CUSTODY CLAIM, IN BOTH ORDERS. Two module graphs, each with its own seat, holder and custody io over one tree, share one runtime and nothing else but the files and the cross-process claim (a two-graph race, never two operating-system processes). Both acts find no key and ask the claim; the first commits inside it while the later act waits on it; the later act then meets that key, writes nothing and answers it. The vector runs once with each graph committing first. Control: each act asked the claim and each act's mint ran, so the vector reached the hold it names.
 * V18 A STANDING KEY WHOSE INCEPTION FAILS TO PROVE IT REFUSES BY NAME, and nothing gets written over it: no inception,
 *    a torn one, one that names another key, one whose signature fails, and one that commits a next key. Control: the
 *    intact inception loads the key.
 * V19 EVERY LOAD DOOR OF A STANDING KEY PROVES ITS INCEPTION: the boot's identity read, the public key, the signing
 *    seed and the floor key's derive door each refuse by name over an absent inception or one of another key, and
 *    write nothing. Control: over the intact inception each door answers.
 * V20 A KEY FILE WHOSE SEED DERIVES ANOTHER KEY REFUSES AT EVERY DOOR, the found act's load among them, though its
 *    public key and its inception still agree. Control: the intact file answers at every door.
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  readFckCarrier, readSCarrier,
  mintPlaceInception, verifyPlaceKel,
  GATE_FLOOR_BUNDLE_INFO,
} from "@lararium/mesh";
import {
  generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey,
  listPersonaRoots, listPersonaRosterLines, personaRootExists, orphanPersonaRoots,
  makeNodeFsPersonaVault, setMountedFace, sovereignStands,
  makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, makeNodePublicHandleStore,
  generateOrLoadVesselIdentity, VesselKeyMintRefused, VesselInceptionRefused,
  loadVesselIdentity, loadVesselVerifyingKey, vesselPlaceSignerDoor, vesselFloorKeyDoor,
} from "../src/node-vessel-identity.js";
import { FaceNotNamed, resolveFace } from "../src/face-selector.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { handleRowPathIn } from "./face-paths.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });
const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const HEX = /^[0-9a-f]{64}$/;
const mintVessel = () => generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
const readKel = (bytes: Buffer) => (JSON.parse(bytes.toString()) as [{ key: string; next: string; sig: string }])[0];
const kelOk = (bytes: Buffer) => verifyPlaceKel(JSON.parse(bytes.toString())).ok;
async function foreignKel(seed: Uint8Array): Promise<Buffer> {
  const coldVerifyingKey = Buffer.from(await seedPublic(new Uint8Array(32).fill(8)), "base64url").toString("hex");
  return Buffer.from(JSON.stringify([mintPlaceInception({ signerSeed: seed, coldVerifyingKey }).event]));
}

let c: SeatedScratchCustody;
let priorHome: string | undefined;
let priorXdg: string | undefined;
let priorGlobal: string | undefined;
let configHome: string;
const at = (file: string): string => /^\.persona-(?:group-root|roster|petnames|declarations|public-handles)(?:-[^./]+)?-h\d+\.json$/.test(file) ? handleRowPathIn(c.homes.identity, file) : join(c.homes.identity, file);
const read = (file: string): Buffer => readFileSync(at(file));
const sealed = (file: string): void => expect(at(file) === join(c.homes.identity, file) ? readSCarrier(read(file)) : readFckCarrier(read(file))).toBe("sealed");
const rosterFile = (i: number): string => `.persona-roster-h${i}.json`;
const petFile = (i: number): string => `.persona-petnames-h${i}.json`;
const declarationFile = (i: number): string => `.persona-declarations-h${i}.json`;
const publicFile = (i: number): string => `.persona-public-handles-h${i}.json`;
async function seedPublic(seed: Uint8Array): Promise<string> {
  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed)]), format: "der", type: "pkcs8" });
  return createPublicKey(privateKey).export({ format: "jwk" }).x!;
}
function rootFile(i: number): string { return `.persona-group-root-h${i}.json`; }
/** One cold row's JSON, opened for this one read through the fixture's own holder. */
const cold = <T>(file: string): Promise<T> =>
  c.holder.openColdRow("identity", file, (plain) => JSON.parse(new TextDecoder().decode(plain)) as T);

beforeEach(async () => {
  priorHome = process.env.HOME; priorXdg = process.env.XDG_CONFIG_HOME; priorGlobal = process.env.GIT_CONFIG_GLOBAL;
  configHome = mkdtempSync(join(tmpdir(), "synthetic-git-config-"));
  process.env.HOME = configHome; process.env.XDG_CONFIG_HOME = configHome; process.env.GIT_CONFIG_GLOBAL = "/dev/null";
  c = await seatScratchCustody("vessel-identity");
  setMountedFace(undefined);
});
afterEach(async () => {
  await c.drop();
  setMountedFace(undefined);
  if (priorHome === undefined) delete process.env.HOME; else process.env.HOME = priorHome;
  if (priorXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = priorXdg;
  if (priorGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = priorGlobal;
  rmSync(configHome, { recursive: true, force: true });
});

describe("sealed vessel identity family", () => {
  test("V1 roster commits roots and public readers never open a root row", async () => {
    const minted = await generateOrLoadPersonaGroupRoot(0);
    expect(minted.created).toBe(true);
    expect(existsSync(at(rosterFile(0)))).toBe(true);
    expect(read(rosterFile(0)).length).toBeGreaterThan(0);
    const rosterRow = await c.holder.readRow("identity", rosterFile(0));
    expect(rosterRow.reading).toBe("opens");
    if (rosterRow.reading === "opens") expect(JSON.parse(new TextDecoder().decode(rosterRow.plaintext))).toEqual({ roots: [{ handleIndex: 0, verifyingKey: minted.verifyingKey }] });
    const lines = await listPersonaRosterLines();
    expect(lines).toEqual([{ handleIndex: 0, verifyingKey: minted.verifyingKey }]);
    expect(await listPersonaRoots()).toEqual([0]);
    expect(await personaRootExists(0)).toBe(true);
    expect(await loadPersonaGroupRootVerifyingKey(0)).toBe(minted.verifyingKey);
    const seed = await loadPersonaGroupRootSeed(0);
    expect(seed).toHaveLength(32);
    expect(Buffer.from(await seedPublic(seed), "base64url").toString("hex")).toBe(minted.verifyingKey);
  });

  test("V2 an unrostered standing root has no readers and adoption preserves its bytes", async () => {
    const first = await generateOrLoadPersonaGroupRoot(2);
    const roster = read(rosterFile(2));
    await c.holder.updateRow("identity", rosterFile(2), () => ({ plaintext: enc({ roots: [] }), value: undefined }));
    const orphan = read(rootFile(2));
    expect(await listPersonaRoots()).toEqual([]);
    expect(await personaRootExists(2)).toBe(false);
    expect(await loadPersonaGroupRootVerifyingKey(2)).toBeUndefined();
    expect(await orphanPersonaRoots()).toEqual([2]);
    await expect(loadPersonaGroupRootSeed(2)).rejects.toThrow(/no persona-root at h/);
    const adopted = await generateOrLoadPersonaGroupRoot(2);
    expect(adopted).toEqual({ verifyingKey: first.verifyingKey, created: false });
    expect(read(rootFile(2)).equals(orphan)).toBe(true);
    expect((await listPersonaRosterLines())[0]).toEqual({ handleIndex: 2, verifyingKey: first.verifyingKey });
    expect(roster.equals(read(rosterFile(2)))).toBe(false);
  });

  test("V3 missing and differently named committed roots refuse without minting", async () => {
    const minted = await generateOrLoadPersonaGroupRoot(0);
    const rootBytes = read(rootFile(0));
    rmSync(at(rootFile(0)));
    const roster = read(rosterFile(0));
    await expect(loadPersonaGroupRootSeed(0)).rejects.toThrow(CustodyRowUnavailable);
    await expect(loadPersonaGroupRootSeed(0)).rejects.toThrow(/reads absent/);
    await expect(generateOrLoadPersonaGroupRoot(0)).rejects.toThrow(/reads absent/);
    expect(existsSync(at(rootFile(0)))).toBe(false);
    expect(read(rosterFile(0)).equals(roster)).toBe(true);
    // control: the sealed bytes back at the path, the committed root opens again
    writeFileSync(at(rootFile(0)), rootBytes);
    expect(await loadPersonaGroupRootSeed(0)).toHaveLength(32);
    const other = await generateOrLoadPersonaGroupRoot(1);
    const kp = await cold<{ verifyingKey: string; signingKey: string }>(rootFile(1));
    const wrong = { verifyingKey: kp.verifyingKey, signingKey: kp.signingKey };
    await c.holder.writeRow("identity", rootFile(0), enc(wrong));
    await expect(loadPersonaGroupRootSeed(0)).rejects.toThrow(/reads names-another-key/);
    await expect(generateOrLoadPersonaGroupRoot(0)).rejects.toThrow(/reads names-another-key/);
    expect(other.verifyingKey).not.toBe(minted.verifyingKey);
  });

  test("V4 absent face rows read empty", async () => {
    expect(await listPersonaRoots()).toEqual([]);
    expect(await (await makeNodeFsPersonaVault()).selector.load()).toBeUndefined();
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    expect(await pets.get(0)).toBeUndefined(); expect(await pets.entries()).toEqual([]);
    expect(await decl.get(0)).toBeUndefined(); expect(await decl.entries()).toEqual([]);
    expect(await handles.load(0)).toBeNull(); expect(await handles.list()).toEqual([]);
  });

  test("V5 all standing rows refuse tampered, truncated, and bare bytes at every door", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    await pets.set(0, "private-label"); await decl.set(0, { handle: "declared" }); await handles.save({ handleIndex: 0, contextIndex: 0, nym: "public-nym", glamour: "G", heads: [] });
    const rows = [
      [rosterFile(0), () => listPersonaRoots(), () => generateOrLoadPersonaGroupRoot(0)],
      [petFile(0), () => pets.get(0), () => pets.set(0, "replacement")],
      [declarationFile(0), () => decl.get(0), () => decl.set(0, {})],
      [publicFile(0), () => handles.load(0), () => handles.save({ handleIndex: 0, contextIndex: 0, nym: "replacement", glamour: "G", heads: [] })],
      [rootFile(0), () => loadPersonaGroupRootSeed(0), () => generateOrLoadPersonaGroupRoot(0)],
    ] as Array<[string, () => unknown, () => unknown]>;
    for (const [file, readDoor, writeDoor] of rows) {
      const intact = read(file);
      const changed = Buffer.from(intact); changed[Math.floor(changed.length / 2)] ^= 1;
      expect(changed.equals(intact), `${file} tamper setup`).toBe(false);
      for (const [label, damaged, reading] of [
        ["tampered", changed, /reads (key-fails|torn)/],
        ["truncated", intact.subarray(0, Math.max(1, intact.length - 12)), /reads (torn|key-fails)/],
        ["bare", Buffer.from(JSON.stringify({ roots: [] })), /reads bare/],
      ] as const) {
        expect(Buffer.from(damaged).equals(intact), `${file} ${label} setup`).toBe(false);
        writeFileSync(at(file), damaged);
        await expect(Promise.resolve().then(readDoor), `${file} ${label} read`).rejects.toThrow(CustodyRowUnavailable);
        await expect(Promise.resolve().then(readDoor), `${file} ${label} read name`).rejects.toThrow(reading);
        await expect(Promise.resolve().then(writeDoor), `${file} ${label} write`).rejects.toThrow(CustodyRowUnavailable);
        expect(read(file).equals(damaged), `${file} ${label} unchanged`).toBe(true);
        expect(existsSync(`${at(file)}.s-sealing`), `${file} ${label} leaves no sidecar`).toBe(false);
      }
      // control: the sealed bytes back at the path, both doors answer again
      writeFileSync(at(file), intact);
      await Promise.resolve().then(readDoor);
      await Promise.resolve().then(writeDoor);
    }
  });

  test("V6 every alternate shape refuses reads and writes", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    const cases: Array<[string, unknown[], () => unknown, () => unknown]> = [
      [rosterFile(0), ["not json", { roots: [0] }, { roots: [{ handleIndex: 0, verifyingKey: "a".repeat(63) }] }, { roots: [{ handleIndex: 0, verifyingKey: "a".repeat(64) }, { handleIndex: 0, verifyingKey: "b".repeat(64) }] }], () => listPersonaRoots(), () => generateOrLoadPersonaGroupRoot(0)],
      [petFile(0), [{ names: [] }, { names: { x: "a" } }, { names: { 0: 7 } }], () => pets.get(0), () => pets.set(0, "x")],
      [declarationFile(0), [{ declarations: { 0: "s" } }, { declarations: { 0: { seat: "yes" } } }, { declarations: { 0: { handle: 7 } } }], () => decl.get(0), () => decl.set(0, {})],
      [publicFile(0), [{ handles: { 0: { nym: "n" } } }, { handles: { 0: { nym: "n", heads: [] } } }, { handles: { 0: { handleIndex: 1, contextIndex: 0, nym: "n", glamour: "G", heads: [] } } }], () => handles.load(0), () => handles.save({ handleIndex: 0, contextIndex: 0, nym: "n", glamour: "G", heads: [] })],
      [rootFile(0), [{ verifyingKey: "zz", signingKey: "00" }, { verifyingKey: "ab".repeat(32), signingKey: "cd".repeat(32) }], () => loadPersonaGroupRootSeed(0), () => generateOrLoadPersonaGroupRoot(0)],
    ];
    for (const [file, shapes, readDoor, writeDoor] of cases) {
      // What stood before this row's cases returns after them, so each row's refusal names that row alone.
      const before = existsSync(at(file)) ? read(file) : null;
      for (const shape of shapes) {
        await c.holder.writeRow("identity", file, typeof shape === "string" ? bytes(shape) : enc(shape));
        const standing = read(file);
        await expect(Promise.resolve().then(readDoor), `${file} ${JSON.stringify(shape)}`).rejects.toThrow(CustodyRowUnavailable);
        await expect(Promise.resolve().then(readDoor), `${file} ${JSON.stringify(shape)}`).rejects.toThrow(new RegExp(`${file.replace(/[.]/g, "\\.")} reads malformed`));
        await expect(Promise.resolve().then(writeDoor), `${file} writer ${JSON.stringify(shape)}`).rejects.toThrow(new RegExp(`${file.replace(/[.]/g, "\\.")} reads malformed`));
        expect(read(file).equals(standing)).toBe(true);
      }
      if (before === null) rmSync(at(file)); else writeFileSync(at(file), before);
      // control: over what stood before, both doors answer
      await Promise.resolve().then(readDoor);
      await Promise.resolve().then(writeDoor);
    }
  });

  test("V7 the custody floor closes every identity door", async () => {
    const doors = [() => listPersonaRoots(), () => listPersonaRosterLines(), () => personaRootExists(0), () => loadPersonaGroupRootVerifyingKey(0), () => loadPersonaGroupRootSeed(0), () => generateOrLoadPersonaGroupRoot(0), () => resolveFace(), async () => (await makeNodePersonaPetnameStore()).entries(), async () => (await makeNodePersonaDeclarationStore()).entries(), async () => (await makeNodePublicHandleStore()).list()];
    await c.holder.lock();
    for (const door of doors) await expect(Promise.resolve().then(door)).rejects.toThrow(CustodyLocked);
    await expect(mintVessel()).rejects.toThrow(VesselKeyMintRefused);
    expect(existsSync(at(".vessel-key.json"))).toBe(false); expect(existsSync(at(".vessel-kel.json"))).toBe(false);
    expect(readdirSync(c.homes.identity).filter((f) => f.startsWith(".vessel-"))).toEqual([]);
  });

  test("V8 vessel key mint commits a cold next key, and a second call preserves both files", async () => {
    const first = await mintVessel();
    const kel = read(".vessel-kel.json"); const key = read(".vessel-key.json");
    const inception = readKel(kel);
    expect(kelOk(kel)).toBe(true);
    expect(inception.key).toBe(first.verifyingKey);
    expect(inception.next).toMatch(HEX);
    expect(kel.toString()).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    // No next-key seed stands, under any spelling, sealed or bare.
    expect(readdirSync(c.homes.identity).filter((f) => f.startsWith(".vessel-")).sort()).toEqual([".vessel-kel.json", ".vessel-key.json"]);
    expect(JSON.parse(key.toString()).verifyingKey).toBe(inception.key);
    const floorHolder = c.holder;
    await floorHolder.lock();
    const locked = await mintVessel();
    expect(locked.verifyingKey).toBe(first.verifyingKey);
    await floorHolder.adopt(c.treeKey);
    seatCustody(floorHolder);
    expect((await mintVessel()).verifyingKey).toBe(first.verifyingKey);
    expect(read(".vessel-kel.json").equals(kel)).toBe(true); expect(read(".vessel-key.json").equals(key)).toBe(true);
  });

  test("V9 a mount requires a committed persona root", async () => {
    const mounted = async () => (await makeNodeFsPersonaVault()).selector.load();
    await generateOrLoadPersonaGroupRoot(5);
    setMountedFace(4);                                 // no root held at h4: the composition does not stand
    expect(sovereignStands()).toBe(false);
    expect(existsSync(at(".active-persona.json"))).toBe(false);
    setMountedFace(undefined);
    await generateOrLoadPersonaGroupRoot(4);
    expect(await mounted()).toBeUndefined();
    setMountedFace(4);
    expect(await mounted()).toBe(4);
    expect(sovereignStands()).toBe(true);
    await expect(resolveFace()).rejects.toBeInstanceOf(FaceNotNamed);   // a command never reads the mount
    setMountedFace(undefined);
    expect(await mounted()).toBeUndefined();
    expect(sovereignStands()).toBe(false);
  });

  test("V10 each face's three maps seal, sort, and clear", async () => {
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    for (const i of [2, 0, 1]) { await pets.set(i, `label-${i}`); await decl.set(i, { handle: `declaration-${i}` }); await handles.save({ handleIndex: i, contextIndex: 0, nym: `nym-${i}`, glamour: "G", heads: [] }); }
    for (const i of [0, 1, 2]) {
      for (const file of [petFile(i), declarationFile(i), publicFile(i)]) sealed(file);
      expect(read(petFile(i)).includes(Buffer.from(`label-${i}`))).toBe(false);
      expect(read(publicFile(i)).includes(Buffer.from(`nym-${i}`))).toBe(false);
      for (const [file, field] of [[petFile(i), "names"], [declarationFile(i), "declarations"], [publicFile(i), "handles"]] as const) {
        const row = await c.holder.readRow("identity", file);
        expect(row.reading, `${file} opens`).toBe("opens");
        if (row.reading === "opens") expect(Object.keys(JSON.parse(new TextDecoder().decode(row.plaintext))[field]), `${file} carries only its face`).toEqual([String(i)]);
      }
    }
    expect(await pets.entries()).toEqual([[0, "label-0"], [1, "label-1"], [2, "label-2"]]);
    expect((await decl.entries()).map(([i]) => i)).toEqual([0, 1, 2]); expect(await handles.list()).toEqual([0, 1, 2]);
    await pets.clear(9); expect((await pets.entries()).length).toBe(3);
    await pets.clear(1); await decl.clear(1);
    expect((await pets.entries()).map(([i]) => i)).toEqual([0, 2]); expect((await decl.entries()).map(([i]) => i)).toEqual([0, 2]);
    expect(await handles.load(1)).toEqual({ handleIndex: 1, contextIndex: 0, nym: "nym-1", glamour: "G", heads: [] });
  });

  test("V11 S key rotation leaves face rows sealed under their own keys and the sole open face still resolves", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    const pets = await makeNodePersonaPetnameStore(); await pets.set(0, "private");
    const faceFiles = [rootFile(0), rosterFile(0), petFile(0)];
    const faceBefore = faceFiles.map(read);
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldTreeKey: c.treeKey, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    faceFiles.forEach((file, i) => expect(read(file).equals(faceBefore[i]!), `${file} keeps its face seal through S key rotation`).toBe(true));
    expect(await listPersonaRoots()).toEqual([0]);
    expect(await pets.get(0)).toBe("private");
    expect(await resolveFace()).toBe(0);
    expect((await cold<{ verifyingKey: string }>(rootFile(0))).verifyingKey).toMatch(HEX);
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes }); await fresh.adopt(rotated.treeKey);
    await fresh.unlockFaces([{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]); seatCustody(fresh);
    expect(await listPersonaRoots()).toEqual([0]); expect(await resolveFace()).toBe(0);
    expect(await pets.get(0)).toBe("private"); expect(await loadPersonaGroupRootSeed(0)).toHaveLength(32);
    await fresh.lock(); seatCustody(c.holder);
  });

  test("V12 two holders update maps and raced root mint once", async () => {
    const pets = await makeNodePersonaPetnameStore();
    for (const i of [0, 1, 2]) await pets.set(i, `p${i}`);
    for (const i of [3, 4, 5]) await pets.clear(i); // found each face with an empty map before the second holder writes
    const other = makeCustodyHolder({ io: c.io, homes: c.homes }); await other.adopt(c.treeKey);
    await other.unlockFaces([{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    const viaOther = (i: number) => other.updateRow("identity", petFile(i), (row) => {
      const names = row.reading === "opens" ? JSON.parse(new TextDecoder().decode(row.plaintext)).names as Record<string, string> : {};
      names[String(i)] = `p${i}`; return { plaintext: enc({ names }), value: undefined };
    });
    await Promise.all([viaOther(3), viaOther(4), viaOther(5)]);
    expect((await pets.entries()).map(([i]) => i)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const i of [0, 1, 2, 3, 4, 5]) expect(await pets.get(i)).toBe(`p${i}`);
    const minted = await Promise.all([generateOrLoadPersonaGroupRoot(4), generateOrLoadPersonaGroupRoot(4)]);
    expect(new Set(minted.map((r) => r.verifyingKey)).size).toBe(1); expect(minted.filter((r) => r.created)).toHaveLength(1);
    expect((await cold<{ verifyingKey: string }>(rootFile(4))).verifyingKey).toBe(minted[0]!.verifyingKey);
    expect(await listPersonaRosterLines()).toEqual([{ handleIndex: 4, verifyingKey: minted[0]!.verifyingKey }]);
    await other.lock();
  });

  test("V13 opening face one never moves face zero", async () => {
    await generateOrLoadPersonaGroupRoot(0); await generateOrLoadPersonaGroupRoot(1);
    const h0 = read(rootFile(0)); const seed0 = await loadPersonaGroupRootSeed(0); const seed1 = await loadPersonaGroupRootSeed(1);
    expect(h0.equals(read(rootFile(0)))).toBe(true); expect(Buffer.from(seed0).equals(Buffer.from(seed1))).toBe(false);
    const damaged = Buffer.from(h0); damaged[damaged.length - 8] ^= 1; expect(damaged.equals(h0)).toBe(false); writeFileSync(at(rootFile(0)), damaged);
    expect(await loadPersonaGroupRootSeed(1)).toHaveLength(32); expect(await listPersonaRoots()).toEqual([0, 1]);
    await expect(loadPersonaGroupRootSeed(0)).rejects.toThrow(CustodyRowUnavailable);
  });

  test("V14 repeating a root mint writes no bytes", async () => {
    const first = await generateOrLoadPersonaGroupRoot(0); const roster = read(rosterFile(0)); const root = read(rootFile(0));
    expect((await generateOrLoadPersonaGroupRoot(0)).created).toBe(false);
    expect(read(rosterFile(0)).equals(roster)).toBe(true); expect(read(rootFile(0)).equals(root)).toBe(true);
    expect(first.created).toBe(true);
  });

  test("V15 two vessel-key mints race and the key and its inception name one mint", async () => {
    const [a, b] = await Promise.all([mintVessel(), mintVessel()]);
    expect(a.verifyingKey).toBe(b.verifyingKey);
    const key = JSON.parse(read(".vessel-key.json").toString()) as { verifyingKey: string };
    const kel = readKel(read(".vessel-kel.json"));
    expect(key.verifyingKey).toBe(a.verifyingKey);
    expect(kel.key).toBe(a.verifyingKey); expect(kelOk(read(".vessel-kel.json"))).toBe(true);
    // A mint over an inception whose key went missing: the fresh key lands beside a fresh inception that names it,
    // so a stale inception never outlives its key.
    expect(readdirSync(c.homes.identity).filter((f) => f.endsWith(".landing"))).toEqual([]);
    const firstKel = read(".vessel-kel.json");
    rmSync(at(".vessel-key.json"));
    const again = await mintVessel();
    expect(again.verifyingKey).not.toBe(a.verifyingKey);
    const kel2 = readKel(read(".vessel-kel.json"));
    expect(read(".vessel-kel.json").equals(firstKel)).toBe(false);
    expect(kel2.key).toBe(again.verifyingKey); expect(kelOk(read(".vessel-kel.json"))).toBe(true);
    // control: a key that stands ends a later mint with nothing written
    const standing = [".vessel-key.json", ".vessel-kel.json"].map(read);
    expect((await mintVessel()).verifyingKey).toBe(again.verifyingKey);
    [".vessel-key.json", ".vessel-kel.json"].forEach((f, i) => expect(read(f).equals(standing[i]!), f).toBe(true));
  });

  test.each([["a", "b"], ["b", "a"]] as const)("V17 two graphs meet at the custody claim: %s commits first and %s writes nothing", async (first, later) => {
    // Each act's holder counts its asks of the claim and waits at a gate, so the order reads: the first act enters
    // the claim, the later act asks for it while the first still holds it, the first commits and lets go, and the
    // later act then runs its mint inside the claim and meets the key that landed.
    let entered = (): void => undefined;
    const firstInside = new Promise<void>((r) => { entered = r; });
    let asked = (): void => undefined;
    const laterAsked = new Promise<void>((r) => { asked = r; });
    const asks = { a: 0, b: 0 };
    const runs = { a: 0, b: 0 };
    const order: string[] = [];
    type Holder = typeof c.holder;
    const gated = (holder: Holder, who: "a" | "b"): Holder => ({
      ...holder,
      async exclusive(fn) {
        asks[who] += 1;
        if (who === later) { await firstInside; asked(); }
        return holder.exclusive(async () => {
          if (who === first) { entered(); await laterAsked; }
          runs[who] += 1;
          order.push(`${who}:in`);
          try { return await fn(); } finally { order.push(`${who}:out`); }
        });
      },
    });
    seatCustody(gated(c.holder, "a"));
    // THE SECOND GRAPH: fresh modules. Its seat map, its holder and its custody io share no object with the first
    // graph's; the files and the claim socket alone join them.
    vi.resetModules();
    const seatB = await import("../src/custody-seat.js");
    const holderB = await import("../src/custody-holder.js");
    const ioB = await import("../src/custody-io.js");
    const identityB = await import("../src/node-vessel-identity.js");
    expect(seatB.seatCustody).not.toBe(seatCustody);                         // the setup took: two graphs
    const second = holderB.makeCustodyHolder({ io: new ioB.FsCustodyIo(c.homes), homes: c.homes });
    await second.adopt(c.treeKey);
    seatB.seatCustody(gated(second as unknown as Holder, "b") as unknown as Parameters<typeof seatB.seatCustody>[0]);
    try {
      const [a, b] = await Promise.all([mintVessel(), identityB.generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } })]);
      expect(asks).toEqual({ a: 1, b: 1 });                                   // control: both acts asked the claim
      expect(runs).toEqual({ a: 1, b: 1 });                                   // control: both mints ran inside it
      expect(order).toEqual([`${first}:in`, `${first}:out`, `${later}:in`, `${later}:out`]);   // the claim held them apart
      const key = JSON.parse(read(".vessel-key.json").toString()) as { verifyingKey: string };
      const kel = readKel(read(".vessel-kel.json"));
      expect(b.verifyingKey).toBe(a.verifyingKey);                            // both acts answer the one standing key
      expect(key.verifyingKey).toBe(a.verifyingKey);
      expect(kel.key).toBe(a.verifyingKey); expect(kelOk(read(".vessel-kel.json"))).toBe(true);
      expect(readdirSync(c.homes.identity).filter((f) => f.endsWith(".landing"))).toEqual([]);
    } finally {
      await second.lock();
      seatB.seatCustody(null);
      seatCustody(c.holder);
    }
  });

  test("V16 an orphan root reads by its canonical name alone", async () => {
    const minted = await generateOrLoadPersonaGroupRoot(1);
    const sealedRoot = read(rootFile(1));
    await c.holder.updateRow("identity", rosterFile(1), () => ({ plaintext: enc({ roots: [] }), value: undefined }));
    writeFileSync(at(".persona-group-root-h01.json"), sealedRoot);
    expect(await orphanPersonaRoots()).toEqual([1]);          // control: the canonical spelling names the orphan
    rmSync(at(rootFile(1)));
    expect(await orphanPersonaRoots()).toEqual([]);           // `h01` alone names none
    expect(minted.created).toBe(true);
  });

  test("V18 a standing key whose inception fails to prove it refuses by name, and nothing moves", async () => {
    const minted = await mintVessel();
    const key = read(".vessel-key.json"); const kel = read(".vessel-kel.json");
    const parsed = readKel(kel);
    const foreign = await foreignKel(new Uint8Array(32).fill(9));
    const cases: ReadonlyArray<readonly [string, Buffer | null, string]> = [
      ["no inception", null, "absent"],
      ["a torn inception", kel.subarray(0, kel.length - 3), "malformed"],
      ["an inception of another key", foreign, "names-another-key"],
      ["a signature that fails", Buffer.from(JSON.stringify([{ ...parsed, sig: readKel(foreign).sig }])), "signature-fails"],
      ["an unarmed inception", Buffer.from(JSON.stringify([{ ...parsed, next: undefined }])), "unarmed"],
      ["an old-shape inception", Buffer.from(JSON.stringify([{ t: "icp", k: [parsed.key], sig: parsed.sig }])), "old-shape"],
    ];
    for (const [what, planted, reading] of cases) {
      if (planted === null) rmSync(at(".vessel-kel.json"));
      else { expect(planted.equals(kel), `${what}: the probe moved the bytes`).toBe(false); writeFileSync(at(".vessel-kel.json"), planted); }
      const refused = await mintVessel().then(() => null, (err: unknown) => err);
      expect(refused, what).toBeInstanceOf(VesselInceptionRefused);
      expect((refused as VesselInceptionRefused).reading, what).toBe(reading);
      expect(read(".vessel-key.json").equals(key), `${what}: the key stays`).toBe(true);
      if (planted === null) expect(existsSync(at(".vessel-kel.json")), `${what}: nothing written in its place`).toBe(false);
      else expect(read(".vessel-kel.json").equals(planted), `${what}: nothing written over it`).toBe(true);
    }
    writeFileSync(at(".vessel-kel.json"), kel);
    expect((await mintVessel()).verifyingKey).toBe(minted.verifyingKey);        // control
  });

  test("V19 every load door of a standing key proves its inception, and writes nothing", async () => {
    const minted = await mintVessel();
    const key = read(".vessel-key.json"); const kel = read(".vessel-kel.json");
    const doors: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
      ["the boot's identity read", () => loadVesselIdentity()],
      ["the public key", () => loadVesselVerifyingKey()],
      ["the scoped place signer", () => vesselPlaceSignerDoor()],
      ["the floor key's derive door", async () => (await vesselFloorKeyDoor()).derive(GATE_FLOOR_BUNDLE_INFO)],
    ];
    // control: over the intact inception every door answers
    for (const [what, door] of doors) await expect(door(), what).resolves.toBeDefined();
    expect(await loadVesselVerifyingKey()).toBe(minted.verifyingKey);
    const foreign = await foreignKel(new Uint8Array(32).fill(9));
    for (const [planted, reading] of [[null, "absent"], [foreign, "names-another-key"]] as const) {
      if (planted === null) rmSync(at(".vessel-kel.json")); else writeFileSync(at(".vessel-kel.json"), planted);
      for (const [what, door] of doors) {
        const refused = await door().then(() => null, (err: unknown) => err);
        expect(refused, `${what} over ${reading}`).toBeInstanceOf(VesselInceptionRefused);
        expect((refused as VesselInceptionRefused).reading, what).toBe(reading);
      }
      expect(read(".vessel-key.json").equals(key)).toBe(true);
      if (planted === null) expect(existsSync(at(".vessel-kel.json"))).toBe(false);
      else expect(read(".vessel-kel.json").equals(planted)).toBe(true);
    }
    writeFileSync(at(".vessel-kel.json"), kel);
  });

  test("V20 a key file whose seed derives another key refuses at every door, and nothing moves", async () => {
    const minted = await mintVessel();
    const key = read(".vessel-key.json"); const kel = read(".vessel-kel.json");
    const doors: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
      ["the found act's load", () => mintVessel()],
      ["the boot's identity read", () => loadVesselIdentity()],
      ["the public key", () => loadVesselVerifyingKey()],
      ["the scoped place signer", () => vesselPlaceSignerDoor()],
      ["the floor key's derive door", async () => (await vesselFloorKeyDoor()).derive(GATE_FLOOR_BUNDLE_INFO)],
    ];
    for (const [what, door] of doors) await expect(door(), what).resolves.toBeDefined();          // control
    // Another valid seed under the same public key and the same inception: the decoded seed moves, nothing else.
    const raw = JSON.parse(key.toString()) as { verifyingKey: string; signingKey: string };
    const swapped = Buffer.from(JSON.stringify({ ...raw, signingKey: "5a".repeat(32) }, null, 2));
    expect((JSON.parse(swapped.toString()) as { signingKey: string }).signingKey).not.toBe(raw.signingKey);
    expect((JSON.parse(swapped.toString()) as { verifyingKey: string }).verifyingKey).toBe(minted.verifyingKey);
    writeFileSync(at(".vessel-key.json"), swapped);
    for (const [what, door] of doors) {
      const refused = await door().then(() => null, (err: unknown) => err);
      expect(refused, what).toBeInstanceOf(VesselInceptionRefused);
      expect((refused as VesselInceptionRefused).reading, what).toBe("seed-names-another-key");
    }
    expect(read(".vessel-key.json").equals(swapped)).toBe(true); expect(read(".vessel-kel.json").equals(kel)).toBe(true);
    writeFileSync(at(".vessel-key.json"), key);
  });
});
