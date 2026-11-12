/**
 * browser-ward-face-owner — A ROOT RESTS UNDER ITS OWN FACE'S TREE (persona-circle#/the-atom: keyed by the face, never by handle index).
 *
 * A face's root rests under a ward filed by that face's own custody tree (`ward/root/<fcid>/…`, the tree the face index joins to its
 * PersonaGroup at the naming), so the path names the owner and no second row has to:
 *
 *   WO1 RED   two faces founded on one browser hold two roots, each under its own tree, and neither row names the other: the first
 *             face's rows stand byte-equal across the second's mint, each signs with its own key, and a face founded again reads
 *             its own root (a mint naming the face not worn refuses `face-not-worn`). CONTROL: each face signs.
 *   WO2 RED   a face clear removes its root: its ward rows, its roster line and ward/sign/<G>/* go with the face's tree; nothing
 *             signs for it after, and a fresh founding mints a fresh root. CONTROL: before the clear the face signs.
 *   WO4 RED   a face clear torn partway through its ward rows leaves the rest under the face's tree, so the clear run again finds
 *             and removes every row. CONTROL: the tear landed (a ward row went before it).
 *   WO3 RED   no face-key root door survives: `mintFaceRoot`/`readFaceRoot`/`faceWardRows` leave the module, and a face row
 *             named `persona-root` refuses `row-name-refused`. CONTROL: an ordinary face row writes.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { nobleKdf } from "@lararium/mesh";
import { bindSyntheticBrowserCustodySlot, bindSyntheticFace, FIXTURE_WARD } from "./browser-custody-fixture.js";
import * as faceCustody from "../src/browser-face-custody.js";
import { CLEAR_FACE_QUESTION, clearFaceCustody, faceTreeIdOf, nameFace, writeFaceRow } from "../src/browser-face-custody.js";
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

describe("a root rests under its own face's tree", () => {
  test("WO1 RED two faces founded on one browser hold two roots, each filed under its own face's tree, and neither row names the other — CONTROL: each signs with its own key", async () => {
    const { idbName, root } = await foundedFace("wo1", "group-first");
    expect(await signs(idbName), "CONTROL: the first face signs").toBeNull();
    const firstTree = (await faceTreeIdOf(idbName, "group-first"))!;
    const firstRows = await wardRows(idbName);
    const firstBytes = await Promise.all(firstRows.map((r) => browserKeystoreCustodyIo(idbName).read(r)));
    expect(firstRows, "the root's rows name its face's tree and no handle").toEqual(["persona-root", "public-key", "slots"].map((r) => `ward/root/${firstTree}/${r}`));
    await bindSyntheticFace(idbName, "group-second");
    wearFaceOfVessel(idbName, "group-second");
    expect(await browserPersonaRootHeld(idbName, 0), "before its mint the second face holds no root").toBe(false);
    expect(readingOf(await signs(idbName)), "and nothing signs for it").toBe("ward-absent");
    const second = await generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, "group-second");
    expect(second.created, "the second face mints a root of its own").toBe(true);
    expect(second.verifyingKey).not.toBe(root.verifyingKey);
    const secondTree = (await faceTreeIdOf(idbName, "group-second"))!;
    expect(secondTree).not.toBe(firstTree);
    expect(await wardRows(idbName), "two wards stand, one per face tree").toEqual([firstTree, secondTree].sort().flatMap((t) => ["persona-root", "public-key", "slots"].map((r) => `ward/root/${t}/${r}`)));
    expect(await Promise.all(firstRows.map((r) => browserKeystoreCustodyIo(idbName).read(r))), "the first face's rows stand byte-equal").toEqual(firstBytes);
    for (const r of await wardRows(idbName)) {
      const other = r.includes(firstTree) ? [secondTree, "group-second", second.verifyingKey] : [firstTree, "group-first", root.verifyingKey];
      const text = new TextDecoder("utf-8", { fatal: false }).decode((await browserKeystoreCustodyIo(idbName).read(r))!);
      for (const o of other) expect(r.includes(o) || text.includes(o), `${r} names nothing of the other face`).toBe(false);
    }
    expect(await signs(idbName), "the second face signs under its own ward").toBeNull();
    expect((await browserWardSigner(idbName, 0, FIXTURE_WARD, spawnCore)).key).toBe(second.verifyingKey);
    // A FACE FOUNDED AGAIN COLLIDES WITH NOTHING: its own root answers, and a mint naming the unworn face refuses.
    wearFaceOfVessel(idbName, "group-first");
    const again = await generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, "group-first");
    expect(again, "the first face founded again reads its own root").toEqual({ verifyingKey: root.verifyingKey, created: false });
    expect((await browserWardSigner(idbName, 0, FIXTURE_WARD, spawnCore)).key).toBe(root.verifyingKey);
    expect(readingOf(await settle(generateOrLoadBrowserPersonaRoot(idbName, 0, FIXTURE_WARD, "group-second"))), "a mint naming the face not worn refuses").toBe("face-not-worn");
    expect((await wardRows(idbName)).length).toBe(6);
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
    expect(readingOf(await settle(browserWardSigner(idbName, 0, FIXTURE_WARD, spawnCore))), "nothing signs for the cleared face").toBe("ward-absent");
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

  test("WO4 RED a clear torn partway through its ward rows leaves the rest under the face's tree, and the rerun clears them — CONTROL: the tear landed", async () => {
    const { idbName } = await foundedFace("wo4", "group-torn-clear");
    const prefix = `ward/root/${(await faceTreeIdOf(idbName, "group-torn-clear"))!}/`;
    const before = (await wardRows(idbName)).filter((r) => r.startsWith(prefix));
    expect(before.length, "the founded ward stands whole").toBe(3);
    // THE TEAR: the keystore takes one ward delete, then the second fails, as a page that dies mid-clear leaves it.
    const proto = IDBObjectStore.prototype;
    const honest = proto.delete;
    let wardDeletes = 0;
    proto.delete = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      if (typeof key === "string" && key.startsWith(prefix) && ++wardDeletes === 2) throw new Error("torn clear");
      return honest.call(this, key);
    };
    let torn: unknown;
    try { torn = await settle(clearFaceCustody(idbName, "group-torn-clear", [FIXTURE_ROUTE], (q) => q === CLEAR_FACE_QUESTION)); }
    finally { proto.delete = honest; }
    expect(String(torn), "the clear tore").toContain("torn clear");
    const left = (await wardRows(idbName)).filter((r) => r.startsWith(prefix));
    expect(left.length, "CONTROL: the tear landed after one ward row went").toBe(before.length - 1);
    const again = await clearFaceCustody(idbName, "group-torn-clear", [FIXTURE_ROUTE], (q) => q === CLEAR_FACE_QUESTION);
    expect(again.reading).toBe("cleared");
    expect((await wardRows(idbName)).filter((r) => r.startsWith(prefix)), "the rerun finds and removes every row").toEqual([]);
    expect(await listBrowserPersonaRoots(idbName)).toEqual([]);
  }, SLOW);
});
