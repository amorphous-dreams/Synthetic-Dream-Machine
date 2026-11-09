/**
 * swarm-wiki — the control document as the swarm's wiki: a record reads back what wrote it, rests stamped `disk-projection: "no"`, a
 * `writeNew` claim lands once however many writers race it, and a prototype-keyed title reads as absent. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, ownEntry, swarmGoRowTitle, swarmGoTitle, swarmGoSpentTitle, type LarDoc } from "@lararium/mesh";
import { controlSwarmWiki } from "../src/swarm-wiki.js";

function stand() {
  const repo = new Repo();
  const handle = repo.create<LarDoc>(emptyLarDoc());
  return { handle, wiki: controlSwarmWiki(async () => handle) };
}

test("RED: a written record reads back and rests with disk-projection no; CONTROL: an unwritten title reads null and a rewrite replaces", async () => {
  const { handle, wiki } = stand();
  const title = swarmGoTitle("feature/x");
  expect(await wiki.read(title)).toBeNull();
  await wiki.write(title, "one");
  expect(await wiki.read(title)).toBe("one");
  expect(JSON.stringify(ownEntry(handle.doc()?.tiddlers, title))).toContain("disk-projection");
  await wiki.write(title, "two");
  expect(await wiki.read(title)).toBe("two");
});

test("RED: racing writeNew claims land exactly one and the winner's text stands; CONTROL: a claim at another title lands", async () => {
  const { wiki } = stand();
  const title = swarmGoSpentTitle("c".repeat(64));
  const landed = await Promise.all([1, 2, 3, 4].map((n) => wiki.writeNew(title, `spender-${n}`)));
  expect(landed.filter(Boolean)).toHaveLength(1);
  expect(await wiki.read(title)).toBe(`spender-${landed.indexOf(true) + 1}`);
  expect(await wiki.writeNew(swarmGoSpentTitle("d".repeat(64)), "other")).toBe(true);
});

test("RED: a prototype-keyed title reads as absent, never an inherited member; CONTROL: writing a title that is not one reads it back", async () => {
  const { wiki } = stand();
  expect(await wiki.read("constructor")).toBeNull();
  expect(await wiki.read("__proto__")).toBeNull();
  await wiki.write("$:/lares/swarm/go/constructor", "x");
  expect(await wiki.read("$:/lares/swarm/go/constructor")).toBe("x");
});

test("RED: a branch's go rows list under its family title, and only its own (a go reader walks them all); CONTROL: another branch's row stays out", async () => {
  const { wiki } = stand();
  const rowA = swarmGoRowTitle("feature/x", "a".repeat(64)), rowB = swarmGoRowTitle("feature/x", "b".repeat(64));
  await wiki.writeNew(rowA, "a");
  await wiki.writeNew(rowB, "b");
  await wiki.writeNew(swarmGoRowTitle("feature/x/y", "c".repeat(64)), "c");
  expect([...await wiki.list(`${swarmGoTitle("feature/x")}/`)].sort()).toEqual([rowA, rowB].sort());
  expect(await wiki.list(`${swarmGoTitle("feature/z")}/`)).toEqual([]);
});
