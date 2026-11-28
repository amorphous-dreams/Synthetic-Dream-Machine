/**
 * book-put-then-promote.test.ts — a book its keeper minted takes a put and promotes it, with no wiki opened between.
 *
 * The walk `tools/mesh-scenarios.sh meme` rides on its first hearth, on one staged vessel:
 *
 *   wiki init <book>  →  put title=<uri> recipe=<book>  →  act MOVE <uri> --from <book working> --to <book canon>
 *
 *   B1 RED      the put's own answer names the layer it rested in, and a MOVE from THAT layer carries the family.
 *   B2 CONTROL  the canon read answers the put's bytes (the hash the put answered).
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { stagedTarget, targetInstance, type LarInstance } from "../harness/instance.js";

const BOOK    = "put-promote-book";
const URI     = "lar:///t.witness.npc/inventory";
const WORKING = `lar:///ha.ka.ba/wikis/${BOOK}/working`;
const CANON   = `lar:///ha.ka.ba/bags/${BOOK}`;
const MEME = [
  "<<^ code=`&#x0001;` from=`?` to=`" + URI + "`>>", "<<^ code=`&#x0002;`>>", "",
  "```toml meta", 'uri-path = "t.witness.npc/inventory"', 'bag = "backpack: rope, lantern"', "```", "",
  "<<~ ahu slot=`#/a`>>", "", "! a", "", "<<~/ahu>>", "",
  "<<^ code=`&#x0003;`>>", "", "<<^ code=`&#x0004;` to=`?`>>", "",
].join("\n");

let lar: LarInstance;

beforeAll(async () => { lar = await targetInstance(); }, 180_000);
afterAll(async () => {
  await lar.stop();
  if (lar.mode === "staged") rmSync(lar.root, { recursive: true, force: true });
});

describe.skipIf(!stagedTarget)("a minted book takes a put and promotes it", () => {
  test("B1 RED the put rests in the book's working layer and a MOVE from there carries the family; B2 CONTROL canon answers the put's hash", async () => {
    const minted = await lar.cli(["wiki", "init", BOOK, "json=true"]);
    expect(minted.json?.["ok"], `mint refused: ${JSON.stringify(minted.json)}`).toBe(true);

    const file = join(lar.root, "npc.mem");
    writeFileSync(file, MEME);
    const put = await lar.cli(["put", `title=${URI}`, `recipe=${BOOK}`, `file=${file}`, "json=true"]);
    expect(put.json?.["ok"], `put refused: ${JSON.stringify(put.json)}`).toBe(true);
    const putData = put.json?.["data"] as { bag?: string; canonicalHash?: string } | undefined;
    expect(putData?.bag, `the put names its layer: ${JSON.stringify(put.json)}`).toBe(WORKING);

    const moved = await lar.cli(["lar:///carriage.bag.moves", `title=${URI}`, `from=${WORKING}`, `to=${CANON}`, "yes=true", "json=true"]);
    expect(moved.json?.["ok"], `MOVE refused: ${JSON.stringify(moved.json)}`).toBe(true);
    expect(Number((moved.json?.["data"] as { moved?: unknown } | undefined)?.moved ?? 0)).toBeGreaterThan(0);

    const got = await lar.cli(["get", `title=${URI}`, `bag=${BOOK}`, "mu=assert", "json=true"]);
    expect(got.json?.["ok"], `canon read refused: ${JSON.stringify(got.json)}`).toBe(true);
    expect((got.json?.["data"] as { meme?: { canonicalHash?: string } } | undefined)?.meme?.canonicalHash).toBe(putData?.canonicalHash);
  }, 300_000);
});
