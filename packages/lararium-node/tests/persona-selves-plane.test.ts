/**
 * persona-selves-plane — the mounted face's persona plane as the vessel's main thread writes it, off its own Repo.
 *
 *   R1  a write lands on the plane's own document in this Repo, under the plane's bag, and a second reader of
 *       that document folds it back; the Repo holds no other document the write touched.
 *   R2  two writes of one name carry stamps in the order they ran, so the later rename reads.
 *       CONTROL: a stamp the plane already outranks answers `written: false` and the plane keeps its name.
 *   R3  a plane whose document this Repo cannot find refuses by throwing, and a later ask tries again.
 */
import { describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { AutomergeDocStore, emptyLarDoc, personaSelfTiddlerUri, type LarDoc } from "@lararium/mesh";
import { personaSelvesPlaneOver, repoPersonaSelvesPlane } from "../src/persona-selves-plane.js";

const BAG = "bags/persona-plane-test";

describe("the persona plane off the main thread's Repo", () => {
  test("R1 — a write lands on the plane's document alone and a second reader folds it back", async () => {
    const repo = new Repo({});
    const persona = repo.create<LarDoc>(emptyLarDoc());
    const bystander = repo.create<LarDoc>(emptyLarDoc());
    const before = JSON.stringify(bystander.doc());
    const plane = repoPersonaSelvesPlane(repo, persona.url, BAG);
    expect(await plane.write(1, "petname", "veil-two")).toEqual({ written: true });
    expect(await plane.write(1, "handle", "Kahu Beta")).toEqual({ written: true });
    expect(await plane.read()).toEqual([{ handleIndex: 1, petname: "veil-two", handle: "Kahu Beta" }]);
    const second = new AutomergeDocStore(persona as never, BAG);
    expect(((await second.get(personaSelfTiddlerUri(1)))?.tiddler as { petname?: string }).petname).toBe("veil-two");
    expect(Object.keys(persona.doc().tiddlers)).toEqual([personaSelfTiddlerUri(1)]);
    expect(JSON.stringify(bystander.doc())).toBe(before);
  });

  test("R2 — the later rename reads; a stamp the plane outranks writes nothing", async () => {
    const repo = new Repo({});
    const persona = repo.create<LarDoc>(emptyLarDoc());
    const stamps = ["t2", "t3", "t1"];
    const plane = personaSelvesPlaneOver(async () => new AutomergeDocStore(persona as never, BAG), () => stamps.shift()!);
    await plane.write(0, "petname", "first");
    expect(await plane.write(0, "petname", "second")).toEqual({ written: true });
    expect(await plane.write(0, "petname", "a-stale-arrival")).toEqual({ written: false });   // control
    expect(await plane.read()).toEqual([{ handleIndex: 0, petname: "second" }]);
  });

  test("R3 — a document this Repo cannot find refuses, and a later ask tries again", async () => {
    const repo = new Repo({});
    const absent = "automerge:2j9knpCseyhnK8izDmLpGP5WMdZQ" as AutomergeUrl;
    const plane = repoPersonaSelvesPlane(repo, absent, BAG);
    await expect(plane.read()).rejects.toThrow();
    await expect(plane.write(0, "petname", "x")).rejects.toThrow();
  });
});
