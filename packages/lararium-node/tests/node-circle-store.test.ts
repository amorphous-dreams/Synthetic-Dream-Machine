/**
 * node-circle-store — the recogniser's handle-book, one row sealed under the vessel key and read through the
 * custody seat. The follow graph holds ONE home, the persona-scoped circles plane, and no row of this module.
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
 *   C7  at the floor both doors refuse `CustodyLocked` and no file moves.
 *   C8  TAMPER PROBE. Under a holder that kept a RETIRED key (the custody rotated under another hand), the load and
 *       the save refuse `key-fails`, real from the holder's own door to the sealed writer, and no byte moves. A
 *       stranger key handed straight to the sealed writer refuses `TreeVkRefusal`.
 *                                                             control: a holder over the new key reads the row
 *   C10 THE FOLLOW GRAPH HOLDS ONE HOME. The carrier table names no `circles` row, the node barrel and this module
 *       export no circle store, and a file spelled `.circles-follow.json` in the identity home enters no census and
 *       no custody door.                                      control: the handle-book row stands in all three
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  HandleBook, HANDLE_BOOK_SNAPSHOT_ERA, mintPersonaGlamour, mintVk, readVkCarrier, writeSealedCarrier, TreeVkRefusal,
  type LarDoc,
} from "@lararium/mesh";
import * as circleStoreModule from "../src/node-circle-store.js";
import { loadNodeHandleBook, saveNodeHandleBook, HANDLE_BOOK_FILE } from "../src/node-circle-store.js";
import * as nodeBarrel from "../src/index.js";
import { CustodyLocked, CustodyRowUnavailable, CustodyRowUnknown, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { carrierCensus, carrierTable, vkSlotsPath } from "../src/vault-carriers.js";
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

describe("the key and the floor", () => {
  test("C7 at the floor both doors refuse CustodyLocked and no file moves", async () => {
    const { book } = await bookOf(1);
    await saveNodeHandleBook(book);
    const before = readFileSync(at(HANDLE_BOOK_FILE));
    await c.holder.lock();
    await expect(loadNodeHandleBook()).rejects.toThrow(CustodyLocked);
    await expect(saveNodeHandleBook(book)).rejects.toThrow(CustodyLocked);
    expect(readFileSync(at(HANDLE_BOOK_FILE)).equals(before)).toBe(true);
  });

  test("C8 TAMPER PROBE: a retired key and a stranger key each land no write; the standing bytes open under the tree's key", async () => {
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(book);

    // The custody rotates under another hand: the row re-seals under a fresh key, and the seated holder still
    // holds the key the rotation retired. It stands real from its own door to the one sealed writer.
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = readFileSync(at(HANDLE_BOOK_FILE));
    await expect(loadNodeHandleBook()).rejects.toThrow(/reads key-fails/);
    await expect(saveNodeHandleBook(new HandleBook())).rejects.toThrow(/reads key-fails/);

    // A stranger key the slot tree never committed to, handed straight to the one sealed writer.
    const keyB = mintVk();
    await expect(writeSealedCarrier({
      io: c.io, vk: keyB, treePath: vkSlotsPath(c.homes.identity),
      carrier: { name: `identity/${HANDLE_BOOK_FILE}`, path: at(HANDLE_BOOK_FILE), keyClass: null }, plaintext: enc({ under: "B" }),
    })).rejects.toThrow(TreeVkRefusal);
    expect(readFileSync(at(HANDLE_BOOK_FILE)).equals(standing), "the row never moved").toBe(true);
    expect(existsSync(`${at(HANDLE_BOOK_FILE)}.vk-sealing`)).toBe(false);

    // control: a holder over the key the tree commits to reads what the first key sealed, and takes a write
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.vk);
    seatCustody(fresh);
    expect((await loadNodeHandleBook()).nyms()).toEqual(nyms);
    await saveNodeHandleBook(new HandleBook());
    expect((await loadNodeHandleBook()).nyms()).toEqual([]);
    await fresh.lock();
    seatCustody(c.holder);
  });
});

describe("the follow graph holds one home", () => {
  test("C10 no carrier row, no export and no custody door names a follow-graph file", async () => {
    const FOLLOW = ".circles-follow.json";
    // control: the handle-book stands as a row, as an export and behind the custody door
    expect(carrierTable().filter((r) => r.writer === "node-circle-store").map((r) => r.row)).toEqual(["handle-book"]);
    expect(typeof nodeBarrel.loadNodeHandleBook).toBe("function");
    await c.holder.writeRow("identity", HANDLE_BOOK_FILE, enc({ era: HANDLE_BOOK_SNAPSHOT_ERA, records: [] }));
    expect(carrierCensus(c.homes).map((e) => e.row)).toContain("handle-book");

    expect(carrierTable().some((r) => r.row === "circles")).toBe(false);
    expect(Object.keys(circleStoreModule).sort()).toEqual(["HANDLE_BOOK_FILE", "loadNodeHandleBook", "saveNodeHandleBook"]);
    expect("makeNodeCircleStore" in nodeBarrel).toBe(false);
    expect("CIRCLES_FILE" in nodeBarrel).toBe(false);
    writeFileSync(at(FOLLOW), "{}");
    expect(carrierCensus(c.homes).some((e) => e.file === FOLLOW)).toBe(false);
    await expect(c.holder.readRow("identity", FOLLOW)).rejects.toBeInstanceOf(CustodyRowUnknown);
    await expect(c.holder.writeRow("identity", FOLLOW, enc({}))).rejects.toBeInstanceOf(CustodyRowUnknown);
  });
});
