/**
 * browser-ward-face-owner — THE WARD AT h0 BELONGS TO ONE FACE (the blind custody read of merge c98557881, P2-1 · P2-2 · P2-3).
 *
 * The merge rested each face's root under a per-handle ward (`ward/h0/…`). The ward names no face by its path, so the house binds
 * it to the face whose tree stood when it minted (`ward/h<N>/face-tree`, that tree's opaque fcid):
 *
 *   WO1 RED   a second face neither collides with nor inherits ward/h0: its mint refuses `ward-owned-by-another-face` and writes
 *             nothing, and no ward act signs while it stands worn. CONTROL: the owning face, worn again, signs.
 *   WO2 RED   a face clear removes its root: ward/h0's rows, its owner row, its roster line and ward/sign/<G>/* go with the face's
 *             tree; nothing signs at h0 after, and a fresh founding mints a fresh root. CONTROL: before the clear the face signs.
 *   WO4 RED   a face clear torn partway through its ward rows leaves the owner row (`ward/h0/face-tree`) standing, so the clear
 *             run again finds the rest and removes every row. CONTROL: the tear landed (a ward row went before it).
 *   WO3 RED   no face-key root door survives: `mintFaceRoot`/`readFaceRoot`/`faceWardRows` leave the module, and a face row
 *             named `persona-root` refuses `row-name-refused`. CONTROL: an ordinary face row writes.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { nobleKdf } from "@lararium/mesh";
import { bindSyntheticBrowserCustodySlot, bindSyntheticFace, FIXTURE_WARD } from "./browser-custody-fixture.js";
import * as faceCustody from "../src/browser-face-custody.js";
import { CLEAR_FACE_QUESTION, clearFaceCustody, nameFace, writeFaceRow } from "../src/browser-face-custody.js";
import { browserKeystoreCustodyIo, sealBrowserKeystore } from "../src/browser-custody.js";
import { browserPersonaRootHeld, generateOrLoadBrowserPersonaRoot, listBrowserPersonaRoots, wearFaceOfVessel } from "../src/browser-vessel-identity.js";
import { browserWardSigner, type WardWorkerSpawn } from "../src/browser-ward.js";
import { runWardAct } from "../src/ward-core.js";

const SLOW = 120_000;
const PLACE = { kind: "passphrase", passphrase: "ward owner place route" } as const;
const FIXTURE_ROUTE = { kind: "passphrase", passphrase: "browser fixture custody slot" } as const;
const fresh = (tag: string) => `lares:ward-owner-${tag}-${globalThis.crypto.randomUUID()}`;
const settle = (p: Promise<unknown>): Promise<unknown> => p.then(() => null, (e: unknown) => e);
const readingOf = (e: unknown): unknown => (e as { reading?: unknown } | null)?.reading;

/** A worker double: the pure ward core behind a MessagePort. */
const spawnCore: WardWorkerSpawn = () => ({
  postMessage(_msg: unknown, transfer: Transferable[]) {
    const port = transfer[0] as MessagePort;
    port.onmessage = async (m) => { port.postMessage(await runWardAct(m.data, nobleKdf, () => {})); };
  },
  terminate() { /* the act is done */ },
});
const signs = (idbName: string): Promise<unknown> => settle(browserWardSigner(idbName, 0, FIXTURE_WARD, spawnCore).then((s) => s.sign(new Uint8Array([1, 2, 3]))));

async function wardRows(idbName: string): Promise<string[]> {
  return (await browserKeystoreCustodyIo(idbName).list()).filter((r) => r.startsWith("ward/")).sort();
}

/** A sealed place tree, the founder face stood, worn, named `group`, and its root minted under the fixture ward. */
async function foundedFace(tag: string, group: string) {
  const idbName = fresh(tag);
  await sealBrowserKeystore(idbName, PLACE);
  const unnamed = await bindSyntheticBrowserCustodySlot(idbName);
  const root = await generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, unnamed);
  await nameFace(idbName, unnamed, group);
  wearFaceOfVessel(idbName, group);
  return { idbName, root };
}

