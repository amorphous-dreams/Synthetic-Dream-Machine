/**
 * persona-selves-plane — each carried face's own persona plane as the vessel's main thread writes it, off its own Repo.
 *
 *   R1  a write lands on the face's OWN plane document, under that plane's bag, and a second reader of the
 *       document folds it back; no other document of the Repo moves.
 *   R2  ONE FACE, ONE PLANE. A vessel that carries two faces writes each face's name onto that face's plane
 *       alone: face 0's plane holds nothing of face 1, and the read answers each plane for its own face only,
 *       even where a plane's document holds a stray tiddler for another index.
 *   R3  a face this vessel carries no plane for writes nothing and says so (`plane: false`).
 *   R4  the later rename reads; a stamp the plane outranks writes nothing.   R5  `fill` never replaces.
 *   R6  a plane whose document this Repo cannot find refuses by throwing.
 *   R1-R6 run over a rest that seals. The vessel's own plane rests clear:
 *   R7  RED: a plane over the vessel's own storage adapter names its rest `clear`, refuses a name by that rest, and
 *       the storage directory holds no byte of the name. A clear still runs there and removes a name an older
 *       vessel left. CONTROL: a name written straight onto the document rests verbatim in that directory, so the
 *       search reads a clear rest.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { AutomergeDocStore, emptyLarDoc, personaBagIdFor, personaSelfTiddlerUri, type LarDoc } from "@lararium/mesh";
import { writePersonaSelfName } from "@lararium/tw5";
import { personaSelvesPlaneOver, repoFacePlanes, repoPersonaSelvesPlane } from "../src/persona-selves-plane.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";

const G0 = "a0".repeat(16), G1 = "b1".repeat(16);

/** Every byte a storage directory holds, as one latin-1 text: a name resting verbatim reads in it. */
function restOf(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) out += readFileSync(join(entry.parentPath, entry.name)).toString("latin1");
  }
  return out;
}

function twoFaces() {
  const repo = new Repo({});
  const p0 = repo.create<LarDoc>(emptyLarDoc()), p1 = repo.create<LarDoc>(emptyLarDoc()), bystander = repo.create<LarDoc>(emptyLarDoc());
  // The faces' planes off the Repo, over a rest that seals: the composition the sealed store's step three stands.
  const plane = personaSelvesPlaneOver(repoFacePlanes(repo, [{ personaGroupId: G0, url: p0.url }, { personaGroupId: G1, url: p1.url }],
    async () => [{ handleIndex: 0, personaGroupId: G0 }, { handleIndex: 1, personaGroupId: G1 }]), { rest: "sealed" });
  return { repo, p0, p1, bystander, plane };
}

