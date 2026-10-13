/**
 * V1 THE ROSTER COMMITS A ROOT. Mint writes the root before its public roster line; roster readers open no root row. Control: the seed opens to that public key.
 * V2 ORPHANS STAND UNHELD. Readers ignore an orphan and the next mint adopts its own bytes. Control: its roster line then commits it.
 * V3 MISSING AND MISNAMED ROOTS REFUSE. A roster line cannot mint over a missing or different root. Control: intact committed roots open.
 * V4 ABSENT HOT ROWS HOLD NOTHING. Each map and selector gives its empty answer. Control: a written row opens whole.
 * V5 SEALED ROWS THAT DO NOT OPEN REFUSE EVERY DOOR. Tampered, truncated, and bare bytes move no further. Control: intact rows work.
 * V6 OPEN ROWS WITH ANOTHER SHAPE REFUSE EVERY DOOR. Control: well-shaped rows round-trip.
 * V7 THE FLOOR CLOSES EVERY DOOR. Control: an existing vessel key loads at the floor.
 * V8 THE VESSEL MINT COMMITS ITS NEXT KEY. Control: a second call reads all three standing files unchanged.
 * V9 WEAR REQUIRES A HELD ROOT. Control: a held root wears through its sealed selector.
 * V10 THREE MAPS SEAL AND ROUND-TRIP. Control: entries sort and absent clears leave a readable row.
 * V11 TAMPER PROBE RETIRES THE SEATED KEY. Control: the new tree key opens every row whole.
 * V12 TWO HOLDERS SHARE ONE TREE. Control: both pet-name updates and the raced root mint remain whole.
 * V13 FACE ONE OPENS WITH FACE ZERO UNTOUCHED. Control: corrupting zero leaves one readable from the roster.
 * V14 A NO-OP ROOT MINT WRITES NOTHING. Control: the first mint lands both root and roster.
 * V15 TWO VESSEL-KEY MINTS RACE AND ONE COMMITS. Both acts answer one key; the KEL names that key and commits to the seed the cold row holds; a mint over a commitment whose key went missing rewrites the commitment. Control: a standing key ends a later mint with no byte moved.
 * V16 AN ORPHAN'S NAME READS CANONICAL. A root file spelled `h01` names no orphan. Control: `h1` does.
 * V17 TWO ACTS CROSS AT THE MINT'S STEP BOUNDARY, IN BOTH ORDERS. Two module graphs, each with its own seat, holder and custody io over one tree, share one runtime and nothing else but the files and the cross-process claim (a two-graph race, never two operating-system processes). Both acts seal a seed while no key stands; one commits; the other reaches step two after that key landed, writes nothing and answers the standing key. The vector runs once with each graph committing first. Control: each act ran both of its steps, so the vector crossed the boundary it names.
 */
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mintVk, readVkCarrier, writeSealedCarrier, TreeVkRefusal } from "@lararium/mesh";
import {
  generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey,
  listPersonaRoots, listPersonaRosterLines, personaRootExists, orphanPersonaRoots,
  makeNodeFsPersonaVault, loadActivePersonaIndex, wearPersona,
  makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, makeNodePublicHandleStore,
  generateOrLoadVesselIdentity, VesselKeyMintRefused,
} from "../src/node-vessel-identity.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { vkSlotsPath } from "../src/vault-carriers.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });
const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const HEX = /^[0-9a-f]{64}$/;
let c: SeatedScratchCustody;
let priorHome: string | undefined;
let priorXdg: string | undefined;
let priorGlobal: string | undefined;
let configHome: string;
const at = (file: string): string => join(c.homes.identity, file);
const read = (file: string): Buffer => readFileSync(at(file));
const sealed = (file: string): void => expect(readVkCarrier(read(file))).toBe("sealed");
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
});
afterEach(async () => {
  await c.drop();
  if (priorHome === undefined) delete process.env.HOME; else process.env.HOME = priorHome;
  if (priorXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = priorXdg;
  if (priorGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = priorGlobal;
  rmSync(configHome, { recursive: true, force: true });
});

describe("sealed vessel identity family", () => {
  test("V1 roster commits roots and public readers never open a root row", async () => {
    const minted = await generateOrLoadPersonaGroupRoot(0);
    expect(minted.created).toBe(true);
    expect(readdirSync(c.homes.identity)).toContain(".persona-roster.json");
    expect(read(".persona-roster.json").length).toBeGreaterThan(0);
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
    const roster = read(".persona-roster.json");
    await c.holder.updateRow("identity", ".persona-roster.json", () => ({ plaintext: enc({ roots: [] }), value: undefined }));
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
    expect(roster.equals(read(".persona-roster.json"))).toBe(false);
  });

  test("V3 missing and differently named committed roots refuse without minting", async () => {
    const minted = await generateOrLoadPersonaGroupRoot(0);
    const rootBytes = read(rootFile(0));
    rmSync(at(rootFile(0)));
    const roster = read(".persona-roster.json");
    await expect(loadPersonaGroupRootSeed(0)).rejects.toThrow(CustodyRowUnavailable);
    await expect(loadPersonaGroupRootSeed(0)).rejects.toThrow(/reads absent/);
    await expect(generateOrLoadPersonaGroupRoot(0)).rejects.toThrow(/reads absent/);
    expect(existsSync(at(rootFile(0)))).toBe(false);
    expect(read(".persona-roster.json").equals(roster)).toBe(true);
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

  test("V4 absent hot rows read empty", async () => {
    expect(await listPersonaRoots()).toEqual([]);
    expect(await loadActivePersonaIndex()).toBeUndefined();
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    expect(await pets.get(0)).toBeUndefined(); expect(await pets.entries()).toEqual([]);
    expect(await decl.get(0)).toBeUndefined(); expect(await decl.entries()).toEqual([]);
    expect(await handles.load(0)).toBeNull(); expect(await handles.list()).toEqual([]);
  });

  test("V5 all standing rows refuse tampered, truncated, and bare bytes at every door", async () => {
    await generateOrLoadPersonaGroupRoot(0); await wearPersona(0);
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    await pets.set(0, "private-label"); await decl.set(0, { handle: "declared" }); await handles.save({ handleIndex: 0, contextIndex: 0, nym: "public-nym", glamour: "G", heads: [] });
    const rows = [
      [".persona-roster.json", () => listPersonaRoots(), () => generateOrLoadPersonaGroupRoot(0)],
      [".active-persona.json", () => loadActivePersonaIndex(), () => wearPersona(0)],
      [".persona-petnames.json", () => pets.get(0), () => pets.set(0, "replacement")],
      [".persona-declarations.json", () => decl.get(0), () => decl.set(0, {})],
      [".persona-public-handles.json", () => handles.load(0), () => handles.save({ handleIndex: 0, contextIndex: 0, nym: "replacement", glamour: "G", heads: [] })],
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
        expect(existsSync(`${at(file)}.vk-sealing`), `${file} ${label} leaves no sidecar`).toBe(false);
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
      [".persona-roster.json", ["not json", { roots: [0] }, { roots: [{ handleIndex: 0, verifyingKey: "a".repeat(63) }] }, { roots: [{ handleIndex: 0, verifyingKey: "a".repeat(64) }, { handleIndex: 0, verifyingKey: "b".repeat(64) }] }], () => listPersonaRoots(), () => generateOrLoadPersonaGroupRoot(0)],
      [".active-persona.json", [{ handleIndex: -1 }, {}], () => loadActivePersonaIndex(), () => wearPersona(0)],
      [".persona-petnames.json", [{ names: [] }, { names: { x: "a" } }, { names: { 0: 7 } }], () => pets.get(0), () => pets.set(0, "x")],
      [".persona-declarations.json", [{ declarations: { 0: "s" } }, { declarations: { 0: { seat: "yes" } } }, { declarations: { 0: { handle: 7 } } }], () => decl.get(0), () => decl.set(0, {})],
      [".persona-public-handles.json", [{ handles: { 0: { nym: "n" } } }, { handles: { 0: { nym: "n", heads: [] } } }, { handles: { 0: { handleIndex: 1, contextIndex: 0, nym: "n", glamour: "G", heads: [] } } }], () => handles.load(0), () => handles.save({ handleIndex: 0, contextIndex: 0, nym: "n", glamour: "G", heads: [] })],
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
    const doors = [() => listPersonaRoots(), () => listPersonaRosterLines(), () => personaRootExists(0), () => loadPersonaGroupRootVerifyingKey(0), () => loadPersonaGroupRootSeed(0), () => generateOrLoadPersonaGroupRoot(0), () => loadActivePersonaIndex(), () => wearPersona(0), async () => (await makeNodePersonaPetnameStore()).entries(), async () => (await makeNodePersonaDeclarationStore()).entries(), async () => (await makeNodePublicHandleStore()).list()];
    await c.holder.lock();
    for (const door of doors) await expect(Promise.resolve().then(door)).rejects.toThrow(CustodyLocked);
    await expect(generateOrLoadVesselIdentity()).rejects.toThrow(VesselKeyMintRefused);
    expect(existsSync(at(".vessel-key.json"))).toBe(false); expect(existsSync(at(".vessel-kel.json"))).toBe(false); expect(existsSync(at(".vessel-next.json"))).toBe(false);
  });

  test("V8 vessel key mint seals next seed and second call preserves all bytes", async () => {
    const first = await generateOrLoadVesselIdentity();
    const next = read(".vessel-next.json"); const kel = read(".vessel-kel.json"); const key = read(".vessel-key.json");
    expect(readVkCarrier(next)).toBe("sealed");
    const opened = await cold<{ nextVerifyingKey: string; nextSigningKey: string }>(".vessel-next.json");
    expect(opened.nextVerifyingKey).toMatch(HEX); expect(opened.nextSigningKey).toMatch(HEX);
    expect(next.includes(Buffer.from(opened.nextVerifyingKey))).toBe(false);
    expect(next.includes(Buffer.from(opened.nextSigningKey))).toBe(false);
    expect(JSON.parse(kel.toString()).k[0]).toBe(first.verifyingKey);
    expect(JSON.parse(kel.toString()).n[0]).toBe(createHash("sha256").update(Buffer.from(opened.nextVerifyingKey, "hex")).digest("hex"));
    const floorHolder = c.holder;
    await floorHolder.lock();
    const locked = await generateOrLoadVesselIdentity();
    expect(locked.verifyingKey).toBe(first.verifyingKey);
    await floorHolder.adopt(c.vk);
    seatCustody(floorHolder);
    expect((await generateOrLoadVesselIdentity()).verifyingKey).toBe(first.verifyingKey);
    expect(read(".vessel-next.json").equals(next)).toBe(true); expect(read(".vessel-kel.json").equals(kel)).toBe(true); expect(read(".vessel-key.json").equals(key)).toBe(true);
  });

  test("V9 wear requires a committed persona root", async () => {
    await expect(wearPersona(4)).rejects.toThrow(/cannot wear persona/);
    expect(existsSync(at(".active-persona.json"))).toBe(false);
    await generateOrLoadPersonaGroupRoot(4); await wearPersona(4);
    sealed(".active-persona.json"); expect(await loadActivePersonaIndex()).toBe(4);
  });

  test("V10 all three maps seal, sort, and clear", async () => {
    const pets = await makeNodePersonaPetnameStore(); const decl = await makeNodePersonaDeclarationStore(); const handles = await makeNodePublicHandleStore();
    for (const i of [2, 0, 1]) { await pets.set(i, `label-${i}`); await decl.set(i, { handle: `declaration-${i}` }); await handles.save({ handleIndex: i, contextIndex: 0, nym: `nym-${i}`, glamour: "G", heads: [] }); }
    for (const file of [".persona-petnames.json", ".persona-declarations.json", ".persona-public-handles.json"]) sealed(file);
    expect(read(".persona-petnames.json").includes(Buffer.from("label-0"))).toBe(false); expect(read(".persona-public-handles.json").includes(Buffer.from("nym-0"))).toBe(false);
    expect(await pets.entries()).toEqual([[0, "label-0"], [1, "label-1"], [2, "label-2"]]);
    expect((await decl.entries()).map(([i]) => i)).toEqual([0, 1, 2]); expect(await handles.list()).toEqual([0, 1, 2]);
    await pets.clear(9); expect((await pets.entries()).length).toBe(3);
    await pets.clear(1); await decl.clear(1);
    expect((await pets.entries()).map(([i]) => i)).toEqual([0, 2]); expect((await decl.entries()).map(([i]) => i)).toEqual([0, 2]);
    expect(await handles.load(1)).toEqual({ handleIndex: 1, contextIndex: 0, nym: "nym-1", glamour: "G", heads: [] });
  });

  test("V11 retired and stranger keys cannot read or write sealed identity rows", async () => {
    await generateOrLoadPersonaGroupRoot(0); await wearPersona(0); const pets = await makeNodePersonaPetnameStore(); await pets.set(0, "private");
    const files = [".persona-roster.json", ".active-persona.json", ".persona-petnames.json", rootFile(0)];
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = files.map(read);
    const reads = [() => listPersonaRoots(), () => loadActivePersonaIndex(), () => pets.get(0), () => loadPersonaGroupRootSeed(0)];
    const writes = [() => generateOrLoadPersonaGroupRoot(0), () => wearPersona(0), () => pets.set(0, "changed"), () => generateOrLoadPersonaGroupRoot(0)];
    for (const door of [...reads, ...writes]) await expect(Promise.resolve().then(door)).rejects.toThrow(/reads key-fails/);
    // The root row's own doors, asked straight at the retired holder: the roster no longer stands in front of them.
    await expect(cold(rootFile(0))).rejects.toThrow(/reads key-fails/);
    // A decision that ignores the reading it got and a blind write both stop at the sealed writer: the tree commits to another key.
    await expect(c.holder.updateColdRow("identity", rootFile(0), () => ({ plaintext: enc({ under: "retired" }), value: undefined }))).rejects.toThrow(TreeVkRefusal);
    await expect(c.holder.writeRow("identity", rootFile(0), enc({ under: "retired" }))).rejects.toThrow(TreeVkRefusal);
    const keyB = mintVk();
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      await expect(writeSealedCarrier({ io: c.io, vk: keyB, treePath: vkSlotsPath(c.homes.identity), carrier: { name: `identity/${file}`, path: at(file), keyClass: null }, plaintext: enc({ under: "B" }) })).rejects.toThrow(TreeVkRefusal);
      expect(read(file).equals(standing[i]!), `${file} never moved`).toBe(true); expect(existsSync(`${at(file)}.vk-sealing`)).toBe(false);
    }
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes }); await fresh.adopt(rotated.vk); seatCustody(fresh);
    expect(await listPersonaRoots()).toEqual([0]); expect(await loadActivePersonaIndex()).toBe(0); expect(await pets.get(0)).toBe("private"); expect(await loadPersonaGroupRootSeed(0)).toHaveLength(32);
    await fresh.lock(); seatCustody(c.holder);
  });

  test("V12 two holders update maps and raced root mint once", async () => {
    const pets = await makeNodePersonaPetnameStore();
    for (const i of [0, 1, 2]) await pets.set(i, `p${i}`);
    const other = makeCustodyHolder({ io: c.io, homes: c.homes }); await other.adopt(c.vk);
    const viaOther = (i: number) => other.updateRow("identity", ".persona-petnames.json", (row) => {
      const names = row.reading === "opens" ? JSON.parse(new TextDecoder().decode(row.plaintext)).names as Record<string, string> : {};
      names[String(i)] = `p${i}`; return { plaintext: enc({ names }), value: undefined };
    });
    await Promise.all([viaOther(3), viaOther(4), viaOther(5)]);
    expect((await pets.entries()).map(([i]) => i)).toEqual([0, 1, 2, 3, 4, 5]);
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
    const first = await generateOrLoadPersonaGroupRoot(0); const roster = read(".persona-roster.json"); const root = read(rootFile(0));
    expect((await generateOrLoadPersonaGroupRoot(0)).created).toBe(false);
    expect(read(".persona-roster.json").equals(roster)).toBe(true); expect(read(rootFile(0)).equals(root)).toBe(true);
    expect(first.created).toBe(true);
  });

  test("V15 two vessel-key mints race and the key, the KEL and the sealed seed name one mint", async () => {
    const [a, b] = await Promise.all([generateOrLoadVesselIdentity(), generateOrLoadVesselIdentity()]);
    expect(a.verifyingKey).toBe(b.verifyingKey);
    const key = JSON.parse(read(".vessel-key.json").toString()) as { verifyingKey: string };
    const kel = JSON.parse(read(".vessel-kel.json").toString()) as { k: string[]; n: string[] };
    const next = await cold<{ nextVerifyingKey: string }>(".vessel-next.json");
    expect(key.verifyingKey).toBe(a.verifyingKey);
    expect(kel.k).toEqual([a.verifyingKey]);
    expect(kel.n[0]).toBe(createHash("sha256").update(Buffer.from(next.nextVerifyingKey, "hex")).digest("hex"));
    // A SECOND PROCESS's mint, stood in for by a second holder over the same tree with the first act's key
    // file moved aside: its seed replaces the standing one, and the commitment it then writes names ITS key over
    // the seed that stands. The three records always name one mint.
    expect(readdirSync(c.homes.identity).filter((f) => f.endsWith(".landing"))).toEqual([]);
    const firstKel = read(".vessel-kel.json");
    rmSync(at(".vessel-key.json"));
    const again = await generateOrLoadVesselIdentity();
    expect(again.verifyingKey).not.toBe(a.verifyingKey);
    const kel2 = JSON.parse(read(".vessel-kel.json").toString()) as { k: string[]; n: string[] };
    const next2 = await cold<{ nextVerifyingKey: string }>(".vessel-next.json");
    expect(read(".vessel-kel.json").equals(firstKel)).toBe(false);          // a stale commitment never outlives its key
    expect(kel2.k).toEqual([again.verifyingKey]);
    expect(kel2.n[0]).toBe(createHash("sha256").update(Buffer.from(next2.nextVerifyingKey, "hex")).digest("hex"));
    expect(next2.nextVerifyingKey).not.toBe(next.nextVerifyingKey);
    // control: a key that stands ends a later mint with nothing written
    const standing = [".vessel-key.json", ".vessel-kel.json", ".vessel-next.json"].map(read);
    expect((await generateOrLoadVesselIdentity()).verifyingKey).toBe(again.verifyingKey);
    [".vessel-key.json", ".vessel-kel.json", ".vessel-next.json"].forEach((f, i) => expect(read(f).equals(standing[i]!), f).toBe(true));
  });

  test.each([["a", "b"], ["b", "a"]] as const)("V17 two graphs cross at the step boundary: %s commits first and %s's step two writes nothing", async (first, later) => {
    // Each act's holder counts its cold updates and waits at a gate, so the order reads: both step ones (each seals
    // a seed while no key stands), the first act's step two (commits), the later act's step two (meets that key).
    let release = (): void => undefined;
    const laterSealed = new Promise<void>((r) => { release = r; });
    let landed = (): void => undefined;
    const firstCommitted = new Promise<void>((r) => { landed = r; });
    const steps = { a: 0, b: 0 };
    type Holder = typeof c.holder;
    const gated = (holder: Holder, who: "a" | "b"): Holder => ({
      ...holder,
      async updateColdRow(home, file, decide) {
        const step = (steps[who] += 1);
        if (who === first && step === 2) await laterSealed;
        if (who === later && step === 2) await firstCommitted;
        try { return await holder.updateColdRow(home, file, decide); }
        finally {
          if (who === later && step === 1) release();
          if (who === first && step === 2) landed();
        }
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
    await second.adopt(c.vk);
    seatB.seatCustody(gated(second as unknown as Holder, "b") as unknown as Parameters<typeof seatB.seatCustody>[0]);
    try {
      const [a, b] = await Promise.all([generateOrLoadVesselIdentity(), identityB.generateOrLoadVesselIdentity()]);
      expect(steps).toEqual({ a: 2, b: 2 });                                  // control: both acts ran both steps
      const key = JSON.parse(read(".vessel-key.json").toString()) as { verifyingKey: string };
      const kel = JSON.parse(read(".vessel-kel.json").toString()) as { k: string[]; n: string[] };
      const next = await cold<{ nextVerifyingKey: string }>(".vessel-next.json");
      expect(b.verifyingKey).toBe(a.verifyingKey);                            // both acts answer the one standing key
      expect(key.verifyingKey).toBe(a.verifyingKey);
      expect(kel.k).toEqual([a.verifyingKey]);
      expect(kel.n[0]).toBe(createHash("sha256").update(Buffer.from(next.nextVerifyingKey, "hex")).digest("hex"));
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
    await c.holder.updateRow("identity", ".persona-roster.json", () => ({ plaintext: enc({ roots: [] }), value: undefined }));
    writeFileSync(at(".persona-group-root-h01.json"), sealedRoot);
    expect(await orphanPersonaRoots()).toEqual([1]);          // control: the canonical spelling names the orphan
    rmSync(at(rootFile(1)));
    expect(await orphanPersonaRoots()).toEqual([]);           // `h01` alone names none
    expect(minted.created).toBe(true);
  });
});
