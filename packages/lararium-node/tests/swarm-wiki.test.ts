/**
 * swarm-wiki — the swarm's records rest in ONE sealed custody row on this vessel, never a document: a record reads back what
 * wrote it and survives a fresh port (a restart), the row rests sealed, a `writeNew` claim lands once however many writers race
 * it, and a prototype-keyed title reads as absent. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { swarmLeiRecordTitle, swarmLeiTitle, swarmLeiReturnedTitle } from "@lararium/mesh/swarm-tiddlers";
import { custodySwarmWiki, SWARM_RECORDS_FILE } from "../src/swarm-wiki.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("swarm-wiki"); });
afterEach(async () => { await c.drop(); });

function stand() {
  return { wiki: custodySwarmWiki() };
}

test("RED: a written record reads back through a fresh port and rests sealed; CONTROL: an unwritten title reads null and a rewrite replaces", async () => {
  const { wiki } = stand();
  const title = swarmLeiTitle("push", "feature/x");
  expect(await wiki.read(title)).toBeNull();
  await wiki.write(title, "one-sealed-text");
  expect(await custodySwarmWiki().read(title)).toBe("one-sealed-text");   // a fresh port (a restart) reads it back
  expect(readFileSync(join(larIdentityDir(), SWARM_RECORDS_FILE), "utf8")).not.toContain("one-sealed-text");
  await wiki.write(title, "two");
  expect(await wiki.read(title)).toBe("two");
});

test("RED: racing writeNew claims land exactly one and the winner's text stands; CONTROL: a claim at another title lands", async () => {
  const { wiki } = stand();
  const title = swarmLeiReturnedTitle("c".repeat(64), 1);
  const landed = await Promise.all([1, 2, 3, 4].map((n) => wiki.writeNew(title, `spender-${n}`)));
  expect(landed.filter(Boolean)).toHaveLength(1);
  expect(await wiki.read(title)).toBe(`spender-${landed.indexOf(true) + 1}`);
  expect(await wiki.writeNew(swarmLeiReturnedTitle("d".repeat(64), 1), "other")).toBe(true);
});

test("RED: a prototype-keyed title reads as absent, never an inherited member; CONTROL: writing a title that is not one reads it back", async () => {
  const { wiki } = stand();
  expect(await wiki.read("constructor")).toBeNull();
  expect(await wiki.read("__proto__")).toBeNull();
  await wiki.write("$:/lares/swarm/lei/constructor", "x");
  expect(await wiki.read("$:/lares/swarm/lei/constructor")).toBe("x");
});

test("RED: a branch's go rows list under its family title, and only its own (a go reader walks them all); CONTROL: another branch's row stays out", async () => {
  const { wiki } = stand();
  const rowA = swarmLeiRecordTitle("push", "feature/x", "a".repeat(64)), rowB = swarmLeiRecordTitle("push", "feature/x", "b".repeat(64));
  await wiki.writeNew(rowA, "a");
  await wiki.writeNew(rowB, "b");
  await wiki.writeNew(swarmLeiRecordTitle("push", "feature/x/y", "c".repeat(64)), "c");
  expect([...await wiki.list(`${swarmLeiTitle("push", "feature/x")}/`)].sort()).toEqual([rowA, rowB].sort());
  expect(await wiki.list(`${swarmLeiTitle("push", "feature/z")}/`)).toEqual([]);
});
