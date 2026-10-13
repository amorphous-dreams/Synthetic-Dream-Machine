/**
 * node-circle-store — the follow-graph and the handle-book, each one row sealed under the vessel key and read
 * through the custody seat.
 *
 *   C1  a saved handle-book seals at rest and restores whole; the file carries the vessel key's seal and none of
 *       the nym.                                              control: before the save it reads as an empty book
 *   C2  a record whose own causal closure does not verify drops at the restore boundary, and the rest of the book
 *       stands.                                               control: the untouched record still recognises
 *   C3  a handle-book row that stands and does not open refuses by name: one frame byte moved, a truncated row, a
 *       BARE row (clear JSON at the path). None reads as an empty book, and a save over it refuses and moves no byte.
 *                                                             control: the intact row restores
 *   C4  a handle-book row that opens to another shape (not JSON, another era, no record list, a record that lost
 *       its shape) refuses `malformed` at the load AND at a save, which moves no byte over it.
 *                                                             control: this era's empty snapshot restores empty,
 *                                                             and a save lands over it
 *   C5  the follow-graph seals at rest and round-trips: add, add again, remove, members, circles. An unfollow of
 *       an edge nobody holds moves no byte, and a circle named for an inherited slot keeps its own edges.
 *                                                             control: before the first add it reads no circle
 *   C6  a graph row that does not open, or opens to another shape, refuses at every op and no byte moves.
 *                                                             control: the intact graph takes the same add
 *   C7  at the floor every door of both stores refuses `CustodyLocked` and no file moves.
 *   C8  TAMPER PROBE. Under a holder that kept a RETIRED key (the custody rotated under another hand), every read
 *       and every write of both rows refuses `key-fails`, real from the holder's own door to the sealed writer, and
 *       no byte moves. A stranger key handed straight to the sealed writer refuses `TreeVkRefusal` over both rows.
 *                                                             control: a holder over the new key reads both rows
 *   C9  TWO HOLDERS OVER ONE TREE NEVER DROP AN EDGE: the seated store and a second holder over the same homes add
 *       to one circle at once, and every edge lands.          control: the second holder reads the whole set
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  HandleBook, HANDLE_BOOK_SNAPSHOT_ERA, mintPersonaGlamour, mintVk, readVkCarrier, writeSealedCarrier, TreeVkRefusal,
  type LarDoc,
} from "@lararium/mesh";
import { makeNodeCircleStore, loadNodeHandleBook, saveNodeHandleBook, CIRCLES_FILE, HANDLE_BOOK_FILE } from "../src/node-circle-store.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { vkSlotsPath } from "../src/vault-carriers.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const SEED = Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 5 + 11) & 0xff));
const OWNER = "persona-" + "cd".repeat(32);
const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));

function board(): { doc(): LarDoc; change(fn: (doc: LarDoc) => void): void } {
  const doc = { tiddlers: {} } as LarDoc;
  return { doc: () => doc, change: (fn) => fn(doc) };
}
async function cardAt(handleIndex: number) {
  return (await mintPersonaGlamour({ board: board(), seed: SEED, handleIndex, glamour: "A", store: {
    load: async () => null, save: async () => undefined, list: async () => [],
  }, ownerPersonaKelPrefix: OWNER })).card;
}
async function bookOf(...indexes: number[]): Promise<{ book: HandleBook; nyms: string[] }> {
  const book = new HandleBook();
  const nyms: string[] = [];
  for (const i of indexes) {
    const card = await cardAt(i);
    expect((await book.ingest(card)).ok).toBe(true);
    nyms.push(card.nym);
  }
  return { book, nyms };
}

let c: SeatedScratchCustody;
const at = (file: string): string => join(c.homes.identity, file);
beforeEach(async () => { c = await seatScratchCustody("circles"); });
afterEach(async () => { await c.drop(); });

describe("the handle-book row", () => {
  test("C1 a saved book seals at rest and restores whole", async () => {
    expect((await loadNodeHandleBook()).nyms()).toEqual([]);
    expect(existsSync(at(HANDLE_BOOK_FILE))).toBe(false);
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(book);
    expect(readVkCarrier(readFileSync(at(HANDLE_BOOK_FILE)))).toBe("sealed");
    expect(readFileSync(at(HANDLE_BOOK_FILE)).includes(Buffer.from(nyms[0]!))).toBe(false);
    const restored = await loadNodeHandleBook();
    expect(restored.nyms()).toEqual(nyms);
    expect(restored.isRecognized(nyms[0]!)).toBe(true);
  });

  test("C2 a record whose closure does not verify drops at the restore boundary", async () => {
    const { book, nyms } = await bookOf(0, 1);
    const snapshot = structuredClone(book.snapshot());
    const forged = snapshot.records.findIndex((r) => r.nym === nyms[0]);
    (snapshot.records[forged]!.accepted[0] as { glamour: string }).glamour = "forged";
    await c.holder.writeRow("identity", HANDLE_BOOK_FILE, enc(snapshot));
    const restored = await loadNodeHandleBook();
    expect(restored.isRecognized(nyms[0]!)).toBe(false);
    expect(restored.isRecognized(nyms[1]!)).toBe(true);   // control
  });

  test("C3 a row that stands and does not open refuses by name; a save moves no byte over it", async () => {
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(book);
    const intact = readFileSync(at(HANDLE_BOOK_FILE));
    const tampered = Buffer.from(intact);
    tampered[tampered.length - 7] = tampered[tampered.length - 7]! ^ 0x01;
    expect(tampered.equals(intact)).toBe(false);
    for (const [label, bytes, reads] of [
      ["tampered", tampered, /reads (key-fails|torn)/], ["truncated", intact.subarray(0, intact.length - 9), /reads (key-fails|torn)/],
      ["bare", Buffer.from(JSON.stringify(book.snapshot())), /reads bare/],
    ] as const) {
      writeFileSync(at(HANDLE_BOOK_FILE), bytes);
      await expect(loadNodeHandleBook(), label).rejects.toThrow(CustodyRowUnavailable);
      await expect(loadNodeHandleBook(), label).rejects.toThrow(reads);
      await expect(saveNodeHandleBook(new HandleBook()), label).rejects.toThrow();
      expect(readFileSync(at(HANDLE_BOOK_FILE)).equals(bytes), `${label}: the bytes at rest never moved`).toBe(true);
    }
    writeFileSync(at(HANDLE_BOOK_FILE), intact);
    expect((await loadNodeHandleBook()).nyms()).toEqual(nyms);   // control
  });

  test("C4 a row that opens to another shape refuses malformed", async () => {
    for (const shape of ["not json", JSON.stringify({ era: "scalar-handle-book-0", records: [] }), JSON.stringify({ era: HANDLE_BOOK_SNAPSHOT_ERA }), "[]", "null"]) {
      await c.holder.writeRow("identity", HANDLE_BOOK_FILE, new TextEncoder().encode(shape));
      await expect(loadNodeHandleBook(), shape).rejects.toThrow(/\.handle-book\.json reads malformed/);
    }
    // a record that lost its shape refuses the whole book: a restore that skipped it would let the next save erase it
    const { book, nyms } = await bookOf(0, 1);
    for (const bend of [
      (r: Record<string, unknown>) => { r["accepted"] = null; },
      (r: Record<string, unknown>) => { r["nym"] = 7; },
      (r: Record<string, unknown>) => { (r["accepted"] as Array<Record<string, unknown>>)[0]!["nym"] = "another-nym"; },
    ]) {
      const snapshot = structuredClone(book.snapshot()) as unknown as { records: Array<Record<string, unknown>> };
      bend(snapshot.records[0]!);
      await c.holder.writeRow("identity", HANDLE_BOOK_FILE, enc(snapshot));
      const standing = readFileSync(at(HANDLE_BOOK_FILE));
      await expect(loadNodeHandleBook()).rejects.toThrow(/\.handle-book\.json reads malformed/);
      // A SAVE NEVER LANDS OVER A ROW THAT TURNED UNREADABLE since its caller loaded the book
      await expect(saveNodeHandleBook(book)).rejects.toThrow(/\.handle-book\.json reads malformed/);
      expect(readFileSync(at(HANDLE_BOOK_FILE)).equals(standing)).toBe(true);
    }
    await c.holder.writeRow("identity", HANDLE_BOOK_FILE, enc({ era: HANDLE_BOOK_SNAPSHOT_ERA, records: [] }));
    expect((await loadNodeHandleBook()).nyms()).toEqual([]);   // control
    await saveNodeHandleBook(book);                              // control: over a whole snapshot the save lands
    expect((await loadNodeHandleBook()).nyms().sort()).toEqual([...nyms].sort());
  });
});

describe("the follow-graph row", () => {
  test("C5 the graph seals at rest and round-trips", async () => {
    const circles = makeNodeCircleStore();
    expect(await circles.circles()).toEqual([]);
    expect(await circles.members("following")).toEqual([]);
    expect(existsSync(at(CIRCLES_FILE))).toBe(false);
    await circles.add("following", "nym-b");
    await circles.add("following", "nym-a");
    expect(readVkCarrier(readFileSync(at(CIRCLES_FILE)))).toBe("sealed");
    expect(readFileSync(at(CIRCLES_FILE)).includes(Buffer.from("nym-a"))).toBe(false);
    const standing = readFileSync(at(CIRCLES_FILE));
    await circles.add("following", "nym-a");                       // a second add of a held edge moves no byte
    expect(readFileSync(at(CIRCLES_FILE)).equals(standing)).toBe(true);
    await circles.add("kin", "nym-c");
    expect(await circles.members("following")).toEqual(["nym-a", "nym-b"]);
    expect(await circles.circles()).toEqual(["following", "kin"]);
    await circles.remove("following", "nym-b");
    expect(await circles.members("following")).toEqual(["nym-a"]);
    expect(await circles.members("kin")).toEqual(["nym-c"]);
    // an unfollow of an edge nobody holds moves no byte and names no circle
    const settled = readFileSync(at(CIRCLES_FILE));
    await circles.remove("strangers", "nym-q");
    await circles.remove("kin", "nym-q");
    expect(readFileSync(at(CIRCLES_FILE)).equals(settled)).toBe(true);
    expect(await circles.circles()).toEqual(["following", "kin"]);
    // a circle may carry ANY name: one that names an inherited slot keeps its own edges, and its neighbours keep theirs
    await circles.add("__proto__", "nym-p");
    await circles.add("constructor", "nym-k");
    await circles.add("kin", "nym-d");
    expect(await circles.members("__proto__")).toEqual(["nym-p"]);
    expect(await circles.members("constructor")).toEqual(["nym-k"]);
    expect(await circles.members("kin")).toEqual(["nym-c", "nym-d"]);
    expect(await circles.circles()).toEqual(["__proto__", "constructor", "following", "kin"]);
  });

  test("C6 a graph row that does not open, or opens to another shape, refuses at every op", async () => {
    const circles = makeNodeCircleStore();
    await circles.add("following", "nym-a");
    const intact = readFileSync(at(CIRCLES_FILE));
    const ops: Array<[string, () => Promise<unknown> | unknown]> = [
      ["add", () => circles.add("following", "nym-z")], ["remove", () => circles.remove("following", "nym-a")],
      ["members", () => circles.members("following")], ["circles", () => circles.circles()],
    ];
    const tampered = Buffer.from(intact);
    tampered[tampered.length - 7] = tampered[tampered.length - 7]! ^ 0x01;
    for (const [label, bytes, reads] of [
      ["tampered", tampered, /reads (key-fails|torn)/], ["bare", Buffer.from(JSON.stringify({ circles: { following: ["nym-a"] } })), /reads bare/],
    ] as const) {
      writeFileSync(at(CIRCLES_FILE), bytes);
      for (const [op, run] of ops) await expect(Promise.resolve().then(run), `${label} · ${op}`).rejects.toThrow(reads);
      expect(readFileSync(at(CIRCLES_FILE)).equals(bytes)).toBe(true);
    }
    writeFileSync(at(CIRCLES_FILE), intact);
    for (const shape of ["not json", JSON.stringify({ circles: [] }), JSON.stringify({ circles: { following: "nym-a" } }), JSON.stringify({ circles: { following: [7] } }), "null"]) {
      await c.holder.writeRow("identity", CIRCLES_FILE, new TextEncoder().encode(shape));
      const standing = readFileSync(at(CIRCLES_FILE));
      for (const [op, run] of ops) await expect(Promise.resolve().then(run), `${shape} · ${op}`).rejects.toThrow(/\.circles-follow\.json reads malformed/);
      expect(readFileSync(at(CIRCLES_FILE)).equals(standing)).toBe(true);
    }
    writeFileSync(at(CIRCLES_FILE), intact);
    await circles.add("following", "nym-z");                       // control
    expect(await circles.members("following")).toEqual(["nym-a", "nym-z"]);
  });
});

describe("the key and the floor", () => {
  test("C7 at the floor every door refuses CustodyLocked and no file moves", async () => {
    const circles = makeNodeCircleStore();
    await circles.add("following", "nym-a");
    const { book } = await bookOf(1);
    await saveNodeHandleBook(book);
    const before = [CIRCLES_FILE, HANDLE_BOOK_FILE].map((f) => readFileSync(at(f)));
    await c.holder.lock();
    await expect(loadNodeHandleBook()).rejects.toThrow(CustodyLocked);
    await expect(saveNodeHandleBook(book)).rejects.toThrow(CustodyLocked);
    await expect(Promise.resolve().then(() => circles.add("following", "nym-b"))).rejects.toThrow(CustodyLocked);
    await expect(Promise.resolve().then(() => circles.remove("following", "nym-a"))).rejects.toThrow(CustodyLocked);
    await expect(Promise.resolve().then(() => circles.members("following"))).rejects.toThrow(CustodyLocked);
    await expect(Promise.resolve().then(() => circles.circles())).rejects.toThrow(CustodyLocked);
    [CIRCLES_FILE, HANDLE_BOOK_FILE].forEach((f, i) => expect(readFileSync(at(f)).equals(before[i]!), f).toBe(true));
  });

  test("C8 TAMPER PROBE: a retired key and a stranger key each land no write; the standing bytes open under the tree's key", async () => {
    const circles = makeNodeCircleStore();
    await circles.add("following", "nym-a");
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(book);

    // The custody rotates under another hand: both rows re-seal under a fresh key, and the seated holder still
    // holds the key the rotation retired. It stands real from its own door to the one sealed writer.
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = [CIRCLES_FILE, HANDLE_BOOK_FILE].map((f) => readFileSync(at(f)));
    await expect(loadNodeHandleBook()).rejects.toThrow(/reads key-fails/);
    await expect(saveNodeHandleBook(new HandleBook())).rejects.toThrow(/reads key-fails/);
    await expect(Promise.resolve().then(() => circles.add("following", "nym-b"))).rejects.toThrow(/reads key-fails/);
    await expect(Promise.resolve().then(() => circles.remove("following", "nym-a"))).rejects.toThrow(/reads key-fails/);
    await expect(Promise.resolve().then(() => circles.members("following"))).rejects.toThrow(/reads key-fails/);

    // A stranger key the slot tree never committed to, handed straight to the one sealed writer.
    const keyB = mintVk();
    for (const f of [CIRCLES_FILE, HANDLE_BOOK_FILE]) {
      await expect(writeSealedCarrier({
        io: c.io, vk: keyB, treePath: vkSlotsPath(c.homes.identity),
        carrier: { name: `identity/${f}`, path: at(f), keyClass: null }, plaintext: enc({ under: "B" }),
      })).rejects.toThrow(TreeVkRefusal);
    }
    [CIRCLES_FILE, HANDLE_BOOK_FILE].forEach((f, i) => {
      expect(readFileSync(at(f)).equals(standing[i]!), `${f} never moved`).toBe(true);
      expect(existsSync(`${at(f)}.vk-sealing`)).toBe(false);
    });

    // control: a holder over the key the tree commits to reads what the first key sealed, and takes a write
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.vk);
    seatCustody(fresh);
    expect(await circles.members("following")).toEqual(["nym-a"]);
    expect((await loadNodeHandleBook()).nyms()).toEqual(nyms);
    await circles.add("following", "nym-b");
    expect(await circles.members("following")).toEqual(["nym-a", "nym-b"]);
    await fresh.lock();
    seatCustody(c.holder);
  });

  test("C9 two holders over one tree never drop an edge", async () => {
    const circles = makeNodeCircleStore();
    const other = makeCustodyHolder({ io: new FsCustodyIo(c.homes), homes: c.homes });
    await other.adopt(c.vk);
    const viaOther = (nym: string): Promise<void> => other.updateRow("identity", CIRCLES_FILE, (standing) => {
      if (standing.reading === "unavailable" || standing.reading === "locked") throw new Error(`the row reads ${standing.reading}`);
      const map = standing.reading === "opens"
        ? (JSON.parse(new TextDecoder().decode(standing.plaintext)) as { circles: Record<string, string[]> }).circles : {};
      map["following"] = [...new Set([...(map["following"] ?? []), nym])].sort();
      return { plaintext: enc({ circles: map }), value: undefined };
    });
    await Promise.all([
      circles.add("following", "nym-0"), viaOther("nym-1"), circles.add("following", "nym-2"),
      viaOther("nym-3"), circles.add("following", "nym-4"), viaOther("nym-5"),
    ]);
    expect(await circles.members("following")).toEqual(["nym-0", "nym-1", "nym-2", "nym-3", "nym-4", "nym-5"]);
    const seen = await other.readRow("identity", CIRCLES_FILE);   // control
    expect(seen.reading).toBe("opens");
    await other.lock();
  });
});