describe("each face's persona plane off the main thread's Repo", () => {
  test("R1 — a write lands on the face's own plane document alone, and a second reader folds it back", async () => {
    const { p0, p1, bystander, plane } = twoFaces();
    const before = JSON.stringify(bystander.doc());
    expect(await plane.write(0, "petname", "veil-one")).toEqual({ written: true, plane: true });
    const second = new AutomergeDocStore(p0 as never, personaBagIdFor(G0));
    expect(((await second.get(personaSelfTiddlerUri(0)))?.tiddler as { petname?: string }).petname).toBe("veil-one");
    expect(Object.keys(p0.doc().tiddlers)).toEqual([personaSelfTiddlerUri(0)]);
    expect(Object.keys(p1.doc().tiddlers)).toEqual([]);
    expect(JSON.stringify(bystander.doc())).toBe(before);
  });

  test("R2 — one face, one plane: no plane holds, and no read answers, another face's name", async () => {
    const { p0, p1, plane } = twoFaces();
    await plane.write(0, "petname", "the-work-face");
    await plane.write(1, "petname", "the-quiet-face");
    await plane.write(1, "handle", "The Lindwyrm");
    expect(JSON.stringify(p0.doc()).includes("the-quiet-face") || JSON.stringify(p0.doc()).includes("The Lindwyrm")).toBe(false);
    expect(JSON.stringify(p1.doc()).includes("the-work-face")).toBe(false);
    expect(JSON.stringify(p1.doc()).includes("the-quiet-face")).toBe(true);                    // control: the name reached its own plane
    // A stray tiddler for index 1 on face 0's plane (an older vessel's write) answers nobody.
    await writePersonaSelfName(new AutomergeDocStore(p0 as never, personaBagIdFor(G0)), 1, "petname", "a-stray-from-another-face", "t1");
    expect(await plane.read()).toEqual([{ handleIndex: 0, petname: "the-work-face" }, { handleIndex: 1, petname: "the-quiet-face", handle: "The Lindwyrm" }]);
  });

  test("R3 — a face this vessel carries no plane for writes nothing and says so", async () => {
    const { p0, p1, plane } = twoFaces();
    expect(await plane.write(7, "petname", "nobody")).toEqual({ written: false, plane: false });
    expect([...Object.keys(p0.doc().tiddlers), ...Object.keys(p1.doc().tiddlers)]).toEqual([]);
  });

  test("R4 — the later rename reads; a stamp the plane outranks writes nothing", async () => {
    const repo = new Repo({});
    const persona = repo.create<LarDoc>(emptyLarDoc());
    const stamps = ["t2", "t3", "t1"];
    const plane = personaSelvesPlaneOver(async () => [{ handleIndex: 0, store: async () => new AutomergeDocStore(persona as never, personaBagIdFor(G0)) }], { rest: "sealed", stamp: () => stamps.shift()! });
    await plane.write(0, "petname", "first");
    expect(await plane.write(0, "petname", "second")).toEqual({ written: true, plane: true });
    expect(await plane.write(0, "petname", "a-stale-arrival")).toEqual({ written: false, plane: true });   // control
    expect(await plane.read()).toEqual([{ handleIndex: 0, petname: "second" }]);
  });

  test("R5 — fill lands over nothing and never over a name the plane holds", async () => {
    const { plane } = twoFaces();
    expect(await plane.write(0, "petname", "carried-up", { fill: true })).toEqual({ written: true, plane: true });
    expect(await plane.write(0, "petname", "an-old-local-name", { fill: true })).toEqual({ written: false, plane: true });
    expect(await plane.read()).toEqual([{ handleIndex: 0, petname: "carried-up" }]);
    expect(await plane.write(0, "petname", "a-rename")).toEqual({ written: true, plane: true });           // control: a plain write replaces
  });

  test("R7 — a plane whose rest stands clear takes no name: the vessel's own storage holds none", async () => {
    const dir = mkdtempSync(join(tmpdir(), "selves-rest-"));
    // The Repo saves its storage id on its own at construction; its shutdown closes the adapter, which lands every
    // write in flight and drops any later one, so the directory leaves only after the store stands still.
    const repo = new Repo({ storage: new DurableNodeFSStorageAdapter(dir) });
    try {
      const p0 = repo.create<LarDoc>(emptyLarDoc());
      const plane = repoPersonaSelvesPlane(repo, [{ personaGroupId: G0, url: p0.url }], async () => [{ handleIndex: 0, personaGroupId: G0 }]);
      const LABEL = `a-relit-label-${Math.random().toString(36).slice(2)}`;
      const DIRECT = `a-direct-write-${Math.random().toString(36).slice(2)}`;
      const refused = await plane.write(0, "petname", LABEL).then(() => null, (err: unknown) => err);
      // CONTROL: a name written straight onto the plane's document, past the plane, rests verbatim in the storage
      // directory, so the search below reads a clear rest and finds what one holds.
      await writePersonaSelfName(new AutomergeDocStore(p0 as never, personaBagIdFor(G0)), 1, "handle", DIRECT, "t1");
      await repo.flush();
      const rest = restOf(dir);
      expect(rest.includes(DIRECT), "the control name reads nowhere in the storage directory").toBe(true);
      expect(rest.includes(LABEL), "the carried label rests in the clear in the vessel's storage").toBe(false);
      // The plane names its rest, and the write refused by that name.
      expect(plane.rest).toBe("clear");
      expect(String(refused)).toMatch(/rests in the clear/);
      expect(await plane.read()).toEqual([]);
      // A clear runs at a clear rest: it moves no name onto it, and removes one an older vessel of the face left.
      await writePersonaSelfName(new AutomergeDocStore(p0 as never, personaBagIdFor(G0)), 0, "petname", "an-older-vessels-name", "t1");
      expect(await plane.read()).toEqual([{ handleIndex: 0, petname: "an-older-vessels-name" }]);
      expect(await plane.write(0, "petname", "")).toEqual({ written: true, plane: true });
      expect(await plane.read()).toEqual([]);
    } finally {
      await repo.shutdown();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("R6 — a document this Repo cannot find refuses", async () => {
    const repo = new Repo({});
    const absent = "automerge:2j9knpCseyhnK8izDmLpGP5WMdZQ" as AutomergeUrl;
    const plane = personaSelvesPlaneOver(repoFacePlanes(repo, [{ personaGroupId: G0, url: absent }], async () => [{ handleIndex: 0, personaGroupId: G0 }]), { rest: "sealed" });
    await expect(plane.read()).rejects.toThrow();
    await expect(plane.write(0, "petname", "x")).rejects.toThrow();
  });
});
