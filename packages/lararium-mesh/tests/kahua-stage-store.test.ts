/**
 * kahua-stage-store — the recipe layer reads the face's stage through the fold, never the doc's tiddlers by title.
 *
 * Any synced member of the face can write any tiddler into the stage doc; a lift counts only as a signed act the fold
 * verifies under the face's grant, on every device, at READ. Every red pairs with a CONTROL through the same store.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { materializeSharedLarDoc } from "../src/deterministic-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { storedLarRecord } from "../src/stored-record.js";
import type { LarTiddlerChange } from "../src/tiddler-store.js";
import { KAHUA_PLANE, adoptKahuaStage, kahuaActCid, kahuaPlaneUrl, kahuaStageDocUrl, signKahuaLift, writeKahuaAct } from "../src/kahua-stage.js";
import { KAHUA_BAG } from "../src/wiki-recipe.js";
import { kahuaStageStore } from "../src/kahua-stage-store.js";

const GROUP = "0x" + "5a".repeat(16);
const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function fixture() {
  const root = await signer(11), atom = await signer(12);
  const face = { group: GROUP, grant: (key: string) => key === root.key };
  const lift = (title: string, text: string, parent: string | null) => signKahuaLift({
    group: GROUP, epoch: 0, title, text, fields: {}, parent, origin: { seat: atom.key, device: atom.key, session: "s" }, taint: [], sources: [{ title: `daemon/${title}`, revision: "r" }],
  }, root);
  const device = async () => {
    const repo = new Repo({ network: [] });
    return { repo, stage: await materializeSharedLarDoc(repo, kahuaStageDocUrl(GROUP), "kahua") };
  };
  return { root, atom, face, lift, device };
}
const land = (stage: DocHandle<LarDoc>, act: Awaited<ReturnType<typeof signKahuaLift>>) => stage.change((d) => writeKahuaAct(d, act));
const plain = (stage: DocHandle<LarDoc>, title: string, fields: Record<string, string>) =>
  stage.change((d) => { d.tiddlers[title] = storedLarRecord(title, { title, ...fields }, "hand"); });

describe("verify on read", () => {
  test("RED: a plain tiddler a synced member writes into the stage doc never reads as a kahua item; CONTROL: a lifted item reads with its provenance", async () => {
    const { face, lift, device } = await fixture();
    const { stage } = await device();
    const lifted = await lift("kept", "verified body", null);
    land(stage, lifted);
    plain(stage, "x", { text: "poison" });
    plain(stage, "kept", { text: "a hand edit over the lifted item" });
    const store = kahuaStageStore({ handle: stage, bagId: "lar:///ha.ka.ba/bags/kahua", face: () => face });
    expect(await store.get("x")).toBeNull();
    expect((await store.get("kept"))?.tiddler).toMatchObject({ title: "kept", text: "verified body", "kahua-cid": kahuaActCid(lifted) });
    expect((await store.listVisible()).sort()).toEqual(["kept"]);
    // The raw doc store (what a library slot mounts by default) reads the poison: the hole this store closes.
    expect((await new AutomergeDocStore(stage).get("x"))?.tiddler.text).toBe("poison");
    await expect(store.put({ tiddler: { title: "x", text: "y" } }, { kind: "user-edit" } as never)).rejects.toThrow(/kahua/);
  });

  test("RED: two lifts on one parent from two devices read `kahua-siblings` naming both cids on BOTH devices, whatever a title's CRDT pick holds; CONTROL: one lift reads standing", async () => {
    const { face, lift, device } = await fixture();
    const a = await device(), b = await device();
    const v1 = await lift("t", "v1", null);
    land(a.stage, v1);
    b.stage.merge(a.stage);
    const readA = kahuaStageStore({ handle: a.stage, face: () => face }), readB = kahuaStageStore({ handle: b.stage, face: () => face });
    expect((await readB.get("t"))?.tiddler["kahua-siblings"]).toBeUndefined();
    const v2a = await lift("t", "v2 from a", kahuaActCid(v1)), v2b = await lift("t", "v2 from b", kahuaActCid(v1));
    land(a.stage, v2a); plain(a.stage, "t", { text: "v2 from a", "kahua-cid": kahuaActCid(v2a) });
    land(b.stage, v2b); plain(b.stage, "t", { text: "v2 from b", "kahua-cid": kahuaActCid(v2b) });
    a.stage.merge(b.stage); b.stage.merge(a.stage);
    const both = [kahuaActCid(v2a), kahuaActCid(v2b)].sort().join(" ");
    for (const read of [readA, readB]) expect((await read.get("t"))?.tiddler["kahua-siblings"]).toBe(both);
  });

  test("RED: a doc other than the face's derived stage, another face's group or no face read nothing; CONTROL: the derived doc under its own face reads", async () => {
    const { face, lift } = await fixture();
    const repo = new Repo({ network: [] });
    const elsewhere = repo.create<LarDoc>(emptyLarDoc());
    const act = await lift("t", "x", null);
    land(elsewhere, act);
    expect(await kahuaStageStore({ handle: elsewhere, face: () => face }).listVisible()).toEqual([]);
    const stage = await materializeSharedLarDoc(repo, kahuaStageDocUrl(GROUP), "kahua");
    land(stage, act);
    expect(await kahuaStageStore({ handle: stage, face: () => ({ ...face, group: "0x" + "77".repeat(16) }) }).listVisible()).toEqual([]);
    expect(await kahuaStageStore({ handle: stage, face: () => null }).get("t")).toBeNull();
    expect(await kahuaStageStore({ handle: stage, face: () => face }).listVisible()).toEqual(["t"]);
  });

  test("RED: a later lift tells subscribers its item and a poison write tells nothing; CONTROL: an initial replay names the standing items alone", async () => {
    const { face, lift, device } = await fixture();
    const { stage } = await device();
    land(stage, await lift("first", "1", null));
    const store = kahuaStageStore({ handle: stage, face: () => face });
    const heard: LarTiddlerChange[] = [];
    store.subscribe((c) => heard.push(c));
    store.emitInitialReplay();
    expect(heard.map((c) => c.title)).toEqual(["first"]);
    heard.length = 0;
    plain(stage, "poison", { text: "p" });
    land(stage, await lift("second", "2", null));
    expect(heard.map((c) => c.title)).toEqual(["second"]);
    expect(heard[0]?.record?.tiddler.text).toBe("2");
  });
});

describe("the stage address", () => {
  test("RED: the pin reads only the face's derived stage url; CONTROL: an absent pin reads none", () => {
    const url = kahuaStageDocUrl(GROUP);
    expect(kahuaStageDocUrl(GROUP.toUpperCase().replace("0X", "0x"))).toBe(url);
    expect(kahuaPlaneUrl({ planes: { [KAHUA_PLANE]: url } }, GROUP)).toBe(url);
    expect(kahuaPlaneUrl({ planes: { [KAHUA_PLANE]: "automerge:2j9knpCseyhnK8izDmLpGP5WMdZQ" } }, GROUP)).toBeNull();
    expect(kahuaPlaneUrl({ planes: { [KAHUA_PLANE]: url } }, "0x" + "77".repeat(16))).toBeNull();
    expect(kahuaPlaneUrl({ planes: {} }, GROUP)).toBeNull();
  });
});

describe("adoption at boot", () => {
  test("RED: a device of the face adopts the stage its verified projection pins: the doc stands locally and the catalog row names it; CONTROL: an unpinned face or a pin naming another doc registers nothing", async () => {
    const repo = new Repo({ network: [] });
    const rows: Record<string, string> = {};
    const register = (bag: string, url: string) => { rows[bag] = url; };
    expect(await adoptKahuaStage({ repo, group: GROUP, projection: { planes: {} }, register })).toBeNull();
    expect(await adoptKahuaStage({ repo, group: GROUP, projection: { planes: { [KAHUA_PLANE]: "automerge:2j9knpCseyhnK8izDmLpGP5WMdZQ" } }, register })).toBeNull();
    expect(rows).toEqual({});
    const url = await adoptKahuaStage({ repo, group: GROUP, projection: { planes: { [KAHUA_PLANE]: kahuaStageDocUrl(GROUP) } }, register });
    expect(url).toBe(kahuaStageDocUrl(GROUP));
    expect(rows).toEqual({ [KAHUA_BAG]: url });
    expect(repo.handles[(await repo.find<LarDoc>(url!)).documentId]).toBeDefined();
  });

describe("the stage projection is folded once per snapshot (P5: every landed title re-folded the whole stage)", () => {
  test("RED: N reads of a standing stage fold the document once; CONTROL: a new act, and a face that moved, each fold again", async () => {
    const { face, lift, device } = await fixture();
    const d = await device();
    for (let i = 0; i < 4; i++) land(d.stage, await lift(`t${i}`, `x${i}`, null));
    let folds = 0;
    const counting = new Proxy(d.stage, { get(target, key) {
      if (key === "doc") return () => { folds += 1; return target.doc(); };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } }) as DocHandle<LarDoc>;
    let standing = face;
    const store = kahuaStageStore({ handle: counting, bagId: KAHUA_BAG, face: () => standing });
    for (let i = 0; i < 25; i++) { await store.get(`unrelated-${i}`); await store.listVisible(); }
    expect(folds, "one fold for the standing snapshot").toBe(1);
    land(d.stage, await lift("t-new", "y", null));
    await store.get("unrelated-after");
    expect(folds, "a new act moved the heads: it folds again").toBe(2);
    standing = { ...face };                         // the authority moved (a new face object): the memory does not carry a revoked reading
    await store.get("unrelated-face");
    expect(folds, "a moved face folds again").toBe(3);
  });
});
});