describe("the ward at h0 belongs to one face", () => {
  test("WO1 RED a second face neither collides with nor inherits ward/h0 — CONTROL: the owning face signs", async () => {
    const { idbName, root } = await foundedFace("wo1", "group-first");
    expect(await signs(idbName), "CONTROL: the owning face signs").toBeNull();
    await bindSyntheticFace(idbName, "group-second");
    wearFaceOfVessel(idbName, "group-second");
    const before = await wardRows(idbName);
    const mint = await settle(generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, "group-second"));
    expect(readingOf(mint), String(mint)).toBe("ward-owned-by-another-face");
    expect(await wardRows(idbName), "the second face's mint writes nothing").toEqual(before);
    expect(readingOf(await signs(idbName)), "no ward act signs for a face that does not own the ward").toBe("ward-owned-by-another-face");
    expect(await browserPersonaRootHeld(idbName, 0), "the second face holds no root").toBe(false);
    wearFaceOfVessel(idbName, "group-first");
    expect(await signs(idbName), "CONTROL: the owner, worn again, signs").toBeNull();
    expect((await generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, "group-first")).verifyingKey).toBe(root.verifyingKey);
  }, SLOW);

  test("WO2 RED a face clear removes its root, its roster line and its ward-key rows; a fresh founding mints fresh — CONTROL: before the clear it signs", async () => {
    const { idbName, root } = await foundedFace("wo2", "group-cleared");
    const io = browserKeystoreCustodyIo(idbName);
    await io.write("ward/sign/group-cleared/public-key", new TextEncoder().encode("planted"));
    await io.write("ward/sign/group-kept/public-key", new TextEncoder().encode("planted"));
    expect(await signs(idbName), "CONTROL: the face signs before its clear").toBeNull();
    const cleared = await clearFaceCustody(idbName, "group-cleared", [FIXTURE_ROUTE], (q) => q === CLEAR_FACE_QUESTION);
    expect(cleared.reading).toBe("cleared");
    expect(await wardRows(idbName), "every ward row of the cleared face goes; another face's stays").toEqual(["ward/sign/group-kept/public-key"]);
    expect(await listBrowserPersonaRoots(idbName), "its roster line goes").toEqual([]);
    expect(await browserPersonaRootHeld(idbName, 0)).toBe(false);
    expect(readingOf(await settle(browserWardSigner(idbName, 0, FIXTURE_WARD, spawnCore))), "nothing signs at h0").toBe("ward-absent");
    const next = await bindSyntheticBrowserCustodySlot(idbName);
    const reborn = await generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, next);
    expect(reborn.created, "a fresh founding mints a fresh root").toBe(true);
    expect(reborn.verifyingKey).not.toBe(root.verifyingKey);
  }, SLOW);

  test("WO3 RED no face-key root door survives — CONTROL: an ordinary face row writes", async () => {
    const mod = faceCustody as Record<string, unknown>;
    for (const door of ["mintFaceRoot", "readFaceRoot", "faceWardRows"]) expect(mod[door], door).toBeUndefined();
    const idbName = fresh("wo3");
    await bindSyntheticBrowserCustodySlot(idbName, "group-rows");
    expect(readingOf(await settle(writeFaceRow(idbName, "group-rows", "persona-root", new Uint8Array([1]))))).toBe("row-name-refused");
    expect(await settle(writeFaceRow(idbName, "group-rows", "atom", new Uint8Array([1]))), "CONTROL").toBeNull();
  }, SLOW);

  test("WO4 RED a clear torn partway through its ward rows leaves the owner row, and the rerun clears the rest — CONTROL: the tear landed", async () => {
    const { idbName } = await foundedFace("wo4", "group-torn-clear");
    const before = (await wardRows(idbName)).filter((r) => r.startsWith("ward/h0/"));
    expect(before, "the founded ward stands whole").toContain("ward/h0/face-tree");
    // THE TEAR: the keystore takes one ward/h0 delete, then the second fails, as a page that dies mid-clear leaves it.
    const proto = IDBObjectStore.prototype;
    const honest = proto.delete;
    let wardDeletes = 0;
    proto.delete = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      if (typeof key === "string" && key.startsWith("ward/h0/") && ++wardDeletes === 2) throw new Error("torn clear");
      return honest.call(this, key);
    };
    let torn: unknown;
    try { torn = await settle(clearFaceCustody(idbName, "group-torn-clear", [FIXTURE_ROUTE], (q) => q === CLEAR_FACE_QUESTION)); }
    finally { proto.delete = honest; }
    expect(String(torn), "the clear tore").toContain("torn clear");
    const left = (await wardRows(idbName)).filter((r) => r.startsWith("ward/h0/"));
    expect(left.length, "CONTROL: the tear landed after one ward row went").toBe(before.length - 1);
    expect(left, "the owner row goes last, so a torn clear leaves it standing").toContain("ward/h0/face-tree");
    const again = await clearFaceCustody(idbName, "group-torn-clear", [FIXTURE_ROUTE], (q) => q === CLEAR_FACE_QUESTION);
    expect(again.reading).toBe("cleared");
    expect((await wardRows(idbName)).filter((r) => r.startsWith("ward/h0/")), "the rerun finds and removes every row").toEqual([]);
    expect(await listBrowserPersonaRoots(idbName)).toEqual([]);
  }, SLOW);
});
