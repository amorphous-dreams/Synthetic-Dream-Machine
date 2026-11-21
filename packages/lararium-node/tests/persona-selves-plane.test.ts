/**
 * persona-selves-plane — each carried face's own selves record as the vessel's main thread writes it, off its own Repo.
 *
 *   R1  a write lands in the face's OWN record document, under that record's bag, and a second reader of the
 *       document folds it back; no other document of the Repo moves.
 *   R2  ONE FACE, ONE RECORD. A vessel that carries two faces writes each face's name into that face's record
 *       alone: face 0's record holds nothing of face 1, and the read answers each record for its own face only,
 *       even where a record's document holds a stray tiddler for another index.
 *   R3  a face this vessel carries no record for writes nothing and says so (`plane: false`).
 *   R4  the later rename reads; a stamp the record outranks writes nothing.   R5  `fill` never replaces.
 *   R6  a record whose document this Repo cannot open refuses by throwing.
 *   R7  the Repo's own records: each face's record derives off its group (`selvesRecordOf`), stands on first ask with
 *       no url carried, and a face whose plane no proof vouched for carries none. (W1-W5 stand in `selves-record-*`.)
 *   R1-R6 run over a rest that seals.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, emptyLarDoc, personaSelfTiddlerUri, selvesRecordOf, type LarDoc } from "@lararium/mesh";
import { writePersonaSelfName } from "@lararium/tw5";
import { personaSelvesPlaneOver, repoPersonaSelvesPlane } from "../src/persona-selves-plane.js";

const G0 = "a0".repeat(16), G1 = "b1".repeat(16);
const sealed = () => "sealed" as const;

function twoFaces() {
  const repo = new Repo({});
  const p0 = repo.create<LarDoc>(emptyLarDoc()), p1 = repo.create<LarDoc>(emptyLarDoc()), bystander = repo.create<LarDoc>(emptyLarDoc());
  // Each face's record, a document of its own, over a rest that seals.
  const plane = personaSelvesPlaneOver(async () => [
    { handleIndex: 0, store: async () => new AutomergeDocStore(p0 as never, selvesRecordOf(G0).bagId), rest: sealed },
    { handleIndex: 1, store: async () => new AutomergeDocStore(p1 as never, selvesRecordOf(G1).bagId), rest: sealed },
  ]);
  return { repo, p0, p1, bystander, plane };
}

describe("each face's persona plane off the main thread's Repo", () => {
  test("R1 — a write lands on the face's own plane document alone, and a second reader folds it back", async () => {
    const { p0, p1, bystander, plane } = twoFaces();
    const before = JSON.stringify(bystander.doc());
    expect(await plane.write(0, "petname", "veil-one")).toEqual({ written: true, plane: true });
    const second = new AutomergeDocStore(p0 as never, selvesRecordOf(G0).bagId);
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
    await writePersonaSelfName(new AutomergeDocStore(p0 as never, selvesRecordOf(G0).bagId), 1, "petname", "a-stray-from-another-face", "t1");
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
    const plane = personaSelvesPlaneOver(async () => [{ handleIndex: 0, store: async () => new AutomergeDocStore(persona as never, selvesRecordOf(G0).bagId), rest: sealed }], { stamp: () => stamps.shift()! });
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

  test("R6 — a record whose document this Repo cannot open refuses", async () => {
    const plane = personaSelvesPlaneOver(async () => [{ handleIndex: 0, store: () => Promise.reject(new Error("no such document")), rest: sealed }]);
    await expect(plane.read()).rejects.toThrow();
    await expect(plane.write(0, "petname", "x")).rejects.toThrow();
  });

  test("R7 — the Repo's own records derive off each face's group, stand on first ask, and need a proven plane", async () => {
    const repo = new Repo({});
    const p0 = repo.create<LarDoc>(emptyLarDoc());
    const opened: string[] = [];
    // h1's group has no proven plane on this vessel: it carries no record.
    const plane = repoPersonaSelvesPlane(repo, [{ personaGroupId: G0, url: p0.url }],
      async () => [{ handleIndex: 0, personaGroupId: G0 }, { handleIndex: 1, personaGroupId: G1 }],
      { restOf: () => "sealed", opened: (r) => opened.push(r.bagId) });
    expect(await plane.write(0, "petname", "the-derived-face")).toEqual({ written: true, plane: true });
    expect(await plane.write(1, "petname", "unproven")).toEqual({ written: false, plane: false });
    const record = await repo.find<LarDoc>(selvesRecordOf(G0).url as never);
    const second = new AutomergeDocStore(record as never, selvesRecordOf(G0).bagId);
    expect(((await second.get(personaSelfTiddlerUri(0)))?.tiddler as { petname?: string }).petname).toBe("the-derived-face");
    expect(Object.keys(p0.doc()?.tiddlers ?? {}), "the plane takes no name").toEqual([]);
    expect(opened, "the record's catalog row hears its bag once").toEqual([selvesRecordOf(G0).bagId]);
    expect(await plane.restOf(0)).toBe("sealed");
    expect(await plane.restOf(1)).toBeNull();
  });
});
